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
    const env = locals.runtime.env as any;
    const DB = env.DB as D1Database | undefined;
    if (!DB) { return json({ ok: false, error: "DB binding missing" }, 500); }

    const url = new URL(request.url);
    const monthParam = (url.searchParams.get("month") ?? "").trim();

    // Current month (America/Chicago)
    const now = new Date();
    const currentMonth = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
    }).format(now).slice(0, 7);

    // Build months list (DESC) and include current month even if empty
    const metaMonthsRes = await DB.prepare(
        `SELECT month_key as monthKey FROM raffle_months ORDER BY month_key DESC`
    ).all();
    const metaMonths = (metaMonthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey);

    const winnerMonthsRes = await DB.prepare(
        `SELECT DISTINCT raffle_key as monthKey FROM raffle_winners ORDER BY raffle_key DESC`
    ).all();
    const winnerMonths = (winnerMonthsRes.results ?? [])
        .map((r: any) => String(r.monthKey ?? "").trim())
        .filter(isMonthKey);

    const months = Array.from(new Set([currentMonth, ...metaMonths, ...winnerMonths]))
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a)); // DESC

    const activeMonths = Array.from(new Set([...metaMonths, ...winnerMonths]))
        .filter(isMonthKey)
        .sort((a, b) => b.localeCompare(a));

    const defaultMonth = activeMonths[0] ?? currentMonth;

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
    });
};
