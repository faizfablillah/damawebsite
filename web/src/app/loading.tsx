// Shown at once while a members or admin page loads, so a click always gives feedback
export default function Loading() {
  return (
    <div className="app-main" role="status" aria-live="polite">
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    </div>
  );
}
