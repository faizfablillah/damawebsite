import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { can, type Permission, type Role } from "./config";

const COOKIE = "dama_session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Super admins are named by email in the environment (SUPER_ADMIN_EMAILS=a@x.com,b@y.com)
export function isBootstrapAdmin(email: string) {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  }
  jar.delete(COOKIE);
}

export async function destroyAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

// The signed-in user for this request (or null)
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
  if (!row || row.user.disabled) return null;
  return row.user;
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireVerifiedUser(next?: string): Promise<User> {
  const user = await requireUser(next);
  if (!user.emailVerifiedAt) redirect("/check-email");
  return user;
}

export async function requireAdmin(perm: Permission = "view"): Promise<User & { role: Role }> {
  const user = await requireUser("/admin");
  if (!can(user.role, perm)) {
    if (can(user.role, "view")) redirect("/admin?denied=1");
    redirect("/portal");
  }
  return user;
}

// One-time tokens for email verification and password reset
export async function createAuthToken(userId: string, purpose: "verify_email" | "reset_password") {
  const db = await getDb();
  const token = randomToken();
  const hours = purpose === "verify_email" ? 72 : 2;
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.purpose, purpose), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({
    userId,
    purpose,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + hours * 3_600_000),
  });
  return token;
}

export async function consumeAuthToken(token: string, purpose: "verify_email" | "reset_password") {
  const db = await getDb();
  const [row] = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.tokenHash, sha256(token)),
        eq(schema.authTokens.purpose, purpose),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  return row?.userId ?? null;
}
