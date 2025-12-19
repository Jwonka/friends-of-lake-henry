import type { APIRoute } from "astro";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

function redirect(origin: string, path: string) {
    return new Response(null, { status: 303, headers: { location: `${origin}${path}`, ...SECURITY_HEADERS } });
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

function datePrefixFromDatetimeLocal(v: string) {
    // v: "YYYY-MM-DDTHH:MM"
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
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

        const urlField = String(form.get("url") ?? "").trim() || null;
        const urlLabel = String(form.get("url_label") ?? "").trim() || null;

        if (!title || !kind) return redirect(url.origin, "/admin/events/new?err=invalid");

        // if not TBD, require a start date (datetime-local format)
        if (!isTbd && !dateStartRaw) return redirect(url.origin, "/admin/events/new?err=invalid");

        const prefix = isTbd ? "tbd" : (datePrefixFromDatetimeLocal(dateStartRaw) ?? "tbd");
        const base = `${prefix}-${slugify(title)}`.replace(/-+/g, "-");

        const DB = (locals as any).runtime.env.DB;

        const id = await generateId(DB, base);

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
            id, title, kind, status,
            isTbd ? null : dateStartRaw,
            isTbd ? null : (dateEndRaw || null),
            isTbd,
            location, summary,
            urlField, urlLabel
        ).run();

        return redirect(url.origin, `/admin/events/${encodeURIComponent(id)}?ok=updated`);
    } catch {
        return redirect(url.origin, "/admin/events/new?err=server");
    }
};
