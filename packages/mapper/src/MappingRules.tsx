import { Plus, X } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from "@jmouse/ui"
import type { MappableProperty, MappingRow } from "./types"
import type { MapperLabels } from "./labels"

/**
 * The rows one block is made of — a target property, where its value comes from, and when.
 *
 * ## ⚠️ The properties come from the SERVER, never from a list somebody maintains
 *
 * Both columns were read off the classes themselves, so a record that gains a component gains a
 * mappable property the same day, with the right name and the right type. A parallel list would be a
 * second description of something the code already says, and it would drift the first time somebody
 * added one.
 *
 * ## ⚠️ Only WRITABLE properties are offered as targets
 *
 * A computed getter is readable and not writable. Offering one on the left produces a document that
 * parses, renders, and then refuses to load — with an error about a property nobody chose by mistake.
 *
 * ## ⚠️ The expression stays free text, on purpose
 *
 * A filter-and-function palette is one question for every jMouse language, not one per language, and it
 * is open elsewhere. Half-answering it here would ship a second vocabulary mechanism that the real
 * answer then has to replace — so the box takes jME and the document tab colours it.
 */
export function MappingRules({
  rows,
  targetProperties,
  sourceProperties,
  labels,
  disabled = false,
  onChange,
}: {
  rows: readonly MappingRow[]
  targetProperties: readonly MappableProperty[]
  /** ⚠️ Absent for an `always` block, which has no source to read from. */
  sourceProperties?: readonly MappableProperty[]
  labels: MapperLabels
  disabled?: boolean
  onChange: (rows: MappingRow[]) => void
}) {
  const writable = targetProperties.filter((property) => property.writable)
  const readable = (sourceProperties ?? []).filter((property) => property.readable)

  function replace(index: number, replacement: MappingRow) {
    onChange(rows.map((row, position) => (position === index ? replacement : row)))
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
          {labels.noRules}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          {rows.map((row, index) => (
            <div
              key={index}
              className={cn(
                "grid items-end gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]",
                index > 0 && "border-t",
                row.ignored && "bg-muted/40",
              )}
            >
              <div className="space-y-1.5">
                {index === 0 ? <Label className="text-xs">{labels.property}</Label> : null}
                <PropertyField
                  value={row.target}
                  properties={writable}
                  disabled={disabled}
                  onChange={(target) => replace(index, { ...row, target })}
                />
              </div>

              <div className="space-y-1.5">
                {index === 0 ? <Label className="text-xs">{labels.expression}</Label> : null}
                <ExpressionField
                  value={row.expression ?? ""}
                  properties={readable}
                  // ⚠️ Disabled by `ignored` as well, so the box cannot hold a value the document will
                  // not carry — an expression left visible under a flag that discards it reads as saved.
                  disabled={disabled || row.ignored}
                  onChange={(expression) =>
                    replace(index, { ...row, expression: expression === "" ? null : expression })
                  }
                />
              </div>

              <div className="space-y-1.5">
                {index === 0 ? <Label className="text-xs">{labels.condition}</Label> : null}
                <Input
                  value={row.condition ?? ""}
                  placeholder={labels.conditionHint}
                  disabled={disabled || row.ignored}
                  onChange={(entry) =>
                    replace(index, {
                      ...row,
                      condition: entry.target.value === "" ? null : entry.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                {index === 0 ? <Label className="text-xs">{labels.ignore}</Label> : null}
                <Switch
                  checked={row.ignored}
                  disabled={disabled}
                  title={labels.ignoreHint}
                  onCheckedChange={(ignored) =>
                    replace(index, {
                      ...row,
                      ignored,
                      expression: ignored ? null : row.expression,
                      condition: ignored ? null : row.condition,
                    })
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={labels.removeRule}
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, position) => position !== index))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([...rows, { target: "", expression: null, condition: null, ignored: false }])
        }
      >
        <Plus className="mr-1.5 size-4" />
        {labels.addRule}
      </Button>
    </div>
  )
}

/**
 * The left of a rule.
 *
 * ⚠️ Falls back to a plain box when the shape is not known yet — while a type is loading, or for one the
 * descriptor could not describe. A select with nothing in it and no way past it would strand somebody on
 * a screen that looks broken.
 */
function PropertyField({
  value,
  properties,
  disabled,
  onChange,
}: {
  value: string
  properties: readonly MappableProperty[]
  disabled: boolean
  onChange: (name: string) => void
}) {
  if (properties.length === 0) {
    return (
      <Input value={value} disabled={disabled} onChange={(entry) => onChange(entry.target.value)} />
    )
  }

  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="…" />
      </SelectTrigger>
      <SelectContent>
        {properties.map((property) => (
          <SelectItem key={property.name} value={property.name}>
            {property.name}
            <span className="text-muted-foreground ml-2 text-xs">
              {shortenedType(property.type)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The right of a rule — jME, with the source's own properties offered as completions.
 *
 * ⚠️ A datalist rather than a select: the value is an expression, and a property name is only its
 * commonest shape. Anything forcing a choice from the list would make `total | round` unwritable.
 */
function ExpressionField({
  value,
  properties,
  disabled,
  onChange,
}: {
  value: string
  properties: readonly MappableProperty[]
  disabled: boolean
  onChange: (expression: string) => void
}) {
  const listing = properties.length === 0 ? undefined : "jmm-source-properties"

  return (
    <>
      <Input
        value={value}
        list={listing}
        disabled={disabled}
        placeholder="reference | trim"
        onChange={(entry) => onChange(entry.target.value)}
      />
      {listing === undefined ? null : (
        <datalist id={listing}>
          {properties.map((property) => (
            <option key={property.name} value={property.name} />
          ))}
        </datalist>
      )}
    </>
  )
}

/** `java.math.BigDecimal` as `BigDecimal` — a row has no width for the package. */
function shortenedType(type: string): string {
  const separator = Math.max(type.lastIndexOf("."), type.lastIndexOf("$"))

  return separator === -1 ? type : type.slice(separator + 1)
}
