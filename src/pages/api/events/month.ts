import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";

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

    // next month key
    const next = new Date(y, m, 1); // m is 1-based; Date month is 0-based, so this is next month
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    const end = `${nextKey}-01`;

    return { start, end };
}

export const GET: APIRoute = async ({ locals, url }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
    const DB = env?.DB;

    if (!DB) {
        return new Response(JSON.stringify({ ok: false, error: "DB missing" }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }

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

    // 4) Prev/Next logic (raffle-like)
    //    - If viewing an active month: prev/next within active months
    //    - Special: if viewing latest active month and current month is NOT active, next => currentMonthKey
    //    - If viewing current month but it is NOT active: prev => latest active month, next => null
    let prevMonthKey: string | null = null;
    let nextMonthKey: string | null = null;

    const idx = activeMonths.indexOf(monthKey);

    if (idx !== -1) {
        // Month is active (has data)
        prevMonthKey = idx + 1 < activeMonths.length ? activeMonths[idx + 1] : null;

        const hasCurrentAsActive = activeMonths.includes(currentMonthKey);

        if (idx === 0 && !hasCurrentAsActive && monthKey !== currentMonthKey) {
            // viewing latest active month; allow Next => current month (even if empty)
            nextMonthKey = currentMonthKey;
        } else {
            nextMonthKey = idx > 0 ? activeMonths[idx - 1] : null;
        }
    } else if (monthKey === currentMonthKey) {
        // Viewing current month which is not active (no data)
        prevMonthKey = activeMonths[0] ?? null; // latest active month (DESC list)
        nextMonthKey = null;
    } else {
        // Shouldn’t happen, but keep sane fallbacks
        monthKey = defaultMonthKey;
        const i2 = activeMonths.indexOf(monthKey);
        prevMonthKey = i2 !== -1 && i2 + 1 < activeMonths.length ? activeMonths[i2 + 1] : null;
        nextMonthKey = i2 > 0 ? activeMonths[i2 - 1] : null;
    }

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
    const monthKeysForDropdown = Array.from(new Set([...activeMonths, currentMonthKey]))
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a)); // DESC

    const months = monthKeysForDropdown.map((k) => ({ key: k, label: monthKeyToLabel(k) }));

    return new Response(
        JSON.stringify({
            ok: true,

            // keep your current field names so events.astro JS keeps working
            monthKey,
            monthLabel: monthKeyToLabel(monthKey),
            prevMonthKey,
            nextMonthKey,
            monthEvents,

            // add dropdown data for the next step (won’t break existing code)
            months,
            currentMonthKey,
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } }
    );
};
