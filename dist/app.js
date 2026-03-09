import Fastify from "fastify";
import supabasePlugin from "./plugins/supabase.js";
const app = Fastify();
// Register Supabase plugin
app.register(supabasePlugin);
export default app;
//# sourceMappingURL=app.js.map