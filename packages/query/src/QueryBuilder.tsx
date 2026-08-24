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
} from "@jmouse/ui"
import { wordFor, type QueryLabels } from "./labels"
import type { ConditionRow, QueryAttribute, QueryOperator } from "./types"

/**
 * The controls a filter is composed from — one row per question.
 *
 * ## ⚠️ The fields come from the SERVER, not from a list somebody maintains
 *
 * Every attribute this offers was read off whatever the listing actually holds, so a form that gains a
 * field gains a filterable field on the same day — with the right type, the right options and the right
 * converter. A parallel list of "filterable fields" would be a second description of something the
 * product already says, and it would drift the first time somebody added one.
 *
 * ## ⚠️ So do the OPERATORS
 *
 * They arrive with the vocabulary. A builder offering a comparison the composer does not have produces a
 * refusal about an operator that same builder handed the person.
 *
 * ## ⚠️ *"and those with no such field?"* sits ON the row
 *
 * A negative test excludes rows that have no such value at all — three-valued logic, which is correct
 * and surprising every single time. The switch puts the question where the person is already thinking
 * about it, rather than leaving them staring at a result they cannot explain.
 *
 * ## ⚠️ What this component does NOT do
 *
 * It never writes jMQ and never reads it. Rows go to the server and text comes back.
 */
export function QueryBuilder({
  attributes,
  operators,
  rows,
  labels,
  onChange,
}: {
  attributes: QueryAttribute[]
  operators: QueryOperator[]
  rows: ConditionRow[]
  labels: QueryLabels
  onChange: (rows: ConditionRow[]) => void
}) {
  const replace = (index: number, row: ConditionRow) =>
    onChange(rows.map((existing, position) => (position === index ? row : existing)))

  const add = () =>
    onChange([
      ...rows,
      {
        attribute: attributes[0]?.name ?? "",
        operator: operators[0]?.spelling ?? "equals",
        value: "",
        includeMissing: false,
      },
    ])

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noConditions}</p> : null}

      {rows.map((row, index) => (
        <BuilderRow
          key={index}
          attributes={attributes}
          operators={operators}
          row={row}
          labels={labels}
          onChange={(changed) => replace(index, changed)}
          onRemove={() => onChange(rows.filter((_, position) => position !== index))}
        />
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} disabled={attributes.length === 0}>
        <Plus className="size-4" />
        {labels.addCondition}
      </Button>
    </div>
  )
}

function BuilderRow({
  attributes,
  operators,
  row,
  labels,
  onChange,
  onRemove,
}: {
  attributes: QueryAttribute[]
  operators: QueryOperator[]
  row: ConditionRow
  labels: QueryLabels
  onChange: (row: ConditionRow) => void
  onRemove: () => void
}) {
  const attribute = attributes.find((candidate) => candidate.name === row.attribute)
  const operator = operators.find((candidate) => candidate.spelling === row.operator)
  const written = row.value === null || row.value === undefined ? "" : String(row.value)

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={row.attribute} onValueChange={(name) => onChange({ ...row, attribute: name })}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={labels.field} />
          </SelectTrigger>
          <SelectContent>
            {attributes.map((candidate) => (
              <SelectItem key={candidate.name} value={candidate.name}>
                {candidate.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={row.operator} onValueChange={(spelling) => onChange({ ...row, operator: spelling })}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((candidate) => (
              <SelectItem key={candidate.spelling} value={candidate.spelling}>
                {wordFor(labels, candidate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/*
          ⚠️ The product's OWN control where it has one. Filtering a select is that same select with an
          operator beside it, and drawing a parallel free-text box would let somebody filter on a value
          the field cannot hold — and then wonder why nothing matches.
        */}
        {operator?.needsValue ? (
          attribute && attribute.options.length > 0 ? (
            <Select value={written} onValueChange={(value) => onChange({ ...row, value })}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={labels.value} />
              </SelectTrigger>
              <SelectContent>
                {attribute.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="w-[220px]"
              value={written}
              placeholder={labels.value}
              onChange={(event) => onChange({ ...row, value: event.target.value })}
            />
          )
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={labels.removeCondition}
        >
          <X className="size-4" />
        </Button>
      </div>

      {operator?.negative ? (
        <div className="flex items-center gap-2 pl-1">
          <Switch
            id={`missing-${row.attribute}-${row.operator}`}
            checked={row.includeMissing}
            onCheckedChange={(includeMissing) => onChange({ ...row, includeMissing })}
          />
          <Label
            htmlFor={`missing-${row.attribute}-${row.operator}`}
            className="text-xs font-normal text-muted-foreground"
          >
            {labels.includeMissing}
          </Label>
        </div>
      ) : null}

      {attribute?.converter && operator?.ordered ? (
        <p className="pl-1 text-xs text-muted-foreground">{labels.converterNote(attribute.converter)}</p>
      ) : null}
    </div>
  )
}
