import { test } from "@playwright/test";
import { login } from "./helpers";

// Optional: SCREENS=1 npx playwright test — saves screenshots of key screens (runs after membership.spec.ts).
test.skip(!process.env.SCREENS, "screenshots only when SCREENS=1");
test.describe.configure({ mode: "serial" });

const shots: [string, string, string][] = [
  ["join", "", "/join"],
  ["signup", "", "/signup?tier=individual"],
  ["portal-student", "aina@siswa.um.edu.my", "/portal"],
  ["portal-corporate", "hr@acme.com.my", "/portal"],
  ["organisation-seats", "hr@acme.com.my", "/portal"],
  ["apply-corporate", "ceo@leadco.my", "/portal/apply?tier=corporate"],
  ["pay", "reject@example.com", "/portal"],
  ["admin-dashboard", "admin@test.dama.my", "/admin"],
  ["admin-payments-verified", "admin@test.dama.my", "/admin/payments?status=verified"],
  ["admin-members", "admin@test.dama.my", "/admin/members"],
  ["admin-corporate", "admin@test.dama.my", "/admin/corporate"],
  ["admin-member-detail", "admin@test.dama.my", "/admin/members?category=C"],
  ["admin-settings", "admin@test.dama.my", "/admin/settings"],
];

for (const [name, who, url] of shots) {
  test(`screenshot ${name}`, async ({ page }) => {
    if (who) await login(page, who);
    else await page.context().clearCookies();
    await page.goto(url);
    if (name === "organisation-seats") await page.getByRole("link", { name: "Manage seats & details" }).click();
    if (name === "pay") await page.getByRole("link", { name: "Pay and upload receipt" }).click();
    if (name === "admin-member-detail") await page.getByRole("link", { name: "Acme Data Sdn Bhd" }).click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400); // let the menu's hide transition finish
    await page.screenshot({ path: `test-results/screens/${name}-mobile.png`, fullPage: true });
  });
}
