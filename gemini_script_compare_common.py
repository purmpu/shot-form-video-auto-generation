from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

from inspect_vision_models import (
    ROOT,
    encode_media_data_url,
    extract_frame,
    find_ffmpeg_tools,
    get_message_text,
    load_api_key,
    parse_json_maybe,
)
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TTS_URLS = [
    "https://openrouter.ai/api/v1/audio/speech",
    "https://openrouter.ai/api/v1/tts",
]


SOURCE_DIR = Path(os.environ.get(
    "SOURCE_DIR",
    str(ROOT / "abc" / "마라탕매장 영상 원본_260304"),
))
FONT      = Path(r"C:\Windows\Fonts\malgun.ttf")
BOLD_FONT = Path(r"C:\Windows\Fonts\malgunbd.ttf")
BGM_PATH  = ROOT / "bgm" / "nastelbom-no-copyright-music-490159.mp3"

_VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm"}

VISION_MODEL = "google/gemini-2.5-flash"

# ── TTS 설정 (환경변수로 오버라이드 가능) ──────────────────────────────────
# TTS_ENGINE : xai | openrouter | edge | piper
TTS_ENGINE  = os.environ.get("TTS_ENGINE",      "xai")
TTS_MODEL   = os.environ.get("TTS_MODEL",       "x-ai/grok-voice-tts-1.0")
TTS_VOICE   = os.environ.get("TTS_VOICE",       "eve")
TTS_SPEED   = float(os.environ.get("TTS_SPEED", "1.0"))
# edge TTS 세부 설정
EDGE_VOICE  = os.environ.get("TTS_EDGE_VOICE",  "ko-KR-SunHiNeural")
EDGE_RATE   = os.environ.get("TTS_EDGE_RATE",   "+12%")
EDGE_PITCH  = os.environ.get("TTS_EDGE_PITCH",  "+20Hz")
EDGE_VOLUME = os.environ.get("TTS_EDGE_VOLUME", "+0%")
# piper TTS: .onnx 모델 파일 경로
PIPER_MODEL = os.environ.get("PIPER_MODEL", "")
# 하위 호환 별칭
OPENROUTER_TTS_MODEL = TTS_MODEL
OPENROUTER_TTS_VOICE = TTS_VOICE

# ── 자막 스타일 설정 (환경변수로 오버라이드 가능) ──────────────────────────
# SUBTITLE_STYLE : box(반투명 박스) | bold(굵은 외곽선) | highlight(형광 박스)
SUBTITLE_STYLE         = os.environ.get("SUBTITLE_STYLE",         "box")
SUBTITLE_FONT_SIZE     = int(os.environ.get("SUBTITLE_FONT_SIZE", "46"))
HEADLINE_FONT_SIZE     = int(os.environ.get("HEADLINE_FONT_SIZE", "92"))
SUBTITLE_COLOR         = os.environ.get("SUBTITLE_COLOR",         "white")
SUBTITLE_BOX_ALPHA     = os.environ.get("SUBTITLE_BOX_ALPHA",     "1")
SUBTITLE_BOX_COLOR     = os.environ.get("SUBTITLE_BOX_COLOR",     "black")
SUBTITLE_BORDER_WIDTH  = int(os.environ.get("SUBTITLE_BORDER_WIDTH", "3"))
# 커스텀 폰트: TTF/OTF 파일 경로 (비어 있으면 malgunbd.ttf 사용)
SUBTITLE_FONT_OVERRIDE = os.environ.get("SUBTITLE_FONT", "")


@dataclass(frozen=True)
class SourceScene:
    index: int
    file: str
    reference: str
    frame_at: float = 1.0
    duration: float = 4.0
    user_note: str = ""


SCENES = [
    SourceScene(1, "S01_천라쿵푸왕십리_매장로고.MOV", "천라쿵푸 마라탕 왕십리점 매장 로고"),
    SourceScene(2, "S03_천라쿵푸왕십리_재료(와이드).MOV", "마라탕 신선하고 다양한 재료들 진열"),
    SourceScene(3, "H01_천라쿵푸왕십리_신선한재료.MOV", "마라탕 신선하고 다양한 재료들", frame_at=1.4),
    SourceScene(4, "C01_천라쿵푸왕십리_끓는마라탕.MOV", "보글보글 끓는 마라탕", frame_at=1.2),
    SourceScene(5, "C03_천라쿵푸왕십리_담는마라탕(1).MOV", "완성된 마라탕을 그릇에 담는 장면"),
    SourceScene(6, "C04_천라쿵푸왕십리_완성된마라탕.MOV", "완성된 마라탕 한 그릇"),
    SourceScene(7, "M05_천라쿵푸경희대_들어올리는꿔바로우.MOV", "젓가락으로 들어 올린 꿔바로우"),
    SourceScene(8, "P01_천라쿵푸왕십리_포장.MOV", "마라샹궈 포장"),
    SourceScene(9, "S09_천라쿵푸경희대_매장전경.MOV", "천라쿵푸 마라탕 가게 외관"),
]


def get_scenes() -> list[SourceScene]:
    """실제 사용할 장면 목록 반환.

    SOURCE_DIR 환경변수가 기본 경로와 다를 때(업로드 디렉터리 등)
    해당 폴더 안의 비디오 파일을 이름 순으로 정렬해 동적으로 생성한다.
    기본 경로이면 하드코딩된 SCENES를 그대로 반환한다.
    SCENE_NOTES 환경변수(JSON 배열)가 있으면 각 장면에 user_note를 주입한다.
    """
    # SCENE_NOTES: JSON 배열 ["노트1", "노트2", ...] 형태
    raw_notes = os.environ.get("SCENE_NOTES", "")
    notes: list[str] = []
    if raw_notes:
        try:
            notes = json.loads(raw_notes)
        except Exception:
            pass

    def _note(i: int) -> str:
        return notes[i - 1] if i - 1 < len(notes) else ""

    default_src = ROOT / "abc" / "마라탕매장 영상 원본_260304"
    if SOURCE_DIR.resolve() == default_src.resolve():
        return [
            SourceScene(s.index, s.file, s.reference, s.frame_at, s.duration, _note(s.index))
            for s in SCENES
        ]
    # 업로드 디렉터리: 비디오 파일을 이름 순으로 정렬 → scene 번호 부여
    files = sorted(
        f for f in SOURCE_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in _VIDEO_EXTS
    )
    return [
        SourceScene(index=i, file=f.name, reference=f.stem, user_note=_note(i))
        for i, f in enumerate(files, 1)
    ]


def run_command(command: list[str]) -> None:
    completed = subprocess.run(command, capture_output=True, check=False)
    if completed.returncode != 0:
        stderr = completed.stderr.decode("utf-8", errors="ignore").strip()
        stdout = completed.stdout.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(stderr or stdout or "subprocess failed")


def http_json(payload: dict, api_key: str, timeout: int = 180) -> dict:
    request = urllib.request.Request(
        OPENROUTER_CHAT_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/local-capstone",
            "X-Title": "ShortsMong Gemini Script Comparison",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def openrouter_chat(
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 1000,
    temperature: float = 0.25,
) -> dict:
    return http_json(
        {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        },
        api_key,
    )


def vision_prompt() -> str:
    return """이미지/프레임만 보고 숏폼 음식점 홍보 영상 제작에 필요한 Vision 인식 결과를 JSON으로만 출력하라.

출력 JSON:
{
  "scene_summary": "이미지 전체 장면 설명",
  "detected_food_or_menu": ["추정 음식/메뉴"],
  "detected_objects": ["보이는 사물/공간 요소"],
  "keywords": ["핵심 키워드 8개"],
  "caption_candidate": "짧은 한국어 자막 후보",
  "visual_mood": "영상 분위기"
}

규칙:
- JSON 외 텍스트는 쓰지 마라.
- 파일명이나 사용자 설명을 모른다고 가정하고 이미지 자체만 판단하라.
- 확실하지 않은 메뉴는 추정이라고 표현하라."""


def analyze_frame(api_key: str, frame_path: Path) -> tuple[dict, str, dict]:
    """VLM 프레임 분석.

    Returns:
        (parsed_dict, raw_text, usage_dict)
        usage_dict: {"prompt_tokens": N, "completion_tokens": N, "total_tokens": N}
    """
    response = openrouter_chat(
        api_key,
        VISION_MODEL,
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": vision_prompt()},
                    {"type": "image_url", "image_url": {"url": encode_media_data_url(frame_path)}},
                ],
            }
        ],
        max_tokens=900,
    )
    usage = response.get("usage") or {}
    raw = get_message_text(response)
    parsed, ok = parse_json_maybe(raw)
    if not ok or not isinstance(parsed, dict):
        raise RuntimeError(f"Gemini Vision JSON parse failed: {raw[:300]}")
    return parsed, raw, usage


def script_prompt(
    vision_items: list[dict],
    script_label: str,
    tone_profile: str | None = None,
    sync_caption_narration: bool = False,
) -> str:
    tone_section = ""
    if tone_profile:
        tone_section = f"""
톤/편집 방향:
{tone_profile}
"""
    sync_section = ""
    if sync_caption_narration:
        sync_section = """
자막/TTS 동기화:
- subtitle과 narration은 반드시 완전히 동일한 문장으로 작성한다.
- 한 문장이 화면 자막으로도 읽히고 TTS로도 자연스럽게 들리도록 15~18자 내외로 작성한다.
- subtitle에만 있는 말, narration에만 있는 말이 생기지 않게 한다.
"""
    # user_note 요약 (노트가 있는 장면만 별도 강조)
    note_lines = [
        f"  장면 {item['scene']}: {item['user_note']}"
        for item in vision_items
        if item.get("user_note", "").strip()
    ]
    note_section = ""
    if note_lines:
        note_section = (
            "\n※ 최우선 지시 — 아래 장면별 메모를 반드시 해당 장면의 subtitle·narration에 직접 반영하라."
            " Vision 분석 결과보다 이 메모를 우선한다:\n"
            + "\n".join(note_lines) + "\n"
        )

    return f"""아래는 Gemini Vision 모델이 원본 음식점 영상 프레임을 분석한 결과다.
이 순서 그대로 36초 내외 한국어 숏폼 홍보 영상을 만들 수 있도록 {script_label} 모델이 장면별 대본을 작성하라.
{note_section}
입력 Vision 결과:
{json.dumps(vision_items, ensure_ascii=False, indent=2)}
{tone_section}
{sync_section}

목표:
- 천라쿵푸 마라탕 매장 홍보 영상
- 원본 클립 순서를 유지한다.
- 자막과 나레이션은 밝고 트렌디한 음식 쇼츠 광고 톤으로 작성한다.
- 나레이션은 Edge TTS로 4초 안에 읽을 수 있도록 18자 내외의 짧은 한국어 문장으로 작성한다.
- 맞춤법 주의: '끓이기', '젓가락', '꿔바로우'처럼 올바르게 쓴다.
- 확인되지 않은 표현은 쓰지 않는다. 예: 누수 없음, 위생 확실 등은 직접 보이지 않으면 금지.

출력 JSON:
{{
  "concept": "전체 영상 콘셉트",
  "scenes": [
    {{
      "scene": 1,
      "title": "상단 제목 10자 이내",
      "subtitle": "하단 자막 18자 이내",
      "narration": "TTS 나레이션 18자 이내",
      "duration_sec": 4
    }}
  ],
  "cta": "마지막 방문 유도 문구"
}}

규칙:
- scenes 개수는 입력된 Vision 결과 장면 수와 반드시 동일하게 작성한다.
- scene 번호는 1부터 시작한다.
- JSON 외 텍스트는 출력하지 마라."""


def generate_script(
    api_key: str,
    vision_items: list[dict],
    script_model: str,
    script_label: str,
    tone_profile: str | None = None,
    sync_caption_narration: bool = False,
) -> tuple[dict, str]:
    response = openrouter_chat(
        api_key,
        script_model,
        [{"role": "user", "content": script_prompt(vision_items, script_label, tone_profile, sync_caption_narration)}],
        max_tokens=4096,
    )
    raw = get_message_text(response)
    parsed, ok = parse_json_maybe(raw)
    if not ok or not isinstance(parsed, dict) or not isinstance(parsed.get("scenes"), list):
        raise RuntimeError(f"{script_label} script JSON parse failed: {raw[:500]}")
    return parsed, raw


def fallback_text(value: object, fallback: str) -> str:
    text = str(value or "").strip()
    return text if text else fallback


def clean_scene_payload(payload: dict, sync_caption_narration: bool = False) -> dict:
    cleaned = {"concept": payload.get("concept", "천라쿵푸 숏폼 홍보"), "scenes": [], "cta": payload.get("cta", "")}
    for index, item in enumerate(payload["scenes"], start=1):
        title = fallback_text(item.get("title"), f"장면 {index}")[:18]
        subtitle = fallback_text(item.get("subtitle"), title)[:28]
        narration = fallback_text(item.get("narration"), subtitle)[:34]
        if sync_caption_narration:
            subtitle = fallback_text(item.get("subtitle") or item.get("narration"), title)[:28]
            narration = subtitle
        cleaned["scenes"].append(
            {
                "scene": index,
                "title": title,
                "subtitle": subtitle,
                "narration": narration,
                "duration_sec": float(item.get("duration_sec") or 4.0),
            }
        )
    return cleaned


def edge_tts(text: str, destination: Path) -> None:
    edge_python = ROOT / ".venv" / "Scripts" / "python.exe"
    python_exe = str(edge_python if edge_python.exists() else Path("python"))
    run_command(
        [
            python_exe,
            "-m",
            "edge_tts",
            "--voice",
            EDGE_VOICE,
            "--text",
            text,
            "--rate",
            EDGE_RATE,
            "--pitch",
            EDGE_PITCH,
            "--volume",
            EDGE_VOLUME,
            "--write-media",
            str(destination),
        ]
    )


XAI_TTS_URL = "https://api.x.ai/v1/tts"


def load_xai_api_key() -> str:
    env_file = ROOT / ".env.openrouter"
    key = os.environ.get("XAI_API_KEY", "") or os.environ.get("OPENROUTER_API_KEY", "")
    key = key.strip()
    if not key and env_file.exists():
        found = {}
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            found[name.strip()] = value.strip().strip('"').strip("'")
        key = found.get("XAI_API_KEY") or found.get("OPENROUTER_API_KEY") or ""
    if not key:
        raise RuntimeError(".env.openrouter 에 XAI_API_KEY 또는 OPENROUTER_API_KEY 를 입력해주세요.")
    return key


def xai_tts(api_key: str, text: str, destination: Path, voice_id: str = "eve") -> None:
    payload = {"text": text, "voice_id": voice_id, "language": "ko"}
    request = urllib.request.Request(
        XAI_TTS_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as resp:
            destination.write_bytes(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"xAI TTS failed: HTTP {exc.code}: {body}") from exc


def openrouter_tts(api_key: str, text: str, destination: Path, model: str, voice: str, speed: float = 1.0) -> None:
    """OpenRouter TTS 호출.

    엔드포인트를 하나로 고정하고 최대 3회 재시도한다.
    /audio/speech 폴백은 제거: Grok voice 파라미터(rex/eve 등)를
    인식하지 못해 기본 여성 목소리로 응답하는 문제가 있었음.
    단일 엔드포인트 재시도 방식으로 목소리 일관성 보장.
    """
    import time

    # OpenRouter 네이티브 /tts 엔드포인트만 사용
    # (Grok voice 파라미터를 올바르게 전달하는 유일한 경로)
    url = "https://openrouter.ai/api/v1/tts"

    # voice  : OpenAI 포맷 / OpenRouter 호환
    # voice_id: xAI 네이티브 파라미터 → OpenRouter가 번역 실패 시에도 xAI 백엔드에 직접 전달됨
    # language: 한국어 명시 → 목소리 특성 고정에 도움
    # seed    : 가능한 경우 생성 고정 (미지원 API는 무시됨)
    payload = {
        "model":           model,
        "voice":           voice,
        "voice_id":        voice,   # xAI 네이티브 파라미터 병행
        "input":           text,
        "text":            text,    # 네이티브 엔드포인트 호환 키 병행
        "language":        "ko",    # 한국어 명시
        "response_format": "mp3",
        "speed":           speed,
        "seed":            42,      # 생성 고정 시도 (미지원 시 무시)
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://github.com/local-capstone",
        "X-Title":       "ShortsMong TTS",
    }

    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                method="POST",
                headers=headers,
            )
            with urllib.request.urlopen(req, timeout=180) as response:
                data = response.read()

            # 기본 유효성 검사: MP3는 최소 수 KB 이상이어야 함
            if len(data) < 2048:
                raise RuntimeError(
                    f"응답 크기가 너무 작음 ({len(data)} bytes) — 잘못된 응답일 가능성"
                )

            destination.write_bytes(data)
            print(f"[tts] ✅ voice={voice} model={model} ({len(text)}자, {len(data)//1024}KB)")
            return

        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"[tts] ⚠ 시도{attempt+1}/{max_attempts} HTTP {exc.code}: {body[:120]}")
            if attempt < max_attempts - 1:
                wait = 2 ** attempt   # 1s → 2s → 4s 지수 백오프
                print(f"[tts] {wait}초 후 재시도...")
                time.sleep(wait)
            else:
                raise RuntimeError(f"OpenRouter TTS HTTP {exc.code}: {body[:200]}")

        except Exception as exc:
            print(f"[tts] ⚠ 시도{attempt+1}/{max_attempts} 오류: {exc}")
            if attempt < max_attempts - 1:
                wait = 2 ** attempt
                print(f"[tts] {wait}초 후 재시도...")
                time.sleep(wait)
            else:
                raise


def piper_tts(text: str, destination: Path) -> None:
    """로컬 Piper TTS. PIPER_MODEL 환경변수에 .onnx 모델 경로를 설정해야 한다."""
    if not PIPER_MODEL:
        raise RuntimeError(
            "PIPER_MODEL 환경변수에 piper .onnx 모델 파일 경로를 설정하세요.\n"
            "예) $env:PIPER_MODEL=\"C:\\models\\ko_KR-kss-medium.onnx\""
        )
    python_exe = ROOT / ".venv" / "Scripts" / "python.exe"
    python_str = str(python_exe if python_exe.exists() else Path("python"))
    process = subprocess.run(
        [python_str, "-m", "piper", "--model", PIPER_MODEL, "--output_file", str(destination)],
        input=text.encode("utf-8"),
        capture_output=True,
        check=False,
    )
    if process.returncode != 0:
        stderr = process.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(f"piper TTS 실패: {stderr}")


def synthesize_tts(
    text: str,
    destination: Path,
    *,
    api_key: str = "",
    engine: str | None = None,
    voice: str | None = None,
    model: str | None = None,
    speed: float | None = None,
) -> None:
    """TTS 통합 디스패처.

    엔진 선택 우선순위: 함수 인자 > TTS_ENGINE 환경변수 (기본: openrouter)
    목소리 선택 우선순위: 함수 인자 > TTS_VOICE 환경변수

    지원 엔진:
        openrouter  - OpenRouter API (Grok TTS 등 유료 모델)
        edge        - MS Edge TTS / Azure Neural TTS (무료, 한국어 특화)
        piper       - 로컬 Piper TTS (완전 오프라인, PIPER_MODEL 경로 필요)
    """
    _engine = engine if engine is not None else TTS_ENGINE
    _voice  = voice  if voice  is not None else TTS_VOICE
    _model  = model  if model  is not None else TTS_MODEL
    _speed  = speed  if speed  is not None else TTS_SPEED

    if _engine in ("xai", "openrouter"):
        openrouter_tts(api_key, text, destination, _model, _voice, _speed)
    elif _engine == "edge":
        edge_tts(text, destination)
    elif _engine == "piper":
        piper_tts(text, destination)
    else:
        raise ValueError(
            f"지원하지 않는 TTS 엔진: {_engine!r}\n"
            "TTS_ENGINE 환경변수를 openrouter | edge | piper 중 하나로 설정하세요."
        )


def probe_duration(ffprobe: Path, media_path: Path) -> float:
    completed = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(media_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {media_path}")
    return float(completed.stdout.strip())


def escape_drawtext(value: str) -> str:
    text = value.replace("\\", r"\\")
    text = text.replace(":", r"\:")
    # ffmpeg filter_complex 파서는 단일따옴표로 감싼 값 안에서 \'를 올바르게
    # 처리하지 못해 파서가 ']', ';' 뒤 내용을 옵션명으로 잘못 해석한다.
    # 시각적으로 동일한 U+2019(오른쪽 작은따옴표)로 교체해 충돌을 원천 차단.
    text = text.replace("'", "’")   # ' → '
    text = text.replace("%", r"\%")
    text = text.replace("\n", " ")
    return text


def text_units(value: str) -> int:
    units = 0
    for char in value:
        units += 2 if ord(char) > 127 else 1
    return units


def wrap_text_for_drawtext(value: str, max_units: int = 34, max_lines: int = 2) -> list[str]:
    text = re.sub(r"\s+", " ", value.strip())
    if not text:
        return [""]
    words = text.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if text_units(candidate) <= max_units:
            current = candidate
            continue
        if current:
            lines.append(current)
            current = word
        else:
            lines.append(word)
            current = ""
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    return lines or [text[:max_units]]


def font_path() -> str:
    return str(FONT).replace("\\", "/").replace(":", r"\:")


def bold_font_path() -> str:
    font = BOLD_FONT if BOLD_FONT.exists() else FONT
    return str(font).replace("\\", "/").replace(":", r"\:")


def subtitle_font_path() -> str:
    """자막용 폰트 경로. SUBTITLE_FONT 환경변수로 커스텀 TTF/OTF 지정 가능."""
    if SUBTITLE_FONT_OVERRIDE:
        custom = Path(SUBTITLE_FONT_OVERRIDE)
        if custom.exists():
            return str(custom).replace("\\", "/").replace(":", r"\:")
    return bold_font_path()


def build_subtitle_drawtext(lines: list[str], y_first: int, line_height: int = 52) -> str:
    """SUBTITLE_STYLE에 따라 자막 drawtext 필터 문자열을 생성한다.

    스타일:
        box       - 검정 반투명 박스 위 흰 텍스트 (기본, drawbox는 호출부에서 별도 추가)
        bold      - 굵은 검정 외곽선, 박스 없음
        highlight - 노란 반투명 박스 위 검정 텍스트 (drawbox는 호출부에서 별도 추가)
    """
    fpath  = subtitle_font_path()
    fsize  = SUBTITLE_FONT_SIZE
    result = ""
    for i, line in enumerate(lines):
        text = escape_drawtext(line)
        y    = y_first + i * line_height
        base = f"drawtext=fontfile='{fpath}':text='{text}':fontsize={fsize}:x=(w-text_w)/2:y={y}"
        if SUBTITLE_STYLE == "bold":
            result += f"{base}:fontcolor={SUBTITLE_COLOR}:borderw={SUBTITLE_BORDER_WIDTH}:bordercolor=black,"
        elif SUBTITLE_STYLE == "highlight":
            result += f"{base}:fontcolor=black:borderw=1:bordercolor=black@0.3,"
        else:  # box (기본)
            result += f"{base}:fontcolor={SUBTITLE_COLOR}:borderw=2:bordercolor=black,"
    return result


def render_scene(ffmpeg: Path, source: Path, tts_path: Path, scene: dict, destination: Path, duration: float) -> None:
    title = escape_drawtext(scene["title"])
    subtitle = escape_drawtext(scene["subtitle"])
    fade_start = max(0.0, duration - 0.25)
    vf = (
        "[0:v]trim=start=0,setpts=PTS-STARTPTS,split=2[vbg][vfg];"
        "[vbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:12[bg];"
        "[vfg]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,"
        "eq=saturation=1.12:contrast=1.05:brightness=0.015,"
        "drawbox=x=52:y=1388:w=976:h=330:color=black@0.36:t=fill,"
        f"drawtext=fontfile='{font_path()}':text='{title}':fontcolor=white:fontsize=62:x=82:y=1445,"
        f"drawtext=fontfile='{font_path()}':text='{subtitle}':fontcolor=white:fontsize=76:x=82:y=1540,"
        f"fade=t=in:st=0:d=0.18,fade=t=out:st={fade_start:.2f}:d=0.22[v]"
    )
    run_command(
        [
            str(ffmpeg),
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(source),
            "-i",
            str(tts_path),
            "-t",
            f"{duration:.3f}",
            "-filter_complex",
            f"{vf};[1:a]apad,atrim=0:{duration:.3f},asetpts=PTS-STARTPTS[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(destination),
        ]
    )


def render_scene_shorts_reference(
    ffmpeg: Path,
    source: Path,
    tts_path: Path,
    scene: dict,
    destination: Path,
    duration: float,
    headline: str = "",
    subtitle_y_pct: int = -1,
) -> None:
    headline_text = headline or str(scene["title"])
    headline_lines = [line.strip() for line in headline_text.replace("\\n", "\n").splitlines() if line.strip()]
    if not headline_lines:
        headline_lines = [str(scene["title"])]
    headline_lines = headline_lines[:2]
    subtitle_lines = wrap_text_for_drawtext(str(scene["subtitle"]), max_units=34, max_lines=2)
    subtitle_line_units = [text_units(line) for line in subtitle_lines]
    subtitle_box_width = min(1000, max(360, max(subtitle_line_units, default=0) * 25 + 72))
    subtitle_box_x = int((1080 - subtitle_box_width) / 2)
    subtitle_box_height = 94 if len(subtitle_lines) == 1 else 148
    if subtitle_y_pct >= 0:
        subtitle_first_y = int(1920 * subtitle_y_pct / 100)
        box_offset = 19 if len(subtitle_lines) == 1 else 20
        subtitle_box_y = max(0, subtitle_first_y - box_offset)
    else:
        subtitle_box_y = 1502 if len(subtitle_lines) == 1 else 1474
        subtitle_first_y = 1521 if len(subtitle_lines) == 1 else 1494

    # 헤드라인 폰트 크기: HEADLINE_FONT_SIZE (1줄) / HEADLINE_FONT_SIZE-8 (2줄)
    hl_size1 = HEADLINE_FONT_SIZE
    hl_size2 = max(48, HEADLINE_FONT_SIZE - 8)
    hl_font  = subtitle_font_path()
    if len(headline_lines) == 1:
        title_filters = (
            f"drawtext=fontfile='{hl_font}':text='{escape_drawtext(headline_lines[0])}':"
            f"fontcolor=white:fontsize={hl_size1}:borderw=4:bordercolor=black:x=(w-text_w)/2:y=155,"
        )
    else:
        title_filters = (
            f"drawtext=fontfile='{hl_font}':text='{escape_drawtext(headline_lines[0])}':"
            f"fontcolor=white:fontsize={hl_size2}:borderw=4:bordercolor=black:x=(w-text_w)/2:y=105,"
            f"drawtext=fontfile='{hl_font}':text='{escape_drawtext(headline_lines[1])}':"
            f"fontcolor=white:fontsize={hl_size2}:borderw=4:bordercolor=black:x=(w-text_w)/2:y=205,"
        )

    # 자막 박스: box / highlight 스타일에만 drawbox 추가
    if SUBTITLE_STYLE == "highlight":
        subtitle_box_filter = (
            f"drawbox=x={subtitle_box_x}:y={subtitle_box_y}:w={subtitle_box_width}"
            f":h={subtitle_box_height}:color=yellow@{SUBTITLE_BOX_ALPHA}:t=fill,"
        )
    elif SUBTITLE_STYLE == "box":
        subtitle_box_filter = (
            f"drawbox=x={subtitle_box_x}:y={subtitle_box_y}:w={subtitle_box_width}"
            f":h={subtitle_box_height}:color={SUBTITLE_BOX_COLOR}@{SUBTITLE_BOX_ALPHA}:t=fill,"
        )
    else:  # bold: 박스 없음
        subtitle_box_filter = ""

    vf = (
        f"color=c=black:s=1080x1920:d={duration:.3f}[canvas];"
        "[0:v]trim=start=0,setpts=PTS-STARTPTS,"
        "scale=1080:1280:force_original_aspect_ratio=increase,"
        "crop=1080:1280[clip];"
        "[canvas][clip]overlay=0:320,"
        "eq=saturation=1.1:contrast=1.04:brightness=0.01,"
        f"{title_filters}"
        f"{subtitle_box_filter}"
    )
    vf += build_subtitle_drawtext(subtitle_lines, subtitle_first_y)
    vf += "fade=t=in:st=0:d=0.12[v]"
    run_command(
        [
            str(ffmpeg),
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(source),
            "-i",
            str(tts_path),
            "-t",
            f"{duration:.3f}",
            "-filter_complex",
            f"{vf};[1:a]apad,atrim=0:{duration:.3f},asetpts=PTS-STARTPTS[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(destination),
        ]
    )


def concat_videos(ffmpeg: Path, paths: list[Path], destination: Path) -> None:
    command = [str(ffmpeg), "-y"]
    for path in paths:
        command.extend(["-i", str(path)])
    parts = []
    concat_inputs = []
    for index in range(len(paths)):
        parts.append(f"[{index}:v]setpts=PTS-STARTPTS[v{index}]")
        parts.append(f"[{index}:a]asetpts=PTS-STARTPTS[a{index}]")
        concat_inputs.append(f"[v{index}][a{index}]")
    parts.append(f"{''.join(concat_inputs)}concat=n={len(paths)}:v=1:a=1[v][a]")
    command.extend(
        [
            "-filter_complex",
            ";".join(parts),
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(destination),
        ]
    )
    run_command(command)


def mix_bgm(ffmpeg: Path, source_video: Path, bgm_path: Path, destination: Path, duration: float) -> None:
    bgm_volume = float(os.environ.get("BGM_VOLUME", "0.09"))
    narration_volume = float(os.environ.get("NARRATION_VOLUME", "1.55"))
    run_command(
        [
            str(ffmpeg),
            "-y",
            "-i",
            str(source_video),
            "-stream_loop",
            "-1",
            "-i",
            str(bgm_path),
            "-filter_complex",
            (
                f"[1:a]atrim=start=0:end={duration:.3f},asetpts=PTS-STARTPTS,volume={bgm_volume}[bgm];"
                f"[0:a]volume={narration_volume}[nar];"
                "[nar][bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]"
            ),
            "-map",
            "0:v",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(destination),
        ]
    )


def write_summary_csv(
    path: Path,
    vision_rows: list[dict],
    script_payload: dict,
    script_label: str,
    clip_scores: dict[int, float | None] | None = None,
) -> None:
    """씬별 요약 CSV 저장.

    clip_scores: { scene_index: score } 딕셔너리 (없으면 컬럼 미포함).
    """
    fieldnames = [
        "scene",
        "source_file",
        "reference",
        "gemini_scene_summary",
        "gemini_menu",
        "script_model",
        "script_title",
        "script_subtitle",
        "script_narration",
    ]
    if clip_scores is not None:
        fieldnames.append("clip_score")

    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for vision, script in zip(vision_rows, script_payload["scenes"]):
            parsed = vision["parsed"]
            row = {
                "scene":               vision["scene"],
                "source_file":         vision["source_file"],
                "reference":           vision["reference"],
                "gemini_scene_summary":parsed.get("scene_summary", ""),
                "gemini_menu":         ", ".join(str(item) for item in parsed.get("detected_food_or_menu", [])),
                "script_model":        script_label,
                "script_title":        script["title"],
                "script_subtitle":     script["subtitle"],
                "script_narration":    script["narration"],
            }
            if clip_scores is not None:
                row["clip_score"] = clip_scores.get(vision["scene"], "")
            writer.writerow(row)


def run_for_script_model(
    *,
    script_model: str,
    script_label: str,
    output_slug: str,
    final_filename: str,
    tone_profile: str | None = None,
    sync_caption_narration: bool = False,
    argv: list[str] | None = None,
) -> int:
    parser = argparse.ArgumentParser(description=f"Generate promo using Gemini Vision + {script_label} script.")
    parser.add_argument("--bgm", default=str(BGM_PATH), help="BGM audio path.")
    parser.add_argument(
        "--tts", choices=["xai", "openrouter", "edge", "piper"], default=TTS_ENGINE,
        help="TTS 엔진 선택 (env: TTS_ENGINE). xai | openrouter | edge | piper",
    )
    parser.add_argument("--sync-caption-narration", action="store_true", default=sync_caption_narration)
    args = parser.parse_args(argv)

    bgm_path = Path(args.bgm)
    if not bgm_path.is_absolute():
        bgm_path = ROOT / bgm_path
    if not bgm_path.exists():
        raise FileNotFoundError(bgm_path)
    if not FONT.exists():
        raise FileNotFoundError(FONT)

    api_key = load_api_key()
    tools = find_ffmpeg_tools()
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_dir = ROOT / "outputs" / output_slug / run_id
    frames_dir = output_dir / "frames"
    tts_dir = output_dir / "tts"
    rendered_dir = output_dir / "rendered"
    frames_dir.mkdir(parents=True, exist_ok=True)
    tts_dir.mkdir(parents=True, exist_ok=True)
    rendered_dir.mkdir(parents=True, exist_ok=True)

    vision_rows = []
    for scene in SCENES:
        source = SOURCE_DIR / scene.file
        if not source.exists():
            raise FileNotFoundError(source)
        frame = frames_dir / f"scene_{scene.index:02d}.jpg"
        print(f"[vision] scene {scene.index}: {scene.file}")
        extract_frame(tools["ffmpeg"], source, frame, scene.frame_at)
        parsed, raw, _ = analyze_frame(api_key, frame)
        vision_rows.append(
            {
                "scene": scene.index,
                "source_file": scene.file,
                "source": str(source),
                "reference": scene.reference,
                "user_note": scene.user_note,
                "frame": str(frame),
                "parsed": parsed,
                "raw_output": raw,
            }
        )

    print(f"[script] {script_label}")
    script_payload, script_raw = generate_script(
        api_key,
        vision_rows,
        script_model,
        script_label,
        tone_profile,
        args.sync_caption_narration,
    )
    script_payload = clean_scene_payload(script_payload, args.sync_caption_narration)

    rendered_paths = []
    for scene_source, script_scene in zip(SCENES, script_payload["scenes"]):
        source = SOURCE_DIR / scene_source.file
        tts_path = tts_dir / f"scene_{scene_source.index:02d}_{args.tts}_{TTS_VOICE}.mp3"
        rendered = rendered_dir / f"scene_{scene_source.index:02d}.mp4"
        print(f"[tts/render] scene {scene_source.index}: {script_scene['title']}")
        synthesize_tts(script_scene["narration"], tts_path, api_key=api_key, engine=args.tts)
        tts_duration = probe_duration(tools["ffprobe"], tts_path)
        duration = max(float(script_scene.get("duration_sec", 4.0)), min(5.2, tts_duration + 0.45))
        render_scene(tools["ffmpeg"], source, tts_path, script_scene, rendered, duration)
        rendered_paths.append(rendered)

    concat_output = output_dir / f"{output_slug}_concat.mp4"
    concat_videos(tools["ffmpeg"], rendered_paths, concat_output)
    total_duration = probe_duration(tools["ffprobe"], concat_output)
    final_output = output_dir / final_filename
    mix_bgm(tools["ffmpeg"], concat_output, bgm_path, final_output, total_duration)

    poster = output_dir / "poster.jpg"
    run_command(
        [
            str(tools["ffmpeg"]),
            "-y",
            "-i",
            str(final_output),
            "-ss",
            "00:00:09.0",
            "-update",
            "1",
            "-frames:v",
            "1",
            str(poster),
        ]
    )

    manifest = {
        "models": {"vision": VISION_MODEL, "script": script_model, "tts": TTS_MODEL if args.tts == "openrouter" else args.tts},
        "labels": {"script": script_label},
        "tone_profile": tone_profile,
        "sync_caption_narration": args.sync_caption_narration,
        "tts": {"engine": args.tts, "voice": TTS_VOICE, "model": TTS_MODEL, "speed": TTS_SPEED},
        "subtitle": {"style": SUBTITLE_STYLE, "font_size": SUBTITLE_FONT_SIZE, "color": SUBTITLE_COLOR},
        "bgm": str(bgm_path),
        "duration": total_duration,
        "final_output": str(final_output),
        "poster": str(poster),
        "vision": vision_rows,
        "script_raw_output": script_raw,
        "script": script_payload,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_summary_csv(output_dir / "scene_summary.csv", vision_rows, script_payload, script_label)

    print(f"[done] {final_output}")
    print(f"[done] {poster}")
    print(f"[done] {output_dir / 'scene_summary.csv'}")
    return 0
