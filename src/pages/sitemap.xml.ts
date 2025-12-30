import type { APIRoute } from "astro";

function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const GET: APIRoute = async ({ site }) => {
    if (!site) return new Response("Missing site", { status: 500 });

    // canonical public routes here
    const paths = [
        "/",
        "/donate",
        "/donors",
        "/events",
        "/raffle",
        "/contact",
        "/photos",
        "/privacy",
        "/terms",
    ];

    const urls = paths.map((p) => new URL(p, site).toString());

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        urls
            .map((loc) => `<url><loc>${esc(loc)}</loc></url>`)
            .join("") +
        `</urlset>`;

    return new Response(body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
};
