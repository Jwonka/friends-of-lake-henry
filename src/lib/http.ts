export const SECURITY_HEADERS_BASE: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
};

export const SECURITY_HEADERS_NOSTORE: Record<string, string> = {
    ...SECURITY_HEADERS_BASE,
    "cache-control": "no-store",
};

// For file responses: NO cache-control here on purpose.
export const SECURITY_HEADERS_FILE: Record<string, string> = {
    ...SECURITY_HEADERS_BASE,
};

export function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...SECURITY_HEADERS_NOSTORE,
        },
    });
}

export function redirect(location: string, status = 303) {
    return new Response(null, {
        status,
        headers: {
            location,
            ...SECURITY_HEADERS_NOSTORE,
        },
    });
}

export function options(allowMethods = "POST,OPTIONS"): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "access-control-allow-methods": allowMethods,
            "access-control-allow-headers": "content-type",
            ...SECURITY_HEADERS_NOSTORE,
        },
    });
}

export function fileResponse(body: BodyInit | null, headers: HeadersInit, status = 200) {
    return new Response(body, {
        status,
        headers: {
            ...SECURITY_HEADERS_FILE,
            ...headers,
        },
    });
}