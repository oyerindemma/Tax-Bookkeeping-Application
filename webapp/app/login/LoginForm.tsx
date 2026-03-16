"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = Partial<Record<"email" | "password", string>>;

function getSafeNextPath(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const resetSuccess = searchParams.get("reset") === "success";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error ?? "Login failed.");
        setFieldErrors((data?.fieldErrors ?? {}) as FieldErrors);
        return;
      }

      router.replace(nextPath ?? "/dashboard");
      router.refresh();
    } catch {
      setMessage("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.85fr)] lg:items-center">
        <div className="space-y-5">
          <Badge variant="secondary" className="rounded-full px-4 py-1.5">
            Login
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Return to your accounting workspace.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Pick up invoices, expenses, taxes, receipts, and reports right where your team left
            them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Workspace context</CardDescription>
                <CardTitle className="text-lg">Role-aware access</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Operational continuity</CardDescription>
                <CardTitle className="text-lg">Audit-ready history</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card className="border-border/60 bg-white/90 shadow-xl shadow-primary/10">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use the email and password associated with your TaxBook account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {resetSuccess ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Your password has been reset. Log in with your new password.
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                />
                {fieldErrors.email ? (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldErrors.password ? "true" : "false"}
                />
                {fieldErrors.password ? (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                ) : null}
              </div>

              {message ? <p className="text-sm text-destructive">{message}</p> : null}

              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Signing in..." : "Login"}
              </Button>
            </form>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                New to TaxBook?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Start with Free
                </Link>
              </p>
              <p>
                Need to compare plans first?{" "}
                <Link
                  href="/pricing"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  View pricing
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
