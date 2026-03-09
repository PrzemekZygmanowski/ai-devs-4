import type { PeopleAnswer, PeopleCsvRow, NormalizedPerson } from "../types.js";

const TARGET_CITY = "grudziadz";
const CURRENT_YEAR = 2026;
const MIN_AGE = 20;
const MAX_AGE = 40;

/**
 * Normalizes free-form text for case-insensitive and accent-insensitive comparisons.
 */
export const normalizeComparisonText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

/**
 * Builds a deterministic key used to remove duplicated person records.
 */
export const buildPersonKey = (person: {
  name: string;
  surname: string;
  born: number;
  city: string;
  job: string;
}): string =>
  [
    normalizeComparisonText(person.name),
    normalizeComparisonText(person.surname),
    String(person.born),
    normalizeComparisonText(person.city),
    normalizeComparisonText(person.job),
  ].join("|");

/**
 * Splits a list into smaller chunks for batched LLM requests.
 */
export const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

/**
 * Converts a raw CSV record into a normalized person model.
 */
export const normalizePersonRow = (row: PeopleCsvRow): NormalizedPerson | null => {
  const name = row.name?.trim();
  const surname = row.surname?.trim();
  const gender = row.gender?.trim().toUpperCase();
  const city = row.city?.trim();
  const job = row.job?.trim();
  const born = Number.parseInt(row.born?.trim(), 10);

  if (!name || !surname || !gender || !city || !job || Number.isNaN(born)) {
    return null;
  }

  return {
    name,
    surname,
    gender,
    born,
    city,
    job,
    personKey: buildPersonKey({ name, surname, born, city, job }),
    cityComparisonKey: normalizeComparisonText(city),
    jobComparisonKey: normalizeComparisonText(job),
  };
};

/**
 * Applies the business criteria that can be evaluated without the LLM.
 */
export const isEligibleBaseCandidate = (person: NormalizedPerson): boolean => {
  if (person.gender !== "M") {
    return false;
  }

  if (person.cityComparisonKey !== TARGET_CITY) {
    return false;
  }

  const age = CURRENT_YEAR - person.born;

  return age >= MIN_AGE && age <= MAX_AGE;
};

/**
 * Produces the final answer item expected by the verification endpoint.
 */
export const toPeopleAnswer = (
  person: NormalizedPerson,
  tags: PeopleAnswer["tags"],
): PeopleAnswer => ({
  name: person.name,
  surname: person.surname,
  gender: person.gender,
  born: person.born,
  city: person.city,
  tags,
});
