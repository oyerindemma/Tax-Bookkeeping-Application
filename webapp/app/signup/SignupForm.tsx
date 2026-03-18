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

type FieldErrors = Partial<
  Record<"fullName" | "email" | "password" | "confirmPassword", string>
>;

function getSafeNextPath(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const nextPath = getSafeNextPath(searchParams.get("next"));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error ?? "Signup failed.");
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
            Start Free
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Create your TaxBook AI workspace.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Start with manual bookkeeping, invoices, VAT visibility, and reports, then upgrade when
            you need AI capture or reconciliation workflows.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Included from day one</CardDescription>
                <CardTitle className="text-lg">Bookkeeping, invoices, VAT and WHT visibility</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Upgrade when you are ready</CardDescription>
                <CardTitle className="text-lg">AI capture, reconciliation, and team workflows</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card className="border-border/60 bg-white/90 shadow-xl shadow-primary/10">
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Set up your account and continue into your TaxBook AI workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  aria-invalid={fieldErrors.fullName ? "true" : "false"}
                />
                {fieldErrors.fullName ? (
                  <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
                ) : null}
              </div>

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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldErrors.password ? "true" : "false"}
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters with one letter and one number.
                </p>
                {fieldErrors.password ? (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
                />
                {fieldErrors.confirmPassword ? (
                  <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                ) : null}
              </div>

              {message ? <p className="text-sm text-destructive">{message}</p> : null}

              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Login
                </Link>
              </p>
              <p>
                Need to review plan fit first?{" "}
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
