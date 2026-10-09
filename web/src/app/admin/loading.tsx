// Shown at once while switching between admin pages. It sits below the admin layout, so the
// layout's login check still runs first (signed-out visitors get a real redirect, not a 200).
export default function Loading() {
  return (
    <p className="muted" role="status" aria-live="polite">
      Loading…
    </p>
  );
}
