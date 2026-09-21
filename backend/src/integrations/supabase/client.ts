import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

/**
 * Backend Supabase client initialized with the Service Role key or Anon key.
 * Used for Supabase Storage (private signed URLs, uploads, deletions).
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
