"use client";

import { useMemo, useState } from "react";
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
import { COMPANY_DETAILS } from "@/components/marketing/site-content";

const TOPIC_OPTIONS = [
  "Book a product demo",
  "Pricing and plan fit",
  "Accounting firm rollout",
  "Finance team rollout",
  "General enquiry",
] as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ContactInquiryForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<(typeof TOPIC_OPTIONS)[number]>(TOPIC_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`TaxBook AI enquiry: ${topic}`);
    const body = encodeURIComponent(
      [
        `Name: ${fullName || "-"}`,
        `Work email: ${email || "-"}`,
        `Company: ${company || "-"}`,
        `Topic: ${topic}`,
        "",
        "Message:",
        message || "-",
      ].join("\n")
    );

    return `mailto:${COMPANY_DETAILS.email}?subject=${subject}&body=${body}`;
  }, [company, email, fullName, message, topic]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      setError("Enter your name so we know who to reply to.");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError("Enter a valid work email.");
      return;
    }
    if (!message.trim()) {
      setError("Add a short note about your workflow or what you want to see.");
      return;
    }

    setError(null);
    window.location.href = mailtoHref;
  }

  return (
    <Card className="border-border/60 bg-white/90 shadow-xl shadow-primary/10">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
          Fastest contact path
        </Badge>
        <div className="space-y-2">
          <CardTitle>Send a launch enquiry</CardTitle>
          <CardDescription className="leading-6">
            Share your workflow, team shape, and what you want to see. This opens your email app
            with a prefilled message to the TaxBook AI team.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-full-name">Full name</Label>
              <Input
                id="contact-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">Work email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane@company.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-2">
              <Label htmlFor="contact-company">Company or firm</Label>
              <Input
                id="contact-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Atlas Trading Ltd"
                autoComplete="organization"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-topic">Topic</Label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(event) =>
                  setTopic(event.target.value as (typeof TOPIC_OPTIONS)[number])
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TOPIC_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-message">Message</Label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us about your current bookkeeping, reconciliation, tax, or rollout workflow."
              rows={6}
              className="min-h-[150px] rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit">Open email draft</Button>
            <Button asChild variant="outline">
              <a href={`mailto:${COMPANY_DETAILS.email}`}>Email directly</a>
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-dashed bg-background px-4 py-4 text-sm text-muted-foreground">
          Prefer direct contact? Email <span className="font-medium text-foreground">{COMPANY_DETAILS.email}</span>{" "}
          or call <span className="font-medium text-foreground">{COMPANY_DETAILS.phone}</span>.
        </div>
      </CardContent>
    </Card>
  );
}
