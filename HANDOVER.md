# DAMA Kuala Lumpur & Selangor — Project Handover

_Last updated: 4 October 2026. Owner: Faiz Fablillah (VP Secretary, DAMA KL & Selangor)._

This file is the single place to pick the project up again: what exists, why it was built this way, how to run and deploy it, and what is still open. Sensitive context (bank details, board discussions, personal contacts) is in `PRIVATE-CONTEXT.md`, which is **kept on the project computer only and never committed** (this repository is public).

---

## 1. Status at a glance

| Piece | Where | Status |
|---|---|---|
| Static website v1 (6 pages) | `docs/` → https://faizfablillah.github.io/damawebsite/ | **Live** on GitHub Pages (contact email fixed to info.damamalaysia@gmail.com). |
| Website + membership system | `web/` (Next.js app) | **Built and tested, not deployed.** Runs locally with `npm run dev`. |
| Automated tests | `web/tests/` | 12 end-to-end tests, all passing. `SCREENS=1` also saves desktop + phone screenshots of every page in `web/test-results/screens/` for visual review. |
| Repository | https://github.com/faizfablillah/damawebsite (public) | Branch `main`. |

---

## 2. Background and timeline

1. **Brief:** build a website for DAMA Kuala Lumpur & Selangor (DAMA Chapter Malaysia), a non-profit chapter of DAMA International, registered as *PERSATUAN PENGURUSAN DATA KUALA LUMPUR & SELANGOR (DAMA)*, ROS **PPM-016-14-27102023**.
2. **Design source:** a Figma Make design "DAMA Website V1.0" (orange palette, one long page). It could not be fetched (login wall); it was recovered from a browser "Save page" of the Figma file (`DAMA Website V1.0 – Figma Make.html` + `_files/`, kept locally).
3. **Brand source of truth:** `DAMA Branding Materials/DAMA Malaysia Infopack.pdf` (15 pages) replaced the Figma look: navy `#071B41`, green `#00906D`, teal `#007B80`, mint `#4DE1C7`, light `#F1F4FB`; fonts **Open Sauce One** (headings) + **Open Sans** (body); flowing teal line-wave motif. The Figma was used only for layout ideas.
4. **Static site v1** built in plain HTML/CSS/JS (Home, About, Leadership, Events, Membership, Contact), published to GitHub Pages from `docs/`.
5. **Membership system** specified by the board (user journey + back-office spec, Google/Microsoft Forms, VP Finance's Member ID structure and receipt templates, board WhatsApp decisions) and built in `web/`.

---

## 3. Repository layout

```
docs/                       Static website v1 (GitHub Pages). Retire after the app goes live.
web/                        THE APP — public website + membership system (Next.js 16)
  public/*.html             Website pages (ported from docs/, wired to sign-up, privacy page added)
  public/assets/            CSS, JS, fonts, optimised images
  src/                      App code (see web/README.md "Code map")
  drizzle/                  Database migrations (applied automatically)
  tests/                    Playwright end-to-end tests
  README.md                 How to run, configure, deploy
scripts/
  prepare_assets.py         Rebuilds optimised images from the source material (PyMuPDF)
  port_static_site.py       One-off: copied docs/ into web/public and wired it to the app
  screenshot.ps1            Headless Edge screenshots of docs/ pages
HANDOVER.md                 This file
PRIVATE-CONTEXT.md          Local only (git-ignored) — sensitive context
```

**Kept on this computer only (git-ignored) and why:**

| Item | Reason |
|---|---|
| `DAMA Branding Materials/` (logo, Infopack PDF) | Internal document; source for assets |
| `DAMA Media Assets/` (≈300 MB photos, 188 MB launch video) | Too large for GitHub (100 MB file limit); originals only — web copies are in `web/public/assets/img` |
| `DAMA Website V1.0 – Figma Make*` | Saved Figma page (third-party app code) |
| `DAMA Malaysia Board of Directors/` (chat export) | Private board conversation |
| `DAMA Receipt*.pdf`, `Receipt format.jpeg`, `Gmail - *.pdf` | Contain bank details / personal data |
| `web/.env.local` | Secrets and local settings |
| `web/.data/`, `web/.data-test/` | Local database, uploads, email outbox |
| `PRIVATE-CONTEXT.md` | Sensitive project context |

**Back these up separately** (e.g. OneDrive / Google Drive) — they are not in GitHub.

---

## 4. The public website

- Pages: `/` (Home), `/about`, `/leadership`, `/events`, `/membership`, `/contact`, `/privacy`. Served from `web/public/*.html` with clean URLs (rewrites in `web/next.config.ts`).
- Menu has **Member Login** and **Join Us**; Membership page "Join now" buttons go to `/join?tier=student|individual|corporate`.
- Contact email everywhere: **info.damamalaysia@gmail.com** (the board's real inbox; `dama.org.my` is not live).
- Content from the Infopack: vision/mission, goals, journey (Dec 2022 → May 2025 launch), DAMA International facts (founded 1980, 71 chapters / 43 countries as of July 2026), Board of Directors (12, headshots from the Infopack), events (Launch 13 May 2025 at PwC AI Leadership Conference; MoU with Universiti Malaya 21 Aug 2025; MoU AFED Digital Apr 2026; Data Launchpad Series #1 Jul 2026; MoU MMU Aug 2026), membership pricing and corporate tiers, key data areas, upcoming activities.
- **Placeholders still on the site:** the three homepage testimonials are invented (marked `PLACEHOLDER` in `web/public/index.html`) — replace with real quotes before launch. Event write-ups are short and factual; a board member should review them.

---

## 5. Membership rules (agreed with the board / user)

| Rule | Value |
|---|---|
| Tiers | **Educational (Student)** RM 25/yr · **Individual** RM 150/yr early bird (`IND-EB`; standard RM 350 `IND-STD`, switch in Settings) · **Corporate** Small RM 1,000 (5 seats) / Medium RM 1,500 (10) / Large RM 2,000 (15) / Enterprise Plus RM 3,500 (20) |
| Student eligibility | Email must end in `.edu` or `.edu.my` **and** upload student card or offer letter; admin approves |
| Payment (v1) | Bank transfer to the association's AmBank account → member uploads proof → admin verifies. **No payment gateway, no LHDN e-invoice** (non-profit, outside MyInvois; SST 0% per VP Finance) |
| Corporate | Pay-first (matches the board's corporate Google Form) with optional "PIC please contact me first" lead. Part payments supported; activate only when fully paid |
| Payment references | `DAMA MBRP EDU <Name>` · `DAMA MBRP IND <Name>` · `DAMA MBRP Ent <Small/Medium/Large/Plus> <Organisation>` |
| Member ID | `[E\|I\|C]` + `MY` + state code + 2-digit year **first joined** + `-` + 4-digit running number (per category, resets yearly). Corporate seats `/S01…/S20`. Never changes on renewal. e.g. `IMYKL26-0001`, `CMYSL26-0001/S03` |
| State codes | JH KD KN MK NS PH PP PK PL SL TR SB SW KL LB PJ OS (Overseas) — from the VP Finance's Member ID structure |
| Term | 12 months from activation (20 Aug 2026 → 19 Aug 2027) |
| Grace period | 30 days after expiry (editable), then Expired. Renewing early or in grace keeps dates continuous |
| Reminders | Emails 30, 14, 7 days before expiry, at grace start and on expiry (daily job) |
| Receipt | VP Finance's layout; header = registered name + ROS no. + email + website; **no logo**; number `MY/MEM/YYYY/NNNN`; corporate shows **seat count only** (named seats live in admin + organisation page); footer "Not an LHDN e-Invoice … SST 0%" |
| Corporate seats | Contact person fills empty seats; replacing a filled seat is a request that an admin approves (receipt note 4) |
| PDPA | Board-approved consent text at sign-up (stored with version + timestamp); Privacy Policy page |
| Existing members | Imported by CSV (Admin → Import), keeping their manual Member IDs; they log in via "Forgot password" |

---

## 6. Member and admin journeys

**Member:** Join → choose tier → create account (name, email, phone, job title, organisation, address, state, password, PDPA consent) → confirm email → application (student: institution, graduation year, proof; corporate: company details, SSM no., tier, interests) → payment page (bank details + exact reference) → upload transfer receipt → "under review" → email with receipt PDF and Member ID → member portal (card, receipts, renew, profile; corporate: seats).

**Admin (`/admin`):** Dashboard (sign-ups today by tier, payments to verify, student checks, corporate leads, seat requests, renewals due, active totals, recent activity) · Payments (verify with actual amount → part payment if less; reject with reason; record offline payment; discount) · Students / Individuals / All members (search, filters, full record) · Corporate (pipeline: New lead → PIC contacted → Invoice sent → Pending payment → Payment review → Pending user list → Active; assign PIC, notes, upload proposals/invoices, manage seats, approve swaps) · Renewals · Email log · Export (members, payments, seats as CSV) · Import · Settings (prices, bank details, grace, reminders) · Admins (roles) · Audit trail.

**Roles:** Super admin (all), Membership admin (members, approvals, corporate, seats, export), Finance (payments, receipts, export). First super admin = any account whose email is in `SUPER_ADMIN_EMAILS`.

---

## 7. Technology

- **Next.js 16.3** (App Router, Server Actions, Turbopack) + React 19, TypeScript. Next 16 differs from older versions — read `web/node_modules/next/dist/docs/` before changing framework code (async `params`/`cookies()`, `proxy` instead of `middleware`).
- **Database:** Drizzle ORM. Locally an embedded Postgres (PGlite) in `web/.data/`; in production any Postgres via `DATABASE_URL`. 17 tables (users, sessions, tokens, organisations, notes, documents, memberships, orders, payments, receipts, seats, seat requests, counters, settings, email log, renewal reminders, audit log). Money stored in sen.
- **Auth:** own implementation — bcrypt passwords, 30-day httpOnly session cookie (hashed in DB), email verification and reset tokens.
- **Rate limiting** (`src/lib/rate-limit.ts`, table `auth_attempts`): 5 failed logins per account or 30 per IP in 15 min → locked until the window passes or the password is reset; reset emails 3/hour per address (silent) and 10/hour per IP; sign-ups 20/hour per IP. Old rows pruned by the daily job.
- **Files:** private storage (local disk, or any S3-compatible bucket such as Supabase Storage). Uploads checked by content (PDF/JPG/PNG/WEBP, ≤ 4 MB). Served only to admins or the owner.
- **Email:** SMTP (Gmail app password planned) or, locally, files in `web/.data/outbox` viewable at `/dev/outbox`.
- **PDF receipts:** pdfkit, generated from a stored snapshot (receipts never change after issue).
- **Daily job:** `GET /api/cron/daily` with `Authorization: Bearer CRON_SECRET` (scheduled in `web/vercel.json`, 01:00 UTC).

---

## 8. Run, test, deploy

```powershell
# Run locally (http://localhost:3000; local inbox at /dev/outbox)
cd web
npm install          # first time only
npm run dev

# Tests (Microsoft Edge, fresh database each run)
npx playwright test
npx next build; $env:E2E_PROD=1; npx playwright test tests/membership.spec.ts
```

Local admin: sign up with the email in `web/.env.local` → `SUPER_ADMIN_EMAILS` (currently faiz@keppstone.onmicrosoft.com), confirm via `/dev/outbox`.

**Deployment plan (not done yet — needs the owner's logins):**
1. **Supabase** (free): account under faiz@keppstone.onmicrosoft.com, project in Singapore. Need: transaction-pooler connection string (`DATABASE_URL`), a private storage bucket and its S3 keys.
2. **Vercel**: same account; root directory `web`. Hobby (free) is fine for board testing but is **non-commercial only** — move to **Pro (~USD 20/month)** before real members pay.
3. **Email**: Gmail **app password** for info.damamalaysia@gmail.com (requires 2-Step Verification on that account), or another sending address.
4. Put secrets in a file (never paste them in chat), set them as Vercel environment variables (list in `web/README.md`), deploy, sign up as super admin, check Settings (prices, bank details), import existing members.
5. Cut over: point the domain (later `dama.org.my`) to the app and retire `docs/` / GitHub Pages.

Estimated running cost: RM 0/month at launch; ~RM 100–200/month with Vercel Pro (+ Supabase Pro later). Board's estimate was RM 3,050/year (~20 individual members).

---

## 9. Open items / next steps

- [ ] **Deploy** (§8) — waiting on Supabase, Vercel and Gmail app password.
- [ ] Replace placeholder **testimonials**; review **event write-ups**.
- [ ] Get full-resolution **board headshots** and AFED / Launchpad / MMU event photos (current ones are extracted from the Infopack PDF).
- [ ] **TIN** for receipts — not verified; confirm with the Treasurer/VP Finance (receipt currently shows ROS no. only).
- [ ] Collect the spreadsheet of **existing paid members** (Eva / Peggy) and import it.
- [ ] Decide admins and roles (PICs, finance) — currently only the owner.
- [ ] Later options discussed: online payment gateway (Billplz / ToyyibPay / iPay88 / Stripe — needs a merchant account in the association's name), events/community, LMS, analytics, member badges, custom domain `dama.org.my`.
- Known limitations: changing tier (e.g. student → individual) means a new application and new Member ID; corporate organisation details are changed by emailing the chapter; individual pricing switch is global.

---

## 10. Gotchas learned

- **Never query outside the transaction inside `db.transaction`** — the embedded local database has one connection and deadlocks (read settings before the transaction).
- Admin actions redirect back with `?msg=` (shown by `Flash`) because the row/form that triggered them often disappears.
- Windows/PowerShell: Node, Git and GitHub CLI were installed with winget; in a fresh tool shell reload PATH from the registry. The GitHub CLI token lacks the `workflow` scope, so GitHub Actions files can't be pushed (that's why Pages publishes from `docs/`).
- Headless Edge screenshots can't go narrower than 540 px; Playwright (`tests/zz-screens.spec.ts`, `SCREENS=1`) gives true 390 px phone shots, in screen-sized parts.
- Grid columns holding tables must be `minmax(0, 1fr)` (not `1fr`), or the table stretches the page instead of scrolling inside `.table-scroll`.
- `styles.css` loads after `app.css`, so app overrides of `.btn` / `.container` need a more specific selector (e.g. `.btn.btn--light`).
- `npm` held back post-install scripts for esbuild / unrs-resolver; everything works without them.
