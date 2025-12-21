import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "cache-control": "no-store",
};

function json(status: number, body: any) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS },
    });
}

const MAX_SESSION_AGE_MS = 8 * 60 * 60 * 1000; // in sync with middleware

function isAuthed(request: Request, env: any): boolean {
    const cookie = request.headers.get("cookie") ?? "";
    const m = cookie.match(/(?:^|;\s*)admin_auth=([^;]+)/);
    if (!m) return false;

    let token = m[1];
    try {
        token = decodeURIComponent(token);
    } catch {
        return false;
    }

    const [secret, tsRaw] = token.split(":");
    const ts = Number(tsRaw);

    const cookieSecret =
        typeof env.ADMIN_COOKIE_SECRET === "string" ? env.ADMIN_COOKIE_SECRET : "";
    if (!cookieSecret || !secret || secret !== cookieSecret) return false;

    if (!Number.isFinite(ts)) return false;

    const age = Date.now() - ts;
    return !(age < 0 || age > MAX_SESSION_AGE_MS);
}

function mustBeIsoDate(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isRealIsoDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    if (!Number.isFinite(d.getTime())) return false;
    // Ensure it didn’t roll over (e.g., 2025-02-30 -> March 2)
    return d.toISOString().slice(0, 10) === s;
}

export const GET: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env as any;
    if (!isAuthed(request, env)) return json(401, { ok: false, error: "Unauthorized" });

    const DB = env.DB as D1Database | undefined;
    if (!DB) return json(500, { ok: false, error: "DB binding missing" });

    const url = new URL(request.url);
    const raffleKey = (url.searchParams.get("raffleKey") ?? "").trim();

    if (!/^\d{4}-\d{2}$/.test(raffleKey)) {
        return json(400, { ok: false, error: "raffleKey (YYYY-MM) required" });
    }

    const { results } = await DB
        .prepare(
            `SELECT id, raffle_key as raffleKey, draw_date as drawDate, ticket_number as ticketNumber, winner_name as name, town
       FROM raffle_winners
       WHERE raffle_key = ?
       ORDER BY draw_date DESC`
        )
        .bind(raffleKey)
        .all();

    return json(200, { ok: true, winners: results ?? [] });
};

export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env as any;
    if (!isAuthed(request, env)) return json(401, { ok: false, error: "Unauthorized" });

    const DB = env.DB as D1Database | undefined;
    if (!DB) return json(500, { ok: false, error: "DB binding missing" });

    let data: any = null;
    try {
        data = await request.json();
    } catch {
        return json(400, { ok: false, error: "Invalid JSON" });
    }

    const action = (data?.action ?? "add").toString();

    if (action === "delete") {
        const id = (data?.id ?? "").toString().trim();
        if (!id) return json(400, { ok: false, error: "Missing id" });

        await DB.prepare(`DELETE FROM raffle_winners WHERE id = ?`).bind(id).run();
        return json(200, { ok: true });
    }
    const drawDate = (data?.drawDate ?? "").toString().trim();
    const raffleKey = drawDate.slice(0, 7); // "YYYY-MM"
    const ticketNumberRaw = (data?.ticketNumber ?? "").toString().trim();
    const name = (data?.name ?? "").toString().trim();
    const town = (data?.town ?? "").toString().trim();

    if (!raffleKey) return json(400, { ok: false, error: "raffleKey required" });
    if (!mustBeIsoDate(drawDate)) return json(400, { ok: false, error: "drawDate must be YYYY-MM-DD" });
    if (!isRealIsoDate(drawDate)) return json(400, { ok: false, error: "drawDate must be a valid date" });

    const ticketNumber = Number(ticketNumberRaw);
    if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) {
        return json(400, { ok: false, error: "ticketNumber must be a positive number" });
    }
    if (name.length < 2) return json(400, { ok: false, error: "name required" });
    if (town.length < 2) return json(400, { ok: false, error: "town required" });

    // Deterministic ID helps avoid duplicates; allow same ticket across different dates.
    const id = `${raffleKey}-${drawDate}-${ticketNumber}`.replace(/[^\w-]/g, "");

    await DB
        .prepare(
            `INSERT OR REPLACE INTO raffle_winners (id, raffle_key, draw_date, ticket_number, winner_name, town)
       VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(id, raffleKey, drawDate, ticketNumber, name, town)
        .run();

    return json(200, { ok: true, id });
};