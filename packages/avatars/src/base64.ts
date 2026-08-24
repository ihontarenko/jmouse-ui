/**
 * Base64 that survives a non-Latin string.
 *
 * ⚠️ **`btoa` throws on anything above U+00FF, and one of these controls takes free text.** Somebody
 * typing their initials in Cyrillic is the ordinary case, not the exotic one, so the parameters have to
 * go through UTF-8 on the way in and come back through it on the way out. The classic
 * `unescape(encodeURIComponent(…))` trick does the same job through two deprecated functions; this does
 * it through the encoder that exists for the purpose.
 */

/** UTF-8 bytes, one per character, so `btoa` sees only code points it can take. */
function toBinaryString(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return binary
}

function fromBinaryString(binary: string): string {
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new TextDecoder().decode(bytes)
}

export function encodeBase64(value: string): string {
  return btoa(toBinaryString(value))
}

export function decodeBase64(value: string): string {
  return fromBinaryString(atob(value))
}
