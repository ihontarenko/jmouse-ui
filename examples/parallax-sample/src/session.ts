import { ApiProblem, type HttpMethod, type ParallaxTransport, type ProblemBody, transportOver } from "@jmouse/parallax";

/*
 * The host's session: its own sign-in, its own request function, and the transport the library is handed. The token
 * lives in memory only — a reload signs the reader out, which is all a sample needs.
 */

let sessionToken: string | null = null;

function readToken(): string | null {
  return sessionToken;
}

/** The host's request function: the whole address in, JSON out, a refusal thrown as the library's `ApiProblem`. */
async function requestAddress<T>(method: HttpMethod, url: string, options: { body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (sessionToken !== null) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiProblem(0, {});
  }
  if (!response.ok) {
    let body: Partial<ProblemBody> = {};
    try {
      body = await response.json();
    } catch {
      // Not a problem document; the status describes it.
    }
    throw new ApiProblem(response.status, body);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** The one transport the sample hands `<ParallaxTransportProvider>`: the library's routes, the session's token. */
export const sampleTransport: ParallaxTransport = transportOver(requestAddress, "/jmouse/parallax/api", readToken);

/** Signs in through the backend's own route; the token is kept for every later request and the live socket. */
export async function signIn(handle: string, password: string): Promise<void> {
  const answer = await requestAddress<{ token: string }>("POST", "/api/v1/auth/sign-in", { body: { handle, password } });
  sessionToken = answer.token;
}
