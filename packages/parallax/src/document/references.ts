import type { ParallaxTransport } from "../transport/transport";

export interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * Where the documents of a kind are listed, by the kind's keyword. A reference field to a kind with no listing here is
 * typed as a slug; the server refuses one that names nothing when the document is saved.
 */
const listings: Record<string, (transport: ParallaxTransport) => Promise<ReferenceOption[]>> = {
  symbol: (transport) => transport.components.symbols()
    .then((symbols) => symbols.map((symbol) => ({ value: symbol.slug, label: symbol.title }))),
  category: (transport) => transport.catalogue.categories()
    .then((categories) => categories.map((category) => ({ value: category.code.toLowerCase(), label: category.title }))),
};

/** The listings fetched through each transport: two servers' documents are never mixed. */
const loaded = new WeakMap<ParallaxTransport, Map<string, Promise<ReferenceOption[]>>>();

/** The documents of a kind that has a listing, fetched once per transport and shared until forgotten. */
export function referenceOptionsOf(transport: ParallaxTransport, kind: string): Promise<ReferenceOption[]> {
  let kinds = loaded.get(transport);
  if (!kinds) {
    kinds = new Map();
    loaded.set(transport, kinds);
  }
  let options = kinds.get(kind);
  if (!options) {
    const loading = kinds;
    options = listings[kind](transport);
    options.catch(() => loading.delete(kind));
    kinds.set(kind, options);
  }
  return options;
}

/** Forgets the transport's listings, so a document created meanwhile — a new symbol — is offered. */
export function forgetReferenceOptions(transport: ParallaxTransport) {
  loaded.delete(transport);
}

/** The kinds among these whose documents are listed; a reference to any other is typed as a slug. */
export function listedReferenceKinds(kinds: readonly string[]): string[] {
  return kinds.filter((kind) => kind in listings);
}
