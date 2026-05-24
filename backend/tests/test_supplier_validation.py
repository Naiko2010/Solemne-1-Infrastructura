import pytest

from src.services.supplier_validation import (
    validate_chile_phone,
    validate_chile_rut,
    validate_email_normalized,
)


def test_validate_chile_rut_accepts_with_dots():
    out = validate_chile_rut("12.345.678-5")
    assert out == "12.345.678-5"


def test_validate_chile_rut_accepts_without_formatting():
    out = validate_chile_rut("123456785")
    assert out == "12.345.678-5"


def test_validate_chile_rut_rejects_bad_dv():
    with pytest.raises(ValueError, match="dígito verificador"):
        validate_chile_rut("12.345.678-0")


def test_validate_chile_phone_digits():
    assert validate_chile_phone("+56 9 1234 5678") == "56912345678"


def test_validate_chile_phone_too_short():
    with pytest.raises(ValueError, match="Teléfono"):
        validate_chile_phone("123")


def test_validate_email_normalized():
    assert validate_email_normalized(" Test@Example.com ") == "test@example.com"


def test_validate_email_invalid():
    with pytest.raises(ValueError, match="Email"):
        validate_email_normalized("not-an-email")
