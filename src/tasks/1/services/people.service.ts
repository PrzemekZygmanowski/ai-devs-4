import type OpenAI from "openai";
import { parse } from "csv-parse/sync";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../../config/env.js";
import { PeopleTaskError } from "../errors.js";
import {
  type PeopleAnswer,
  type PeopleCsvRow,
  type PeopleRunResult,
  type TaggedJobInput,
  type VerifyPeoplePayload,
} from "../types.js";
import {
  isEligibleBaseCandidate,
  normalizePersonRow,
  toPeopleAnswer,
} from "../utils/people.utils.js";
import { tagJobs } from "./job-tagging.service.js";
import { verifyPeopleAnswer } from "./verify.service.js";

interface RunPeopleTaskOptions {
  openai: OpenAI;
  logger: FastifyBaseLogger;
  dryRun: boolean;
}

const downloadPeopleCsv = async (): Promise<string> => {
  const response = await fetch(env.peopleCsvUrl);

  if (!response.ok) {
    throw new PeopleTaskError("Failed to download people.csv.", 502, {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.text();
};

const parsePeopleCsv = (csvText: string): PeopleCsvRow[] => {
  try {
    return parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as PeopleCsvRow[];
  } catch (error) {
    throw new PeopleTaskError("Failed to parse people.csv.", 502, error);
  }
};

const dedupePeople = <T extends { personKey: string }>(people: T[]): T[] => {
  const uniquePeople = new Map<string, T>();

  for (const person of people) {
    if (!uniquePeople.has(person.personKey)) {
      uniquePeople.set(person.personKey, person);
    }
  }

  return [...uniquePeople.values()];
};

const buildUniqueJobs = (
  people: Array<{ job: string; jobComparisonKey: string }>,
): TaggedJobInput[] => {
  const uniqueJobs = new Map<string, TaggedJobInput>();

  for (const person of people) {
    if (!uniqueJobs.has(person.jobComparisonKey)) {
      uniqueJobs.set(person.jobComparisonKey, {
        jobId: `job_${uniqueJobs.size + 1}`,
        jobKey: person.jobComparisonKey,
        job: person.job,
      });
    }
  }

  return [...uniqueJobs.values()];
};

const buildVerifyPayload = (answer: PeopleAnswer[]): VerifyPeoplePayload => ({
  apikey: env.ag3ntsApiKey,
  task: "people",
  answer,
});

/**
 * Orchestrates the full people task pipeline from CSV download to verification.
 */
export const runPeopleTask = async ({
  openai,
  logger,
  dryRun,
}: RunPeopleTaskOptions): Promise<PeopleRunResult> => {
  const csvText = await downloadPeopleCsv();
  const sourceRows = parsePeopleCsv(csvText);
  const normalizedPeople = sourceRows
    .map(normalizePersonRow)
    .filter((person): person is NonNullable<typeof person> => person !== null);

  const eligiblePeople = dedupePeople(
    normalizedPeople.filter(isEligibleBaseCandidate),
  );
  const uniqueJobs = buildUniqueJobs(eligiblePeople);

  logger.info(
    {
      sourceCount: sourceRows.length,
      normalizedCount: normalizedPeople.length,
      eligibleCount: eligiblePeople.length,
      uniqueJobs: uniqueJobs.length,
    },
    "Prepared people task candidate set.",
  );

  const jobTags = await tagJobs(openai, logger, uniqueJobs);
  const answer = eligiblePeople.reduce<PeopleAnswer[]>((items, person) => {
    const tags = jobTags.get(person.jobComparisonKey);

    if (!tags || !tags.includes("transport")) {
      return items;
    }

    items.push(toPeopleAnswer(person, tags));
    return items;
  }, []);

  const result: PeopleRunResult = {
    ok: true,
    dryRun,
    sourceCount: sourceRows.length,
    eligibleCount: eligiblePeople.length,
    transportCount: answer.length,
    answer,
  };

  if (dryRun) {
    return result;
  }

  const verifyResponse = await verifyPeopleAnswer(buildVerifyPayload(answer));

  return {
    ...result,
    verifyResponse,
  };
};
