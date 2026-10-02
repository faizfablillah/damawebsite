"use client";

import { useSearchParams } from "next/navigation";

// Confirmation banner set by admin actions (?msg=…)
export function Flash() {
  const msg = useSearchParams().get("msg");
  if (!msg) return null;
  return (
    <div className="notice notice--success" role="status">
      {msg}
    </div>
  );
}
