import Fastify from "fastify";
import { env } from "./config/env.js";
import openAiPlugin from "./plugins/openai.js";
import supabasePlugin from "./plugins/supabase.js";
import peopleTaskPlugin from "./tasks/1/index.js";

const app = Fastify();

// Register infrastructure plugins
app.register(openAiPlugin);

if (env.hasSupabaseConfig) {
  // Register Supabase plugin only when credentials are available.
  app.register(supabasePlugin);
} else {
  app.log.warn(
    "Supabase plugin not registered because configuration is missing.",
  );
}

// Register task routes
app.register(peopleTaskPlugin, { prefix: "/tasks/people" });

export default app;
