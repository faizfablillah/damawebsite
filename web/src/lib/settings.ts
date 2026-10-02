import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { TierCode } from "./config";

export type Settings = {
  prices: { EDU: number; IND_EB: number; IND_STD: number; COR_S: number; COR_M: number; COR_L: number; COR_P: number };
  individualPricing: "early_bird" | "standard";
  bank: { bankName: string; accountName: string; accountNumber: string; duitNowNote: string };
  graceDays: number;
  reminderDays: number[];
  website: string;
};

export const DEFAULT_SETTINGS: Settings = {
  prices: { EDU: 2500, IND_EB: 15000, IND_STD: 35000, COR_S: 100000, COR_M: 150000, COR_L: 200000, COR_P: 350000 },
  individualPricing: "early_bird",
  bank: {
    bankName: process.env.BANK_NAME || "AmBank Malaysia",
    accountName: process.env.BANK_ACCOUNT_NAME || "PERSATUAN PENGURUSAN DATA KUALA LUMPUR & SELANGOR",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    duitNowNote: "",
  },
  graceDays: 30,
  reminderDays: [30, 14, 7],
  website: process.env.APP_URL || "",
};

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    prices: { ...DEFAULT_SETTINGS.prices, ...(stored.prices ?? {}) },
    bank: { ...DEFAULT_SETTINGS.bank, ...(stored.bank ?? {}) },
  };
}

export async function saveSettings(values: Partial<Settings>, userId: string) {
  const db = await getDb();
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(schema.settings)
      .values({ key, value, updatedBy: userId })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
  }
}

// Price + receipt line for a tier at the current settings
export function priceFor(tier: TierCode, s: Settings) {
  switch (tier) {
    case "EDU":
      return { unitPrice: s.prices.EDU, itemCode: "EDU", description: "Educational (Student) Membership — 12 months" };
    case "IND":
      return s.individualPricing === "early_bird"
        ? { unitPrice: s.prices.IND_EB, itemCode: "IND-EB", description: "Individual Membership (Early Bird) — 12 months" }
        : { unitPrice: s.prices.IND_STD, itemCode: "IND-STD", description: "Individual Membership — 12 months" };
    case "COR_S":
      return { unitPrice: s.prices.COR_S, itemCode: "COR-S", description: "Corporate Membership — Small Enterprise, 12 months" };
    case "COR_M":
      return { unitPrice: s.prices.COR_M, itemCode: "COR-M", description: "Corporate Membership — Medium Enterprise, 12 months" };
    case "COR_L":
      return { unitPrice: s.prices.COR_L, itemCode: "COR-L", description: "Corporate Membership — Large Enterprise, 12 months" };
    case "COR_P":
      return { unitPrice: s.prices.COR_P, itemCode: "COR-P", description: "Corporate Membership — Enterprise Plus, 12 months" };
  }
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return (row?.value as Settings[K]) ?? DEFAULT_SETTINGS[key];
}
