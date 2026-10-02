import { ORG } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="site-footer" style={{ padding: "44px 0 24px" }}>
      <div className="container">
        <div className="footer-bottom" style={{ borderTop: 0, paddingTop: 0 }}>
          <p>
            © {new Date().getFullYear()} {ORG.registeredName}. ROS {ORG.rosNo}.
          </p>
          <p>
            <a href="/privacy">Privacy Policy</a> · <a href={`mailto:${ORG.email}`}>{ORG.email}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
