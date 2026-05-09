"""
Catálogo de productos: upload CSV → genera embeddings → guarda en pgvector.
"""

import csv
import io
import logging
import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_business
from app.core.plan_limits import (
    conversations_this_month, catalog_items_count, days_until_reset,
)
from app.models.models import Business, CatalogItem, Order, PhoneNumber
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/business", tags=["business"])

VALID_SOURCES = {"csv", "jumpseller", "bsale", "shopify", "woocommerce"}


@router.get("/usage")
async def get_usage(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Uso actual del plan: conversaciones, canales y catálogo."""
    conv_count = await conversations_this_month(db, business.id)

    channels_result = await db.execute(
        select(func.count()).select_from(PhoneNumber)
        .where(PhoneNumber.business_id == business.id, PhoneNumber.is_active == True)
    )
    channels_used = channels_result.scalar() or 0

    cat_count = await catalog_items_count(db, business.id)

    conv_limit = business.max_conversations_per_month
    conv_pct = round(conv_count / conv_limit * 100) if conv_limit > 0 and conv_limit != -1 else 0

    plan_value = business.plan.value if hasattr(business.plan, "value") else str(business.plan)

    return {
        "plan": plan_value,
        "conversations_this_month": conv_count,
        "conversations_limit": conv_limit,
        "conversations_pct": conv_pct,
        "channels_used": channels_used,
        "channels_limit": business.max_phone_numbers,
        "catalog_items": cat_count,
        "catalog_limit": business.max_catalog_items,
        "days_until_reset": days_until_reset(),
    }


class CatalogItemOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: Optional[float]
    category: Optional[str]
    is_available: bool
    source: Optional[str]
    image_url: Optional[str] = None
    stock_quantity: Optional[int] = None
    sku: Optional[str] = None


# ── Selector de fuente ────────────────────────────────────────────────

@router.get("/catalog/source")
async def get_catalog_source(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Retorna la fuente activa actual y el conteo por fuente."""
    result = await db.execute(
        select(CatalogItem.source, CatalogItem.is_available)
        .where(CatalogItem.business_id == business.id)
    )
    rows = result.fetchall()

    counts: dict[str, int] = {}
    for row in rows:
        src = row.source or "csv"
        counts[src] = counts.get(src, 0) + 1

    active_source = (business.integrations or {}).get("active_catalog_source", "csv")

    return {
        "active_source": active_source,
        "counts": counts,
        "total": len(rows),
    }


@router.post("/catalog/source")
async def set_catalog_source(
    data: dict,
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Cambia la fuente activa del catálogo.
    Elimina los productos de todas las fuentes anteriores.

    Body: {"source": "jumpseller" | "bsale" | "csv"}
    """
    new_source = data.get("source", "").lower()
    if new_source not in VALID_SOURCES:
        raise HTTPException(400, f"Fuente inválida. Opciones: {', '.join(VALID_SOURCES)}")

    current_source = (business.integrations or {}).get("active_catalog_source", "csv")

    if new_source == current_source:
        return {"message": f"Ya estás usando {new_source}", "active_source": new_source}

    # Contar productos de otras fuentes que se van a eliminar
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.business_id == business.id,
            CatalogItem.source != new_source,
        )
    )
    to_delete = result.scalars().all()
    deleted_count = len(to_delete)

    # Eliminar productos de fuentes anteriores
    for item in to_delete:
        await db.delete(item)

    # Actualizar fuente activa en el negocio
    if not business.integrations:
        business.integrations = {}
    business.integrations["active_catalog_source"] = new_source

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(business, "integrations")

    await db.commit()

    logger.info(
        f"Business {business.id}: fuente cambiada {current_source} → {new_source}, "
        f"{deleted_count} productos eliminados"
    )

    return {
        "active_source": new_source,
        "previous_source": current_source,
        "deleted_products": deleted_count,
        "message": f"Fuente cambiada a {new_source}. {deleted_count} productos de '{current_source}' eliminados.",
    }


@router.delete("/catalog/source/{source_name}", status_code=200)
async def delete_catalog_source(
    source_name: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Elimina todos los productos de una fuente y limpia su configuración en integrations."""
    if source_name not in VALID_SOURCES:
        raise HTTPException(400, f"Fuente inválida. Opciones: {', '.join(VALID_SOURCES)}")

    result = await db.execute(
        delete(CatalogItem).where(
            CatalogItem.business_id == business.id,
            CatalogItem.source == source_name,
        )
    )
    deleted = result.rowcount

    integrations = dict(business.integrations or {})
    changed = False
    if source_name in integrations:
        del integrations[source_name]
        changed = True
    if integrations.get("active_catalog_source") == source_name:
        del integrations["active_catalog_source"]
        changed = True

    if changed:
        business.integrations = integrations
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(business, "integrations")

    await db.commit()

    logger.info(f"Business {business.id}: {deleted} productos de '{source_name}' eliminados")
    return {"deleted": deleted, "source": source_name}


@router.post("/catalog", status_code=201)
async def upload_catalog(
    file: UploadFile = File(...),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Sube catálogo en CSV.
    Automáticamente limpia productos de otras fuentes y establece CSV como fuente activa.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Solo se aceptan archivos CSV")

    content = await file.read()
    text_content = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text_content))

    if "name" not in (reader.fieldnames or []):
        raise HTTPException(400, "El CSV debe tener columna 'name'")

    rows_list = list(reader)
    valid_count = sum(1 for row in rows_list if row.get("name", "").strip())
    if business.max_catalog_items != -1 and valid_count > business.max_catalog_items:
        raise HTTPException(
            403,
            f"Tu plan permite máximo {business.max_catalog_items} productos en el catálogo. "
            f"Tu archivo tiene {valid_count} productos válidos. "
            "Actualiza tu plan para subir catálogos más grandes."
        )

    # Limpiar productos de otras fuentes al subir CSV
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.business_id == business.id,
            CatalogItem.source != "csv",
        )
    )
    for item in result.scalars().all():
        await db.delete(item)

    # También limpiar CSV anteriores para reemplazar limpio
    await db.execute(
        delete(CatalogItem).where(
            CatalogItem.business_id == business.id,
            CatalogItem.source == "csv",
        )
    )

    # Marcar CSV como fuente activa
    if not business.integrations:
        business.integrations = {}
    business.integrations["active_catalog_source"] = "csv"
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(business, "integrations")

    items_created = 0
    errors = []

    for i, row in enumerate(rows_list):
        name = row.get("name", "").strip()
        if not name:
            continue

        description = row.get("description", "").strip() or None
        category = row.get("category", "").strip() or None
        price_str = row.get("price", "").strip()

        try:
            price = float(price_str.replace(".", "").replace(",", ".")) if price_str else None
        except ValueError:
            price = None

        embed_text = f"{name}. {description or ''} {category or ''}".strip()

        try:
            embedding = await AIService.generate_embedding(embed_text)
        except Exception as e:
            logger.warning(f"Error generando embedding para '{name}': {e}")
            embedding = None
            errors.append(f"Fila {i+2}: embedding fallido para '{name}'")

        item = CatalogItem(
            business_id=business.id,
            name=name,
            description=description,
            price=price,
            category=category,
            embedding=embedding,
            source="csv",
        )
        db.add(item)
        items_created += 1

    await db.commit()

    return {
        "active_source": "csv",
        "items_created": items_created,
        "warnings": errors,
        "message": f"{items_created} productos cargados desde CSV",
    }



@router.get("/catalog", response_model=list[CatalogItemOut])
async def get_catalog(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CatalogItem)
        .where(CatalogItem.business_id == business.id)
        .order_by(CatalogItem.source, CatalogItem.name)
    )
    items = result.scalars().all()
    return [
        CatalogItemOut(
            id=str(item.id),
            name=item.name,
            description=item.description,
            price=item.price,
            category=item.category,
            is_available=item.is_available,
            source=item.source,
            image_url=(item.metadata_ or {}).get("image_url"),
            stock_quantity=(item.metadata_ or {}).get("stock_quantity"),
            sku=(item.metadata_ or {}).get("sku"),
        )
        for item in items
    ]


@router.patch("/catalog/{item_id}/toggle", status_code=200)
async def toggle_catalog_item(
    item_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Activa/desactiva un producto del catálogo para la IA."""
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.id == item_id,
            CatalogItem.business_id == business.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Producto no encontrado")
    item.is_available = not item.is_available
    await db.commit()
    return {"id": str(item.id), "is_available": item.is_available}


@router.post("/catalog/bulk-toggle", status_code=200)
async def bulk_toggle_catalog(
    data: dict,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Activa/desactiva múltiples productos de una vez.
    Body: {"ids": ["uuid1", "uuid2"], "is_available": true}
    """
    ids = data.get("ids", [])
    is_available = data.get("is_available", True)
    if not ids:
        raise HTTPException(400, "ids requerido")

    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.id.in_(ids),
            CatalogItem.business_id == business.id,
        )
    )
    items = result.scalars().all()
    for item in items:
        item.is_available = is_available
    await db.commit()
    return {"updated": len(items), "is_available": is_available}


@router.delete("/catalog/{item_id}", status_code=204)
async def delete_catalog_item(
    item_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.id == item_id,
            CatalogItem.business_id == business.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Producto no encontrado")
    await db.delete(item)


@router.post("/catalog/reindex", status_code=200)
async def reindex_catalog(
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Regenera embeddings para todos los productos que no los tienen.
    Útil para productos de WooCommerce importados antes de que se generaran embeddings.
    """
    result = await db.execute(
        select(CatalogItem).where(
            CatalogItem.business_id == business.id,
            CatalogItem.embedding.is_(None),
            CatalogItem.is_available == True,
        )
    )
    pending = result.scalars().all()

    if not pending:
        return {"message": "Todos los productos ya tienen embeddings.", "pending": 0}

    background_tasks.add_task(_reindex_items, [str(item.id) for item in pending])
    return {
        "message": f"Regenerando embeddings para {len(pending)} productos en background.",
        "pending": len(pending),
    }


async def _reindex_items(item_ids: list[str]):
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(CatalogItem).where(CatalogItem.id.in_(item_ids))
            )
            items = result.scalars().all()
            for item in items:
                embed_text = f"{item.name}. {item.description or ''} {item.category or ''}".strip()
                try:
                    item.embedding = await AIService.generate_embedding(embed_text)
                except Exception as e:
                    logger.warning(f"Error reindex embedding '{item.name}': {e}")
            await db.commit()
            logger.info(f"Reindex OK: {len(items)} productos actualizados")
        except Exception as e:
            logger.error(f"Error en reindex: {e}", exc_info=True)


class OrderOut(BaseModel):
    id: str
    order_number: str
    status: str
    total: Optional[float] = None
    currency: str
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    items: Optional[list] = None
    ordered_at: Optional[datetime] = None
    source: str


@router.get("/orders")
async def get_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    payment_method: str = Query(""),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Order.business_id == business.id]

    if search:
        conditions.append(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.customer_name.ilike(f"%{search}%"),
                Order.customer_email.ilike(f"%{search}%"),
            )
        )
    if status:
        conditions.append(Order.status == status)
    if payment_method:
        conditions.append(Order.payment_method.ilike(f"%{payment_method}%"))

    count_result = await db.execute(
        select(func.count()).select_from(Order).where(*conditions)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Order)
        .where(*conditions)
        .order_by(func.coalesce(Order.ordered_at, Order.created_at).desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    orders = result.scalars().all()

    return {
        "orders": [
            OrderOut(
                id=str(o.id),
                order_number=o.order_number,
                status=o.status,
                total=o.total,
                currency=o.currency,
                payment_method=o.payment_method,
                customer_name=o.customer_name,
                customer_email=o.customer_email,
                customer_phone=o.customer_phone,
                items=o.items if isinstance(o.items, list) else [],
                ordered_at=o.ordered_at,
                source=o.source,
            )
            for o in orders
        ],
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.put("/profile")
async def update_profile(
    data: dict,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"name", "ai_tone", "ai_instructions", "ai_enabled"}
    for key, value in data.items():
        if key in allowed:
            setattr(business, key, value)
    await db.commit()
    return {"message": "Perfil actualizado"}
