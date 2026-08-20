import { useState } from "react"
import { Check, Copy, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { Button } from "@jmouse/ui"
import type { FileLibraryPort, FileManagerNotice, ManagedFile } from "./types"

/**
 * The four things that can be done to a file, shared by both layouts.
 *
 * ⚠️ **The rename draft and the delete confirmation live HERE, not in each layout.** Rows and tiles are
 * two drawings of the same list, and a second copy of this state is a second place for it to drift —
 * which is exactly how a row could end up renaming while its tile still showed the old name.
 *
 * ⚠️ **It calls the port and reports through a callback**, rather than owning a query client and a toast
 * library. Both would be choices made on behalf of three products; `onChanged` is where the caller
 * refetches whatever it keeps, and `onNotice` is where it says so.
 */
export function useFileActions({
  port,
  onChanged,
  onNotice,
}: {
  port: FileLibraryPort
  onChanged: () => void
  onNotice?: FileManagerNotice
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [confirming, setConfirming] = useState<string | null>(null)

  function startRename(file: ManagedFile) {
    setRenaming(file.id)
    setDraftName(file.name)
  }

  function submitRename(fileId: string) {
    const name = draftName.trim()

    setRenaming(null)

    if (!name) {
      return
    }

    port
      .renameFile(fileId, name)
      .then(onChanged)
      .catch(() => onNotice?.("That was not renamed."))
  }

  function remove(fileId: string) {
    setConfirming(null)

    port
      .deleteFile(fileId)
      .then(onChanged)
      .catch(() => onNotice?.("That was not deleted."))
  }

  return {
    renaming,
    draftName,
    setDraftName,
    startRename,
    submitRename,
    cancelRename: () => setRenaming(null),
    confirming,
    setConfirming,
    remove,
  }
}

export type FileActions = ReturnType<typeof useFileActions>

/**
 * ⚠️ **Icons rather than words, in both layouts.** "Open · Copy link · Rename · Delete" as four text
 * buttons is wider than a tile and wider than a row's spare width at any sensible list density. Each
 * keeps its `title`, so nothing is lost but the width.
 *
 * ⚠️ **Open and Copy appear only where the port names an address.** A product with no public route for
 * a file has nothing to open and nothing to copy, and a Copy button that yields a broken URL is worse
 * than no button.
 */
export function FileActionButtons({
  file,
  port,
  actions,
}: {
  file: ManagedFile
  port: FileLibraryPort
  actions: FileActions
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const openAt = port.openUrl?.(file) ?? null
  const shareAt = port.shareUrl?.(file) ?? null

  function copy(url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(file.id)
      // ⚠️ A timer rather than a transition end: the feedback is about the clipboard, which has no
      // event to hang it off, and two seconds is long enough to be seen and short enough not to lie.
      window.setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {openAt && (
        <Button variant="ghost" size="icon-xs" title="Open in the viewer" asChild>
          <a href={openAt} target="_blank" rel="noreferrer">
            <ExternalLink />
          </a>
        </Button>
      )}

      {shareAt && (
        <Button
          variant="ghost"
          size="icon-xs"
          title={copied === file.id ? "Copied" : "Copy the public link"}
          onClick={() => copy(shareAt)}
        >
          {copied === file.id ? <Check /> : <Copy />}
        </Button>
      )}

      <Button variant="ghost" size="icon-xs" title="Rename" onClick={() => actions.startRename(file)}>
        <Pencil />
      </Button>

      {actions.confirming === file.id ? (
        <Button variant="destructive" size="xs" title="Delete for good" onClick={() => actions.remove(file.id)}>
          Really
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Delete"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => actions.setConfirming(file.id)}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}
