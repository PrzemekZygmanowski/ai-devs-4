import type { FastifyBaseLogger } from "fastify";
import fs from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { env } from "../../../config/env.js";
import { FindhimTaskError } from "../errors.js";
import type {
  FindhimAnswer,
  FindhimRunResult,
  GeoPoint,
  PowerPlant,
  Suspect,
  VerifyFindhimPayload,
} from "../types.js";
import { findNearestPlant } from "../utils/geo.utils.js";

const PROXIMITY_THRESHOLD_KM = 25;
const MAX_AGENT_STEPS = 15;

const SYSTEM_PROMPT = `You are an investigative agent. Your task is to identify which suspect was seen closest to a nuclear power plant.

Follow this workflow precisely:
1. For each suspect in the list, call get_suspect_locations. The tool returns their locations and the nearest power plant with its distance in km.
2. After checking ALL suspects, identify the one whose nearestPlant has the smallest distanceKm.
3. Call get_access_level for that candidate, using their birthYear from the suspect list.
4. Call report_result with the complete information to submit the final answer.
5. Stop immediately after calling report_result.

Rules:
- Check every suspect — do not stop early even if isNear is true, unless you are certain the distance is very small (< 5 km).
- The suspect with the minimum distanceKm across all their locations is the correct answer, even if isNear is false.
- Do not attempt to calculate distances yourself — the tool handles all proximity checks.
- The birthYear for each suspect is provided in the initial message.`;

/** Module-level cache: power plants do not change between requests. */
let powerPlantsCache: PowerPlant[] | null = null;

const loadSuspects = (): Suspect[] => {
  const suspectsPath = path.join(
    process.cwd(),
    ".lessons/1/s01e01-answer.json",
  );
  const raw = fs.readFileSync(suspectsPath, "utf-8");
  return JSON.parse(raw) as Suspect[];
};

interface RawPlantEntry {
  code: string;
  city: string;
}

/**
 * Parses the Hub power plants response:
 * { "power_plants": { "CityName": { "code": "PWRxxxxPL", ... } } }
 */
const parseRawPowerPlants = (raw: unknown): RawPlantEntry[] => {
  const obj = raw as Record<string, unknown>;
  const plantsObj = (obj.power_plants ?? raw) as Record<
    string,
    Record<string, unknown>
  >;

  return Object.entries(plantsObj).map(([city, data]) => ({
    code: String(data.code ?? ""),
    city,
  }));
};

/**
 * Geocodes a Polish city name to lat/lon using Nominatim (OpenStreetMap).
 */
const geocodeCity = async (
  city: string,
): Promise<{ lat: number; lon: number }> => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${city}, Poland`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "pl");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "AI-Devs-Findhim-Task/1.0" },
  });

  if (!response.ok) {
    throw new FindhimTaskError(`Geocoding failed for city: ${city}.`, 502, {
      status: response.status,
    });
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
  }>;

  if (results.length === 0) {
    throw new FindhimTaskError(`No geocoding result for city: ${city}.`, 502);
  }

  const first = results[0];

  if (!first) {
    throw new FindhimTaskError(`No geocoding result for city: ${city}.`, 502);
  }

  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon) };
};

let fetchPlantsLogger: FastifyBaseLogger | null = null;

const fetchPowerPlants = async (): Promise<PowerPlant[]> => {
  if (powerPlantsCache) return powerPlantsCache;

  const response = await fetch(env.findhimLocationsUrl);

  if (!response.ok) {
    throw new FindhimTaskError("Failed to fetch power plants.", 502, {
      status: response.status,
      statusText: response.statusText,
    });
  }

  const raw = await response.json();
  fetchPlantsLogger?.info({ raw }, "Raw power plants response.");

  const rawEntries = parseRawPowerPlants(raw);

  // Geocode all plant cities in parallel
  const plants = await Promise.all(
    rawEntries.map(async ({ code, city }) => {
      const coords = await geocodeCity(city);
      fetchPlantsLogger?.info(
        { city, code, ...coords },
        "Geocoded power plant.",
      );
      return { code, ...coords };
    }),
  );

  powerPlantsCache = plants;
  fetchPlantsLogger?.info(
    { count: plants.length },
    "Power plants ready with coordinates.",
  );
  return powerPlantsCache;
};

const fetchSuspectLocations = async (
  name: string,
  surname: string,
): Promise<GeoPoint[]> => {
  const response = await fetch(`${env.hubBaseUrl}/api/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: env.ag3ntsApiKey, name, surname }),
  });

  if (!response.ok) {
    throw new FindhimTaskError(
      `Failed to fetch locations for ${name} ${surname}.`,
      502,
      { status: response.status },
    );
  }

  const data = (await response.json()) as unknown;
  fetchPlantsLogger?.info(
    { name, surname, data },
    "Raw location API response.",
  );

  const normalizePoint = (item: Record<string, unknown>): GeoPoint => ({
    lat: Number(item.lat ?? item.latitude ?? 0),
    lon: Number(item.lon ?? item.longitude ?? item.lng ?? 0),
  });

  if (Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map(normalizePoint);
  }

  const obj = data as Record<string, unknown>;
  const arr = (obj.locations ?? obj.data) as unknown[] | undefined;

  if (Array.isArray(arr)) {
    return (arr as Record<string, unknown>[]).map(normalizePoint);
  }

  fetchPlantsLogger?.warn(
    { name, surname, data },
    "Unrecognized location response shape — returning empty.",
  );
  return [];
};

const fetchAccessLevel = async (
  name: string,
  surname: string,
  birthYear: number,
): Promise<{ accessLevel: number }> => {
  const response = await fetch(`${env.hubBaseUrl}/api/accesslevel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: env.ag3ntsApiKey,
      name,
      surname,
      birthYear,
    }),
  });

  if (!response.ok) {
    throw new FindhimTaskError(
      `Failed to fetch access level for ${name} ${surname}.`,
      502,
      { status: response.status },
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const accessLevel = Number(
    data.accessLevel ?? data.level ?? data.access_level ?? 0,
  );

  return { accessLevel };
};

const submitReport = async (
  payload: VerifyFindhimPayload,
): Promise<unknown> => {
  const response = await fetch(env.verifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    parsedBody = rawBody;
  }

  if (!response.ok) {
    throw new FindhimTaskError("Verification request failed.", 502, parsedBody);
  }

  return parsedBody;
};

const buildToolSchemas = (): OpenAI.Chat.ChatCompletionTool[] => [
  {
    type: "function",
    function: {
      name: "get_suspect_locations",
      description:
        "Fetches the known locations for a suspect and checks proximity to nuclear power plants. Returns all locations and the nearest plant if within the proximity threshold.",
      parameters: {
        type: "object",
        required: ["name", "surname"],
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Suspect's first name" },
          surname: { type: "string", description: "Suspect's last name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_access_level",
      description: "Fetches the security access level for a suspect.",
      parameters: {
        type: "object",
        required: ["name", "surname", "birthYear"],
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Suspect's first name" },
          surname: { type: "string", description: "Suspect's last name" },
          birthYear: {
            type: "integer",
            description: "Suspect's year of birth as an integer (e.g. 1987)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_result",
      description:
        "Submits the final identified suspect to the verification endpoint. Call only after confirming the suspect was near a power plant and you have their access level.",
      parameters: {
        type: "object",
        required: ["name", "surname", "accessLevel", "powerPlant"],
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Suspect's first name" },
          surname: { type: "string", description: "Suspect's last name" },
          accessLevel: {
            type: "integer",
            description: "Suspect's security access level",
          },
          powerPlant: {
            type: "string",
            description:
              "Power plant code from the nearest plant result (e.g. PWR1234PL)",
          },
        },
      },
    },
  },
];

interface ToolDispatchContext {
  logger: FastifyBaseLogger;
  dryRun: boolean;
}

interface ReportToolResult {
  success: boolean;
  answer: FindhimAnswer;
  verifyResponse: unknown;
}

const dispatchTool = async (
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolDispatchContext,
): Promise<unknown> => {
  ctx.logger.info({ toolName, args }, "Agent dispatching tool.");

  switch (toolName) {
    case "get_suspect_locations": {
      const { name, surname } = args as { name: string; surname: string };

      const [locations, plants] = await Promise.all([
        fetchSuspectLocations(name, surname),
        fetchPowerPlants(),
      ]);

      const nearestPlant = findNearestPlant(
        locations,
        plants,
        PROXIMITY_THRESHOLD_KM,
      );

      return { locations, nearestPlant };
    }

    case "get_access_level": {
      const { name, surname, birthYear } = args as {
        name: string;
        surname: string;
        birthYear: number;
      };
      return fetchAccessLevel(name, surname, birthYear);
    }

    case "report_result": {
      const answer = args as unknown as FindhimAnswer;

      ctx.logger.info({ answer }, "Agent calling report_result.");

      if (ctx.dryRun) {
        return {
          success: true,
          answer,
          verifyResponse: null,
        } satisfies ReportToolResult;
      }

      let verifyResponse: unknown;

      try {
        verifyResponse = await submitReport({
          apikey: env.ag3ntsApiKey,
          task: "findhim",
          answer,
        });
        ctx.logger.info({ verifyResponse }, "Verification response received.");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        ctx.logger.error(
          { answer, error: errorMessage },
          "Verification submission failed.",
        );
        verifyResponse = { error: errorMessage };
      }

      // Always mark as success so finalAnswer is captured regardless of Hub response.
      return {
        success: true,
        answer,
        verifyResponse,
      } satisfies ReportToolResult;
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
};

export interface RunFindhimTaskOptions {
  openai: OpenAI;
  logger: FastifyBaseLogger;
  dryRun: boolean;
}

/**
 * Runs the findhim task using an OpenAI Function Calling agent loop.
 * Iterates through suspects, checks each one's proximity to power plants,
 * then retrieves the matching suspect's access level and submits the report.
 */
export const runFindhimTask = async ({
  openai,
  logger,
  dryRun,
}: RunFindhimTaskOptions): Promise<FindhimRunResult> => {
  // Share logger with fetch helpers for raw API response diagnostics
  fetchPlantsLogger = logger;

  const suspects = loadSuspects();
  const suspectsSummary = suspects.map(({ name, surname, born }) => ({
    name,
    surname,
    born,
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Investigate the following suspects and find who was near a nuclear power plant:\n\n${JSON.stringify(suspectsSummary, null, 2)}\n\nUse the available tools to check each suspect. Once you find a match, get their access level and report the result.`,
    },
  ];

  const tools = buildToolSchemas();
  let agentSteps = 0;
  let finalAnswer: FindhimAnswer | null = null;
  let verifyResponse: unknown;

  while (agentSteps < MAX_AGENT_STEPS) {
    agentSteps++;

    const response = await openai.chat.completions.create({
      model: env.openAiModel,
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    if (!choice) {
      logger.warn(
        { agentSteps },
        "Empty choices in OpenAI response — aborting agent loop.",
      );
      break;
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      logger.info(
        { agentSteps },
        "Agent completed without further tool calls.",
      );
      break;
    }

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue;

      let toolResult: unknown;
      const fnName = toolCall.function.name;

      try {
        const args = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
        toolResult = await dispatchTool(fnName, args, { logger, dryRun });

        if (fnName === "report_result") {
          const report = toolResult as ReportToolResult;

          if (report.success) {
            finalAnswer = report.answer;
            verifyResponse = report.verifyResponse;
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          { toolName: fnName, error: errorMessage },
          "Tool execution failed.",
        );
        toolResult = { error: errorMessage };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    if (finalAnswer) break;
  }

  if (!finalAnswer) {
    logger.warn(
      { agentSteps },
      "Agent did not identify a suspect within the step limit.",
    );
  }

  return {
    ok: finalAnswer !== null,
    dryRun,
    answer: finalAnswer,
    verifyResponse,
    agentSteps,
  };
};
