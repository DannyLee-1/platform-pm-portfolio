import { supabase } from "./client";

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email: string, redirectTo: string) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.auth.signUp({
    email,
    password,
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
}

export async function signOut() {
  if (!supabase) return { error: null };
  return supabase.auth.signOut();
}
