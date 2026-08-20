import { useEffect, useState, type RefObject } from "react"
import { fileKindOf } from "./fileKinds"
import type { FileLibraryPort, ManagedFile } from "./types"

/**
 * Real pictures in the list, for products whose files have no public address.
 *
 * <h2>⚠️ Why this is not simply an `&lt;img src&gt;`</h2>
 *
 * <p>Every file route in these products is authenticated. A browser-issued image request carries no
 * bearer token, so it answers 401 — and an `&lt;img&gt;` that 401s draws the broken-image frame, which
 * reads as *this file is damaged* rather than as *this needs a token*. Kiwi has the same problem from
 * the other end: its public path is real but answers 404 for any file no published page points at,
 * which is most of a cabinet. Either way the bytes have to be fetched by the product's own client and
 * held as an object URL.</p>
 *
 * <h2>⚠️ Three guards, and each one is a bill somebody would otherwise pay</h2>
 *
 * <ul>
 *   <li><strong>on screen only.</strong> A folder of two hundred photographs is two hundred downloads
 *       the moment it opens, all of them at full resolution for a 24px square. The observer means the
 *       ones nobody scrolls to are never asked for;
 *   <li><strong>a size ceiling.</strong> A 60 MB raw photograph decodes to hundreds of megabytes of
 *       bitmap, and the tile it is drawn into is nine rem wide. Over the ceiling the type's glyph is the
 *       better answer;
 *   <li><strong>a bounded cache.</strong> Switching between rows and tiles, or stepping into a folder
 *       and back, must not refetch — and an unbounded map of object URLs is a leak that only shows up
 *       in a long session. Oldest out, and <strong>revoked on the way out</strong>.
 * </ul>
 */

/** ⚠️ How many previews are held at once. Two full screens of tiles, so scrolling back is free. */
const CACHE_LIMIT = 60

/**
 * ⚠️ **A ceiling on the ORIGINAL, because there is no thumbnail to ask for.** These libraries store what
 * was uploaded; nothing resizes anything. Fetching the full image is acceptable for the ordinary
 * screenshot and absurd for a photograph out of a camera.
 */
export const MAXIMUM_PREVIEW_BYTES = 8 * 1024 * 1024

const cache = new Map<string, Promise<string | null>>()

/** ⚠️ Whether it is worth asking at all — see the ceiling above. */
export function canPreview(file: ManagedFile): boolean {
  return fileKindOf(file) === "image" && file.sizeBytes <= MAXIMUM_PREVIEW_BYTES
}

/**
 * An object URL for this file's bytes, fetched once and kept.
 *
 * ⚠️ **The PROMISE is cached, not the URL.** Two tiles of the same file mount in the same frame; caching
 * the result would let both of them start a fetch and one of the two object URLs would be leaked with
 * nothing left pointing at it.
 *
 * @param file what to draw
 * @param port how this product fetches
 * @return the address, or null when the bytes could not be had
 */
export function filePreview(file: ManagedFile, port: FileLibraryPort): Promise<string | null> {
  const held = cache.get(file.id)

  if (held) {
    return held
  }

  const fetching = port
    .bytes(file)
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => null)

  cache.set(file.id, fetching)
  evictWhileOverLimit()

  return fetching
}

function evictWhileOverLimit(): void {
  while (cache.size > CACHE_LIMIT) {
    // ⚠️ A `Map` iterates in insertion order, so the first key is the oldest. Nothing else here has to
    // keep a timestamp.
    const oldest = cache.keys().next().value as string | undefined

    if (!oldest) {
      return
    }

    const going = cache.get(oldest)

    cache.delete(oldest)

    // ⚠️ Revoked once it settles, never before: the fetch may still be in flight, and revoking an
    // address an `<img>` has already been given blanks a picture that was about to appear.
    void going?.then((address) => {
      if (address) {
        URL.revokeObjectURL(address)
      }
    })
  }
}

/**
 * Whether an element is anywhere near the viewport.
 *
 * ⚠️ **200px of margin, so a picture is already there by the time it is scrolled to.** Fetching at the
 * exact moment of entry is what makes a grid flash grey squares on every flick.
 *
 * ⚠️ **It stops observing once the answer is yes.** A preview is fetched once; carrying on watching an
 * element for the life of the list is an observer per row for no further decision.
 */
export function useOnScreen(target: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const element = target.current

    if (!element || seen) {
      return
    }

    // ⚠️ Guarded, because this package is rendered in test environments that have no observer at all —
    // and there the honest answer is "yes, draw it" rather than a crash.
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true)

      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
        }
      },
      { rootMargin: "200px" },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [target, seen])

  return seen
}

/**
 * The picture for one file, fetched through the port when it is worth doing and wanted.
 *
 * @param file what to draw
 * @param port how this product fetches
 * @param wanted whether to ask at all — false while the element is off screen, or while a public
 *        address is still being tried
 * @return the object URL, or null while there is none
 */
export function useFilePreview(
  file: ManagedFile,
  port: FileLibraryPort,
  wanted: boolean,
): string | null {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    if (!wanted || !canPreview(file)) {
      return
    }

    let stale = false

    void filePreview(file, port).then((found) => {
      if (!stale) {
        setAddress(found)
      }
    })

    return () => {
      stale = true
    }
    // ⚠️ Keyed on the ID rather than on the object: the list refetches after every change, so the file
    // is a new object with the same bytes several times a minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, port, wanted])

  return address
}
