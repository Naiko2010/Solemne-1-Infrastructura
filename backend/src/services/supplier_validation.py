"""Validación de RUT chileno y datos de contacto para proveedores (HU-86)."""

from __future__ import annotations

import re

from email_validator import EmailNotValidError, validate_email


def _clean_rut_input(value: str) -> str:
    s = (value or "").strip().upper()
    s = s.replace(".", "").replace("-", "")
    return s


def format_chile_rut_for_storage(rut_clean: str) -> str:
    """Devuelve RUT con puntos y guión: 12.345.678-5."""
    if len(rut_clean) < 2:
        raise ValueError("RUT inválido")
    body, dv = rut_clean[:-1], rut_clean[-1]
    if not body.isdigit():
        raise ValueError("RUT inválido")
    i = len(body)
    parts: list[str] = []
    while i > 0:
        start = max(0, i - 3)
        parts.insert(0, body[start:i])
        i = start
    return f'{ ".".join(parts)}-{dv}'


def validate_chile_rut(rut: str) -> str:
    """
    Valida dígito verificador del RUT chileno y devuelve forma canónica con puntos.
    Acepta entradas con o sin puntos/guion.
    """
    raw = _clean_rut_input(rut)
    if len(raw) < 2:
        raise ValueError("RUT inválido")

    body, dv_char = raw[:-1], raw[-1]
    if not body.isdigit() or len(body) < 7:
        raise ValueError("RUT inválido")
    if dv_char not in "0123456789K":
        raise ValueError("RUT inválido")

    factors = [2, 3, 4, 5, 6, 7]
    total = 0
    for i, ch in enumerate(reversed(body)):
        total += int(ch) * factors[i % 6]
    rest = 11 - (total % 11)
    if rest == 11:
        expected = "0"
    elif rest == 10:
        expected = "K"
    else:
        expected = str(rest)

    if dv_char != expected:
        raise ValueError("RUT inválido (dígito verificador)")

    return format_chile_rut_for_storage(raw)


def validate_chile_phone(phone: str) -> str:
    """Solo dígitos; entre 8 y 15 (incl. código país si se ingresa)."""
    cleaned = (phone or "").strip()
    if not cleaned:
        raise ValueError("El teléfono es obligatorio")
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) < 8 or len(digits) > 15:
        raise ValueError("Teléfono inválido")
    return digits


def non_empty_str(value: str | None, label: str) -> str:
    s = (value or "").strip()
    if not s:
        raise ValueError(f"{label} es obligatorio")
    return s


def validate_email_normalized(email: str) -> str:
    try:
        info = validate_email((email or "").strip(), check_deliverability=False)
        return info.normalized.lower()
    except EmailNotValidError:
        raise ValueError("Email inválido") from None
