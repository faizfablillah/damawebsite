import "server-only";
import PDFDocument from "pdfkit";
import type { ReceiptSnapshot } from "@/db/schema";
import { ORG } from "./config";
import { fmtDate, fmtDateDash, money } from "./format";

// Official receipt, following the layout approved by the VP Finance (no logo).

const NAVY = "#203864";
const BLUE = "#4472C4";
const LINE = "#9AA9C7";
const VALUE = "#1F4E9A";

export function receiptPdf(r: ReceiptSnapshot, website: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Receipt ${r.receiptNo}`, Author: ORG.registeredName } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const L = 40;
    const W = doc.page.width - 80;

    // Header
    doc.font("Helvetica-Bold").fontSize(12.5).fillColor("#000").text(ORG.registeredName, L, 40, { width: W });
    doc.font("Helvetica").fontSize(8.5).fillColor(VALUE);
    doc.text(`ROS Reg. No.: ${ORG.rosNo}`).text(ORG.email);
    if (website) doc.text(website);
    // Title sits below the (long) registered name, level with the contact lines
    doc.font("Helvetica-Bold").fontSize(15).fillColor(NAVY).text("OFFICIAL RECEIPT", L, 62, { width: W, align: "right" });

    // Two info boxes
    const top = 112;
    const colW = (W - 14) / 2;
    const rowH = 15;
    const box = (x: number, title: string, rows: { label: string; value: string }[]) => {
      doc.rect(x, top, colW, 15).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff").text(title, x + 5, top + 4);
      rows.forEach((row, i) => {
        const y = top + 15 + i * rowH;
        const labelW = colW * 0.38;
        doc.rect(x + labelW, y, colW - labelW, rowH).lineWidth(0.5).stroke(LINE);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text(row.label, x + 2, y + 4, { width: labelW - 4, lineBreak: false });
        doc.font("Helvetica").fontSize(8).fillColor(VALUE).text(row.value || "—", x + labelW + 4, y + 4, { width: colW - labelW - 8, lineBreak: false, ellipsis: true });
      });
      return top + 15 + rows.length * rowH;
    };
    const isEvent = r.kind === "event";
    const period = r.periodStart && r.periodEnd ? `${fmtDate(r.periodStart)}  to  ${fmtDate(r.periodEnd)}` : (r.periodNote ?? "—");
    const leftEnd = box(L, "RECEIVED FROM", r.payer);
    const rightEnd = box(L + colW + 14, "RECEIPT DETAILS", [
      { label: "Receipt No.", value: r.receiptNo },
      { label: "Receipt Date", value: fmtDateDash(r.receiptDate) },
      ...(isEvent
        ? [
            { label: "Event", value: r.event?.title ?? "" },
            { label: "Event Date", value: fmtDateDash(r.event?.date ?? null) },
            { label: "Membership ID", value: r.memberCode ?? "Non-member" },
          ]
        : [
            { label: "Membership ID", value: r.memberCode ?? "Assigned on activation" },
            { label: "Membership Period", value: period },
          ]),
      { label: "Payment Method", value: r.method },
      { label: "Payment Date", value: fmtDateDash(r.paymentDate) },
      { label: "Payment Reference", value: r.paymentReference },
    ]);

    // Line items
    let y = Math.max(leftEnd, rightEnd) + 20;
    const cols = [
      { t: "Item Code", w: 0.13, a: "center" as const },
      { t: "Description", w: 0.32, a: "left" as const },
      { t: "Qty", w: 0.08, a: "center" as const },
      { t: "Unit Price (RM)", w: 0.16, a: "right" as const },
      { t: "Discount (RM)", w: 0.15, a: "right" as const },
      { t: "Amount (RM)", w: 0.16, a: "right" as const },
    ];
    const drawRow = (cells: string[], header = false) => {
      let x = L;
      const h = header ? 20 : 26;
      if (header) doc.rect(L, y, W, h).fill(BLUE);
      cols.forEach((c, i) => {
        const w = W * c.w;
        doc.rect(x, y, w, h).lineWidth(0.5).stroke(LINE);
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(header ? "#fff" : i === 0 ? VALUE : "#000");
        doc.text(cells[i] ?? "", x + 4, y + (header ? 6 : 5), { width: w - 8, align: header ? "center" : c.a });
        x += w;
      });
      y += h;
    };
    drawRow(cols.map((c) => c.t), true);
    const total = r.unitPrice - r.discount;
    drawRow([r.itemCode, r.description, "1", money(r.unitPrice), r.discount ? money(r.discount) : "", money(total)]);
    for (let i = 0; i < 2; i++) drawRow(["", "", "", "", "", ""]);

    // Totals
    const tl = L + W * 0.55;
    const tw = W * 0.45;
    const line = (label: string, value: string, strong = false, fill = false) => {
      const h = 16;
      if (fill) doc.rect(tl, y, tw, h).fill(NAVY);
      doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 9 : 8).fillColor(fill ? "#fff" : "#000");
      doc.text(label, tl, y + 4, { width: tw * 0.66 - 6, align: "right" });
      if (!fill) doc.rect(tl + tw * 0.66, y, tw * 0.34, h).lineWidth(0.5).stroke(LINE);
      doc.text(value, tl + tw * 0.66, y + 4, { width: tw * 0.34 - 5, align: "right" });
      y += h;
    };
    y += 4;
    line("Subtotal", money(total));
    line("SST @ 0% (not applicable — see note)", "0.00");
    line("TOTAL (RM)", money(total), true, true);
    if (r.previouslyPaid > 0) line("Previously received (RM)", money(r.previouslyPaid));
    line("AMOUNT RECEIVED (RM)", money(r.amountReceived), true, true);
    line("Balance (RM)", money(r.balance));
    line("Payment status", r.status, true);

    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#000");
    doc.text(
      isEvent
        ? "Payment received in full. Your place at the event is confirmed."
        : r.status === "PAID IN FULL"
        ? r.periodStart
          ? "Payment received in full. Membership is active for the period shown above."
          : "Payment received in full. Membership is activated once eligibility is verified."
        : "Balance outstanding — membership will be activated once the balance is settled.",
      L,
      y - 14,
      { width: W * 0.53 },
    );

    if (r.seats) {
      y += 12;
      doc.rect(L, y, W, 15).fill(NAVY);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff").text("SEAT ENTITLEMENT", L + 5, y + 4);
      y += 15;
      doc.rect(L, y, W, 18).lineWidth(0.5).stroke(LINE);
      doc.font("Helvetica").fontSize(8).fillColor("#000").text(`Seats included in tier: ${r.seats}. Named seat holders are maintained by the chapter and are not listed on this receipt.`, L + 5, y + 5, { width: W - 10 });
      y += 18;
    }

    // Notes
    y += 16;
    doc.rect(L, y, W, 15).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff").text("NOTES & CONDITIONS", L + 5, y + 4);
    y += 20;
    const notes = isEvent
      ? [
          "This official receipt confirms that payment for the event shown above has been received and cleared.",
          "Event fees are non-refundable. A registered place may be transferred to a colleague by written notice to the chapter before the event.",
          "If the event is cancelled or postponed by the chapter, the fee will be refunded or carried over to the new date.",
        ]
      : [
      r.status === "PAID IN FULL"
        ? "This official receipt confirms that payment has been received and cleared. No further payment is due for the period shown."
        : "This official receipt confirms the amount received as shown above. Where a balance is outstanding, membership is activated only once the balance is settled.",
      "Membership is activated on receipt of full payment and, where applicable, verification of eligibility. Educational members must submit valid proof of student status; Individual members must be actively working in data management or a closely related field.",
      "Membership fees are non-refundable and non-transferable between individual / organisations.",
    ];
    if (r.category === "C") notes.push("Corporate seats are held by the organisation and may be reassigned to replacement personnel by written notice to the chapter.");
    doc.font("Helvetica").fontSize(7.5).fillColor(VALUE);
    notes.forEach((n, i) => {
      doc.text(`${i + 1}. ${n}`, L, y, { width: W });
      y = doc.y + 3;
    });

    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#000").text(
      `This is a computer-generated receipt and is valid without signature. Issued by ${ORG.registeredName}. Not an LHDN e-Invoice — the issuer is outside the MyInvois mandate. SST 0%.`,
      L,
      y + 14,
      { width: W, align: "center" },
    );
    doc.end();
  });
}
