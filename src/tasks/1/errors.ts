export class PeopleTaskError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "PeopleTaskError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
