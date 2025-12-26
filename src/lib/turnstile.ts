export type TurnstileVerifyResponse = {
    success: boolean;
    "error-codes"?: string[];
};

export async function verifyTurnstile(args: {
    request: Request;
    secret: string;
    token: string;
}): Promise<boolean> {
    const { request, secret, token } = args;

    if (!secret || !token) return false;

    const ip =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "";

    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);

    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!resp.ok) return false;

    const data = (await resp.json().catch(() => null)) as TurnstileVerifyResponse | null;
    return !!data?.success;
}