from __future__ import annotations

import argparse
import base64
import csv
from datetime import datetime
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env.openrouter"
OUTPUT_ROOT = ROOT / "outputs" / "vision_model_inspection"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_MODELS = [
    ("google/gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite"),
    ("openai/gpt-4o-mini", "GPT-4o mini"),
    ("qwen/qwen2.5-vl-72b-instruct", "Qwen2.5 VL 72B"),
]

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}


def load_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if key:
        return key
    if ENV_PATH.exists():
        for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == "OPENROUTER_API_KEY":
                key = value.strip().strip('"').strip("'")
                break
    if not key or "YOUR_OPENROUTER_API_KEY_HERE" in key or "여기에" in key:
        raise RuntimeError(f"{ENV_PATH} 파일에 OPENROUTER_API_KEY를 입력해주세요.")
    return key


def find_ffmpeg_tools() -> dict[str, Path]:
    candidates = [ROOT / "abc" / "ffmpeg" / "bin", ROOT / "ffmpeg" / "bin"]
    for folder in candidates:
        ffmpeg = folder / "ffmpeg.exe"
        ffprobe = folder / "ffprobe.exe"
        if ffmpeg.exists() and ffprobe.exists():
            return {"ffmpeg": ffmpeg, "ffprobe": ffprobe}
    return {"ffmpeg": Path("ffmpeg"), "ffprobe": Path("ffprobe")}


def run_command(command: list[str]) -> None:
    completed = subprocess.run(command, capture_output=True, check=False)
    if completed.returncode != 0:
        stderr = completed.stderr.decode("utf-8", errors="ignore").strip()
        stdout = completed.stdout.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(stderr or stdout or "subprocess failed")


def extract_frame(ffmpeg: Path, source: Path, destination: Path, timestamp: float) -> None:
    run_command(
        [
            str(ffmpeg),
            "-y",
            "-ss",
            f"{timestamp:.2f}",
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(destination),
        ]
    )


def encode_media_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def strip_fence(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def parse_json_maybe(text: str) -> tuple[dict | None, bool]:
    cleaned = strip_fence(text)
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else {"items": value}, True
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if match:
            try:
                value = json.loads(match.group(0))
                return value if isinstance(value, dict) else {"items": value}, True
            except json.JSONDecodeError:
                pass
    return None, False


def http_json(payload: dict, api_key: str, timeout: int = 180) -> dict:
    request = urllib.request.Request(
        OPENROUTER_CHAT_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/local-capstone",
            "X-Title": "ShortsMong Vision Inspection",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def get_message_text(response: dict) -> str:
    choices = response.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        return "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
    return str(content or "")


def vision_prompt(user_description: str) -> str:
    return f"""이미지/프레임을 보고 사람이 비교하기 쉽게 Vision 인식 결과를 JSON으로만 출력하라.

사용자 설명: {user_description or "없음"}

출력 JSON 형식:
{{
  "scene_summary": "이미지 전체 장면 설명",
  "detected_objects": ["보이는 사물/음식/공간 요소"],
  "detected_food_or_menu": ["추정 음식/메뉴"],
  "keywords": ["핵심 키워드 8~12개"],
  "visual_evidence": ["그렇게 판단한 시각적 근거"],
  "description_match": true,
  "mismatch_reason": "사용자 설명과 다르면 이유, 아니면 빈 문자열",
  "caption_candidate": "숏폼 화면 자막 후보",
  "video_prompt_hint": "영상 생성 모델에 넣기 좋은 영어 프롬프트 힌트"
}}

규칙:
- JSON 외 텍스트는 쓰지 마라.
- 확실하지 않은 메뉴는 '추정'임을 표현하라.
- 키워드는 반드시 한국어 중심으로 작성하라."""


def inspect_model(api_key: str, model_id: str, model_label: str, image_path: Path, user_description: str) -> dict:
    response = http_json(
        {
            "model": model_id,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": vision_prompt(user_description)},
                        {"type": "image_url", "image_url": {"url": encode_media_data_url(image_path)}},
                    ],
                }
            ],
            "temperature": 0.2,
            "max_tokens": 900,
            "stream": False,
        },
        api_key,
    )
    raw = get_message_text(response)
    parsed, parsed_ok = parse_json_maybe(raw)
    return {
        "model": model_id,
        "model_label": model_label,
        "parsed_ok": parsed_ok,
        "parsed": parsed,
        "raw_output": raw,
        "usage": response.get("usage", {}),
    }


def format_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def write_csv(path: Path, rows: list[dict]) -> None:
    fieldnames = [
        "model_label",
        "model",
        "parsed_ok",
        "scene_summary",
        "detected_food_or_menu",
        "keywords",
        "description_match",
        "mismatch_reason",
        "caption_candidate",
        "video_prompt_hint",
        "raw_output",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            parsed = row.get("parsed") or {}
            writer.writerow(
                {
                    "model_label": row["model_label"],
                    "model": row["model"],
                    "parsed_ok": row["parsed_ok"],
                    "scene_summary": format_value(parsed.get("scene_summary")),
                    "detected_food_or_menu": format_value(parsed.get("detected_food_or_menu")),
                    "keywords": format_value(parsed.get("keywords")),
                    "description_match": format_value(parsed.get("description_match")),
                    "mismatch_reason": format_value(parsed.get("mismatch_reason")),
                    "caption_candidate": format_value(parsed.get("caption_candidate")),
                    "video_prompt_hint": format_value(parsed.get("video_prompt_hint")),
                    "raw_output": row.get("raw_output", ""),
                }
            )


def write_markdown(path: Path, source: Path, analysis_image: Path, user_description: str, rows: list[dict]) -> None:
    lines = [
        "# Vision 모델 직접 비교 결과",
        "",
        f"- 입력 파일: `{source}`",
        f"- 분석 이미지: `{analysis_image}`",
        f"- 사용자 설명: {user_description or '없음'}",
        "",
        "| 모델 | 장면 설명 | 메뉴/음식 추정 | 키워드 | 설명 일치 | 자막 후보 |",
        "|---|---|---|---|---|---|",
    ]
    for row in rows:
        parsed = row.get("parsed") or {}
        lines.append(
            "| "
            + " | ".join(
                [
                    row["model_label"],
                    format_value(parsed.get("scene_summary")).replace("|", "/"),
                    format_value(parsed.get("detected_food_or_menu")).replace("|", "/"),
                    format_value(parsed.get("keywords")).replace("|", "/"),
                    format_value(parsed.get("description_match")).replace("|", "/"),
                    format_value(parsed.get("caption_candidate")).replace("|", "/"),
                ]
            )
            + " |"
        )
    lines.extend(["", "## 원본 응답", ""])
    for row in rows:
        lines.extend([f"### {row['model_label']}", "", "```json", row.get("raw_output", ""), "```", ""])
    path.write_text("\n".join(lines), encoding="utf-8")


def model_list_from_args(value: str) -> list[tuple[str, str]]:
    if not value:
        return DEFAULT_MODELS
    result = []
    for model_id in [item.strip() for item in value.split(",") if item.strip()]:
        result.append((model_id, model_id))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect Vision model outputs side-by-side.")
    parser.add_argument("--input", required=True, help="Image or video file path.")
    parser.add_argument("--description", default="", help="Optional user description to compare against.")
    parser.add_argument("--frame-at", type=float, default=1.0, help="Timestamp for video frame extraction.")
    parser.add_argument("--models", default="", help="Comma-separated model IDs. Defaults to 3 preset Vision models.")
    args = parser.parse_args()

    source = Path(args.input)
    if not source.is_absolute():
        source = ROOT / source
    source = source.resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_dir = OUTPUT_ROOT / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    suffix = source.suffix.lower()
    if suffix in VIDEO_SUFFIXES:
        analysis_image = output_dir / "analysis_frame.jpg"
        extract_frame(find_ffmpeg_tools()["ffmpeg"], source, analysis_image, args.frame_at)
    elif suffix in IMAGE_SUFFIXES:
        analysis_image = source
    else:
        raise RuntimeError(f"지원하지 않는 입력 형식입니다: {source.suffix}")

    api_key = load_api_key()
    rows = []
    for model_id, label in model_list_from_args(args.models):
        print(f"[vision] {label}")
        try:
            rows.append(inspect_model(api_key, model_id, label, analysis_image, args.description))
        except Exception as exc:  # noqa: BLE001
            rows.append(
                {
                    "model": model_id,
                    "model_label": label,
                    "parsed_ok": False,
                    "parsed": {"scene_summary": "", "keywords": [], "mismatch_reason": str(exc)},
                    "raw_output": "",
                    "usage": {},
                }
            )

    manifest = {
        "input": str(source),
        "analysis_image": str(analysis_image),
        "description": args.description,
        "frame_at": args.frame_at,
        "results": rows,
    }
    (output_dir / "raw_results.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(output_dir / "vision_inspection.csv", rows)
    write_markdown(output_dir / "vision_inspection.md", source, analysis_image, args.description, rows)

    print(f"[done] {output_dir}")
    print(f"[done] {output_dir / 'vision_inspection.md'}")
    print(f"[done] {output_dir / 'vision_inspection.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
