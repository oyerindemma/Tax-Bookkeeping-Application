import "server-only";

export type DatabaseProvider = "sqlite" | "postgresql";

type EnvironmentHealth = {
  databaseProvider: DatabaseProvider;
  appUrl: string;
  allowStubPayments: boolean;
  hasOpenAiKey: boolean;
  hasPaystackKey: boolean;
  missing: string[];
  warnings: string[];
};

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function hasAnyEnv(names: string[]) {
  return names.some((name) => Boolean(readEnv(name)));
}

function requireEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function inferDatabaseProviderFromUrl(databaseUrl: string): DatabaseProvider | null {
  if (!databaseUrl) return null;
  if (databaseUrl.startsWith("file:")) return "sqlite";
  if (databaseUrl.startsWith("postgres")) return "postgresql";
  return null;
}

function isVercelEnvironment() {
  return Boolean(readEnv("VERCEL") || readEnv("VERCEL_ENV") || readEnv("VERCEL_URL"));
}

export function getDatabaseProvider(): DatabaseProvider {
  const explicit = readEnv("DATABASE_PROVIDER").toLowerCase();
  if (explicit) {
    if (explicit === "sqlite" || explicit === "postgresql") {
      return explicit;
    }
    throw new Error("DATABASE_PROVIDER must be sqlite or postgresql");
  }

  return inferDatabaseProviderFromUrl(readEnv("DATABASE_URL")) ?? (isVercelEnvironment() ? "postgresql" : "sqlite");
}

export function validateDatabaseEnvironment() {
  const provider = getDatabaseProvider();
  const databaseUrl = requireEnv("DATABASE_URL");
  const directUrl = readEnv("DIRECT_URL");

  if (provider === "sqlite" && !databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must start with file: when DATABASE_PROVIDER=sqlite");
  }

  if (provider === "postgresql" && !databaseUrl.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL connection string when DATABASE_PROVIDER=postgresql"
    );
  }

  if (
    provider === "postgresql" &&
    directUrl &&
    !directUrl.startsWith("postgres")
  ) {
    throw new Error(
      "DIRECT_URL must be a PostgreSQL connection string when DATABASE_PROVIDER=postgresql"
    );
  }

  return {
    provider,
    databaseUrl,
    directUrl: directUrl || databaseUrl,
  };
}

export function getAppUrl() {
  const fallback = "http://localhost:3000";
  const raw = readEnv("APP_URL") || fallback;

  try {
    const url = new URL(raw);
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("APP_URL must be a valid absolute URL");
  }
}

export function getOpenAiServerConfig() {
  return {
    apiKey: requireEnv("OPENAI_API_KEY"),
    model: readEnv("OPENAI_MODEL") || "gpt-4o-mini",
    visionModel:
      readEnv("OPENAI_VISION_MODEL") || readEnv("OPENAI_MODEL") || "gpt-4o-mini",
    assistantModel:
      readEnv("OPENAI_ASSISTANT_MODEL") ||
      readEnv("OPENAI_MODEL") ||
      "gpt-4o-mini",
  };
}

export function hasOpenAiServerConfig() {
  return Boolean(readEnv("OPENAI_API_KEY"));
}

export function getPaystackServerConfig() {
  return {
    secretKey: requireEnv("PAYSTACK_SECRET_KEY"),
    webhookSecret: readEnv("PAYSTACK_WEBHOOK_SECRET") || requireEnv("PAYSTACK_SECRET_KEY"),
  };
}

export function hasPaystackServerConfig() {
  return Boolean(readEnv("PAYSTACK_SECRET_KEY"));
}

export function getPaymentRuntimeConfig() {
  return {
    webhookSecret: readEnv("PAYMENT_WEBHOOK_SECRET") || null,
    allowStubPayments:
      process.env.NODE_ENV !== "production" || readEnv("ALLOW_STUB_PAYMENTS") === "true",
  };
}

export function getEnvironmentHealth(): EnvironmentHealth {
  const provider = getDatabaseProvider();
  const missing: string[] = [];
  const warnings: string[] = [];
  const smtpEnvNames = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];
  const hasPasswordResetEmailConfig = smtpEnvNames.every((name) => Boolean(readEnv(name)));

  if (!readEnv("DATABASE_URL")) missing.push("DATABASE_URL");
  if (!readEnv("APP_URL")) warnings.push("APP_URL not set; defaulting to http://localhost:3000");
  if (!readEnv("OPENAI_API_KEY")) warnings.push("OPENAI_API_KEY not set; AI features will be unavailable");
  if (!readEnv("OPENAI_MODEL")) warnings.push("OPENAI_MODEL not set; defaulting to gpt-4o-mini");
  if (!readEnv("PAYSTACK_SECRET_KEY")) {
    warnings.push("PAYSTACK_SECRET_KEY not set; billing checkout will be unavailable");
  }
  if (!readEnv("PAYSTACK_WEBHOOK_SECRET")) {
    warnings.push(
      "PAYSTACK_WEBHOOK_SECRET not set; webhook signature verification will fall back to PAYSTACK_SECRET_KEY"
    );
  }
  if (!hasAnyEnv(["PAYSTACK_PLAN_GROWTH"])) {
    warnings.push("PAYSTACK_PLAN_GROWTH not set; Growth monthly checkout will be unavailable");
  }
  if (!hasAnyEnv(["PAYSTACK_PLAN_GROWTH_ANNUAL"])) {
    warnings.push("PAYSTACK_PLAN_GROWTH_ANNUAL not set; Growth annual checkout will be unavailable");
  }
  if (!hasAnyEnv(["PAYSTACK_PLAN_PROFESSIONAL", "PAYSTACK_PLAN_BUSINESS"])) {
    warnings.push(
      "PAYSTACK_PLAN_PROFESSIONAL or PAYSTACK_PLAN_BUSINESS not set; Professional monthly checkout will be unavailable"
    );
  }
  if (!hasAnyEnv(["PAYSTACK_PLAN_PROFESSIONAL_ANNUAL", "PAYSTACK_PLAN_BUSINESS_ANNUAL"])) {
    warnings.push(
      "PAYSTACK_PLAN_PROFESSIONAL_ANNUAL or PAYSTACK_PLAN_BUSINESS_ANNUAL not set; Professional annual checkout will be unavailable"
    );
  }
  if (!hasAnyEnv(["PAYSTACK_PLAN_ENTERPRISE", "PAYSTACK_PLAN_ACCOUNTANT"])) {
    warnings.push(
      "PAYSTACK_PLAN_ENTERPRISE not set; Enterprise checkout automation remains unavailable and sales-led"
    );
  }
  if (!hasPasswordResetEmailConfig) {
    warnings.push(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM are not fully configured; password reset emails will only preview locally and will fail in production"
    );
  }

  return {
    databaseProvider: provider,
    appUrl: getAppUrl(),
    allowStubPayments: getPaymentRuntimeConfig().allowStubPayments,
    hasOpenAiKey: Boolean(readEnv("OPENAI_API_KEY")),
    hasPaystackKey: Boolean(readEnv("PAYSTACK_SECRET_KEY")),
    missing,
    warnings,
  };
}
