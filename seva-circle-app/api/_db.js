import { neon } from "@neondatabase/serverless";

// Vercel's Postgres/Neon integration auto-injects one of these when you add
// a database from the Storage tab. We check a couple of common names to be safe.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

export const sql = connectionString ? neon(connectionString) : null;

export function requireDb(res) {
  if (!sql) {
    res.status(200).json({ ok: false, error: "Database not connected yet — add a Postgres database in Vercel's Storage tab." });
    return false;
  }
  return true;
}
