import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { logAudit } from "@/src/lib/audit";
import { prisma } from "@/src/lib/prisma";
import {
  getWorkspaceTaxRecords,
  resolveSummaryCurrency,
  summarizeTaxFiling,
} from "@/src/lib/tax-reporting";

export const runtime = "nodejs";

function formatAmount(amountKobo: number) {
  return (amountKobo / 100).toFixed(2);
}

function csvEscape(value: string) {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value}"`;
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPrintHtml(input: {
  workspaceName: string;
  fromLabel: string;
  toLabel: string;
  vatCollected: number;
  vatPaid: number;
  vatPayable: number;
  vatCurrency: string;
  whtGross: number;
  whtTax: number;
  whtNet: number;
  whtCurrency: string;
  hasRecords: boolean;
}) {
  const {
    workspaceName,
    fromLabel,
    toLabel,
    vatCollected,
    vatPaid,
    vatPayable,
    vatCurrency,
    whtGross,
    whtTax,
    whtNet,
    whtCurrency,
    hasRecords,
  } = input;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaxBook VAT/WHT Filing Pack</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: #14213d;
        background: #f7f5f0;
      }
      .shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }
      .actions button {
        border: 1px solid #14213d;
        background: white;
        color: #14213d;
        border-radius: 999px;
        padding: 10px 16px;
        font: inherit;
        cursor: pointer;
      }
      .paper {
        background: white;
        border: 1px solid #d9d2c3;
        padding: 32px;
      }
      h1, h2 {
        margin: 0;
      }
      .subtitle {
        margin-top: 8px;
        color: #5a5f6a;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin: 24px 0 32px;
      }
      .meta-card,
      .summary-card {
        border: 1px solid #d9d2c3;
        padding: 16px;
      }
      .meta-label,
      .summary-label {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7280;
      }
      .meta-value,
      .summary-value {
        margin-top: 8px;
        font-size: 22px;
        font-weight: 700;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th, td {
        border-bottom: 1px solid #e5ded2;
        padding: 10px 0;
        text-align: left;
        font-size: 14px;
      }
      .note {
        margin-top: 24px;
        padding: 16px;
        background: #faf7ef;
        border: 1px solid #e5ded2;
        color: #5a5f6a;
        font-size: 14px;
      }
      @media print {
        body {
          background: white;
        }
        .shell {
          max-width: none;
          padding: 0;
        }
        .actions {
          display: none;
        }
        .paper {
          border: 0;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="actions">
        <button onclick="window.print()">Print / Save PDF</button>
        <button onclick="window.close()">Close</button>
      </div>
      <div class="paper">
        <h1>VAT &amp; WHT Filing Pack</h1>
        <p class="subtitle">Prepared from TaxBook workspace records for filing review.</p>

        <div class="meta">
          <div class="meta-card">
            <div class="meta-label">Workspace</div>
            <div class="meta-value">${escapeHtml(workspaceName)}</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">From</div>
            <div class="meta-value">${escapeHtml(fromLabel)}</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">To</div>
            <div class="meta-value">${escapeHtml(toLabel)}</div>
          </div>
        </div>

        ${
          hasRecords
            ? `<div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">VAT Collected</div>
            <div class="summary-value">${escapeHtml(vatCurrency)} ${formatAmount(vatCollected)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">VAT Paid</div>
            <div class="summary-value">${escapeHtml(vatCurrency)} ${formatAmount(vatPaid)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">VAT Payable</div>
            <div class="summary-value">${escapeHtml(vatCurrency)} ${formatAmount(vatPayable)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">WHT Total</div>
            <div class="summary-value">${escapeHtml(whtCurrency)} ${formatAmount(whtTax)}</div>
          </div>
        </div>

        <h2>WHT Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gross base</td>
              <td>${escapeHtml(whtCurrency)} ${formatAmount(whtGross)}</td>
            </tr>
            <tr>
              <td>WHT total</td>
              <td>${escapeHtml(whtCurrency)} ${formatAmount(whtTax)}</td>
            </tr>
            <tr>
              <td>Net amount</td>
              <td>${escapeHtml(whtCurrency)} ${formatAmount(whtNet)}</td>
            </tr>
          </tbody>
        </table>`
            : `<div class="note">No qualifying tax records were found for the selected date range.</div>`
        }

        <div class="note">
          VAT collected is derived from tax amounts on income records.
          VAT paid is derived from tax amounts on expense records.
          This pack is export-ready for review and printing, but it does not submit to FIRS.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "VIEWER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (!["csv", "print"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const workspace = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { name: true },
  });

  const { records, errorMsg } = await getWorkspaceTaxRecords(ctx.workspaceId, {
    fromParam,
    toParam,
  });
  if (errorMsg) {
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const filingSummary = summarizeTaxFiling(records);
  const vatCurrency = "NGN";
  const whtCurrency = resolveSummaryCurrency(filingSummary.whtTotals);

  await logAudit({
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.userId,
    action: "TAX_FILING_EXPORTED",
    metadata: {
      format,
      from: fromParam,
      to: toParam,
      vatCollected: filingSummary.vatCollected,
      vatPaid: filingSummary.vatPaid,
      vatPayable: filingSummary.vatPayable,
      whtTotal: filingSummary.whtTotals.tax,
    },
  });

  if (format === "print") {
    const html = renderPrintHtml({
      workspaceName: workspace?.name ?? `Workspace ${ctx.workspaceId}`,
      fromLabel: fromParam ?? "Beginning",
      toLabel: toParam ?? "Today",
      vatCollected: filingSummary.vatCollected,
      vatPaid: filingSummary.vatPaid,
      vatPayable: filingSummary.vatPayable,
      vatCurrency,
      whtGross: filingSummary.whtTotals.gross,
      whtTax: filingSummary.whtTotals.tax,
      whtNet: filingSummary.whtTotals.net,
      whtCurrency,
      hasRecords: records.length > 0,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  const lines = [
    ["TaxBook VAT/WHT Filing Summary"],
    ["Workspace", workspace?.name ?? `Workspace ${ctx.workspaceId}`],
    ["From", fromParam ?? "Beginning"],
    ["To", toParam ?? "Today"],
    [],
    ["Section", "Metric", "Amount", "Currency", "Notes"],
    [
      "VAT",
      "Collected",
      formatAmount(filingSummary.vatCollected),
      vatCurrency,
      "Derived from income record tax amounts",
    ],
    [
      "VAT",
      "Paid",
      formatAmount(filingSummary.vatPaid),
      vatCurrency,
      "Derived from expense record tax amounts",
    ],
    [
      "VAT",
      "Payable",
      formatAmount(filingSummary.vatPayable),
      vatCurrency,
      "VAT collected minus VAT paid",
    ],
    [
      "WHT",
      "Gross",
      formatAmount(filingSummary.whtTotals.gross),
      whtCurrency,
      "Gross amount from WHT records",
    ],
    [
      "WHT",
      "Total",
      formatAmount(filingSummary.whtTotals.tax),
      whtCurrency,
      "Computed withholding tax total",
    ],
    [
      "WHT",
      "Net",
      formatAmount(filingSummary.whtTotals.net),
      whtCurrency,
      "Net amount from WHT records",
    ],
  ]
    .map((row) => row.map((value) => csvEscape(String(value))).join(","))
    .join("\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=tax-filing-vat-wht.csv",
    },
  });
}
