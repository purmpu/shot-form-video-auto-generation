"""Style 3 파이프라인 — 전체 맥락 기반 LLM 대본 생성.

전체 씬을 VLM으로 분석 → LLM 한 번 호출로 맥락 연결된 전체 대본 생성.
씬별 글자수 제한 = 영상 클립 길이(초) 기반 동적 계산.
LLM 실패 시 sentence_library 폴백.

Style 1 / Style 2 코드와 독립. 공유 유틸(gemini_script_compare_common,
sentence_library)만 임포트하고, run_style2_promo는 임포트하지 않는다.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import shutil
from datetime import datetime
from pathlib import Path

from gemini_script_compare_common import (
    BGM_PATH,
    FONT,
    ROOT,
    SOURCE_DIR,
    TTS_ENGINE,
    TTS_MODEL,
    TTS_VOICE,
    TTS_SPEED,
    VISION_MODEL,
    SUBTITLE_STYLE,
    SUBTITLE_FONT_SIZE,
    SUBTITLE_COLOR,
    analyze_frame,
    concat_videos,
    extract_frame,
    find_ffmpeg_tools,
    load_api_key,
    mix_bgm,
    openrouter_chat,
    synthesize_tts,
    probe_duration,
    render_scene_shorts_reference,
    run_command,
    write_summary_csv,
)
from inspect_vision_models import get_message_text
from sentence_library import (
    EXTERIOR, INTERIOR, COOKING_1, COOKING_2,
    MENU_CLOSEUP, MENU_LIFT, PACKAGING, WIDE_SHOT,
    INTRO_HOOKS_SEOSANAM, STYLE_LIBRARIES,
    extract_sensory_word, fill_vars,
)

OUTPUT_SLUG    = "gemini-style3"
FINAL_FILENAME = "final_style3.mp4"
SCRIPT_LABEL   = "FullContext+VLM (Style3)"

# 전체 대본 생성 LLM 모델 (환경변수로 오버라이드 가능)
SCRIPT_MODEL = os.environ.get("STYLE3_SCRIPT_MODEL", "google/gemini-2.5-flash")


# ── API 호출 비용 트래커 ─────────────────────────────────────────

# OpenRouter 모델별 단가 (USD / 1M tokens 또는 USD / 1M chars)
# ※ 실제 청구 금액과 차이날 수 있음. OpenRouter 대시보드에서 확인 권장.
_PRICE_TABLE: dict[str, tuple[float, float]] = {
    "google/gemini-2.5-flash-lite": (0.10,  0.40),
    "google/gemini-2.5-flash":      (0.15,  0.60),
    "google/gemini-2.5-pro":        (1.25, 10.00),
    "openai/gpt-4o-mini":           (0.15,  0.60),
    "x-ai/grok-voice-tts-1.0":     (15.00, 0.00),  # $/M chars
}
_KRW_PER_USD = 1_370   # 원/달러 환율 (고정 근사치)


class CostTracker:
    """API 총 호출 수와 비용만 누적한다."""

    def __init__(self):
        self.call_count = 0
        self.total_usd  = 0.0

    def _add(self, model: str, in_val: int, out_val: int, unit: str) -> None:
        p_in, p_out = _PRICE_TABLE.get(model, (0.0, 0.0))
        cost = (in_val * p_in + out_val * p_out) / 1_000_000 if unit == "tokens" \
               else in_val * p_in / 1_000_000
        self.total_usd  += cost
        self.call_count += 1

    def add_chat(self, step: str, scene_idx: int, model: str, usage: dict) -> None:
        self._add(model, usage.get("prompt_tokens", 0),
                  usage.get("completion_tokens", 0), "tokens")

    def add_tts(self, scene_idx: int, model: str, char_count: int) -> None:
        self._add(model, char_count, 0, "chars")

    def save(self, output_dir: Path) -> Path:
        """scene_summary.csv 마지막에 비용 행 추가 + 별도 xlsx 저장."""
        self._append_to_csv(output_dir / "scene_summary.csv")
        try:
            import openpyxl  # noqa
            return self._save_xlsx(output_dir)
        except ImportError:
            print("[cost] openpyxl 없음 (pip install openpyxl 으로 xlsx 활성화)")
            return output_dir / "scene_summary.csv"

    def _append_to_csv(self, csv_path: Path) -> None:
        """기존 scene_summary.csv 마지막에 비용 요약 행을 추가한다."""
        import csv as _csv
        if not csv_path.exists():
            return
        with csv_path.open("a", newline="", encoding="utf-8-sig") as f:
            w = _csv.writer(f)
            w.writerow([])
            w.writerow(["[비용 요약]"])
            w.writerow(["총 API 호출 수", self.call_count])
            w.writerow(["총 비용 ($)",    f"${self.total_usd:.4f}"])
            w.writerow(["총 비용 (₩)",    f"₩{self.total_usd * _KRW_PER_USD:,.0f}"])
            w.writerow(["※ OpenRouter 공개 단가 기준 근사치"])

    def _save_xlsx(self, output_dir: Path) -> Path:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb  = openpyxl.Workbook()
        ws  = wb.active
        ws.title = "비용 요약"
        ws.column_dimensions["A"].width = 22
        ws.column_dimensions["B"].width = 20

        thin   = Side(style="thin", color="CCCCCC")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)
        center = Alignment(horizontal="center", vertical="center")

        # 헤더
        ws.append(["항목", "값"])
        for col in (1, 2):
            c = ws.cell(1, col)
            c.font      = Font(bold=True, color="FFFFFF", size=11)
            c.fill      = PatternFill("solid", fgColor="2F4F8F")
            c.alignment = center
            c.border    = border
        ws.row_dimensions[1].height = 22

        rows = [
            ("총 API 호출 수",  self.call_count),
            ("총 비용 ($)",     f"${self.total_usd:.4f}"),
            ("총 비용 (₩)",     f"₩{self.total_usd * _KRW_PER_USD:,.0f}"),
            ("호출 1회 평균 ($)", f"${self.total_usd / max(self.call_count, 1):.6f}"),
            ("환율 기준",        f"$1 = ₩{_KRW_PER_USD:,}"),
            ("※ 단가 출처",      "OpenRouter 공개 가격 (근사치)"),
        ]
        for label, value in rows:
            ws.append([label, value])
            r = ws.max_row
            for col in (1, 2):
                c = ws.cell(r, col)
                c.border    = border
                c.alignment = Alignment(horizontal="left", vertical="center")
                c.font      = Font(size=10, bold=(col == 1))
            ws.row_dimensions[r].height = 18

        out = output_dir / "cost_summary.xlsx"
        wb.save(str(out))
        print(f"[cost] 비용 요약 저장: {out}  (총 {self.call_count}회 / ${self.total_usd:.4f} / ₩{self.total_usd * _KRW_PER_USD:,.0f})")
        return out

# 한국어 TTS 평균 발화 속도 (글자/초, speed=1.0 기준)
# 한국어 TTS 평균 발화 속도 — 보수적으로 낮게 설정해야 LLM이 짧은 문장을 생성함
# rex/eve 실측 기준 ≈ 3.8~4.0자/초. 4.0으로 설정 (4.5는 너무 낙관적).
TTS_CPS = 4.0

# TTS 목표 여유: 클립 종료 1.0초 전에 음성이 끝나도록 유도
TTS_GAP_TARGET = 1.0
# 하드 한도: 클립 종료 0.7초 전 넘으면 LLM 재단축 → 재합성 시도
TTS_GAP_HARD = 0.7


# ── CLIP 스코어 ──────────────────────────────────────────────────
import os as _os
_os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")   # OpenMP 이중 로딩 방지

_clip_model     = None
_clip_preprocess = None
_clip_tokenizer  = None

def _load_clip():
    """open_clip 기반 CLIP 모델 최초 1회 로딩 (이후 캐시 재사용)."""
    global _clip_model, _clip_preprocess, _clip_tokenizer
    if _clip_model is None:
        try:
            import open_clip
            print("[clip] CLIP 모델 로딩 중 (ViT-B-32 / openai)...")
            _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
                "ViT-B-32", pretrained="openai"
            )
            _clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
            _clip_model.eval()
            print("[clip] CLIP 모델 로딩 완료")
        except Exception as exc:
            print(f"[warn] CLIP 모델 로딩 실패 → 스코어 비활성화: {exc}")
    return _clip_model, _clip_preprocess, _clip_tokenizer

def calc_clip_score(frame_path: Path, text: str) -> float | None:
    """프레임 이미지와 자막 텍스트의 CLIP 코사인 유사도를 0~100점으로 반환.

    CLIP은 영어 기반 모델이므로 한국어 텍스트는 내부적으로 번역하지 않음.
    절대 점수보다 씬 간 상대적 비교 용도로 활용 권장.
    """
    try:
        import torch
        import torch.nn.functional as F
        from PIL import Image

        model, preprocess, tokenizer = _load_clip()
        if model is None:
            return None

        image  = preprocess(Image.open(frame_path).convert("RGB")).unsqueeze(0)
        tokens = tokenizer([text])

        with torch.no_grad():
            img_e = F.normalize(model.encode_image(image), dim=-1)
            txt_e = F.normalize(model.encode_text(tokens),  dim=-1)
            sim   = (img_e @ txt_e.T).item()          # -1 ~ 1 코사인 유사도
        score = round((sim + 1) / 2 * 100, 1)         # 0 ~ 100 변환
        return score
    except Exception as exc:
        print(f"[warn] CLIP 스코어 계산 실패 (씬 {frame_path.stem}): {exc}")
        return None


# ── 글자수 계산 ─────────────────────────────────────────────────

def calc_max_chars(duration_sec: float, tts_speed: float = 1.0, gap_sec: float = TTS_GAP_TARGET) -> int:
    """씬 클립 길이(초)로부터 TTS 최대 글자수를 역산한다.

    gap_sec=1.0 → TTS가 클립보다 1.0초 짧게 끝나도록 목표.
    예) 5.0초 클립 → (5.0 - 1.0) * 4.0 = 16자
    최솟값 8자 보장 (너무 짧은 클립도 최소한의 대사 생성).
    """
    target_sec = max(1.0, duration_sec - gap_sec)
    return max(8, int(target_sec * TTS_CPS * tts_speed))


# ── 훅 라이브러리 (Style 3 독립 정의) ───────────────────────────

_INTRO_HOOKS: dict[str, list[str]] = {
    "FOMO": [
        "{지역}에서 {메뉴} 제대로 먹고 싶다면 {가게명} 꼭 와보세요",
        "{메뉴} 먹고 싶을 땐 여기 꼭 한번 드셔보세요",
        "{지역}에 들리게 되면 여기 꼭 와보세요",
    ],
    "공감": [
        "이 집을 몰랐던 사람 저뿐만이 아니죠?",
        "{메뉴}가 이 정도일 줄 아무도 몰랐을 거예요",
        "왜 이걸 이제야 알았는지 모르겠어요",
    ],
    "희소성": [
        "{가게명}에서만 먹을 수 있어요",
        "이 맛, 여기서만 나요",
        "이런 {메뉴} 다른 데선 못 찾았어요",
    ],
    "신규발견": [
        "제가 요즘 제일 자주 가는 곳 알려드릴게요",
        "요즘 제 최애 {메뉴} 찾았어요",
        "이 집 발견하고 나서 자꾸 생각나요",
    ],
    "역발상": [
        "이 가격에 이 맛이라는 게 말이 안 돼요",
        "{메뉴} 먹으러 멀리 갈 필요 없어요",
        "비싸야 맛있다는 말 {가게명}에선 통하지 않아요",
    ],
    "수요반응": [
        "이 맛 직접 경험해 보셔야 해요",
        "한번 드셔보시면 말 다 해요",
        "말로 설명이 안 되는 맛이에요",
    ],
}


def _sample_hooks(menu: str, location: str, store: str, n: int = 3) -> list[str]:
    cats = list(_INTRO_HOOKS.keys())
    random.shuffle(cats)
    result: list[str] = []
    for cat in cats:
        if len(result) >= n:
            break
        hook = random.choice(_INTRO_HOOKS[cat])
        result.append(
            hook.replace("{메뉴}", menu)
                .replace("{지역}", location)
                .replace("{가게명}", store)
        )
    return result


# ── 슬롯 동적 생성 ──────────────────────────────────────────────

def build_slots(
    store_name: str,
    store_location: str,
    menu_names: list[str],
    has_cooking: bool,
    has_packaging: bool,
    has_interior: bool,
    table_count: int,
    style: str = "seosanam",
) -> list[dict]:
    """매장 정보를 받아 씬 슬롯 리스트를 동적으로 생성한다.
    Style 2와 동일한 슬롯 구조를 독립 구현.
    """
    main_menu = menu_names[0] if menu_names else "대표 메뉴"
    location  = store_location or "이곳"
    name      = store_name or "저희 매장"
    slots: list[dict] = []
    idx = [1]

    def add(label: str, hint: str, slot_type: str, fallback: str, is_food: bool = False):
        slots.append({
            "index": idx[0], "label": label, "hint": hint,
            "slot_type": slot_type, "fallback": fallback, "is_food": is_food,
        })
        idx[0] += 1

    # 1. 훅 슬롯 (대표 메뉴)
    if style == "seosanam":
        filled = [
            t.replace("{위치}", location).replace("{가게명}", name).replace("{메뉴명}", main_menu)
            for t in INTRO_HOOKS_SEOSANAM
        ]
        hook_candidates = random.sample(filled, min(3, len(filled)))
    else:
        hook_candidates = _sample_hooks(main_menu, location, name, n=3)

    slots.append({
        "index": 1, "label": "대표 메뉴",
        "hint": "매장을 대표하는 메뉴 음식 클로즈업. 첫 장면 훅.",
        "slot_type": "hook", "hook_candidates": hook_candidates,
        "fallback": f"{main_menu} 먹고 싶을 땐 여기 꼭 드셔보세요",
        "is_food": True,
    })
    idx[0] += 1

    # 2. 매장 외부
    add("매장 외부", "매장 외관 전체가 한눈에. 간판이 잘 보여야 함.",
        "exterior", f"{location}에 들리게 되면 한번쯤 와보세요")

    # 3. 매장 내부 (선택)
    if has_interior:
        add("매장 내부", "매장 인테리어, 좌석 전체가 보이는 넓은 샷.",
            "interior", "자리도 넉넉한 편이에요")

    # 4. 조리 과정 (선택, 2컷)
    if has_cooking:
        add("조리 과정 1", "요리사 조리 장면. 불꽃이나 연기 보이면 좋음.",
            "cooking_1", "사장님이 요리에 진심인 것 같습니다")
        add("조리 과정 2", "다른 각도 또는 다른 조리 단계.",
            "cooking_2", "맛은 걱정 안 하셔도 될 것 같아요")

    # 5. 메뉴별 클로즈업 + 들어올리기
    for menu in menu_names:
        slots.append({
            "index": idx[0], "label": f"{menu} — 클로즈업",
            "hint": f"{menu} 클로즈업. 국물·색감·질감이 잘 보이는 각도.",
            "slot_type": "menu_closeup", "menu_name": menu,
            "fallback": f"{menu}, 먹어볼 만한 것 같아요",
            "is_food": True,
        })
        idx[0] += 1
        slots.append({
            "index": idx[0], "label": f"{menu} — 들어올리기",
            "hint": f"젓가락이나 숟가락으로 {menu}를 천천히 들어올리는 씬.",
            "slot_type": "menu_lift", "menu_name": menu,
            "fallback": "한번 드셔보면 알 것 같아요",
            "is_food": False,
        })
        idx[0] += 1

    # 6. 포장 (선택)
    if has_packaging:
        add("포장/테이크아웃", "포장 용기에 담긴 메뉴.",
            "packaging", "포장도 되는 것 같아요")

    # 7. 매장 외부 전경
    add("매장 외부 전경", "매장 전체가 한눈에 들어오는 넓은 샷.",
        "wide_shot", f"{location}에 들리게 되면 한번쯤 와보세요")

    return slots


# ── 라이브러리 맵 (폴백용) ──────────────────────────────────────

_LIBRARY_MAP = {
    "exterior":     EXTERIOR,
    "interior":     INTERIOR,
    "cooking_1":    COOKING_1,
    "cooking_2":    COOKING_2,
    "menu_closeup": MENU_CLOSEUP,
    "menu_lift":    MENU_LIFT,
    "packaging":    PACKAGING,
    "wide_shot":    WIDE_SHOT,
}

_NON_FOOD_NOISE = {
    "국물", "그릇", "접시", "젓가락", "식탁", "테이블",
    "냄비", "주방", "조리대", "수저", "컵", "배경",
}


# ── sentence_library 폴백 ───────────────────────────────────────

def _pick_subtitle_fallback(
    slot: dict,
    vision: dict,
    store_name: str,
    store_location: str,
    table_count: str,
    library_map: dict,
) -> str:
    """LLM 실패 시 sentence_library에서 랜덤 선택 + 변수 치환."""
    slot_type = slot.get("slot_type", "wide_shot")
    menu_name = slot.get("menu_name", "")

    if slot_type == "hook":
        hooks = slot.get("hook_candidates", [])
        return random.choice(hooks) if hooks else slot["fallback"]

    # menu_closeup: VLM 키워드 → 감각묘사 추출
    sensory = ""
    if slot_type == "menu_closeup" and vision:
        raw_kw   = vision.get("keywords", [])
        filtered = [kw for kw in raw_kw if kw not in _NON_FOOD_NOISE]
        word     = extract_sensory_word(filtered)
        if word != "맛있는":
            sensory = word

    library = library_map.get(slot_type, WIDE_SHOT)

    if slot_type == "menu_closeup":
        named = [t for t in library if "{메뉴명}" in t]
        pool  = named if named else library
        if not sensory:
            pool = [t for t in pool if "{감각묘사}" not in t] or pool
        template = random.choice(pool)
    elif slot_type == "exterior":
        both = [t for t in library if "{위치}" in t and "{가게명}" in t]
        pool = both if both else ([t for t in library if "{위치}" in t] or library)
        template = random.choice(pool)
    else:
        template = random.choice(library)

    subtitle = fill_vars(
        template,
        가게명=store_name,
        위치=store_location,
        메뉴명=menu_name,
        테이블수=table_count,
        감각묘사=sensory,
    )
    return subtitle.strip() or slot["fallback"]


# ── 전체 맥락 LLM 대본 생성 ────────────────────────────────────

def generate_full_script_llm(
    api_key: str,
    scene_data: list[dict],
    store_name: str,
    store_location: str,
    menu_names: list[str],
    tone_style: str,
) -> list[str] | None:
    """전체 씬을 LLM에 한 번 전달해 맥락 있는 대본을 생성한다.

    Returns:
        씬 순서대로 나레이션 문자열 리스트.
        파싱 실패·개수 불일치 시 None 반환 → 호출부에서 폴백 처리.
    """
    tone_desc = (
        "단언적이고 확신 있는 톤. 문장 끝: ~이에요, ~거든요, ~이죠."
        if tone_style == "seosanam"
        else "친근하고 부드러운 완화형. 문장 끝: ~것 같아요, ~해요, ~어요."
    )

    prompt = (
        "한국 식당 홍보 숏폼 영상의 나레이션 대본을 작성하세요.\n\n"
        "## 가게 정보\n"
        f"- 가게명: {store_name or '매장'}\n"
        f"- 위치: {store_location or '이곳'}\n"
        f"- 메뉴: {', '.join(menu_names) if menu_names else '대표 메뉴'}\n"
        f"- 말투: {tone_desc}\n\n"
        f"## 씬 목록 (총 {len(scene_data)}개)\n"
        f"{json.dumps(scene_data, ensure_ascii=False, indent=2)}\n\n"
        "## 작성 규칙\n"
        "1. 전체가 하나의 스토리: 도입 훅 → 전개 → 클라이맥스 → 방문 유도 CTA\n"
        "2. 각 씬의 max_chars를 반드시 지키세요. max_chars는 영상 클립 길이에서 0.75초를 뺀 발화 시간 기준입니다.\n"
        "   글자 수를 직접 세서 확인하세요. 절대 초과하지 마세요.\n"
        "   ⚠️ 문장이 중간에 잘리면 절대 안 됩니다. 반드시 완성된 문장으로 끝내세요.\n"
        "   (예: max_chars=15 → '이게 진짜 마라탕이에요' ✓ / '이게 진짜 마라탕...' ✗)\n"
        "3. 첫 씬(hook): 강한 FOMO·희소성·공감 훅 문장\n"
        "4. menu_closeup 씬: vlm_summary·vlm_keywords 기반 감각 표현 (맛·향·식감)\n"
        "5. 마지막 씬: 방문 유도 CTA (\"꼭 와보세요\" 류)\n"
        f"6. exterior(매장 외부) 씬: 반드시 가게명 '{store_name}'과 위치 '{store_location}'를 자연스럽게 포함하세요.\n"
        "   (예: '왕십리 천라쿵푸, 여기서 찾았어요' / '성동구에 있는 이 집이에요')\n"
        "7. 확인되지 않은 정보 금지\n\n"
        "## 응답 형식\n"
        f"JSON 배열만 출력. 다른 텍스트 없음. 씬 순서 그대로 총 {len(scene_data)}개.\n"
        f'["씬1 나레이션", "씬2 나레이션", ..., "씬{len(scene_data)} 나레이션"]'
    )

    try:
        response = openrouter_chat(
            api_key,
            SCRIPT_MODEL,
            [{"role": "user", "content": prompt}],
            max_tokens=2048,
            temperature=0.4,
        )
        raw = get_message_text(response)

        # JSON 배열 추출 (마크다운 코드블록 안에 있어도 처리)
        match = re.search(r'\[[\s\S]*?\]', raw)
        if not match:
            raise ValueError(f"JSON 배열 없음. 응답 앞부분: {raw[:200]}")
        lines = json.loads(match.group())

        if not isinstance(lines, list):
            raise ValueError("응답이 리스트 형식이 아닙니다")
        if len(lines) != len(scene_data):
            raise ValueError(
                f"씬 개수 불일치: 기대 {len(scene_data)}, 받음 {len(lines)}"
            )
        usage = response.get("usage") or {}
        return [str(line).strip() for line in lines], usage

    except Exception as exc:
        print(f"[warn] LLM 대본 생성 실패 → sentence_library 폴백: {exc}")
        return None, {}


# TTS가 읽기에 너무 긴 절대 한도 (약 7초 분량)
_TTS_HARD_MAX = 32


def _shorten_with_llm(
    api_key: str,
    text: str,
    max_chars: int,
    slot_type: str,
    tone_style: str,
) -> str | None:
    """초과 대사를 LLM이 완성형 문장으로 유지하며 단축한다.

    성공 시 단축 문장 반환. 실패 또는 여전히 초과하면 None 반환.
    """
    tone_hint = "~이에요/~거든요" if tone_style == "seosanam" else "~것 같아요/~어요"
    prompt = (
        f"아래 나레이션 문장을 {max_chars}자 이내의 완성된 한국어 문장으로 짧게 바꿔주세요.\n"
        f"⚠️ 문장이 중간에 잘리면 절대 안 됩니다. 반드시 완성된 문장으로 끝내세요.\n"
        f"말투: {tone_hint} 유지. 씬 유형: {slot_type}\n\n"
        f"원문: {text}\n\n"
        "응답: 짧게 바꾼 문장만 출력 (따옴표, 부연 설명 없이)"
    )
    try:
        response = openrouter_chat(
            api_key, SCRIPT_MODEL,
            [{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.3,
        )
        usage = response.get("usage") or {}
        result = get_message_text(response).strip().strip('"').strip("'").strip()
        if result and len(result) <= max_chars + 3:
            return result, usage
        print(f"[warn] _shorten_with_llm: 결과가 여전히 초과 ({len(result)}자): {result}")
        return None, usage
    except Exception as exc:
        print(f"[warn] _shorten_with_llm 실패: {exc}")
        return None, {}


# ── 피드백 리포트 저장 ──────────────────────────────────────────

_SOURCE_LABEL = {
    "llm":              "✅ LLM 직접 생성",
    "llm_over_budget":  "⚠️ LLM 생성 (권고 글자수 초과, 완성형 유지)",
    "llm_shortened":    "✂️ LLM 재작성 (원본이 너무 길어 단축)",
    "fallback_library": "📚 sentence_library 폴백",
}


def write_scene_report(
    output_dir: Path,
    run_id: str,
    store_info: dict,
    tone_style: str,
    llm_success: bool,
    scene_details: list[dict],
) -> None:
    """씬별 VLM·LLM 상세 정보를 JSON과 Markdown 두 형식으로 저장한다."""

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── vlm_analysis.json ────────────────────────────────────────
    report_data = {
        "run_id":       run_id,
        "generated_at": generated_at,
        "store": {
            "name":     store_info.get("store_name", ""),
            "location": store_info.get("store_location", ""),
            "menus":    store_info.get("menu_names", []),
        },
        "llm_model":   SCRIPT_MODEL,
        "llm_success": llm_success,
        "total_scenes": len(scene_details),
        "scenes":      scene_details,
    }
    (output_dir / "vlm_analysis.json").write_text(
        json.dumps(report_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ── scene_report.md ──────────────────────────────────────────
    menu_str  = ", ".join(store_info.get("menu_names", []))
    llm_badge = "✅ 성공" if llm_success else "❌ 실패 (폴백 사용)"

    lines: list[str] = [
        "# Style 3 씬별 분석 리포트",
        "",
        f"- **생성일시**: {generated_at}",
        f"- **가게명**: {store_info.get('store_name', '—')}",
        f"- **위치**: {store_info.get('store_location', '—')}",
        f"- **메뉴**: {menu_str or '—'}",
        f"- **말투**: {tone_style}",
        f"- **LLM 대본**: {llm_badge} (`{SCRIPT_MODEL}`)",
        f"- **총 씬 수**: {len(scene_details)}개",
        "",
        "---",
        "",
    ]

    for d in scene_details:
        vlm = d["vlm"]
        li  = d["llm_input"]
        src = _SOURCE_LABEL.get(d["subtitle_source"], d["subtitle_source"])

        lines += [
            f"## 씬 {d['index']} — {d['label']} `{d['slot_type']}`",
            "",
            "| 항목 | 내용 |",
            "|------|------|",
            f"| 파일 | `{d['source_file']}` |",
            f"| 클립 길이 | {d['clip_duration_sec']:.1f}초 |",
            f"| 최대 글자수 | {d['max_chars']}자 |",
            "",
        ]

        # VLM 전체 출력
        lines += [
            "### VLM 분석 결과 (Gemini Vision 전체 6개 필드)",
            "",
            f"- **장면 설명**: {vlm['scene_summary'] or '—'}",
            f"- **감지된 음식**: {', '.join(vlm['detected_food_or_menu']) or '—'}",
            f"- **감지된 사물**: {', '.join(vlm['detected_objects']) or '—'}",
            f"- **키워드 (8개)**: {', '.join(vlm['keywords']) or '—'}",
            f"- **VLM 자막 후보**: {vlm['caption_candidate'] or '—'}",
            f"- **영상 분위기**: {vlm['visual_mood'] or '—'}",
            "",
        ]

        # LLM에 전달된 데이터
        kw_str = ", ".join(li["vlm_keywords"]) if li["vlm_keywords"] else "—"
        lines += [
            "### LLM에 전달된 데이터 (VLM 6개 중 2개 + 슬롯 정보)",
            "",
            f"- `vlm_summary`: \"{li['vlm_summary'] or ''}\"",
            f"- `vlm_keywords`: [{kw_str}]",
            f"- `max_chars`: {li['max_chars']}",
            f"- `slot_type`: {d['slot_type']}",
            f"- `menu_name`: {d.get('menu_name', '') or '(없음)'}",
            "",
        ]

        # 대사 생성 결과
        lines += [
            "### 대사 생성 결과",
            "",
            f"- **출처**: {src}",
        ]
        if d["llm_raw_output"] and d["llm_raw_output"] != d["final_subtitle"]:
            lines.append(f"- **LLM 원본** ({len(d['llm_raw_output'])}자): {d['llm_raw_output']}")
        lines += [
            f"- **최종 대사** ({len(d['final_subtitle'])}자): **{d['final_subtitle']}**",
            "",
            "---",
            "",
        ]

    (output_dir / "scene_report.md").write_text(
        "\n".join(lines), encoding="utf-8",
    )
    print(f"[report] vlm_analysis.json + scene_report.md 저장 완료")


# ── 어그로 인트로 ───────────────────────────────────────────────

def _prepend_intro(ffmpeg: Path, intro: Path, main: Path, output: Path) -> None:
    """인트로 영상을 메인 영상(1080×1920, 25fps, 24000Hz mono) 앞에 이어붙인다."""
    run_command([
        str(ffmpeg), "-y",
        "-i", str(intro), "-i", str(main),
        "-filter_complex",
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,"
        "setsar=1,fps=fps=25,setpts=PTS-STARTPTS[v0];"
        "[0:a]aformat=sample_rates=24000:channel_layouts=mono,"
        "asetpts=PTS-STARTPTS[a0];"
        "[1:v]setpts=PTS-STARTPTS[v1];"
        "[1:a]asetpts=PTS-STARTPTS[a1];"
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-ar", "24000", "-ac", "1",
        str(output),
    ])


# ── CLI ────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Style 3: 전체 맥락 LLM 대본 생성")
    parser.add_argument("--bgm",            default=str(BGM_PATH))
    parser.add_argument("--aggro-intro",    default="", help="앞에 붙일 인트로 영상 경로")
    parser.add_argument("--run-id",         default=datetime.now().strftime("%Y%m%d-%H%M%S"))
    parser.add_argument("--tts",            choices=["xai", "openrouter", "edge", "piper"], default=TTS_ENGINE)
    parser.add_argument("--headline",       default="마라탕 땡기는 날\\n여긴 어때?")
    parser.add_argument("--slot-files",     default="", help="쉼표 구분 파일명 목록")
    parser.add_argument("--store-name",     default="")
    parser.add_argument("--store-location", default="")
    parser.add_argument("--menu-names",     default="", help="쉼표 구분 메뉴 이름 목록")
    parser.add_argument("--has-cooking",    action="store_true", default=False)
    parser.add_argument("--has-packaging",  action="store_true", default=False)
    parser.add_argument("--has-interior",   action="store_true", default=False)
    parser.add_argument("--table-count",    type=int, default=0)
    parser.add_argument("--style",          default="seosanam", choices=["seosanam", "dudley"])
    parser.add_argument("--subtitle-y",     type=int, default=-1, help="자막 Y 위치 %% (0~100), -1=기본값")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    bgm_path = Path(args.bgm)
    if not bgm_path.is_absolute():
        bgm_path = ROOT / bgm_path
    if not bgm_path.exists():
        raise FileNotFoundError(bgm_path)
    if not FONT.exists():
        raise FileNotFoundError(FONT)

    api_key = load_api_key()
    tools   = find_ffmpeg_tools()
    cost_tracker = CostTracker()

    output_dir   = ROOT / "outputs" / OUTPUT_SLUG / args.run_id
    frames_dir   = output_dir / "frames"
    tts_dir      = output_dir / "tts"
    rendered_dir = output_dir / "rendered"
    for d in [frames_dir, tts_dir, rendered_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # 파일 목록
    if args.slot_files:
        filenames = [f.strip() for f in args.slot_files.split(",") if f.strip()]
    else:
        filenames = sorted(
            f.name for f in SOURCE_DIR.iterdir()
            if f.is_file() and f.suffix.lower() in {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm"}
        )

    menu_names = [m.strip() for m in args.menu_names.split(",") if m.strip()] if args.menu_names else ["대표 메뉴"]
    store_info = {
        "store_name":     args.store_name,
        "store_location": args.store_location,
        "menu_names":     menu_names,
        "table_count":    args.table_count,
    }

    active_library = STYLE_LIBRARIES[args.style]

    all_slots = build_slots(
        store_name=args.store_name, store_location=args.store_location,
        menu_names=menu_names, has_cooking=args.has_cooking,
        has_packaging=args.has_packaging, has_interior=args.has_interior,
        table_count=args.table_count, style=args.style,
    )
    slots = all_slots[:len(filenames)]
    total_slots = len(slots)

    if total_slots == 0:
        raise RuntimeError("슬롯이 0개입니다. 매장 정보와 영상 파일을 확인하세요.")
    if len(filenames) < total_slots:
        print(f"[warn] 파일 {len(filenames)}개 < 슬롯 {total_slots}개 → {len(filenames)}개 슬롯만 처리")

    # ── Phase 0: 클립 길이 측정 → 씬별 글자수 제한 계산 ──────────
    print("[progress:5%]")
    print("[style3] Phase 0: 클립 길이 측정 및 글자수 제한 계산")
    clip_durations: list[float] = []
    for filename in filenames[:total_slots]:
        src = SOURCE_DIR / filename
        try:
            dur = probe_duration(tools["ffprobe"], src)
        except Exception as exc:
            print(f"[warn] {filename} 길이 측정 실패 → 기본 4.0초 사용: {exc}")
            dur = 4.0
        clip_durations.append(dur)
        max_c = calc_max_chars(dur, TTS_SPEED)
        print(f"[duration] {filename}: {dur:.1f}초 → max_chars={max_c}")

    for i, slot in enumerate(slots):
        slot["clip_duration"] = clip_durations[i]
        slot["max_chars"]     = calc_max_chars(clip_durations[i], TTS_SPEED)

    # ── Phase 1: 전체 씬 VLM 분석 ─────────────────────────────────
    print("[progress:10%]")
    print("[style3] Phase 1: 전체 씬 VLM 분석 (모든 씬 타입)")
    vision_rows: list[dict] = []

    for si, (slot, filename) in enumerate(zip(slots, filenames), 1):
        pct = 10 + int(si / total_slots * 30)   # 10~40%
        print(f"[progress:{pct}%]")

        source = SOURCE_DIR / filename
        if not source.exists():
            raise FileNotFoundError(f"영상 파일 없음: {source}")

        frame = frames_dir / f"scene_{slot['index']:02d}.jpg"
        print(f"[vision] slot {slot['index']} [{slot['label']}]: {filename}")
        try:
            extract_frame(tools["ffmpeg"], source, frame, 1.0)
            vision, raw_v, _vlm_usage = analyze_frame(api_key, frame)
            cost_tracker.add_chat("VLM", slot["index"], VISION_MODEL, _vlm_usage)
        except Exception as exc:
            print(f"[warn] VLM 실패 → 빈 결과 사용: {exc}")
            vision, raw_v = {}, ""

        vision_rows.append({
            "scene":       slot["index"],
            "slot_label":  slot["label"],
            "reference":   slot["label"],
            "source_file": filename,
            "source":      str(source),
            "frame":       str(frame),
            "parsed":      vision,
            "raw_output":  raw_v,
        })
        slot["_vision"] = vision   # 폴백용 임시 보관

    # ── 썸네일 저장 (대표메뉴 슬롯 = scene_01) ────────────────────
    thumbnail_path = output_dir / "thumbnail.jpg"
    _thumb_src = frames_dir / "scene_01.jpg"
    if _thumb_src.exists():
        shutil.copy2(_thumb_src, thumbnail_path)
        print(f"[thumbnail] 썸네일 저장: {thumbnail_path}")
    else:
        thumbnail_path = None

    # ── Phase 2: 전체 맥락 LLM 대본 생성 ─────────────────────────
    print("[progress:45%]")
    print(f"[style3] Phase 2: LLM 전체 대본 생성 (모델: {SCRIPT_MODEL})")

    scene_data_for_llm = []
    for slot, vrow in zip(slots, vision_rows):
        vlm = vrow["parsed"]
        scene_data_for_llm.append({
            "index":        slot["index"],
            "slot_type":    slot["slot_type"],
            "label":        slot["label"],
            "menu_name":    slot.get("menu_name", ""),
            "vlm_summary":  vlm.get("scene_summary", ""),
            "vlm_keywords": vlm.get("keywords", [])[:5],
            "max_chars":    slot["max_chars"],
        })

    llm_lines, _llm_usage = generate_full_script_llm(
        api_key,
        scene_data_for_llm,
        store_name=args.store_name,
        store_location=args.store_location,
        menu_names=menu_names,
        tone_style=args.style,
    )
    cost_tracker.add_chat("LLM_script", 0, SCRIPT_MODEL, _llm_usage)

    if llm_lines:
        print(f"[style3] ✅ LLM 대본 생성 성공 ({len(llm_lines)}개 씬)")
        for i, line in enumerate(llm_lines):
            slot_label = slots[i]["label"] if i < len(slots) else f"씬{i+1}"
            print(f"  [{slot_label}] {line}")
    else:
        print("[style3] ⚠ LLM 실패 → sentence_library 폴백으로 전환")

    # ── script_scenes 구성 ─────────────────────────────────────────
    print("[progress:50%]")
    script_scenes: list[dict] = []
    scene_details: list[dict] = []   # 피드백 리포트용 상세 정보

    for i, (slot, vrow) in enumerate(zip(slots, vision_rows)):
        llm_raw    = llm_lines[i] if llm_lines else None
        sub_source = "fallback_library"

        if llm_lines:
            subtitle = llm_lines[i]
            max_c = slot["max_chars"]

            if len(subtitle) > _TTS_HARD_MAX:
                # 절대 한도(_TTS_HARD_MAX) 초과 → LLM 재작성으로 완성형 단축
                print(f"[style3] 씬{slot['index']} 하드 초과({len(subtitle)}자) → LLM 재작성 시도")
                shortened = _shorten_with_llm(
                    api_key, subtitle, max_c,
                    slot["slot_type"], args.style,
                )
                if shortened:
                    print(f"[style3] 씬{slot['index']} 재작성 완료({len(shortened)}자): {shortened}")
                    subtitle   = shortened
                    sub_source = "llm_shortened"
                else:
                    # 재작성 실패 → sentence_library 폴백 (완성형 보장)
                    subtitle = _pick_subtitle_fallback(
                        slot, vrow["parsed"],
                        store_name=args.store_name,
                        store_location=args.store_location,
                        table_count=str(args.table_count),
                        library_map=active_library,
                    )
                    sub_source = "fallback_library"
                    print(f"[style3] 씬{slot['index']} 재작성 실패 → 폴백: {subtitle}")
            elif len(subtitle) > max_c:
                # max_chars는 초과했지만 _TTS_HARD_MAX 이하 → 완성형이므로 그냥 허용
                sub_source = "llm_over_budget"
                print(f"[style3] 씬{slot['index']} 권고 초과({len(subtitle)}자>{max_c}자) → 완성형 유지")
            else:
                sub_source = "llm"
        else:
            subtitle = _pick_subtitle_fallback(
                slot, vrow["parsed"],
                store_name=args.store_name,
                store_location=args.store_location,
                table_count=str(args.table_count),
                library_map=active_library,
            )

        script_scenes.append({
            "scene":        slot["index"],
            "subtitle":     subtitle,
            "narration":    subtitle,
            "title":        slot["label"][:16],
            "duration_sec": 4.0,
        })

        # ── CLIP 스코어: 프레임 이미지 ↔ VLM 키워드 유사도 ──────────
        # subtitle(홍보 문구)보다 VLM keywords가 프레임 시각 내용을 직접 기술하므로 더 적합.
        # keywords 없으면 caption_candidate → scene_summary → subtitle 순으로 폴백.
        frame_path = frames_dir / f"scene_{slot['index']:02d}.jpg"
        _vlm_parsed = vrow["parsed"]
        _kw = _vlm_parsed.get("keywords", [])
        if _kw:
            clip_text = ", ".join(str(k) for k in _kw)
        elif _vlm_parsed.get("caption_candidate"):
            clip_text = _vlm_parsed["caption_candidate"]
        elif _vlm_parsed.get("scene_summary"):
            clip_text = _vlm_parsed["scene_summary"]
        else:
            clip_text = subtitle
        clip_sc = calc_clip_score(frame_path, clip_text)
        if clip_sc is not None:
            print(f"[clip] 씬{slot['index']} ({slot['slot_type']}) CLIP score: {clip_sc:.1f}  (text: {clip_text[:40]})")

        # 피드백 리포트용 상세 정보
        vlm = vrow["parsed"]
        scene_details.append({
            "index":            slot["index"],
            "label":            slot["label"],
            "slot_type":        slot["slot_type"],
            "source_file":      vrow["source_file"],
            "clip_duration_sec":slot.get("clip_duration", 4.0),
            "max_chars":        slot["max_chars"],
            "vlm": {
                "scene_summary":         vlm.get("scene_summary", ""),
                "detected_food_or_menu": vlm.get("detected_food_or_menu", []),
                "detected_objects":      vlm.get("detected_objects", []),
                "keywords":              vlm.get("keywords", []),
                "caption_candidate":     vlm.get("caption_candidate", ""),
                "visual_mood":           vlm.get("visual_mood", ""),
            },
            "llm_input": {
                "vlm_summary":  vlm.get("scene_summary", ""),
                "vlm_keywords": vlm.get("keywords", [])[:5],
                "max_chars":    slot["max_chars"],
            },
            "llm_raw_output":  llm_raw,
            "subtitle_source": sub_source,
            "clip_score":      clip_sc,
            "final_subtitle":  subtitle,
        })

    # ── Phase 3: TTS + 렌더링 ─────────────────────────────────────
    rendered_paths: list[Path] = []
    for ri, (slot, filename, script_scene) in enumerate(zip(slots, filenames, script_scenes), 1):
        pct = 50 + int(ri / total_slots * 40)   # 50~90%
        print(f"[progress:{pct}%]")

        source   = SOURCE_DIR / filename
        tts_path = tts_dir / f"scene_{slot['index']:02d}.mp3"
        rendered = rendered_dir / f"scene_{slot['index']:02d}.mp4"
        print(f"[tts/render] slot {slot['index']}: {script_scene['subtitle']}")

        # ── TTS 합성 + 길이 검증 (최대 5회 재시도, 트림 없음) ─────────
        clip_dur       = slot["clip_duration"]
        tts_limit      = clip_dur - TTS_GAP_HARD   # 클립보다 최소 0.7s 짧아야 함
        MAX_TTS_RETRIES = 5

        for tts_try in range(MAX_TTS_RETRIES):
            print(
                f"[tts] 씬{slot['index']} [{tts_try+1}/{MAX_TTS_RETRIES}] "
                f"voice={TTS_VOICE} engine={args.tts}: {script_scene['narration'][:30]}…"
            )
            # 네트워크 오류 대비 1회 재시도
            for net_try in range(2):
                try:
                    synthesize_tts(
                        script_scene["narration"], tts_path,
                        api_key=api_key, engine=args.tts,
                        voice=TTS_VOICE,
                    )
                    cost_tracker.add_tts(slot["index"], TTS_MODEL, len(script_scene["narration"]))
                    break
                except Exception as exc:
                    if net_try == 0:
                        print(f"[warn] TTS 재시도 (1회): {exc}")
                    else:
                        raise RuntimeError(f"TTS 실패 (slot {slot['index']}): {exc}") from exc

            tts_duration = probe_duration(tools["ffprobe"], tts_path)

            # 길이 통과 → 루프 종료
            if tts_duration <= tts_limit:
                if tts_try > 0:
                    print(
                        f"[tts] 씬{slot['index']} {tts_try+1}회 만에 통과 "
                        f"→ {tts_duration:.2f}s ≤ 한도 {tts_limit:.2f}s"
                    )
                break

            print(
                f"[warn] 씬{slot['index']} [{tts_try+1}/{MAX_TTS_RETRIES}] "
                f"TTS {tts_duration:.2f}s > 한도 {tts_limit:.2f}s (클립 {clip_dur:.2f}s)"
            )

            # 마지막 시도에서도 초과 → 트림 없이 그냥 사용
            if tts_try == MAX_TTS_RETRIES - 1:
                print(
                    f"[warn] 씬{slot['index']} {MAX_TTS_RETRIES}회 시도 후도 초과 "
                    f"→ 트림 없이 그대로 사용 ({tts_duration:.2f}s)"
                )
                break

            # 실측 발화속도 기반 목표 글자수 계산 → LLM 재단축
            orig_text    = script_scene["narration"]
            actual_cps   = len(orig_text) / tts_duration
            target_chars = max(6, int(tts_limit * actual_cps * 0.90))  # 10% 추가 여유
            print(
                f"[tts] 씬{slot['index']} 실측 {actual_cps:.2f}자/s → "
                f"목표 {target_chars}자로 LLM 재단축 → 시도 {tts_try+2}/{MAX_TTS_RETRIES}"
            )

            shortened, _shorten_usage = _shorten_with_llm(
                api_key, orig_text, target_chars,
                slot["slot_type"], args.style,
            )
            cost_tracker.add_chat("LLM_shorten", slot["index"], SCRIPT_MODEL, _shorten_usage)

            if shortened:
                print(f"[tts] 씬{slot['index']} 재단축 완료({len(shortened)}자): {shortened}")
                tts_path.unlink()
                script_scene["narration"] = shortened
                script_scene["subtitle"]  = shortened
            else:
                print(f"[warn] 씬{slot['index']} LLM 재단축 실패 → 재시도 중단")
                break

        # ── 3단계: duration = TTS 길이 기준, 영상은 루프로 커버 ─────
        # TTS 종료 후 1.0s 여유. clip_dur 캡 제거 →
        # TTS가 클립보다 길어도 -stream_loop -1 이 영상을 자동 반복해
        # 오디오가 잘리지 않고 완전히 재생됨.
        duration = tts_duration + TTS_GAP_TARGET

        render_scene_shorts_reference(
            tools["ffmpeg"], source, tts_path, script_scene,
            rendered, duration, args.headline,
            subtitle_y_pct=args.subtitle_y,
        )
        rendered_paths.append(rendered)

    # ── Phase 4: concat + BGM + 인트로 ───────────────────────────
    print("[progress:92%]")
    concat_output = output_dir / f"{OUTPUT_SLUG}_concat.mp4"
    concat_videos(tools["ffmpeg"], rendered_paths, concat_output)
    total_duration = probe_duration(tools["ffprobe"], concat_output)
    final_output   = output_dir / FINAL_FILENAME
    print("[progress:95%]")
    mix_bgm(tools["ffmpeg"], concat_output, bgm_path, final_output, total_duration)

    if args.aggro_intro:
        intro_path = Path(args.aggro_intro)
        if intro_path.exists():
            faded = output_dir / f"{OUTPUT_SLUG}_faded.mp4"
            run_command([
                str(tools["ffmpeg"]), "-y", "-i", str(final_output),
                "-vf", "fade=in:st=0:d=0.2:color=white",
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-c:a", "copy", str(faded),
            ])
            final_output.unlink()
            faded.rename(final_output)
            with_intro = output_dir / f"{OUTPUT_SLUG}_with_intro.mp4"
            _prepend_intro(tools["ffmpeg"], intro_path, final_output, with_intro)
            final_output.unlink()
            with_intro.rename(final_output)
            print(f"[intro] 어그로 인트로 삽입 완료: {intro_path.name}")
        else:
            print(f"[warn] 인트로 파일 없음: {args.aggro_intro}")

    poster = output_dir / "poster.jpg"
    run_command([
        str(tools["ffmpeg"]), "-y", "-i", str(final_output),
        "-ss", "00:00:03.0", "-update", "1", "-frames:v", "1", str(poster),
    ])

    script_payload = {
        "concept":      "style3 전체 맥락 LLM 대본",
        "scenes":       script_scenes,
        "cta":          "",
        "llm_success":  llm_lines is not None,
        "script_model": SCRIPT_MODEL,
    }
    manifest = {
        "style": 3,
        "tone_style": args.style,
        "store_info": store_info,
        "slots": [s["label"] for s in slots],
        "models": {"vision": VISION_MODEL, "script": SCRIPT_LABEL, "tts": TTS_MODEL},
        "tts":      {"engine": args.tts, "voice": TTS_VOICE, "model": TTS_MODEL, "speed": TTS_SPEED},
        "subtitle": {"style": SUBTITLE_STYLE, "font_size": SUBTITLE_FONT_SIZE, "color": SUBTITLE_COLOR},
        "bgm":          str(bgm_path),
        "duration":     total_duration,
        "final_output": str(final_output),
        "poster":       str(poster),
        "thumbnail":    str(thumbnail_path) if thumbnail_path else None,
        "vision":       vision_rows,
        "script":       script_payload,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    clip_scores = {d["index"]: d.get("clip_score") for d in scene_details}
    write_summary_csv(output_dir / "scene_summary.csv", vision_rows, script_payload, SCRIPT_LABEL,
                      clip_scores=clip_scores)

    # 피드백 리포트 저장
    write_scene_report(
        output_dir   = output_dir,
        run_id       = args.run_id,
        store_info   = store_info,
        tone_style   = args.style,
        llm_success  = llm_lines is not None,
        scene_details= scene_details,
    )

    # ── 비용 리포트 저장 ──────────────────────────────────────────
    cost_tracker.save(output_dir)

    print("[progress:100%]")
    print(f"[done] {final_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
