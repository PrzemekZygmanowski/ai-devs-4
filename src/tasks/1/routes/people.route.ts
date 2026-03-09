import type { FastifyPluginAsync } from "fastify";
import { PeopleTaskError } from "../errors.js";
import { peopleRunRouteSchema } from "../schemas/people.route.schema.js";
import { runPeopleTask } from "../services/people.service.js";

interface PeopleRouteBody {
  dryRun?: boolean;
}

const peopleRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: PeopleRouteBody }>(
    "/run",
    {
      schema: peopleRunRouteSchema,
    },
    async (request, reply) => {
      try {
        const result = await runPeopleTask({
          openai: fastify.openai,
          logger: fastify.log,
          dryRun: request.body?.dryRun ?? false,
        });

        reply.send(result);
      } catch (error) {
        if (error instanceof PeopleTaskError) {
          reply.code(error.statusCode).send({
            ok: false,
            message: error.message,
            details: error.details,
          });
          return;
        }

        fastify.log.error(error, "Unexpected people task failure.");
        reply.code(500).send({
          ok: false,
          message: "Unexpected people task failure.",
        });
      }
    },
  );
};

export default peopleRoute;
