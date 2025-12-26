import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { json } from "../../../lib/http";

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

export const GET: APIRoute = async ({ request, locals }) => {
    const env = (locals as any).runtime?.env as { DB?: D1Database } | undefined;
    const DB = env?.DB;
    if (!DB) { return json({ ok: false, error: "DB binding missing" }, 500); }

    const url = new URL(request.url);
    const monthParam = (url.searchParams.get("month") ?? "").trim();

    // Current month (America/Chicago)
    const now = new Date();

    // Current month (America/Chicago)
    const currentMonth = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
    }).format(new Date()).slice(0, 7);

    // Active months = months with winners (data)
    const winnerMonthsRes = await DB.prepare(
        `SELECT DISTINCT raffle_key as monthKey
   FROM raffle_winners
   ORDER BY raffle_key DESC`
    ).all();

    const activeMonths = (winnerMonthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a)); // DESC

    // Dropdown months = active months + current month (even if empty)
    const months = Array.from(new Set([currentMonth, ...activeMonths]))
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a)); // DESC

    // Default landing month
    const defaultMonth =
        activeMonths.includes(currentMonth) ? currentMonth : (activeMonths[0] ?? currentMonth);
    let raffleKey: string;
    if (isMonthKey(monthParam) && months.includes(monthParam)) {
        raffleKey = monthParam;
    } else {
        raffleKey = defaultMonth;
    }
    if (!months.includes(raffleKey)) raffleKey = months[0] ?? currentMonth;
    const idx = months.indexOf(raffleKey);
    const prevMonthKey = idx >= 0 && idx + 1 < months.length ? months[idx + 1] : null; // DESC
    const nextMonthKey = idx > 0 ? months[idx - 1] : null;
    const monthOptions = months.map((k) => ({ key: k, label: monthKeyToLabel(k) }));

    const winnersRes = await DB.prepare(
        `SELECT id,
            draw_date as drawDate,
            ticket_number as ticketNumber,
            winner_name as name,
            town,
            prize
     FROM raffle_winners
     WHERE raffle_key = ?
     ORDER BY draw_date DESC, created_at DESC`
    ).bind(raffleKey).all();

    const metaRes = await DB.prepare(
        `SELECT title FROM raffle_months WHERE month_key = ?`
    ).bind(raffleKey).first();

    const titleRaw = metaRes ? String((metaRes as any).title ?? "").trim() : "";
    const raffleTitle = titleRaw ? titleRaw : null;

    return json({
        ok: true,
        monthKey: raffleKey,
        monthLabel: monthKeyToLabel(raffleKey),
        prevMonthKey,
        nextMonthKey,
        raffleTitle,
        winners: winnersRes.results ?? [],
        months: monthOptions,
    });
};
