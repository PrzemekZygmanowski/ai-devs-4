import Fastify from "fastify";
import openAiPlugin from "./plugins/openai.js";
import supabasePlugin from "./plugins/supabase.js";
import peopleTaskPlugin from "./tasks/1/index.js";

const app = Fastify();

// Register infrastructure plugins
app.register(openAiPlugin);

// Register Supabase plugin
app.register(supabasePlugin);

// Register task routes
app.register(peopleTaskPlugin, { prefix: "/tasks/people" });

export default app;
