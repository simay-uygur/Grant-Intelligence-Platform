import { jsPDF } from "jspdf";
import type { ApplicationDocument } from "@/types";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

function renderDocumentHtml(doc: ApplicationDocument): string {
  const body = doc.sections
    .map(
      (s, i) => `
    <section>
      <h2>${i + 1}. ${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.content)}</p>
    </section>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>${escapeHtml(doc.grantTitle)} — Application</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 40px auto; color: #111; line-height: 1.55; padding: 0 24px; }
  h1 { font-size: 22px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h2 { font-size: 15px; margin-top: 28px; color: #1e3a8a; }
  p { font-size: 12.5px; white-space: pre-wrap; }
  section { page-break-inside: avoid; }
</style></head><body>
<h1>Grant Application — ${escapeHtml(doc.grantTitle)}</h1>
${body}
</body></html>`;
}

/** Returns whether the export actually succeeded, so the caller can show a status if not. */
export function exportAsPdf(doc: ApplicationDocument): boolean {
  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let cursorY = margin;

    // Document Title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(17, 24, 39);

    const titleLines = pdf.splitTextToSize(`Grant Application — ${doc.grantTitle}`, contentWidth);
    pdf.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 6.5 + 4;

    // Divider Line
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.4);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 8;

    // Sections
    doc.sections.forEach((s, idx) => {
      if (cursorY + 25 > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      // Section Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11.5);
      pdf.setTextColor(30, 58, 138);
      pdf.text(`${idx + 1}. ${s.title}`, margin, cursorY);
      cursorY += 6.5;

      // Section Content
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(51, 65, 85);

      const paragraphs = s.content.split("\n").filter((p) => p.trim().length > 0);
      paragraphs.forEach((pText) => {
        const textLines = pdf.splitTextToSize(pText, contentWidth);
        textLines.forEach((line: string) => {
          if (cursorY + 5.5 > pageHeight - margin) {
            pdf.addPage();
            cursorY = margin;
          }
          pdf.text(line, margin, cursorY);
          cursorY += 5;
        });
        cursorY += 2; // Paragraph gap
      });

      cursorY += 5; // Section gap
    });

    // Page Numbers
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `Page ${i} of ${totalPages} — ${doc.grantTitle.slice(0, 50)}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" },
      );
    }

    const safeTitle = (doc.grantTitle || "Grant_Application").replace(/[^a-z0-9]+/gi, "_");
    pdf.save(`${safeTitle}_Application.pdf`);
    return true;
  } catch (err) {
    console.error("PDF export failed:", err);
    return false;
  }
}

import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} from "docx";

export async function exportAsWord(doc: ApplicationDocument): Promise<boolean> {
  try {
    const children: Paragraph[] = [
      new Paragraph({
        text: `Grant Application — ${doc.grantTitle}`,
        heading: HeadingLevel.HEADING_1,
        border: {
          bottom: {
            color: "1E3A8A",
            space: 6,
            style: BorderStyle.SINGLE,
            size: 12,
          },
        },
        spacing: { after: 300 },
      }),
    ];

    doc.sections.forEach((s, idx) => {
      children.push(
        new Paragraph({
          text: `${idx + 1}. ${s.title}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
      );

      const paragraphs = s.content.split("\n").filter((p) => p.trim().length > 0);
      paragraphs.forEach((pText) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: pText,
                size: 23,
                font: "Calibri",
              }),
            ],
            spacing: { after: 140, line: 300 },
          }),
        );
      });
    });

    const docxDoc = new DocxDocument({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(docxDoc);
    const safeTitle = (doc.grantTitle || "Grant_Application").replace(/[^a-z0-9]+/gi, "_");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}_Application.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Word export failed:", err);
    return false;
  }
}
