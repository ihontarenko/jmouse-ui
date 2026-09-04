import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, Ban } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  NativeSelect,
  Textarea,
} from "@jmouse/ui"
import { formatBytes } from "./fileDisplay"
import {
  UPLOAD_CONFIGURATION,
  type AcceptanceMode,
  type DirectoryConfiguration,
  type DirectoryDetail,
  type EffectiveUploadRule,
  type FileLibraryPort,
  type FileManagerNotice,
} from "./types"

/**
 * What a folder accepts — set here, or inherited from above.
 *
 * <h2>⚠️ The origin is the first thing on the screen, and that is not decoration</h2>
 *
 * <p>From below, an inherited rule and a folder's own look identical. Somebody about to loosen a rule
 * has to be told whether they are about to change <em>this</em> folder or discover that they are looking
 * at one three levels up — the second is a folder they may not even have meant to touch.</p>
 *
 * <h2>⚠️ It warns; it never refuses</h2>
 *
 * <p>The library reserves no file type. A folder may be told to admit <code>.svg</code>,
 * <code>.html</code>, <code>.exe</code> — that was decided deliberately, on the reading that what closes
 * a dangerous branch is <em>access</em> rather than acceptance. So the warning below is
 * <strong>information</strong>: it says what the rule admits and leaves the decision where it belongs.
 * Do not turn it into a block, and do not word it as an error.</p>
 *
 * <h2>⚠️ Clearing is a first-class action, not a tidy-up</h2>
 *
 * <p>A rule that can be set and not removed is a one-way door on every folder anybody ever touches.
 * "Clear" returns the folder to inheriting, which is genuinely no row at all rather than an empty one.</p>
 *
 * <h2>⚠️ Lists are edited as text, one per line</h2>
 *
 * <p>Sixty extensions is a paste from somewhere, not sixty chips typed one at a time. The backend
 * normalises what arrives — lower-cases, strips a leading dot, drops content-type parameters — and this
 * dialog re-reads what came back rather than showing what was typed, so the difference is visible
 * immediately instead of at somebody's next upload.</p>
 */
export function DirectoryConfigurationDialog({
  directoryId,
  directoryName,
  port,
  open,
  onOpenChange,
  onChanged,
  onNotice,
}: {
  /** The folder to configure, or null when the dialog is closed. */
  directoryId: string | null
  directoryName: string
  port: FileLibraryPort
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
  onNotice?: FileManagerNotice
}) {
  const [detail, setDetail] = useState<DirectoryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<AcceptanceMode>("DENYLIST")
  const [contentTypes, setContentTypes] = useState("")
  const [extensions, setExtensions] = useState("")
  const [maximumSize, setMaximumSize] = useState("")

  useEffect(() => {
    if (!open || !directoryId || !port.directoryDetail) {
      return
    }

    let current = true

    setLoading(true)

    port
      .directoryDetail(directoryId)
      .then((answer) => {
        if (!current) {
          return
        }

        setDetail(answer)
        fillFrom(uploadRuleOf(answer))
      })
      .catch(() => onNotice?.("That folder's rules could not be read."))
      .finally(() => current && setLoading(false))

    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, directoryId])

  function fillFrom(rule: EffectiveUploadRule | null) {
    setMode(rule?.mode ?? "DENYLIST")
    setContentTypes(linesOf(rule?.contentTypes))
    setExtensions(linesOf(rule?.extensions))
    setMaximumSize("")
  }

  function save() {
    if (!directoryId || !port.writeDirectoryConfiguration) {
      return
    }

    setSaving(true)

    port
      .writeDirectoryConfiguration(directoryId, UPLOAD_CONFIGURATION, {
        mode,
        contentTypes: valuesOf(contentTypes),
        extensions: valuesOf(extensions),
        // ⚠️ Absent rather than zero: a folder may widen the lists and keep the installation's limit,
        // and a zero here would be read as a limit of no bytes at all.
        maxSizeBytes: megabytesToBytes(maximumSize),
      })
      .then(() => refresh())
      .then(onChanged)
      .catch(() => onNotice?.("That rule was not saved."))
      .finally(() => setSaving(false))
  }

  function clear() {
    if (!directoryId || !port.clearDirectoryConfiguration) {
      return
    }

    setSaving(true)

    port
      .clearDirectoryConfiguration(directoryId, UPLOAD_CONFIGURATION)
      .then(() => refresh())
      .then(onChanged)
      .catch(() => onNotice?.("That rule was not cleared."))
      .finally(() => setSaving(false))
  }

  /** Re-read, so what is on the screen is what the backend actually stored. */
  function refresh() {
    if (!directoryId || !port.directoryDetail) {
      return Promise.resolve()
    }

    return port.directoryDetail(directoryId).then((answer) => {
      setDetail(answer)
      fillFrom(uploadRuleOf(answer))
    })
  }

  const configuration = detail?.configurations?.[UPLOAD_CONFIGURATION] as
    | DirectoryConfiguration<EffectiveUploadRule>
    | undefined
  const rule = configuration?.effective ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>What “{directoryName}” accepts</DialogTitle>
          <DialogDescription>
            A folder’s rule replaces the installation’s for everything filed into it, and for every
            folder beneath it that has none of its own.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading the rule that applies here…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Origin configuration={configuration} />

            {rule?.admitsActiveContent && (
              <Notice
                icon={<AlertTriangle className="size-4 shrink-0" aria-hidden="true" />}
                tone="warning"
              >
                This rule admits content that runs in a browser — HTML, SVG, XML. Those are always served
                as a download rather than rendered, so who may <em>read</em> this folder is what closes
                it.
              </Notice>
            )}

            {rule?.admitsNothing && (
              <Notice icon={<Ban className="size-4 shrink-0" aria-hidden="true" />} tone="muted">
                Nothing at all can be uploaded here — an allow-list that lists nothing. That is a valid
                read-only shelf, and it is worth being sure it is what you meant.
              </Notice>
            )}

            <div className="grid gap-2">
              <Label htmlFor="acceptance-mode">These lists</Label>
              <NativeSelect
                id="acceptance-mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as AcceptanceMode)}
              >
                <option value="DENYLIST">Refuse what is listed — accept everything else</option>
                <option value="ALLOWLIST">Accept only what is listed</option>
              </NativeSelect>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="acceptance-extensions">Extensions</Label>
                <Textarea
                  id="acceptance-extensions"
                  rows={6}
                  className="font-mono text-xs"
                  placeholder={"kicad_pro\nkicad_pcb\ngbr\nzip"}
                  value={extensions}
                  onChange={(event) => setExtensions(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">One per line, without the dot.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="acceptance-types">Content types</Label>
                <Textarea
                  id="acceptance-types"
                  rows={6}
                  className="font-mono text-xs"
                  placeholder={"application/zip\nimage/png"}
                  value={contentTypes}
                  onChange={(event) => setContentTypes(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  One per line. Checked separately from the extension — a client controls both.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acceptance-size">Largest file, in MB</Label>
              <input
                id="acceptance-size"
                type="number"
                min={1}
                inputMode="numeric"
                className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm tabular-nums"
                placeholder={rule ? String(Math.round(rule.maxSizeBytes / 1024 / 1024)) : ""}
                value={maximumSize}
                onChange={(event) => setMaximumSize(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave it empty to keep the installation’s limit
                {rule ? ` — ${formatBytes(rule.maxSizeBytes)}` : ""}.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {/* ⚠️ Only where the folder carries a row of its own. On an inherited rule there is nothing
              here to clear, and offering it would suggest this screen can unset somebody else's. */}
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={saving || loading || !configuration?.own}
            onClick={clear}
          >
            Clear — go back to inheriting
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Close
            </Button>
            <Button onClick={save} disabled={saving || loading}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save for this folder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Where the rule on this screen actually comes from.
 *
 * ⚠️ The path, not merely the word "inherited" — a person has to be told which folder they would be
 * changing if they went there.
 */
function Origin({ configuration }: { configuration?: DirectoryConfiguration<EffectiveUploadRule> }) {
  if (!configuration) {
    return null
  }

  if (configuration.origin === "SELF") {
    return (
      <p className="text-sm">
        <Badge variant="secondary">Set here</Badge>{" "}
        <span className="text-muted-foreground">
          This folder states its own rule. Everything beneath it inherits this unless it says otherwise.
        </span>
      </p>
    )
  }

  if (configuration.origin === "INHERITED") {
    return (
      <p className="text-sm">
        <Badge variant="outline">Inherited</Badge>{" "}
        <span className="text-muted-foreground">
          from <code className="font-mono text-xs">{configuration.originPath}</code>. Saving here gives
          this folder a rule of its own, which replaces that one for everything below.
        </span>
      </p>
    )
  }

  return (
    <p className="text-sm">
      <Badge variant="outline">Installation default</Badge>{" "}
      <span className="text-muted-foreground">
        No folder above this one has an opinion, so the installation’s own rule applies.
      </span>
    </p>
  )
}

function Notice({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode
  tone: "warning" | "muted"
  children: React.ReactNode
}) {
  const toneClassName =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      : "border-border bg-muted/40 text-muted-foreground"

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-xs ${toneClassName}`}>
      {icon}
      <span>{children}</span>
    </div>
  )
}

function uploadRuleOf(detail: DirectoryDetail): EffectiveUploadRule | null {
  const configuration = detail.configurations?.[UPLOAD_CONFIGURATION] as
    | DirectoryConfiguration<EffectiveUploadRule>
    | undefined

  return configuration?.effective ?? null
}

function linesOf(values?: string[]): string {
  return [...(values ?? [])].sort().join("\n")
}

function valuesOf(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function megabytesToBytes(text: string): number | null {
  const megabytes = Number(text.trim())

  return text.trim() && Number.isFinite(megabytes) && megabytes > 0
    ? Math.round(megabytes * 1024 * 1024)
    : null
}
