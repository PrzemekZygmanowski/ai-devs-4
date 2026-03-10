import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createSupabaseClient } from "../db/supabase.client.js";

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate("supabase", createSupabaseClient());
});
