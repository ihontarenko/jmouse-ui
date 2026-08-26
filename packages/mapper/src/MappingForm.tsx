import { Plus, X } from "lucide-react"
import { Button, Input, Label } from "@jmouse/ui"
import { MappingRules } from "./MappingRules"
import { TypeSelect } from "./TypeSelect"
import { useMappableShape } from "./hooks"
import type { MapperLabels } from "./labels"
import type { MappableProperty, MappableType, MappingRow } from "./types"
import type { MappingFormModel, SourceFormModel, TargetFormModel } from "./naming"

/**
 * The Form tab — a mapping as targets, the sources that fill them, and rows.
 *
 * ## ⚠️ Nothing here writes `.jmm`
 *
 * Not a word of the language is assembled in this file. What it produces is a structure; the document is
 * what the server hands back when that structure is rendered. This is the rule the whole feature rests
 * on, and it is the one worth checking in a review: a `+` or a template literal joining a target to a
 * colon would be a second writer of the language, and the first thing a second writer gets wrong is
 * quoting.
 */
export function MappingForm({
  form,
  offered,
  labels,
  disabled = false,
  onChange,
}: {
  form: MappingFormModel
  offered: readonly MappableType[]
  labels: MapperLabels
  disabled?: boolean
  onChange: (form: MappingFormModel) => void
}) {
  function replaceTarget(index: number, replacement: TargetFormModel) {
    onChange({
      ...form,
      targets: form.targets.map((target, position) =>
        position === index ? replacement : target,
      ),
    })
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-1.5">
        <Label>{labels.mappingName}</Label>
        <Input
          value={form.name}
          disabled={disabled}
          placeholder="orders/project"
          onChange={(entry) => onChange({ ...form, name: entry.target.value })}
        />
      </div>

      {form.targets.map((target, index) => (
        <TargetBlock
          key={index}
          target={target}
          offered={offered}
          labels={labels}
          disabled={disabled}
          onChange={(replacement) => replaceTarget(index, replacement)}
          onRemove={() =>
            onChange({
              ...form,
              targets: form.targets.filter((_, position) => position !== index),
            })
          }
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange({ ...form, targets: [...form.targets, { type: "", always: [], sources: [] }] })
        }
      >
        <Plus className="mr-1.5 size-4" />
        {labels.addTarget}
      </Button>
    </div>
  )
}

/**
 * One target, its `always` block, and every source that fills it.
 *
 * ⚠️ A component of its own because the target's shape is fetched, and a hook cannot be called from a
 * loop. The same reason gives each source its own component below.
 */
function TargetBlock({
  target,
  offered,
  labels,
  disabled,
  onChange,
  onRemove,
}: {
  target: TargetFormModel
  offered: readonly MappableType[]
  labels: MapperLabels
  disabled: boolean
  onChange: (target: TargetFormModel) => void
  onRemove: () => void
}) {
  const shape = useMappableShape(target.type === "" ? null : target.type)
  const properties: readonly MappableProperty[] = shape.data?.properties ?? []

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-end gap-2">
        <div className="max-w-md flex-1">
          <TypeSelect
            label={labels.target}
            value={target.type}
            offered={offered}
            labels={labels}
            onChange={(type) => onChange({ ...target, type })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={labels.removeTarget}
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-sm font-medium">{labels.always}</Label>
          <p className="text-muted-foreground text-xs">{labels.alwaysHint}</p>
        </div>
        <MappingRules
          rows={target.always}
          targetProperties={properties}
          labels={labels}
          disabled={disabled}
          onChange={(always: MappingRow[]) => onChange({ ...target, always })}
        />
      </div>

      {target.sources.map((source, index) => (
        <SourceBlock
          key={index}
          source={source}
          targetProperties={properties}
          offered={offered}
          labels={labels}
          disabled={disabled}
          onChange={(replacement) =>
            onChange({
              ...target,
              sources: target.sources.map((existing, position) =>
                position === index ? replacement : existing,
              ),
            })
          }
          onRemove={() =>
            onChange({
              ...target,
              sources: target.sources.filter((_, position) => position !== index),
            })
          }
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange({ ...target, sources: [...target.sources, { type: "", rules: [] }] })}
      >
        <Plus className="mr-1.5 size-4" />
        {labels.addSource}
      </Button>
    </section>
  )
}

/** One source and the rows that read from it. */
function SourceBlock({
  source,
  targetProperties,
  offered,
  labels,
  disabled,
  onChange,
  onRemove,
}: {
  source: SourceFormModel
  targetProperties: readonly MappableProperty[]
  offered: readonly MappableType[]
  labels: MapperLabels
  disabled: boolean
  onChange: (source: SourceFormModel) => void
  onRemove: () => void
}) {
  const shape = useMappableShape(source.type === "" ? null : source.type)

  return (
    <div className="bg-muted/30 space-y-3 rounded-md border p-3">
      <div className="flex items-end gap-2">
        <div className="max-w-md flex-1">
          <TypeSelect
            label={labels.source}
            value={source.type}
            offered={offered}
            labels={labels}
            onChange={(type) => onChange({ ...source, type })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={labels.removeSource}
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>

      <MappingRules
        rows={source.rules}
        targetProperties={targetProperties}
        sourceProperties={shape.data?.properties ?? []}
        labels={labels}
        disabled={disabled}
        onChange={(rules: MappingRow[]) => onChange({ ...source, rules })}
      />
    </div>
  )
}
