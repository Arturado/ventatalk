#!/usr/bin/env python3
"""
dev_simulator.py — Simulador de mensajes WhatsApp para desarrollo local.

Permite probar el flujo completo sin necesitar Meta API real:
  1. Llama al endpoint /webhook como si fuera Meta
  2. Muestra las respuestas de la IA en la terminal
  3. Mantiene sesión (mismo from_number = misma conversación)

Uso:
  # En una terminal:
  docker compose up -d
  
  # En otra terminal:
  cd scripts
  python dev_simulator.py

Requiere que la API esté corriendo en localhost:8000.
"""

import asyncio
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime

import httpx

API_BASE = os.getenv("API_URL", "http://localhost:8000")
META_APP_SECRET = os.getenv("META_APP_SECRET", "test-app-secret")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "test-verify-token")

# Simular un número de teléfono fijo para toda la sesión
FROM_PHONE = "56999000001"
PHONE_NUMBER_ID = os.getenv("WA_TEST_PHONE_NUMBER_ID", "test_phone_number_id_123")


def sign(body: bytes) -> str:
    sig = hmac.new(META_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def build_payload(text: str, msg_id: str) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "entry_sim",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"phone_number_id": PHONE_NUMBER_ID},
                    "contacts": [{"wa_id": FROM_PHONE, "profile": {"name": "Usuario Simulado"}}],
                    "messages": [{
                        "id": msg_id,
                        "from": FROM_PHONE,
                        "type": "text",
                        "text": {"body": text},
                        "timestamp": str(int(time.time())),
                    }],
                },
                "field": "messages",
            }],
        }],
    }


async def send_message(client: httpx.AsyncClient, text: str) -> bool:
    msg_id = f"wamid.sim_{uuid.uuid4().hex[:12]}"
    payload = build_payload(text, msg_id)
    body = json.dumps(payload).encode()

    try:
        res = await client.post(
            f"{API_BASE}/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "x-hub-signature-256": sign(body),
            },
            timeout=10,
        )
        if res.status_code == 200:
            return True
        print(f"  ❌ Error {res.status_code}: {res.text}")
        return False
    except httpx.ConnectError:
        print(f"  ❌ No se puede conectar a {API_BASE}. ¿Está corriendo la API?")
        return False


async def check_health(client: httpx.AsyncClient) -> bool:
    try:
        res = await client.get(f"{API_BASE}/health", timeout=3)
        return res.status_code == 200
    except Exception:
        return False


async def main():
    print("=" * 55)
    print("  VentaBot — Simulador de WhatsApp para desarrollo")
    print("=" * 55)
    print(f"  API: {API_BASE}")
    print(f"  Phone simulado: +{FROM_PHONE}")
    print(f"  Phone Number ID: {PHONE_NUMBER_ID}")
    print()

    async with httpx.AsyncClient() as client:
        # Verificar que la API está disponible
        print("  Verificando API...", end=" ", flush=True)
        if not await check_health(client):
            print("❌")
            print(f"\n  La API no está disponible en {API_BASE}")
            print("  Ejecuta: docker compose up -d")
            return
        print("✅")

        # Verificar webhook
        print("  Verificando webhook...", end=" ", flush=True)
        try:
            res = await client.get(f"{API_BASE}/webhook", params={
                "hub.mode": "subscribe",
                "hub.verify_token": META_VERIFY_TOKEN,
                "hub.challenge": "test_challenge",
            })
            if res.status_code == 200:
                print("✅")
            else:
                print(f"⚠️  {res.status_code} — revisa META_VERIFY_TOKEN en .env")
        except Exception:
            print("❌")

        print()
        print("  Comandos especiales:")
        print("    /exit   — salir")
        print("    /clear  — nueva conversación (nuevo msg_id prefix)")
        print("    /help   — mostrar ayuda")
        print()
        print("  Escribe un mensaje para enviarlo como cliente de WhatsApp:")
        print("-" * 55)

        while True:
            try:
                text = input("\n  Cliente: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\n  Saliendo...")
                break

            if not text:
                continue

            if text == "/exit":
                print("  Saliendo...")
                break
            elif text == "/clear":
                FROM_PHONE_NEW = f"5699{int(time.time()) % 9000000:07d}"
                print(f"  Nueva sesión iniciada. Nuevo número: +{FROM_PHONE_NEW}")
                continue
            elif text == "/help":
                print("  Mensajes de prueba sugeridos:")
                print("    '¿Cuánto cuesta el botox?'")
                print("    '¿Atienden los sábados?'")
                print("    'Quiero agendar una hora'")
                print("    'El precio me parece caro'")
                print("    'Estoy muy molesta con el servicio'  (debería escalar)")
                continue

            print(f"  [{datetime.now().strftime('%H:%M:%S')}] Enviando...", end=" ", flush=True)
            ok = await send_message(client, text)
            if ok:
                print("✅ Mensaje procesado")
                print()
                print("  → Revisa el dashboard en http://localhost:3000/dashboard/conversations")
                print("    para ver la respuesta de la IA.")


if __name__ == "__main__":
    asyncio.run(main())
