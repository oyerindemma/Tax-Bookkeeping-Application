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

function getSafeNextPath(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error ?? "Login failed");
        return;
      }

      router.push(nextPath ?? "/dashboard");
    } catch {
      setMsg("Network error");
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
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                New to TaxBook?{" "}
                <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Start with Free
                </Link>
              </p>
              <p>
                Need to compare plans first?{" "}
                <Link href="/pricing" className="font-medium text-foreground underline-offset-4 hover:underline">
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
