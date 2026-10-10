import fs from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, PNG, signup, submitPayment, verifyEmail } from "./helpers";

// Optional: GUIDE=1 npx playwright test tests/role-guides-screens.spec.ts — screenshots for the Membership admin
// and Events admin guides, saved to test-results/role-guides/. Made-up people on the test database.
test.skip(!process.env.GUIDE, "guide screenshots only when GUIDE=1");
test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });

const OUT = "test-results/role-guides";
const ADMIN = "admin@test.dama.my";
const MEMBERSHIP = "membership@example.com";
const EVENTS = "events@example.com";
const klDay = (offset: number) => new Date(Date.now() + 8 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

async function snap(page: Page, name: string, focus?: Locator) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (focus) await focus.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function snapEl(el: Locator, name: string) {
  await el.first().evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.first().screenshot({ path: `${OUT}/${name}.png` });
}
async function giveRole(page: Page, email: string, role: string) {
  await login(page, ADMIN);
  await page.goto("/admin/admins");
  await page.getByLabel("Account email").fill(email);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText(/is now/)).toBeVisible();
}
async function verifyAll(page: Page) {
  await login(page, ADMIN);
  for (let left = 10; left > 0; left--) {
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const n = await page.getByRole("button", { name: "Verify" }).count();
    if (!n) break;
    await page.getByRole("button", { name: "Verify" }).first().click();
    await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(n - 1);
  }
}
async function corporate(page: Page, name: string, email: string, org: string, wantsCall: boolean) {
  await signup(page, { tier: "corporate", name, email, state: "SL" });
  await verifyEmail(page, email);
  await page.goto("/portal/apply?tier=corporate");
  await page.getByText("Small Enterprise").click();
  await page.getByLabel("Organisation name").fill(org);
  await page.getByLabel("Company registration no.").fill("202301012345");
  await page.getByLabel("Industry").fill("Financial services");
  await page.getByLabel("Organisation size").selectOption({ index: 2 });
  await page.getByLabel("State (registered office)").selectOption("SL");
  await page.getByLabel("Registered office address").fill("Level 10, Menara Data, Petaling Jaya");
  await page.getByLabel("Job title").fill("Head of Data");
  if (wantsCall) await page.getByLabel(/contact me before I pay/).check();
  await page.getByLabel(/I confirm that the above information/).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  if (!wantsCall) await submitPayment(page, "1000", "IBG112233");
}

test("role guides: set up made-up data", async ({ page }) => {
  await signup(page, { name: "DAMA Admin", email: ADMIN });
  await verifyEmail(page, ADMIN);
  await page.goto("/admin/settings");
  await page.locator('input[name="accountNumber"]').fill("XXXX XXXX XXXX");
  await page.locator('input[name="website"]').fill("https://dama.org.my");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  for (const [name, email] of [["Membership Demo", MEMBERSHIP], ["Events Demo", EVENTS]]) {
    await signup(page, { name, email });
    await verifyEmail(page, email);
  }
  await giveRole(page, MEMBERSHIP, "membership_admin");
  await giveRole(page, EVENTS, "events_admin");

  // Individuals (one active, plus two who will attend events)
  for (const [name, email] of [["Aisyah Rahman", "aisyah@example.com"], ["Daniel Lee", "daniel@example.com"]]) {
    await signup(page, { tier: "individual", name, email, state: "SL" });
    await verifyEmail(page, email);
    await page.goto("/portal/apply?tier=individual");
    await page.getByLabel(/I'm applying for/).check();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await submitPayment(page, "150", "AMB" + name.length);
  }
  // A student waiting for the eligibility check
  await signup(page, { tier: "student", name: "Nurul Huda", email: "nurul@siswa.um.edu.my", state: "SL", organisation: "Universiti Malaya" });
  await verifyEmail(page, "nurul@siswa.um.edu.my");
  await page.goto("/portal/apply?tier=student");
  await page.getByLabel("Expected graduation year").fill("2027");
  await page.getByLabel("Proof of student status").setInputFiles(PNG);
  await page.getByLabel(/I'm applying for/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await submitPayment(page, "25", "AMB-STU-01");
  // Corporate: one paid with a seat change request, one 'talk to us first' lead
  await corporate(page, "Hana Rahim", "hana@datacorp.com.my", "DataCorp Sdn Bhd", false);
  await corporate(page, "Ravi Kumar", "ravi@leadco.com.my", "LeadCo Berhad", true);
  await verifyAll(page);

  // Renewal due soon: an imported member ending in 10 days
  const soon = klDay(10);
  const start = klDay(-355);
  const csv = [
    "tier,member_id,name,email,phone,job_title,organisation,ssm_no,state,address,start_date,end_date,amount_paid,payment_date,payment_reference",
    `IND,,Siti Aminah,siti@example.com,0123456789,Data Analyst,Bank Data,,KL,"KL, Malaysia",${start},${soon},150,${start},Manual`,
  ].join("\n");
  await page.goto("/admin/import");
  await page.getByLabel("CSV file").setInputFiles({ name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText(/Imported 1 member/)).toBeVisible();

  // Corporate contact fills a seat, then asks to replace that person
  await login(page, "hana@datacorp.com.my");
  await page.getByRole("link", { name: "Manage seats & details" }).click();
  const first = page.locator("details").first();
  await first.getByLabel("Full name").fill("Lee Wei");
  await first.getByLabel("Email").fill("lee.wei@datacorp.com.my");
  await first.getByRole("button", { name: "Assign seat" }).click();
  await expect(page.getByText("Seat assigned.")).toBeVisible();
  await page.reload();
  const filled = page.locator("details", { hasText: "Request to replace this person" }).first();
  await filled.locator("summary").click();
  await filled.getByLabel("Full name").fill("Tan Mei");
  await filled.getByLabel("Email").fill("tan.mei@datacorp.com.my");
  await filled.getByLabel("Reason for change").fill("Lee Wei has left the company");
  await filled.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("seat change request has been sent")).toBeVisible();
});

test("membership admin screens", async ({ page }) => {
  await login(page, MEMBERSHIP);
  await page.goto("/admin");
  await snap(page, "m01-dashboard");
  await page.goto("/admin/members?category=E&eligibility=pending");
  await snap(page, "m02-students-pending");
  await page.getByRole("link", { name: "Nurul Huda" }).click();
  await snap(page, "m03-student-eligibility", page.getByRole("button", { name: "Approve eligibility" }));
  await page.getByRole("button", { name: "Approve eligibility" }).click();
  await expect(page.getByText("Eligibility approved.")).toBeVisible();
  await snap(page, "m04-approved");

  await page.goto("/admin/members?q=aisyah");
  await snap(page, "m05-search");
  await page.getByRole("link", { name: "Aisyah Rahman" }).click();
  await snap(page, "m06-member-actions", page.getByRole("button", { name: "Resend welcome email" }));

  await page.goto("/admin/corporate");
  await snap(page, "m07-corporate");
  await snap(page, "m09-seat-requests", page.locator("#seat-requests"));
  await page.locator("#seat-requests").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Seat change approved.")).toBeVisible();

  await page.goto("/admin/corporate?status=new_lead");
  await page.getByRole("link", { name: "LeadCo Berhad" }).click();
  await page.getByLabel("Status").selectOption("pic_contacted");
  await page.getByLabel("Assigned PIC").selectOption({ label: "Membership Demo" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByLabel("Add a note").fill("Called Ravi, sending the proposal on Monday.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Note added.")).toBeVisible();
  await snap(page, "m08-lead-pipeline", page.getByLabel("Assigned PIC"));

  await page.goto("/admin/corporate");
  await page.getByRole("link", { name: "DataCorp Sdn Bhd" }).click();
  await snap(page, "m10-corporate-seats", page.getByText(/Seats \(/));

  await page.goto("/admin/renewals");
  await snap(page, "m11-renewals");

  await page.goto("/admin/announce");
  await page.getByLabel("Send to").selectOption("members");
  await page.getByLabel("Subject").fill("Members save 10% at World Data Summit APAC");
  await page.getByLabel("Message").fill("Dear member,\n\nDAMA is a media partner of World Data Summit APAC on 29–30 October in Kuala Lumpur.\n\nDetails and your discount are on dama.org.my.");
  await page.getByLabel("Send this email now").check();
  await snap(page, "m12-announce", page.getByRole("button", { name: "Send announcement" }));
  await page.getByRole("button", { name: "Send announcement" }).click();
  await expect(page.getByText(/^Sent to \d+ of \d+ recipients\./)).toBeVisible();
  await snap(page, "m13-announce-sent", page.getByText(/^Sent to/));

  await page.goto("/admin/export");
  await snap(page, "m14-export");
  await page.goto("/admin/emails");
  await snap(page, "m15-email-log");
});

test("events admin screens", async ({ page }) => {
  await login(page, EVENTS);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/events$/);
  await page.goto("/admin/events/new");
  await page.getByLabel("Title").fill("Data Quality Roundtable");
  await page.getByLabel("Type").selectOption("Roundtable");
  await page.getByLabel("Who can attend").selectOption("public");
  await page.getByLabel("Short summary").fill("An evening of practical data quality stories from Malaysian organisations.");
  await page.getByLabel("Full description").fill("Agenda:\n18:30 Registration\n19:00 Talks\n20:00 Networking");
  await page.getByLabel("Starts (Malaysia time)").fill(`${klDay(14)}T18:30`);
  await page.getByLabel("Ends").fill(`${klDay(14)}T21:00`);
  await page.getByLabel("Venue").fill("Menara DAMA, Kuala Lumpur");
  await snap(page, "e02-form-top", page.getByLabel("Title"));
  await page.getByLabel("Member price (RM)", { exact: true }).fill("0");
  await page.getByLabel("Non-member price (RM)").fill("50");
  await page.getByLabel("Places").fill("40");
  await page.getByLabel("Cover image").setInputFiles("public/assets/img/events/um-group.jpg");
  await snap(page, "e03-form-prices", page.getByLabel("Places"));
  await page.getByLabel("Slides & recordings (members only)").fill("Slides: https://example.com/slides (shared after the event)");
  await page.getByLabel("Status").selectOption("published");
  await snap(page, "e04-form-bottom", page.getByRole("button", { name: "Create event" }));
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByText("Event created and published.")).toBeVisible();
  await snap(page, "e05-created");

  // A partner event: organiser's own registration link and a member offer
  await page.goto("/admin/events/new");
  await page.getByLabel("Title").fill("Partner Summit 2026");
  await page.getByLabel("Who can attend").selectOption("public");
  await page.getByLabel("Short summary").fill("A partner conference where DAMA members get a discount.");
  await page.getByLabel("Starts (Malaysia time)").fill(`${klDay(20)}T09:00`);
  await page.getByLabel("Venue").fill("Kuala Lumpur");
  await page.getByLabel("Cover image").setInputFiles("public/assets/img/events/um-group.jpg");
  await page.getByLabel("Organiser", { exact: true }).fill("Partner Events Co");
  await page.getByLabel("Organiser's registration link").fill("https://partner.example/register");
  await page.getByLabel("Member offer (public headline)").fill("DAMA members save 10% on registration");
  await page.getByLabel("Member offer details (members only)").fill("Use promo code DAMA when booking.");
  await snap(page, "e11-partner-fields", page.getByLabel("Organiser's registration link"));

  // Two members register for the roundtable
  for (const email of ["aisyah@example.com", "daniel@example.com"]) {
    await login(page, email);
    await page.goto("/events");
    await page.getByRole("link", { name: /Data Quality Roundtable/ }).first().click();
    await page.getByRole("button", { name: /Register/ }).click();
    await expect(page.getByText(/registered/i).first()).toBeVisible();
  }

  await login(page, EVENTS);
  await page.goto("/admin/events");
  await snap(page, "e01-events-list");
  await page.getByRole("link", { name: "Data Quality Roundtable" }).click();
  await snap(page, "e06-attendees", page.getByRole("row", { name: /Aisyah Rahman/ }));
  await page.getByRole("row", { name: /Aisyah Rahman/ }).getByRole("button", { name: "Mark attended" }).click();
  await expect(page.getByText("Marked as attended.")).toBeVisible();
  await snap(page, "e07-attended", page.getByRole("row", { name: /Aisyah Rahman/ }));
  await page.getByLabel("Subject").fill("Parking information");
  await page.getByLabel("Message").fill("Parking is at level B2.\n\nSee you tomorrow!");
  await page.getByLabel("Send this email now").check();
  await snap(page, "e08-email-attendees", page.getByRole("button", { name: "Send email" }));
  await page.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText(/Email sent to \d+ of \d+/)).toBeVisible();
  const daniel = page.getByRole("row", { name: /Daniel Lee/ });
  await daniel.getByPlaceholder("Note to attendee (optional)").fill("Sorry, the venue is full");
  await snapEl(daniel, "e09-cancel-row");
  await page.goto((await page.getByRole("link", { name: /View public page/ }).getAttribute("href"))!);
  await snap(page, "e10-public-page");
});
