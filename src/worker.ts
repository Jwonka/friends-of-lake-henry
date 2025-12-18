import base from "@astrojs/cloudflare/entrypoints/server.js";

export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        const out = await base.fetch(request, env, ctx);

        // Log what Astro returned
        console.log("SSR fetch returned:", {
            type: typeof out,
            ctor: (out as any)?.constructor?.name,
            isResponse: out instanceof Response,
            keys: typeof out === "object" && out ? Object.keys(out as any).slice(0, 20) : null,
        });

        // Hard-enforce Response so Cloudflare can't stringify objects into `[object Object]`
        if (out instanceof Response) return out;

        return new Response(
            `SSR returned non-Response: ${typeof out} ${(out as any)?.constructor?.name ?? ""}`,
            { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
        );
    },
};
