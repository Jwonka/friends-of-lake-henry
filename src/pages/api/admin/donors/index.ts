import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(origin: string, pathWithQuery: string) {
    return new Response(null, {
        status: 303,
        headers: { location: `${origin}${pathWithQuery}`, ...SECURITY_HEADERS },
    });
}

function toCents(amountStr: string): number | null {
    // Allow "$50.00", "50", "50.0", "50.00", "1,234.56"
    const cleaned = amountStr.trim().replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0.01 || n > 1_000_000) return null;

    return Math.round(n * 100);
}


export const POST: APIRoute = async (context) => {
    try {
        const form = await context.request.formData();

        const name = String(form.get("name") ?? "").trim();
        const amountRaw = String(form.get("amount") ?? "").trim();
        const displayName = String(form.get("displayName") ?? "").trim() || null;
        const inMemoryOf = String(form.get("inMemoryOf") ?? "").trim() || null;

        if (name.length < 2) return redirect(context.url.origin, "/admin/donors?err=name");

        const amountCents = toCents(amountRaw);
        if (amountCents === null) return redirect(context.url.origin, "/admin/donors?err=amount");

        const DB = context.locals.runtime.env.DB;

        await DB.prepare(
            `INSERT INTO donors (name, amount_cents, display_name, in_memory_of, source)
             VALUES (?, ?, ?, ?, 'admin')`
        ).bind(name, amountCents, displayName, inMemoryOf).run();

        return redirect(context.url.origin, "/admin/donors?ok=1");
    } catch {
        return redirect(context.url.origin, "/admin/donors?err=server");
    }
};
