import { PEOPLE_TAGS } from "../types.js";

export const jobTaggingStructuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["jobId", "tags"],
        properties: {
          jobId: {
            type: "string",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
              enum: [...PEOPLE_TAGS],
            },
            uniqueItems: true,
          },
        },
      },
    },
  },
} as const;
