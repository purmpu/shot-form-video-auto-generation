"""Style 3 라우터 — 전체 맥락 LLM 대본 생성."""
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse

from ..common import (
    ROOT, _VIDEO_EXTS, INTRO_DIR,
    RenderConfig, jobs, new_job,
    resolve_upload_dir, build_env, run_subprocess, python_exe, bgm_path,
)

router = APIRouter()

OUTPUT_ROOT = ROOT / "outputs" / "gemini-style3"
FINAL_FILE  = "final_style3.mp4"
PIPELINE    = ROOT / "run_style3_promo.py"


# ── 조회 ──────────────────────────────────────────────────────

@router.get("/api/outputs-style3")
def list_outputs():
    if not OUTPUT_ROOT.exists():
        return []
    results = []
    for d in sorted(OUTPUT_ROOT.iterdir(), reverse=True)[:20]:
        mp4 = d / FINAL_FILE
        if mp4.exists():
            results.append({
                "run_id":  d.name,
                "size_mb": round(mp4.stat().st_size / 1024**2, 1),
            })
    return results


@router.get("/api/outputs-style3/{run_id}/video")
def output_video(run_id: str):
    path = OUTPUT_ROOT / run_id / FINAL_FILE
    if not path.exists():
        return {"error": "not found"}
    return FileResponse(str(path), media_type="video/mp4", headers={"Accept-Ranges": "bytes"})


# ── 렌더링 ────────────────────────────────────────────────────

@router.post("/api/render-style3")
def start_render(config: RenderConfig, background_tasks: BackgroundTasks):
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    new_job(run_id)
    background_tasks.add_task(_run_pipeline, run_id, config)
    return {"job_id": run_id}


def _run_pipeline(run_id: str, cfg: RenderConfig):
    job = jobs[run_id]
    job["status"] = "running"

    upload_dir = resolve_upload_dir(cfg.upload_session)
    env = build_env(cfg)

    slot_files_arg = ""
    if upload_dir:
        env["SOURCE_DIR"] = str(upload_dir)
        slot_files_arg = ",".join(sorted(
            f.name for f in upload_dir.iterdir()
            if f.is_file() and f.suffix.lower() in _VIDEO_EXTS
        ))

    headline_arg = cfg.headline.replace("\n", "\\n")
    cmd = [
        str(python_exe()), "-u", str(PIPELINE),
        "--run-id",  run_id,
        "--tts",     cfg.tts_engine,
        "--headline", headline_arg,
    ]
    if slot_files_arg:
        cmd += ["--slot-files", slot_files_arg]
    if cfg.store_name:
        cmd += ["--store-name", cfg.store_name]
    if cfg.store_location:
        cmd += ["--store-location", cfg.store_location]
    if cfg.menu_names:
        cmd += ["--menu-names", ",".join(cfg.menu_names)]
    if cfg.has_cooking:
        cmd += ["--has-cooking"]
    if cfg.has_packaging:
        cmd += ["--has-packaging"]
    if cfg.has_interior:
        cmd += ["--has-interior"]
    if cfg.table_count:
        cmd += ["--table-count", str(cfg.table_count)]
    cmd += ["--style", cfg.tone_style if cfg.tone_style in ("seosanam", "dudley") else "seosanam"]

    bgm = bgm_path(cfg.bgm_file)
    if bgm:
        cmd += ["--bgm", str(bgm)]

    if cfg.aggro_intro:
        intro = INTRO_DIR / Path(cfg.aggro_intro).name
        if intro.exists():
            cmd += ["--aggro-intro", str(intro)]

    if cfg.subtitle_y_pct >= 0:
        cmd += ["--subtitle-y", str(cfg.subtitle_y_pct)]

    rc = run_subprocess(job, cmd, env)
    if rc == 0:
        output = OUTPUT_ROOT / run_id / FINAL_FILE
        job["status"] = "completed"
        job["output"] = str(output) if output.exists() else None
    elif job["status"] != "failed":
        job["status"] = "failed"
        job["error"]  = "렌더링 실패 — 로그를 확인하세요."
