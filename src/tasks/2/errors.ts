export class FindhimTaskError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "FindhimTaskError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
