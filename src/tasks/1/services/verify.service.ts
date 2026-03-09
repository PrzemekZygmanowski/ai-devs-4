import { env } from "../../../config/env.js";
import { PeopleTaskError } from "../errors.js";
import type { VerifyPeoplePayload } from "../types.js";

const parseResponseBody = (rawBody: string): unknown => {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
};

/**
 * Sends the final answer to the AG3NTS verification endpoint.
 */
export const verifyPeopleAnswer = async (
  payload: VerifyPeoplePayload,
): Promise<unknown> => {
  const response = await fetch(env.verifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  const parsedBody = parseResponseBody(rawBody);

  if (!response.ok) {
    throw new PeopleTaskError("Verification request failed.", 502, parsedBody);
  }

  return parsedBody;
};
