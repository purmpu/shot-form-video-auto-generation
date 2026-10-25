"""공유 상태, 설정, 헬퍼 — Style 1/2 라우터가 모두 임포트한다."""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel

ROOT       = Path(__file__).resolve().parent.parent   # models/
WEB_DIR    = Path(__file__).resolve().parent
UPLOAD_DIR = ROOT / "uploads"
BGM_DIR    = ROOT / "bgm"
INTRO_DIR  = ROOT / "agro"

_VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm"}

# 진행 중인 작업 상태 저장소 (메모리)
jobs: dict[str, dict] = {}


class RenderConfig(BaseModel):
    headline:       str   = "마라탕 땡기는 날\n여긴 어때?"
    upload_session: str   = ""
    scene_notes:    List[str] = []
    # TTS
    tts_engine:     str   = "openrouter"
    tts_voice:      str   = "Rex"
    tts_model:      str   = "x-ai/grok-voice-tts-1.0"
    tts_speed:      float = 1.0
    tts_edge_voice: str   = "ko-KR-SunHiNeural"
    tts_edge_rate:  str   = "+12%"
    tts_edge_pitch: str   = "+20Hz"
    piper_model:    str   = ""
    # 자막
    subtitle_style:        str = "box"
    subtitle_font_size:    int = 46
    headline_font_size:    int = 92
    subtitle_color:        str = "white"
    subtitle_box_alpha:    str = "1"
    subtitle_box_color:    str = "black"
    subtitle_border_width: int = 3
    subtitle_font:         str = ""
    # BGM
    bgm_volume:       float = 0.09
    narration_volume: float = 1.55
    bgm_file:         str   = ""
    # Style 2 전용 — 매장 정보
    store_name:     str       = ""
    store_location: str       = ""
    menu_names:     List[str] = []
    has_cooking:    bool      = False
    has_packaging:  bool      = False
    has_interior:   bool      = False
    table_count:    int       = 0
    # 프롬프트 우선순위
    use_slot_prompt: bool     = True
    use_vlm_info:    bool     = True
    prompt_priority: str      = "slot"   # slot | balanced | vlm
    # 말투 스타일
    tone_style:     str       = "seosanam"   # seosanam | dudley
    # 어그로 인트로
    aggro_intro:    str       = ""
    # 자막 Y 위치 (0~100 = % from top, -1 = 기본값)
    subtitle_y_pct: int       = -1


def new_job(run_id: str) -> dict:
    jobs[run_id] = {"status": "pending", "logs": [], "output": None, "error": None}
    return jobs[run_id]


def resolve_upload_dir(upload_session: str) -> Optional[Path]:
    if not upload_session:
        return None
    candidate = UPLOAD_DIR / upload_session
    return candidate if candidate.exists() else None


def build_env(cfg: RenderConfig) -> dict:
    """RenderConfig → subprocess 환경변수 dict."""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"]  = "1"
    env.update({
        "TTS_ENGINE":            cfg.tts_engine,
        "TTS_VOICE":             cfg.tts_voice,
        "TTS_MODEL":             cfg.tts_model,
        "TTS_SPEED":             str(cfg.tts_speed),
        "TTS_EDGE_VOICE":        cfg.tts_edge_voice,
        "TTS_EDGE_RATE":         cfg.tts_edge_rate,
        "TTS_EDGE_PITCH":        cfg.tts_edge_pitch,
        "PIPER_MODEL":           cfg.piper_model,
        "SUBTITLE_STYLE":        cfg.subtitle_style,
        "SUBTITLE_FONT_SIZE":    str(cfg.subtitle_font_size),
        "HEADLINE_FONT_SIZE":    str(cfg.headline_font_size),
        "SUBTITLE_COLOR":        cfg.subtitle_color,
        "SUBTITLE_BOX_ALPHA":    cfg.subtitle_box_alpha,
        "SUBTITLE_BOX_COLOR":    cfg.subtitle_box_color,
        "SUBTITLE_BORDER_WIDTH": str(cfg.subtitle_border_width),
        "SUBTITLE_FONT":         cfg.subtitle_font,
        "BGM_VOLUME":            str(cfg.bgm_volume),
        "NARRATION_VOLUME":      str(cfg.narration_volume),
    })
    return env


def run_subprocess(job: dict, cmd: list, env: dict) -> None:
    """cmd를 실행하고 stdout을 job["logs"]에 스트리밍한다."""
    try:
        process = subprocess.Popen(
            cmd, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, cwd=str(ROOT),
            encoding="utf-8", errors="replace",
        )
        for line in process.stdout:
            line = line.rstrip()
            if line:
                job["logs"].append(line)
        process.wait()
        return process.returncode
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
        return -1


def python_exe() -> Path:
    p = ROOT / ".venv" / "Scripts" / "python.exe"
    return p if p.exists() else Path(sys.executable)


def bgm_path(bgm_file: str) -> Optional[Path]:
    if not bgm_file:
        return None
    p = BGM_DIR / bgm_file
    return p if p.exists() else None
