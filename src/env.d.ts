/// <reference types="astro/client" />
import type { Runtime } from "@astrojs/cloudflare/runtime";
import type { D1Database } from "@cloudflare/workers-types";

declare namespace App {
    interface Locals {
        runtime: Runtime;
    }
    interface Env {
        DB: D1Database;
    }
}