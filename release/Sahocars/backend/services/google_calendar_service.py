from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
from sqlmodel import Session, select


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars"

_pending_state: str | None = None


def build_auth_url() -> str:
    client_id = _require_env("GOOGLE_CLIENT_ID")
    redirect_uri = _get_redirect_uri()
    scope = "https://www.googleapis.com/auth/calendar.events"
    state = secrets.token_urlsafe(24)
    global _pending_state
    _pending_state = state
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return httpx.URL(GOOGLE_AUTH_URL).copy_add_params(params).human_repr()


def exchange_code(session: Session, code: str, state: str | None) -> None:
    _validate_state(state)
    client_id = _require_env("GOOGLE_CLIENT_ID")
    client_secret = _require_env("GOOGLE_CLIENT_SECRET")
    redirect_uri = _get_redirect_uri()

    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    response = httpx.post(GOOGLE_TOKEN_URL, data=payload, timeout=20)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Error al obtener token: {response.text}")
    data = response.json()
    _save_tokens(session, data)


def get_connection_status(session: Session) -> dict[str, Any]:
    token = _get_token(session)
    if not token:
        return {"connected": False}
    now = datetime.utcnow()
    expired = token.expiry is not None and token.expiry <= now
    return {
        "connected": True,
        "expired": expired,
        "scopes": token.scopes.split(" ") if token.scopes else [],
        "updated_at": token.updated_at,
    }


def ensure_access_token(session: Session) -> str:
    token = _get_token(session)
    if not token:
        raise HTTPException(status_code=400, detail="Google Calendar no conectado")
    if token.expiry and token.expiry <= datetime.utcnow() + timedelta(seconds=60):
        if not token.refresh_token:
            raise HTTPException(status_code=400, detail="Token expirado sin refresh_token")
        token = _refresh_token(session, token.refresh_token)
    return token.access_token


def create_or_update_event(session: Session, visit, vehicle, branch_name: str | None) -> dict[str, Any]:
    access_token = ensure_access_token(session)
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")
    timezone = visit.timezone or "Europe/Madrid"
    scheduled_at = _ensure_timezone(visit.scheduled_at, timezone)
    if not scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at es requerido para sincronizar")

    duration = visit.duration_minutes or 30
    end_at = scheduled_at + timedelta(minutes=duration)

    summary = f"Visita vehiculo {vehicle.license_plate}"
    description = _build_description(visit, vehicle)
    event_payload = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": scheduled_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": end_at.isoformat(), "timeZone": timezone},
    }
    if branch_name:
        event_payload["location"] = branch_name

    headers = {"Authorization": f"Bearer {access_token}"}

    if visit.calendar_event_id:
        url = f"{GOOGLE_EVENTS_URL}/{calendar_id}/events/{visit.calendar_event_id}"
        response = httpx.patch(url, json=event_payload, headers=headers, timeout=20)
    else:
        url = f"{GOOGLE_EVENTS_URL}/{calendar_id}/events"
        response = httpx.post(url, json=event_payload, headers=headers, timeout=20)

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=400, detail=f"Error calendario: {response.text}")
    return response.json()


def _build_description(visit, vehicle) -> str:
    parts = [
        f"Vehiculo: {vehicle.brand or ''} {vehicle.model or ''} {vehicle.version or ''}".strip(),
        f"Matricula: {vehicle.license_plate}",
        f"Nombre: {visit.name}",
    ]
    if visit.phone:
        parts.append(f"Telefono: {visit.phone}")
    if visit.email:
        parts.append(f"Email: {visit.email}")
    if visit.notes:
        parts.append(f"Notas: {visit.notes}")
    return "\n".join([value for value in parts if value])


def _ensure_timezone(value: datetime | None, timezone: str) -> datetime | None:
    if not value:
        return None
    if value.tzinfo:
        return value
    return value.replace(tzinfo=ZoneInfo(timezone))


def _get_token(session: Session):
    from main import GoogleToken

    return session.exec(select(GoogleToken).order_by(GoogleToken.id.desc())).first()


def _save_tokens(session: Session, data: dict[str, Any]) -> None:
    from main import GoogleToken

    now = datetime.utcnow()
    expiry = None
    expires_in = data.get("expires_in")
    if expires_in:
        expiry = now + timedelta(seconds=int(expires_in))

    token = _get_token(session)
    if not token:
        token = GoogleToken(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expiry=expiry,
            scopes=data.get("scope"),
            created_at=now,
            updated_at=now,
        )
    else:
        token.access_token = data["access_token"]
        token.refresh_token = data.get("refresh_token") or token.refresh_token
        token.expiry = expiry
        token.scopes = data.get("scope") or token.scopes
        token.updated_at = now
    session.add(token)
    session.commit()


def _refresh_token(session: Session, refresh_token: str):
    client_id = _require_env("GOOGLE_CLIENT_ID")
    client_secret = _require_env("GOOGLE_CLIENT_SECRET")
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    response = httpx.post(GOOGLE_TOKEN_URL, data=payload, timeout=20)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Error al refrescar token: {response.text}")
    data = response.json()
    data["refresh_token"] = refresh_token
    _save_tokens(session, data)
    return _get_token(session)


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=400, detail=f"Falta {name} en entorno")
    return value


def _get_redirect_uri() -> str:
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    if redirect_uri:
        return redirect_uri
    base_url = _require_env("SAHOCARS_BASE_URL")
    return f"{base_url.rstrip('/')}/auth/google/callback"


def _validate_state(state: str | None) -> None:
    if not _pending_state:
        raise HTTPException(status_code=400, detail="Estado OAuth no disponible")
    if state != _pending_state:
        raise HTTPException(status_code=400, detail="Estado OAuth invalido")
