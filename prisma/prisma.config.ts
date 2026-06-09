import { defineConfig } from "prisma/config"
import { config } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Resolve .env.local relative to the project root (one level up from
// this file). Prisma changes cwd when loading the config, so a bare
// relative path doesn't work.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
config({ path: resolve(projectRoot, ".env.local") })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export default defineConfig({
  schema: resolve(projectRoot, "prisma/schema.prisma"),
  migrations: {
    path: resolve(projectRoot, "prisma/migrations"),
  },
  datasource: {
    url: databaseUrl,
  },
})
