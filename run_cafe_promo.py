"""카페 전용 영상 파이프라인.

- 10개 클립 입력 (인테리어 6 + 메뉴 4)
- 각 클립을 1.5초로 트리밍 (이미 1.5초 이하면 그대로)
- 상단에 사장이 입력한 자막 텍스트 표시
- 클립 간 컷 편집 (트랜지션 없음)
- BGM 믹싱
- TTS / LLM 없음 → API 비용 0원
"""
from __future__ import annotations

import argparse
import os
import subprocess
from datetime import datetime
from pathlib import Path

# ── 공유 유틸 ────────────────────────────────────────────────────
from gemini_script_compare_common import (
    ROOT,
    SOURCE_DIR,
    FONT,
    BOLD_FONT,
    SUBTITLE_STYLE,
    SUBTITLE_FONT_SIZE,
    SUBTITLE_COLOR,
    SUBTITLE_BOX_ALPHA,
    SUBTITLE_BOX_COLOR,
    BGM_PATH,
    find_ffmpeg_tools,
    probe_duration,
    mix_bgm,
    run_command,
    escape_drawtext,
    wrap_text_for_drawtext,
    text_units,
    subtitle_font_path,
)

OUTPUT_SLUG    = "cafe"
FINAL_FILENAME = "final_cafe.mp4"

CLIP_DURATION  = 1.5   # 각 클립 최대 길이 (초)


# ── 자막 drawtext 필터 (상단 고정) ──────────────────────────────

def build_caption_filter(text: str, style: str, subtitle_y_pct: int = -1) -> str:
    """상단 자막 필터 문자열 생성."""
    # 사용자가 직접 줄바꿈(\\n)을 입력한 경우 우선 적용, 아니면 자동 줄바꿈
    user_lines = [l.strip() for l in text.split('\n') if l.strip()]
    if len(user_lines) >= 2:
        lines = user_lines[:2]
    else:
        lines = wrap_text_for_drawtext(text.replace('\n', ' '), max_units=28, max_lines=2)
    fpath = subtitle_font_path()
    fsize = int(os.environ.get("SUBTITLE_FONT_SIZE", "52"))
    color = os.environ.get("SUBTITLE_COLOR", "white")
    alpha = os.environ.get("SUBTITLE_BOX_ALPHA", "1")
    box_c = os.environ.get("SUBTITLE_BOX_COLOR", "black")

    line_h = 58
    n      = len(lines)
    if subtitle_y_pct >= 0:
        top_y = int(1920 * subtitle_y_pct / 100)
    else:
        top_y  = 38 if n == 1 else 20

    result = ""

    if style in ("box", "highlight"):
        box_h = 74 if n == 1 else 132
        box_c_val = "yellow" if style == "highlight" else box_c
        # 텍스트 길이 기반 박스 너비 계산 (전체 너비 대신 자막만 감쌈)
        max_units = max((text_units(line) for line in lines), default=0)
        box_w = min(1060, max(200, max_units * 28 + 80))
        box_x = (1080 - box_w) // 2
        result += (
            f"drawbox=x={box_x}:y={top_y - 10}:w={box_w}:h={box_h}"
            f":color={box_c_val}@{alpha}:t=fill,"
        )

    for i, line in enumerate(lines):
        t = escape_drawtext(line)
        y = top_y + i * line_h
        if style == "bold":
            result += (
                f"drawtext=fontfile='{fpath}':text='{t}':fontsize={fsize}"
                f":x=(w-text_w)/2:y={y}:fontcolor={color},"
            )
        else:
            result += (
                f"drawtext=fontfile='{fpath}':text='{t}':fontsize={fsize}"
                f":x=(w-text_w)/2:y={y}:fontcolor={color}"
                f":borderw=2:bordercolor=black,"
            )

    return result.rstrip(",")


# ── 클립 전처리 (트리밍 + 자막 + 리사이즈) ──────────────────────

def process_clip(
    ffmpeg: Path,
    src: Path,
    dst: Path,
    caption_filter: str,
    actual_dur: float,
) -> None:
    """클립 하나를 1080×1920 세로형으로 전처리."""
    # actual_dur 이 CLIP_DURATION 보다 길면 트리밍
    t_opt = ["-t", f"{CLIP_DURATION:.3f}"] if actual_dur > CLIP_DURATION else []

    vf = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        "eq=saturation=1.1:contrast=1.04:brightness=0.01,"
        f"{caption_filter}"
    )

    run_command([
        str(ffmpeg), "-y",
        "-i", str(src),
        *t_opt,
        "-vf", vf,
        "-an",                          # 클립 오디오 제거 (BGM만 사용)
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        str(dst),
    ])


# ── 컷 concat ────────────────────────────────────────────────────

def concat_clips(ffmpeg: Path, clips: list[Path], output: Path) -> None:
    """클립들을 컷 편집으로 이어 붙인다 (트랜지션 없음)."""
    n = len(clips)
    if n == 0:
        raise ValueError("클립 없음")

    # concat.txt 작성 후 concat demuxer로 copy — 재인코딩 없음
    txt = output.parent / "concat.txt"
    txt.write_text(
        "\n".join(f"file '{c.as_posix()}'" for c in clips),
        encoding="utf-8",
    )
    run_command([
        str(ffmpeg), "-y",
        "-f", "concat", "-safe", "0", "-i", str(txt),
        "-c", "copy",
        str(output),
    ])


# ── CLI ─────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="카페 전용 영상 파이프라인")
    p.add_argument("--run-id",         default=datetime.now().strftime("%Y%m%d-%H%M%S"))
    p.add_argument("--slot-files",     default="", help="쉼표 구분 파일명 목록")
    p.add_argument("--caption-text",   default="")
    p.add_argument("--subtitle-style", default="box", choices=["box", "bold", "highlight"])
    p.add_argument("--subtitle-y",     type=int, default=-1, help="자막 Y 위치 %% (0~100), -1=기본값")
    p.add_argument("--bgm",            default=str(BGM_PATH))
    p.add_argument("--bgm-volume",     type=float, default=0.12)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    tools = find_ffmpeg_tools()

    output_dir  = ROOT / "outputs" / OUTPUT_SLUG / args.run_id
    clips_dir   = output_dir / "clips"
    for d in [output_dir, clips_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # 파일 목록
    if args.slot_files:
        filenames = [f.strip() for f in args.slot_files.split(",") if f.strip()]
    else:
        from gemini_script_compare_common import _VIDEO_EXTS
        filenames = sorted(
            f.name for f in SOURCE_DIR.iterdir()
            if f.is_file() and f.suffix.lower() in _VIDEO_EXTS
        )

    if not filenames:
        raise RuntimeError("처리할 영상 파일이 없습니다")

    print(f"[cafe] 총 {len(filenames)}개 클립 처리 시작")
    print("[progress:5%]")

    # 자막 필터 (모든 클립 공통)
    caption_filter = build_caption_filter(
        args.caption_text or "",
        args.subtitle_style,
        subtitle_y_pct=args.subtitle_y,
    )
    print(f"[cafe] 자막: '{args.caption_text}' / 스타일: {args.subtitle_style}")

    # ── Phase 1: 클립 전처리 ──────────────────────────────────────
    processed_clips: list[Path] = []

    for i, filename in enumerate(filenames):
        pct = 5 + int((i + 1) / len(filenames) * 60)
        print(f"[progress:{pct}%]")

        src = SOURCE_DIR / filename
        if not src.exists():
            raise FileNotFoundError(f"파일 없음: {src}")

        actual_dur = probe_duration(tools["ffprobe"], src)
        out_dur    = min(actual_dur, CLIP_DURATION)
        clip_out   = clips_dir / f"clip_{i+1:02d}.mp4"

        print(f"[cafe] 클립{i+1} {filename}: {actual_dur:.2f}s → {out_dur:.2f}s")
        process_clip(tools["ffmpeg"], src, clip_out, caption_filter, actual_dur)

        processed_clips.append(clip_out)

    # ── Phase 2: 컷 concat ───────────────────────────────────────
    print("[progress:70%]")
    print(f"[cafe] 컷 concat ({len(processed_clips)}개)")

    concat_output = output_dir / f"{OUTPUT_SLUG}_concat.mp4"
    concat_clips(tools["ffmpeg"], processed_clips, concat_output)

    total_dur = probe_duration(tools["ffprobe"], concat_output)
    print(f"[cafe] concat 완료: {total_dur:.2f}s")

    # ── Phase 3: BGM 믹싱 ────────────────────────────────────────
    print("[progress:85%]")
    bgm = Path(args.bgm)
    if not bgm.is_absolute():
        bgm = ROOT / bgm

    final_output = output_dir / FINAL_FILENAME

    if bgm.exists():
        print(f"[cafe] BGM 믹싱: {bgm.name}")
        # mix_bgm은 narration_volume도 섞는데 카페는 오디오 트랙이 없으니
        # 직접 BGM만 얹음
        bgm_vol = args.bgm_volume
        run_command([
            str(tools["ffmpeg"]), "-y",
            "-i", str(concat_output),
            "-stream_loop", "-1", "-i", str(bgm),
            "-filter_complex",
            f"[1:a]atrim=start=0:end={total_dur:.3f},"
            f"asetpts=PTS-STARTPTS,volume={bgm_vol}[bgm];"
            "[bgm]anull[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(final_output),
        ])
    else:
        print(f"[warn] BGM 파일 없음 ({bgm}) → 무음 영상 저장")
        run_command([
            str(tools["ffmpeg"]), "-y",
            "-i", str(concat_output),
            "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={total_dur:.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-shortest",
            str(final_output),
        ])

    # 썸네일
    print("[progress:95%]")
    poster = output_dir / "poster.jpg"
    run_command([
        str(tools["ffmpeg"]), "-y", "-i", str(final_output),
        "-ss", "00:00:01.0", "-update", "1", "-frames:v", "1", str(poster),
    ])

    print("[progress:100%]")
    print(f"[done] {final_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
