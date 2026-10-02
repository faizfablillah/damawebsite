import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const OUTBOX = path.resolve(".data-test", "outbox");

type Mail = { to: string; template: string; subject: string; text: string; attachments: string[]; file: string };

export function mails(to?: string, template?: string): Mail[] {
  if (!fs.existsSync(OUTBOX)) return [];
  return fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ ...JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8")), file: f }) as Mail)
    .filter((m) => (!to || m.to === to) && (!template || m.template === template));
}

export async function lastMail(to: string, template: string): Promise<Mail> {
  let found: Mail | undefined;
  await expect.poll(() => (found = mails(to, template).at(-1)), { message: `email ${template} to ${to}` }).toBeTruthy();
  return found!;
}

export function linkIn(mail: Mail) {
  const m = mail.text.match(/https?:\/\/\S+/g);
  if (!m) throw new Error(`No link in ${mail.subject}`);
  return m[m.length - 1].replace(/^http:\/\/localhost:\d+/, "");
}

// Tiny valid PNG for upload fields
export const PNG = {
  name: "receipt.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
};
export const FAKE_PDF = { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf") };

export const PASSWORD = "Sup3r-secret!";

export async function signup(
  page: Page,
  o: { tier?: "student" | "individual" | "corporate"; name: string; email: string; state?: string; organisation?: string },
) {
  await page.context().clearCookies();
  await page.goto(`/signup${o.tier ? `?tier=${o.tier}` : ""}`);
  await page.getByLabel("Full name").fill(o.name);
  await page.getByLabel("Email address").fill(o.email);
  await page.getByLabel("Contact number").fill("012-345 6789");
  if (o.organisation) await page.getByLabel(/^(Organisation|University \/ college)/).fill(o.organisation);
  await page.getByLabel("Correspondence address").fill("1 Jalan Data, 50450 Kuala Lumpur");
  await page.getByLabel("State").selectOption(o.state ?? "KL");
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByLabel("I acknowledge and agree").check();
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function verifyEmail(page: Page, email: string) {
  const mail = await lastMail(email, "verifyEmail");
  await page.goto(linkIn(mail));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function submitPayment(page: Page, amount: string, reference: string) {
  await page.getByLabel("Amount transferred (RM)").fill(amount);
  await page.getByLabel("Bank reference / transaction no.").fill(reference);
  await page.getByLabel("Bank transfer receipt").setInputFiles(PNG);
  await page.getByRole("button", { name: "Submit payment" }).click();
  await expect(page.getByText("your payment details have been submitted")).toBeVisible();
}
