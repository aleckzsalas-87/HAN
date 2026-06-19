# ConstruCRM - Product Requirements Document

## Original Problem Statement
"Quiero hacer una pagina crm enfocada a la construccion, que tenga interfaz moderna y profesional que pueda alojarla en mi propio servidor remoto con ubuntu que me recomiendas"

## Iteration 2 (P1 + P2) — 2026-02-19

### Implemented
1. **PDF Cotizaciones**: client-side via jsPDF + autoTable. Botón en lista y modal de vista.
2. **Recuperación de contraseña**: forgot-password / reset-password endpoints. Email via Resend (graceful fallback con log).
3. **Adjuntar archivos a obras**: object storage Emergent. Upload/list/download/delete UI dentro del editor de obra.
4. **Notificaciones por email**: cuando una requisición cambia a aprobada/rechazada/entregada.
5. **Vista Kanban del Pipeline**: 6 columnas con drag & drop nativo. Solo admin/vendedor pueden mover.
6. **Gantt de obras**: timeline con barras por obra + sub-rows por etapa. Cada obra puede tener etapas con nombre/fechas/progreso.
7. **Multi-tenant completo**: `companies` collection, `company_id` en todas las colecciones, registro público de empresas en `/register`. Aislamiento estricto.

### Backend bug fixes (testing agent)
- Excluído `_id` del response de POST /api/users (Motor mutaba el dict con ObjectId).
- Quotes.js — añadido `useState` para company que faltaba (causaba ReferenceError en botón PDF).

### Próximos pasos sugeridos
- P1: Envío automático del PDF de cotización por email al cliente
- P1: Firma electrónica de cotizaciones
- P2: Subir múltiples archivos a la vez (drag & drop)
- P2: Bitácora de movimientos de inventario
- P2: Vista de mapa de obras (Mapbox/Leaflet)
- P2: App móvil PWA para supervisores

## Auth & Multi-tenant
- `demo-company` con 3 usuarios seed
- Cualquier nuevo registro crea su propia empresa
- Todos los queries filtran por `user.company_id`
- Email único globalmente (constraint en DB)

## Variables de entorno (.env backend)
- `RESEND_API_KEY` (vacío por defecto, logs locales si vacío)
- `SENDER_EMAIL` (default: onboarding@resend.dev)
- `EMERGENT_LLM_KEY` (object storage)
- `APP_NAME=construcrm` (namespace para archivos)
