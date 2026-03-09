import { SupabaseClient } from "@supabase/supabase-js";
import "fastify";
import type OpenAI from "openai";

declare module "fastify" {
  interface FastifyInstance {
    openai: OpenAI;
    supabase: SupabaseClient;
  }
}
