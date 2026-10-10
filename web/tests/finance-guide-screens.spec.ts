import fs from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, PNG, signup, submitPayment, verifyEmail } from "./helpers";

// Optional: GUIDE=1 npx playwright test tests/finance-guide-screens.spec.ts — screenshots for the Finance
// (payment checking) guide, saved to test-results/finance-guide/. Made-up people on the test database.
test.skip(!process.env.GUIDE, "guide screenshots only when GUIDE=1");
test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });

const OUT = "test-results/finance-guide";
const ADMIN = "admin@test.dama.my";
const FINANCE = "finance@example.com";

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

async function member(page: Page, name: string, email: string, pay?: { amount: string; ref: string }, tier: "individual" | "corporate" = "individual") {
  await signup(page, { tier, name, email, state: "SL", organisation: "Data Co Sdn Bhd" });
  await verifyEmail(page, email);
  if (tier === "individual") {
    await page.goto("/portal/apply?tier=individual");
    await page.getByLabel(/I'm applying for/).check();
    await page.getByRole("button", { name: "Continue to payment" }).click();
  } else {
    await page.goto("/portal/apply?tier=corporate");
    await page.getByText("Medium Enterprise").click();
    await page.getByLabel("Organisation name").fill("DataCorp Sdn Bhd");
    await page.getByLabel("Company registration no.").fill("202301012345");
    await page.getByLabel("Industry").fill("Financial services");
    await page.getByLabel("Organisation size").selectOption({ index: 2 });
    await page.getByLabel("State (registered office)").selectOption("SL");
    await page.getByLabel("Registered office address").fill("Level 10, Menara DataCorp, Petaling Jaya");
    await page.getByLabel("Job title").fill("Head of Data");
    await page.getByLabel("Corporate seats for our team").check();
    await page.getByLabel(/I confirm that the above information/).check();
    await page.getByRole("button", { name: "Submit application" }).click();
  }
  await expect(page.getByText("Amount transferred (RM)")).toBeVisible();
  if (pay) await submitPayment(page, pay.amount, pay.ref);
}

test("finance guide: set up made-up members and payments", async ({ page }) => {
  await signup(page, { name: "DAMA Admin", email: ADMIN });
  await verifyEmail(page, ADMIN);
  await page.goto("/admin/settings");
  await page.locator('input[name="bankName"]').fill("AmBank (M) Berhad");
  await page.locator('input[name="accountNumber"]').fill("XXXX XXXX XXXX");
  await page.locator('input[name="accountName"]').fill("PERSATUAN PENGURUSAN DATA KUALA LUMPUR & SELANGOR");
  await page.locator('input[name="website"]').fill("https://dama.org.my");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  // A paid event for the event-payment example
  await page.goto("/admin/events/new");
  const day = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  await page.getByLabel("Title").fill("Data Governance Workshop");
  await page.getByLabel("Type").selectOption("Workshop");
  await page.getByLabel("Who can attend").selectOption("public");
  await page.getByLabel("Short summary").fill("A hands-on session for data practitioners.");
  await page.getByLabel("Full description").fill("Bring your laptop.");
  await page.getByLabel("Starts (Malaysia time)").fill(`${day}T19:00`);
  await page.getByLabel("Ends").fill(`${day}T21:00`);
  await page.getByLabel("Venue").fill("Menara DAMA, Kuala Lumpur");
  await page.getByLabel("Member price (RM)", { exact: true }).fill("50");
  await page.getByLabel("Non-member price (RM)").fill("120");
  await page.getByLabel("Cover image").setInputFiles(PNG);
  await page.getByLabel("Status").selectOption("published");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByText("Event created and published.")).toBeVisible();

  await signup(page, { name: "Finance Demo", email: FINANCE });
  await verifyEmail(page, FINANCE);
  await login(page, ADMIN);
  await page.goto("/admin/admins");
  await page.getByLabel("Account email").fill(FINANCE);
  await page.getByLabel("Role").selectOption("finance");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText("is now finance")).toBeVisible();

  await member(page, "Aisyah Rahman", "aisyah@example.com", { amount: "150", ref: "AMB1234567890" });
  await member(page, "Daniel Lee", "daniel@example.com", { amount: "150", ref: "AMB2233445566" });
  await member(page, "Kumar Raj", "kumar@example.com", { amount: "150", ref: "123" });
  await member(page, "Nur Hidayah", "hidayah@datacorp.com.my", { amount: "1500", ref: "IBG998877" }, "corporate");
  await member(page, "Sarah Tan", "sarah@example.com");
  // Event payment from a non-member
  await signup(page, { name: "Lim Wei", email: "lim@example.com" });
  await verifyEmail(page, "lim@example.com");
  await page.goto("/events");
  await page.getByRole("link", { name: /Data Governance Workshop/ }).first().click();
  await page.getByRole("button", { name: "Register and pay" }).click();
  await expect(page).toHaveURL(/\/portal\/events\//);
  await submitPayment(page, "120", "DUITNOW 556677");
});

test("finance guide: screens", async ({ page }) => {
  await login(page, FINANCE);
  await page.goto("/admin");
  await snap(page, "f01-dashboard");
  await page.goto("/admin/payments");
  await snap(page, "f02-to-verify");
  const aisyah = page.getByRole("row", { name: /Aisyah Rahman/ });
  await snapEl(aisyah, "f03-row");
  await aisyah.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/activated/)).toBeVisible();
  await snap(page, "f04-verified-flash");

  // Part payment: the statement shows only RM 100
  const daniel = page.getByRole("row", { name: /Daniel Lee/ });
  await daniel.getByLabel("Amount received (RM)").fill("100");
  await snapEl(daniel, "f05-part-row");
  await daniel.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Part payment verified")).toBeVisible();
  await snap(page, "f06-part-flash");

  // Reject: no matching transfer
  const kumar = page.getByRole("row", { name: /Kumar Raj/ });
  await kumar.getByLabel("Reason").fill("No matching transfer in our statement");
  await snapEl(kumar, "f07-reject-row");
  await kumar.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Payment rejected")).toBeVisible();

  // Corporate
  const corp = page.getByRole("row", { name: /DataCorp/ });
  await snapEl(corp, "f08-corporate-row");
  await corp.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/activated/)).toBeVisible();

  // Event payment
  const ev = page.getByRole("row", { name: /Lim Wei/ });
  await snap(page, "f09-event-payments", ev);
  await snapEl(ev, "f10-event-row");
  await ev.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/Event payment verified/)).toBeVisible();

  // Verified tab with receipts; save one receipt PDF
  await page.goto("/admin/payments?status=verified");
  await snap(page, "f11-verified-tab");
  const href = await page.getByRole("link", { name: /MY\/MEM\// }).first().getAttribute("href");
  fs.writeFileSync(`${OUT}/receipt.pdf`, await (await page.request.get(href!)).body());

  // Offline payment recorded on the member record
  await page.goto("/admin/members?category=I");
  await snap(page, "f12-members");
  await page.getByRole("link", { name: "Sarah Tan" }).click();
  await page.getByText("Record a payment received outside the portal").click();
  await page.getByLabel("Amount (RM)").fill("150");
  await page.getByLabel("Reference").fill("AMB5566778899");
  await page.getByLabel("Note").fill("Paid before registering; matched on the AmBank statement");
  await snap(page, "f13-record-offline", page.getByRole("button", { name: "Record payment & issue receipt" }));
  await page.getByRole("button", { name: "Record payment & issue receipt" }).click();
  await expect(page.getByText(/Payment recorded/)).toBeVisible();
  await snap(page, "f14-recorded-flash");

  // Exports
  await page.goto("/admin/export");
  await snap(page, "f15-export");
  await page.goto("/admin/emails");
  await snap(page, "f16-email-log");
});
