// Fixed business rules for DAMA Kuala Lumpur & Selangor membership.
// Prices, bank details and reminder settings are editable in Admin → Settings (see settings.ts).

export const ORG = {
  registeredName: "PERSATUAN PENGURUSAN DATA KUALA LUMPUR & SELANGOR (DAMA)",
  shortName: "DAMA Kuala Lumpur & Selangor",
  rosNo: "PPM-016-14-27102023",
  email: "info.damamalaysia@gmail.com",
  linkedin: "https://www.linkedin.com/company/dama-malaysia-kuala-lumpur/",
};

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const TIME_ZONE = "Asia/Kuala_Lumpur";

// Member ID state codes (from the board-approved Member ID structure)
export const STATES = [
  { code: "JH", name: "Johor" },
  { code: "KD", name: "Kedah" },
  { code: "KN", name: "Kelantan" },
  { code: "MK", name: "Melaka" },
  { code: "NS", name: "Negeri Sembilan" },
  { code: "PH", name: "Pahang" },
  { code: "PP", name: "Pulau Pinang" },
  { code: "PK", name: "Perak" },
  { code: "PL", name: "Perlis" },
  { code: "SL", name: "Selangor" },
  { code: "TR", name: "Terengganu" },
  { code: "SB", name: "Sabah" },
  { code: "SW", name: "Sarawak" },
  { code: "KL", name: "W.P. Kuala Lumpur" },
  { code: "LB", name: "W.P. Labuan" },
  { code: "PJ", name: "W.P. Putrajaya" },
  { code: "OS", name: "Overseas / outside Malaysia" },
] as const;
export type StateCode = (typeof STATES)[number]["code"];
export const STATE_CODES = STATES.map((s) => s.code) as [StateCode, ...StateCode[]];
export const stateName = (code: string | null | undefined) =>
  STATES.find((s) => s.code === code)?.name ?? code ?? "";

export type Category = "E" | "I" | "C";
export type TierCode = "EDU" | "IND" | "COR_S" | "COR_M" | "COR_L" | "COR_P";

type Tier = {
  code: TierCode;
  category: Category;
  label: string; // shown to users
  seats: number;
  refPrefix: string; // bank transfer reference prefix
};

export const TIERS: Record<TierCode, Tier> = {
  EDU: { code: "EDU", category: "E", label: "Educational (Student)", seats: 1, refPrefix: "DAMA MBRP EDU" },
  IND: { code: "IND", category: "I", label: "Individual", seats: 1, refPrefix: "DAMA MBRP IND" },
  COR_S: { code: "COR_S", category: "C", label: "Small Enterprise", seats: 5, refPrefix: "DAMA MBRP Ent Small" },
  COR_M: { code: "COR_M", category: "C", label: "Medium Enterprise", seats: 10, refPrefix: "DAMA MBRP Ent Medium" },
  COR_L: { code: "COR_L", category: "C", label: "Large Enterprise", seats: 15, refPrefix: "DAMA MBRP Ent Large" },
  COR_P: { code: "COR_P", category: "C", label: "Enterprise Plus", seats: 20, refPrefix: "DAMA MBRP Ent Plus" },
};
export const CORPORATE_TIERS: TierCode[] = ["COR_S", "COR_M", "COR_L", "COR_P"];

export const CATEGORY_LABEL: Record<Category, string> = { E: "Student", I: "Individual", C: "Corporate" };

// Public tier slugs used in URLs (/join?tier=student)
export const TIER_SLUGS = { student: "EDU", individual: "IND", corporate: "COR" } as const;
export type TierSlug = keyof typeof TIER_SLUGS;

export const KEY_DATA_AREAS = [
  "AI & Machine Learning",
  "Data Platform & Self-service Analytics",
  "Responsible AI",
  "Data Quality",
  "Metadata Management",
  "Data Ethics",
  "Master Data Management",
  "Data Security",
  "Data Privacy",
  "Data Literacy & Fluency",
];

export const CORPORATE_INTERESTS = [
  "Corporate seats for our team",
  "Training programmes / CDMP",
  "Sponsorships",
  "Speaking opportunities",
  "Custom data workshop",
  "Executive roundtables",
];

export const ORG_SIZES = ["1–50 employees", "51–200 employees", "201–1,000 employees", "1,001–5,000 employees", "More than 5,000 employees"];

export const COMM_PREFERENCES = ["Event invitations", "Newsletters", "Training & certification updates", "Volunteering opportunities"];

// Student eligibility: academic email domain
export function isAcademicEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain === "edu" || domain.endsWith(".edu") || domain === "edu.my" || domain.endsWith(".edu.my");
}

export const PDPA_CONSENT_VERSION = "2026-06-25";
export const PDPA_CONSENT_TEXT = {
  intro:
    "By submitting this form, I hereby give my consent to DAMA Kuala Lumpur & Selangor (DAMA Malaysia) to:",
  items: [
    "Provide me with information related to DAMA membership updates",
    "Contact me regarding membership sign-up and follow-up",
    "Send me newsletters and event-related communications",
    "Invite me to DAMA events or programs",
  ],
  outro:
    "I understand that my personal data will be processed in accordance with the Malaysia Personal Data Protection Act (PDPA) and its 2024 amendments, and I may withdraw my consent at any time by contacting DAMA Malaysia.",
  checkbox: "I acknowledge and agree to the above terms and provide my consent.",
};

export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export type Role = "member" | "super_admin" | "membership_admin" | "finance" | "events_admin";
export const ADMIN_ROLES: Role[] = ["super_admin", "membership_admin", "finance", "events_admin"];
export const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  super_admin: "Super admin",
  membership_admin: "Membership admin",
  finance: "Finance",
  events_admin: "Events admin",
};

// backoffice = can open the admin area at all; view = member records and the dashboard;
// events = create events and manage attendees; announce = email all members
export type Permission = "backoffice" | "view" | "members" | "payments" | "settings" | "admins" | "import" | "export" | "events" | "announce";
const PERMS: Record<Role, Permission[]> = {
  member: [],
  super_admin: ["backoffice", "view", "members", "payments", "settings", "admins", "import", "export", "events", "announce"],
  membership_admin: ["backoffice", "view", "members", "export", "announce"],
  finance: ["backoffice", "view", "payments", "export"],
  events_admin: ["backoffice", "events"],
};
export const can = (role: Role | null | undefined, perm: Permission) => !!role && PERMS[role].includes(perm);
// Where an admin lands in the back office
export const adminHome = (role: Role) => (can(role, "view") ? "/admin" : "/admin/events");

// Event categories offered in the admin form
export const EVENT_CATEGORIES = ["Talk", "Workshop", "Training", "Networking", "Conference", "Webinar", "Roundtable"];
