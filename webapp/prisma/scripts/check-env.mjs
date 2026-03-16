import { loadDotEnv, resolveDatabaseProvider } from "./prisma-build-env.mjs";

loadDotEnv();

const allowedProviders = new Set(["sqlite", "postgresql"]);

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const provider = resolveDatabaseProvider(process.env);
const directUrl = (process.env.DIRECT_URL || "").trim();
const appUrl = (process.env.APP_URL || "http://localhost:3000").trim();

const errors = [];
const warnings = [];

function hasAnyEnv(names) {
  return names.some((name) => Boolean(process.env[name]));
}

if (!allowedProviders.has(provider)) {
  errors.push("DATABASE_PROVIDER must be sqlite or postgresql");
}

if (!databaseUrl) {
  errors.push("DATABASE_URL is required");
} else if (provider === "sqlite" && !databaseUrl.startsWith("file:")) {
  errors.push("DATABASE_URL must start with file: for sqlite");
} else if (provider === "postgresql" && !databaseUrl.startsWith("postgres")) {
  errors.push("DATABASE_URL must be a PostgreSQL connection string for postgresql");
}

if (directUrl) {
  if (provider === "sqlite" && !directUrl.startsWith("file:")) {
    errors.push("DIRECT_URL must start with file: for sqlite");
  }
  if (provider === "postgresql" && !directUrl.startsWith("postgres")) {
    errors.push("DIRECT_URL must be a PostgreSQL connection string for postgresql");
  }
}

try {
  new URL(appUrl);
} catch {
  errors.push("APP_URL must be a valid absolute URL");
}

if (!process.env.OPENAI_API_KEY) {
  warnings.push("OPENAI_API_KEY is not set; AI features will be unavailable");
}

if (!process.env.OPENAI_MODEL) {
  warnings.push("OPENAI_MODEL is not set; defaulting to gpt-4o-mini");
}

if (!process.env.PAYSTACK_SECRET_KEY) {
  warnings.push("PAYSTACK_SECRET_KEY is not set; billing checkout will be unavailable");
}

if (!process.env.PAYSTACK_WEBHOOK_SECRET) {
  warnings.push(
    "PAYSTACK_WEBHOOK_SECRET is not set; webhook signature verification will fall back to PAYSTACK_SECRET_KEY"
  );
}

if (!hasAnyEnv(["PAYSTACK_PLAN_GROWTH"])) {
  warnings.push("PAYSTACK_PLAN_GROWTH is not set; Growth monthly checkout will be unavailable");
}

if (!hasAnyEnv(["PAYSTACK_PLAN_GROWTH_ANNUAL"])) {
  warnings.push("PAYSTACK_PLAN_GROWTH_ANNUAL is not set; Growth annual checkout will be unavailable");
}

if (!hasAnyEnv(["PAYSTACK_PLAN_PROFESSIONAL", "PAYSTACK_PLAN_BUSINESS"])) {
  warnings.push(
    "PAYSTACK_PLAN_PROFESSIONAL or PAYSTACK_PLAN_BUSINESS is not set; Professional monthly checkout will be unavailable"
  );
}

if (!hasAnyEnv(["PAYSTACK_PLAN_PROFESSIONAL_ANNUAL", "PAYSTACK_PLAN_BUSINESS_ANNUAL"])) {
  warnings.push(
    "PAYSTACK_PLAN_PROFESSIONAL_ANNUAL or PAYSTACK_PLAN_BUSINESS_ANNUAL is not set; Professional annual checkout will be unavailable"
  );
}

if (!hasAnyEnv(["PAYSTACK_PLAN_ENTERPRISE", "PAYSTACK_PLAN_ACCOUNTANT"])) {
  warnings.push(
    "PAYSTACK_PLAN_ENTERPRISE is not set; Enterprise checkout automation remains unavailable and sales-led"
  );
}

console.log(
  JSON.stringify(
    {
      databaseProvider: provider,
      appUrl,
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      hasPaystackKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
      errors,
      warnings,
    },
    null,
    2
  )
);

if (errors.length > 0) {
  process.exit(1);
}
