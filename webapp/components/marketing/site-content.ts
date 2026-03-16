import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Headphones,
  Layers3,
  Mail,
  MapPin,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

export const MARKETING_HEADLINE = "AI Accounting for Modern African Businesses";

export const MARKETING_SUBHEADLINE =
  "Manage invoices, expenses, taxes, receipts, and reports in one intelligent workspace.";

export const MARKETING_NAME = "TaxBook";

export const MARKETING_TAGLINE = "AI accounting for African business operators";

export const MARKETING_NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

export const COMPANY_DETAILS = {
  email: "hello@taxbook.africa",
  phone: "+234 700 000 0000",
  location: "Lagos, Nigeria",
};

type IconCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const HERO_STATS = [
  { label: "Launch-ready workflows", value: "7 core modules" },
  { label: "Workspace roles", value: "Owner, Admin, Member, Viewer" },
  { label: "Compliance visibility", value: "VAT, WHT, reports" },
];

export const PROBLEM_POINTS: IconCard[] = [
  {
    icon: Layers3,
    title: "Finance work is spread across too many tools",
    description:
      "Invoices, expenses, taxes, and reports often live in separate apps and spreadsheets that drift out of sync.",
  },
  {
    icon: Calculator,
    title: "Tax exposure shows up late",
    description:
      "Teams usually discover VAT or WHT gaps when reporting is already due and the cleanup work is expensive.",
  },
  {
    icon: Users,
    title: "Multi-business collaboration gets risky",
    description:
      "Firms and finance teams need clean workspace boundaries, role controls, and reviewable history across every operator.",
  },
];

export const SOLUTION_PILLARS: IconCard[] = [
  {
    icon: Sparkles,
    title: "AI-assisted capture that stays reviewable",
    description:
      "Use AI receipt scanning and draft suggestions to speed up capture without losing human review over categories, vendors, and tax values.",
  },
  {
    icon: Building2,
    title: "One workspace for daily accounting operations",
    description:
      "Keep tax records, invoices, clients, reports, and team activity connected inside the active business context.",
  },
  {
    icon: ShieldCheck,
    title: "Controls built for real finance teams",
    description:
      "Workspace roles and audit logs make it easier to collaborate confidently as the business or client portfolio grows.",
  },
];

export const FEATURE_HIGHLIGHTS: IconCard[] = [
  {
    icon: ReceiptText,
    title: "Tax records and expense capture",
    description:
      "Track vendors, categories, recurring flags, tax values, and supporting notes from a single expense workflow.",
  },
  {
    icon: WalletCards,
    title: "Invoices, clients, and collections",
    description:
      "Create invoices, manage clients, issue payment links, and keep receivables connected to the accounting record.",
  },
  {
    icon: FileSpreadsheet,
    title: "Reports built for tax visibility",
    description:
      "Generate operational summaries, export-ready VAT and WHT views, and finance packs that are easy to review.",
  },
  {
    icon: Bot,
    title: "AI receipt scanning and assistant workflows",
    description:
      "Scan receipts into drafts and ask grounded questions about invoices, cash flow, and tax trends inside each workspace.",
  },
  {
    icon: Users,
    title: "Workspace and team roles",
    description:
      "Switch between businesses, invite teammates, and keep permissions aligned to how the finance team actually works.",
  },
  {
    icon: ShieldCheck,
    title: "Audit trails by default",
    description:
      "Track operational actions across workspaces so approvals, edits, and reporting changes stay traceable.",
  },
];

export const PREVIEW_CARDS = [
  {
    eyebrow: "Overview",
    title: "A live dashboard for revenue, expense, and tax pressure",
    description:
      "Monitor cash collected, invoices at risk, and the latest filing picture without exporting data into a separate tracker.",
    accentClassName: "from-emerald-50 via-background to-amber-50",
    rows: [
      { label: "Cash collected", value: "NGN 12.4m" },
      { label: "Outstanding invoices", value: "NGN 1.08m" },
      { label: "VAT payable", value: "NGN 842k" },
    ],
  },
  {
    eyebrow: "Operations",
    title: "Invoices, clients, and receipts stay connected",
    description:
      "Work from the same workspace record when creating invoices, reviewing receipt drafts, or following up on unpaid balances.",
    accentClassName: "from-sky-50 via-background to-background",
    rows: [
      { label: "Active clients", value: "38" },
      { label: "Receipt drafts awaiting review", value: "11" },
      { label: "Recurring invoices scheduled", value: "6" },
    ],
  },
  {
    eyebrow: "Control",
    title: "Roles, reports, and audit history in the same flow",
    description:
      "Move from transaction entry to filing export with workspace roles and audit coverage already in place.",
    accentClassName: "from-amber-50 via-background to-emerald-50",
    rows: [
      { label: "Workspace members", value: "5 active" },
      { label: "Audit events this week", value: "127" },
      { label: "Reports ready to export", value: "4" },
    ],
  },
];

export const FEATURE_PILLARS = [
  {
    title: "Daily accounting operations",
    description: "Run the recurring work that keeps finance teams in control day to day.",
    items: [
      "Tax records with categories, vendors, recurring flags, and tax values",
      "Client management linked directly to invoice and payment activity",
      "Invoice creation, payment links, recurring billing, and status tracking",
      "Bank imports and reconciliation support for cleaner reporting workflows",
    ],
  },
  {
    title: "Reporting and tax readiness",
    description: "Keep VAT and WHT preparation close to the underlying records.",
    items: [
      "Reports that turn raw activity into clear income, expense, and tax summaries",
      "Tax filing exports for VAT and WHT review packs",
      "Printable and CSV-ready outputs for external review or internal controls",
      "Workspace-scoped visibility so teams know exactly which business they are reporting on",
    ],
  },
  {
    title: "Automation and intelligence",
    description: "Use AI where it reduces manual work without obscuring decisions.",
    items: [
      "AI receipt scanning that drafts structured fields from uploaded images",
      "Text-to-record drafting for faster expense entry",
      "A workspace-aware accounting assistant for operational questions",
      "Suggested actions and grounded metrics to support finance follow-up",
    ],
  },
];

export const FEATURE_WORKFLOWS: IconCard[] = [
  {
    icon: ReceiptText,
    title: "From receipt to reviewed record",
    description:
      "Capture a receipt, draft the details with AI, review the values, and save a structured expense without retyping everything by hand.",
  },
  {
    icon: WalletCards,
    title: "From invoice to confirmed cash",
    description:
      "Create invoices, track due dates, send payment links, and follow the balance through to collection inside the same workflow.",
  },
  {
    icon: BarChart3,
    title: "From bookkeeping to report pack",
    description:
      "Turn daily operational entries into board-ready summaries and tax filing exports from the same workspace data.",
  },
  {
    icon: Repeat2,
    title: "From one business to many",
    description:
      "Move cleanly between workspaces, keep client portfolios separated, and give each team member the right level of access.",
  },
];

export const GOVERNANCE_FEATURES: IconCard[] = [
  {
    icon: ShieldCheck,
    title: "Role-based collaboration",
    description:
      "Owners, admins, members, and viewers can work from the same system without blurring who should edit what.",
  },
  {
    icon: CheckCircle2,
    title: "Audit history that supports review",
    description:
      "Operational actions remain visible so it is easier to explain what changed, when, and by whom.",
  },
  {
    icon: Building2,
    title: "Workspace isolation that scales",
    description:
      "Each business or client workspace stays distinct, which matters for firms and teams operating across multiple entities.",
  },
];

export const PRICING_INCLUSIONS = [
  "Core bookkeeping, VAT summary, and reporting from day one",
  "Workspace-scoped accounting workflows for Nigerian businesses and firms",
  "Upgrade paths for AI bookkeeping, banking reconciliation, and tax filing",
  "Add-on-ready billing structure for extra businesses, scans, and filing automation",
];

export const PRICING_FAQ = [
  {
    question: "Can I start without speaking to sales?",
    answer:
      "Yes. Starter is free to begin with, Growth and Professional remain self-serve where billing is configured, and Enterprise stays sales-led.",
  },
  {
    question: "Which features are reserved for paid plans?",
    answer:
      "Starter covers manual bookkeeping, VAT summaries, and basic reports. Growth unlocks AI receipt scanning and bookkeeping automation, while Professional adds banking reconciliation, team collaboration, audit logs, and the tax filing assistant.",
  },
  {
    question: "When should I upgrade beyond Starter?",
    answer:
      "Upgrade when you need more businesses under one workspace, more AI scan capacity, banking reconciliation, or multi-user accounting workflows.",
  },
];

export const CONTACT_PATHS = [
  {
    icon: CalendarDays,
    title: "Book a product walkthrough",
    description:
      "See invoices, expenses, taxes, receipts, reports, team roles, and audit logs in a live launch-ready workflow.",
    href: "mailto:hello@taxbook.africa?subject=Book%20a%20TaxBook%20Demo",
    cta: "Book Demo",
  },
  {
    icon: Mail,
    title: "Contact sales",
    description:
      "Discuss rollout fit for one business, a finance team, or a multi-client accounting practice.",
    href: "mailto:hello@taxbook.africa?subject=TaxBook%20Sales%20Inquiry",
    cta: "Email Sales",
  },
  {
    icon: Headphones,
    title: "Get launch support",
    description:
      "Use this path for onboarding questions, pricing fit, or support around your operating model.",
    href: "mailto:hello@taxbook.africa?subject=TaxBook%20Launch%20Support",
    cta: "Contact Support",
  },
];

export const CONTACT_EXPECTATIONS = [
  "Typical response target: within one business day for launch and sales enquiries.",
  "Primary launch focus: Nigerian businesses with workflows that scale across African operations.",
  "Best-fit conversations: founders, finance leads, controllers, and accounting firms.",
];

export const CONTACT_CHECKLIST = [
  {
    icon: Clock3,
    title: "Share your current workflow",
    description:
      "Tell us how you currently handle invoices, expenses, reports, and tax preparation so the demo stays grounded.",
  },
  {
    icon: Users,
    title: "Outline who needs access",
    description:
      "The right plan depends on how many operators, reviewers, and business entities need to collaborate.",
  },
  {
    icon: MapPin,
    title: "Flag any regional or tax constraints",
    description:
      "That helps us frame the right rollout approach, reporting expectations, and migration path from spreadsheets or other tools.",
  },
];
