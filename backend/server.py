from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import secrets
import asyncio
import jwt
import bcrypt
import requests as ext_requests
import resend
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form, Header, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
import io

# ----- DB -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ----- App -----
app = FastAPI(title="Construccion CRM API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "construcrm")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ----- Object Storage -----
_storage_key = None

def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY not set — storage disabled")
        return None
    try:
        resp = ext_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Almacenamiento no disponible")
    resp = ext_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        return put_object(path, data, content_type)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Almacenamiento no disponible")
    resp = ext_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        return get_object(path)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ----- Email -----
async def send_email_safe(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning(f"[EMAIL DISABLED] Would send to={to} subject={subject}")
        return False
    try:
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False

# ----- Auth utils -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str, company_id: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role, "company_id": company_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def require_roles(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Permiso denegado")
        return user
    return checker

# ----- Models -----
Role = Literal["admin", "vendedor", "supervisor"]

class CompanyRegister(BaseModel):
    company_name: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "vendedor"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotPwd(BaseModel):
    email: EmailStr

class ResetPwd(BaseModel):
    token: str
    new_password: str

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    stage: Literal["lead", "contactado", "propuesta", "negociacion", "ganado", "perdido"] = "lead"
    notes: Optional[str] = ""
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ClientIn(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    stage: Optional[str] = "lead"
    notes: Optional[str] = ""

class ProjectStage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: str
    end_date: str
    progress: int = 0
    color: Optional[str] = "#FF4500"

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    address: Optional[str] = None
    status: Literal["planificacion", "en_progreso", "pausada", "completada", "cancelada"] = "planificacion"
    progress: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: float = 0.0
    supervisor_id: Optional[str] = None
    description: Optional[str] = ""
    stages: List[ProjectStage] = []
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProjectIn(BaseModel):
    name: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = "planificacion"
    progress: Optional[int] = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = 0.0
    supervisor_id: Optional[str] = None
    description: Optional[str] = ""
    stages: Optional[List[ProjectStage]] = []

class QuoteItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    unit: Optional[str] = "und"

class Quote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    project_id: Optional[str] = None
    items: List[QuoteItem] = []
    tax_rate: float = 16.0
    status: Literal["borrador", "enviada", "aceptada", "rechazada"] = "borrador"
    subtotal: float = 0
    tax: float = 0
    total: float = 0
    notes: Optional[str] = ""
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuoteIn(BaseModel):
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    project_id: Optional[str] = None
    items: List[QuoteItem] = []
    tax_rate: float = 16.0
    status: Optional[str] = "borrador"
    notes: Optional[str] = ""

class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: Literal["proveedor", "contratista"] = "proveedor"
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    rating: int = 0
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SupplierIn(BaseModel):
    name: str
    type: Optional[str] = "proveedor"
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    rating: Optional[int] = 0

class Material(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    category: Optional[str] = "general"
    unit: str = "und"
    stock: float = 0
    min_stock: float = 0
    unit_cost: float = 0
    supplier_id: Optional[str] = None
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MaterialIn(BaseModel):
    sku: str
    name: str
    category: Optional[str] = "general"
    unit: Optional[str] = "und"
    stock: Optional[float] = 0
    min_stock: Optional[float] = 0
    unit_cost: Optional[float] = 0
    supplier_id: Optional[str] = None

class RequisitionItem(BaseModel):
    material_id: str
    material_name: str
    quantity: float
    unit: str = "und"
    notes: Optional[str] = ""

class Requisition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    requested_by: Optional[str] = None
    requested_by_name: Optional[str] = None
    requested_by_email: Optional[str] = None
    items: List[RequisitionItem] = []
    status: Literal["pendiente", "aprobada", "rechazada", "entregada"] = "pendiente"
    needed_by: Optional[str] = None
    notes: Optional[str] = ""
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class RequisitionIn(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    items: List[RequisitionItem] = []
    needed_by: Optional[str] = None
    notes: Optional[str] = ""

class CalendarEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    date: str
    type: Literal["visita", "reunion", "entrega", "inspeccion", "otro"] = "reunion"
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    company_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EventIn(BaseModel):
    title: str
    description: Optional[str] = ""
    date: str
    type: Optional[str] = "reunion"
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None

# ----- AUTH ENDPOINTS -----
@api_router.post("/auth/register-company")
async def register_company(body: CompanyRegister, response: Response):
    """Public endpoint: creates a new company + admin user."""
    email = body.admin_email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email ya registrado")
    company_id = str(uuid.uuid4())
    await db.companies.insert_one({
        "id": company_id,
        "name": body.company_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "name": body.admin_name,
        "email": email,
        "password_hash": hash_password(body.admin_password),
        "role": "admin",
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = create_access_token(user_id, email, "admin", company_id)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {"id": user_id, "name": body.admin_name, "email": email, "role": "admin", "company_id": company_id, "token": token}

@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(user["id"], user["email"], user["role"], user.get("company_id", ""))
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    return {
        "id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"],
        "company_id": user.get("company_id", ""), "token": token,
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPwd):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return ok (don't leak existence)
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
            "created_at": datetime.now(timezone.utc),
        })
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #09090B; color: white; padding: 20px;">
            <h1 style="margin: 0; text-transform: uppercase;">ConstruCRM</h1>
          </div>
          <div style="padding: 30px; border: 2px solid #09090B; border-top: 0;">
            <h2>Recuperar contraseña</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>Haz click en el siguiente enlace (válido por 1 hora):</p>
            <p><a href="{reset_link}" style="display:inline-block; background:#FF4500; color:white; padding:12px 24px; text-decoration:none; font-weight:bold; text-transform:uppercase; border:2px solid #09090B;">Restablecer contraseña</a></p>
            <p style="color: #666; font-size: 12px;">Si no solicitaste esto, ignora este correo.</p>
            <p style="color: #999; font-size: 11px; font-family: monospace;">{reset_link}</p>
          </div>
        </div>
        """
        sent = await send_email_safe(email, "ConstruCRM - Recuperar contraseña", html)
        if not sent:
            logger.info(f"[PWD RESET] Link for {email}: {reset_link}")
    return {"ok": True}

@api_router.post("/auth/reset-password")
async def reset_password(body: ResetPwd):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec:
        raise HTTPException(400, "Token inválido o expirado")
    expires = rec["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expirado")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}

# ----- USERS -----
@api_router.get("/users")
async def list_users(user=Depends(require_roles("admin"))):
    docs = await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return docs

@api_router.post("/users")
async def create_user(body: UserCreate, current=Depends(require_roles("admin"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    doc = {
        "id": str(uuid.uuid4()), "name": body.name, "email": email,
        "password_hash": hash_password(body.password), "role": body.role,
        "company_id": current["company_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(require_roles("admin"))):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    await db.users.delete_one({"id": user_id, "company_id": current["company_id"]})
    return {"ok": True}

# ----- Generic tenant-scoped CRUD -----
def make_crud(path: str, collection: str, ModelOut, ModelIn, write_roles=("admin", "vendedor")):
    @api_router.get(f"/{path}")
    async def list_items(user=Depends(get_current_user)):
        return await db[collection].find({"company_id": user["company_id"]}, {"_id": 0}).to_list(2000)

    @api_router.get(f"/{path}/{{item_id}}")
    async def get_item(item_id: str, user=Depends(get_current_user)):
        doc = await db[collection].find_one({"id": item_id, "company_id": user["company_id"]}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "No encontrado")
        return doc

    @api_router.post(f"/{path}")
    async def create_item(body: ModelIn, user=Depends(require_roles(*write_roles))):
        data = body.model_dump()
        data["company_id"] = user["company_id"]
        obj = ModelOut(**data)
        await db[collection].insert_one(obj.model_dump())
        return obj.model_dump()

    @api_router.put(f"/{path}/{{item_id}}")
    async def update_item(item_id: str, body: ModelIn, user=Depends(require_roles(*write_roles))):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        result = await db[collection].update_one({"id": item_id, "company_id": user["company_id"]}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(404, "No encontrado")
        return await db[collection].find_one({"id": item_id, "company_id": user["company_id"]}, {"_id": 0})

    @api_router.delete(f"/{path}/{{item_id}}")
    async def delete_item(item_id: str, user=Depends(require_roles("admin"))):
        await db[collection].delete_one({"id": item_id, "company_id": user["company_id"]})
        return {"ok": True}

make_crud("clients", "clients", Client, ClientIn)
make_crud("projects", "projects", Project, ProjectIn)
make_crud("suppliers", "suppliers", Supplier, SupplierIn)
make_crud("materials", "materials", Material, MaterialIn)
make_crud("events", "events", CalendarEvent, EventIn)

# ----- QUOTES -----
def _compute_quote_totals(items, tax_rate):
    subtotal = sum((it.quantity * it.unit_price) for it in items)
    tax = subtotal * (tax_rate / 100.0)
    return round(subtotal, 2), round(tax, 2), round(subtotal + tax, 2)

@api_router.get("/quotes")
async def list_quotes(user=Depends(get_current_user)):
    return await db.quotes.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(2000)

@api_router.post("/quotes")
async def create_quote(body: QuoteIn, user=Depends(require_roles("admin", "vendedor"))):
    count = await db.quotes.count_documents({"company_id": user["company_id"]})
    number = f"COT-{datetime.now().year}-{(count+1):04d}"
    sub, tax, total = _compute_quote_totals(body.items, body.tax_rate)
    q = Quote(number=number, **body.model_dump(), subtotal=sub, tax=tax, total=total, company_id=user["company_id"])
    await db.quotes.insert_one(q.model_dump())
    return q.model_dump()

@api_router.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, body: QuoteIn, user=Depends(require_roles("admin", "vendedor"))):
    sub, tax, total = _compute_quote_totals(body.items, body.tax_rate)
    update = body.model_dump()
    update.update({"subtotal": sub, "tax": tax, "total": total})
    result = await db.quotes.update_one({"id": quote_id, "company_id": user["company_id"]}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "No encontrada")
    return await db.quotes.find_one({"id": quote_id, "company_id": user["company_id"]}, {"_id": 0})

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user=Depends(require_roles("admin"))):
    await db.quotes.delete_one({"id": quote_id, "company_id": user["company_id"]})
    return {"ok": True}

# ----- REQUISITIONS -----
@api_router.get("/requisitions")
async def list_requisitions(user=Depends(get_current_user)):
    return await db.requisitions.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(2000)

@api_router.post("/requisitions")
async def create_requisition(body: RequisitionIn, user=Depends(get_current_user)):
    count = await db.requisitions.count_documents({"company_id": user["company_id"]})
    number = f"REQ-{datetime.now().year}-{(count+1):04d}"
    r = Requisition(
        number=number, requested_by=user["id"], requested_by_name=user["name"],
        requested_by_email=user["email"], company_id=user["company_id"],
        **body.model_dump(),
    )
    await db.requisitions.insert_one(r.model_dump())
    return r.model_dump()

async def _notify_requisition_status(req: dict, new_status: str):
    """Send email when requisition is approved/rejected."""
    if not req.get("requested_by_email"):
        return
    status_label = {"aprobada": "APROBADA", "rechazada": "RECHAZADA", "entregada": "ENTREGADA"}.get(new_status)
    if not status_label:
        return
    color = {"aprobada": "#00C853", "rechazada": "#D32F2F", "entregada": "#0033A0"}[new_status]
    items_html = "".join(
        f"<tr><td style='padding:6px;border:1px solid #ccc'>{it['material_name']}</td><td style='padding:6px;border:1px solid #ccc;text-align:right'>{it['quantity']} {it['unit']}</td></tr>"
        for it in (req.get("items") or [])
    )
    html = f"""
    <div style="font-family: Arial; max-width: 600px;">
      <div style="background:#09090B;color:white;padding:20px"><h1 style="margin:0;text-transform:uppercase">ConstruCRM</h1></div>
      <div style="padding:24px;border:2px solid #09090B;border-top:0">
        <div style="background:{color};color:white;padding:10px;display:inline-block;font-weight:bold;text-transform:uppercase">REQ {req.get('number','')} {status_label}</div>
        <h2>Hola {req.get('requested_by_name','')},</h2>
        <p>Tu requisición <b>{req.get('number','')}</b> para la obra <b>{req.get('project_name','')}</b> ha sido <b>{status_label}</b>.</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <thead style="background:#09090B;color:white"><tr><th style="padding:6px;text-align:left">Material</th><th style="padding:6px;text-align:right">Cantidad</th></tr></thead>
          <tbody>{items_html}</tbody>
        </table>
        <p style="color:#666;font-size:12px">Notas: {req.get('notes') or '-'}</p>
      </div>
    </div>
    """
    await send_email_safe(req["requested_by_email"], f"ConstruCRM - Requisición {req.get('number')} {status_label}", html)

@api_router.put("/requisitions/{req_id}/status")
async def update_requisition_status(req_id: str, status: str, user=Depends(require_roles("admin", "supervisor"))):
    if status not in ("pendiente", "aprobada", "rechazada", "entregada"):
        raise HTTPException(400, "Estado inválido")
    existing = await db.requisitions.find_one({"id": req_id, "company_id": user["company_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "No encontrada")
    await db.requisitions.update_one({"id": req_id, "company_id": user["company_id"]}, {"$set": {"status": status}})
    if existing.get("status") != status and status in ("aprobada", "rechazada", "entregada"):
        existing["status"] = status
        asyncio.create_task(_notify_requisition_status(existing, status))
    return await db.requisitions.find_one({"id": req_id, "company_id": user["company_id"]}, {"_id": 0})

@api_router.delete("/requisitions/{req_id}")
async def delete_requisition(req_id: str, user=Depends(require_roles("admin"))):
    await db.requisitions.delete_one({"id": req_id, "company_id": user["company_id"]})
    return {"ok": True}

# ----- FILE ATTACHMENTS -----
@api_router.post("/projects/{project_id}/attachments")
async def upload_attachment(project_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "company_id": user["company_id"]})
    if not proj:
        raise HTTPException(404, "Obra no encontrada")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    storage_path = f"{APP_NAME}/{user['company_id']}/projects/{project_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Archivo demasiado grande (máx 25MB)")
    result = put_object(storage_path, data, file.content_type or "application/octet-stream")
    rec = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "company_id": user["company_id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.attachments.insert_one(rec)
    return {k: v for k, v in rec.items() if k != "_id"}

@api_router.get("/projects/{project_id}/attachments")
async def list_attachments(project_id: str, user=Depends(get_current_user)):
    return await db.attachments.find(
        {"project_id": project_id, "company_id": user["company_id"], "is_deleted": False}, {"_id": 0}
    ).to_list(500)

@api_router.get("/attachments/{att_id}/download")
async def download_attachment(att_id: str, user=Depends(get_current_user)):
    rec = await db.attachments.find_one({"id": att_id, "company_id": user["company_id"], "is_deleted": False})
    if not rec:
        raise HTTPException(404, "No encontrado")
    data, ctype = get_object(rec["storage_path"])
    return StreamingResponse(
        io.BytesIO(data),
        media_type=rec.get("content_type", ctype),
        headers={"Content-Disposition": f'attachment; filename="{rec["original_filename"]}"'},
    )

@api_router.delete("/attachments/{att_id}")
async def delete_attachment(att_id: str, user=Depends(require_roles("admin", "vendedor", "supervisor"))):
    await db.attachments.update_one(
        {"id": att_id, "company_id": user["company_id"]}, {"$set": {"is_deleted": True}}
    )
    return {"ok": True}

# ----- DASHBOARD / REPORTS -----
@api_router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    cid = user["company_id"]
    clients_count = await db.clients.count_documents({"company_id": cid})
    leads_count = await db.clients.count_documents({"company_id": cid, "stage": {"$in": ["lead", "contactado", "propuesta", "negociacion"]}})
    won_count = await db.clients.count_documents({"company_id": cid, "stage": "ganado"})
    active_projects = await db.projects.count_documents({"company_id": cid, "status": {"$in": ["planificacion", "en_progreso"]}})
    completed_projects = await db.projects.count_documents({"company_id": cid, "status": "completada"})
    pending_quotes = await db.quotes.count_documents({"company_id": cid, "status": {"$in": ["borrador", "enviada"]}})
    pending_reqs = await db.requisitions.count_documents({"company_id": cid, "status": "pendiente"})

    revenue_pipeline = [
        {"$match": {"company_id": cid, "status": "aceptada"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_agg = await db.quotes.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_agg[0]["total"] if revenue_agg else 0

    materials = await db.materials.find({"company_id": cid}, {"_id": 0}).to_list(2000)
    low_stock = [m for m in materials if m.get("stock", 0) <= m.get("min_stock", 0)]

    return {
        "clients_count": clients_count, "leads_count": leads_count, "won_count": won_count,
        "active_projects": active_projects, "completed_projects": completed_projects,
        "pending_quotes": pending_quotes, "pending_requisitions": pending_reqs,
        "total_revenue": total_revenue, "low_stock_count": len(low_stock),
    }

@api_router.get("/reports/projects-by-status")
async def projects_by_status(user=Depends(get_current_user)):
    pipeline = [{"$match": {"company_id": user["company_id"]}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    data = await db.projects.aggregate(pipeline).to_list(100)
    return [{"status": d["_id"], "count": d["count"]} for d in data]

@api_router.get("/reports/leads-by-stage")
async def leads_by_stage(user=Depends(get_current_user)):
    pipeline = [{"$match": {"company_id": user["company_id"]}}, {"$group": {"_id": "$stage", "count": {"$sum": 1}}}]
    data = await db.clients.aggregate(pipeline).to_list(100)
    return [{"stage": d["_id"], "count": d["count"]} for d in data]

# ----- COMPANY -----
@api_router.get("/company")
async def get_company(user=Depends(get_current_user)):
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    return company or {}

@api_router.put("/company")
async def update_company(body: dict, user=Depends(require_roles("admin"))):
    allowed = {k: body[k] for k in ("name", "address", "phone", "email", "rfc") if k in body}
    if allowed:
        await db.companies.update_one({"id": user["company_id"]}, {"$set": allowed})
    return await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})

@api_router.post("/company/logo")
async def upload_company_logo(file: UploadFile = File(...), user=Depends(require_roles("admin"))):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Solo se aceptan imágenes")
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(413, "Logo demasiado grande (máx 2MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    storage_path = f"{APP_NAME}/{user['company_id']}/logo-{uuid.uuid4()}.{ext}"
    result = put_object(storage_path, data, file.content_type)
    await db.companies.update_one(
        {"id": user["company_id"]},
        {"$set": {"logo_path": result["path"], "logo_content_type": file.content_type}}
    )
    return await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})

@api_router.get("/company/logo")
async def get_company_logo(user=Depends(get_current_user)):
    company = await db.companies.find_one({"id": user["company_id"]})
    if not company or not company.get("logo_path"):
        raise HTTPException(404, "Sin logo")
    data, ctype = get_object(company["logo_path"])
    return StreamingResponse(io.BytesIO(data), media_type=company.get("logo_content_type", ctype))

# ----- STARTUP -----
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("company_id")
    await db.companies.create_index("id", unique=True)
    for coll in ("clients", "projects", "quotes", "materials", "requisitions", "suppliers", "events", "attachments"):
        await db[coll].create_index("id", unique=True)
        await db[coll].create_index("company_id")
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=3600)

    # Seed default company + users for demo
    default_company_id = "demo-company"
    existing_company = await db.companies.find_one({"id": default_company_id})
    if not existing_company:
        await db.companies.insert_one({
            "id": default_company_id, "name": "Constructora Demo",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@crm.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "name": "Administrador", "email": admin_email,
            "password_hash": hash_password(admin_password), "role": "admin",
            "company_id": default_company_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        updates = {}
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if not existing.get("company_id"):
            updates["company_id"] = default_company_id
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})

    for em, name, role, pwd in [
        ("vendedor@crm.com", "Carlos Vendedor", "vendedor", "vendedor123"),
        ("supervisor@crm.com", "Marta Supervisor", "supervisor", "supervisor123"),
    ]:
        u = await db.users.find_one({"email": em})
        if not u:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": name, "email": em,
                "password_hash": hash_password(pwd), "role": role,
                "company_id": default_company_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif not u.get("company_id"):
            await db.users.update_one({"email": em}, {"$set": {"company_id": default_company_id}})

    # Backfill existing docs with company_id
    for coll in ("clients", "projects", "quotes", "materials", "requisitions", "suppliers", "events"):
        await db[coll].update_many({"company_id": {"$exists": False}}, {"$set": {"company_id": default_company_id}})
        await db[coll].update_many({"company_id": None}, {"$set": {"company_id": default_company_id}})

    init_storage()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
