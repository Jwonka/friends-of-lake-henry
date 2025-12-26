import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { json } from "../../../lib/http";
import { chicagoDatetimeLocalToUtcIso } from "../../../lib/datetime";

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

const TZ = "America/Chicago";
const monthKeyChicagoFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
});

function monthKeyChicagoFromUtcIso(dateStr: string | null) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return monthKeyChicagoFmt.format(d).slice(0, 7);
}

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

function monthStartEndUtc(monthKey: string) {
    const [y, m] = monthKey.split("-").map(Number);

    // next month key in calendar terms
    const nextUtcAnchor = new Date(Date.UTC(y, m, 1, 12));
    const nextKey = `${nextUtcAnchor.getUTCFullYear()}-${String(nextUtcAnchor.getUTCMonth() + 1).padStart(2, "0")}`;

    const startUtc = chicagoDatetimeLocalToUtcIso(`${monthKey}-01T00:00`);
    const endUtc = chicagoDatetimeLocalToUtcIso(`${nextKey}-01T00:00`);
    if (!startUtc || !endUtc) return null;

    return { startUtc, endUtc };
}

export const GET: APIRoute = async ({ locals, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
    const DB = env?.DB;

    if (!DB) { return json({ ok: false, error: "DB missing" }, 500); }

    const currentMonthKey = chicagoCurrentMonthKey();

    // 1) Active months: ONLY months that have published, non-TBD, dated events
    const activeRes = await DB.prepare(`
        SELECT date_start
        FROM events
        WHERE status = 'published'
          AND is_tbd = 0
          AND date_start IS NOT NULL
          AND date_start != ''
    `).all<{ date_start: string }>();

    const activeMonths = Array.from(
        new Set(
            (activeRes.results ?? [])
                .map(r => monthKeyChicagoFromUtcIso(r.date_start) ?? "")
                .filter(isMonthKey)
        )
    ).sort((a, b) => b.localeCompare(a));

    // 2) Default month: latest active month; if none exist, current month
    const defaultMonthKey = activeMonths.includes(currentMonthKey) ? currentMonthKey : (activeMonths[0] ?? currentMonthKey);

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
    const range = monthStartEndUtc(monthKey);
    if (!range) return json({ ok:false, error:"Bad month boundary" }, 400);

    const { startUtc, endUtc } = range;

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
        .bind(startUtc, endUtc)
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
