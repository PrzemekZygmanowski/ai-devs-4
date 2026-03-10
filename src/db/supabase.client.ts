import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const createSupabaseClient = () => {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error("Supabase configuration is incomplete.");
  }

  return createClient(env.supabaseUrl, env.supabaseKey);
};
