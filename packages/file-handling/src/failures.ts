/**
 * What went wrong, in the words the server used.
 *
 * <h2>⚠️ "The files could not be read." is not a diagnosis</h2>
 *
 * <p>Every refusal in this package used to read alike, which made every refusal cost a round of
 * guessing: a 403 from an access rule, a 404 from a folder that had gone, a 502 from a backend that was
 * still starting and a network error all produced the same sentence. The status alone separates three of
 * those four, and it is already in hand at the moment the message is written.</p>
 *
 * <h2>⚠️ Duck-typed, because this package does not import an HTTP client</h2>
 *
 * <p>Two products reject with an `AxiosError` and a third may not. What is read here is the shape every
 * one of them happens to have — a `response` with a `status` and possibly a problem detail — and
 * anything that does not have it contributes nothing rather than throwing inside an error handler,
 * which is the one place a throw has nowhere to go.</p>
 */

interface HttpLikeFailure {
  response?: {
    status?: number
    data?: { detail?: string; title?: string; message?: string } | string
  }
  message?: string
}

/**
 * A short parenthetical to hang off a message — `(403 — file:read is required here)`.
 *
 * ⚠️ **Empty when there is nothing to say**, so the caller can always append it. A message ending in an
 * empty pair of brackets is worse than one that ends.
 *
 * @param failure whatever was rejected with
 * @return the parenthetical, or an empty string
 */
export function because(failure: unknown): string {
  const reason = reasonOf(failure)

  return reason === "" ? "" : ` (${reason})`
}

/**
 * The same words without the brackets — `403 — file:read is required here` — for a sentence that places the reason
 * itself, as a translated one has to: where a reason goes is a matter of the language's word order.
 *
 * @param failure whatever was rejected with
 * @return the reason, or an empty string
 */
export function reasonOf(failure: unknown): string {
  return describe(failure).join(" — ")
}

/**
 * The HTTP status a failure carries, when it carries one — so a caller can tell a folder that has gone (404) from a
 * refusal (403) or a backend that is down (502) without parsing the words.
 *
 * @param failure whatever was rejected with
 * @return the status, or undefined
 */
export function failureStatus(failure: unknown): number | undefined {
  if (!failure || typeof failure !== "object") {
    return undefined
  }

  return (failure as HttpLikeFailure).response?.status
}

function describe(failure: unknown): string[] {
  if (!failure || typeof failure !== "object") {
    return []
  }

  const { response, message } = failure as HttpLikeFailure
  const parts: string[] = []

  if (response?.status) {
    parts.push(String(response.status))
  }

  const detail = detailOf(response?.data)

  if (detail) {
    parts.push(detail)

    return parts
  }

  // ⚠️ The client's own message only where the server said nothing — it is "Request failed with status
  // code 403", which repeats the number and adds no information beside it.
  if (parts.length === 0 && message) {
    parts.push(message)
  }

  return parts
}

function detailOf(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) {
    return data.trim().slice(0, 200)
  }

  if (!data || typeof data !== "object") {
    return null
  }

  const problem = data as { detail?: string; title?: string; message?: string }
  const said = problem.detail ?? problem.message ?? problem.title

  return said ? said.slice(0, 200) : null
}
