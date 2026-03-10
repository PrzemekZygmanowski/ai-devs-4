import type { FastifyPluginAsync } from "fastify";
import findhimRoute from "./routes/findhim.route.js";

const findhimTaskPlugin: FastifyPluginAsync = async fastify => {
  fastify.register(findhimRoute);
};

export default findhimTaskPlugin;
