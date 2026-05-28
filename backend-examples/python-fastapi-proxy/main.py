"""
API Bulk Runner - FastAPI Proxy

Optional backend adapter for the full/private product build.

Run locally:
  python -m venv .venv
  .venv\\Scripts\\activate
  pip install -r requirements.txt
  set PROXY_TOKEN=change-me-to-a-long-random-token
  uvicorn main:app --host 127.0.0.1 --port 8787

macOS/Linux:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  PROXY_TOKEN=change-me-to-a-long-random-token uvicorn main:app --host 127.0.0.1 --port 8787
"""

from __future__ import annotations

import os
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


VERSION = "1.0.0"
STARTED_AT = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8787"))
PROXY_TOKEN = os.getenv("PROXY_TOKEN", "CHANGE_ME_TO_A_LONG_RANDOM_TOKEN")
ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOW_ORIGINS", "*").split(",")
    if origin.strip()
]
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(10 * 1024 * 1024)))
DEFAULT_TIMEOUT_MS = int(os.getenv("REQUEST_TIMEOUT_MS", "60000"))
MAX_TIMEOUT_MS = 300000

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
BLOCKED_HEADERS = {"host", "connection", "content-length"}


class ProxyRequest(BaseModel):
    method: str = "GET"
    url: str
    headers: dict[str, Any] = Field(default_factory=dict)
    body: str | None = None
    timeoutMs: int | None = None


app = FastAPI(title="API Bulk Runner FastAPI Proxy", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Local-Agent-Token"],
    max_age=86400,
)


def validate_token(token: str | None) -> None:
    if not token or token != PROXY_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-Local-Agent-Token.",
        )


def normalize_method(method: str) -> str:
    value = str(method or "GET").upper()
    if value not in ALLOWED_METHODS:
        raise HTTPException(status_code=400, detail=f"Unsupported method: {value}")
    return value


def normalize_target_url(raw_url: str) -> str:
    parsed = urlparse(raw_url or "")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail="Only http and https target URLs are supported.",
        )
    return raw_url


def normalize_headers(headers: dict[str, Any] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in (headers or {}).items():
        if not key:
            continue
        if key.lower() in BLOCKED_HEADERS:
            continue
        out[key] = "" if value is None else str(value)
    return out


async def enforce_body_limit(request: Request) -> bytes:
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large.")
    return body


@app.get("/health")
async def health(x_local_agent_token: str | None = Header(default=None)) -> dict[str, Any]:
    validate_token(x_local_agent_token)
    return {
        "ok": True,
        "name": "API Bulk Runner FastAPI Proxy",
        "version": VERSION,
        "startedAt": STARTED_AT,
        "endpoint": f"http://{HOST}:{PORT}/request",
    }


@app.post("/request")
async def forward_request(
    request: Request,
    x_local_agent_token: str | None = Header(default=None),
) -> dict[str, Any]:
    validate_token(x_local_agent_token)
    await enforce_body_limit(request)

    try:
        payload = ProxyRequest(**(await request.json()))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {exc}") from exc

    method = normalize_method(payload.method)
    target_url = normalize_target_url(payload.url)
    headers = normalize_headers(payload.headers)
    timeout_ms = max(
        1000,
        min(int(payload.timeoutMs or DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS),
    )
    body = None if method in {"GET", "HEAD"} else payload.body

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(
            timeout=timeout_ms / 1000,
            follow_redirects=True,
        ) as client:
            response = await client.request(
                method,
                target_url,
                headers=headers,
                content=body,
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Target API request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    return {
        "ok": 200 <= response.status_code < 300,
        "status": response.status_code,
        "statusText": response.reason_phrase,
        "headers": dict(response.headers),
        "body": response.text,
        "elapsedMs": elapsed_ms,
        "targetUrl": str(response.url),
    }
