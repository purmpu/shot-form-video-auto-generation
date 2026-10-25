"""FastAPI 앱 진입점 — 공유 엔드포인트 + 라우터 등록."""
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel as _BM

from .common import ROOT, WEB_DIR, UPLOAD_DIR, BGM_DIR, INTRO_DIR, _VIDEO_EXTS, jobs
from .routers import style3, cafe

app = FastAPI(title="숏폼 영상 생성기")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(style3.router)
app.include_router(cafe.router)


# ── 공유 엔드포인트 ───────────────────────────────────────────

@app.post("/api/upload")
async def upload_videos(files: List[UploadFile] = File(...)):
    import shutil
    session_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-up"
    upload_dir = UPLOAD_DIR / session_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for i, file in enumerate(files, 1):
        suffix = Path(file.filename).suffix.lower()
        if suffix not in _VIDEO_EXTS:
            suffix = ".mp4"
        dest = upload_dir / f"scene_{i:02d}{suffix}"
        # 청크 스트리밍으로 저장 — 전체를 메모리에 올리지 않음
        with dest.open("wb") as f_out:
            shutil.copyfileobj(file.file, f_out)
        saved.append({"index": i, "original": file.filename, "saved_as": dest.name})
    return {"session_id": session_id, "files": saved}


@app.get("/api/bgm")
def get_bgm():
    BGM_DIR.mkdir(exist_ok=True)
    return [f.name for f in sorted(BGM_DIR.glob("*.mp3"))]


@app.get("/api/bgm/{filename}")
def get_bgm_file(filename: str):
    safe = Path(filename).name
    path = BGM_DIR / safe
    if not path.exists() or path.suffix.lower() != ".mp3":
        raise HTTPException(404)
    return FileResponse(str(path), media_type="audio/mpeg",
                        headers={"Cache-Control": "max-age=3600", "Accept-Ranges": "bytes"})


@app.get("/api/intros")
def get_intros():
    INTRO_DIR.mkdir(exist_ok=True)
    return [f.name for f in sorted(INTRO_DIR.glob("*")) if f.suffix.lower() in _VIDEO_EXTS]


@app.post("/api/intros")
async def upload_intro(file: UploadFile = File(...)):
    INTRO_DIR.mkdir(exist_ok=True)
    safe = Path(file.filename).name
    dest = INTRO_DIR / safe
    dest.write_bytes(await file.read())
    return {"filename": safe}


@app.get("/api/intros/{filename}")
def get_intro_file(filename: str):
    safe = Path(filename).name
    path = INTRO_DIR / safe
    if not path.exists() or path.suffix.lower() not in _VIDEO_EXTS:
        raise HTTPException(404)
    return FileResponse(str(path), media_type="video/mp4",
                        headers={"Accept-Ranges": "bytes"})


@app.delete("/api/intros/{filename}")
def delete_intro(filename: str):
    safe = Path(filename).name
    path = INTRO_DIR / safe
    if path.exists():
        path.unlink()
    return {"ok": True}


class _TtsPreviewReq(_BM):
    engine:     str   = "xai"
    edge_voice: str   = "ko-KR-SunHiNeural"
    edge_rate:  str   = "+12%"
    voice:      str   = "eve"
    model:      str   = "x-ai/grok-voice-tts-1.0"
    speed:      float = 1.0


def _del(p: Path):
    p.unlink(missing_ok=True)


@app.post("/api/tts-preview")
async def tts_preview(body: _TtsPreviewReq, background_tasks: BackgroundTasks):
    import asyncio, os, sys, tempfile
    text = "안녕하세요, 이 음성으로 자막을 읽어드릴게요."
    tmp  = Path(tempfile.mktemp(suffix=".mp3"))
    try:
        if body.engine == "edge":
            import edge_tts
            comm = edge_tts.Communicate(text, body.edge_voice, rate=body.edge_rate)
            await comm.save(str(tmp))
        elif body.engine in ("xai", "openrouter"):
            if str(ROOT) not in sys.path:
                sys.path.insert(0, str(ROOT))
            from gemini_script_compare_common import synthesize_tts, load_api_key  # noqa
            api_key = load_api_key()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, lambda: synthesize_tts(
                    text, tmp,
                    api_key=api_key, engine=body.engine,
                    voice=body.voice, model=body.model, speed=body.speed,
                ))
        else:
            raise HTTPException(400, f"{body.engine} 미리듣기 미지원")

        if not tmp.exists():
            raise HTTPException(500, "TTS 생성 실패")

        background_tasks.add_task(_del, tmp)
        return FileResponse(str(tmp), media_type="audio/mpeg")
    except HTTPException:
        _del(tmp); raise
    except Exception as e:
        _del(tmp); raise HTTPException(500, str(e))


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    return jobs.get(job_id, {"error": "not found"})


@app.get("/api/jobs/{job_id}/video")
def job_video(job_id: str):
    job = jobs.get(job_id, {})
    path = Path(job.get("output") or "")
    if not path.exists():
        return {"error": "no output"}
    return FileResponse(str(path), media_type="video/mp4", headers={"Accept-Ranges": "bytes"})


@app.get("/api/jobs/{job_id}/thumbnail")
def job_thumbnail(job_id: str):
    job = jobs.get(job_id, {})
    output_path = Path(job.get("output") or "")
    if not output_path.exists():
        raise HTTPException(404, "no output")
    thumb = output_path.parent / "thumbnail.jpg"
    if not thumb.exists():
        raise HTTPException(404, "no thumbnail")
    return FileResponse(str(thumb), media_type="image/jpeg",
                        headers={"Cache-Control": "max-age=3600"})


