import type { MembershipStatus, OrderStatus, PaymentStatus, PipelineStatus } from "@/db/schema";

export function AppHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="app-hero">
      <div className="waves waves--right" aria-hidden="true" />
      <div className="container">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
    </section>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "success" | "warn" | "error"; children: React.ReactNode }) {
  return (
    <div className={`notice notice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

const MEMBERSHIP: Record<MembershipStatus, [string, string]> = {
  pending: ["In progress", "amber"],
  active: ["Active", "green"],
  grace: ["Grace period", "amber"],
  expired: ["Expired", "red"],
  suspended: ["Suspended", "red"],
  rejected: ["Rejected", "red"],
  cancelled: ["Cancelled", ""],
};
const ORDER: Record<OrderStatus, [string, string]> = {
  awaiting_payment: ["Awaiting payment", "amber"],
  pending_verification: ["Payment under review", "blue"],
  part_paid: ["Part paid", "amber"],
  paid: ["Paid", "green"],
  cancelled: ["Cancelled", ""],
};
const PAYMENT: Record<PaymentStatus, [string, string]> = {
  submitted: ["Awaiting verification", "blue"],
  verified: ["Verified", "green"],
  rejected: ["Rejected", "red"],
};
export const PIPELINE: Record<PipelineStatus, [string, string]> = {
  new_lead: ["New lead", "blue"],
  pic_contacted: ["PIC contacted", "teal"],
  invoice_sent: ["Invoice sent", "teal"],
  pending_payment: ["Pending payment", "amber"],
  payment_review: ["Payment review", "blue"],
  pending_user_list: ["Pending user list", "amber"],
  active: ["Active", "green"],
  closed: ["Closed", ""],
};
const ELIGIBILITY: Record<string, [string, string]> = {
  pending: ["Eligibility check pending", "amber"],
  approved: ["Eligibility approved", "green"],
  rejected: ["Eligibility rejected", "red"],
};

function Badge({ map, value }: { map: Record<string, [string, string]>; value: string }) {
  const [label, tone] = map[value] ?? [value, ""];
  return <span className={`badge${tone ? ` badge--${tone}` : ""}`}>{label}</span>;
}
export const MembershipBadge = ({ status }: { status: MembershipStatus }) => <Badge map={MEMBERSHIP} value={status} />;
export const OrderBadge = ({ status }: { status: OrderStatus }) => <Badge map={ORDER} value={status} />;
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Badge map={PAYMENT} value={status} />;
export const PipelineBadge = ({ status }: { status: PipelineStatus }) => <Badge map={PIPELINE} value={status} />;
export const EligibilityBadge = ({ status }: { status: string }) =>
  status === "not_required" ? null : <Badge map={ELIGIBILITY} value={status} />;

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
