import type { FastifyPluginAsync } from "fastify";
import { FindhimTaskError } from "../errors.js";
import { findhimRunRouteSchema } from "../schemas/findhim.route.schema.js";
import { runFindhimTask } from "../services/findhim.service.js";

interface FindhimRouteBody {
  dryRun?: boolean;
}

const findhimRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{ Body: FindhimRouteBody }>(
    "/run",
    { schema: findhimRunRouteSchema },
    async (request, reply) => {
      try {
        const result = await runFindhimTask({
          openai: fastify.openai,
          logger: fastify.log,
          dryRun: request.body?.dryRun ?? false,
        });

        reply.send(result);
      } catch (error) {
        if (error instanceof FindhimTaskError) {
          reply.code(error.statusCode).send({
            ok: false,
            message: error.message,
            details: error.details,
          });
          return;
        }

        fastify.log.error(error, "Unexpected findhim task failure.");
        reply.code(500).send({
          ok: false,
          message: "Unexpected findhim task failure.",
        });
      }
    },
  );
};

export default findhimRoute;
