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
    const formData = await req.formData();
    const file = formData.get("image");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "image must be a valid image file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const { apiKey, visionModel: model } = getOpenAiServerConfig();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        amount: {
          type: "number",
          description: "Total amount in major currency units (e.g., 1234.56)",
        },
        taxRate: {
          type: "number",
          description: "Tax rate percentage 0-100 (use 0 if not present)",
        },
        date: {
          type: "string",
          description: "YYYY-MM-DD",
        },
        description: {
          type: "string",
          description: "Short summary of the receipt",
        },
        category: {
          type: ["string", "null"],
          description: "Expense category name if available, otherwise null",
        },
        vendorName: {
          type: ["string", "null"],
          description: "Vendor or merchant name if available, otherwise null",
        },
        type: {
          type: "string",
          enum: ["INCOME", "EXPENSE"],
        },
      },
      required: [
        "amount",
        "taxRate",
        "date",
        "description",
        "category",
        "vendorName",
        "type",
      ],
    };

    const prompt =
      "Analyze this receipt image and extract the fields: amount, taxRate, " +
      "date (YYYY-MM-DD), description, type (INCOME or EXPENSE), category, vendorName. " +
      "If the tax rate is missing, set taxRate to 0. " +
      "If the type is unclear, choose EXPENSE. " +
      `${CATEGORY_GUIDANCE} ` +
      "Category and vendorName are optional if not visible.";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
        temperature: 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "receipt_scan",
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
    logRouteError("ai receipt scan failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      { error: "Server error scanning receipt" },
      { status: 500 }
    );
  }
}
