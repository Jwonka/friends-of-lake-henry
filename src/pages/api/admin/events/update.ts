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

        const urlField = String(form.get("url") ?? "").trim() || null;
        const urlLabel = String(form.get("url_label") ?? "").trim() || null;

        if (!id || !title || !kind) return redirect(url.origin, `/admin/events/${encodeURIComponent(id)}?err=invalid`);
        if (!isTbd && !dateStartRaw) return redirect(url.origin, `/admin/events/${encodeURIComponent(id)}?err=invalid`);

        const DB = (locals as any).runtime.env.DB;

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
        return redirect(url.origin, changed ? `/admin/events/${encodeURIComponent(id)}?ok=updated` : "/admin/events?err=notfound");
    } catch {
        // best effort: go back to list
        return redirect(url.origin, "/admin/events?err=server");
    }
};
