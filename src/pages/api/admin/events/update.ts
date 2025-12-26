import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { redirect } from "../../../../lib/http";

function redirectTo(origin: string, path: string) {
    return redirect(`${origin}${path}`, 303);
}

function isDatetimeLocal(v: string) {
    // "YYYY-MM-DDTHH:MM"
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
}

function nowDatetimeLocalChicago() {
    // "YYYY-MM-DDTHH:MM" in America/Chicago
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
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

export const POST: APIRoute = async ({ request, locals, url }) => {
    try {
        const form = await request.formData();

        const id = String(form.get("id") ?? "").trim();
        const title = String(form.get("title") ?? "").trim();
        const kind = String(form.get("kind") ?? "").trim();
        const statusRaw = String(form.get("status") ?? "draft").trim();
        const status = statusRaw === "published" ? "published" : "draft";

        const isTbd = form.get("is_tbd") ? 1 : 0;

        const dateStartRaw = String(form.get("date_start") ?? "").trim();
        const dateEndRaw = String(form.get("date_end") ?? "").trim();

        const location = String(form.get("location") ?? "").trim() || null;
        const summary = String(form.get("summary") ?? "").trim() || null;

        const urlFieldRaw = String(form.get("url") ?? "").trim() || null;
        const urlField = validateOptionalUrl(urlFieldRaw);
        if (urlFieldRaw && !urlField) {
            return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=url`);
        }

        const urlLabel = String(form.get("url_label") ?? "").trim() || null;

        if (!id || !title || !kind) return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=invalid`);

        if (!isTbd) {
            if (!dateStartRaw || !isDatetimeLocal(dateStartRaw)) {
                return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=invalid`);
            }

            if (dateEndRaw && !isDatetimeLocal(dateEndRaw)) {
                return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=invalid`);
            }

            if (dateEndRaw && dateEndRaw < dateStartRaw) {
                return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=dates`);
            }

            const now = nowDatetimeLocalChicago();
            if (dateStartRaw < now) {
                return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=past`);
            }

            if (dateEndRaw && dateEndRaw < now) {
                return redirectTo(url.origin, `/admin/events/${encodeURIComponent(id)}?err=past`);
            }
        }

        const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
        const DB = env?.DB;
        if (!DB) return redirectTo(url.origin, "/admin/events?err=server");

        const res = await DB.prepare(`
      UPDATE events SET
        title = ?,
        kind = ?,
        status = ?,
        date_start = ?,
        date_end = ?,
        is_tbd = ?,
        location = ?,
        summary = ?,
        url = ?,
        url_label = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
            title,
            kind,
            status,
            isTbd ? null : dateStartRaw,
            isTbd ? null : (dateEndRaw || null),
            isTbd,
            location,
            summary,
            urlField,
            urlLabel,
            id
        ).run();

        // @ts-ignore
        const changed = (res?.meta?.changes ?? 0) as number;
        return redirectTo(url.origin, changed ? `/admin/events/${encodeURIComponent(id)}?ok=updated` : "/admin/events?err=notfound");
    } catch {
        // best effort: go back to list
        return redirectTo(url.origin, "/admin/events?err=server");
    }
};
