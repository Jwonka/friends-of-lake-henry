export const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "cache-control": "no-store",
};

export function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...SECURITY_HEADERS,
        },
    });
}

export function redirect(location: string, status = 303) {
    return new Response(null, {
        status,
        headers: {
            location,
            ...SECURITY_HEADERS,
        },
    });
}

export function options(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type",
            ...SECURITY_HEADERS,
        },
    });
}
