# DAMA Kuala Lumpur & Selangor — website + membership system

One Next.js app that serves:

- **The public website** — the static pages in `public/*.html` (Home, About, Leadership, Events, Membership, Contact, Privacy), served at clean URLs (`/about`, `/membership`…).
- **Membership sign-up and member portal** — `/join`, `/signup`, `/login`, `/portal`.
- **Admin back office** — `/admin`.

## How membership works

| Step | Student | Individual | Corporate |
|---|---|---|---|
| Account | Name, email (**must end in .edu or .edu.my**), phone, address, state, password, PDPA consent → email verification | same, any email | same (contact person) |
| Application | Institution, graduation year, **student card / offer letter upload**, interests | Background, interests | Company details (SSM no., industry, size, address), tier, interests; optional “PIC please contact me first” |
| Payment | Bank transfer to AmBank → member uploads the receipt | same | same |
| Admin | Verifies payment **and** approves eligibility | Verifies payment | Verifies payment (part payments supported) |
| Result | Member ID `EMYSL26-0001`, welcome email + receipt PDF | `IMYKL26-0001` | `CMYKL26-0001` with seats `/S01…`; contact adds seat holders, swaps need admin approval |

- Membership lasts 12 months from activation (20 Aug 2026 → 19 Aug 2027), then a 30-day grace period, then Expired. Renewing keeps the same Member ID; renewing early or during grace keeps the dates continuous.
- Member ID = category (E/I/C) + `MY` + state code + 2-digit year first joined + running number per category per year.
- Receipt numbers: `MY/MEM/YYYY/NNNN`. Receipts follow the VP Finance layout, no logo, SST 0%, “not an LHDN e-Invoice”.
- Renewal reminders are emailed 30, 14 and 7 days before expiry, at the start of grace and on expiry (daily job).
- Prices, early-bird vs standard individual pricing, bank details, grace days and reminder days are edited in **Admin → Settings**.

Admin roles: **Super admin** (everything), **Membership admin** (approvals, members, corporate, seats), **Finance** (payments, receipts, exports). The first super admin is whoever signs up with an email listed in `SUPER_ADMIN_EMAILS`.

## Run it on this computer

```powershell
cd web
npm install
npm run dev          # http://localhost:3000
```

Local development needs nothing else: the database is an embedded Postgres stored in `web/.data/`, uploads go to `web/.data/uploads/`, and emails are written to `web/.data/outbox/` instead of being sent.

Tests (drive Microsoft Edge through every flow on a fresh database):

```powershell
npx playwright test                      # against the dev server
npx next build; $env:E2E_PROD=1; npx playwright test tests/membership.spec.ts   # against the production build
```

## Settings (environment variables)

| Variable | Needed in production | What it is |
|---|---|---|
| `APP_URL` | yes | Public address, used in email links, e.g. `https://dama-membership.vercel.app` |
| `SUPER_ADMIN_EMAILS` | yes | Comma-separated emails that become super admin on sign-up/login |
| `DATABASE_URL` | yes | Postgres connection string (Supabase “transaction pooler”, port 6543). Migrations run automatically on start |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | yes | Private file storage for payment proofs and documents (Supabase Storage S3 keys work) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | yes | Sending email. Gmail: `smtp.gmail.com`, `465`, the Gmail address and an **app password** |
| `CRON_SECRET` | yes | Protects `/api/cron/daily`; the scheduler sends `Authorization: Bearer <secret>` |
| `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` | optional | Starting bank details (editable later in Admin → Settings) |
| `DATA_DIR` | no | Local data folder (default `.data`) |

Never commit `.env.local` — it holds secrets.

## Deploying

1. Create a Postgres database + a private storage bucket (e.g. Supabase) and copy the connection string and S3 keys.
2. Create a Gmail app password for the sending address.
3. Deploy this `web/` folder to a Node.js host (e.g. Vercel: root directory `web`), set the variables above.
4. Schedule a daily `GET /api/cron/daily` with the bearer secret (Vercel Cron, or any external cron service).
5. Sign up with the super admin email, then in **Admin → Settings** check prices and bank details.
6. Import earlier members in **Admin → Import** (template provided), then ask them to use “Forgot password”.

## Code map

```
src/lib/config.ts        Business rules: tiers, seats, states, org details, roles
src/lib/membership.ts    Applications, payments, part payments, activation, Member IDs, receipts, seats, renewals
src/lib/receipt-pdf.ts   Official receipt PDF
src/lib/email.ts         Email templates and sending (SMTP or local outbox)
src/lib/import.ts        CSV import of existing members
src/db/schema.ts         Database tables (migrations in drizzle/)
src/app/(auth)/          Sign-up, login, verification, password reset
src/app/portal/          Member portal
src/app/admin/           Admin back office
public/                  The public website pages and assets
tests/                   End-to-end tests
```
