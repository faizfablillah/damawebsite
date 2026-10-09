import "server-only";
import { cookies } from "next/headers";

// Confirmation banners travel in a short-lived cookie set by our own actions, not in the URL,
// so a link can't make the site show a fake message.
export const FLASH_COOKIE = "dama_flash";

export async function setFlash(msg: string) {
  (await cookies()).set(FLASH_COOKIE, msg, { path: "/", maxAge: 60, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

// A fresh query value so the page notices the redirect even when it lands on the same URL
export const flashStamp = () => Date.now().toString(36);
