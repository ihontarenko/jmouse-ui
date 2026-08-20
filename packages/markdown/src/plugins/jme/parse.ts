/**
 * The `;;;jme` block format — bindings above a `---`, code below it.
 *
 *     $voltage:numeric:"Supply voltage, V"          ← bindings
 *     $tap:select(Low,1;High,2):"Winding tap"
 *     ---
 *     (voltage * tap) ~ ' V'                        ← code
 *
 * Each binding line is `$alias:type[(options)][:"title"]` — the name the expression uses, **the kind
 * of input to draw**, and an optional quoted title for the label above it. With no `---`, the whole
 * body is code and there are no inputs (a pure demo).
 *
 * <h2>⚠️ The second segment used to be a field id, and it never meant anything here</h2>
 *
 * <p>It was `$ALIAS:source-id[:placeholder]`, documented as *"opaque here — the host's field id, a
 * variable name, anything"*. This block resolves nothing against a form: it draws one input per
 * binding and posts `{ code, variables }` to whatever evaluator the host handed it. So the segment is
 * not being migrated from one meaning to another — it is being **given** a meaning, and what it costs
 * is the illusion that a block is bound to a form somewhere.
 *
 * <p>⚠️ **The old grammar is dropped, not degraded.** A binding whose type is not one of the five
 * below is a {@link JmeBindingProblem}, the block says which line and why, and it evaluates nothing.
 * An applet that quietly keeps working after its declaration stopped meaning what it says is how
 * somebody ships a page whose numbers are wrong; a calculator is better off loudly broken.
 */

/** The kinds of input a binding may declare. */
export type JmeInputType = 'numeric' | 'select' | 'text' | 'boolean' | 'date';

export const JME_INPUT_TYPES: readonly JmeInputType[] = ['numeric', 'select', 'text', 'boolean', 'date'];

/** One choice in a `select(…)` — what the reader sees, and what the expression receives. */
export interface JmeSelectOption {
    readonly label: string;
    readonly key:   string;
}

export interface JmeBinding {
    readonly alias: string;
    /** The kind of input to draw, and the type the value is sent as. */
    readonly type:  JmeInputType;
    /** The label above the input. Falls back to the alias — see {@link bindingLabel}. */
    readonly title?: string;
    /** The choices, for `select`. Empty for every other type. */
    readonly options: readonly JmeSelectOption[];
}

/** A binding line that does not parse, kept so the block can name it instead of ignoring it. */
export interface JmeBindingProblem {
    /** The offending line, verbatim, so the author can find it. */
    readonly line:   string;
    readonly reason: string;
}

export interface ParsedJmeBlock {
    readonly bindings: readonly JmeBinding[];
    readonly problems: readonly JmeBindingProblem[];
    readonly code:     string;
}

const SEPARATOR_PATTERN = /^---[ \t]*$/;
const NUMERIC_PATTERN   = /^-?\d+(?:\.\d+)?$/;

/** `$alias:type[(options)][:"title"]` — the four groups are alias, type, options, title. */
const BINDING_PATTERN = /^\$([A-Za-z_]\w*):([A-Za-z_]\w*)(?:\(([^()]*)\))?(?::[ \t]*"((?:[^"\\]|\\.)*)")?$/;

export function parseJmeBlock(source: string): ParsedJmeBlock {
    const lines          = (source ?? '').split('\n');
    const separatorIndex = lines.findIndex((line) => SEPARATOR_PATTERN.test(line));
    const hasSeparator   = separatorIndex !== -1;

    const bindingLines = hasSeparator ? lines.slice(0, separatorIndex) : [];
    const codeLines    = hasSeparator ? lines.slice(separatorIndex + 1) : lines;

    const bindings: JmeBinding[]        = [];
    const problems: JmeBindingProblem[] = [];
    const seen                          = new Set<string>();

    for (const rawLine of bindingLines) {
        const line = rawLine.trim();
        if (line === '') {
            continue;
        }

        const parsed = parseBindingLine(line);
        if ('reason' in parsed) {
            problems.push({ line, reason: parsed.reason });
            continue;
        }
        if (seen.has(parsed.alias)) {
            problems.push({ line, reason: `Two bindings share the alias “${parsed.alias}”.` });
            continue;
        }

        seen.add(parsed.alias);
        bindings.push(parsed);
    }

    return { bindings, problems, code: codeLines.join('\n').trim() };
}

function parseBindingLine(line: string): JmeBinding | { reason: string } {
    const match = BINDING_PATTERN.exec(line);
    if (!match) {
        return {
            reason: line.startsWith('$')
                ? 'Expected $alias:type or $alias:type:"title" — the title has to be quoted.'
                : 'Expected a binding line beginning with “$”.',
        };
    }

    const [, alias, typeName, optionSource, quotedTitle] = match;

    if (!isInputType(typeName)) {
        return { reason: `Unknown input type “${typeName}” — expected ${JME_INPUT_TYPES.join(', ')}.` };
    }

    if (typeName !== 'select' && optionSource !== undefined) {
        return { reason: `“${typeName}” takes no options — only select does.` };
    }

    let options: readonly JmeSelectOption[] = [];
    if (typeName === 'select') {
        const parsedOptions = parseOptions(optionSource ?? '');
        if ('reason' in parsedOptions) {
            return parsedOptions;
        }
        options = parsedOptions.options;
    }

    const title = quotedTitle === undefined ? undefined : unescapeTitle(quotedTitle);
    return { alias, type: typeName, title: title === '' ? undefined : title, options };
}

/**
 * `Low,1;High,2` → two options.
 *
 * <p>Split at the **last** comma of each entry, so a label may contain one — `Low, tap 1,1` is the
 * label "Low, tap 1" and the key "1". A label may not contain `;` or `)`; there is no escape, because
 * a grammar that needs one has outgrown a single line.
 */
function parseOptions(source: string): { options: JmeSelectOption[] } | { reason: string } {
    const entries = source.split(';').map((entry) => entry.trim()).filter((entry) => entry !== '');
    if (entries.length === 0) {
        return { reason: 'select needs options, as select(Low,1;High,2).' };
    }

    const options: JmeSelectOption[] = [];
    for (const entry of entries) {
        const comma = entry.lastIndexOf(',');
        if (comma <= 0 || comma === entry.length - 1) {
            return { reason: `“${entry}” is not a label and a key — write it as label,key.` };
        }
        options.push({ label: entry.slice(0, comma).trim(), key: entry.slice(comma + 1).trim() });
    }
    return { options };
}

function isInputType(candidate: string): candidate is JmeInputType {
    return (JME_INPUT_TYPES as readonly string[]).includes(candidate);
}

function unescapeTitle(quoted: string): string {
    return quoted.replace(/\\(.)/g, '$1').trim();
}

function escapeTitle(title: string): string {
    return title.replace(/([\\"])/g, '\\$1');
}

/** Assembles a block from bindings and code — the inverse of {@link parseJmeBlock}. */
export function buildJmeBlock(bindings: readonly JmeBinding[], code: string): string {
    const body = code.trim() === '' ? '// expression or {{ template }} here' : code.trim();

    if (bindings.length === 0) {
        return `;;;jme\n${body}\n;;;`;
    }

    const lines = bindings.map((binding) => {
        const options = binding.type === 'select'
            ? `(${binding.options.map((option) => `${option.label},${option.key}`).join(';')})`
            : '';
        const title = binding.title?.trim() ?? '';
        const base  = `$${binding.alias}:${binding.type}${options}`;
        return title !== '' ? `${base}:"${escapeTitle(title)}"` : base;
    });
    return `;;;jme\n${lines.join('\n')}\n---\n${body}\n;;;`;
}

/**
 * What an input starts at.
 *
 * <p>⚠️ A checkbox and a dropdown are never *empty* — an unchecked box means `false` and a dropdown
 * always shows something. Seeding them is not a convenience: a block whose only input is a checkbox
 * would otherwise sit on "Enter values to see the result" forever, and a dropdown showing its first
 * label while sending nothing is simply a lie.
 */
export function defaultBindingValue(binding: JmeBinding): string {
    if (binding.type === 'boolean') {
        return 'false';
    }
    if (binding.type === 'select') {
        return binding.options[0]?.key ?? '';
    }
    return '';
}

/** Whether a binding still needs the reader to say something. Seeded types never do. */
export function isBindingUnanswered(binding: JmeBinding, raw: string): boolean {
    if (binding.type === 'boolean' || binding.type === 'select') {
        return false;
    }
    return raw.trim() === '';
}

/**
 * The value sent to the evaluator, in the type the binding declared.
 *
 * <p>This is what the declared type buys. It used to be {@link coerceJmeValue} guessing from the
 * string for every input, so a part number of `0042` arrived as the number 42 and a postcode could
 * arrive as either depending on the postcode.
 */
export function bindingValue(binding: JmeBinding, raw: string): number | string | boolean {
    switch (binding.type) {
        case 'numeric': {
            const trimmed = raw.trim();
            const parsed  = Number(trimmed);
            // A half-typed "-" or "1e" is not a number yet; sending the string keeps the failure the
            // evaluator's, where it can say so, rather than silently becoming NaN here.
            return trimmed !== '' && Number.isFinite(parsed) ? parsed : raw;
        }
        case 'boolean':
            return raw === 'true';
        // ⚠️ The one type that still guesses, and it has to: select keys are authored as text and are
        // as often `1` as they are `high`.
        case 'select':
            return coerceJmeValue(raw);
        default:
            return raw;
    }
}

/**
 * A raw input string as the value sent to the evaluator: a number when it reads as one, so arithmetic
 * works, otherwise the string as typed.
 *
 * <p>Kept for `select`, whose keys are authored text, and for a host that draws its own inputs. Prefer
 * {@link bindingValue}, which asks the binding instead of guessing.
 */
export function coerceJmeValue(raw: string): number | string {
    const trimmed = raw.trim();
    if (trimmed !== '' && NUMERIC_PATTERN.test(trimmed)) {
        return Number(trimmed);
    }
    return raw;
}

/** The human label above an input: the title when set, otherwise the code alias. */
export function bindingLabel(binding: JmeBinding): string {
    const title = binding.title?.trim();
    return title ? title : binding.alias;
}

export const JME_ALIAS_PATTERN = /^[A-Za-z_]\w*$/;
