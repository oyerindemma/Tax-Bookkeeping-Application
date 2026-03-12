import { NextResponse } from "next/server";
import { getAuthContext, requireRoleAtLeast } from "@/src/lib/auth";
import { logAudit } from "@/src/lib/audit";
import { getWorkspaceFeatureAccess } from "@/src/lib/billing";
import { getOpenAiServerConfig } from "@/src/lib/env";
import { logRouteError } from "@/src/lib/logger";
import { buildWorkspaceAssistantSnapshot } from "@/src/lib/accounting-assistant";

export const runtime = "nodejs";

type AssistantResponse = {
  answer: string;
  supportingMetrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  suggestedNextActions: string[];
};

function extractOutputText(data: unknown) {
  if (data && typeof data === "object" && "output_text" in data) {
    const value = (data as { output_text?: string }).output_text;
    if (typeof value === "string" && value.trim()) return value;
  }

  const output =
    data && typeof data === "object" && "output" in data
      ? (data as { output?: Array<{ content?: Array<{ text?: string }> }> }).output
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
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json(
        { error: "question must be 500 characters or less" },
        { status: 400 }
      );
    }

    const { apiKey, assistantModel } = getOpenAiServerConfig();
    const snapshot = await buildWorkspaceAssistantSnapshot(ctx.workspaceId);
    const model = assistantModel;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        answer: {
          type: "string",
          description: "A concise grounded answer for the user",
        },
        supportingMetrics: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              value: { type: "string" },
              detail: { type: "string" },
            },
            required: ["label", "value", "detail"],
          },
        },
        suggestedNextActions: {
          type: "array",
          maxItems: 4,
          items: {
            type: "string",
          },
        },
      },
      required: ["answer", "supportingMetrics", "suggestedNextActions"],
    };

    const prompt =
      "You are the AI accounting assistant for TaxBook, a Nigerian bookkeeping application. " +
      "Answer only from the workspace snapshot provided. " +
      "Do not invent clients, invoices, tax liabilities, balances, or dates that are not in the snapshot. " +
      "If the data is insufficient, say that clearly and explain what is missing. " +
      "Amounts ending in Kobo are in kobo; convert them to NGN with two decimals in your answer. " +
      "If a currency field is MIXED, say mixed currencies instead of assuming NGN. " +
      "Use concise business language. " +
      "Suggested next actions should be practical steps inside TaxBook. " +
      "Do not expose raw JSON or mention internal schema names unless needed.\n\n" +
      `User question:\n${question}\n\n` +
      `Workspace snapshot:\n${JSON.stringify(snapshot)}`;

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
            name: "accounting_assistant_response",
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

    let result: AssistantResponse;
    try {
      result = JSON.parse(outputText) as AssistantResponse;
    } catch {
      return NextResponse.json(
        { error: "AI response was not valid JSON" },
        { status: 500 }
      );
    }

    await logAudit({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: "AI_ACCOUNTING_ASSISTANT_USED",
      metadata: {
        question,
        supportingMetricsCount: result.supportingMetrics.length,
        suggestedNextActionsCount: result.suggestedNextActions.length,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logRouteError("ai accounting assistant failed", error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    });
    return NextResponse.json(
      { error: "Server error running accounting assistant" },
      { status: 500 }
    );
  }
}
