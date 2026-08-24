/**
 * Choosing a face — the whole dialog, minus everything only a product can know.
 *
 * Two sources in one dialog, because they are one decision: somebody opens this wanting to stop being
 * two grey letters and does not care which mechanism gets them there. Splitting them into separate
 * screens would make picking a generated face feel like a lesser path to the "real" feature, when for
 * most people it is the whole feature.
 *
 * ⚠️ **This component never calls an API.** It reports what was chosen and lets the product save it —
 * three products have three routes, three error shapes and three cache invalidations, and a dialog that
 * knew any of them would be a dialog that could not be shared. The picture source is a slot for the
 * same reason: the cropper belongs to whoever owns the upload.
 */

import { useEffect, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@jmouse/ui"

import { AvatarPicker } from "./AvatarPicker"

/** What the person settled on. The product turns this into whichever call it makes. */
export type AvatarChoice =
  | { kind: "generated"; token: string }
  | { kind: "picture" }
  | { kind: "initials" }

/** Every string the dialog shows, so a product with its own translation layer can supply them. */
export interface AvatarPickerLabels {
  title: string
  description: string
  generatedTab: string
  pictureTab: string
  useInitials: string
  cancel: string
  save: string
}

const DEFAULT_LABELS: AvatarPickerLabels = {
  title: "Your face",
  description: "Pick a generated face and make it yours, or upload a picture.",
  generatedTab: "Generated",
  pictureTab: "Your own picture",
  useInitials: "Use my initials",
  cancel: "Cancel",
  save: "Save",
}

export interface AvatarPickerDialogProperties {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the generated half opens on — a name, a username, an address. */
  seedHint?: string
  /** The token already stored, so re-opening shows what is in force rather than a fresh face. */
  value?: string | null
  /**
   * The product's own picture source: a file input, a cropper, whatever it uses.
   *
   * Omit it and the dialog offers generated faces only — which is the right shape for a product that
   * has no file storage yet.
   */
  pictureSource?: ReactNode
  /** Whether the picture source has something ready to save. Ignored when there is no picture source. */
  pictureReady?: boolean
  /** Whether a save is in flight. The product owns the call, so it owns the spinner. */
  saving?: boolean
  onSubmit: (choice: AvatarChoice) => void
  labels?: Partial<AvatarPickerLabels>
}

type Source = "generated" | "picture"

export function AvatarPickerDialog({
  open,
  onOpenChange,
  seedHint,
  value = null,
  pictureSource,
  pictureReady = false,
  saving = false,
  onSubmit,
  labels,
}: AvatarPickerDialogProperties) {
  const copy = { ...DEFAULT_LABELS, ...labels }

  const [source, setSource] = useState<Source>("generated")
  const [token, setToken] = useState<string | null>(value)

  // Re-open clean. A dialog that remembers what was half-chosen last time offers a stale answer to a
  // question that has since been answered.
  useEffect(() => {
    if (open) {
      setSource("generated")
      setToken(value)
    }
  }, [open, value])

  const canSave = source === "generated" ? token !== null : pictureReady

  const save = () => {
    if (source === "generated" && token) {
      onSubmit({ kind: "generated", token })
      return
    }

    if (source === "picture") {
      onSubmit({ kind: "picture" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        ⚠️ **Bounded, and both halves are load-bearing.** A strategy strip, a control panel, a grid of
        thirty-two faces and a footer is precisely a dialog whose body can grow past the window, and each
        half of the fix alone is its own bug: `max-h` with nothing scrolling inside CLIPS SILENTLY — the
        footer is simply gone and no scrollbar appears, so the button that finishes the task cannot be
        reached. Scrolling with no `max-h` never triggers, and the dialog centres itself on something
        taller than the screen with its own title off the top edge, while Radix locks the page behind it.

        ⚠️ `svh`, not `vh`: on a phone `vh` measures the LARGEST viewport — chrome retracted — so 85vh is
        taller than the screen actually showing it whenever the address bar is visible, which is most of
        the time.
      */}
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {pictureSource ? (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="tablist">
            <SourceTab active={source === "generated"} onSelect={() => setSource("generated")}>
              {copy.generatedTab}
            </SourceTab>
            <SourceTab active={source === "picture"} onSelect={() => setSource("picture")}>
              {copy.pictureTab}
            </SourceTab>
          </div>
        ) : null}

        {/*
          ⚠️ Both panels stay mounted and the inactive one is hidden, rather than one being swapped for
          the other. The picture panel is the product's, and it holds a half-cropped image and a
          cropper ref; unmounting it on a tab switch throws that away and the person has to choose the
          file again.
        */}
        {/*
          ⚠️ `min-h-0` is not decoration. A flex child defaults to `min-height: auto` and refuses to
          shrink below its content, so `flex-1 overflow-y-auto` without it grows the dialog instead of
          scrolling inside it — the exact bug the bounding above exists to prevent, wearing the clothes
          of the fix. The negative margin cancels the padding, which is there so a focus ring on a
          control flush against the edge is not shaved off by the scroll container.
        */}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <div className={cn(source === "generated" ? "block" : "hidden")}>
            <AvatarPicker value={token} onChange={setToken} seedHint={seedHint} />
          </div>

          {pictureSource ? (
            <div className={cn(source === "picture" ? "block" : "hidden")}>{pictureSource}</div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => onSubmit({ kind: "initials" })}
          >
            {copy.useInitials}
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={save} disabled={!canSave || saving}>
              {/* ⚠️ A disabled button says "not now"; a spinner says "working". Losing this in the port
                  would have made every slow save look like a dead button. */}
              {saving && <Loader2 className="size-4 animate-spin" />}
              {copy.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One of the two source tabs.
 *
 * ⚠️ A plain button rather than Radix Tabs: the two panels are not interchangeable content, they are
 * two answers to one question, and Radix unmounts the panel it is not showing — which would throw away
 * a half-cropped picture every time somebody glanced at the other tab.
 */
function SourceTab({
  active,
  onSelect,
  children,
}: {
  active: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "rounded-sm px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
