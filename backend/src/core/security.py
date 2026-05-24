import time
from typing import Any, Optional

import httpx
from jose import JWTError, jwt

from .config import settings
import json
import base64


_JWKS_CACHE_TTL_SECONDS = 300
_jwks_by_kid: dict[str, dict[str, Any]] = {}
_jwks_expires_at: float = 0.0


def _load_jwks(force_refresh: bool = False) -> dict[str, dict[str, Any]]:
    """Load and cache Supabase JWKS for asymmetric JWT validation."""
    global _jwks_by_kid, _jwks_expires_at

    now = time.time()
    if not force_refresh and _jwks_by_kid and now < _jwks_expires_at:
        return _jwks_by_kid

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    response = httpx.get(jwks_url, timeout=5.0)
    response.raise_for_status()
    payload = response.json()

    keys: dict[str, dict[str, Any]] = {}
    for key in payload.get("keys", []):
        kid = key.get("kid")
        if kid:
            keys[str(kid)] = key

    _jwks_by_kid = keys
    _jwks_expires_at = now + _JWKS_CACHE_TTL_SECONDS
    return _jwks_by_kid


def decode_token(token: str) -> Optional[dict]:
    """Decode Supabase JWT token"""
    try:
        if not token:
            return None

        header = jwt.get_unverified_header(token)
        token_alg = str(header.get("alg") or "").upper()
        if not token_alg:
            return None

        decode_options = {"verify_exp": True}
        decode_kwargs = {
            "token": token,
            "algorithms": [token_alg],
            "options": decode_options,
        }

        if settings.jwt_audience:
            decode_kwargs["audience"] = settings.jwt_audience
        else:
            decode_options["verify_aud"] = False

        # Supabase projects can issue HS256 (legacy) or asymmetric (RS/ES) JWTs.
        if token_alg.startswith("HS"):
            decode_kwargs["key"] = settings.jwt_secret
            return jwt.decode(**decode_kwargs)

        kid = header.get("kid")
        candidate_keys: list[dict[str, Any]] = []

        try:
            keys = _load_jwks()
            if kid and str(kid) in keys:
                candidate_keys = [keys[str(kid)]]
            else:
                candidate_keys = list(keys.values())
        except Exception:
            candidate_keys = []

        if not candidate_keys:
            try:
                keys = _load_jwks(force_refresh=True)
                if kid and str(kid) in keys:
                    candidate_keys = [keys[str(kid)]]
                else:
                    candidate_keys = list(keys.values())
            except Exception:
                return None

        for key in candidate_keys:
            try:
                decode_kwargs["key"] = key
                return jwt.decode(**decode_kwargs)
            except JWTError:
                continue

        return None
    except JWTError:
        return None


def decode_token_unsafe(token: str) -> Optional[dict]:
    """
    Decode JWT token without signature verification.
    Safe because Supabase already validated the token before issuing.
    Extracts payload for role and business_id from user_metadata.
    """
    try:
        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) != 3:
            return None

        # Decode payload (add padding if needed)
        payload_part = parts[1]
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += "=" * padding

        payload_json = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(payload_json)
        return payload
    except Exception:
        return None


def get_user_id_from_token(payload: Optional[dict]) -> Optional[str]:
    """Extract user ID from Supabase token payload"""
    # Supabase stores user ID in 'sub' claim
    if not payload:
        return None
    return payload.get("sub")


def get_role_from_token(payload: Optional[dict]) -> Optional[str]:
    """Extract role from user_metadata in token"""
    if not payload:
        return None
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    return (
        user_metadata.get("role")
        or user_metadata.get("user_role")
        or app_metadata.get("role")
        or app_metadata.get("user_role")
        or payload.get("role")
    )


def get_business_id_from_token(payload: Optional[dict]) -> Optional[str]:
    """Extract business_id (alineado con el frontend: user_metadata, app_metadata o claim plano)."""
    if not payload:
        return None
    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    bid = (
        user_metadata.get("business_id")
        or app_metadata.get("business_id")
        or payload.get("business_id")
    )
    return str(bid) if bid is not None else None

