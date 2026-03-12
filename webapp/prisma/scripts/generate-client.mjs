import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function inferProvider(databaseUrl) {
  if (!databaseUrl) return null;
  if (databaseUrl.startsWith("file:")) return "sqlite";
  if (databaseUrl.startsWith("postgres")) return "postgresql";
  return null;
}

const explicitProvider = (process.env.DATABASE_PROVIDER || "").trim().toLowerCase();
const databaseUrl = (process.env.DATABASE_URL || "").trim();
const provider = explicitProvider || inferProvider(databaseUrl) || "sqlite";
const schemaPath =
  provider === "postgresql" ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCommand, ["prisma", "generate", "--schema", schemaPath], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
