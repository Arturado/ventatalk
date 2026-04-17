"""
AIService: el cerebro de VentaBot.

Pasos:
  1. Clasificar intención del mensaje (JSON mode, GPT-4o-mini)
  2. RAG: buscar productos relevantes en pgvector
  3. Construir prompt con contexto
  4. Generar respuesta
  5. Detectar si debe escalar a humano
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import (
    Business, CatalogItem, Conversation, Message,
    MessageIntent, MessageRole,
)

logger = logging.getLogger(__name__)
settings = get_settings()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Costo estimado GPT-4o-mini (USD por 1M tokens)
COST_INPUT_PER_M = 0.15
COST_OUTPUT_PER_M = 0.60
EMBEDDING_COST_PER_M = 0.02


@dataclass
class AIResult:
    response_text: str
    intent: MessageIntent
    should_escalate: bool
    tokens_used: int
    cost_usd: float


class AIService:
    def __init__(self, db: AsyncSession, business: Business):
        self.db = db
        self.business = business

    async def process(self, user_text: str, conversation: Conversation) -> AIResult:
        # 1. Clasificar intención
        intent = await self._classify_intent(user_text)

        # 2. RAG: recuperar catálogo relevante
        catalog_context = await self._retrieve_catalog(user_text, top_k=5)

        # 3. Historial de conversación (últimos 10 mensajes)
        history = await self._get_history(conversation.id, limit=10)

        # 4. Detectar si el bot ha fallado varias veces seguidas (→ escalar)
        consecutive_failures = self._count_consecutive_failures(history)
        force_escalate = consecutive_failures >= 2

        # 5. Generar respuesta
        response, tokens_in, tokens_out, should_escalate = await self._generate_response(
            user_text=user_text,
            intent=intent,
            catalog_context=catalog_context,
            history=history,
            force_escalate=force_escalate,
        )

        # Calcular costo
        cost = (tokens_in * COST_INPUT_PER_M + tokens_out * COST_OUTPUT_PER_M) / 1_000_000

        return AIResult(
            response_text=response,
            intent=intent,
            should_escalate=should_escalate,
            tokens_used=tokens_in + tokens_out,
            cost_usd=cost,
        )

    # ────────────────────────────────────────────────────────────────
    # 1. Clasificación de intención
    # ────────────────────────────────────────────────────────────────

    async def _classify_intent(self, user_text: str) -> MessageIntent:
        """
        Llamada liviana a GPT-4o-mini en modo JSON.
        Muy rápido y barato: ~100 tokens totales.
        """
        try:
            response = await client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Clasifica la intención del mensaje del cliente. "
                            "Responde SOLO con JSON: "
                            '{"intent": "<valor>"} '
                            "Valores posibles: quote_request, purchase, objection, "
                            "complaint, scheduling, general_info, other"
                        ),
                    },
                    {"role": "user", "content": user_text},
                ],
                max_tokens=50,
            )
            data = json.loads(response.choices[0].message.content)
            return MessageIntent(data.get("intent", "other"))
        except Exception as e:
            logger.warning(f"Error clasificando intención: {e}")
            return MessageIntent.OTHER

    # ────────────────────────────────────────────────────────────────
    # 2. RAG con pgvector
    # ────────────────────────────────────────────────────────────────

    async def _retrieve_catalog(self, query: str, top_k: int = 5) -> str:
        """
        1. Intenta búsqueda semántica con pgvector (productos con embedding).
        2. Si no hay embeddings disponibles, hace fallback con búsqueda textual.
        3. Devuelve texto formateado para incluir en el prompt.
        """
        try:
            # Búsqueda semántica (productos con embedding)
            embed_response = await client.embeddings.create(
                model=settings.OPENAI_EMBEDDING_MODEL,
                input=query,
            )
            query_embedding = embed_response.data[0].embedding

            result = await self.db.execute(
                text("""
                    SELECT name, description, price, category
                    FROM catalog_items
                    WHERE business_id = :business_id
                      AND is_available = true
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> CAST(:embedding AS vector)
                    LIMIT :limit
                """),
                {
                    "business_id": str(self.business.id),
                    "embedding": str(query_embedding),
                    "limit": top_k,
                },
            )
            items = result.fetchall()

            # Fallback: si no hay embeddings, búsqueda textual simple
            if not items:
                result = await self.db.execute(
                    text("""
                        SELECT name, description, price, category
                        FROM catalog_items
                        WHERE business_id = :business_id
                          AND is_available = true
                        ORDER BY name
                        LIMIT :limit
                    """),
                    {"business_id": str(self.business.id), "limit": top_k},
                )
                items = result.fetchall()

            if not items:
                return "CATÁLOGO: vacío — no hay productos cargados."

            lines = ["PRODUCTOS EN EL CATÁLOGO (usa solo estos para responder precios y disponibilidad):"]
            for item in items:
                price_str = f"${item.price:,.0f} CLP" if item.price else "precio a consultar"
                desc = f" — {item.description}" if item.description else ""
                lines.append(f"• {item.name}{desc}: {price_str}")

            return "\n".join(lines)

        except Exception as e:
            logger.error(f"Error en RAG: {e}")
            return ""

    # ────────────────────────────────────────────────────────────────
    # 3. Historial de conversación
    # ────────────────────────────────────────────────────────────────

    async def _get_history(self, conversation_id, limit: int = 10) -> list[dict]:
        result = await self.db.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.role.in_([MessageRole.USER, MessageRole.ASSISTANT]),
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()
        # Revertir para orden cronológico
        return [
            {"role": m.role.value, "content": m.content}
            for m in reversed(messages)
            if m.content
        ]

    # ────────────────────────────────────────────────────────────────
    # 3b. Detección de fallos consecutivos (para escalar a humano)
    # ────────────────────────────────────────────────────────────────

    def _count_consecutive_failures(self, history: list[dict]) -> int:
        """
        Cuenta cuántas respuestas recientes del bot indican que no pudo ayudar.
        Si en los últimos mensajes el bot repite frases de incertidumbre, es señal
        de que debe derivar a un humano.
        """
        FAILURE_SIGNALS = [
            "lo consulto",
            "te confirmo",
            "no tengo esa información",
            "no cuento con",
            "no está disponible en nuestro catálogo",
            "no lo tenemos",
            "no tenemos ese",
        ]
        count = 0
        # Revisar últimas 4 respuestas del bot (orden inverso)
        bot_messages = [m for m in reversed(history) if m["role"] == "assistant"][:4]
        for msg in bot_messages:
            content_lower = (msg.get("content") or "").lower()
            if any(signal in content_lower for signal in FAILURE_SIGNALS):
                count += 1
            else:
                break  # solo cuenta fallos CONSECUTIVOS desde el más reciente
        return count

    # ────────────────────────────────────────────────────────────────
    # 4. Generación de respuesta
    # ────────────────────────────────────────────────────────────────

    async def _generate_response(
        self,
        user_text: str,
        intent: MessageIntent,
        catalog_context: str,
        history: list[dict],
        force_escalate: bool = False,
    ) -> tuple[str, int, int, bool]:
        """
        Genera la respuesta final y detecta si debe escalar.
        Retorna: (texto, tokens_in, tokens_out, should_escalate)
        """
        system_prompt = self._build_system_prompt(catalog_context, intent, force_escalate)

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_text})

        try:
            response = await client.chat.completions.create(
                model=settings.OPENAI_CHAT_MODEL,
                temperature=settings.OPENAI_CHAT_TEMPERATURE,
                messages=messages,
                max_tokens=500,
            )
            content = response.choices[0].message.content.strip()
            tokens_in = response.usage.prompt_tokens
            tokens_out = response.usage.completion_tokens

            # Detectar flag de escalada
            should_escalate = "[ESCALAR]" in content
            clean_content = content.replace("[ESCALAR]", "").strip()

            return clean_content, tokens_in, tokens_out, should_escalate

        except Exception as e:
            logger.error(f"Error generando respuesta IA: {e}")
            return (
                "Lo siento, en este momento no puedo responderte. "
                "Un agente te contactará pronto.",
                0, 0, True
            )

    def _build_system_prompt(
        self, catalog_context: str, intent: MessageIntent, force_escalate: bool = False
    ) -> str:
        tone_instructions = {
            "amigable": "Usa un tono cálido, cercano y positivo. Tutéa al cliente.",
            "formal": "Usa un tono profesional y respetuoso. Trata de usted.",
            "técnico": "Sé preciso y técnico. El cliente sabe del tema.",
        }
        tone = tone_instructions.get(self.business.ai_tone, tone_instructions["amigable"])

        intent_instructions = {
            MessageIntent.QUOTE_REQUEST: "El cliente está pidiendo cotización. Dale precio directo del catálogo y propón siguiente paso concreto.",
            MessageIntent.OBJECTION: "El cliente tiene dudas. Resuelve la objeción con empatía y datos concretos del catálogo.",
            MessageIntent.COMPLAINT: "El cliente está molesto. Empatiza primero, luego ofrece solución. Si no tienes solución, incluye [ESCALAR].",
            MessageIntent.PURCHASE: "El cliente quiere comprar. Confirma que el producto está en el catálogo y lleva al cierre.",
            MessageIntent.SCHEDULING: "El cliente quiere agendar. Ofrece horarios o pide que confirme disponibilidad.",
        }.get(intent, "Responde de forma útil y enfocada en avanzar la conversación.")

        extra = f"\nINSTRUCCIONES ADICIONALES DEL NEGOCIO:\n{self.business.ai_instructions}" \
            if self.business.ai_instructions else ""

        escalate_rule = (
            "- El cliente ha preguntado varias veces y no has podido ayudarle. "
            "DEBES comenzar tu respuesta con [ESCALAR] e indicar al cliente que un agente humano le atenderá pronto."
            if force_escalate else
            "- Si detectas frustración extrema o reclamo grave que no puedes resolver, incluye [ESCALAR] al inicio de tu respuesta."
        )

        return f"""Eres el asistente de ventas de {self.business.name}.
Tu objetivo es CERRAR VENTAS usando SOLO los productos del catálogo.

TONO: {tone}

INTENCIÓN DETECTADA: {intent_instructions}

REGLAS ABSOLUTAS:
- Nunca inventes precios ni productos. SOLO usa los del catálogo de abajo.
- Si el cliente pregunta por un producto que NO está en el catálogo, díselo claramente: "ese producto no lo manejamos actualmente" y ofrece la alternativa más cercana del catálogo.
- NO digas "lo consulto" ni "te confirmo" — si está en el catálogo, respóndelo directamente; si no está, dilo.
- {escalate_rule}
- Responde en máximo 3–4 oraciones. Claro, directo y útil.
- Siempre termina con una pregunta o acción concreta para el cliente.

{catalog_context}
{extra}"""

    # ────────────────────────────────────────────────────────────────
    # Embedding de catálogo (llamado desde el endpoint de upload)
    # ────────────────────────────────────────────────────────────────

    @staticmethod
    async def generate_embedding(text: str) -> list[float]:
        """Genera embedding para un item del catálogo."""
        response = await client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding
