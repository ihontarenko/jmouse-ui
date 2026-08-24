import type { YamlMapping, YamlValue } from './yaml';
import s from './frontmatter.module.css';

/**
 * The default face of a document's frontmatter: what the document *is*, drawn as a card above what it
 * says.
 *
 * <p>A host that wants another one passes `render` to the plugin and gets the same view model. What is
 * fixed is the reading order — an identity, a sentence about it, then the rest — because that is the
 * order somebody scanning a page of skills or memories actually needs.
 */

export interface FrontmatterField {
    /** The key exactly as it was written, which is what a host matching on it should use. */
    readonly key:   string;
    /** The same key made readable — `node_type` becomes `Node type`. */
    readonly label: string;
    readonly value: YamlValue;
}

export interface FrontmatterRenderProperties {
    /** The whole mapping, for a host that wants a key this view model does not surface. */
    readonly data:         YamlMapping;
    readonly title?:       string;
    readonly description?: string;
    /** Everything except the title and description keys, in the order they were written. */
    readonly fields:       readonly FrontmatterField[];
}

/** Above this, the remaining fields fold away; a card is a header, not a second document. */
const COLLAPSE_ABOVE = 3;

export function FrontmatterCard({ title, description, fields }: FrontmatterRenderProperties) {
    if (!title && !description && fields.length === 0) {
        return null;
    }

    return (
        <section className={s.card}>
            {/* ⚠️ Deliberately not a heading element. Putting the document's metadata into its outline
                is a milder version of the bug this whole plugin exists to fix. */}
            {title && <div className={s.title}>{title}</div>}
            {description && <p className={s.description}>{description}</p>}
            {fields.length > COLLAPSE_ABOVE
                ? (
                    <details className={s.fold}>
                        <summary className={s.summary}>{fields.length} more fields</summary>
                        <Fields fields={fields}/>
                    </details>
                )
                : fields.length > 0 && <Fields fields={fields}/>}
        </section>
    );
}

function Fields({ fields }: { readonly fields: readonly FrontmatterField[] }) {
    return (
        <dl className={s.fields}>
            {fields.map((field) => (
                <div className={s.field} key={field.key}>
                    <dt className={s.label}>{field.label}</dt>
                    <dd className={s.value}><Value value={field.value}/></dd>
                </div>
            ))}
        </dl>
    );
}

function Value({ value }: { readonly value: YamlValue }) {
    if (value === null) {
        return <span className={s.empty}>—</span>;
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
        return <span className={s.literal}>{String(value)}</span>;
    }

    if (isSequence(value)) {
        return <Sequence items={value}/>;
    }

    if (typeof value === 'object') {
        return <Fields fields={toFields(value)}/>;
    }

    return <Scalar text={value}/>;
}

function Sequence({ items }: { readonly items: readonly YamlValue[] }) {
    if (items.length === 0) {
        return <span className={s.empty}>—</span>;
    }

    // A list of plain values reads as chips; anything structured keeps its own layout, because chips
    // that contain tables are worse than either.
    if (items.every(isScalar)) {
        return (
            <ul className={s.chips}>
                {items.map((item, index) => (
                    <li className={s.chip} key={index}><Value value={item}/></li>
                ))}
            </ul>
        );
    }

    return (
        <ul className={s.items}>
            {items.map((item, index) => (
                <li key={index}><Value value={item}/></li>
            ))}
        </ul>
    );
}

const LINK      = /^https?:\/\/\S+$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function Scalar({ text }: { readonly text: string }) {
    if (LINK.test(text)) {
        return <a className={s.link} href={text} target="_blank" rel="noopener noreferrer">{text}</a>;
    }

    const moment = TIMESTAMP.exec(text);

    // Seconds and milliseconds are noise in a header, and the zone belongs on hover rather than in the
    // line — but the exact value stays one tooltip away rather than being thrown out.
    if (moment) {
        return <time className={s.literal} dateTime={text} title={text}>{`${moment[1]} · ${moment[2]}`}</time>;
    }

    return <>{text}</>;
}

/**
 * Turns a parsed mapping into what the card draws.
 *
 * <p>Which key is the title and which is the description is configuration rather than vocabulary baked
 * in here — the plugin passes its own lists, and a mapping that has neither simply draws every key as a
 * field.
 */
export function toFrontmatterView(
    data:            YamlMapping,
    titleKeys:       readonly string[],
    descriptionKeys: readonly string[],
): FrontmatterRenderProperties {
    const titleKey       = titleKeys.find((key) => typeof data[key] === 'string');
    const descriptionKey = descriptionKeys.find((key) => key !== titleKey && typeof data[key] === 'string');
    const claimed        = new Set([titleKey, descriptionKey]);

    return {
        data,
        title:       titleKey === undefined ? undefined : String(data[titleKey]),
        description: descriptionKey === undefined ? undefined : String(data[descriptionKey]),
        fields:      toFields(data).filter((field) => !claimed.has(field.key)),
    };
}

function toFields(mapping: YamlMapping): FrontmatterField[] {
    return Object.keys(mapping).map((key) => ({ key, label: toLabel(key), value: mapping[key] }));
}

/**
 * A key made readable: `node_type` and `nodeType` both become `Node type`.
 *
 * <p>⚠️ The camel-case split is not cosmetic. Labels are set in small capitals, and `originSessionId`
 * left unsplit renders as `ORIGINSESSIONID` — a word nobody can read at a glance, in the column whose
 * whole job is being glanced at.
 */
function toLabel(key: string): string {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();

    return words.charAt(0).toUpperCase() + words.slice(1);
}

function isSequence(value: YamlValue): value is readonly YamlValue[] {
    return Array.isArray(value);
}

function isScalar(value: YamlValue): boolean {
    return value === null || typeof value !== 'object';
}
