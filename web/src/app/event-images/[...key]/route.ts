import { contentTypeFor, readFile } from "@/lib/storage";

// Event cover images are public (only keys under event-image/ are served here)
export async function GET(_req: Request, ctx: RouteContext<"/event-images/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key.startsWith("event-image/") || key.includes("..")) return new Response("Not found", { status: 404 });
  const type = contentTypeFor(key);
  if (!type.startsWith("image/")) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(key);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
