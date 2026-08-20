/**
 * Where a `;;;jme` block's code is evaluated.
 *
 * <p>The library never names an endpoint. A host either points {@link fetchEvaluator} at a URL, or —
 * more usefully in an app that already has an HTTP client with auth and token refresh — hands over a
 * function that calls it:
 *
 * ```ts
 * jmePlugin({ evaluate: (request) => jmeApi.execute(request).then((response) => response.data) })
 * ```
 */

export interface JmeRequest {
    readonly code:      string;
    readonly variables: Record<string, unknown>;
}

export interface JmeResult {
    /** How the result should be presented — `template` output is HTML, anything else is a value. */
    readonly mode:   string;
    readonly result: unknown;
}

export type JmeEvaluator = (request: JmeRequest) => Promise<JmeResult>;

export interface FetchEvaluatorOptions {
    readonly headers?:     Record<string, string>;
    readonly credentials?: RequestCredentials;
}

/** The declarative evaluator: a URL that takes `{ code, variables }` and answers `{ mode, result }`. */
export function fetchEvaluator(url: string, options: FetchEvaluatorOptions = {}): JmeEvaluator {
    return async (request) => {
        const response = await fetch(url, {
            method:      'POST',
            credentials: options.credentials ?? 'same-origin',
            headers:     { 'Content-Type': 'application/json', ...options.headers },
            body:        JSON.stringify(request),
        });

        if (!response.ok) {
            throw new EvaluationError(await problemMessage(response));
        }
        return response.json() as Promise<JmeResult>;
    };
}

/** Carries a message meant for the reader, so the block can show it verbatim. */
export class EvaluationError extends Error {}

/**
 * The best sentence available for a failure. RFC 7807 `detail`, then `title`, then the error's own
 * message — an applet that says "Request failed with status code 400" has told the reader nothing.
 */
export function evaluationMessage(error: unknown): string {
    if (error instanceof EvaluationError) {
        return error.message;
    }

    const problem = (error as { response?: { data?: { detail?: string; title?: string } } })?.response?.data;
    if (problem?.detail) {
        return problem.detail;
    }
    if (problem?.title) {
        return problem.title;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Could not evaluate the block.';
}

async function problemMessage(response: Response): Promise<string> {
    try {
        const problem = await response.json();
        return problem?.detail ?? problem?.title ?? `Evaluation failed (${response.status}).`;
    } catch {
        return `Evaluation failed (${response.status}).`;
    }
}
