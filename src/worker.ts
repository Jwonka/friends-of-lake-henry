// This file is used as the Cloudflare worker entrypoint via adapter.workerEntryPoint.
// It imports the built SSR entry (virtual) that Astro generates at build time.
import type { SSRManifest } from "astro";

export default {
    async fetch(request: Request, env: any, ctx: any): Promise<Response> {
        // The adapter injects the real handler; we just verify Response-ness at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = (globalThis as any).__ASTRO_FETCH;

        if (typeof handler !== "function") {
            return new Response(
                "Worker wrapper: __ASTRO_FETCH not found. Entry wiring is incorrect.",
                { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
            );
        }

        const result = await handler(request, env, ctx);

        console.log("SSR handler result:", {
            isResponse: result instanceof Response,
            type: typeof result,
            ctor: (result as any)?.constructor?.name,
        });

        return result instanceof Response
            ? result
            : new Response(`SSR returned non-Response: ${String(result)}`, {
                status: 500,
                headers: { "content-type": "text/plain; charset=utf-8" },
            });
    },
};

