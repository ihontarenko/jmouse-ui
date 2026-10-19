/**
 * Hand a blob to the browser as a download.
 *
 * ⚠️ **From the BYTES already fetched, not from a URL, and that is what makes it library-side at all.**
 * Every file route in these products is authenticated, so an `<a href>` pointed at one downloads a 401
 * page under the right filename. The viewer has the blob in hand; saving it is then the same three lines
 * in every product, which is three places for the object URL to stop being revoked.
 *
 * ⚠️ **Revoked on the next tick rather than immediately.** Chrome starts the download asynchronously —
 * revoking in the same statement cancels it — and never revoking keeps every file ever downloaded alive
 * for the life of the tab.
 *
 * @param blob what to save
 * @param name what to call it
 */
export function saveBlob(blob: Blob, name: string): void {
  const address = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = address
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(address), 0)
}
