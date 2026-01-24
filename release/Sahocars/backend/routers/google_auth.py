from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from db import get_session
from services.google_calendar_service import build_auth_url, exchange_code, get_connection_status

router = APIRouter(prefix="/auth/google", tags=["google-auth"])


def _require_local(request: Request):
    allow_remote = os.getenv("SAHOCARS_ADMIN_ALLOW_REMOTE", "false").lower() == "true"
    if allow_remote:
        return
    client = request.client
    host = client.host if client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Acceso solo local")


@router.get("/start")
def google_start(request: Request):
    _require_local(request)
    url = build_auth_url()
    return RedirectResponse(url=url)


@router.get("/callback")
def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    session: Session = Depends(get_session),
):
    _require_local(request)
    if not code:
        raise HTTPException(status_code=400, detail="Codigo OAuth faltante")
    exchange_code(session, code, state)
    return RedirectResponse(url="/settings/integrations")


@router.get("/status")
def google_status(request: Request, session: Session = Depends(get_session)):
    _require_local(request)
    return get_connection_status(session)
