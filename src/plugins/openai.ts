import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import OpenAI from "openai";
import { env } from "../config/env.js";

const openai = new OpenAI({
  apiKey: env.openAiApiKey,
});

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate("openai", openai);
});
