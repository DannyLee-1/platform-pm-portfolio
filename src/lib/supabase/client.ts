import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parse, serialize } from "cookie";

import type { Database } from "./database.types";
import { asSessionCookie } from "./session-cookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

function createSessionCookieStore(supabaseUrl: string) {
  if (typeof document === "undefined") return undefined;

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  const currentCookies = parse(document.cookie);

  Object.entries(currentCookies).forEach(([name, value]) => {
    if (value === undefined || (name !== authCookieName && !name.startsWith(`${authCookieName}.`))) return;
    document.cookie = serialize(name, value, {
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    });
  });

  return {
    getAll() {
      return Object.entries(parse(document.cookie)).flatMap(([name, value]) => value === undefined ? [] : [{ name, value }]);
    },
    setAll(cookiesToSet: { name: string; value: string; options: Parameters<typeof serialize>[2] }[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        document.cookie = serialize(name, value, asSessionCookie(options ?? {}));
      });
    },
  };
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createBrowserClient<Database>(url!, anonKey!, {
      cookies: createSessionCookieStore(url!),
    })
  : null;
