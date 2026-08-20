import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Joins class names and resolves Tailwind conflicts, so a caller's `className` always wins over a
 * component's own defaults. Every primitive in this package composes its classes through it.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
