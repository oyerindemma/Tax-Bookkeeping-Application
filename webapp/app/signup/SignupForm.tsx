"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error ?? "Signup failed");
        return;
      }

      router.push("/login");
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
            Start Free
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Create your TaxBook workspace.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Start managing invoices, expenses, taxes, receipts, and reports in one intelligent
            workspace.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Included from day one</CardDescription>
                <CardTitle className="text-lg">Invoices, reports, AI receipt scans</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription>Built for collaboration</CardDescription>
                <CardTitle className="text-lg">Workspace roles and audit logs</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card className="border-border/60 bg-white/90 shadow-xl shadow-primary/10">
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Set up your account and continue into the TaxBook onboarding flow.
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
                />
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
                />
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
                />
              </div>

              {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

              <Button disabled={loading} type="submit" className="w-full">
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Login
                </Link>
              </p>
              <p>
                Need to review plan fit first?{" "}
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
