import { PEOPLE_TAGS } from "../types.js";

const peopleAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "surname", "gender", "born", "city", "tags"],
  properties: {
    name: { type: "string" },
    surname: { type: "string" },
    gender: { type: "string" },
    born: { type: "integer" },
    city: { type: "string" },
    tags: {
      type: "array",
      items: {
        type: "string",
        enum: [...PEOPLE_TAGS],
      },
    },
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

export const peopleRunRouteSchema = {
  tags: ["tasks"],
  summary: "Run the people task pipeline",
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
      required: ["ok", "dryRun", "sourceCount", "eligibleCount", "transportCount", "answer"],
      properties: {
        ok: { type: "boolean", const: true },
        dryRun: { type: "boolean" },
        sourceCount: { type: "integer" },
        eligibleCount: { type: "integer" },
        transportCount: { type: "integer" },
        answer: {
          type: "array",
          items: peopleAnswerSchema,
        },
        verifyResponse: {},
      },
    },
    500: errorResponseSchema,
    502: errorResponseSchema,
  },
} as const;
