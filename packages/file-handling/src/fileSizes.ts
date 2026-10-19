/**
 * Bytes, as somebody reads them.
 *
 * @param bytes how many
 * @return a short human-readable size
 */
export function readableFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"]

  let size = bytes / 1024
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`
}
