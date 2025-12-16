import type { PagesFunction } from "@cloudflare/workers-types/experimental";
import type { D1Database } from "@cloudflare/workers-types";
type WorkerResponse = import("@cloudflare/workers-types/experimental").Response;

export interface Env {
    DB: D1Database;
}

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(requestUrl: string, pathWithQuery: string): WorkerResponse {
    const url = new URL(requestUrl);
    const location = `${url.origin}${pathWithQuery}`;
    return new Response(null, {
        status: 303,
        headers: { location, ...SECURITY_HEADERS },
    }) as unknown as WorkerResponse;
}

function toCents(amountStr: string): number | null {
    const s = amountStr.trim();

    // allow dollars with up to 2 decimals
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (n < 1 || n > 1_000_000) return null;

    return Math.round(n * 100);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const ct = request.headers.get("content-type") || "";
        if (
            !ct.includes("application/x-www-form-urlencoded") &&
            !ct.includes("multipart/form-data")
        ) {
            return redirect(request.url, "/admin/donors?err=input");
        }

        const form = await request.formData();

        const name = String(form.get("name") ?? "").trim();
        const amountRaw = String(form.get("amount") ?? "").trim();
        const displayName = String(form.get("displayName") ?? "").trim() || null;
        const inMemoryOf = String(form.get("inMemoryOf") ?? "").trim() || null;

        if (name.length < 2) return redirect(request.url, "/admin/donors?err=input");

        const amountCents = toCents(amountRaw);
        if (amountCents === null) return redirect(request.url, "/admin/donors?err=input");

        await env.DB.prepare(
            `INSERT INTO donors (name, amount_cents, display_name, in_memory_of, source)
       VALUES (?, ?, ?, ?, 'admin')`
        )
            .bind(name, amountCents, displayName, inMemoryOf)
            .run();

        return redirect(request.url, "/admin/donors?ok=1");
    } catch {
        return redirect(request.url, "/admin/donors?err=server");
    }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type",
            ...SECURITY_HEADERS,
        },
    }) as unknown as WorkerResponse;
};
