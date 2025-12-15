type TurnstileVerify = {
    success: boolean;
    "error-codes"?: string[];
    challenge_ts?: string;
    hostname?: string;
    action?: string;
    cdata?: string;
};

export interface Env {
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    TO_EMAIL: string;
    TURNSTILE_SECRET: string;
}

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
};

function redirectBack(request: Request, suffix = "") {
    const url = new URL(request.url);
    const location = `${url.origin}/contact${suffix || "?sent=1"}`;

    return new Response(null, {
        status: 303,
        headers: {
            location,
            "cache-control": "no-store",
            ...SECURITY_HEADERS,
        },
    });
}

function esc(s: string) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const ct = request.headers.get("content-type") || "";
        if (
            !ct.includes("application/x-www-form-urlencoded") &&
            !ct.includes("multipart/form-data")
        ) {
            return redirectBack(request, "?err=input");
        }

        const form = await request.formData();

        const name = (form.get("name") || "").toString().trim();
        const email = (form.get("email") || "").toString().trim();
        const message = (form.get("message") || "").toString().trim();

        // Honeypot
        const company = (form.get("company") || "").toString().trim();
        if (company) return redirectBack(request);

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (name.length < 2 || !emailOk || message.length < 10) {
            return redirectBack(request, "?err=input");
        }

        // ---- Turnstile verification ----
        const token = (form.get("cf-turnstile-response") || "").toString();
        if (!token) return redirectBack(request, "?err=captcha");

        const verifyResp = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    secret: env.TURNSTILE_SECRET,
                    response: token,
                    remoteip: request.headers.get("CF-Connecting-IP") || undefined,
                }),
            }
        );

        if (!verifyResp.ok) {
            return redirectBack(request, "?err=captcha");
        }

        let verify: TurnstileVerify;
        try {
            verify = (await verifyResp.json()) as TurnstileVerify;
        } catch {
            return redirectBack(request, "?err=captcha");
        }

        if (!verify.success) {
            return redirectBack(request, "?err=captcha");
        }

        if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
            return redirectBack(request, "?err=server");
        }

        const html = `
      <h2>New Friends of Lake Henry Message</h2>
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
                subject: `New inquiry from ${name}`,
                html,
                reply_to: email,
            }),
        });

        if (!r.ok) return redirectBack(request, "?err=server");

        return redirectBack(request);
    } catch {
        return redirectBack(request, "?err=server");
    }
};

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type",
            "cache-control": "no-store",
            ...SECURITY_HEADERS,
        },
    });
};
