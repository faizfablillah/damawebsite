import Link from "next/link";
import { AppHero } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { rm } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Join DAMA" };

export default async function JoinPage() {
  const s = await getSettings();
  const user = await getCurrentUser();
  const href = (tier: string) => (user ? `/portal/apply?tier=${tier}` : `/signup?tier=${tier}`);
  const ind = s.individualPricing === "early_bird" ? s.prices.IND_EB : s.prices.IND_STD;
  return (
    <>
      <AppHero eyebrow="Membership" title="Choose your pathway to DAMA">
        Join DAMA Chapter Malaysia – Kuala Lumpur &amp; Selangor. Pick the membership that fits you to get started.
      </AppHero>
      <div className="app-main">
        <div className="container">
          <div className="tier-cards">
            <Link className="tier-card" href={href("student")}>
              <span className="badge badge--teal">Educational</span>
              <h2>Student</h2>
              <div className="price">
                {rm(s.prices.EDU)} <small className="muted-sm">/ year</small>
              </div>
              <ul>
                <li>For students at a recognised academic institution</li>
                <li>Requires a .edu or .edu.my email address</li>
                <li>Upload your student card or offer letter</li>
              </ul>
              <span className="btn btn--primary btn--sm">Join as a student</span>
            </Link>
            <Link className="tier-card" href={href("individual")}>
              <span className="badge badge--green">{s.individualPricing === "early_bird" ? "Early bird" : "Individual"}</span>
              <h2>Individual</h2>
              <div className="price">
                {rm(ind)} <small className="muted-sm">/ year</small>
              </div>
              <ul>
                <li>For professionals working in data management or a related field</li>
                <li>CDMP support, DMBOK resources and member events</li>
                <li>Membership starts as soon as payment is verified</li>
              </ul>
              <span className="btn btn--primary btn--sm">Join as an individual</span>
            </Link>
            <Link className="tier-card" href={href("corporate")}>
              <span className="badge badge--navy">Organisations</span>
              <h2>Corporate</h2>
              <div className="price">
                {rm(s.prices.COR_S)} – {rm(s.prices.COR_P)} <small className="muted-sm">/ year</small>
              </div>
              <ul>
                <li>5 to 20 named seats for your team</li>
                <li>Brand visibility, speaking and workshop perks</li>
                <li>Prefer to talk first? You can ask our PIC to contact you</li>
              </ul>
              <span className="btn btn--primary btn--sm">Register your organisation</span>
            </Link>
          </div>
          <p className="text-center mt-40 muted">
            Already a member? <Link href="/login">Log in to your account</Link>. Compare benefits on the <a href="/membership">membership page</a>.
          </p>
        </div>
      </div>
    </>
  );
}
