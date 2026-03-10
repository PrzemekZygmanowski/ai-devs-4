const findhimAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "surname", "accessLevel", "powerPlant"],
  properties: {
    name: { type: "string" },
    surname: { type: "string" },
    accessLevel: { type: "integer" },
    powerPlant: { type: "string" },
  },
} as const;

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "message"],
  properties: {
    ok: { type: "boolean", const: false },
    message: { type: "string" },
    details: {},
  },
} as const;

export const findhimRunRouteSchema = {
  tags: ["tasks"],
  summary:
    "Run the findhim task — identify a suspect near a nuclear power plant",
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      dryRun: { type: "boolean" },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "dryRun", "agentSteps"],
      properties: {
        ok: { type: "boolean" },
        dryRun: { type: "boolean" },
        agentSteps: { type: "integer" },
        answer: { ...findhimAnswerSchema, nullable: true },
        verifyResponse: {},
      },
    },
    500: errorResponseSchema,
    502: errorResponseSchema,
  },
} as const;
