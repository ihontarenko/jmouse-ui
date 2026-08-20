/**
 * How the library reaches things it does not own — files, images, pages, documents, anything a dialog
 * can offer to link to.
 *
 * <p>A {@link ResourceSource} is a name and a search function. That is the whole port: the library
 * never learns an endpoint, a payload shape, an auth scheme or a pagination convention, and a host
 * wires one up either declaratively from a URL and a mapper ({@link httpResource}) or by handing over
 * a function that calls whatever client it already has.
 *
 * ```ts
 * imagePlugin({ sources: [httpResource({
 *     id:    'files',
 *     label: 'From files',
 *     url:   (query) => `/api/files?search=${encodeURIComponent(query)}`,
 *     map:   (payload) => payload.items.map((file) => ({ id: file.id, label: file.name, value: file.url })),
 * })] })
 * ```
 */

export interface ResourceItem {
    readonly id:    string;
    readonly label: string;
    /** What gets inserted for it — usually a URL, sometimes a path or an identifier. */
    readonly value: string;
    /** A muted second line: a size, a type, a breadcrumb. */
    readonly hint?: string;
    /** A coarse type the caller may filter on, most often a MIME type. */
    readonly kind?: string;
}

export interface ResourceSource {
    readonly id:    string;
    /** The tab caption this source appears under. */
    readonly label: string;
    readonly search: (query: string) => Promise<readonly ResourceItem[]>;
    /** Shown in place of an empty result list — the place to say where things come from. */
    readonly emptyHint?: string;
}

/** Fetches and decodes one request. Swap it for the host's own client to inherit auth and refresh. */
export type ResourceTransport = (url: string) => Promise<unknown>;

const defaultTransport: ResourceTransport = (url) =>
    fetch(url, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) {
            throw new Error(`Resource request failed: ${response.status}`);
        }
        return response.json();
    });

export interface HttpResourceOptions {
    readonly id:         string;
    readonly label:      string;
    /** A fixed URL, or one built from the current query for server-side search. */
    readonly url:        string | ((query: string) => string);
    /** Turns whatever the endpoint returns into items — the one place a payload shape is known. */
    readonly map:        (payload: unknown) => readonly ResourceItem[];
    readonly transport?: ResourceTransport;
    readonly emptyHint?: string;
    /**
     * Filters client-side after mapping. Use with a fixed {@link url} to search a list the endpoint
     * returns whole; leave it out when the URL already carries the query.
     */
    readonly filter?:    (item: ResourceItem, query: string) => boolean;
}

/** A {@link ResourceSource} from a URL and a mapper — the declarative half of the port. */
export function httpResource(options: HttpResourceOptions): ResourceSource {
    const { id, label, url, map, transport = defaultTransport, emptyHint, filter } = options;

    return {
        id,
        label,
        emptyHint,
        search: async (query) => {
            const target = typeof url === 'function' ? url(query) : url;
            const items  = map(await transport(target));
            if (!filter) {
                return items;
            }
            return items.filter((item) => filter(item, query));
        },
    };
}

/** Matches a query against an item's label and hint — the sensible default for {@link httpResource}. */
export function matchesQuery(item: ResourceItem, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
        return true;
    }
    return `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle);
}
