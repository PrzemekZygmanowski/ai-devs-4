import type OpenAI from "openai";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../../config/env.js";
import { PeopleTaskError } from "../errors.js";
import { jobTaggingStructuredOutputSchema } from "../schemas/job-tagging.schema.js";
import { PEOPLE_TAGS, type PeopleTag, type TaggedJobInput, type TaggedJobResult } from "../types.js";
import { chunkArray } from "../utils/people.utils.js";

const BATCH_SIZE = 25;

const TAG_DESCRIPTIONS: Record<PeopleTag, string> = {
  IT: "praca związana z oprogramowaniem, sieciami, danymi, sprzętem lub wsparciem technicznym",
  transport: "organizowanie, realizacja lub koordynacja przewozu osób albo towarów",
  edukacja: "nauczanie, szkolenia, opieka dydaktyczna, przygotowywanie materiałów edukacyjnych",
  medycyna: "diagnoza, leczenie, opieka zdrowotna, rehabilitacja lub wsparcie medyczne",
  "praca z ludźmi": "bezpośrednia obsługa, doradztwo, opieka, sprzedaż lub koordynacja pracy ludzi",
  "praca z pojazdami": "prowadzenie, serwisowanie, obsługa lub nadzór nad pojazdami i maszynami mobilnymi",
  "praca fizyczna": "prace manualne, terenowe, magazynowe, produkcyjne lub wymagające wysiłku fizycznego",
};

interface StructuredTaggingResponse {
  results: TaggedJobResult[];
}

const isPeopleTag = (value: unknown): value is PeopleTag =>
  typeof value === "string" && PEOPLE_TAGS.includes(value as PeopleTag);

const buildPrompt = (jobs: TaggedJobInput[]): string => {
  const tagDescriptions = PEOPLE_TAGS.map(
    (tag) => `- ${tag}: ${TAG_DESCRIPTIONS[tag]}`,
  ).join("\n");

  const jobsList = jobs
    .map((job) => `- ${job.jobId}: ${job.job}`)
    .join("\n");

  return [
    "Przypisz tagi do opisów stanowisk pracy.",
    "Mozesz uzyc tylko tagow z ponizszej listy.",
    "Jedno stanowisko moze dostac wiele tagow.",
    "Jesli opis dotyczy logistyki, przewozu, kierowania transportem lub organizacji przewozow, koniecznie uwzglednij tag transport.",
    "",
    "Dostepne tagi:",
    tagDescriptions,
    "",
    "Stanowiska do sklasyfikowania:",
    jobsList,
  ].join("\n");
};

const parseStructuredResponse = (content: string): StructuredTaggingResponse => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new PeopleTaskError("OpenAI returned invalid JSON content.", 502, error);
  }

  if (!parsed || typeof parsed !== "object" || !("results" in parsed)) {
    throw new PeopleTaskError("OpenAI response does not contain results.", 502, parsed);
  }

  const results = (parsed as { results: unknown }).results;

  if (!Array.isArray(results)) {
    throw new PeopleTaskError("OpenAI results payload must be an array.", 502, parsed);
  }

  const normalizedResults = results.map((item) => {
    if (!item || typeof item !== "object") {
      throw new PeopleTaskError("OpenAI returned an invalid result item.", 502, item);
    }

    const { jobId, tags } = item as { jobId?: unknown; tags?: unknown };

    if (typeof jobId !== "string") {
      throw new PeopleTaskError("OpenAI returned a result without a valid jobId.", 502, item);
    }

    if (!Array.isArray(tags) || tags.some((tag) => !isPeopleTag(tag))) {
      throw new PeopleTaskError("OpenAI returned invalid tags.", 502, item);
    }

    return {
      jobId,
      tags: [...new Set(tags)],
    };
  });

  return { results: normalizedResults };
};

const ensureCompleteBatch = (jobs: TaggedJobInput[], results: TaggedJobResult[]): void => {
  const expectedIds = new Set(jobs.map((job) => job.jobId));
  const receivedIds = new Set(results.map((result) => result.jobId));

  if (expectedIds.size !== receivedIds.size) {
    throw new PeopleTaskError("OpenAI returned an incomplete tagging batch.", 502, {
      expected: [...expectedIds],
      received: [...receivedIds],
    });
  }

  for (const jobId of expectedIds) {
    if (!receivedIds.has(jobId)) {
      throw new PeopleTaskError("OpenAI response is missing job tags.", 502, {
        missingJobId: jobId,
      });
    }
  }
};

/**
 * Tags unique job descriptions with a Structured Output batch request.
 */
export const tagJobs = async (
  openai: OpenAI,
  logger: FastifyBaseLogger,
  jobs: TaggedJobInput[],
): Promise<Map<string, PeopleTag[]>> => {
  const jobTags = new Map<string, PeopleTag[]>();

  if (jobs.length === 0) {
    return jobTags;
  }

  const batches = chunkArray(jobs, BATCH_SIZE);

  for (const [index, batch] of batches.entries()) {
    logger.info(
      { batch: index + 1, batchSize: batch.length, totalBatches: batches.length },
      "Classifying people task job batch.",
    );

    const completion = await openai.chat.completions.create({
      model: env.openAiModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You classify job descriptions into a fixed set of Polish tags. Respond only with the structured output.",
        },
        {
          role: "user",
          content: buildPrompt(batch),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "people_job_tags",
          strict: true,
          schema: jobTaggingStructuredOutputSchema,
        },
      },
    });

    const message = completion.choices[0]?.message;

    if (!message || message.refusal) {
      throw new PeopleTaskError("OpenAI refused to classify job descriptions.", 502, message);
    }

    if (!message.content) {
      throw new PeopleTaskError("OpenAI returned an empty classification response.", 502);
    }

    const parsed = parseStructuredResponse(message.content);
    ensureCompleteBatch(batch, parsed.results);

    const batchJobMap = new Map(batch.map((job) => [job.jobId, job.jobKey]));

    for (const result of parsed.results) {
      const jobKey = batchJobMap.get(result.jobId);

      if (!jobKey) {
        throw new PeopleTaskError("OpenAI returned an unknown job identifier.", 502, result);
      }

      jobTags.set(jobKey, result.tags);
    }
  }

  return jobTags;
};
