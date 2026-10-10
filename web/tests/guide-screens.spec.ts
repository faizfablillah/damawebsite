import fs from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { lastMail, linkIn, login, mails, PASSWORD, PNG, signup, verifyEmail } from "./helpers";

// Optional: GUIDE=1 npx playwright test tests/guide-screens.spec.ts — screenshots for the "How to join" guide,
// desktop and phone, saved to test-results/guide/. Uses made-up people on the test database.
test.skip(!process.env.GUIDE, "guide screenshots only when GUIDE=1");
test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 2 });

const OUT = "test-results/guide";
const ADMIN = "admin@test.dama.my";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// One screenshot per size, scrolled so that `focus` (if given) is in view
async function snap(page: Page, name: string, focus?: Locator) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [suffix, size] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
    await page.setViewportSize(size);
    await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // dev-only badge
    if (focus) await focus.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}-${suffix}.png` });
  }
  await page.setViewportSize(DESKTOP);
}

async function openMail(page: Page, to: string, template: string, name: string) {
  const mail = await lastMail(to, template);
  await page.goto(`/dev/outbox/${encodeURIComponent(mail.file.replace(/\.json$/, ""))}.html`);
  await snap(page, name);
  return mail;
}

test("guide: setup", async ({ page }) => {
  await signup(page, { name: "DAMA Admin", email: ADMIN });
  await verifyEmail(page, ADMIN);
  // Mask the account number: the real one is on each member's payment page
  await page.goto("/admin/settings");
  await page.locator('input[name="bankName"]').fill("AmBank (M) Berhad");
  await page.locator('input[name="accountNumber"]').fill("XXXX XXXX XXXX");
  await page.locator('input[name="accountName"]').fill("PERSATUAN PENGURUSAN DATA KUALA LUMPUR & SELANGOR");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});

test("guide: individual journey", async ({ page }) => {
  const EMAIL = "aisyah@example.com";
  await page.context().clearCookies();
  await page.setViewportSize(DESKTOP);

  await page.goto("/");
  await snap(page, "01-home");
  await page.goto("/membership");
  await snap(page, "02-membership", page.getByText("Individual").first());
  await page.goto("/join");
  await snap(page, "03-join");

  await page.goto("/signup?tier=individual");
  await page.getByLabel("Full name").fill("Aisyah Rahman");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Contact number").fill("012-345 6789");
  await page.getByLabel(/^Organisation/).fill("Data Co Sdn Bhd");
  await page.getByLabel("Correspondence address").fill("1 Jalan Data, 47300 Petaling Jaya");
  await page.getByLabel("State").selectOption("SL");
  await page.getByLabel("Password", { exact: false }).first().fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await snap(page, "04-signup-top", page.getByLabel("Full name"));
  await page.getByLabel("I acknowledge and agree").check();
  await snap(page, "05-signup-consent", page.getByLabel("I acknowledge and agree"));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/check-email/);
  await snap(page, "06-check-email");

  const verify = await openMail(page, EMAIL, "verifyEmail", "07-email-verify");
  await page.goto(linkIn(verify));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await snap(page, "08-email-confirmed");

  await page.goto("/portal/apply?tier=individual");
  await page.getByLabel("Data Privacy").check();
  await page.getByLabel("Data Quality").check();
  await snap(page, "09-apply", page.getByLabel("Data Quality"));
  await page.getByLabel(/I'm applying for/).check();
  await snap(page, "10-apply-submit", page.getByRole("button", { name: "Continue to payment" }));
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByText("DAMA MBRP IND Aisyah Rahman").first()).toBeVisible();
  await snap(page, "11-pay-details");
  await page.getByLabel("Amount transferred (RM)").fill("150");
  await page.getByLabel("Bank reference / transaction no.").fill("AMB1234567890");
  await page.getByLabel("Bank transfer receipt").setInputFiles(PNG);
  await snap(page, "12-pay-upload", page.getByRole("button", { name: "Submit payment" }));
  await page.getByRole("button", { name: "Submit payment" }).click();
  await expect(page.getByText("your payment details have been submitted")).toBeVisible();
  await snap(page, "13-under-review");

  // DAMA checks the transfer (shown for the "what happens next" slide)
  await login(page, ADMIN);
  await page.goto("/admin/payments");
  await page.getByRole("row", { name: /Aisyah Rahman/ }).getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/activated/)).toBeVisible();

  await openMail(page, EMAIL, "welcome", "14-email-welcome");
  await login(page, EMAIL);
  await snap(page, "15-portal-member");
  await page.goto("/login");
  await page.context().clearCookies();
  await page.goto("/login");
  await snap(page, "16-login");
  await page.goto("/forgot-password");
  await snap(page, "17-forgot-password");
});

test("guide: student and corporate", async ({ page }) => {
  const STUDENT = "daniel@siswa.um.edu.my";
  await signup(page, { tier: "student", name: "Daniel Lee", email: STUDENT, state: "KL", organisation: "Universiti Malaya" });
  await verifyEmail(page, STUDENT);
  await page.setViewportSize(DESKTOP);
  await page.goto("/portal/apply?tier=student");
  await page.getByLabel("Expected graduation year").fill("2027");
  await page.getByLabel("Proof of student status").setInputFiles(PNG);
  await snap(page, "20-student-apply", page.getByLabel("Proof of student status"));

  const CORP = "hidayah@datacorp.com.my";
  await signup(page, { tier: "corporate", name: "Nur Hidayah", email: CORP, state: "SL" });
  await verifyEmail(page, CORP);
  await page.setViewportSize(DESKTOP);
  await page.goto("/portal/apply?tier=corporate");
  await snap(page, "21-corporate-tiers", page.getByText("Medium Enterprise"));
  await page.getByText("Medium Enterprise").click();
  await page.getByLabel("Organisation name").fill("DataCorp Sdn Bhd");
  await page.getByLabel("Company registration no.").fill("202301012345");
  await page.getByLabel("Industry").fill("Financial services");
  await page.getByLabel("Organisation size").selectOption({ index: 2 });
  await page.getByLabel("State (registered office)").selectOption("SL");
  await page.getByLabel("Registered office address").fill("Level 10, Menara DataCorp, Petaling Jaya");
  await page.getByLabel("Job title").fill("Head of Data");
  await snap(page, "22-corporate-details", page.getByLabel("Organisation name"));
  await page.getByLabel("Corporate seats for our team").check();
  await page.getByLabel(/I confirm that the above information/).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("DAMA MBRP Ent Medium DataCorp Sdn Bhd").first()).toBeVisible();
  await page.getByLabel("Amount transferred (RM)").fill("1500");
  await page.getByLabel("Bank reference / transaction no.").fill("AMB9876543210");
  await page.getByLabel("Bank transfer receipt").setInputFiles(PNG);
  await page.getByRole("button", { name: "Submit payment" }).click();
  await expect(page.getByText("your payment details have been submitted")).toBeVisible();

  await login(page, ADMIN);
  await page.goto("/admin/payments");
  await page.getByRole("row", { name: /DataCorp/ }).getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/activated/)).toBeVisible();
  await login(page, CORP);
  await page.setViewportSize(DESKTOP);
  await snap(page, "23-corporate-portal");
  await page.getByRole("link", { name: "Manage seats & details" }).click();
  await expect(page.getByRole("heading", { name: "Seats" })).toBeVisible();
  await snap(page, "24-corporate-seats", page.getByText(/Seat/).first());
  expect(mails(CORP, "corporateActive").length).toBe(1);
});
