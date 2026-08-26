import { useState } from "react"
import { Pencil, Undo2 } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jmouse/ui"
import type { MappableType } from "./types"
import type { MapperLabels } from "./labels"

/**
 * One side of a pair, chosen from what the product offers — or named outright.
 *
 * ## ⚠️ The escape hatch is not a convenience
 *
 * The scan behind the list is a **listing**, never a filter on what may be mapped: the engine maps
 * whatever it is handed, so a type the product's matcher did not find is still a perfectly good target.
 * A select with no way past it would invent a restriction the engine does not have — and the person
 * hitting it would have no way to tell a missing type from an unmappable one.
 *
 * ⚠️ Which is also why the free-text box says how a nested type is spelled. `Outer.Inner` resolves to
 * nothing, and the refusal for a name that does not exist reads identically to one for a name that is
 * merely spelled the Java way.
 */
export function TypeSelect({
  label,
  value,
  offered,
  labels,
  onChange,
}: {
  label: string
  value: string
  offered: readonly MappableType[]
  labels: MapperLabels
  onChange: (qualified: string) => void
}) {
  const listed = offered.some((type) => type.qualified === value)
  const [naming, setNaming] = useState(false)

  const typing = naming || (value !== "" && !listed)

  if (typing) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            value={value}
            placeholder="com.example.OrderResponse"
            onChange={(entry) => onChange(entry.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={labels.chooseType}
            onClick={() => {
              setNaming(false)
              onChange("")
            }}
          >
            <Undo2 className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{labels.otherTypeHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={labels.chooseType} />
          </SelectTrigger>
          <SelectContent>
            {offered.map((type) => (
              <SelectItem key={type.qualified} value={type.qualified}>
                {type.simple}
                <span className="text-muted-foreground ml-2 text-xs">{type.packageName}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={labels.otherType}
          onClick={() => setNaming(true)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </div>
  )
}
