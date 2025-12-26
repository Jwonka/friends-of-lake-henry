import type { APIRoute } from "astro";
import { redirect } from "../../../lib/http";

const SESSION_COOKIE = "admin_session";
const SESSION_PREFIX = "admin_sess:";

function getCookieValue(cookieHeader: string, name: string): string | null {
    const parts = cookieHeader.split(";");
    for (const part of parts) {
        const [k, ...rest] = part.trim().split("=");
        if (k === name) return rest.join("=") || "";
    }
    return null;
}

export const POST: APIRoute = async (context) => {
    const env = (context.locals as any).runtime?.env as any;

    // Best-effort: delete KV session if we can
    try {
        const cookieHeader = context.request.headers.get("cookie") ?? "";
        const sessionId = getCookieValue(cookieHeader, SESSION_COOKIE);
        if (sessionId && env.SESSION) {
            await env.SESSION.delete(`${SESSION_PREFIX}${sessionId}`);
        }
    } catch {
        // ignore: logout should still clear cookie client-side
    }

    const res = redirect(`${context.url.origin}/admin/login`);

    // Clear new session cookie (Path must match how it was set: Path=/)
    res.headers.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );

    // Clear legacy cookie (cleanup)
    res.headers.append(
        "Set-Cookie",
        `admin_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );

    return res;
};
