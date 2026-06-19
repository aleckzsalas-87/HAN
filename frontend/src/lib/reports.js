import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const STATUS_LABEL = {
  planificacion: "Planificación",
  en_progreso: "En Progreso",
  pausada: "Pausada",
  completada: "Completada",
  cancelada: "Cancelada",
};

const STATUS_COLOR = {
  planificacion: [255, 179, 0],
  en_progreso: [255, 69, 0],
  pausada: [82, 82, 91],
  completada: [0, 200, 83],
  cancelada: [211, 47, 47],
};

async function fetchLogoDataURL(apiBase, token) {
  try {
    const resp = await fetch(`${apiBase}/company/logo`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: "include",
    });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawHeader(doc, company, logoDataURL, title, subtitle) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, pageW, 34, "F");

  if (logoDataURL) {
    try { doc.addImage(logoDataURL, "PNG", 12, 6, 22, 22); }
    catch { /* fallback */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text((company.name || "ConstruCRM").toUpperCase(), logoDataURL ? 40 : 12, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${company.email || ""}  ${company.phone || ""}`.trim(), logoDataURL ? 40 : 12, 22);
  doc.text(company.address || "", logoDataURL ? 40 : 12, 27);

  doc.setFillColor(255, 69, 0);
  doc.rect(0, 34, pageW, 4, "F");

  doc.setTextColor(9, 9, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, 12, 52);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    doc.setTextColor(82, 82, 91);
    doc.text(subtitle, 12, 58);
  }
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, pageW - 12, 52, { align: "right" });

  return 64;
}

function drawFooter(doc) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(9, 9, 11);
  doc.setLineWidth(0.5);
  doc.line(12, pageH - 14, pageW - 12, pageH - 14);
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("ConstruCRM · Reporte de obra", 12, pageH - 9);
  doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - 12, pageH - 9, { align: "right" });
}

// ----- INDIVIDUAL OBRA PDF -----
export async function exportProjectPDF(project, company, apiBase, token) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await fetchLogoDataURL(apiBase, token);
  let y = drawHeader(doc, company, logo, "REPORTE DE OBRA", project.name);

  // Status badge
  const sc = STATUS_COLOR[project.status] || [82, 82, 91];
  doc.setFillColor(...sc);
  doc.rect(12, y, 60, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((STATUS_LABEL[project.status] || project.status).toUpperCase(), 42, y + 5.5, { align: "center" });

  doc.setTextColor(9, 9, 11);
  doc.setFontSize(11);
  doc.setFont("courier", "bold");
  doc.text(`PROGRESO: ${project.progress || 0}%`, pageW - 12, y + 5.5, { align: "right" });
  y += 14;

  // Progress bar
  doc.setDrawColor(9, 9, 11);
  doc.setLineWidth(0.6);
  doc.rect(12, y, pageW - 24, 6);
  doc.setFillColor(255, 69, 0);
  doc.rect(12, y, ((pageW - 24) * (project.progress || 0)) / 100, 6, "F");
  y += 12;

  // Info table
  const rows = [
    ["Cliente", project.client_name || "—"],
    ["Dirección", project.address || "—"],
    ["Presupuesto", `$${(project.budget || 0).toLocaleString()}`],
    ["Fecha inicio", project.start_date || "—"],
    ["Fecha fin", project.end_date || "—"],
    ["Descripción", project.description || "—"],
  ];
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, lineWidth: 0.3, lineColor: [9, 9, 11] },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [244, 244, 245], cellWidth: 45 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Stages
  if (project.stages && project.stages.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ETAPAS DE LA OBRA", 12, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["ETAPA", "INICIO", "FIN", "PROGRESO"]],
      body: project.stages.map(s => [
        s.name,
        s.start_date || "—",
        s.end_date || "—",
        `${s.progress || 0}%`,
      ]),
      theme: "plain",
      headStyles: { fillColor: [9, 9, 11], textColor: 255, fontStyle: "bold", lineWidth: 0.6, lineColor: [9, 9, 11] },
      bodyStyles: { lineWidth: 0.3, lineColor: [9, 9, 11] },
      styles: { font: "helvetica", fontSize: 10 },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Attachments list (if provided)
  if (project.attachments && project.attachments.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ARCHIVOS ADJUNTOS", 12, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["ARCHIVO", "TAMAÑO", "SUBIDO POR"]],
      body: project.attachments.map(a => [
        a.original_filename,
        `${(a.size / 1024).toFixed(1)} KB`,
        a.uploaded_by_name || "—",
      ]),
      theme: "plain",
      headStyles: { fillColor: [9, 9, 11], textColor: 255, fontStyle: "bold", lineWidth: 0.6, lineColor: [9, 9, 11] },
      bodyStyles: { lineWidth: 0.3, lineColor: [9, 9, 11] },
      styles: { font: "helvetica", fontSize: 9 },
    });
  }

  drawFooter(doc);
  doc.save(`reporte-obra-${(project.name || "obra").replace(/\s+/g, "-")}.pdf`);
}

// ----- INDIVIDUAL OBRA EXCEL -----
export function exportProjectExcel(project) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["REPORTE DE OBRA", ""],
    ["Obra", project.name],
    ["Cliente", project.client_name || ""],
    ["Estado", STATUS_LABEL[project.status] || project.status],
    ["Progreso", `${project.progress || 0}%`],
    ["Dirección", project.address || ""],
    ["Presupuesto", project.budget || 0],
    ["Fecha inicio", project.start_date || ""],
    ["Fecha fin", project.end_date || ""],
    ["Descripción", project.description || ""],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  if (project.stages && project.stages.length > 0) {
    const stageRows = [
      ["Etapa", "Inicio", "Fin", "Progreso (%)"],
      ...project.stages.map(s => [s.name, s.start_date || "", s.end_date || "", s.progress || 0]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(stageRows);
    ws2["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Etapas");
  }

  XLSX.writeFile(wb, `reporte-obra-${(project.name || "obra").replace(/\s+/g, "-")}.xlsx`);
}

// ----- CONSOLIDATED PROJECTS PDF -----
export async function exportProjectsConsolidatedPDF(projects, company, apiBase, token) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await fetchLogoDataURL(apiBase, token);
  let y = drawHeader(doc, company, logo, "REPORTE CONSOLIDADO DE OBRAS", `Total de obras: ${projects.length}`);

  // Summary KPIs
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length : 0;
  const active = projects.filter(p => ["planificacion", "en_progreso"].includes(p.status)).length;
  const completed = projects.filter(p => p.status === "completada").length;

  const kpis = [
    ["TOTAL OBRAS", projects.length],
    ["ACTIVAS", active],
    ["COMPLETADAS", completed],
    ["PRESUPUESTO", `$${totalBudget.toLocaleString()}`],
    ["PROGRESO PROMEDIO", `${avgProgress.toFixed(1)}%`],
  ];
  const boxW = (pageW - 24) / kpis.length;
  kpis.forEach((k, i) => {
    doc.setDrawColor(9, 9, 11);
    doc.setLineWidth(0.6);
    doc.rect(12 + i * boxW, y, boxW - 2, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(k[0], 14 + i * boxW, y + 5);
    doc.setFontSize(14);
    doc.setTextColor(9, 9, 11);
    doc.text(String(k[1]), 14 + i * boxW, y + 14);
  });
  y += 24;

  autoTable(doc, {
    startY: y,
    head: [["OBRA", "CLIENTE", "ESTADO", "PROGRESO", "PRESUPUESTO", "INICIO", "FIN"]],
    body: projects.map(p => [
      p.name,
      p.client_name || "—",
      STATUS_LABEL[p.status] || p.status,
      `${p.progress || 0}%`,
      `$${(p.budget || 0).toLocaleString()}`,
      p.start_date || "—",
      p.end_date || "—",
    ]),
    theme: "plain",
    headStyles: { fillColor: [9, 9, 11], textColor: 255, fontStyle: "bold", lineWidth: 0.6, lineColor: [9, 9, 11] },
    bodyStyles: { lineWidth: 0.3, lineColor: [9, 9, 11] },
    styles: { font: "helvetica", fontSize: 9 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const proj = projects[data.row.index];
        const c = STATUS_COLOR[proj.status] || [82, 82, 91];
        data.cell.styles.fillColor = c;
        data.cell.styles.textColor = 255;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      }
    },
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter(doc);
  }

  doc.save(`reporte-consolidado-obras.pdf`);
}

// ----- CONSOLIDATED EXCEL -----
export function exportProjectsConsolidatedExcel(projects) {
  const wb = XLSX.utils.book_new();
  const rows = [
    ["Obra", "Cliente", "Estado", "Progreso (%)", "Presupuesto", "Fecha inicio", "Fecha fin", "Dirección"],
    ...projects.map(p => [
      p.name,
      p.client_name || "",
      STATUS_LABEL[p.status] || p.status,
      p.progress || 0,
      p.budget || 0,
      p.start_date || "",
      p.end_date || "",
      p.address || "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 30 }, { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Obras");

  // Per-stage sheet
  const allStages = projects.flatMap(p =>
    (p.stages || []).map(s => [p.name, s.name, s.start_date || "", s.end_date || "", s.progress || 0])
  );
  if (allStages.length > 0) {
    const stagesWs = XLSX.utils.aoa_to_sheet([["Obra", "Etapa", "Inicio", "Fin", "Progreso (%)"], ...allStages]);
    stagesWs["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, stagesWs, "Etapas");
  }

  XLSX.writeFile(wb, `reporte-consolidado-obras.xlsx`);
}
