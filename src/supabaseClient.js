import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "in a .env file (local dev) or in your Vercel project settings (production)."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

// A second client that does NOT persist or share a session with the main one.
// Used only when an admin registers a brand-new login for someone else, so
// that action never overwrites or logs out the admin's own active session
// (Supabase's signUp() call otherwise also signs in as the new account).
export const supabaseNoSession = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
