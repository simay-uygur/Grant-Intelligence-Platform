"""Continuous paper export: full proposal + structured sheets as HTML/Markdown/text."""

from __future__ import annotations

import html
from typing import Any

INDIRECT_RATE_LABEL = "25% flat indirect overhead"


def _escape(value: Any) -> str:
    return html.escape(str(value), quote=False)


def build_export(stored_application: dict[str, Any], sheets: dict[str, Any] | None, fmt: str) -> str:
    if fmt == "html":
        return _build_html(stored_application, sheets)
    if fmt == "markdown":
        return _build_markdown(stored_application, sheets)
    return _build_text(stored_application, sheets)


def _sections(application: dict[str, Any]) -> list[dict[str, Any]]:
    sections = application.get("sections", [])
    return [s for s in sections if isinstance(s, dict)]


def _budget_rows(sheets: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not sheets:
        return []
    items = sheets.get("budget", {}).get("items", [])
    return [i for i in items if isinstance(i, dict)]


# --- HTML -------------------------------------------------------------------


def _html_table(headers: list[str], rows: list[list[str]]) -> str:
    head = "".join(f"<th>{_escape(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{_escape(c)}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def _build_html(application: dict[str, Any], sheets: dict[str, Any] | None) -> str:
    parts = [
        "<!DOCTYPE html>",
        '<html><head><meta charset="utf-8">',
        f"<title>{_escape(application.get('grantTitle', 'Grant Application'))}</title>",
        "<style>",
        "body{font-family:Calibri,Arial,sans-serif;max-width:800px;margin:2em auto;line-height:1.5;color:#1a1a1a}",
        "h1{border-bottom:3px solid #003399;padding-bottom:.3em}h2{color:#003399;margin-top:1.6em}",
        "table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border:1px solid #999;padding:6px 8px;text-align:left}",
        "th{background:#eef2f8}.meta{color:#555}.empty{color:#777;font-style:italic}",
        "</style></head><body>",
        f"<h1>{_escape(application.get('grantTitle', 'Grant Application'))}</h1>",
        f'<p class="meta">Applicant: {_escape(application["profile"].get("organisationName", ""))} &middot; Grant ID: {_escape(application.get("grantId", ""))}</p>',
    ]
    for section in _sections(application):
        parts.append(f"<h2>{_escape(section['title'])}</h2>")
        body = section.get("content", "").strip()
        paragraphs = [f"<p>{_escape(p)}</p>" for p in body.split("\n\n") if p.strip()] or ['<p class="empty">(not written)</p>']
        parts.extend(paragraphs)

    if sheets:
        work_packages = sheets.get("workPackages", [])
        parts.append("<h2>Work Packages &amp; Milestones</h2>")
        if work_packages:
            rows = [[wp.get("number", ""), wp.get("title", ""), wp.get("lead", ""), str(wp.get("personMonths", 0)), f"M{wp.get('startMonth', 1)}-M{wp.get('endMonth', 1)}", "; ".join(wp.get("deliverables", []))] for wp in work_packages]
            parts.append(_html_table(["WP", "Title", "Lead", "Person-Months", "Months", "Deliverables"], rows))
        else:
            parts.append('<p class="empty">No work packages defined.</p>')

        budget = sheets.get("budget", {})
        items = budget.get("items", [])
        parts.append("<h2>Budget &amp; Financial Breakdown</h2>")
        if items:
            rows = [[item.get("category", ""), item.get("description", ""), f"{item.get('directCost', 0):,.2f}"] for item in items]
            parts.append(_html_table(["Category", "Description", "Direct Cost (EUR)"], rows))
            parts.append(f"<p>Total direct costs: EUR {budget.get('totalDirectCosts', 0):,.2f}<br>{INDIRECT_RATE_LABEL}: EUR {budget.get('totalIndirectCosts', 0):,.2f}<br><strong>Total requested grant: EUR {budget.get('totalRequestedGrant', 0):,.2f}</strong></p>")
        else:
            parts.append('<p class="empty">No budget defined.</p>')

        risks = sheets.get("risks", [])
        parts.append("<h2>Risk &amp; Mitigation Matrix</h2>")
        if risks:
            rows = [[r.get("id", ""), r.get("description", ""), r.get("workPackage", ""), r.get("likelihood", ""), r.get("severity", ""), r.get("mitigation", "")] for r in risks]
            parts.append(_html_table(["ID", "Risk", "WP", "Likelihood", "Severity", "Mitigation"], rows))
        else:
            parts.append('<p class="empty">No risks defined.</p>')

        consortium = sheets.get("consortium", [])
        parts.append("<h2>Consortium &amp; Role Allocation</h2>")
        if consortium:
            rows = [[m.get("name", ""), m.get("country", ""), m.get("type", ""), m.get("keyTasks", ""), f"{m.get('allocatedBudget', 0):,.2f}"] for m in consortium]
            parts.append(_html_table(["Partner", "Country", "Type", "Key Tasks", "Budget (EUR)"], rows))
        else:
            parts.append('<p class="empty">No consortium members defined.</p>')

    parts.append("</body></html>")
    return "\n".join(parts)


# --- Markdown ---------------------------------------------------------------


def _md_table(headers: list[str], rows: list[list[Any]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(str(cell) for cell in row) + " |" for row in rows)
    return "\n".join(lines)


def _build_markdown(application: dict[str, Any], sheets: dict[str, Any] | None) -> str:
    parts = [f"# {application.get('grantTitle', 'Grant Application')}", "", f"*Applicant: {application['profile'].get('organisationName', '')} — Grant ID: {application.get('grantId', '')}*", ""]
    for section in _sections(application):
        parts.append(f"## {section['title']}")
        content = section.get("content", "").strip()
        parts.append(content if content else "*(not written)*")
        parts.append("")

    if sheets:
        work_packages = sheets.get("workPackages", [])
        parts += ["## Work Packages & Milestones", ""]
        if work_packages:
            parts.append(
                _md_table(
                    ["WP", "Title", "Lead", "PM", "Months", "Deliverables"],
                    [[wp.get("number"), wp.get("title"), wp.get("lead"), wp.get("personMonths", 0), f"M{wp.get('startMonth', 1)}-M{wp.get('endMonth', 1)}", "; ".join(wp.get("deliverables", []))] for wp in work_packages],
                )
            )
            parts.append("")

        budget = sheets.get("budget", {})
        items = budget.get("items", [])
        parts += ["## Budget & Financial Breakdown", ""]
        if items:
            parts.append(
                _md_table(
                    ["Category", "Description", "Direct Cost (EUR)"],
                    [[item.get("category"), item.get("description"), f"{item.get('directCost', 0):,.2f}"] for item in items],
                )
            )
            parts.append("")
            budget_lines = [
                f"**Total direct costs:** EUR {budget.get('totalDirectCosts', 0):,.2f}",
                f"**{INDIRECT_RATE_LABEL}:** EUR {budget.get('totalIndirectCosts', 0):,.2f}",
                f"**Total requested grant:** EUR {budget.get('totalRequestedGrant', 0):,.2f}",
            ]
            parts += budget_lines + [""]

        risks = sheets.get("risks", [])
        parts += ["## Risk & Mitigation Matrix", ""]
        if risks:
            parts.append(
                _md_table(
                    ["ID", "Risk", "WP", "Likelihood", "Severity", "Mitigation"],
                    [[r.get("id"), r.get("description"), r.get("workPackage"), r.get("likelihood"), r.get("severity"), r.get("mitigation")] for r in risks],
                )
            )
            parts.append("")

        consortium = sheets.get("consortium", [])
        parts += ["## Consortium & Role Allocation", ""]
        if consortium:
            parts.append(
                _md_table(
                    ["Partner", "Country", "Type", "Key Tasks", "Budget (EUR)"],
                    [[m.get("name"), m.get("country"), m.get("type"), m.get("keyTasks"), f"{m.get('allocatedBudget', 0):,.2f}"] for m in consortium],
                )
            )
            parts.append("")

    return "\n".join(parts).rstrip() + "\n"


# --- Plain text -------------------------------------------------------------


def _build_text(application: dict[str, Any], sheets: dict[str, Any] | None) -> str:
    divider = "=" * 72
    thin = "-" * 72
    parts = [divider, application.get("grantTitle", "Grant Application").upper(), divider]
    parts.append(f"Applicant: {application['profile'].get('organisationName', '')}   Grant ID: {application.get('grantId', '')}")
    parts.append("")
    for section in _sections(application):
        parts += [section["title"].upper(), thin]
        content = section.get("content", "").strip()
        parts.append(content if content else "(not written)")
        parts.append("")

    if sheets:
        work_packages = sheets.get("workPackages", [])
        parts += ["WORK PACKAGES & MILESTONES", thin]
        if work_packages:
            for wp in work_packages:
                deliverables = "; ".join(wp.get("deliverables", [])) or "-"
                parts.append(f"{wp.get('number')} {wp.get('title')} | Lead: {wp.get('lead') or '-'} | {wp.get('personMonths', 0)} PM | M{wp.get('startMonth', 1)}-M{wp.get('endMonth', 1)}\n  Deliverables: {deliverables}")
        else:
            parts.append("No work packages defined.")
        parts.append("")

        budget = sheets.get("budget", {})
        items = budget.get("items", [])
        parts += ["BUDGET & FINANCIAL BREAKDOWN", thin]
        if items:
            for item in items:
                pm = f" ({item.get('personMonths')} PM)" if item.get("personMonths") is not None else ""
                parts.append(f"- {item.get('category')}: EUR {item.get('directCost', 0):,.2f}{pm} — {item.get('description') or ''}")
            parts.append(f"Total direct costs: EUR {budget.get('totalDirectCosts', 0):,.2f}")
            parts.append(f"{INDIRECT_RATE_LABEL}: EUR {budget.get('totalIndirectCosts', 0):,.2f}")
            parts.append(f"TOTAL REQUESTED GRANT: EUR {budget.get('totalRequestedGrant', 0):,.2f}")
        else:
            parts.append("No budget defined.")
        parts.append("")

        risks = sheets.get("risks", [])
        parts += ["RISK & MITIGATION MATRIX", thin]
        if risks:
            for r in risks:
                parts.append(f"{r.get('id')} [{r.get('likelihood')}/{r.get('severity')}] {r.get('description')} (WP: {r.get('workPackage') or '-'})\n  Mitigation: {r.get('mitigation') or '-'}")
        else:
            parts.append("No risks defined.")
        parts.append("")

        consortium = sheets.get("consortium", [])
        parts += ["CONSORTIUM & ROLE ALLOCATION", thin]
        if consortium:
            for m in consortium:
                parts.append(f"- {m.get('name')} ({m.get('country')}), {m.get('type')} — {m.get('keyTasks') or ''} | EUR {m.get('allocatedBudget', 0):,.2f}")
        else:
            parts.append("No consortium members defined.")
        parts.append("")

    return "\n".join(parts).rstrip() + "\n"
