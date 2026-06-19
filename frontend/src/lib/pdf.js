import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportQuotePDF(quote, company = {}) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header - black bar
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text((company.name || "CONSTRUCRM").toUpperCase(), 14, 18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("COMMAND CENTER", 14, 25);

  // Orange stripe
  doc.setFillColor(255, 69, 0);
  doc.rect(0, 30, pageW, 4, "F");

  // Quote info
  doc.setTextColor(9, 9, 11);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("COTIZACION", 14, 50);
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  doc.text(quote.number || "", pageW - 14, 50, { align: "right" });

  // Client info box
  doc.setDrawColor(9, 9, 11);
  doc.setLineWidth(0.6);
  doc.rect(14, 58, pageW - 28, 24);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", 18, 64);
  doc.text("FECHA", pageW / 2 + 10, 64);
  doc.text("ESTADO", pageW - 50, 64);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(quote.client_name || "—", 18, 72);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.text((quote.created_at || "").slice(0, 10), pageW / 2 + 10, 72);
  doc.text((quote.status || "").toUpperCase(), pageW - 50, 72);

  // Items table
  const rows = (quote.items || []).map((it) => [
    it.description,
    `${it.quantity} ${it.unit || ""}`,
    `$${Number(it.unit_price).toFixed(2)}`,
    `$${(Number(it.quantity) * Number(it.unit_price)).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["DESCRIPCION", "CANTIDAD", "PRECIO UNIT.", "TOTAL"]],
    body: rows,
    theme: "plain",
    headStyles: { fillColor: [9, 9, 11], textColor: 255, fontStyle: "bold", lineWidth: 0.6, lineColor: [9, 9, 11] },
    bodyStyles: { lineWidth: 0.3, lineColor: [9, 9, 11] },
    styles: { font: "helvetica", fontSize: 10 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
  });

  let y = doc.lastAutoTable.finalY + 6;

  // Totals
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const labelX = pageW - 80;
  const valX = pageW - 18;

  doc.text("Subtotal:", labelX, y);
  doc.setFont("courier", "bold");
  doc.text(`$${Number(quote.subtotal || 0).toFixed(2)}`, valX, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.text(`IVA (${quote.tax_rate || 0}%):`, labelX, y);
  doc.setFont("courier", "bold");
  doc.text(`$${Number(quote.tax || 0).toFixed(2)}`, valX, y, { align: "right" });
  y += 9;

  // Total box
  doc.setFillColor(255, 69, 0);
  doc.rect(labelX - 4, y - 5, pageW - labelX - 10, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", labelX, y + 2);
  doc.setFont("courier", "bold");
  doc.text(`$${Number(quote.total || 0).toFixed(2)}`, valX, y + 2, { align: "right" });

  y += 18;
  doc.setTextColor(9, 9, 11);

  if (quote.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("NOTAS:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(quote.notes, pageW - 28);
    doc.text(lines, 14, y + 5);
  }

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(9, 9, 11);
  doc.setLineWidth(0.6);
  doc.line(14, ph - 18, pageW - 14, ph - 18);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont("courier", "normal");
  doc.text(`Generado por ConstruCRM · ${new Date().toLocaleString("es-ES")}`, 14, ph - 12);

  doc.save(`${quote.number || "cotizacion"}.pdf`);
}
