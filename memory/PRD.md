# ConstruCRM - Product Requirements Document

## Iteration 3 (Reportes de Obras) — 2026-02-19

### Implementado
1. **Configuración de Empresa** (`/empresa`, admin-only):
   - Datos fiscales: nombre, RFC/NIT/RUC, email, teléfono, dirección
   - Subida de logo (PNG/JPG, máx 2MB) — almacenado en Emergent Object Storage
   - Logo aparece en todos los reportes generados
2. **Reporte individual de obra** (PDF + Excel):
   - PDF: header con logo + datos empresa, badge de estado, barra de progreso, tabla de información, etapas detalladas, archivos adjuntos
   - Excel: hoja "Resumen" + hoja "Etapas"
   - Botones PDF/Excel en cada tarjeta de obra
3. **Reporte consolidado de obras** (PDF + Excel):
   - PDF horizontal con KPIs (total/activas/completadas/presupuesto/progreso promedio) + tabla con todas las obras y badges de estado coloreados
   - Excel con hoja "Obras" + hoja "Etapas" (todas las etapas de todas las obras)
   - Dropdown en header de Obras: "PDF Consolidado" / "Excel Consolidado"
   - Respeta el filtro de estado activo (consolida solo lo filtrado)
4. **Bibliotecas instaladas**: jspdf + jspdf-autotable (ya estaban) + `xlsx` (sheetjs) para Excel.

### Backend nuevo
- GET /api/company — accesible a todos los usuarios autenticados (necesario para reportes)
- PUT /api/company (admin) — name, address, phone, email, rfc
- POST /api/company/logo (admin) — multipart, valida content_type empieza con image/, máx 2MB
- GET /api/company/logo — stream del logo binario

### Testing
- 12/12 nuevos tests pytest pasan
- Suite total: 47 tests
- Sin bugs encontrados en frontend ni backend
