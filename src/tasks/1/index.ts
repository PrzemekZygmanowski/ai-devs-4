import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import peopleRoute from "./routes/people.route.js";

const peopleTaskPlugin: FastifyPluginAsync = async fastify => {
  fastify.register(peopleRoute);
};

export default fp(peopleTaskPlugin);
