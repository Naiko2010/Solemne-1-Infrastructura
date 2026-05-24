import httpx
from supabase import create_client, Client
from ..core.config import settings


_supabase_client: Client | None = None
_client_factory = create_client

# Single shared HTTP/1.1 transport — all supabase clients share this connection pool
# so TLS handshakes are reused across requests instead of one per request.
_shared_transport: httpx.HTTPTransport | None = None


def _get_shared_transport() -> httpx.HTTPTransport:
    global _shared_transport
    if _shared_transport is None:
        _shared_transport = httpx.HTTPTransport(
            http2=False,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30),
        )
    return _shared_transport


def _is_placeholder_supabase_key(value: str | None) -> bool:
    """True si el valor sigue siendo el de .env.example (no es una clave real)."""
    if not value or not str(value).strip():
        return True
    v = str(value).strip().lower()
    if v.startswith("your_"):
        return True
    return v in ("changeme", "replace_me")


def _api_key_for_supabase_client() -> str:
    """
    Usa service role solo si está definida y no es placeholder; si no, anon (SUPABASE_KEY).
    Evita create_client(..., 'your_supabase_service_role_key_here') → Invalid API key.
    """
    anon = (settings.supabase_key or "").strip()
    sr = settings.supabase_service_role_key
    if sr and not _is_placeholder_supabase_key(sr):
        return sr.strip()
    return anon


def _using_service_role_key() -> bool:
    sr = settings.supabase_service_role_key
    if not sr or _is_placeholder_supabase_key(sr):
        return False
    return _api_key_for_supabase_client() == sr.strip()


def is_service_role_configured() -> bool:
    """True solo si hay una service role real (no placeholder). Usado para elegir cliente elevado."""
    sr = settings.supabase_service_role_key
    return bool(sr and not _is_placeholder_supabase_key(sr))


def _force_http1(client: Client) -> Client:
    """
    Reemplaza el transporte httpx del cliente postgrest con el pool compartido HTTP/1.1.
    - Evita GOAWAY de Supabase (HTTP/2).
    - Reutiliza conexiones TLS entre peticiones (menor latencia).
    """
    old_session = client.postgrest.session
    old_headers = dict(old_session.headers)
    old_timeout = old_session.timeout
    new_session = httpx.Client(
        headers=old_headers,
        timeout=old_timeout,
        transport=_get_shared_transport(),
    )
    client.postgrest.session = new_session
    return client


def create_request_supabase_client(bearer_token: str | None) -> Client:
    """
    Cliente por petición. Con anon key, debe pasarse el JWT del usuario para que RLS
    vea auth.uid() / claims; con service role no hace falta (RLS omitido).
    """
    api_key = _api_key_for_supabase_client()
    if not settings.supabase_url or not api_key or _is_placeholder_supabase_key(api_key):
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY (anon) are required; "
            "optional SUPABASE_SERVICE_ROLE_KEY when not using .env.example placeholders"
        )

    client = create_client(settings.supabase_url, api_key)
    if not _using_service_role_key() and bearer_token:
        # Fuerza cliente REST: Authorization = JWT del usuario; apikey = anon (Kong/PostgREST).
        client.postgrest.auth(bearer_token)
        sess = client.postgrest.session
        sess.headers["apikey"] = api_key
        sess.headers["Authorization"] = f"Bearer {bearer_token}"
    _force_http1(client)
    return client


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    global _supabase_client, _client_factory

    if _client_factory is not create_client:
        _supabase_client = None
        _client_factory = create_client

    if _supabase_client is not None:
        return _supabase_client

    service_key = _api_key_for_supabase_client()
    if not settings.supabase_url or not service_key or _is_placeholder_supabase_key(
        service_key
    ):
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY (anon) are required; "
            "optional SUPABASE_SERVICE_ROLE_KEY when not using .env.example placeholders"
        )

    _supabase_client = create_client(settings.supabase_url, service_key)
    _force_http1(_supabase_client)
    return _supabase_client


def reset_supabase_client_cache() -> None:
    """Clear cached Supabase client (useful for tests)."""
    global _supabase_client, _client_factory
    _supabase_client = None
    _client_factory = create_client
