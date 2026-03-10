export const PEOPLE_TAGS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna",
] as const;

export type PeopleTag = (typeof PEOPLE_TAGS)[number];

export interface PeopleCsvRow {
  name: string;
  surname: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  job: string;
}

export interface NormalizedPerson {
  name: string;
  surname: string;
  gender: string;
  born: number;
  birthPlace: string;
  job: string;
  personKey: string;
  birthPlaceComparisonKey: string;
  jobComparisonKey: string;
}

export interface PeopleAnswer {
  name: string;
  surname: string;
  gender: string;
  born: number;
  city: string;
  tags: PeopleTag[];
}

export interface TaggedJobInput {
  jobId: string;
  jobKey: string;
  job: string;
}

export interface TaggedJobResult {
  jobId: string;
  tags: PeopleTag[];
}

export interface VerifyPeoplePayload {
  apikey: string;
  task: "people";
  answer: PeopleAnswer[];
}

export interface PeopleRunResult {
  ok: boolean;
  dryRun: boolean;
  sourceCount: number;
  eligibleCount: number;
  transportCount: number;
  answer: PeopleAnswer[];
  verifyResponse?: unknown;
}
