"""One-off: copy the static site (docs/) into the Next.js app (web/public/) and wire it to the membership system.

Run from the project root:  python scripts/port_static_site.py
"""
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs")
DST = os.path.join(ROOT, "web", "public")

FORM = re.compile(r'https://forms\.cloud\.microsoft/Pages/ResponsePage\.aspx\?id=[^"]+')
PAGES = ["index", "about", "leadership", "events", "membership", "contact"]


def clean_links(html):
    html = html.replace('href="index.html"', 'href="/"')
    for p in PAGES[1:]:
        html = re.sub(rf'href="{p}\.html(#[^"]*)?"', lambda m: f'href="/{p}{m.group(1) or ""}"', html)
    return html


def wire(html, name):
    html = FORM.sub("/join", html)
    # The Microsoft form opened in a new tab; the sign-up is part of the site now
    html = re.sub(r'href="/join" target="_blank" rel="noopener"', 'href="/join"', html)
    html = html.replace("info@dama.org.my", "info.damamalaysia@gmail.com")
    # Member login in the main navigation
    html = html.replace(
        '<a class="btn btn--primary btn--sm" href="/join">Join Us</a>',
        '<a href="/login">Member Login</a>\n          <a class="btn btn--primary btn--sm" href="/join">Join Us</a>',
    )
    # Privacy policy link in every footer
    html = html.replace(
        "<p>A chapter of DAMA International</p>",
        '<p><a href="/privacy">Privacy Policy</a> · A chapter of DAMA International</p>',
    )
    if name == "membership":
        # Tier-specific sign-up from the price cards
        tiers = iter(["student", "individual"])
        html = re.sub(r'<a class="btn btn--primary" href="/join">Register interest</a>', lambda m: f'<a class="btn btn--primary" href="/join?tier={next(tiers)}">Join now</a>', html)
        html = html.replace('<a class="btn btn--primary" href="#tiers">Compare tiers</a>', '<a class="btn btn--primary" href="/join?tier=corporate">Join now</a>\n            <a class="link-arrow" href="#tiers" style="color:var(--mint);margin-top:12px">Compare corporate tiers</a>')
    return html


def privacy_page(template):
    body = """
    <section class="page-hero">
      <div class="waves waves--right" aria-hidden="true"></div>
      <div class="container reveal">
        <p class="eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p>How DAMA Kuala Lumpur &amp; Selangor collects, uses and protects your personal data.</p>
      </div>
    </section>
    <section class="section">
      <div class="container prose">
        <p class="muted">Issued by PERSATUAN PENGURUSAN DATA KUALA LUMPUR &amp; SELANGOR (DAMA), ROS registration PPM-016-14-27102023. This notice is provided under the Personal Data Protection Act 2010 (PDPA) and its 2024 amendments.</p>
        <h2>What we collect</h2>
        <ul class="check-list">
          <li>Contact details: name, email address, phone number and correspondence address (including state).</li>
          <li>Professional details: job title, organisation, background and topics of interest.</li>
          <li>For students: institution, expected graduation year and proof of student status.</li>
          <li>For corporate members: organisation name, SSM registration number, contact person and the people holding corporate seats.</li>
          <li>Payment records: amount, date, bank transfer reference and the receipt you upload. We never collect card details.</li>
        </ul>
        <h2>How we use it</h2>
        <ul class="check-list">
          <li>To manage membership applications, payments, receipts, renewals and member records.</li>
          <li>To communicate with you about DAMA activities, events, newsletters and programmes.</li>
          <li>To run surveys and analysis that help us serve the data management community better.</li>
          <li>To meet our obligations as a registered society, including audit and annual reporting.</li>
        </ul>
        <h2>Who can see it</h2>
        <p>Your data is accessible only to authorised DAMA Kuala Lumpur &amp; Selangor office bearers who manage membership and finance. We do not sell your data. We may share it with service providers that host our systems, under confidentiality obligations, or where required by law.</p>
        <h2>How we protect it</h2>
        <p>Accounts are password-protected, payment proofs and student documents are stored privately, and staff access is limited by role and logged.</p>
        <h2>Your rights</h2>
        <p>You may access and correct your personal data from the member portal, ask for a copy, or withdraw your consent for communications at any time. Withdrawing consent may affect our ability to provide membership services. To make a request, email <a href="mailto:info.damamalaysia@gmail.com">info.damamalaysia@gmail.com</a>.</p>
        <h2>Retention</h2>
        <p>We keep membership and payment records for as long as you are a member and for up to seven years afterwards for audit purposes, after which they are deleted or anonymised.</p>
        <p class="note">Last updated: October 2026.</p>
      </div>
    </section>
"""
    html = re.sub(r"(?s)<main id=\"main\">.*</main>", f'<main id="main">{body}  </main>', template)
    html = re.sub(r"<title>.*?</title>", "<title>Privacy Policy | DAMA Kuala Lumpur &amp; Selangor</title>", html)
    html = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="How DAMA Kuala Lumpur & Selangor collects, uses and protects personal data under the PDPA.">', html)
    return html.replace(' aria-current="page"', "")


def main():
    shutil.copytree(os.path.join(SRC, "assets"), os.path.join(DST, "assets"), dirs_exist_ok=True)
    contact = None
    for name in PAGES:
        with open(os.path.join(SRC, f"{name}.html"), encoding="utf-8") as f:
            html = wire(clean_links(f.read()), name)
        if name == "contact":
            contact = html
        with open(os.path.join(DST, f"{name}.html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
        print("ported", name)
    with open(os.path.join(DST, "privacy.html"), "w", encoding="utf-8", newline="\n") as f:
        f.write(privacy_page(contact))
    print("created privacy")


if __name__ == "__main__":
    main()
