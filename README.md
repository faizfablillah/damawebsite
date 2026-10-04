# DAMA Kuala Lumpur & Selangor website

> **Start here:** [`HANDOVER.md`](HANDOVER.md) has the full project context, decisions, status and next steps.
>
> **Live for board testing:** https://dama-malaysia.vercel.app — the website and the membership system live together in [`web/`](web/README.md) (Next.js app with sign-up, member portal, admin, receipts), deployed on Vercel from `main`. The `docs/` folder below is the earlier static version, still published on GitHub Pages until the app replaces it.

Static website for DAMA Chapter Malaysia – Kuala Lumpur & Selangor. Plain HTML, CSS and JavaScript: no build step, no frameworks.

## Preview

Open `docs/index.html` in a browser.

## Deploy

The site is published with **GitHub Pages** from the `docs/` folder of the `main` branch:
https://faizfablillah.github.io/damawebsite/

Every push to `main` republishes it automatically (takes a minute or two). The folder is called `docs/` because that is the folder name GitHub Pages can publish from. To host elsewhere, upload the contents of `docs/` to any static host.

## Structure

```
docs/                    ← the website (this is what gets published)
  index.html             Home
  about.html             DAMA International, chapter overview, journey, key data areas
  leadership.html        Board of Directors
  events.html            News & events with photo galleries
  membership.html        Plans, pricing and corporate tiers
  contact.html           Contact details
  assets/css/styles.css  All styling (brand colours are at the top as variables)
  assets/js/main.js      Mobile menu, carousel, photo lightbox, scroll animations
  assets/img/            Web-optimised images (generated, see below)
  assets/fonts/          Open Sans + Open Sauce One (SIL Open Font License)
scripts/
  prepare_assets.py      Rebuilds docs/assets/img from the source material
  screenshot.ps1         Takes desktop + mobile screenshots for visual checks
DAMA Branding Materials/ Source: logo + Infopack (kept local, not in git)
DAMA Media Assets/       Source: original event and leadership photos (kept local, not in git)
```

## Common edits

- **Header, footer, contact details:** these are repeated in every page, so change all six `.html` files (search and replace works well).
- **Add an event:** in `events.html`, copy one `<article class="event">` block. Add a matching card to the carousel in `index.html`.
- **Images:** put new photos in `docs/assets/img/`, resized to about 1400px wide. Or add them to `scripts/prepare_assets.py` and run `python scripts/prepare_assets.py` (needs `pip install pymupdf`).
- **Brand colours:** edit the `:root` variables at the top of `styles.css`.

## Before launch

- [ ] Replace the **placeholder testimonials** on the home page (marked `PLACEHOLDER` in `index.html`)
- [ ] Confirm **info@dama.org.my** is a real, monitored inbox (it came from the Figma draft)
- [ ] Review the event write-ups in `events.html`
- [ ] Swap in higher-resolution board headshots and AFED / Launchpad / MMU photos when available (current ones are extracted from the Infopack PDF)
