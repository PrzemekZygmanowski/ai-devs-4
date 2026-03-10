import type { FastifyPluginAsync } from "fastify";
import peopleRoute from "./routes/people.route.js";

const peopleTaskPlugin: FastifyPluginAsync = async fastify => {
  fastify.register(peopleRoute);
};

export default peopleTaskPlugin;
