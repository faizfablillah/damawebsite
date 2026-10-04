import { test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Optional: SCREENS=1 npx playwright test — saves screenshots of key screens (runs after membership.spec.ts).
test.skip(!process.env.SCREENS, "screenshots only when SCREENS=1");
test.describe.configure({ mode: "serial" });

const shots: [string, string, string][] = [
  ["home", "", "/"],
  ["about", "", "/about"],
  ["leadership", "", "/leadership"],
  ["events", "", "/events"],
  ["membership", "", "/membership"],
  ["contact", "", "/contact"],
  ["privacy", "", "/privacy"],
  ["login", "", "/login"],
  ["forgot-password", "", "/forgot-password"],
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
  ["portal-individual", "ravi@example.com", "/portal"],
  ["profile", "ravi@example.com", "/portal/profile"],
  ["admin-renewals", "admin@test.dama.my", "/admin/renewals"],
  ["admin-emails", "admin@test.dama.my", "/admin/emails"],
  ["admin-import", "admin@test.dama.my", "/admin/import"],
  ["admin-admins", "admin@test.dama.my", "/admin/admins"],
  ["admin-audit", "admin@test.dama.my", "/admin/audit"],
];

// Show scroll-triggered fade-ins, then save the page in screen-sized parts (full-page shots are too small to review)
async function shoot(page: Page, name: string) {
  await page.evaluate(() => {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.waitForTimeout(900);
  const { width } = page.viewportSize()!;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const part = width < 600 ? 1300 : 1100;
  for (let y = 0, i = 1; y < total; y += part, i++) {
    await page.screenshot({ path: `test-results/screens/${name}-${i}.png`, fullPage: true, clip: { x: 0, y, width, height: Math.min(part, total - y) } });
  }
}

for (const [name, who, url] of shots) {
  test(`screenshot ${name}`, async ({ page }) => {
    if (who) await login(page, who);
    else await page.context().clearCookies();
    await page.goto(url);
    if (name === "organisation-seats") await page.getByRole("link", { name: "Manage seats & details" }).click();
    if (name === "pay") await page.getByRole("link", { name: "Pay and upload receipt" }).click();
    if (name === "admin-member-detail") await page.getByRole("link", { name: "Acme Data Sdn Bhd" }).click();
    await page.waitForLoadState("networkidle");
    await shoot(page, name);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400); // let the menu's hide transition finish
    await shoot(page, `${name}-mobile`);
  });
}
