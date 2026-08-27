import type { CookieOptions } from "@supabase/ssr";

export function asSessionCookie(options: CookieOptions): CookieOptions {
  if (options.maxAge === 0) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}
