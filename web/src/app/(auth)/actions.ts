"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import {
  consumeAuthToken,
  createAuthToken,
  createSession,
  destroyAllSessions,
  destroySession,
  checkPassword,
  getCurrentUser,
  grantBootstrapAdmin,
  hashPassword,
  safeNext,
} from "@/lib/auth";
import { isAcademicEmail, PDPA_CONSENT_VERSION, STATE_CODES, can } from "@/lib/config";
import { sendEmail, templates } from "@/lib/email";
import { audit } from "@/lib/audit";
import { invalid, keepValues, plain, type FormState } from "@/lib/form-state";
import { LIMITS, blockedFor, clearEmailAttempts, clientIp, emailIpKey, emailKey, ipKey, minutesText, recordAttempt } from "@/lib/rate-limit";

const emailField = z.string().trim().toLowerCase().email("Enter a valid email address.");
const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{9,16}$/, "Enter a valid phone number, e.g. 012-345 6789 or +60123456789.");
const passwordField = z.string().min(8, "Use at least 8 characters.").max(200);

const signupSchema = z
  .object({
    name: plain(z.string().trim().min(2, "Enter your full name.").max(120)),
    email: emailField,
    phone: phoneField,
    jobTitle: plain(z.string().trim().max(120)).optional(),
    organisation: plain(z.string().trim().max(160)).optional(),
    address: z.string().trim().min(5, "Enter your correspondence address.").max(400),
    stateCode: z.enum(STATE_CODES, { message: "Select your state." }),
    password: passwordField,
    confirmPassword: z.string(),
    tier: z.enum(["student", "individual", "corporate", ""]).optional(),
    consent: z.literal("yes", { message: "Please give your consent to continue." }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
  .refine((d) => d.tier !== "student" || isAcademicEmail(d.email), {
    path: ["email"],
    message: "A .edu or .edu.my email is required for Student membership. Please update your email or select another tier.",
  });

export async function signupAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const d = parsed.data;
  const ip = ipKey(await clientIp());
  const wait = await blockedFor("signup", ip, LIMITS.signupPerIp);
  if (wait) return { error: `Too many sign-up attempts from your network. Please try again in ${minutesText(wait)}.`, values: keepValues(data) };
  // Every attempt counts, so the "already registered" reply can't be used to test many addresses
  await recordAttempt("signup", [ip]);
  const db = await getDb();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, d.email));
  if (existing) {
    return { error: "An account with this email already exists. Please log in instead.", fieldErrors: { email: "Already registered." }, values: keepValues(data) };
  }
  const [user] = await db
    .insert(schema.users)
    .values({
      email: d.email,
      passwordHash: await hashPassword(d.password),
      name: d.name,
      phone: d.phone,
      jobTitle: d.jobTitle || null,
      organisation: d.organisation || null,
      address: d.address,
      stateCode: d.stateCode,
      consentAt: new Date(),
      consentVersion: PDPA_CONSENT_VERSION,
    })
    .returning();
  await audit(user.id, "user.signed_up", "user", user.id, { tier: d.tier });
  const token = await createAuthToken(user.id, "verify_email");
  await sendEmail(user.email, "verifyEmail", templates.verifyEmail(user.name, token), { userId: user.id });
  await createSession(user.id);
  redirect(`/check-email${d.tier ? `?tier=${d.tier}` : ""}`);
}

const loginSchema = z.object({ email: emailField, password: z.string().min(1, "Enter your password."), next: z.string().optional() });

export async function loginAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const ip = await clientIp();
  const keys = [emailIpKey(parsed.data.email, ip), emailKey(parsed.data.email), ipKey(ip)];
  const wait = Math.max(
    await blockedFor("login_failed", keys[0], LIMITS.loginPerEmailIp),
    await blockedFor("login_failed", keys[1], LIMITS.loginPerEmail),
    await blockedFor("login_failed", keys[2], LIMITS.loginPerIp),
  );
  if (wait) {
    return {
      error: `Too many failed login attempts. Please try again in ${minutesText(wait)}, or reset your password.`,
      values: keepValues(data),
    };
  }
  const db = await getDb();
  const [found] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  const ok = await checkPassword(parsed.data.password, found);
  if (!ok || !found || found.disabled) {
    await recordAttempt("login_failed", keys);
    return { error: "Incorrect email or password.", values: keepValues(data) };
  }
  await clearEmailAttempts("login_failed", found.email);
  const user = await grantBootstrapAdmin(found);
  await createSession(user.id);
  redirect(safeNext(parsed.data.next) ?? (can(user.role, "view") ? "/admin" : "/portal"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login?signedOut=1");
}

export async function resendVerificationAction(_: FormState): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/portal");
  const token = await createAuthToken(user.id, "verify_email");
  await sendEmail(user.email, "verifyEmail", templates.verifyEmail(user.name, token), { userId: user.id });
  return { ok: `We've sent a new confirmation link to ${user.email}.` };
}

export async function forgotPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z.object({ email: emailField }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const keys = [emailKey(parsed.data.email), ipKey(await clientIp())];
  const wait = await blockedFor("reset_request", keys[1], LIMITS.resetPerIp);
  if (wait) return { error: `Too many reset requests. Please try again in ${minutesText(wait)}.`, values: keepValues(data) };
  // Per-address limit is silent so the reply doesn't reveal whether an account exists
  const quiet = await blockedFor("reset_request", keys[0], LIMITS.resetPerEmail);
  await recordAttempt("reset_request", keys);
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (user && !user.disabled && !quiet) {
    const token = await createAuthToken(user.id, "reset_password");
    await sendEmail(user.email, "resetPassword", templates.resetPassword(user.name, token), { userId: user.id });
  }
  return { ok: "If an account exists for that email, we've sent a link to reset your password." };
}

const resetSchema = z
  .object({ token: z.string().min(10), password: passwordField, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });

export async function resetPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return invalid(data, parsed.error);
  const userId = await consumeAuthToken(parsed.data.token, "reset_password");
  if (!userId) return { error: "This reset link is invalid or has expired. Please request a new one." };
  const db = await getDb();
  // Opening the link proves the inbox belongs to them, so the email is verified too
  const [user] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  await destroyAllSessions(userId);
  await clearEmailAttempts("login_failed", user.email);
  await audit(userId, "user.password_reset", "user", userId);
  await createSession(user.id);
  redirect("/portal?passwordReset=1");
}
