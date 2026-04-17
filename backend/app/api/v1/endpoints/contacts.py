from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_business
from app.models.models import Business, Contact, Lead, LeadStage

router = APIRouter(tags=["contacts"])


# ────────────────────────────────────────────────────────────────────
# CONTACTS
# ────────────────────────────────────────────────────────────────────

class ContactOut(BaseModel):
    id: str
    wa_phone: str
    name: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    tags: list
    last_seen_at: Optional[str]
    created_at: str
    lead_stage: Optional[str]
    lead_id: Optional[str]
    lead_estimated_value: Optional[float]


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list] = None


contacts_router = APIRouter(prefix="/contacts", tags=["contacts"])


@contacts_router.get("", response_model=list[ContactOut])
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: Optional[str] = Query(None),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Contact)
        .where(Contact.business_id == business.id)
        .options(selectinload(Contact.lead))
        .order_by(Contact.last_seen_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if search:
        q = q.where(
            Contact.name.ilike(f"%{search}%") | Contact.wa_phone.contains(search)
        )
    result = await db.execute(q)
    contacts = result.scalars().all()
    return [_contact_out(c) for c in contacts]


@contacts_router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    contact_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact)
        .where(Contact.id == contact_id, Contact.business_id == business.id)
        .options(selectinload(Contact.lead))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contacto no encontrado")
    return _contact_out(c)


@contacts_router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: UUID,
    body: ContactUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact)
        .where(Contact.id == contact_id, Contact.business_id == business.id)
        .options(selectinload(Contact.lead))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    await db.commit()
    await db.refresh(c)
    return _contact_out(c)


@contacts_router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """GDPR/Ley 19.628: elimina contacto y todo su historial (cascade)."""
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.business_id == business.id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    await db.delete(c)


def _contact_out(c: Contact) -> ContactOut:
    return ContactOut(
        id=str(c.id),
        wa_phone=c.wa_phone,
        name=c.name,
        email=c.email,
        notes=c.notes,
        tags=c.tags or [],
        last_seen_at=c.last_seen_at.isoformat() if c.last_seen_at else None,
        created_at=c.created_at.isoformat(),
        lead_stage=c.lead.stage.value if c.lead else None,
        lead_id=str(c.lead.id) if c.lead else None,
        lead_estimated_value=c.lead.estimated_value if c.lead else None,
    )


# ────────────────────────────────────────────────────────────────────
# LEADS
# ────────────────────────────────────────────────────────────────────

class LeadOut(BaseModel):
    id: str
    contact_id: str
    contact_name: Optional[str]
    contact_phone: str
    stage: str
    estimated_value: Optional[float]
    notes: Optional[str]
    created_at: str


class LeadStageUpdate(BaseModel):
    stage: str
    notes: Optional[str] = None
    estimated_value: Optional[float] = None


class LeadCreate(BaseModel):
    contact_id: str


leads_router = APIRouter(prefix="/leads", tags=["leads"])


@leads_router.post("", response_model=LeadOut, status_code=201)
async def create_lead(
    body: LeadCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID as _UUID
    contact_result = await db.execute(
        select(Contact)
        .where(Contact.id == _UUID(body.contact_id), Contact.business_id == business.id)
        .options(selectinload(Contact.lead))
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contacto no encontrado")
    if contact.lead:
        return _lead_out(contact.lead)
    lead = Lead(
        contact_id=contact.id,
        business_id=business.id,
        stage=LeadStage.NEW,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead, ["contact"])
    return _lead_out(lead)


@leads_router.get("", response_model=list[LeadOut])
async def list_leads(
    stage: Optional[str] = Query(None),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Lead)
        .where(Lead.business_id == business.id)
        .options(selectinload(Lead.contact))
        .order_by(Lead.updated_at.desc())
    )
    if stage:
        q = q.where(Lead.stage == stage)
    result = await db.execute(q)
    leads = result.scalars().all()
    return [_lead_out(l) for l in leads]


@leads_router.put("/{lead_id}/stage")
async def update_lead_stage(
    lead_id: UUID,
    body: LeadStageUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead)
        .where(Lead.id == lead_id, Lead.business_id == business.id)
        .options(selectinload(Lead.contact))
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead no encontrado")
    try:
        lead.stage = LeadStage(body.stage)
    except ValueError:
        raise HTTPException(400, f"Stage inválido: {body.stage}")
    if body.notes:
        lead.notes = body.notes
    if body.estimated_value is not None:
        lead.estimated_value = body.estimated_value
    return _lead_out(lead)


def _lead_out(l: Lead) -> LeadOut:
    return LeadOut(
        id=str(l.id),
        contact_id=str(l.contact_id),
        contact_name=l.contact.name if l.contact else None,
        contact_phone=l.contact.wa_phone if l.contact else "",
        stage=l.stage.value,
        estimated_value=l.estimated_value,
        notes=l.notes,
        created_at=l.created_at.isoformat(),
    )
