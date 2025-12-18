import * as entry from "@astrojs/cloudflare/entrypoints/server.js";

// Avoid needing Cloudflare's ExecutionContext type just to compile.
type Ctx = { waitUntil(promise: Promise<any>): void; passThroughOnException?: () => void };

function pickHandler(mod: any) {
    // Try common shapes without assuming types.
    if (typeof mod?.default?.fetch === "function") return mod.default.fetch.bind(mod.default);
    if (typeof mod?.default === "function") return mod.default;
    if (typeof mod?.fetch === "function") return mod.fetch;
    if (typeof mod?.handler === "function") return mod.handler;
    if (typeof mod?.onRequest === "function") return mod.onRequest;
    return null;
}

const handler = pickHandler(entry as any);

export default {
    async fetch(request: Request, env: any, ctx: Ctx): Promise<Response> {
        if (!handler) {
            return new Response(
                `Could not find handler export in @astrojs/cloudflare/entrypoints/server.js. Exports: ${Object.keys(entry as any).join(", ")}`,
                { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
            );
        }

        const result = await handler(request, env, ctx);

        console.log("SSR handler result:", {
            isResponse: result instanceof Response,
            type: typeof result,
            ctor: (result as any)?.constructor?.name,
            keys: typeof result === "object" && result ? Object.keys(result).slice(0, 20) : null,
        });

        return result instanceof Response
            ? result
            : new Response(`SSR returned non-Response: ${String(result)}`, {
                status: 500,
                headers: { "content-type": "text/plain; charset=utf-8" },
            });
    },
};
