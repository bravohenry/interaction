import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  schema: "./src/server/db/schema",
  out: "./src/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: `mysql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}/openpoke?ssl={"rejectUnauthorized":true}`,
  },
  strict: false,
});
