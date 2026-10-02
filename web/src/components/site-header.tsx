import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/config";
import { logoutAction } from "@/app/(auth)/actions";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <div className="container">
        <nav className="nav-bar" aria-label="Main">
          <a className="brand" href="/">
            <img src="/assets/img/logo-480.png" alt="DAMA Kuala Lumpur & Selangor home" width={480} height={346} />
          </a>
          <button className="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="nav-links" id="nav-links">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/events">Events</a>
            <a href="/membership">Membership</a>
            <a href="/contact">Contact</a>
            {user ? (
              <>
                {can(user.role, "view") && <Link href="/admin">Admin</Link>}
                <Link href="/portal">My Membership</Link>
                <form action={logoutAction} style={{ margin: 0 }}>
                  <button className="btn btn--light btn--sm" type="submit">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Member Login</Link>
                <Link className="btn btn--primary btn--sm" href="/join">
                  Join Us
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
