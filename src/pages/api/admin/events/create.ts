import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { redirect } from "../../../../lib/http";

function redirectTo(origin: string, path: string) {
    return redirect(`${origin}${path}`, 303);
}

function slugify(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function isDatetimeLocal(v: string) {
    // "YYYY-MM-DDTHH:MM"
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
}

function nowDatetimeLocalUtc() {
    // server-side “now” in UTC formatted like datetime-local
    // NOTE: This is UTC, not admin’s local timezone. It’s still a solid backstop.
    return new Date().toISOString().slice(0, 16);
}

function datePrefixFromDatetimeLocal(v: string) {
    // v: "YYYY-MM-DDTHH:MM"
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function validateOptionalUrl(raw: string | null): string | null {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;

    try {
        const u = new URL(s);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        return u.toString();
    } catch {
        return null;
    }
}


async function generateId(DB: any, base: string) {
    let id = base;
    for (let n = 2; n <= 30; n++) {
        const exists = await DB.prepare(`SELECT 1 FROM events WHERE id = ?`).bind(id).first();
        if (!exists) return id;
        id = `${base}-${n}`;
    }
    // last resort
    return `${base}-${Date.now()}`;
}

export const POST: APIRoute = async ({ request, locals, url }) => {
    try {
        const form = await request.formData();

        const title = String(form.get("title") ?? "").trim();
        const kind = String(form.get("kind") ?? "").trim();
        const statusRaw = String(form.get("status") ?? "draft").trim();
        const status = statusRaw === "published" ? "published" : "draft";

        const isTbd = form.get("is_tbd") ? 1 : 0;

        const dateStartRaw = String(form.get("date_start") ?? "").trim();
        const dateEndRaw = String(form.get("date_end") ?? "").trim();

        const location = String(form.get("location") ?? "").trim() || null;
        const summary = String(form.get("summary") ?? "").trim() || null;

        const urlRaw = String(form.get("url") ?? "").trim() || null;
        const eventUrl = validateOptionalUrl(urlRaw);
        if (urlRaw && !eventUrl) {
            return redirectTo(url.origin, "/admin/events/new?err=url");
        }

        const urlLabel = String(form.get("url_label") ?? "").trim() || null;

        if (!title || !kind) {
            return redirectTo(url.origin, "/admin/events/new?err=invalid");
        }

        if (!isTbd) {
            if (!dateStartRaw || !isDatetimeLocal(dateStartRaw)) {
                return redirectTo(url.origin, "/admin/events/new?err=invalid");
            }

            if (dateEndRaw && !isDatetimeLocal(dateEndRaw)) {
                return redirectTo(url.origin, "/admin/events/new?err=invalid");
            }

            if (dateEndRaw && dateEndRaw < dateStartRaw) {
                return redirectTo(url.origin, "/admin/events/new?err=dates");
            }

            const now = nowDatetimeLocalUtc();
            if (dateStartRaw < now) {
                return redirectTo(url.origin, "/admin/events/new?err=past");
            }

            if (dateEndRaw && dateEndRaw < now) {
                return redirectTo(url.origin, "/admin/events/new?err=past");
            }
        }

        const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
        const DB = env?.DB;
        if (!DB) return redirectTo(url.origin, "/admin/events?err=server");


        const prefix = isTbd ? "tbd" : (datePrefixFromDatetimeLocal(dateStartRaw) ?? "tbd");
        const baseId = `${prefix}-${slugify(title)}`.replace(/-+/g, "-");
        const id = await generateId(DB, baseId);

        await DB.prepare(`
            INSERT INTO events (
                id, title, kind, status,
                date_start, date_end, is_tbd,
                location, summary,
                url, url_label,
                created_at, updated_at
            ) VALUES (
                         ?, ?, ?, ?,
                         ?, ?, ?,
                         ?, ?,
                         ?, ?,
                         datetime('now'), datetime('now')
                     )
        `).bind(
            id,
            title,
            kind,
            status,
            isTbd ? null : dateStartRaw,
            isTbd ? null : (dateEndRaw || null),
            isTbd,
            location,
            summary,
            eventUrl,
            urlLabel
        ).run();

        return redirectTo(
            url.origin,
            `/admin/events/${encodeURIComponent(id)}?ok=created`
        );
    } catch {
        return redirectTo(url.origin, "/admin/events/new?err=server");
    }
};