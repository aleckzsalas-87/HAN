# ConstruCRM - Product Requirements Document

## Original Problem Statement
"Quiero hacer una pagina crm enfocada a la construccion, que tenga interfaz moderna y profesional que pueda alojarla en mi propio servidor remoto con ubuntu que me recomiendas"

## User Choices Captured
- Funcionalidades: TODAS (clientes, leads, proyectos/obras, cotizaciones, contratistas, calendario, reportes) + insumos (materiales) y requisiciones de insumos
- Auth: Login simple JWT (email/password)
- Roles: Admin / Vendedor / Supervisor de Obra
- Diseño: Decidido por agente (Industrial Brutalism — Concrete + Safety Orange + Blueprint Blue, fuentes Cabinet Grotesk + Chivo + JetBrains Mono)
- Despliegue: Guía completa para Ubuntu Server incluida

## Architecture
- Backend: FastAPI + MongoDB (Motor async) — JWT auth (httpOnly cookie + Bearer header), bcrypt, RBAC via dependency
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn UI primitives + Recharts + Sonner toasts + Axios
- Single `server.py` with `make_crud` helper for repetitive CRUDs

## Implemented (2026-02-19)
1. JWT Auth (login/logout/me) with 3 seeded users
2. Role-based access (admin / vendedor / supervisor)
3. Clients module with sales pipeline (6 stages)
4. Projects (Obras) module with status, progress, budget, supervisor assignment
5. Quotes with auto-numbering, line items, tax computation, status workflow
6. Suppliers & Contractors directory with rating
7. Materials inventory with low-stock alerts
8. Material Requisitions with approval workflow
9. Calendar with month view + upcoming events list
10. Reports & Analytics with charts (Recharts)
11. User management (admin-only)
12. Industrial Brutalist UI (heavy borders, sharp shadows, Cabinet Grotesk + Chivo + JetBrains Mono)
13. Full Ubuntu deployment guide (`/app/DEPLOYMENT.md`)

## Personas
- **Admin**: gerente/dueño - acceso completo, gestiona usuarios y elimina recursos
- **Vendedor**: gestiona clientes/leads, cotizaciones y proyectos
- **Supervisor de Obra**: supervisa proyectos, aprueba requisiciones de material

## Backlog (P1/P2)
- P1: Adjuntar archivos a obras/cotizaciones (object storage)
- P1: Exportar cotizaciones a PDF
- P1: Notificaciones por email cuando se aprueba requisición (Resend/SendGrid)
- P1: Recuperación de contraseña
- P2: Vista Kanban del pipeline de clientes
- P2: Gantt chart para etapas de obra
- P2: Multi-empresa / multi-tenant
- P2: Movimientos de inventario con bitácora
- P2: App móvil para supervisores en sitio
