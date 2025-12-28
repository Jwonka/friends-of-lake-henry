import type { APIRoute } from "astro";
import { json, redirect, options } from "../../lib/http";
import { verifyTurnstile } from "../../lib/turnstile";
import { hitThrottle } from "../../lib/throttle";
import type { KVNamespace } from "@cloudflare/workers-types";

type Env = {
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    TO_EMAIL: string;
    TURNSTILE_SECRET: string;
    SESSION?: KVNamespace;
};

function isSameOrigin(request: Request, siteOrigin: string) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    if (origin) return origin === siteOrigin;

    if (referer) return referer.startsWith(`${siteOrigin}/`);

    // For public endpoints, fail OPEN (don’t break older clients),
    // but still rely on Turnstile + rate limiting.
    return true;
}


function redirectBack(requestUrl: string, suffix = ""): Response {
    const url = new URL(requestUrl);
    return redirect(`${url.origin}/contact${suffix || "?sent=1"}`);
}

function wantsJson(request: Request) {
    return (request.headers.get("accept") || "").includes("application/json");
}

function esc(s: string) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export const POST: APIRoute = async (context) => {
    const { request } = context;

    if (!isSameOrigin(request, context.url.origin)) {
        return wantsJson(request)
            ? json({ ok: false, error: "forbidden" }, 403)
            : redirectBack(request.url, "?error=1");
    }

    try {
        const env = (context.locals as any).runtime?.env as Env;

        if (!env) {
            return wantsJson(request)
                ? json({ ok: false, error: "server" }, 500)
                : redirectBack(request.url, "?err=server");
        }

        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const kv = env.SESSION;
        if (kv) {
            const t = await hitThrottle({
                kv,
                key: `throttle:contact:${ip}`,
                limit: 5,
                windowSec: 600,
            });
            if (!t.ok) {
                return wantsJson(request)
                    ? json({ ok: false, error: "rate_limited" }, 429)
                    : redirectBack(request.url, "?err=rate");
            }
        }

        const ct = request.headers.get("content-type") || "";
        if (
            !ct.includes("application/x-www-form-urlencoded") &&
            !ct.includes("multipart/form-data")
        ) {
            return wantsJson(request)
                ? json({ ok: false, error: "input" }, 400)
                : redirectBack(request.url, "?err=input");
        }

        const form = await request.formData();


        const name = String(form.get("name") ?? "").trim();
        const email = String(form.get("email") ?? "").trim();
        const message = String(form.get("message") ?? "").trim();

        // Honeypot
        const company = String(form.get("company") ?? "").trim();
        if (company) return wantsJson(request) ? json({ ok: true }, 200) : redirectBack(request.url);

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (name.length < 2 || !emailOk || message.length < 10) {
            return wantsJson(request)
                ? json({ ok: false, error: "input" }, 400)
                : redirectBack(request.url, "?err=input");
        }

        // ---- Turnstile verification ----
        const token = String(form.get("cf-turnstile-response") ?? "").trim();
        if (!token) {
            return wantsJson(request)
                ? json({ ok: false, error: "captcha" }, 400)
                : redirectBack(request.url, "?err=captcha");
        }

        if (!env.TURNSTILE_SECRET) {
            return wantsJson(request)
                ? json({ ok: false, error: "server" }, 500)
                : redirectBack(request.url, "?err=server");
        }

        const okCaptcha = await verifyTurnstile({
            request,
            secret: env.TURNSTILE_SECRET,
            token,
        });

        if (!okCaptcha) {
            return wantsJson(request)
                ? json({ ok: false, error: "captcha" }, 400)
                : redirectBack(request.url, "?err=captcha");
        }

        if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
            return wantsJson(request) ? json({ok:false,error:"server"}, 502) : redirectBack(request.url, "?err=server");
        }

        const html = `
          <h2>Friends of Lake Henry</h2>
          <p><strong>Name:</strong> ${esc(name)}</p>
          <p><strong>Email:</strong> ${esc(email)}</p>
          <p><strong>Message:</strong><br>
            ${esc(message).replace(/\n/g, "<br>")}
          </p>
          <hr>
          <p>Sent: ${new Date().toISOString()}</p>
        `;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: env.FROM_EMAIL,
                to: [env.TO_EMAIL],
                subject: `Inquiry from ${name}`,
                html,
                reply_to: email,
            }),
        });

        if (!r.ok) return wantsJson(request) ? json({ ok: false, error: "server" }, 502) : redirectBack(request.url, "?err=server");

        return wantsJson(request) ? json({ ok: true }, 200) : redirectBack(request.url);
    } catch {
        return wantsJson(request) ? json({ ok: false, error: "server" }, 500) : redirectBack(request.url, "?err=server");
    }
};

export const OPTIONS: APIRoute = async () => options();
