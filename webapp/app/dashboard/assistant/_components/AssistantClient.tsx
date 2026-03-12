"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AssistantResult = {
  answer: string;
  supportingMetrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  suggestedNextActions: string[];
};

type Props = {
  workspaceName: string;
};

const EXAMPLE_PROMPTS = [
  "How much VAT do I owe this month?",
  "Which client owes me money?",
  "What are my biggest expenses?",
  "Summarize my invoices due this week.",
];

export default function AssistantClient({ workspaceName }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Enter a question.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/accounting-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unable to run assistant");
        return;
      }

      setResult({
        answer: data.answer,
        supportingMetrics: Array.isArray(data.supportingMetrics)
          ? data.supportingMetrics
          : [],
        suggestedNextActions: Array.isArray(data.suggestedNextActions)
          ? data.suggestedNextActions
          : [],
      });
    } catch {
      setError("Network error running assistant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ask a workspace question</CardTitle>
          <CardDescription>
            Answers are grounded in the current data for{" "}
            <span className="font-medium text-foreground">{workspaceName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Ask about VAT, outstanding invoices, clients, or expenses..."
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Thinking..." : "Ask assistant"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setQuestion("");
                  setResult(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Example prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Beta note: responses use current workspace data only and should still be reviewed
            before filing or sending anything externally.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
              <CardDescription>
                Grounded response for the active workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground">{result.answer}</p>
            </CardContent>
          </Card>

          {result.supportingMetrics.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.supportingMetrics.map((metric) => (
                <Card key={`${metric.label}-${metric.value}`}>
                  <CardHeader className="pb-2">
                    <CardDescription>{metric.label}</CardDescription>
                    <CardTitle className="text-lg">{metric.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {metric.detail}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.suggestedNextActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested next actions</CardTitle>
                <CardDescription>Useful follow-ups inside TaxBook.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {result.suggestedNextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
