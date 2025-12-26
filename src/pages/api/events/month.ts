import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { json } from "../../../lib/http";

type EventRow = {
    id: string;
    title: string;
    kind: string;
    status: string;
    date_start: string | null;
    date_end: string | null;
    is_tbd: number;
    location: string | null;
    summary: string | null;
    url: string | null;
    url_label: string | null;
    poster_key: string | null;
    poster_alt: string | null;
};

function isMonthKey(s: string) {
    return /^\d{4}-\d{2}$/.test(s);
}

function monthKeyToLabel(monthKey: string) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 15, 12)); // safe mid-month anchor
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        month: "long",
        year: "numeric",
    }).format(d);
}

function chicagoCurrentMonthKey(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
    })
        .format(d)
        .slice(0, 7);
}

function monthStartEnd(monthKey: string) {
    const [y, m] = monthKey.split("-").map(Number);
    const start = `${monthKey}-01`;

    // next month in UTC (m is 1-based, Date.UTC months are 0-based)
    const nextUtc = new Date(Date.UTC(y, m, 1, 12));
    const nextKey = `${nextUtc.getUTCFullYear()}-${String(nextUtc.getUTCMonth() + 1).padStart(2, "0")}`;
    const end = `${nextKey}-01`;

    return { start, end };
}

export const GET: APIRoute = async ({ locals, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
    const DB = env?.DB;

    if (!DB) { return json({ ok: false, error: "DB missing" }, 500); }

    const currentMonthKey = chicagoCurrentMonthKey();

    // 1) Active months: ONLY months that have published, non-TBD, dated events
    //    (these are the ONLY months that should appear in the dropdown list)
    const activeMonthsRes = await DB.prepare(`
    SELECT DISTINCT substr(date_start, 1, 7) AS monthKey
    FROM events
    WHERE status = 'published'
      AND is_tbd = 0
      AND date_start IS NOT NULL
      AND date_start != ''
    ORDER BY monthKey DESC
  `).all();

    const activeMonths = (activeMonthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey);

    // 2) Default month: latest active month; if none exist, current month
    const defaultMonthKey = activeMonths[0] ?? currentMonthKey;

    // 3) Resolve requested month
    let requested = (url.searchParams.get("month") ?? "").trim();

    // Allow:
    // - any active month
    // - current month (even if not active)
    // Otherwise fallback to defaultMonthKey
    let monthKey =
        (isMonthKey(requested) && (activeMonths.includes(requested) || requested === currentMonthKey))
            ? requested
            : defaultMonthKey;

    // Final hardening (shouldn’t be needed, but keeps behavior predictable)
    if (!isMonthKey(monthKey)) monthKey = defaultMonthKey;

    // 4) Prev/Next logic
    //    - Build "allowed" months
    //    - active months (months with data) plus current month (even if no data)
    //    - Sorted DESC (newest -> oldest)
    const allowedMonths = Array.from(new Set([currentMonthKey, ...activeMonths]))
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a)); // DESC

    const idx = allowedMonths.indexOf(monthKey);

    // Prev = older (move down the DESC list), Next = newer (move up)
    const prevMonthKey = idx >= 0 && idx + 1 < allowedMonths.length ? allowedMonths[idx + 1] : null;
    const nextMonthKey = idx > 0 ? allowedMonths[idx - 1] : null;

    // 5) Query events for resolved monthKey (published only)
    const { start, end } = monthStartEnd(monthKey);

    const monthRes = await DB.prepare(`
    SELECT id, title, kind, status, date_start, date_end, is_tbd,
           location, summary, url, url_label, poster_key, poster_alt
    FROM events
    WHERE status = 'published'
      AND is_tbd = 0
      AND date_start IS NOT NULL
      AND date_start != ''
      AND date_start >= ?
      AND date_start < ?
    ORDER BY date_start ASC, title ASC
  `)
        .bind(start, end)
        .all<EventRow>();

    const monthEvents = monthRes.results ?? [];

    // 6) Dropdown list = active months + current month (even if empty)
    const months = allowedMonths.map((k) => ({ key: k, label: monthKeyToLabel(k) }));

    return json({
        ok: true,
        monthKey,
        monthLabel: monthKeyToLabel(monthKey),
        prevMonthKey,
        nextMonthKey,
        monthEvents,
        months,
        currentMonthKey,
    });
};
