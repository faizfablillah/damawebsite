import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, getDb, schema } from "@/db";
import { APP_URL, ORG } from "./config";

// Sends through Microsoft 365 (Graph API) when MS_TENANT_ID is set, or SMTP when SMTP_HOST is set
// (e.g. Gmail: smtp.gmail.com + app password). Otherwise writes each email to DATA_DIR/outbox so it
// can be inspected during development and tests.

type Attachment = { filename: string; content: Buffer; contentType: string };
type Mail = { subject: string; html: string; text: string };
type Links = { userId?: string | null; membershipId?: string | null; organisationId?: string | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f4fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4fb;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#071b41;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:bold">${esc(ORG.shortName)}<div style="height:4px;width:60px;background:#4de1c7;margin-top:10px;border-radius:2px"></div></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
<h1 style="font-size:20px;color:#071b41;margin:0 0 16px">${esc(title)}</h1>
${bodyHtml}
${cta ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#00906d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#6b7280">If the button doesn't work, copy this link into your browser:<br>${cta.url}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;font-size:12px;color:#6b7280">${esc(ORG.registeredName)} · ROS ${ORG.rosNo}<br>${ORG.email}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
const textOf = (html: string) => html.replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();

function mail(title: string, paragraphs: string[], cta?: { label: string; url: string }): Mail {
  const body = paragraphs.map(p).join("");
  const html = layout(title, body, cta);
  return { subject: title, html, text: `${title}\n\n${textOf(body)}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}\n\n${ORG.shortName}` };
}

type EventInfo = { title: string; when: string; venue: string | null; slug: string };
const eventLines = (e: EventInfo) => `<strong>${esc(e.title)}</strong><br>${esc(e.when)}${e.venue ? `<br>${esc(e.venue)}` : ""}`;
const eventUrl = (e: EventInfo) => `${APP_URL}/events/${e.slug}`;
// Plain text typed by an admin → escaped paragraphs (blank line = new paragraph)
const paragraphs = (text: string) => text.trim().split(/\r?\n\s*\r?\n/).map((para) => esc(para).replace(/\r?\n/g, "<br>"));

export const templates = {
  eventConfirmed: (name: string, e: EventInfo, onlineUrl: string | null) =>
    mail(
      "You're registered",
      [
        `Hi ${esc(name)},`,
        "Your place is confirmed for:",
        eventLines(e),
        ...(onlineUrl ? [`Join online: <a href="${esc(onlineUrl)}">${esc(onlineUrl)}</a>`] : []),
        "A calendar invitation is attached. We'll also send a reminder the day before.",
      ],
      { label: "View event", url: eventUrl(e) },
    ),
  eventPaymentNeeded: (name: string, e: EventInfo, amount: string, reference: string, payUrl: string) =>
    mail(
      "Complete your event registration",
      [
        `Hi ${esc(name)},`,
        "We've reserved your place for:",
        eventLines(e),
        `Please transfer <strong>${esc(amount)}</strong> using the reference <strong>${esc(reference)}</strong>, then upload your bank receipt. Your place is confirmed once we've verified the payment.`,
      ],
      { label: "Pay and upload receipt", url: payUrl },
    ),
  eventPaymentRejected: (name: string, e: EventInfo, reason: string, payUrl: string) =>
    mail(
      "We couldn't verify your event payment",
      [`Hi ${esc(name)},`, `We couldn't verify your payment for <strong>${esc(e.title)}</strong>.`, `Reason: ${esc(reason)}`, "Please upload a new receipt, or reply to this email if you think this is a mistake."],
      { label: "Upload a new receipt", url: payUrl },
    ),
  eventReminder: (name: string, e: EventInfo, onlineUrl: string | null) =>
    mail(
      `Reminder: ${e.title} is tomorrow`,
      [`Hi ${esc(name)},`, "A quick reminder about tomorrow's event:", eventLines(e), ...(onlineUrl ? [`Join online: <a href="${esc(onlineUrl)}">${esc(onlineUrl)}</a>`] : []), "See you there!"],
      { label: "View event", url: eventUrl(e) },
    ),
  eventCancelled: (name: string, e: EventInfo, note: string) =>
    mail("Your event registration has been cancelled", [`Hi ${esc(name)},`, `Your registration for <strong>${esc(e.title)}</strong> (${esc(e.when)}) has been cancelled.`, ...(note ? [esc(note)] : []), "If you paid for this event, we'll contact you about a refund."]),
  eventMessage: (subject: string, message: string, e: EventInfo) =>
    mail(subject, [...paragraphs(message), `<span style="color:#6b7280;font-size:13px">You're receiving this because you registered for ${esc(e.title)}.</span>`], {
      label: "View event",
      url: eventUrl(e),
    }),
  announcement: (subject: string, message: string, footer: string) =>
    mail(subject, [...paragraphs(message), `<span style="color:#6b7280;font-size:13px">${esc(footer)}</span>`]),
  adminAlert: (problems: string[]) =>
    mail(
      "DAMA website: something needs attention",
      ["The daily check of the membership system found:", problems.map((x) => `• ${esc(x)}`).join("<br>"), "Members can still use the site unless it says otherwise. Check Admin → Email log, or the Vercel logs, for details."],
      { label: "Open the admin", url: `${APP_URL}/admin` },
    ),
  // next: a page on this site to continue to afterwards (e.g. the event they were registering for)
  verifyEmail: (name: string, token: string, next?: string | null) =>
    mail("Confirm your email address", [`Hi ${esc(name)},`, "Thanks for signing up with DAMA Kuala Lumpur &amp; Selangor. Please confirm your email address to continue.", "This link expires in 72 hours."], {
      label: "Confirm email",
      url: `${APP_URL}/verify-email?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    }),
  resetPassword: (name: string, token: string) =>
    mail("Reset your password", [`Hi ${esc(name)},`, "We received a request to reset your password. This link expires in 2 hours. If you didn't ask for this, you can ignore this email."], { label: "Choose a new password", url: `${APP_URL}/reset-password?token=${token}` }),
  applicationReceived: (name: string, tierLabel: string, amount: string, reference: string) =>
    mail("We've received your application", [`Hi ${esc(name)},`, `Thank you for applying for <strong>${esc(tierLabel)}</strong> membership.`, `To complete your application, please transfer <strong>${amount}</strong> using the reference <strong>${esc(reference)}</strong>, then upload your payment receipt in the member portal.`], { label: "Go to payment", url: `${APP_URL}/portal` }),
  corporateLead: (name: string, org: string) =>
    mail("Thank you for your interest in Corporate Membership", [`Hi ${esc(name)},`, `Thank you for registering <strong>${esc(org)}</strong>'s interest in DAMA Corporate Membership.`, "Our Corporate Membership PIC will reach out within 3–5 business days. You can also complete payment at any time from the member portal."], { label: "Open member portal", url: `${APP_URL}/portal` }),
  paymentSubmitted: (name: string, amount: string) =>
    mail("Payment details received", [`Hi ${esc(name)},`, `We've received your payment details for <strong>${amount}</strong>. Our team will verify the transfer against our bank records, usually within 3 business days.`, "You'll receive your official receipt by email once it's verified."], { label: "View status", url: `${APP_URL}/portal` }),
  paymentRejected: (name: string, amount: string, reason: string) =>
    mail("We couldn't verify your payment", [`Hi ${esc(name)},`, `We were unable to verify your payment of <strong>${amount}</strong>.`, `Reason: ${esc(reason)}`, "Please check the details and submit your payment proof again from the member portal, or reply to this email if you need help."], { label: "Open member portal", url: `${APP_URL}/portal` }),
  partPayment: (name: string, received: string, balance: string, receiptNo: string) =>
    mail("Part payment received", [`Hi ${esc(name)},`, `Thank you. We've received <strong>${received}</strong> (receipt ${esc(receiptNo)}, attached).`, `The outstanding balance is <strong>${balance}</strong>. Your membership will be activated once the balance is settled.`], { label: "Pay the balance", url: `${APP_URL}/portal` }),
  receiptIssued: (name: string, received: string, receiptNo: string) =>
    mail("Payment receipt", [`Hi ${esc(name)},`, `Thank you. We've received <strong>${received}</strong>. Your official receipt ${esc(receiptNo)} is attached.`], { label: "Open member portal", url: `${APP_URL}/portal` }),
  awaitingEligibility: (name: string) =>
    mail("Payment received — eligibility check in progress", [`Hi ${esc(name)},`, "Thank you, your payment has been verified and your receipt is attached.", "Your student membership will be activated as soon as our team has checked your proof of student status."], { label: "View status", url: `${APP_URL}/portal` }),
  welcome: (name: string, tierLabel: string, memberCode: string, start: string, end: string) =>
    mail("Welcome to DAMA Kuala Lumpur & Selangor", [`Hi ${esc(name)},`, `Your <strong>${esc(tierLabel)}</strong> membership is now active.`, `<strong>Member ID:</strong> ${esc(memberCode)}<br><strong>Valid:</strong> ${start} to ${end}`, "Your receipt is attached. We look forward to seeing you at our events!"], { label: "Open member portal", url: `${APP_URL}/portal` }),
  renewed: (name: string, memberCode: string, start: string, end: string) =>
    mail("Your membership has been renewed", [`Hi ${esc(name)},`, `Thank you for renewing. Member ID <strong>${esc(memberCode)}</strong> is now valid from ${start} to ${end}.`, "Your receipt is attached."], { label: "Open member portal", url: `${APP_URL}/portal` }),
  corporateActive: (name: string, org: string, memberCode: string, seats: number, end: string) =>
    mail("Your Corporate Membership is active", [`Hi ${esc(name)},`, `<strong>${esc(org)}</strong>'s Corporate Membership (${esc(memberCode)}) is now active until ${end}.`, `Your membership includes <strong>${seats} seats</strong>. Please add your team members from the organisation page so they can access member benefits.`, "Your receipt is attached."], { label: "Add your team", url: `${APP_URL}/portal` }),
  eligibilityRejected: (name: string, reason: string) =>
    mail("Update on your student membership application", [`Hi ${esc(name)},`, "Unfortunately we couldn't confirm your student eligibility.", `Reason: ${esc(reason)}`, `If you think this is a mistake, please reply to this email or contact us at ${ORG.email}.`]),
  seatInvite: (name: string, org: string, seatCode: string) =>
    mail(`You've been added to ${org}'s DAMA membership`, [`Hi ${esc(name)},`, `<strong>${esc(org)}</strong> has added you to its DAMA Corporate Membership (seat ${esc(seatCode)}).`, "Create your free account with this email address to access your member page, events and resources."], { label: "Create your account", url: `${APP_URL}/signup?seat=1` }),
  renewalReminder: (name: string, memberCode: string, end: string, days: number) =>
    mail(`Your DAMA membership expires in ${days} days`, [`Hi ${esc(name)},`, `Your membership ${esc(memberCode)} expires on <strong>${end}</strong>.`, "Renew now to keep your benefits without interruption. Your Member ID stays the same."], { label: "Renew membership", url: `${APP_URL}/portal` }),
  graceReminder: (name: string, memberCode: string, end: string, graceEnd: string) =>
    mail("Your DAMA membership has ended — renew within the grace period", [`Hi ${esc(name)},`, `Your membership ${esc(memberCode)} ended on ${end}.`, `You can still renew until <strong>${graceEnd}</strong> and keep your membership continuous.`], { label: "Renew membership", url: `${APP_URL}/portal` }),
  expired: (name: string, memberCode: string) =>
    mail("Your DAMA membership has expired", [`Hi ${esc(name)},`, `Your membership ${esc(memberCode)} has now expired. You can renew at any time; your Member ID stays the same.`], { label: "Renew membership", url: `${APP_URL}/portal` }),
};

export type TemplateName = keyof typeof templates;

export const emailConfigured = () => !!(process.env.MS_TENANT_ID || process.env.SMTP_HOST);

// Microsoft Graph: an app registration with the Mail.Send application permission sends as MS_SENDER
let graphToken: { value: string; expires: number } | null = null;

async function graphAccessToken(): Promise<string> {
  if (graphToken && graphToken.expires > Date.now() + 60_000) return graphToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? "",
      client_secret: process.env.MS_CLIENT_SECRET ?? "",
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Microsoft sign-in failed: ${json.error_description ?? res.status}`);
  graphToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return graphToken.value;
}

async function sendWithGraph(to: string, m: Mail, attachments: Attachment[]) {
  const sender = process.env.MS_SENDER ?? "";
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await graphAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: m.subject,
        body: { contentType: "HTML", content: m.html },
        from: { emailAddress: { address: sender, name: ORG.shortName } },
        toRecipients: [{ emailAddress: { address: to } }],
        replyTo: [{ emailAddress: { address: ORG.email } }],
        attachments: attachments.map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.content.toString("base64"),
        })),
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft Graph ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendEmail(to: string, template: TemplateName, m: Mail, links: Links = {}, attachments: Attachment[] = []) {
  const db = await getDb();
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    if (process.env.MS_TENANT_ID) {
      await sendWithGraph(to, m, attachments);
    } else if (process.env.SMTP_HOST) {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: (process.env.SMTP_PORT || "465") === "465",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from: process.env.MAIL_FROM || `${ORG.shortName} <${ORG.email}>`,
        replyTo: ORG.email,
        to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        attachments,
      });
    } else {
      const dir = path.join(DATA_DIR, "outbox");
      await fs.mkdir(dir, { recursive: true });
      const base = `${Date.now()}-${template}-${to.replace(/[^a-z0-9@.]/gi, "_")}`;
      await fs.writeFile(path.join(dir, `${base}.json`), JSON.stringify({ to, template, subject: m.subject, text: m.text, attachments: attachments.map((a) => a.filename) }, null, 2));
      await fs.writeFile(path.join(dir, `${base}.html`), m.html);
      for (const a of attachments) await fs.writeFile(path.join(dir, `${base}-${a.filename}`), a.content);
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.error("Email failed", to, template, error);
  }
  await db.insert(schema.emailLog).values({
    toEmail: to,
    subject: m.subject,
    template,
    status,
    error,
    userId: links.userId ?? null,
    membershipId: links.membershipId ?? null,
    organisationId: links.organisationId ?? null,
  });
  return status === "sent";
}
