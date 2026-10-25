"""카페 전용 렌더링 라우터."""
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from ..common import ROOT, jobs, new_job, resolve_upload_dir, python_exe, bgm_path

router = APIRouter()

PIPELINE = ROOT / "run_cafe_promo.py"


class CafeRenderConfig(BaseModel):
    upload_session:  str   = ""
    caption_text:    str   = ""
    subtitle_style:  str   = "box"   # box | bold
    subtitle_y_pct:  int   = -1
    bgm_file:        str   = ""
    bgm_volume:      float = 0.12
    run_id:          str   = ""


@router.post("/api/render-cafe")
def render_cafe(cfg: CafeRenderConfig, background_tasks: BackgroundTasks):
    run_id = cfg.run_id or datetime.now().strftime("%Y%m%d-%H%M%S")
    job    = new_job(run_id)

    upload_dir = resolve_upload_dir(cfg.upload_session)
    if not upload_dir:
        job["status"] = "failed"
        job["error"]  = f"업로드 세션 없음: {cfg.upload_session}"
        return {"job_id": run_id}

    # 업로드된 영상 파일 목록 (이름순)
    from ..common import _VIDEO_EXTS
    files = sorted(
        f.name for f in upload_dir.iterdir()
        if f.is_file() and f.suffix.lower() in _VIDEO_EXTS
    )
    if not files:
        job["status"] = "failed"
        job["error"]  = "영상 파일 없음"
        return {"job_id": run_id}

    bgm = bgm_path(cfg.bgm_file) or ""

    import os, sys
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"]  = "1"
    env["SOURCE_DIR"] = str(upload_dir)

    cmd = [
        str(python_exe()), "-u", str(PIPELINE),
        "--run-id",        run_id,
        "--slot-files",    ",".join(files),
        "--caption-text",  cfg.caption_text,
        "--subtitle-style", cfg.subtitle_style,
        "--bgm-volume",    str(cfg.bgm_volume),
    ]
    if cfg.subtitle_y_pct >= 0:
        cmd += ["--subtitle-y", str(cfg.subtitle_y_pct)]
    if bgm:
        cmd += ["--bgm", str(bgm)]

    def _run():
        from ..common import run_subprocess
        job["status"] = "running"
        rc = run_subprocess(job, cmd, env)
        if rc == 0 and any("[done]" in l for l in job["logs"]):
            done_line = next(l for l in reversed(job["logs"]) if "[done]" in l)
            output_path = done_line.split("[done]")[-1].strip()
            job["output"] = output_path
            job["status"] = "completed"
        else:
            if job["status"] != "failed":
                job["status"] = "failed"
                job["error"]  = job["error"] or "파이프라인 오류"

    background_tasks.add_task(_run)
    return {"job_id": run_id}
