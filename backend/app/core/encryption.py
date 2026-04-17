"""
encryption.py — Encriptación simétrica de tokens sensibles.

Usa Fernet (AES-128-CBC + HMAC-SHA256) derivado del SECRET_KEY del .env.
Los tokens se encriptan antes de guardar en DB y se desencriptan solo
en el backend cuando se necesitan para hacer llamadas a APIs externas.

El frontend NUNCA recibe el token completo — solo los últimos 4 chars.
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import get_settings


@lru_cache
def _get_fernet() -> Fernet:
    """
    Deriva una clave Fernet de 32 bytes desde el SECRET_KEY del .env.
    Fernet requiere exactamente 32 bytes en base64url.
    """
    settings = get_settings()
    # SHA-256 del SECRET_KEY → 32 bytes → base64url → clave Fernet válida
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_token(plain_token: str) -> str:
    """
    Encripta un token para guardarlo en la DB.
    Retorna string base64 encriptado.
    """
    if not plain_token:
        return ""
    fernet = _get_fernet()
    encrypted = fernet.encrypt(plain_token.encode())
    return encrypted.decode()


def decrypt_token(encrypted_token: str) -> str:
    """
    Desencripta un token guardado en la DB.
    Solo usar en el backend para llamadas a APIs externas.
    """
    if not encrypted_token:
        return ""
    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(encrypted_token.encode())
        return decrypted.decode()
    except Exception:
        # Si falla la desencriptación (token corrupto o clave cambiada)
        # retornar vacío — el cliente tendrá que reconectar
        return ""


def mask_token(plain_or_encrypted_token: str) -> str:
    """
    Retorna versión enmascarada para mostrar en el frontend.
    Ej: "EAAxxxxxxxxxx..." → "...xxxx"
    Nunca expone el token completo.
    """
    if not plain_or_encrypted_token:
        return ""
    # Intentar desencriptar para obtener los últimos chars del token real
    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(plain_or_encrypted_token.encode()).decode()
        return f"...{decrypted[-4:]}" if len(decrypted) >= 4 else "****"
    except Exception:
        # Si no está encriptado (compatibilidad con tokens viejos en texto plano)
        return f"...{plain_or_encrypted_token[-4:]}" if len(plain_or_encrypted_token) >= 4 else "****"


def is_encrypted(token: str) -> bool:
    """Detecta si un token ya está encriptado (para migración)."""
    try:
        fernet = _get_fernet()
        fernet.decrypt(token.encode())
        return True
    except Exception:
        return False
