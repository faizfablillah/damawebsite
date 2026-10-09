import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { expect, test } from "@playwright/test";
import { FAKE_PDF, lastMail, linkIn, login, mails, PASSWORD, PNG, signup, submitPayment, verifyEmail } from "./helpers";

const ADMIN = "admin@test.dama.my";
const STUDENT = "aina@siswa.um.edu.my";
const INDIVIDUAL = "ravi@example.com";
const CORP = "hr@acme.com.my";
const LEAD = "ceo@leadco.my";
const yy = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "2-digit" });

test.describe.configure({ mode: "serial" });

test("public site pages and sign-up entry points work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Empowering Data/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Member Login" })).toBeVisible();
  await page.goto("/membership");
  await page.getByRole("link", { name: "Join now" }).first().click();
  await expect(page).toHaveURL(/\/join\?tier=student/);
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/contact");
  await expect(page.getByText("info.damamalaysia@gmail.com").first()).toBeVisible();
});

test("admin account is created from SUPER_ADMIN_EMAILS", async ({ page }) => {
  await signup(page, { name: "Faiz Admin", email: ADMIN });
  await expect(page).toHaveURL(/check-email/);
  await verifyEmail(page, ADMIN);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "DAMA Admin" })).toBeVisible();
});

test("student sign-up enforces .edu / .edu.my email", async ({ page }) => {
  await signup(page, { tier: "student", name: "Wrong Email", email: "student@gmail.com" });
  await expect(page.getByText("A .edu or .edu.my email is required for Student membership").first()).toBeVisible();
  // the form keeps what was typed
  await expect(page.getByLabel("Full name")).toHaveValue("Wrong Email");
});

test("student applies, pays, is verified and approved", async ({ page }) => {
  await signup(page, { tier: "student", name: "Aina Student", email: STUDENT, state: "SL", organisation: "Universiti Malaya" });
  await verifyEmail(page, STUDENT);
  await page.goto("/portal/apply?tier=student");
  await page.getByLabel("Expected graduation year").fill("2027");
  // file type is checked by content, not by name
  await page.getByLabel("Proof of student status").setInputFiles(FAKE_PDF);
  await page.getByLabel(/I'm applying for/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByText("must be a PDF, JPG, PNG or WEBP file")).toBeVisible();
  await page.getByLabel("Proof of student status").setInputFiles(PNG);
  await page.getByLabel(/I'm applying for/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByText("DAMA MBRP EDU Aina Student")).toBeVisible();
  await expect(page.getByText("RM 25.00").first()).toBeVisible();
  await submitPayment(page, "25", "AMB-STU-001");
  await expect(page.getByText("Payment under review")).toBeVisible();

  // Admin verifies payment, then approves eligibility
  await login(page, ADMIN);
  await page.goto("/admin/payments");
  const row = page.getByRole("row", { name: /Aina Student/ });
  await row.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/Verified\. Receipt MY\/MEM\/\d{4}\/0001 issued/)).toBeVisible();
  await lastMail(STUDENT, "awaitingEligibility");

  await page.goto("/admin/members?category=E");
  await page.getByRole("link", { name: "Aina Student" }).click();
  await expect(page.getByText("Valid", { exact: true })).toBeVisible(); // .edu.my check
  await page.getByRole("button", { name: "Approve eligibility" }).click();
  await expect(page.getByText("Eligibility approved.")).toBeVisible();
  const code = `EMYSL${yy}-0001`;
  await expect(page.getByText(code).first()).toBeVisible();
  const welcome = await lastMail(STUDENT, "welcome");
  expect(welcome.text).toContain(code);
  expect(welcome.attachments[0]).toMatch(/DAMA Receipt MY-MEM-\d{4}-0001\.pdf/);

  // Member sees the card and can download the receipt
  await login(page, STUDENT);
  await expect(page.getByText(code)).toBeVisible();
  const receiptLink = page.getByRole("link", { name: /MY\/MEM\/\d{4}\/0001/ });
  const href = await receiptLink.getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("individual part-pays, then pays the balance and is activated", async ({ page }) => {
  await signup(page, { tier: "individual", name: "Ravi Kumar", email: INDIVIDUAL, organisation: "Data Co" });
  await verifyEmail(page, INDIVIDUAL);
  await page.goto("/portal/apply?tier=individual");
  await page.getByLabel("Data Quality").check();
  await page.getByLabel(/I'm applying for/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByText("RM 150.00").first()).toBeVisible();
  await submitPayment(page, "150", "AMB-IND-001");

  // Admin records only RM 100 as received
  await login(page, ADMIN);
  await page.goto("/admin/payments");
  const row = page.getByRole("row", { name: /Ravi Kumar/ });
  await row.getByLabel("Amount received (RM)").fill("100");
  await row.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Part payment verified")).toBeVisible();
  const part = await lastMail(INDIVIDUAL, "partPayment");
  expect(part.text).toContain("RM 50.00");

  // Member pays the balance
  await login(page, INDIVIDUAL);
  await expect(page.getByText("Part payment received")).toBeVisible();
  await page.getByRole("link", { name: "Pay the balance" }).click();
  await expect(page.getByLabel("Amount transferred (RM)")).toHaveValue("50.00");
  await submitPayment(page, "50", "AMB-IND-002");

  await login(page, ADMIN);
  await page.goto("/admin/payments");
  await page.getByRole("row", { name: /Ravi Kumar/ }).getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/membership IMYKL\d{2}-0001 activated/)).toBeVisible();
  await lastMail(INDIVIDUAL, "welcome");

  await login(page, INDIVIDUAL);
  await expect(page.getByText(`IMYKL${yy}-0001`)).toBeVisible();
  await expect(page.getByRole("link", { name: /MY\/MEM\// })).toHaveCount(2);
});

test("payment proof can be rejected and resubmitted", async ({ page }) => {
  await signup(page, { tier: "individual", name: "Reject Test", email: "reject@example.com" });
  await verifyEmail(page, "reject@example.com");
  await page.goto("/portal/apply?tier=individual");
  await page.getByLabel(/I'm applying for/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await submitPayment(page, "150", "WRONG");
  await login(page, ADMIN);
  await page.goto("/admin/payments");
  const row = page.getByRole("row", { name: /Reject Test/ });
  await row.getByLabel("Reason").fill("No matching transfer in our statement");
  await row.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Payment rejected")).toBeVisible();
  const mail = await lastMail("reject@example.com", "paymentRejected");
  expect(mail.text).toContain("No matching transfer");
  await login(page, "reject@example.com");
  await expect(page.getByText("couldn't be verified: No matching transfer")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay and upload receipt" })).toBeVisible();
});

test("corporate pays, gets seats, assigns and swaps a seat", async ({ page }) => {
  await signup(page, { tier: "corporate", name: "Hana HR", email: CORP, state: "SL" });
  await verifyEmail(page, CORP);
  await page.goto("/portal/apply?tier=corporate");
  await page.getByText("Medium Enterprise").click();
  await page.getByLabel("Organisation name").fill("Acme Data Sdn Bhd");
  await page.getByLabel("Company registration no.").fill("202301012345");
  await page.getByLabel("Industry").fill("Financial services");
  await page.getByLabel("Organisation size").selectOption({ index: 2 });
  await page.getByLabel("State (registered office)").selectOption("SL");
  await page.getByLabel("Registered office address").fill("Level 10, Menara Acme, Petaling Jaya");
  await page.getByLabel("Job title").fill("Head of HR");
  await page.getByLabel("Corporate seats for our team").check();
  await page.getByLabel(/I confirm that the above information/).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("DAMA MBRP Ent Medium Acme Data Sdn Bhd")).toBeVisible();
  await expect(page.getByText("RM 1,500.00").first()).toBeVisible();
  await submitPayment(page, "1500", "AMB-CORP-001");

  await login(page, ADMIN);
  await page.goto("/admin/payments");
  await page.getByRole("row", { name: /Acme Data/ }).getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/membership CMYSL\d{2}-0001 activated/)).toBeVisible();
  await lastMail(CORP, "corporateActive");

  // Contact person assigns the first seat
  await login(page, CORP);
  await page.getByRole("link", { name: "Manage seats & details" }).click();
  await expect(page.getByText(`CMYSL${yy}-0001/S10`)).toBeVisible();
  const first = page.locator("details").first();
  await first.getByLabel("Full name").fill("Lee Wei");
  await first.getByLabel("Email").fill("lee.wei@acme.com.my");
  await first.getByRole("button", { name: "Assign seat" }).click();
  await expect(page.getByText("Seat assigned.")).toBeVisible();
  await lastMail("lee.wei@acme.com.my", "seatInvite");

  // Replacing a filled seat needs admin approval
  await page.reload();
  const filled = page.locator("details", { hasText: "Request to replace this person" }).first();
  await filled.locator("summary").click();
  await filled.getByLabel("Full name").fill("Tan Mei");
  await filled.getByLabel("Email").fill("tan.mei@acme.com.my");
  await filled.getByLabel("Reason for change").fill("Lee Wei has left the company");
  await filled.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("seat change request has been sent")).toBeVisible();

  await login(page, ADMIN);
  await page.goto("/admin/corporate");
  await page.locator("#seat-requests").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Seat change approved.")).toBeVisible();
  await lastMail("tan.mei@acme.com.my", "seatInvite");

  // The new seat holder signs up and sees the seat
  await signup(page, { name: "Tan Mei", email: "tan.mei@acme.com.my" });
  await verifyEmail(page, "tan.mei@acme.com.my");
  await page.goto("/portal");
  await expect(page.getByText(`CMYSL${yy}-0001/S01`)).toBeVisible();
  await expect(page.getByText("Acme Data Sdn Bhd")).toBeVisible();
});

test("corporate 'talk to us first' creates a lead for the PIC", async ({ page }) => {
  await signup(page, { tier: "corporate", name: "Lead Person", email: LEAD });
  await verifyEmail(page, LEAD);
  await page.goto("/portal/apply?tier=corporate");
  await page.getByLabel("Organisation name").fill("LeadCo Berhad");
  await page.getByLabel("Company registration no.").fill("199901000001");
  await page.getByLabel("Industry").fill("Energy");
  await page.getByLabel("Organisation size").selectOption({ index: 5 });
  await page.getByLabel("State (registered office)").selectOption("KL");
  await page.getByLabel("Registered office address").fill("Jalan Ampang, Kuala Lumpur");
  await page.getByLabel("Job title").fill("CDO");
  await page.getByLabel(/contact me before I pay/).check();
  await page.getByLabel(/I confirm that the above information/).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("PIC will reach out within 3–5 business days").first()).toBeVisible();
  await lastMail(LEAD, "corporateLead");

  await login(page, ADMIN);
  await page.goto("/admin/corporate?status=new_lead");
  await page.getByRole("link", { name: "LeadCo Berhad" }).click();
  await page.getByLabel("Status").selectOption("pic_contacted");
  await page.getByLabel("Assigned PIC").selectOption({ label: "Faiz Admin" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByLabel("Add a note").fill("Called the CDO, sending proposal.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Called the CDO, sending proposal.").last()).toBeVisible();
});

test("access control: members can't open admin pages or other people's files", async ({ page }) => {
  await login(page, INDIVIDUAL);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/portal/);
  const res = await page.request.get("/admin/export/members");
  expect(res.status()).toBe(403);
  // Another member's student proof is not reachable
  const proofs = fs.readdirSync(path.resolve(".data-test", "uploads", "student-proof", String(new Date().getFullYear())));
  const r = await page.request.get(`/files/student-proof/${new Date().getFullYear()}/${proofs[0]}`);
  expect(r.status()).toBe(404);
  // The daily job needs the secret
  expect((await page.request.get("/api/cron/daily")).status()).toBe(401);
});

test("import existing members, then renewal reminders and renewal", async ({ page }) => {
  const soon = new Date(Date.now() + 10 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const start = new Date(Date.now() - 355 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const csv = [
    "tier,member_id,name,email,phone,job_title,organisation,ssm_no,state,address,start_date,end_date,amount_paid,payment_date,payment_reference",
    `IND,IMYKL${yy}-0003,Peggy Import,peggy@example.com,0123456789,VP Finance,PwC,,KL,"KL, Malaysia",${start},${soon},150,${start},Manual`,
    `IND,,New Number,newnum@example.com,0123456789,,,,SL,,${start},,150,,`,
  ].join("\n");
  await login(page, ADMIN);
  await page.goto("/admin/import");
  await page.getByLabel("CSV file").setInputFiles({ name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByLabel(/Check the file only/).check();
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Check passed: 2 row(s)")).toBeVisible();
  await page.getByLabel("CSV file").setInputFiles({ name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Imported 2 member(s).")).toBeVisible();

  // A generated ID uses the year the member first joined (start_date), with its own running number
  await page.goto(`/admin/members?q=newnum`);
  const startYy = start.slice(2, 4);
  await expect(page.getByText(`IMYSL${startYy}-${startYy === yy ? "0004" : "0001"}`)).toBeVisible();
  // New sign-ups this year continue after the imported number (Ravi took 0001; Peggy imported as 0003)
  await page.goto(`/admin/members?q=peggy`);
  await expect(page.getByText(`IMYKL${yy}-0003`)).toBeVisible();

  // Renewal reminder goes out
  await page.goto("/admin/renewals");
  await expect(page.getByText("Peggy Import")).toBeVisible();
  await page.getByRole("button", { name: "Send due reminders now" }).click();
  await expect(page.getByText(/reminder email/)).toBeVisible();
  const reminder = await lastMail("peggy@example.com", "renewalReminder");
  expect(reminder.subject).toContain("expires in 10 days");
  const before = mails("peggy@example.com", "renewalReminder").length;
  await page.getByRole("button", { name: "Send due reminders now" }).click();
  await expect(page.getByText(/0 reminder emails sent/)).toBeVisible();
  expect(mails("peggy@example.com", "renewalReminder").length).toBe(before);

  // Imported member sets a password and renews early
  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("peggy@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.goto(linkIn(await lastMail("peggy@example.com", "resetPassword")));
  await page.getByLabel(/^New password/).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(`IMYKL${yy}-0003`)).toBeVisible();
  await page.getByRole("button", { name: "Renew membership" }).click();
  await expect(page.getByRole("heading", { name: "Renew your membership" })).toBeVisible();
  await submitPayment(page, "150", "AMB-RENEW-001");

  await login(page, ADMIN);
  await page.goto("/admin/payments");
  await page.getByRole("row", { name: /Peggy Import/ }).getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Verified.")).toBeVisible();
  const renewed = await lastMail("peggy@example.com", "renewed");
  expect(renewed.text).toContain(`IMYKL${yy}-0003`); // same ID after renewal
});

test("settings, exports and roles", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/settings");
  await page.getByLabel("Individual pricing in use").selectOption("standard");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.goto("/join");
  await expect(page.locator(".tier-card .price", { hasText: /^RM 350 \/ year$/ })).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByLabel("Individual pricing in use").selectOption("early_bird");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  const csv = await page.request.get("/admin/export/members");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain(`EMYSL${yy}-0001`);
  expect(body).toContain("Acme Data Sdn Bhd");
  const payments = await (await page.request.get("/admin/export/payments")).text();
  expect(payments).toContain("AMB-CORP-001");

  await page.goto("/admin/admins");
  await page.getByLabel("Account email").fill(INDIVIDUAL);
  await page.getByLabel("Role").selectOption("finance");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText("Ravi Kumar is now finance")).toBeVisible();
  await login(page, INDIVIDUAL);
  await page.goto("/admin/payments");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page.getByText("doesn't include that page")).toBeVisible();
});

test("repeated wrong passwords lock the account until it is reset", async ({ page }) => {
  await page.context().clearCookies();
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(INDIVIDUAL);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  }
  // Even the right password is refused while locked
  await page.goto("/login");
  await page.getByLabel("Email address").fill(INDIVIDUAL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/Too many failed login attempts\. Please try again in 1[45] minutes/)).toBeVisible();

  // Resetting the password lifts the lock
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(INDIVIDUAL);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.goto(linkIn(await lastMail(INDIVIDUAL, "resetPassword")));
  await page.getByLabel(/^New password/).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/portal/);
  await login(page, INDIVIDUAL);
});

test("security: redirects, headers, robots, cron and fake banners", async ({ page }) => {
  // Security headers on public and app pages
  for (const url of ["/", "/login"]) {
    const res = await page.request.get(url);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  }
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(await (await page.request.get("/sitemap.xml")).text()).toContain("/membership");

  // The daily job needs the exact secret
  expect((await page.request.get("/api/cron/daily", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await page.request.get("/api/cron/daily", { headers: { Authorization: "Bearer test-cron-secret" } })).status()).toBe(200);

  // Login never sends people to another site
  for (const next of ["https://evil.example/x", "//evil.example", "/\evil.example"]) {
    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email address").fill(INDIVIDUAL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    expect(new URL(page.url()).host).toMatch(/^localhost:\d+$/);
  }
  // ...also when already logged in
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/x")}`);
  expect(new URL(page.url()).host).toMatch(/^localhost:\d+$/);

  // A link can't make the admin pages show a made-up confirmation
  await login(page, ADMIN);
  await page.goto("/admin/payments?msg=Your+account+is+locked");
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await expect(page.getByText("Your account is locked")).toHaveCount(0);
});

test("security: listed admin email is not auto-promoted once a super admin exists", async ({ page }) => {
  await signup(page, { name: "Late Admin", email: "late-admin@test.dama.my" });
  // Unverified: no admin access
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
  await verifyEmail(page, "late-admin@test.dama.my");
  await login(page, "late-admin@test.dama.my");
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});

test("security: names can't carry links, and exports neutralise formulas", async ({ page }) => {
  await signup(page, { name: "Click www.evil.example now", email: "linky@example.com" });
  await expect(page.getByText("Links and line breaks aren't allowed here.")).toBeVisible();

  await login(page, INDIVIDUAL);
  await page.goto("/portal/profile");
  await page.getByLabel("Full name").fill("=HYPERLINK(1)");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Your details have been saved.")).toBeVisible();
  await login(page, ADMIN);
  const body = await (await page.request.get("/admin/export/members")).text();
  expect(body).toContain("'=HYPERLINK(1)");
  expect(body).not.toMatch(/(^|,)"?=HYPERLINK/m);
  await login(page, INDIVIDUAL);
  await page.goto("/portal/profile");
  await page.getByLabel("Full name").fill("Ravi Kumar");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Your details have been saved.")).toBeVisible();
});

test("security: password change and disabling sign out other devices", async ({ page, browser }) => {
  // A second device stays logged in until the password changes
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, INDIVIDUAL);
  await login(page, INDIVIDUAL);
  await page.goto("/portal/profile");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel(/^New password/).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Any other devices have been logged out.")).toBeVisible();
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal/);
  await otherPage.goto("/portal");
  await expect(otherPage).toHaveURL(/\/login/);

  // Admin disables the account: signed out and can't log in; then enables it again
  await login(otherPage, INDIVIDUAL);
  await login(page, ADMIN);
  await page.goto("/admin/admins");
  await page.getByLabel("Email of the account").fill(INDIVIDUAL);
  await page.getByLabel("Action").selectOption("disable");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("account is now disabled and signed out")).toBeVisible();
  await otherPage.goto("/portal");
  await expect(otherPage).toHaveURL(/\/login/);
  await otherPage.getByLabel("Email address").fill(INDIVIDUAL);
  await otherPage.getByLabel("Password").fill(PASSWORD);
  await otherPage.getByRole("button", { name: "Log in" }).click();
  await expect(otherPage.getByText("Incorrect email or password.")).toBeVisible();
  await page.getByLabel("Email of the account").fill(INDIVIDUAL);
  await page.getByLabel("Action").selectOption("enable");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("account is now enabled again")).toBeVisible();
  await login(otherPage, INDIVIDUAL);
  await other.close();
});

test("nightly backup and admin alerts", async ({ page }) => {
  // The daily job makes a backup; ?testAlert=1 emails a test alert to the super admins
  const res = await page.request.get("/api/cron/daily?testAlert=1", { headers: { Authorization: "Bearer test-cron-secret" } });
  const body = await res.json();
  expect(body.backup.key).toMatch(/^backups\/dama-\d{4}-\d{2}-\d{2}\.json\.gz$/);
  expect(body.problems).toEqual(["This is a test alert. Everything is fine."]);
  expect((await lastMail(ADMIN, "adminAlert")).text).toContain("This is a test alert");

  // Super admin downloads it from Admin → Export; it holds the data but no logins
  await login(page, ADMIN);
  await page.goto("/admin/export");
  const link = page.getByRole("link", { name: /^dama-\d{4}-\d{2}-\d{2}\.json\.gz$/ });
  const href = (await link.getAttribute("href"))!;
  const file = await page.request.get(href);
  expect(file.status()).toBe(200);
  const backup = JSON.parse(zlib.gunzipSync(await file.body()).toString("utf8"));
  expect(backup.format).toBe("dama-backup-v1");
  expect(backup.tables.users.map((u: { email: string }) => u.email)).toContain(ADMIN);
  expect(backup.tables.memberships.length).toBeGreaterThan(3);
  expect(backup.tables.sessions).toBeUndefined();
  fs.mkdirSync(path.resolve("test-results"), { recursive: true });
  fs.writeFileSync(path.resolve("test-results", "backup.json.gz"), await file.body());

  // Finance (or any other admin) can't download backups
  await login(page, INDIVIDUAL);
  expect((await page.request.get(href)).status()).toBe(404);
  await page.goto("/admin/export");
  await expect(page.getByText("Database backups")).toHaveCount(0);
});
