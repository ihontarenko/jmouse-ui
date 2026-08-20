"use client"

import * as React from "react"

import { cn } from "../lib/helpers"

export type TableVariant = "default" | "compact"

// "default" ports Innoventa's real shared table (src/ui.module.css .tableCard/.table) exactly — its
// tokens resolve 1:1 onto this app's own shadcn variables (see index.css's mapping comment):
// line→border, paper-2→sidebar (header row fill), card-2→muted (row hover), ink-2→secondary-foreground
// (header text). "compact" is the denser second-pass style this component carried before (h-8/
// text-[11px] header, px-2.5/py-1 cells) — Ivan asked to keep it available under this name for pages
// like Central's AI Providers, which uses it explicitly via variant="compact".
const TableVariantContext = React.createContext<TableVariant>("default")

function Table({
  className,
  variant = "default",
  ...properties
}: React.ComponentProps<"table"> & { variant?: TableVariant }) {
  return (
    <TableVariantContext.Provider value={variant}>
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto rounded-md border"
      >
        <table
          data-slot="table"
          className={cn(
            "w-full caption-bottom",
            variant === "compact" ? "text-[13px]" : "text-[12.5px]",
            className
          )}
          {...properties}
        />
      </div>
    </TableVariantContext.Provider>
  )
}

function TableHeader({ className, ...properties }: React.ComponentProps<"thead">) {
  const variant = React.useContext(TableVariantContext)

  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", variant === "default" && "bg-sidebar", className)}
      {...properties}
    />
  )
}

function TableBody({ className, ...properties }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...properties}
    />
  )
}

function TableFooter({ className, ...properties }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...properties}
    />
  )
}

function TableRow({ className, ...properties }: React.ComponentProps<"tr">) {
  const variant = React.useContext(TableVariantContext)

  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        variant === "default" ? "hover:bg-muted" : "hover:bg-muted/50",
        className
      )}
      {...properties}
    />
  )
}

function TableHead({ className, ...properties }: React.ComponentProps<"th">) {
  const variant = React.useContext(TableVariantContext)

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-left align-middle whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        variant === "default"
          ? "px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.02em] text-secondary-foreground"
          : "h-8 px-2.5 text-[11px] font-medium",
        className
      )}
      {...properties}
    />
  )
}

function TableCell({ className, ...properties }: React.ComponentProps<"td">) {
  const variant = React.useContext(TableVariantContext)

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        variant === "default" ? "px-2.5 py-1.5" : "px-2.5 py-1",
        className
      )}
      {...properties}
    />
  )
}

function TableCaption({
  className,
  ...properties
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...properties}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
