import { defineConfig } from "prisma/config";
import { loadDotEnv, preparePrismaBuildEnvironment } from "./prisma/scripts/prisma-build-env.mjs";

loadDotEnv();

const { env, schemaPath } = preparePrismaBuildEnvironment(process.env);
Object.assign(process.env, env);

export default defineConfig({
  schema: `./${schemaPath}`,
});
