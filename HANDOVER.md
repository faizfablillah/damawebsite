# DAMA Kuala Lumpur & Selangor — Project Handover

_Last updated: 11 October 2026. Owner: Faiz Fablillah (VP Secretary, DAMA KL & Selangor)._

This file is the single place to pick the project up again: what exists, why it was built this way, how to run and deploy it, and what is still open. Sensitive context (bank details, board discussions, personal contacts) is in `PRIVATE-CONTEXT.md`, which is **kept on the project computer only and never committed** (this repository is public).

---

## 1. Status at a glance

| Piece | Where | Status |
|---|---|---|
| Old static website v1 | `docs/` → https://faizfablillah.github.io/damawebsite/ | **Retired**: every page now forwards to https://dama.org.my. |
| Website + membership system | `web/` (Next.js app) | **Live for board testing** at **https://dama.org.my** (since 9 Oct 2026; `www.dama.org.my` and the old https://dama-malaysia.vercel.app redirect there) (Vercel Hobby + Supabase, Singapore). Every push to `main` redeploys. Runs locally with `npm run dev`. |
| Automated tests | `web/tests/` | 26 end-to-end tests (membership, security, backups/alerts, admin notifications, events incl. partner events, news, announcements), all passing on dev and production builds. `SCREENS=1` also saves desktop + phone screenshots of every page in `web/test-results/screens/` for visual review. |
| Repository | https://github.com/faizfablillah/damawebsite (public) | Branch `main`. |
| "How to join" guide deck | https://claude.ai/artifact/HNcNP6ws4ASuVcCGWAh5h9 (private Slides artifact; share it from its Share menu) | 19 slides made 10 Oct 2026 for everyone: tiers, the six steps with desktop + phone screenshots, student and corporate extras, common questions. Screenshots come from `GUIDE=1 npx playwright test tests/guide-screens.spec.ts` (made-up people, account number masked) → `web/test-results/guide/`. Step 3 updated 11 Oct: "Tap Confirm email. Your application form opens straight away." A PDF copy is shared on Drive. |
| Membership admin guide (deck + video) | Deck https://claude.ai/artifact/PhMVNwSx3tMRqU7GJyJNbD · video in `DAMA Media Assets/Membership admin guide video/` (local) | 16 slides + 86 s video: dashboard routine, student eligibility, member search and actions, corporate pipeline and leads, seat changes, renewals, Announce (Zoho limit), exports, common member questions. Made 10 Oct 2026; routine slide updated 11 Oct for the admin emails (the video still matches: it says start each day on the Dashboard). |
| Events admin guide (deck + video) | Deck https://claude.ai/artifact/6CWt7BEn4P7JNJ967nMUGt · video in `DAMA Media Assets/Events admin guide video/` (local) | 13 slides + 76 s video: creating, pricing and publishing events, partner events with member offers, attendees and attendance, emailing attendees, cancelling registrations, automatic emails, and the rule that editing or cancelling an event emails nobody. Made 10 Oct 2026. Screens for both: `GUIDE=1 npx playwright test tests/role-guides-screens.spec.ts`. |
| "Join DAMA Malaysia" one-pager | `DAMA Media Assets/How to Join one-pager/` (local) | A4 PDF for print + PNG for posting: why join, the three tiers, six steps and a QR code to dama.org.my/join. Source HTML in `source/` (rendered with Edge via Playwright). Made 10 Oct 2026. |
| Launch + WDS post drafts | `DAMA Media Assets/Launch and WDS posts.md` (local) | LinkedIn, WhatsApp and member-email drafts for the 12 Oct launch and the 13 Oct WDS post, plus the DAMA International listing request. |
| Launch posters | `Poster 1.jpeg`, `Poster 2.jpeg`, `Poster 3.jpeg` in the repo root (git-ignored, made by Faiz 11 Oct) | 1024×1280 (4:5). 1 = KL skyline + laptop (LinkedIn launch post), 2 = dark + phone (WhatsApp / Status / Instagram), 3 = light + phone "Learn. Connect. Grow." (end-of-week reminder). Screens match the real homepage; the tiny logo text inside the device screens is AI-garbled but unreadable at normal size. |
| Finance guide (deck + video) | Deck https://claude.ai/artifact/SQiUnmgDTV1HVz2XYYjMMK (private; Share → Export → PDF for Peggy) · video in `DAMA Media Assets/Finance guide video/` (local) | 16 slides + 71 s video for the Finance role: daily routine, matching against the AmBank statement, verify, part payment, reject, corporate and event payments, receipts, recording outside payments, exports, tricky cases. Routine slide updated 11 Oct for the admin emails (the video's "once a day, open Payments" still holds). Screens from `GUIDE=1 npx playwright test tests/finance-guide-screens.spec.ts`. Made 10 Oct 2026. |
| "How to join" explainer video | `DAMA Media Assets/How to Join video/` (local only, git-ignored) | 81 s, landscape 16:9 + vertical 9:16, Kokoro voiceover (af_heart) + captions, event photos, original music + effects, made 10 Oct 2026 with HyperFrames 0.8.77. Source and re-render steps in that folder's README.txt. Opening line says "six simple steps" (Datin asked to drop "10 minutes" because payment checks take up to 3 business days). |
| Year One Programme proposal (deck) | https://claude.ai/artifact/7S5FUJ6fr2oBsZzageZWQ4 (private Slides artifact) · research notes in `DAMA - Chapter Research/` (local, git-ignored) | 21 slides made 11 Oct 2026 from a study of all 74 DAMA chapter websites on dama.org's chapter list: pricing, why people pay, programme rhythm, peers (Thailand, Japan, Malta, Egypt), six proposed programmes (Monthly Data Talk, CDMP Study Cohort, Data Leaders Roundtable, PDPA & Governance Circle, DAMA Malaysia Data Day ~Q2 2027, Students & Universities), the **Pioneer Member** offer and five board decisions. Timings in quarters, not dates. Board approved the **Pioneer Member** perks (live on the site); the six programmes still wait for the board. |
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
docs/                       Old static site (GitHub Pages) — now only redirect pages to dama.org.my
web/                        THE APP — public website + membership system (Next.js 16)
  public/*.html             Static website pages (Home, About, Leadership, Membership, Contact, Privacy)
  content/news/             News posts (Markdown, one file per post)
  public/assets/            CSS, JS, fonts, optimised images
  src/                      App code (see web/README.md "Code map")
  drizzle/                  Database migrations (applied automatically)
  scripts/                  Maintenance: launch-reset.ts, remove-accounts.ts, restore-backup.ts, check-db-reconnect.ts
  tests/                    Playwright end-to-end tests
  README.md                 How to run, configure, deploy
scripts/
  prepare_assets.py         Rebuilds optimised images from the source material (PyMuPDF)
  port_static_site.py       One-off: copied docs/ into web/public and wired it to the app
  screenshot.ps1            Headless Edge screenshots of docs/ pages
HANDOVER.md                 This file
PRIVATE-CONTEXT.md          Local only (git-ignored) — sensitive context
DAMA - <partner>/           Local only (git-ignored) — partnership folders with internal notes (e.g. WDS APAC 2026)
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
- **Visitor analytics** (12 Oct 2026): Vercel Web Analytics (Vercel → project → Analytics; no cookies, included in Pro). App pages via `src/components/analytics.tsx`, static pages via the `/_vercel/insights/script.js` tag. Admin, file and portal page views are not sent; addresses are stripped of tokens, query strings (except `utm_*` and `tier`) and record IDs. Custom events for the funnel: Account created, Application submitted, Corporate lead, Payment submitted, Event registered, Event payment submitted (recognised from the page each step lands on, so a refresh can count twice). Privacy Policy has a "Website visits" paragraph.
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
| Special term | Super admins can set a board-approved term (1–5 years) and price on an order **before** verifying its payment (Admin → member record → "Special term"); the receipt and end date follow it. Used for the President (10 Oct 2026) and Peggy (11 Oct 2026, IMYKL26-0008), each 3 years for RM 500, description "Individual Membership — 36 months (board-approved)". If the member typed a different amount when submitting, change the amount box next to Verify to what the bank shows |
| Payment references | `DAMA MBRP EDU <Name>` · `DAMA MBRP IND <Name>` · `DAMA MBRP Ent <Small/Medium/Large/Plus> <Organisation>` |
| Member ID | `[E\|I\|C]` + `MY` + state code + 2-digit year **first joined** + `-` + 4-digit running number (per category, resets yearly). Corporate seats `/S01…/S20`. Never changes on renewal. e.g. `IMYKL26-0001`, `CMYSL26-0001/S03` |
| When the Member ID is issued | **Only when a payment is verified** (or recorded by Finance), in the same step as the receipt number. Nothing is created or reserved at account creation, application or upload. So a rejected or failed payment never uses or frees a number, and the sequence has no gaps. Numbers follow the order payments are verified, not sign-up order. The year digits are the year of verification. A part payment gets the ID at its first verified part (membership activates when fully paid); a student gets it at payment verification (activates after proof approval). Once issued, an ID is permanent and never re-assigned, even after expiry. A wrongly verified payment keeps its ID, so Finance must only verify money that is in the statement (rule explained to the VP Finance, 10 Oct 2026) |
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

**Member:** Join → choose tier → create account (name, email, phone, job title, organisation, address, state, password, PDPA consent) → confirm email (the link goes straight to the application for the tier picked on the Join page, or back to the event they came from; no second chooser, since 11 Oct 2026) → application (student: institution, graduation year, proof; corporate: company details, SSM no., tier, interests) → payment page (bank details + exact reference) → upload transfer receipt → "under review" → email with receipt PDF and Member ID → member portal (card, receipts, renew, profile; corporate: seats).

**Admin (`/admin`):** Dashboard (sign-ups today by tier, payments to verify, student checks, corporate leads, seat requests, renewals due, active totals, recent activity) · Payments (verify with actual amount → part payment if less; reject with reason; record offline payment; discount; special term — super admins) · Students / Individuals / All members (search, filters, full record) · Corporate (pipeline: New lead → PIC contacted → Invoice sent → Pending payment → Payment review → Pending user list → Active; assign PIC, notes, upload proposals/invoices, manage seats, approve swaps) · Renewals · Email log · Export (members, payments, seats as CSV) · Import · Settings (prices, bank details, grace, reminders) · Admins (roles) · Audit trail.

**Admin notifications (added 11 Oct 2026, `src/lib/admin-notify.ts`):** admins get an email as each item arrives (membership or event payment to verify → Finance + super admins; student check, new corporate lead, seat change request → Membership admins + super admins), each with the details and a link to the right admin page, plus a 7 am "N items waiting for you" summary from the daily job (only the sections their role covers; not sent when nothing waits). Recipients follow roles in Admin → Admins, so Peggy starts getting payment emails as soon as she has the Finance role. Events admins get none.

**Roles:** Super admin (all), Membership admin (members, approvals, corporate, seats, export, announcements), Finance (payments incl. event payments, receipts, export), **Events admin** (events and attendees only — no member records or payments). First super admin = an account whose email is in `SUPER_ADMIN_EMAILS`, granted only after the email is confirmed and only while no super admin exists (so production ignores it now; add further admins in Admin → Admins). Super admins can also **disable** an account there (signs it out everywhere, blocks login and password reset).

---

## 7. Technology

- **Next.js 16.3** (App Router, Server Actions, Turbopack) + React 19, TypeScript. Next 16 differs from older versions — read `web/node_modules/next/dist/docs/` before changing framework code (async `params`/`cookies()`, `proxy` instead of `middleware`).
- **Database:** Drizzle ORM. Locally an embedded Postgres (PGlite) in `web/.data/`; in production any Postgres via `DATABASE_URL`. 17 tables (users, sessions, tokens, organisations, notes, documents, memberships, orders, payments, receipts, seats, seat requests, counters, settings, email log, renewal reminders, audit log). Money stored in sen.
- **Auth:** own implementation — bcrypt passwords, 30-day httpOnly session cookie (hashed in DB), email verification and reset tokens.
- **Rate limiting** (`src/lib/rate-limit.ts`, table `auth_attempts`): 5 failed logins per account from one network, 50 per account from anywhere, or 30 per network in 15 min → locked until the window passes or the password is reset (so a stranger can't keep someone else locked out); reset emails 3/hour per address (silent) and 10/hour per IP; sign-up attempts 100/hour per IP (every attempt counts; raised from 20 on 10 Oct 2026 for events on shared Wi-Fi). Old rows pruned by the daily job.
- **Security hardening (9 Oct 2026 review):** every admin page checks access itself (not just the layout); login only redirects within the site; security headers (CSP, no framing, nosniff, referrer and permissions policies) in `next.config.ts`; CSV exports escape formulas; names and organisation names can't contain links; changing a password signs out other devices; confirmation banners travel in a short cookie, not the URL; payment verify/reject and double-submitted applications are race-safe; constant-time cron secret check. `robots.txt` keeps admin/portal out of search; `sitemap.xml` lists public pages. Social preview tags in `public/*.html` point at dama.org.my.
- **Files:** private storage (local disk, or any S3-compatible bucket such as Supabase Storage). Uploads checked by content (PDF/JPG/PNG/WEBP, ≤ 4 MB). Served only to admins or the owner.
- **Email:** SMTP (`SMTP_*` — used now: Zoho, sending as "DAMA Malaysia" <info@dama.org.my>), or Microsoft 365 via the Graph API (`MS_*`, switched off), or, locally, files in `web/.data/outbox` viewable at `/dev/outbox`.
- **PDF receipts:** pdfkit, generated from a stored snapshot (receipts never change after issue).
- **Daily job:** `GET /api/cron/daily` with `Authorization: Bearer CRON_SECRET` (scheduled in `web/vercel.json`, 23:00 UTC = 7 am Malaysia).

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
| Database + files | Supabase project `dama-malaysia` (**Pro plan since 10 Oct 2026**, Micro compute, Singapore, ref `zzwgvnxywxclxjfyrjok`), **transaction pooler port 6543, pool of 20** (see Gotchas — the session pooler caps clients at 15), private bucket `dama-files` (S3 access key "vercel") |
| Read-only reader for Hermes (12 Oct 2026) | Schema `hermes_brief` with two views: `payments` (waiting + last 7 days; payer, tier/event, amounts, status, times, Member ID; no contact details, bank refs or proofs) and `members` (member register: Member ID, name, tier, status, state, dates; no contact details). Login role `hermes_brief_reader` can read only those views (read-only, 15 s timeout, 2 connections). Used by Faiz's Hermes assistant for the 06:00 brief. Not part of Drizzle migrations; definition in the hermes repo `brief/dama_db_setup.sql`. Password only on the Hermes VPS. Remove with `drop view hermes_brief.payments, hermes_brief.members; drop schema hermes_brief; drop role hermes_brief_reader;`. If you rename payment/order/membership/event columns, re-run that SQL or the brief's DAMA source fails (it reports so in the brief) |
| Email | **Zoho Mail** (Mail Lite, 2 users, bought 9 Oct 2026): `admin@dama.org.my` (Zoho super admin) and `info@dama.org.my` (shared public inbox). The website sends as **info@dama.org.my** over SMTP `smtppro.zoho.com:465` with an app-specific password (`SMTP_*`, `MAIL_FROM` in Vercel + `web/.env.production.local`). DNS in Vercel: MX mx/mx2/mx3.zoho.com, SPF `include:zohomail.com`, DKIM selector `zmail` (verified), DMARC `p=none` reporting to admin@. The old Microsoft Graph sender is switched off (`MS_*` removed from Vercel; kept commented locally) |
| Daily job | Vercel Cron 23:00 UTC (7 am MYT; moved from 9 am on 11 Oct 2026) → `/api/cron/daily`: statuses + renewal reminders, event reminders, the admins' "waiting for you" summary, **nightly database backup** (bucket `backups/`, kept 30 days, super admins download in Admin → Export), then a health check that **emails the super admins** (or `ALERT_EMAILS`) if a step failed or any email failed to send in the last 24 h. `?testAlert=1` sends a test alert |
| Secrets | git-ignored `web/.env.production.local` (all production values) + Vercel env vars (secrets marked sensitive) |

Re-running the setup or changing a setting: edit `web/.env.production.local`, update the variable in Vercel (`npx vercel env add NAME production`), redeploy. Never paste secrets in chat — log in with `! npx vercel login`, `! az login`, or put values in the git-ignored files.

Vercel is on **Pro** and Supabase on **Pro** since 10 Oct 2026. There are **no earlier paid members to import** (confirmed 10 Oct 2026): board members join through the website like everyone else. Production super admin: **admin@dama.org.my** (the keppstone test account was removed on 10 Oct 2026).

**Maintenance scripts** (`web/scripts/`, run from `web/`; each shows a dry run unless `--confirm` is given, and saves a local `*.json.gz` safety copy first — these files hold personal data and are git-ignored):

| Task | Command |
|---|---|
| Wipe **everything** (all memberships, payments, receipts, logs), restart numbering at 0001, keep Settings, events and the named accounts. **Now that real members exist, don't use this** | `npx tsx --env-file=.env.production.local scripts/launch-reset.ts --keep=admin@dama.org.my --confirm` |
| Remove named accounts with everything they own (memberships, receipts, corporate organisation, uploads), keep everyone else; numbering continues after the highest number still in use | `npx tsx --env-file=.env.production.local scripts/remove-accounts.ts --remove=a@x.com,b@y.com --confirm` |
| Restore a backup (download it from Admin → Export first) | `npx tsx --env-file=.env.production.local scripts/restore-backup.ts dama-YYYY-MM-DD.json.gz --confirm` |

Backups contain database records only; uploaded files stay in the bucket. Supabase Pro also keeps its own daily backups for 7 days (Database → Backups); still download one from Admin → Export now and then and keep it in DAMA's drive (not email). Restore was tested end to end on 9 Oct 2026 (restored data identical to the backup).

Running cost: Supabase Pro ~USD 25/month (since 10 Oct 2026) + Zoho Mail Lite ~RM 10/month; with Vercel Pro (~USD 20/month) about RM 220/month in total. Board's estimate was RM 3,050/year (~20 individual members).

---

## 9. Open items / next steps

### Where things stand (11 Oct 2026, evening)

The system is **production-ready apart from the launch steps below**. Live at https://dama.org.my with: membership (student / individual / corporate, bank transfer + receipts), events (free/paid, members-only, partner events), news, announcements, nightly backups + alert emails, security hardening, email from `info@dama.org.my` (Zoho, SPF/DKIM/DMARC pass, lands in Gmail inbox). First partner content is live: World Data Summit APAC 2026 (event + news post, 29–30 Oct; member promo code shown to members only). Test data was removed on 10 Oct 2026; production now holds real data only: **10 active members** (11 Oct evening; IMY…26-0001 to 0009 are the board, 0010 the first member from outside the board; all individual), all of them Pioneer Members (240 of 250 Pioneer spots left). Admin roles: admin@dama.org.my super admin, **Peggy Finance** (11 Oct). Eva (0009), Iffah (0002) and Quak (0005) are members, so their roles can be given any time. Public launch planned for Mon 12 Oct 2026.

### Launch week plan (agreed 10 Oct 2026)

| When | What | Who |
|---|---|---|
| Done 11 Oct | Board members registered and paid: 9 members, all verified | Board · Faiz verified |
| Next | Give roles in Admin → Admins → "Give or change a role": Eva → Membership admin, Iffah and Quak → Events admin (Peggy → Finance done 11 Oct). Then send each their guide as a Drive PDF link | Faiz (as admin@dama.org.my) |
| Before Mon 12 Oct | Board agrees **when early-bird pricing (RM 150) ends**; switch to RM 350 in Admin → Settings on that date | Board |
| Sun 11 Oct | Faiz asked Iffah to add him as **Content admin** on the DAMA LinkedIn page (Admin tools → Manage admins → Add admin); no reply yet. Fallback: post from Faiz's personal profile tagging @DAMA, board reshares, the page reshares later | Faiz / Iffah |
| Mon 12 Oct, 9 am | **Public launch**: LinkedIn post with **Poster 1** + the drafted launch text; board reshares; WhatsApp groups/Status with **Poster 2**. Ask DAMA International to list https://dama.org.my | Faiz / Programs |
| Mon 12 Oct onwards | Watch Admin → Email log and Admin → Payments daily. The daily job's alert email reports any failed emails | Faiz, Peggy |
| Tue 13 Oct | **WDS APAC 2026**: LinkedIn post + Admin → Announce → Active members (text drafted 9 Oct; run the 4 checks in the drafts file first). Summit is 29–30 Oct | Faiz / Programs |
| Wed 14 Oct | LinkedIn: "six simple steps" how-to-join **video** (LinkedIn can't mix photos and video in one post) | Faiz / Programs |
| Thu/Fri 15–16 Oct | Reminder post with **Poster 3**, optionally thanking the first members | Faiz / Programs |
| When convenient | Old Gmail: forward info.damamalaysia@gmail.com → info@dama.org.my; give Eva access to info@ in Zoho | Faiz |
| Done 11 Oct | **Finance guide sent to Peggy** (Drive PDF) with the Finance role. Join guide PDF on Drive replaced with the 11 Oct version | Faiz |

### Year One Programme and Pioneer Members

- **Board approved the Pioneer Member offer (Oct 2026), then Datin set the limit: only 250 spots, until 31 Dec 2026, whichever comes first.** Pioneers are the **first 250** memberships (students, individuals, corporate; a corporate membership = one spot) whose first payment was **submitted** by 31 Dec 2026, Malaysia time, including members who joined before the offer. Not "Founding", because the chapter was founded earlier (launched May 2025). Perks: (1) priority registration for the first CDMP study group, once the cohort is confirmed; (2) a "Pioneer Member" mark on the digital membership card; (3) a say in which activities run first in 2027.
- **Built:** `src/lib/pioneer.ts` (`PIONEER_SPOTS`, `PIONEER_CUTOFF`) ranks memberships by when their first non-rejected payment was submitted, so a December payer verified in January keeps their place and **a submitted payment holds a spot until Finance rejects it**. The mark shows once the Member ID is issued: a mint "Pioneer Member" mark on the portal member card, a badge on corporate memberships (portal + organisation page), the admin member page and the members list, a **Pioneers only** filter in Admin → members and a `pioneer_member` column in the members export. Corporate seat holders don't get their own mark (their company's membership does). Order checked on production 11 Oct: spots 1–10 = IMY…26-0001 to 0010 in sequence.
- The offer is advertised on `/membership` (banner under the plans) and `/join`: "only 250 spots", plus "Only N spots left" once 100 or fewer remain. Both banners **disappear when the spots are gone or after 31 Dec 2026** (`/api/public/pioneer` + `data-until` in main.js for the static page; `pioneerStatus()` on /join). The mark stays for good.
- **Using perk 1:** when the CDMP study group is set up, filter Admin → members by "Pioneers only" (or the export) and invite them first.
- **Perk 3** (a say in 2027 activities) is **not built on purpose**: in Dec 2026 / Jan 2027 send Pioneers a Google/Microsoft Form (export → pioneer_member = yes for the list).
- The offer is advertised on `/membership` (banner under the plans) and `/join`; both **hide themselves after the cutoff** (`data-until` in membership.html via main.js; `pioneerOfferOpen()` on /join). The badge stays for good.
- Year One Programme deck (six programmes): the board approved the Pioneer perks only; the website "Year One Programme" strip is **not** built (waiting for the board).
- DAMA International's chapter list shows only our LinkedIn, not dama.org.my — include it in the listing request.

### Launch-week cautions

- **Email sending limit (Zoho).** Zoho's official limit is a rolling **50–500 external emails per hour** per sender (it depends on sender reputation, and a new domain starts low), and bulk or burst sending is against its policy (https://www.zoho.com/mail/help/adminconsole/rates-and-limits.html). There is no separate published figure for Mail Lite. Each sign-up sends 4–5 emails over its journey, and Admin → Announce sends one email per recipient back-to-back with **no retry**. So: announce the launch through LinkedIn/WhatsApp rather than Admin → Announce; keep Announce batches under about 40 recipients per hour; check Admin → Email log for failures. If Zoho locks the account it may need a manual unlock in the Zoho admin console. If volume grows, move the website's sending to a transactional email service (keep Zoho for the human inbox) — a change to the `SMTP_*` settings plus DNS records.
- **Admin emails add to the sending volume:** about one email per payment, student application, lead or seat request for each admin with that role, plus one summary per admin each morning. Fine at launch volumes.
- **Sign-up limit** raised to 100 per hour per network on 10 Oct 2026 (was 20), so an event where a room shares one Wi-Fi (QR code on screen, WDS booth) isn't blocked.
- **DNS:** some ISP resolvers (seen on Faiz's home Wi-Fi on 10 Oct) cached the old nameservers and failed to resolve dama.org.my for a day. Test from mobile data and another network before announcing. If a member reports "site can't be reached", ask them to try mobile data or 1.1.1.1 / 8.8.8.8 as DNS.
- **Google Search Console:** domain property dama.org.my, verified by a `google-site-verification=…` TXT record added in Vercel DNS on 10 Oct 2026 (keep that record, or verification lapses). Sitemap to submit: `https://dama.org.my/sitemap.xml`.

### Status of earlier steps

- [x] Vercel Pro and Supabase Pro — 10 Oct 2026.
- [x] Wipe test data — 10 Oct 2026 with `scripts/remove-accounts.ts`.
- [x] ~~Import existing paid members~~ — not needed: there are none (10 Oct 2026). Admin → Import stays available.
- Test sign-ups now create real Member IDs; remove any test accounts with `scripts/remove-accounts.ts`.

### Later / housekeeping (with dates)

| When | Item |
|---|---|
| ~17 Oct 2026 | Delete the local clean-up safety copy `web/remove-accounts-backup-2026-10-10T01-40-13-468Z.json.gz` (personal data; Supabase Pro daily backups cover us by then) |
| ~17 Oct 2026 | Delete `C:\Users\wanmoham\.hf-tts` (offline voice tool for the video) unless more video edits are planned |
| ~19 Oct, then monthly | Download a backup from Admin → Export into DAMA's drive (not email) |
| ~23 Oct 2026 | If Admin → Email log shows no failures, delete the Entra app "DAMA website" and the `dama-website-senders` group in the keppstone tenant |
| ~Apr 2027 | Replace the placeholder **testimonials** with real member quotes (board decision 10 Oct 2026); review the older news write-ups |
| When stable | Move Vercel / Supabase / Zoho / the domain to DAMA-owned accounts (owner keeps them until the system is stable; domain at YeahHost under Faiz's account). Watch renewals: domain (YeahHost), Zoho (yearly), Vercel + Supabase (monthly, Faiz's card) |
| Open | Full-resolution **board headshots** and event photos (current ones come from the Infopack PDF) |
| Open | **TIN** for receipts — confirm with the Treasurer/VP Finance (receipt shows ROS no. only) |
| Ideas | Online payment gateway (needs a merchant account in the association's name), homepage partners strip once there are 4+ partners, members-only resources/recordings library, newsletter archive |

Known limitations: changing tier means a new application and new Member ID; corporate organisation details are changed by emailing the chapter; the individual pricing switch is global; announcements are limited by the email plan's sending limit (above).

### Done (history)

- [x] 12 Oct — **public launch**; Vercel Web Analytics added (visitors + sign-up step events).
- [x] 4 Oct — deployed for board testing (Vercel + Supabase, Singapore).
- [x] 6 Oct — first production runs: individual (Faiz), corporate (Faiz's Gmail), Datin's individual journey.
- [x] 9 Oct — security review + fixes (15 issues), QA, test report workbook (local `DAMA Website Test Report 2026-10-09.xlsx`).
- [x] 9 Oct — nightly backups, alert emails, launch-reset and restore scripts (restore tested end to end).
- [x] 9 Oct — Entra app restricted to Faiz's mailbox; Supabase CLI token deleted.
- [x] 9 Oct — admin pages hanging fixed (Supabase **session** pooler 5432; see Gotchas).
- [x] 9 Oct — events, news, announcements, partner events built; WDS APAC 2026 published.
- [x] 9 Oct — moved to **dama.org.my** (DNS at Vercel); GitHub Pages forwards there.
- [x] 9 Oct — Zoho Mail (admin@, info@); website sends as "DAMA Malaysia" <info@dama.org.my>; contact address switched everywhere.
- [x] 10 Oct — "How to join" deck + video; sign-up limit raised to 100/hour per network; Iffah IMYSL26-0002.
- [x] 10 Oct — Supabase upgraded to Pro (checked afterwards: site, database and reconnect test all fine).
- [x] 11 Oct — admin notification emails (each payment / student check / lead / seat request) and the "waiting for you" summary (7 am); go to admin@ now, and to Finance / Membership admins once roles are given.
- [x] 11 Oct — functions pinned to Singapore (sin1, next to the database; ~3x faster), emails sent after the response; daily job moved to 7 am.
- [x] 11 Oct — confirming the email goes straight to the application for the chosen tier (Join guide step 3 updated).
- [x] 11 Oct — Peggy Low IMYKL26-0008 (3-year special term, RM 500, receipt MY/MEM/2026/0008) and given the **Finance** role; 9 members in total.
- [x] 10 Oct — admin@dama.org.my is the production super admin (account only, no membership); test data removed; **first real member: Datin Habsah, IMYSL26-0001**, 3-year special term (10 Oct 2026 – 9 Oct 2029, RM 500), receipt MY/MEM/2026/0001.

---

## 10. Gotchas learned

- **Database connections (learned the hard way, 9 Oct 2026):** use Supabase's **transaction pooler (port 6543) with a pool of 20** (`src/db/index.ts`). (1) With a *small* pool (5), postgres.js lost queries that queued behind it on the transaction pooler — the admin dashboard (~13 parallel queries) hung until Vercel's 300 s timeout. With 20 nothing was lost (tested up to 50 parallel). (2) The *session* pooler (5432) is not an option: it caps all clients at 15 (`EMAXCONNSESSION`), and paused Vercel instances keep idle connections open, so slots run out and pages return 500s. The client also closes idle connections after 5 s and starts fresh after a 10 s gap. Re-check with `scripts/check-db-reconnect.ts`.
- **Speed (11 Oct 2026):** functions must run in **Singapore** (`"regions": ["sin1"]` in `web/vercel.json`), next to Supabase. Without it Vercel uses Washington DC (`iad1`) and every query crosses the Pacific (~200 ms each; button clicks took seconds). Check with the `X-Vercel-Id` response header: it should read `sin1::sin1::…`. Emails and receipt PDFs are sent **after the page responds** (`src/lib/later.ts`, Next.js `after()`), so clicks don't wait on Zoho; only counted sends (Announce, attendee emails, daily job) and the admin "Resend" buttons still wait.
- **Never query outside the transaction inside `db.transaction`** — the embedded local database has one connection and deadlocks (read settings before the transaction).
- Admin actions redirect back with `?msg=` (shown by `Flash`) because the row/form that triggered them often disappears.
- Windows/PowerShell: Node, Git and GitHub CLI were installed with winget; in a fresh tool shell reload PATH from the registry. The GitHub CLI token lacks the `workflow` scope, so GitHub Actions files can't be pushed (that's why Pages publishes from `docs/`).
- Headless Edge screenshots can't go narrower than 540 px; Playwright (`tests/zz-screens.spec.ts`, `SCREENS=1`) gives true 390 px phone shots, in screen-sized parts.
- Grid columns holding tables must be `minmax(0, 1fr)` (not `1fr`), or the table stretches the page instead of scrolling inside `.table-scroll`.
- `styles.css` loads after `app.css`, so app overrides of `.btn` / `.container` need a more specific selector (e.g. `.btn.btn--light`).
- `npm` held back post-install scripts for esbuild / unrs-resolver; everything works without them.
