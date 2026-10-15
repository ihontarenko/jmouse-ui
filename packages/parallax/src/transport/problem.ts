/** One RFC 9457 problem as the backend answers it; `code` is the stable part to branch on. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly fields: Record<string, string>;
  readonly position: number | null;

  constructor(status: number, body: Partial<ProblemBody>) {
    super(body.detail || body.title || `HTTP ${status}`);
    this.status = status;
    this.code = body.code || (status === 0 ? "network" : "unknown");
    this.detail = body.detail || body.title || describeStatus(status);
    this.fields = body.fields || {};
    this.position = body.position ?? null;
  }
}

/** A problem document's fields, as the server writes them; any of them may be missing. */
export interface ProblemBody {
  status: number;
  title: string;
  detail: string;
  code: string;
  fields: Record<string, string>;
  position: number;
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

function describeStatus(status: number): string {
  if (status === 0) {
    return "The server cannot be reached. Check the connection.";
  }
  if (status === 401) {
    return "Sign in first.";
  }
  if (status === 403) {
    return "You are not allowed to do this.";
  }
  if (status === 404) {
    return "Not found.";
  }
  return "The server could not complete the request.";
}

/** Whether a failure is a request the caller aborted — never shown, since nobody is waiting for its answer. */
export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
