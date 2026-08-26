import { createContext, useContext } from "react"
import type { MappableShape, MappableType, MappingDraft, RenderedMapping } from "./types"

/**
 * How this package reaches the server — supplied by the product, never chosen here.
 *
 * ## ⚠️ No HTTP client is imported by this package, deliberately
 *
 * Every product already has one, wired to its own token refresh, its own workspace header and its own
 * error events. A shared package bringing a second would mean a request that skips all of that, and the
 * failure is a silent 401 on one screen while every other screen quietly re-authenticates.
 *
 * So the product hands over one function and this package calls it.
 */
export interface MapperTransport {
  /** `GET {prefix}/types` — what to offer in the two selects. */
  types(): Promise<MappableType[]>
  /** `GET {prefix}/shape?type=…` — what one type is made of. */
  shape(qualified: string): Promise<MappableShape>
  /** `POST {prefix}/render` — rows in, document out. */
  render(draft: MappingDraft): Promise<RenderedMapping>
  /** `POST {prefix}/parse` — document in, rows out. ⚠️ Refuses with 422 where the form cannot show it. */
  parse(text: string): Promise<MappingDraft>
}

const Transport = createContext<MapperTransport | null>(null)

export const MapperTransportProvider = Transport.Provider

/**
 * ⚠️ Throws rather than falling back. A builder with no transport would render, sit empty, and read as
 * *this product has no mappable types* — which is the wrong bug to go looking for.
 */
export function useMapperTransport(): MapperTransport {
  const transport = useContext(Transport)

  if (transport === null) {
    throw new Error(
      "No MapperTransport. Wrap the screen in <MapperTransportProvider value={…}> — this package " +
        "brings no HTTP client of its own, on purpose.",
    )
  }

  return transport
}

/**
 * A transport over any request function, which is what a product's HTTP client already is.
 *
 * ⚠️ `prefix` defaults to what the library's controller answers on. A product that moved it with
 * `jmouse.mapper.management.prefix` has to say so here too — the address lives in two places and there
 * is no third to forget.
 */
export function transportOver(
  request: <T>(method: "GET" | "POST", url: string, body?: unknown) => Promise<T>,
  prefix = "/jmouse/mapper/api",
): MapperTransport {
  return {
    types: () => request<MappableType[]>("GET", `${prefix}/types`),
    // ⚠️ Encoded, because a nested type carries a `$` and an inner class of a generic one can carry
    // characters a bare query string would end the parameter on.
    shape: (qualified) =>
      request<MappableShape>("GET", `${prefix}/shape?type=${encodeURIComponent(qualified)}`),
    render: (draft) => request<RenderedMapping>("POST", `${prefix}/render`, draft),
    parse: (text) => request<MappingDraft>("POST", `${prefix}/parse`, { text }),
  }
}
