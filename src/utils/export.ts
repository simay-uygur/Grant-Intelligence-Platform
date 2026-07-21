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

export function exportAsPdf(doc: ApplicationDocument) {
  const html = renderDocumentHtml(doc);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export function exportAsWord(doc: ApplicationDocument) {
  const html = renderDocumentHtml(doc);
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    ${html}</html>`;
  const blob = new Blob(["\ufeff", wordHtml], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.grantTitle.replace(/[^a-z0-9]+/gi, "_")}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
