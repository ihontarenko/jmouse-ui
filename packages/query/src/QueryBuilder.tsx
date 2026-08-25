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
 * ## ⚠️ The rows SAY they are conjoined
 *
 * Every row is led by a word — `Where`, then `and` for each one after it — and the whole set is one
 * bordered list with rules between the rows rather than a stack of separate cards. Both halves of that
 * are the same fix: a card is a thing on its own, and three selects on a card of their own read as an
 * independent statement. Nothing on the old screen said whether a second condition narrowed the result
 * or widened it, which is the one question a filter must never leave open.
 *
 * It is also what made the panel fit: a card each, at `p-3`, cost about forty pixels per condition over
 * a list — in a panel that opens **over** the rows it is filtering.
 *
 * ## ⚠️ *"and those with no such field?"* stays ON the row
 *
 * A negative test excludes rows that have no such value at all — three-valued logic, which is correct
 * and surprising every single time. The question belongs where the person is already thinking about it.
 * It is a pressed-state chip rather than a switch and a sentence on a second line: the sentence is the
 * chip's title, so the explanation is a hover away instead of a row away.
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

  const addButton = (
    <Button type="button" variant="outline" size="sm" onClick={add} disabled={attributes.length === 0}>
      <Plus className="size-4" />
      {labels.addCondition}
    </Button>
  )

  // ⚠️ The sentence and the button share a line. An empty builder is two facts — *this narrows nothing*
  // and *here is how to change that* — and stacking them spent a row on the state where there is least
  // to look at.
  if (rows.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{labels.noConditions}</p>
        {addButton}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card/40">
        {rows.map((row, index) => (
          <BuilderRow
            key={index}
            attributes={attributes}
            operators={operators}
            row={row}
            labels={labels}
            conjunction={index === 0 ? labels.firstCondition : labels.nextCondition}
            onChange={(changed) => replace(index, changed)}
            onRemove={() => onChange(rows.filter((_, position) => position !== index))}
          />
        ))}
      </div>

      {addButton}
    </div>
  )
}

function BuilderRow({
  attributes,
  operators,
  row,
  labels,
  conjunction,
  onChange,
  onRemove,
}: {
  attributes: QueryAttribute[]
  operators: QueryOperator[]
  row: ConditionRow
  labels: QueryLabels
  conjunction: string
  onChange: (row: ConditionRow) => void
  onRemove: () => void
}) {
  const attribute = attributes.find((candidate) => candidate.name === row.attribute)
  const operator = operators.find((candidate) => candidate.spelling === row.operator)
  const written = row.value === null || row.value === undefined ? "" : String(row.value)

  return (
    <div className="px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* ⚠️ A fixed width, so the fields line up in a column however long the two words are — a
            leading word that pushed each row's first select to a different place would read as a
            worse mess than the one it replaced. */}
        <span className="w-11 shrink-0 truncate text-right text-xs font-medium text-muted-foreground">
          {conjunction}
        </span>

        <Select value={row.attribute} onValueChange={(name) => onChange({ ...row, attribute: name })}>
          <SelectTrigger size="sm" className="w-[190px]">
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
          <SelectTrigger size="sm" className="w-[155px]">
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
              <SelectTrigger size="sm" className="w-[190px]">
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
              size="sm"
              className="w-[190px]"
              value={written}
              placeholder={labels.value}
              onChange={(event) => onChange({ ...row, value: event.target.value })}
            />
          )
        ) : null}

        {/* ⚠️ A switch, not a chip that looks like a caption. It was a ghost button carrying the short
            words, and with nothing drawn around them they read as a note about the row rather than as
            something to press — the one state a control must never be in. */}
        {operator?.negative ? (
          <span className="inline-flex items-center gap-1.5 pl-1" title={labels.includeMissing}>
            <Switch
              id={`missing-${row.attribute}-${row.operator}`}
              checked={row.includeMissing}
              onCheckedChange={(includeMissing) => onChange({ ...row, includeMissing })}
            />
            <Label
              htmlFor={`missing-${row.attribute}-${row.operator}`}
              className={cn(
                "text-xs font-normal",
                row.includeMissing ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {labels.includeMissingShort}
            </Label>
          </span>
        ) : null}

        {/* ⚠️ `ml-auto` — the delete buttons form a column at the right edge rather than sitting wherever
            the row's widest control happens to end. A row missing its value field is not a row whose
            delete button should have moved. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={onRemove}
          aria-label={labels.removeCondition}
        >
          <X className="size-4" />
        </Button>
      </div>

      {attribute?.converter && operator?.ordered ? (
        <p className="mt-1.5 pl-[3.25rem] text-xs text-muted-foreground">
          {labels.converterNote(attribute.converter)}
        </p>
      ) : null}
    </div>
  )
}
