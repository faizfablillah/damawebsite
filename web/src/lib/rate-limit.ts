import "server-only";
import { headers } from "next/headers";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";

// Attempts are counted in the database so limits hold across serverless instances.
type Kind = (typeof schema.authAttempts.$inferInsert)["kind"];

export const LIMITS = {
  // Failed logins: per account and per network address
  loginPerEmail: { max: 5, minutes: 15 },
  loginPerIp: { max: 30, minutes: 15 },
  // Password-reset emails
  resetPerEmail: { max: 3, minutes: 60 },
  resetPerIp: { max: 10, minutes: 60 },
  // New accounts from one network address
  signupPerIp: { max: 20, minutes: 60 },
} as const;

export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || "unknown";
}

export const emailKey = (email: string) => `email:${email.toLowerCase()}`;
export const ipKey = (ip: string) => `ip:${ip}`;

// Minutes until the oldest counted attempt leaves the window, or 0 if under the limit
export async function blockedFor(kind: Kind, key: string, limit: { max: number; minutes: number }): Promise<number> {
  const db = await getDb();
  const since = new Date(Date.now() - limit.minutes * 60_000);
  const rows = await db
    .select({ createdAt: schema.authAttempts.createdAt })
    .from(schema.authAttempts)
    .where(and(eq(schema.authAttempts.kind, kind), eq(schema.authAttempts.key, key), gte(schema.authAttempts.createdAt, since)))
    .orderBy(schema.authAttempts.createdAt);
  if (rows.length < limit.max) return 0;
  const freeAt = rows[rows.length - limit.max].createdAt.getTime() + limit.minutes * 60_000;
  return Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000));
}

export async function recordAttempt(kind: Kind, keys: string[]) {
  const db = await getDb();
  await db.insert(schema.authAttempts).values(keys.map((key) => ({ kind, key })));
}

export async function clearAttempts(kind: Kind, keys: string[]) {
  const db = await getDb();
  await db.delete(schema.authAttempts).where(and(eq(schema.authAttempts.kind, kind), inArray(schema.authAttempts.key, keys)));
}

export async function pruneAttempts() {
  const db = await getDb();
  await db.delete(schema.authAttempts).where(lt(schema.authAttempts.createdAt, new Date(Date.now() - 86_400_000)));
}

export const minutesText = (m: number) => (m === 1 ? "1 minute" : `${m} minutes`);
