# DAMA Kuala Lumpur & Selangor — Project Handover

_Last updated: 9 October 2026. Owner: Faiz Fablillah (VP Secretary, DAMA KL & Selangor)._

This file is the single place to pick the project up again: what exists, why it was built this way, how to run and deploy it, and what is still open. Sensitive context (bank details, board discussions, personal contacts) is in `PRIVATE-CONTEXT.md`, which is **kept on the project computer only and never committed** (this repository is public).

---

## 1. Status at a glance

| Piece | Where | Status |
|---|---|---|
| Static website v1 (6 pages) | `docs/` → https://faizfablillah.github.io/damawebsite/ | **Live** on GitHub Pages (contact email fixed to info.damamalaysia@gmail.com). |
| Website + membership system | `web/` (Next.js app) | **Live for board testing** at **https://dama.org.my** (since 9 Oct 2026; `www.dama.org.my` and the old https://dama-malaysia.vercel.app redirect there) (Vercel Hobby + Supabase, Singapore). Every push to `main` redeploys. Runs locally with `npm run dev`. |
| Automated tests | `web/tests/` | 24 end-to-end tests (membership, security, backups/alerts, events, news, announcements), all passing on dev and production builds. `SCREENS=1` also saves desktop + phone screenshots of every page in `web/test-results/screens/` for visual review. |
| Repository | https://github.com/faizfablillah/damawebsite (public) | Branch `main`. |
| Board walkthrough deck | https://claude.ai/artifact/J2zotetrS29KZq6A9HEooe (private Slides artifact) | 30 slides, made 5 Oct 2026: why/how it was built, the registration journey with screenshots, data storage and security, costs, next steps and board asks, Part 5 (added 6 Oct, **board only**: comparison with the earlier vendor quotation; details in `PRIVATE-CONTEXT.md`), technical appendix. Export to PowerPoint from the deck (Share → Export) and save it in the project root. Root `*.pptx` files are git-ignored. |

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

- Pages: `/` (Home), `/about`, `/leadership`, `/membership`, `/contact`, `/privacy` are static HTML in `web/public/*.html` (clean URLs via `web/next.config.ts`). `/events` and `/news` are app pages (below). The homepage's "Join us at our next events" strip is filled from `/api/public/feed` by `assets/js/main.js` and stays hidden when nothing is upcoming.
- **Events** (`/events`, `/events/<slug>`; added 9 Oct 2026): created in **Admin → Events** by super admins or the **Events admin** role (Programs team). Each event is *everyone* or *members only*, with a member price and a non-member price (0 = free), optional capacity and closing time, a cover image, an online link (shown only to confirmed attendees) and members-only "slides & recordings". Registration needs a free account (PDPA consent comes with it). Free → confirmed at once (email + calendar invite). Paid → bank transfer + receipt upload (`/portal/events/<id>`), **Finance verifies in Admin → Payments → Event payments**, then the attendee gets the confirmation with an official receipt `MY/EVT/YYYY/NNNN`. Members = active/grace personal members, corporate contacts and corporate seat holders. The daily job emails confirmed attendees a reminder the day before. Event admins can mark attendance, export attendees (CSV), cancel registrations and email attendees.
- **News** (`/news`, `/news/<slug>`): Markdown files in `web/content/news/` (format in its README) — ask the maintainer to add posts; `membersOnly: true` hides the body from non-members (member offers). The five earlier write-ups from the old static Events page are now news posts; old `/events#…` links forward to them.
- **Announce** (Admin → Announce, super + membership admins): email all active members, or everyone with an account who consented. Free email plans allow ~100 emails/day.
- Menu has **Member Login** and **Join Us**; Membership page "Join now" buttons go to `/join?tier=student|individual|corporate`.
- Contact email everywhere: **info@dama.org.my** (Zoho, since 9 Oct 2026; replaces info.damamalaysia@gmail.com on the site, in emails and on receipts). Emails are sent as **"DAMA Malaysia" <info@dama.org.my>** (`MAIL_FROM`).
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

**Roles:** Super admin (all), Membership admin (members, approvals, corporate, seats, export, announcements), Finance (payments incl. event payments, receipts, export), **Events admin** (events and attendees only — no member records or payments). First super admin = an account whose email is in `SUPER_ADMIN_EMAILS`, granted only after the email is confirmed and only while no super admin exists (so production ignores it now; add further admins in Admin → Admins). Super admins can also **disable** an account there (signs it out everywhere, blocks login and password reset).

---

## 7. Technology

- **Next.js 16.3** (App Router, Server Actions, Turbopack) + React 19, TypeScript. Next 16 differs from older versions — read `web/node_modules/next/dist/docs/` before changing framework code (async `params`/`cookies()`, `proxy` instead of `middleware`).
- **Database:** Drizzle ORM. Locally an embedded Postgres (PGlite) in `web/.data/`; in production any Postgres via `DATABASE_URL`. 17 tables (users, sessions, tokens, organisations, notes, documents, memberships, orders, payments, receipts, seats, seat requests, counters, settings, email log, renewal reminders, audit log). Money stored in sen.
- **Auth:** own implementation — bcrypt passwords, 30-day httpOnly session cookie (hashed in DB), email verification and reset tokens.
- **Rate limiting** (`src/lib/rate-limit.ts`, table `auth_attempts`): 5 failed logins per account from one network, 50 per account from anywhere, or 30 per network in 15 min → locked until the window passes or the password is reset (so a stranger can't keep someone else locked out); reset emails 3/hour per address (silent) and 10/hour per IP; sign-up attempts 20/hour per IP (every attempt counts). Old rows pruned by the daily job.
- **Security hardening (9 Oct 2026 review):** every admin page checks access itself (not just the layout); login only redirects within the site; security headers (CSP, no framing, nosniff, referrer and permissions policies) in `next.config.ts`; CSV exports escape formulas; names and organisation names can't contain links; changing a password signs out other devices; confirmation banners travel in a short cookie, not the URL; payment verify/reject and double-submitted applications are race-safe; constant-time cron secret check. `robots.txt` keeps admin/portal out of search; `sitemap.xml` lists public pages. Social preview tags in `public/*.html` use `https://dama-malaysia.vercel.app` — **change them when the domain moves to dama.org.my**.
- **Files:** private storage (local disk, or any S3-compatible bucket such as Supabase Storage). Uploads checked by content (PDF/JPG/PNG/WEBP, ≤ 4 MB). Served only to admins or the owner.
- **Email:** Microsoft 365 via the Graph API (`MS_*` settings — used now, sending as faiz@keppstone.onmicrosoft.com), or SMTP (`SMTP_*`, e.g. a Gmail app password for info.damamalaysia@gmail.com later), or, locally, files in `web/.data/outbox` viewable at `/dev/outbox`. Replies always go to info.damamalaysia@gmail.com.
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

**Production (deployed 4 Oct 2026, board testing):**

| Piece | Where |
|---|---|
| Site | **https://dama.org.my** (`APP_URL`; `CANONICAL_HOST=dama.org.my` makes `www` and `dama-malaysia.vercel.app` redirect, except `/api/*`) |
| Domain | `dama.org.my` registered at **YeahHost** (owner: Faiz's YeahHost account); nameservers `ns1/ns2.vercel-dns.com`, so **DNS is managed in Vercel** (Vercel → Domains, or `npx vercel dns`). Old static site on GitHub Pages now forwards to dama.org.my |
| Hosting | Vercel project `dama-malaysia` (Hobby, account faizfablillah / team "Faiz Fablillah's projects"), root directory `web`, linked to GitHub — **every push to `main` redeploys** (~2 min) |
| Database + files | Supabase project `dama-malaysia` (Singapore, ref `zzwgvnxywxclxjfyrjok`), **session pooler port 5432** (switched from the transaction pooler 6543 on 9 Oct 2026 — see Gotchas), private bucket `dama-files` (S3 access key "vercel") |
| Email | **Zoho Mail** (Mail Lite, 2 users, bought 9 Oct 2026): `admin@dama.org.my` (Zoho super admin) and `info@dama.org.my` (shared public inbox). The website sends as **info@dama.org.my** over SMTP `smtppro.zoho.com:465` with an app-specific password (`SMTP_*`, `MAIL_FROM` in Vercel + `web/.env.production.local`). DNS in Vercel: MX mx/mx2/mx3.zoho.com, SPF `include:zohomail.com`, DKIM selector `zmail` (verified), DMARC `p=none` reporting to admin@. The old Microsoft Graph sender is switched off (`MS_*` removed from Vercel; kept commented locally) |
| Daily job | Vercel Cron 01:00 UTC (9 am MYT) → `/api/cron/daily`: statuses + renewal reminders, **nightly database backup** (bucket `backups/`, kept 30 days, super admins download in Admin → Export), then a health check that **emails the super admins** (or `ALERT_EMAILS`) if a step failed or any email failed to send in the last 24 h. `?testAlert=1` sends a test alert |
| Secrets | git-ignored `web/.env.production.local` (all production values) + Vercel env vars (secrets marked sensitive) |

Re-running the setup or changing a setting: edit `web/.env.production.local`, update the variable in Vercel (`npx vercel env add NAME production`), redeploy. Never paste secrets in chat — log in with `! npx vercel login`, `! az login`, or put values in the git-ignored files.

**Still to do before real members pay:** upgrade Vercel to **Pro (~USD 20/month)** (Hobby is non-commercial only); wipe the board's test data; import existing members; later point `dama.org.my` at the app and retire `docs/` / GitHub Pages.

**Maintenance scripts** (`web/scripts/`, run from `web/`; each shows a dry run unless `--confirm` is given, and saves a local `*.json.gz` safety copy first — these files hold personal data and are git-ignored):

| Task | Command |
|---|---|
| Launch day: wipe test data, restart Member IDs / receipt numbers at 0001, keep Settings and your account | `npx tsx --env-file=.env.production.local scripts/launch-reset.ts --keep=faiz@keppstone.onmicrosoft.com --confirm`, then empty `payment-proof/`, `student-proof/`, `corporate-docs/` in Supabase → Storage → dama-files |
| Restore a backup (download it from Admin → Export first) | `npx tsx --env-file=.env.production.local scripts/restore-backup.ts dama-YYYY-MM-DD.json.gz --confirm` |

Backups contain database records only; uploaded files stay in the bucket. Supabase's free plan has no downloadable backups of its own, so download one from Admin → Export now and then and keep it in DAMA's drive (not email). Restore was tested end to end on 9 Oct 2026 (restored data identical to the backup).

Estimated running cost: RM 0/month at launch; ~RM 100–200/month with Vercel Pro (+ Supabase Pro later). Board's estimate was RM 3,050/year (~20 individual members).

---

## 9. Open items / next steps

- [x] **Deployed** 4 Oct 2026 for board testing: Vercel project `dama-malaysia` (root `web`, GitHub-linked), Supabase project `dama-malaysia` (Singapore, private bucket `dama-files`), email via Microsoft 365 Graph as faiz@keppstone.onmicrosoft.com (Entra app "DAMA website", Mail.Send; client secret expires Oct 2028). Secrets: git-ignored `web/.env.production.local` + Vercel.
- [x] **First production test run** (6 Oct 2026): Faiz signed up as super admin with faiz@keppstone.onmicrosoft.com and ran the individual journey end to end on the same account (sign-up → confirm email → apply → upload proof → verify → receipt `MY/MEM/2026/0001`, Member ID `IMYKL26-0001`). All 4 emails sent through Graph with no errors, the proof file is in the `dama-files` bucket, the daily job returns 200, and all public pages and links load. This is test data, so wipe it before launch.
- [x] **Outside-email test** (6 Oct 2026): faizfablillah@gmail.com signed up and ran the corporate journey (Corporate Small, `CMYSL26-0001`, receipt `MY/MEM/2026/0002`, 5 empty seats). All 4 emails reached Gmail. Individual and Corporate are now tested; Student is not (needs a .edu address).
- [ ] **Board testing email** (drafted 6 Oct 2026; feedback deadline set by Faiz): link, test steps, one email can hold Individual + Corporate, Gmail "+test" tip, Student needs .edu, check Junk, don't pay real money, test data wiped later, propose Eva (Membership admin) and Peggy (Finance), hosting cost, existing-member list, TIN question. Attach the deck **re-exported after 6 Oct** so it includes Part 5. If already sent with the older export, send the new one as a follow-up.
- [ ] While the board tests: check Admin → Payments daily and verify their test payments; when Eva and Peggy agree, give their accounts the Membership admin / Finance roles; collect feedback and work through it.
- [ ] Board decisions proposed in Part 5 of the deck: continue in-house, ask for the dama.org.my transfer, build no-code page editing before launch, name a second technical volunteer, move accounts to DAMA ownership.
- [x] **Entra app restricted** (9 Oct 2026): Exchange Online application access policy — the "DAMA website" app may only send as members of the hidden mail-enabled security group `dama-website-senders` (just faiz@keppstone.onmicrosoft.com). Tested: Granted for that mailbox, Denied for the other 2 mailboxes; production email still sends. When the sender changes, add the new mailbox to that group (or switch to SMTP and delete the app).
- [x] Email switched to Zoho `info@dama.org.my` (9 Oct 2026). Later: delete the Entra app "DAMA website" and the `dama-website-senders` group in the keppstone tenant once Zoho has run smoothly for a while; the public contact address moved to info@dama.org.my on 9 Oct 2026 — give whoever monitored the old Gmail inbox access to info@ in Zoho, and set an auto-reply/forward on info.damamalaysia@gmail.com pointing to info@dama.org.my.
- [x] Supabase CLI access token deleted and `web/.env.supabase-cli` removed (9 Oct 2026). Create a new token only when the CLI is needed again, and delete it afterwards.
- [ ] Before launch: wipe test data with `scripts/launch-reset.ts` (dry run on production checked 9 Oct: 3 test memberships, 2 test accounts); move Vercel/Supabase to DAMA-owned accounts (or consider Microsoft for Nonprofits — DAMA-owned tenant, possible Azure credits).
- [ ] Upgrade Vercel to **Pro** before real members pay; later move Vercel/Supabase to DAMA-owned accounts.
- [ ] Replace placeholder **testimonials**; review **event write-ups**.
- [ ] Get full-resolution **board headshots** and AFED / Launchpad / MMU event photos (current ones are extracted from the Infopack PDF).
- [ ] **TIN** for receipts — not verified; confirm with the Treasurer/VP Finance (receipt currently shows ROS no. only).
- [ ] Collect the spreadsheet of **existing paid members** (Eva / Peggy) and import it.
- [ ] Decide admins and roles (PICs, finance) — currently only the owner.
- [ ] Later options discussed: online payment gateway (Billplz / ToyyibPay / iPay88 / Stripe — needs a merchant account in the association's name), events/community, LMS, analytics, member badges, custom domain `dama.org.my`.
- Known limitations: changing tier (e.g. student → individual) means a new application and new Member ID; corporate organisation details are changed by emailing the chapter; individual pricing switch is global.

---

## 10. Gotchas learned

- **Use Supabase's session pooler (port 5432), not the transaction pooler (6543).** With the transaction pooler, when more queries were queued than the client had connections (the admin dashboard runs ~13 at once on a pool of 5), postgres.js lost one or two of them and the page hung until Vercel's 300 s timeout ("Admin does nothing", 9 Oct 2026). Reproduced every time on 6543 (with and without pipelining or type fetching); 50/50 queries fine on 5432. `scripts/check-db-reconnect.ts` re-checks it. The client also closes idle connections after 5 s and starts fresh after a 10 s gap, because Vercel pauses instances and their sockets can die meanwhile (`src/db/index.ts`).
- **Never query outside the transaction inside `db.transaction`** — the embedded local database has one connection and deadlocks (read settings before the transaction).
- Admin actions redirect back with `?msg=` (shown by `Flash`) because the row/form that triggered them often disappears.
- Windows/PowerShell: Node, Git and GitHub CLI were installed with winget; in a fresh tool shell reload PATH from the registry. The GitHub CLI token lacks the `workflow` scope, so GitHub Actions files can't be pushed (that's why Pages publishes from `docs/`).
- Headless Edge screenshots can't go narrower than 540 px; Playwright (`tests/zz-screens.spec.ts`, `SCREENS=1`) gives true 390 px phone shots, in screen-sized parts.
- Grid columns holding tables must be `minmax(0, 1fr)` (not `1fr`), or the table stretches the page instead of scrolling inside `.table-scroll`.
- `styles.css` loads after `app.css`, so app overrides of `.btn` / `.container` need a more specific selector (e.g. `.btn.btn--light`).
- `npm` held back post-install scripts for esbuild / unrs-resolver; everything works without them.
