from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ----- DB -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ----- App -----
app = FastAPI(title="Construccion CRM API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# ----- Auth utils -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
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

# ----- Pydantic Models -----
Role = Literal["admin", "vendedor", "supervisor"]

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "vendedor"

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    role: str
    created_at: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    stage: Literal["lead", "contactado", "propuesta", "negociacion", "ganado", "perdido"] = "lead"
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ClientIn(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    stage: Optional[str] = "lead"
    notes: Optional[str] = ""

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
    items: List[RequisitionItem] = []
    status: Literal["pendiente", "aprobada", "rechazada", "entregada"] = "pendiente"
    needed_by: Optional[str] = None
    notes: Optional[str] = ""
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
    date: str  # ISO
    type: Literal["visita", "reunion", "entrega", "inspeccion", "otro"] = "reunion"
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EventIn(BaseModel):
    title: str
    description: Optional[str] = ""
    date: str
    type: Optional[str] = "reunion"
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None

# ----- Auth Endpoints -----
@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=86400, path="/",
    )
    return {
        "id": user["id"], "name": user["name"], "email": user["email"],
        "role": user["role"], "token": token,
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ----- Users (admin) -----
@api_router.get("/users", response_model=List[UserOut])
async def list_users(_=Depends(require_roles("admin"))):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return docs

@api_router.post("/users", response_model=UserOut)
async def create_user(body: UserCreate, _=Depends(require_roles("admin"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash")
    return doc

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(require_roles("admin"))):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}

# ----- Generic CRUD helper -----
def make_crud(path: str, collection: str, ModelOut, ModelIn, allowed_roles=("admin", "vendedor", "supervisor"), write_roles=("admin", "vendedor")):
    @api_router.get(f"/{path}")
    async def list_items(_=Depends(require_roles(*allowed_roles))):
        return await db[collection].find({}, {"_id": 0}).to_list(2000)

    @api_router.get(f"/{path}/{{item_id}}")
    async def get_item(item_id: str, _=Depends(require_roles(*allowed_roles))):
        doc = await db[collection].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "No encontrado")
        return doc

    @api_router.post(f"/{path}")
    async def create_item(body: ModelIn, _=Depends(require_roles(*write_roles))):
        obj = ModelOut(**body.model_dump())
        await db[collection].insert_one(obj.model_dump())
        return obj.model_dump()

    @api_router.put(f"/{path}/{{item_id}}")
    async def update_item(item_id: str, body: ModelIn, _=Depends(require_roles(*write_roles))):
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        result = await db[collection].update_one({"id": item_id}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(404, "No encontrado")
        return await db[collection].find_one({"id": item_id}, {"_id": 0})

    @api_router.delete(f"/{path}/{{item_id}}")
    async def delete_item(item_id: str, _=Depends(require_roles("admin"))):
        await db[collection].delete_one({"id": item_id})
        return {"ok": True}

make_crud("clients", "clients", Client, ClientIn)
make_crud("projects", "projects", Project, ProjectIn)
make_crud("suppliers", "suppliers", Supplier, SupplierIn)
make_crud("materials", "materials", Material, MaterialIn)
make_crud("events", "events", CalendarEvent, EventIn)

# ----- Quotes (custom: compute totals + number) -----
def _compute_quote_totals(items, tax_rate):
    subtotal = sum((it.quantity * it.unit_price) for it in items)
    tax = subtotal * (tax_rate / 100.0)
    return round(subtotal, 2), round(tax, 2), round(subtotal + tax, 2)

@api_router.get("/quotes")
async def list_quotes(_=Depends(require_roles("admin", "vendedor", "supervisor"))):
    return await db.quotes.find({}, {"_id": 0}).to_list(2000)

@api_router.post("/quotes")
async def create_quote(body: QuoteIn, _=Depends(require_roles("admin", "vendedor"))):
    count = await db.quotes.count_documents({})
    number = f"COT-{datetime.now().year}-{(count+1):04d}"
    sub, tax, total = _compute_quote_totals(body.items, body.tax_rate)
    q = Quote(number=number, **body.model_dump(), subtotal=sub, tax=tax, total=total)
    await db.quotes.insert_one(q.model_dump())
    return q.model_dump()

@api_router.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, body: QuoteIn, _=Depends(require_roles("admin", "vendedor"))):
    sub, tax, total = _compute_quote_totals(body.items, body.tax_rate)
    update = body.model_dump()
    update.update({"subtotal": sub, "tax": tax, "total": total})
    result = await db.quotes.update_one({"id": quote_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "No encontrada")
    return await db.quotes.find_one({"id": quote_id}, {"_id": 0})

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, _=Depends(require_roles("admin"))):
    await db.quotes.delete_one({"id": quote_id})
    return {"ok": True}

# ----- Requisitions (custom: number + requester) -----
@api_router.get("/requisitions")
async def list_requisitions(_=Depends(require_roles("admin", "vendedor", "supervisor"))):
    return await db.requisitions.find({}, {"_id": 0}).to_list(2000)

@api_router.post("/requisitions")
async def create_requisition(body: RequisitionIn, user=Depends(require_roles("admin", "supervisor", "vendedor"))):
    count = await db.requisitions.count_documents({})
    number = f"REQ-{datetime.now().year}-{(count+1):04d}"
    r = Requisition(
        number=number,
        requested_by=user["id"],
        requested_by_name=user["name"],
        **body.model_dump(),
    )
    await db.requisitions.insert_one(r.model_dump())
    return r.model_dump()

@api_router.put("/requisitions/{req_id}/status")
async def update_requisition_status(req_id: str, status: str, _=Depends(require_roles("admin", "supervisor"))):
    if status not in ("pendiente", "aprobada", "rechazada", "entregada"):
        raise HTTPException(400, "Estado inválido")
    result = await db.requisitions.update_one({"id": req_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(404, "No encontrada")
    return await db.requisitions.find_one({"id": req_id}, {"_id": 0})

@api_router.delete("/requisitions/{req_id}")
async def delete_requisition(req_id: str, _=Depends(require_roles("admin"))):
    await db.requisitions.delete_one({"id": req_id})
    return {"ok": True}

# ----- Dashboard / Reports -----
@api_router.get("/dashboard/stats")
async def dashboard_stats(_=Depends(get_current_user)):
    clients_count = await db.clients.count_documents({})
    leads_count = await db.clients.count_documents({"stage": {"$in": ["lead", "contactado", "propuesta", "negociacion"]}})
    won_count = await db.clients.count_documents({"stage": "ganado"})
    active_projects = await db.projects.count_documents({"status": {"$in": ["planificacion", "en_progreso"]}})
    completed_projects = await db.projects.count_documents({"status": "completada"})
    pending_quotes = await db.quotes.count_documents({"status": {"$in": ["borrador", "enviada"]}})
    pending_reqs = await db.requisitions.count_documents({"status": "pendiente"})

    # revenue from accepted quotes
    revenue_pipeline = [
        {"$match": {"status": "aceptada"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    revenue_agg = await db.quotes.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_agg[0]["total"] if revenue_agg else 0

    # low stock materials
    materials = await db.materials.find({}, {"_id": 0}).to_list(2000)
    low_stock = [m for m in materials if m.get("stock", 0) <= m.get("min_stock", 0)]

    return {
        "clients_count": clients_count,
        "leads_count": leads_count,
        "won_count": won_count,
        "active_projects": active_projects,
        "completed_projects": completed_projects,
        "pending_quotes": pending_quotes,
        "pending_requisitions": pending_reqs,
        "total_revenue": total_revenue,
        "low_stock_count": len(low_stock),
    }

@api_router.get("/reports/projects-by-status")
async def projects_by_status(_=Depends(get_current_user)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    data = await db.projects.aggregate(pipeline).to_list(100)
    return [{"status": d["_id"], "count": d["count"]} for d in data]

@api_router.get("/reports/leads-by-stage")
async def leads_by_stage(_=Depends(get_current_user)):
    pipeline = [{"$group": {"_id": "$stage", "count": {"$sum": 1}}}]
    data = await db.clients.aggregate(pipeline).to_list(100)
    return [{"stage": d["_id"], "count": d["count"]} for d in data]

# ----- Setup -----
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.clients.create_index("id", unique=True)
    await db.projects.create_index("id", unique=True)
    await db.quotes.create_index("id", unique=True)
    await db.materials.create_index("id", unique=True)
    await db.requisitions.create_index("id", unique=True)
    await db.suppliers.create_index("id", unique=True)
    await db.events.create_index("id", unique=True)

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@crm.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Administrador",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed demo users (vendedor + supervisor) if missing
    for em, name, role, pwd in [
        ("vendedor@crm.com", "Carlos Vendedor", "vendedor", "vendedor123"),
        ("supervisor@crm.com", "Marta Supervisor", "supervisor", "supervisor123"),
    ]:
        if not await db.users.find_one({"email": em}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "email": em,
                "password_hash": hash_password(pwd),
                "role": role,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

app.include_router(api_router)

# CORS - allow specific origin with credentials
frontend_origin = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
