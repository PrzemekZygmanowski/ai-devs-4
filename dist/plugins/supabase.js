import fp from "fastify-plugin";
import { supabase } from "../db/supabase.client.js";
export default fp(async (fastify) => {
    fastify.decorate("supabase", supabase);
});
//# sourceMappingURL=supabase.js.map