import { useMemo } from 'react';
import type { ComponentType } from 'react';
import type { BlockDataState, MarkdownBlock, MarkdownPlugin } from '../core';
import { blockKey, useAsyncResource } from '../core';

/**
 * `:::name argument` blocks whose content is fetched rather than written — live stock, a build's
 * coverage, today's exchange rate. The library owns the mechanism (claim the names, batch the
 * document's blocks into one request, key the answers back to the blocks, track the status); the host
 * owns both ends (where the data comes from, and what a resolved block looks like).
 *
 * ```ts
 * dataBlockPlugin({
 *     directives: ['stock', 'part', 'bom'],
 *     load:       promiseLoader((requests) => http.post('/api/blocks/resolve', requests).then((r) => r.data)),
 *     render:     LiveBlockCard,
 * })
 * ```
 */

export interface DataBlockRequest {
    readonly name:     string;
    readonly argument: string;
}

export interface DataBlockResult<TData> extends DataBlockRequest {
    readonly data: TData;
}

export interface DataBlockLoad<TData> {
    readonly results: readonly DataBlockResult<TData>[] | undefined;
    readonly loading: boolean;
    /** False where this context resolves nothing at all — blocks then say so instead of spinning. */
    readonly available: boolean;
}

/** Resolves a document's requests. A hook, so a host can bring its own cache. */
export type DataBlockLoader<TContext, TData> =
    (requests: readonly DataBlockRequest[], context: TContext) => DataBlockLoad<TData>;

export interface DataBlockRenderProperties<TData> {
    readonly block:  MarkdownBlock;
    readonly data:   TData | undefined;
    readonly status: 'ready' | 'loading' | 'unavailable';
}

export interface DataBlockPluginOptions<TContext, TData> {
    /** Unique among the installed plugins; defaults to `data-blocks`. */
    readonly name?:       string;
    readonly directives:  readonly string[];
    readonly load:        DataBlockLoader<TContext, TData>;
    readonly render:      ComponentType<DataBlockRenderProperties<TData>>;
}

export function dataBlockPlugin<TContext, TData>(
    options: DataBlockPluginOptions<TContext, TData>,
): MarkdownPlugin<TContext> {
    const { name = 'data-blocks', directives, load, render: Render } = options;

    return {
        name,
        claims: directives.map((directive) => ({ shape: 'line' as const, name: directive })),

        useBlockData(blocks, context): BlockDataState {
            const requests = useMemo(
                () => blocks.map((block) => ({ name: block.name, argument: block.body })),
                [blocks],
            );
            const { results, loading, available } = load(requests, context);

            return useMemo(() => {
                const byKey = new Map<string, TData>();
                for (const result of results ?? []) {
                    byKey.set(blockKey({ shape: 'line', name: result.name, body: result.argument }), result.data);
                }
                if (!available) {
                    return { byKey, status: 'unavailable' };
                }
                return { byKey, status: loading ? 'loading' : 'ready' };
            }, [results, loading, available]);
        },

        renderBlock: ({ block, data, status }) => (
            <Render block={block} data={data as TData | undefined} status={status}/>
        ),
    };
}

/**
 * A {@link DataBlockLoader} from a plain promise, for a host with no data layer of its own.
 *
 * <p>It refetches only when the *set of blocks* changes, so typing prose around a `:::stock` does not
 * hit the network, and it keeps the previous answers on screen while a new set is in flight.
 */
export function promiseLoader<TContext, TData>(
    resolve:  (requests: readonly DataBlockRequest[], context: TContext) => Promise<readonly DataBlockResult<TData>[]>,
    options: { readonly available?: (context: TContext) => boolean } = {},
): DataBlockLoader<TContext, TData> {
    return (requests, context) => {
        const available = options.available?.(context) ?? true;
        const key = available && requests.length > 0
            ? requests.map((request) => `${request.name}:${request.argument.toLowerCase()}`).sort().join('|')
            : null;

        const { value, loading } = useAsyncResource(key, () => resolve(requests, context));
        return { results: value, loading, available };
    };
}
