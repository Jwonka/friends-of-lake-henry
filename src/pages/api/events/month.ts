import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";

type EventRow = {
    id: string;
    title: string;
    kind: string;
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
    const d = new Date(Date.UTC(y, m - 1, 15, 12));
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        month: "long",
        year: "numeric",
    }).format(d);
}

function monthStartEnd(monthKey: string) {
    const [y, m] = monthKey.split("-").map(Number);
    const start = `${monthKey}-01`;
    const next = new Date(y, m, 1); // JS month is 0-based; m is 1-based, so this is next month
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    const end = `${nextKey}-01`;
    return { start, end };
}

export const GET: APIRoute = async ({ locals, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
    const DB = env?.DB;
    if (!DB) return new Response(JSON.stringify({ ok: false, error: "DB missing" }), { status: 500 });

    const now = new Date();
    const currentMonth = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
    }).format(now).slice(0, 7);

    // Build allowed months (published + non-TBD + has date_start), plus current month
    const monthsRes = await DB.prepare(`
    SELECT DISTINCT substr(date_start, 1, 7) AS monthKey
    FROM events
    WHERE status = 'published'
      AND is_tbd = 0
      AND date_start IS NOT NULL
      AND date_start != ''
    ORDER BY monthKey DESC
  `).all();

    const dbMonths = (monthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey);

    const months = Array.from(new Set([currentMonth, ...dbMonths]))
        .sort((a, b) => b.localeCompare(a));

    // Active months = months with actual published data (excludes the synthetic currentMonth if empty)
    const activeMonths = (monthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a));

    const defaultMonth = activeMonths[0] ?? currentMonth;

    let month = url.searchParams.get("month")?.trim() ?? "";

    if (isMonthKey(month) && months.includes(month)) {
        // ok
    } else {
        month = defaultMonth;
    }

// final safety
    if (!months.includes(month)) month = months[0] ?? currentMonth;

    const idx = months.indexOf(month);
    const prevMonthKey = idx >= 0 && idx + 1 < months.length ? months[idx + 1] : null;
    const nextMonthKey = idx > 0 ? months[idx - 1] : null;

    const { start, end } = monthStartEnd(month);

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
  `).bind(start, end).all<EventRow>();

    const monthEvents = monthRes.results ?? [];

    return new Response(
        JSON.stringify({
            ok: true,
            monthKey: month,
            monthLabel: monthKeyToLabel(month),
            prevMonthKey,
            nextMonthKey,
            monthEvents,
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } }
    );
};
