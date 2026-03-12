import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { getOpenAiServerConfig } from "@/src/lib/env";
import { logRouteError } from "@/src/lib/logger";

export const runtime = "nodejs";

const CATEGORY_GUIDANCE =
  "When a category fits, prefer one of these exact names: Office, Software, Utilities, Marketing, Transport, Rent, Miscellaneous.";

function extractOutputText(data: unknown) {
  if (data && typeof data === "object" && "output_text" in data) {
    const value = (data as { output_text?: string }).output_text;
    if (typeof value === "string" && value.trim()) return value;
  }

  const output =
    data && typeof data === "object" && "output" in data
      ? (data as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> })
          .output
      : undefined;

  if (!Array.isArray(output)) return null;

  const chunks: string[] = [];
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  const text = chunks.join("").trim();
  return text || null;
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await requireRoleAtLeast(ctx.workspaceId, "VIEWER");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const featureAccess = await getWorkspaceFeatureAccess(ctx.workspaceId, "AI_ASSISTANT");
  if (!featureAccess.ok) {
    return NextResponse.json(
      {
        error: featureAccess.error,
        currentPlan: featureAccess.plan,
        requiredPlan: featureAccess.requiredPlan,
      },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const { apiKey, model } = getOpenAiServerConfig();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: ["INCOME", "EXPENSE", "VAT", "WHT"],
        },
        amount: {
          type: "number",
          description: "Amount in major currency units (e.g., 1234.56)",
        },
        currency: {
          type: "string",
          description: "ISO currency code, default NGN",
        },
        date: {
          type: "string",
          description: "YYYY-MM-DD",
        },
        description: {
          type: "string",
          description: "Short summary",
        },
        category: {
          type: ["string", "null"],
          description: "Expense category name if available, otherwise null",
        },
        vendorName: {
          type: ["string", "null"],
          description: "Vendor or merchant name if available, otherwise null",
        },
        taxType: {
          type: "string",
          enum: ["VAT", "WHT", "NONE", "CUSTOM"],
        },
        suggestedTaxRate: {
          type: "number",
          description: "Percent 0-100",
        },
      },
      required: [
        "kind",
        "amount",
        "currency",
        "date",
        "description",
        "category",
        "vendorName",
        "taxType",
        "suggestedTaxRate",
      ],
    };

    const prompt =
      "Extract a tax record draft from this receipt text. " +
      "If missing, use currency NGN and suggestedTaxRate 0. " +
      "Return the best guess for kind and taxType. " +
      `${CATEGORY_GUIDANCE} ` +
      "If you can infer a category or vendor name, include them.\n\nReceipt text:\n" +
      text;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "tax_record_draft",
            strict: true,
            schema,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "AI request failed" },
        { status: 500 }
      );
    }

    const outputText = extractOutputText(data);
    if (!outputText) {
      return NextResponse.json(
        { error: "AI response missing output" },
        { status: 500 }
      );
    }

    let draft: unknown;
    try {
      draft = JSON.parse(outputText);
    } catch {
      return NextResponse.json(
        { error: "AI response was not valid JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json({ draft });
  } catch (error) {
    logRouteError("ai tax record draft failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      { error: "Server error generating draft" },
      { status: 500 }
    );
  }
}
