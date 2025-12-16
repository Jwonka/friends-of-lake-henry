import type { Runtime } from "@astrojs/cloudflare/runtime";
import type { D1Database } from "@cloudflare/workers-types";

declare global {
    namespace App {
        interface Locals {
            runtime: Runtime;
        }

        interface Env {
            DB: D1Database;

            ADMIN_USERNAME: string;
            ADMIN_PASSWORD: string;
            ADMIN_COOKIE_SECRET: string;

            // Contact page vars (if you're using them)
            RESEND_API_KEY: string;
            FROM_EMAIL: string;
            TO_EMAIL: string;
            TURNSTILE_SECRET: string;
        }
    }
}

export {};