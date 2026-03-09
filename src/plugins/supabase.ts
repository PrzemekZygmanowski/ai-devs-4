import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { supabase } from "../db/supabase.client.js";

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate("supabase", supabase);
});
