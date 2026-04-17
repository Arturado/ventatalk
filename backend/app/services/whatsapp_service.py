"""
WhatsAppService: abstracción sobre Meta Cloud API.

Maneja:
  - Envío de mensajes de texto (dentro de ventana 24h)
  - Envío de templates (fuera de ventana 24h, para follow-ups)
  - Retry automático en errores transientes
"""

import logging
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

META_API_BASE = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}"


class WhatsAppService:
    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.base_url = f"{META_API_BASE}/{phone_number_id}/messages"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def send_text(self, to: str, text: str) -> Optional[str]:
        """
        Envía mensaje de texto. Solo funciona dentro de la ventana de 24h.
        Retorna el wa_message_id o None si falla.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._format_phone(to),
            "type": "text",
            "text": {
                "preview_url": False,
                "body": text,
            },
        }
        return await self._post(payload)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def send_template(
        self,
        to: str,
        template_name: str,
        template_vars: list[str],
        language: str = "es",
    ) -> Optional[str]:
        """
        Envía template aprobado por Meta.
        OBLIGATORIO para mensajes fuera de la ventana de 24h (follow-ups).
        
        Los template_vars reemplazan {{1}}, {{2}}, etc. en el template.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": self._format_phone(to),
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": var}
                            for var in template_vars
                        ],
                    }
                ],
            },
        }
        return await self._post(payload)

    async def send_interactive_buttons(
        self,
        to: str,
        body_text: str,
        buttons: list[dict],  # [{"id": "btn_1", "title": "Sí, me interesa"}]
    ) -> Optional[str]:
        """
        Envía mensaje con botones interactivos (máx 3 botones).
        Muy útil para calificar leads o confirmar follow-ups.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": self._format_phone(to),
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": b["id"], "title": b["title"][:20]}}
                        for b in buttons[:3]  # Meta permite máx 3
                    ]
                },
            },
        }
        return await self._post(payload)

    async def mark_as_read(self, wa_message_id: str) -> bool:
        """Marca mensaje como leído (doble check azul)."""
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": wa_message_id,
        }
        result = await self._post(payload)
        return result is not None

    # ────────────────────────────────────────────────────────────────
    # Helpers
    # ────────────────────────────────────────────────────────────────

    async def _post(self, payload: dict) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=self.headers,
                )

            data = response.json()

            if response.status_code == 200:
                # Extraer message_id del response
                messages = data.get("messages", [])
                if messages:
                    return messages[0].get("id")
                return "sent"

            # Manejo de errores específicos de Meta
            error = data.get("error", {})
            error_code = error.get("code")

            if error_code == 131047:
                # Mensaje fuera de ventana 24h: debe usar template
                logger.warning(f"Ventana 24h expirada para {payload.get('to')}. Usar template.")
            elif error_code == 131056:
                # Número no válido en WhatsApp
                logger.warning(f"Número no registrado en WA: {payload.get('to')}")
            elif error_code in (80007, 4):
                # Rate limit
                logger.error(f"Rate limit de Meta: {error.get('message')}")
                raise httpx.HTTPError("Rate limit reached")
            else:
                logger.error(f"Error Meta API {error_code}: {error.get('message')}")

            return None

        except httpx.TimeoutException:
            logger.error("Timeout enviando mensaje a Meta API")
            raise
        except Exception as e:
            logger.error(f"Error inesperado enviando WA: {e}")
            raise

    @staticmethod
    def _format_phone(phone: str) -> str:
        """
        Meta espera el número sin + y sin espacios.
        Ej: "+56 9 1234 5678" → "56912345678"
        """
        return phone.replace("+", "").replace(" ", "").replace("-", "")
