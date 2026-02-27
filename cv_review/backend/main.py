"""CV Review v2 — FastAPI Backend"""
import asyncio
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import tempfile

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from config.settings import get_settings
from src.cv_parser import extract_text_from_file
from src.evaluator import evaluate_cv
from src.reports import build_excel_report, build_pdf_report, get_records_for_report
from src.storage import Storage
from src.url_fetcher import fetch_text_from_url, url_to_display_name

app = FastAPI(title="CV Review API", version="2.0.0", description="Google Team CV Evaluation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = Storage(data_dir=PROJECT_ROOT / "data")

# In-memory job registry (temporary, until completion)
jobs: Dict[str, Dict[str, Any]] = {}


@app.get("/")
async def root():
    """Root route so Cloud Run URL does not return 404."""
    return {
        "message": "CV Review API",
        "docs": "/docs",
        "health": "/api/health",
    }


async def run_analysis(
    job_id: str,
    cv_text: str,
    filename: str,
    *,
    use_fast_model: bool = False,
) -> None:
    jobs[job_id] = {
        "status": "processing",
        "progress": 5,
        "current_step": "Starting analysis…",
        "result": None,
        "error": None,
    }

    def update_progress(pct: int, step: str) -> None:
        jobs[job_id]["progress"] = pct
        jobs[job_id]["current_step"] = step

    start_time = time.time()
    try:
        settings = get_settings()
        if not settings.get("api_key"):
            raise ValueError("FUELIX_API_KEY is not set. Add it to backend/.env")

        model_override = None
        if use_fast_model:
            model_override = (settings.get("api") or {}).get("fast_model", "gemini-2.0-flash")

        result = await asyncio.to_thread(
            evaluate_cv,
            cv_text,
            progress_callback=update_progress,
            model=model_override,
        )

        elapsed = round(time.time() - start_time, 2)
        analysis_id = storage.save_analysis(
            filename=filename,
            result=result,
            analysis_time_seconds=elapsed,
        )

        jobs[job_id]["status"] = "complete"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["current_step"] = "Analysis complete!"
        jobs[job_id]["result"] = {
            **result,
            "analysis_id": analysis_id,
            "analysis_time_seconds": elapsed,
            "filename": filename,
        }

    except Exception as exc:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["progress"] = 0
        jobs[job_id]["current_step"] = "Error"
        jobs[job_id]["error"] = str(exc)


@app.post("/api/evaluate")
async def evaluate(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    name = file.filename or "cv.pdf"
    suffix = Path(name).suffix.lower() or ".pdf"
    if suffix not in (".pdf", ".txt", ".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, TXT, or DOCX.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10 MB).")
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        cv_text = extract_text_from_file(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    if not (cv_text or "").strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "current_step": "Queued…",
        "result": None,
        "error": None,
    }
    background_tasks.add_task(run_analysis, job_id, cv_text, name, use_fast_model=False)
    return {"job_id": job_id}


@app.post("/api/evaluate-batch")
async def evaluate_batch(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    """Accept multiple CV files and analyze them in parallel using the fast model."""
    if not files or len(files) > 20:
        raise HTTPException(
            status_code=400,
            detail="Send between 1 and 20 files.",
        )

    job_ids: list[str] = []
    for file in files:
        name = file.filename or "cv.pdf"
        suffix = Path(name).suffix.lower() or ".pdf"
        if suffix not in (".pdf", ".txt", ".docx", ".doc"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for {name}. Use PDF, TXT, or DOCX.",
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {name} too large (max 10 MB).",
                )
            tmp.write(content)
            tmp_path = Path(tmp.name)

        try:
            cv_text = extract_text_from_file(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)

        if not (cv_text or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract text from {name}.",
            )

        job_id = str(uuid.uuid4())
        job_ids.append(job_id)
        jobs[job_id] = {
            "status": "processing",
            "progress": 0,
            "current_step": "Queued…",
            "result": None,
            "error": None,
        }
        background_tasks.add_task(
            run_analysis,
            job_id,
            cv_text,
            name,
            use_fast_model=True,
        )

    return {"job_ids": job_ids}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {"job_id": job_id, **job}


@app.get("/api/analyses")
async def list_analyses(limit: int = 50, offset: int = 0):
    return storage.list_analyses(limit=limit, offset=offset)


@app.get("/api/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    analysis = storage.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return analysis


@app.delete("/api/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str):
    ok = storage.delete_analysis(analysis_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"deleted": analysis_id}


@app.get("/api/metrics")
async def get_metrics():
    return storage.get_metrics()


@app.get("/api/best-candidates")
async def get_best_candidates():
    return storage.get_best_candidates()


class URLEvaluateRequest(BaseModel):
    url: str


@app.post("/api/evaluate-url")
async def evaluate_url(
    request: URLEvaluateRequest,
    background_tasks: BackgroundTasks,
):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required.")

    # Fetch and extract text from URL (synchronous — fast)
    try:
        cv_text, source_label = fetch_text_from_url(url, timeout=30)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {e}")

    if not cv_text.strip():
        raise HTTPException(status_code=422, detail="No usable text could be extracted from the URL.")

    display_name = url_to_display_name(url)
    filename = f"[{source_label}] {display_name}"

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "current_step": "Queued…",
        "result": None,
        "error": None,
    }
    background_tasks.add_task(run_analysis, job_id, cv_text, filename, use_fast_model=False)
    return {"job_id": job_id, "source_label": source_label, "chars_extracted": len(cv_text)}


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


# ── Reports (Excel / PDF) ─────────────────────────────────────────────────────

@app.get("/api/reports/candidate/{analysis_id}")
async def report_candidate(
    analysis_id: str,
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
):
    """Download a high-level decision report for one candidate (Excel or PDF)."""
    record = storage.get_analysis(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    records = [record]
    try:
        if format == "xlsx":
            content = build_excel_report(records)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"candidate-report-{analysis_id[:8]}.xlsx"
        else:
            content = build_pdf_report(records)
            media_type = "application/pdf"
            filename = f"candidate-report-{analysis_id[:8]}.pdf"
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report library missing. Install with: pip install openpyxl reportlab. ({e})",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/reports/candidates")
async def report_candidates(
    format: str = Query("xlsx", regex="^(xlsx|pdf)$"),
    ids: Optional[str] = Query(None, description="Comma-separated analysis IDs to include"),
    area: Optional[str] = Query(None, description="Filter by best-fit area (e.g. Infrastructure)"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD, inclusive)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD, inclusive)"),
):
    """Download a high-level report for multiple candidates, optionally filtered by IDs, area, or date range."""
    analysis_ids = [x.strip() for x in ids.split(",")] if ids else None
    if analysis_ids and not any(analysis_ids):
        analysis_ids = None
    records = get_records_for_report(
        storage,
        analysis_ids=analysis_ids,
        area_filter=area,
        date_from=date_from,
        date_to=date_to,
        limit=200,
    )
    if not records:
        raise HTTPException(status_code=404, detail="No analyses match the filter.")
    try:
        if format == "xlsx":
            content = build_excel_report(records)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "candidate-reports.xlsx"
        else:
            content = build_pdf_report(records)
            media_type = "application/pdf"
            filename = "candidate-reports.pdf"
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report library missing. Install with: pip install openpyxl reportlab. ({e})",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
