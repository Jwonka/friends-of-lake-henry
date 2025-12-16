/// <reference types="astro/client" />
import type { D1Database } from "@cloudflare/workers-types";

declare global {
    namespace App {
        interface Locals {
            DB: D1Database;
        }
    }
}

export {};