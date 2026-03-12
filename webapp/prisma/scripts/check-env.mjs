import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const allowedProviders = new Set(["sqlite", "postgresql"]);

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const explicitProvider = (process.env.DATABASE_PROVIDER || "").trim().toLowerCase();
const inferProvider = (value) => {
  if (!value) return null;
  if (value.startsWith("file:")) return "sqlite";
  if (value.startsWith("postgres")) return "postgresql";
  return null;
};
const provider = explicitProvider || inferProvider(databaseUrl) || "sqlite";
const directUrl = (process.env.DIRECT_URL || "").trim();
const appUrl = (process.env.APP_URL || "http://localhost:3000").trim();

const errors = [];
const warnings = [];

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

if (!process.env.PAYSTACK_PLAN_GROWTH) {
  warnings.push("PAYSTACK_PLAN_GROWTH is not set; Growth checkout will be unavailable");
}

if (!process.env.PAYSTACK_PLAN_BUSINESS) {
  warnings.push("PAYSTACK_PLAN_BUSINESS is not set; Business checkout will be unavailable");
}

if (!process.env.PAYSTACK_PLAN_ACCOUNTANT) {
  warnings.push("PAYSTACK_PLAN_ACCOUNTANT is not set; Accountant checkout will be unavailable");
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
