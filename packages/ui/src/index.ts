/**
 * `@jmouse/ui` — the render layer three products share: shadcn/ui primitives, the class helper, the
 * theme mechanism, and the one hook the primitives need.
 *
 * ⚠️ Nothing in here knows a product's domain, and nothing carries a colour value. Access, AI, issues
 * and pages belong to `@jmouse/access-ui` / `@jmouse/ai-ui`; palettes belong to the product (or to
 * `@jmouse/ui/presets`, which is opt-in).
 */

export { cn } from "./lib/helpers"

export { useIsMobile } from "./hooks/use-mobile"

export {
  ThemeProvider,
  useTheme,
  type ThemeProviderProperties,
} from "./theme/ThemeProvider"
export {
  FONT_SCALE_VALUES,
  darkThemesOf,
  findTheme,
  lightThemesOf,
  type ContrastMode,
  type FontScale,
  type SeasonalEffect,
  type ThemeCategory,
  type ThemeDefinition,
  type ThemeMode,
} from "./theme/theming"

export * from "./components/alert"
export * from "./components/anchored"
export * from "./components/avatar"
export * from "./components/badge"
export * from "./components/breadcrumb"
export * from "./components/button"
export * from "./components/calendar"
export * from "./components/card"
export * from "./components/chart"
export * from "./components/collapsible"
export * from "./components/dialog"
export * from "./components/dropdown-menu"
export * from "./components/entity-card"
export * from "./components/form"
export * from "./components/input"
export * from "./components/label"
export * from "./components/popover"
export * from "./components/progress"
export * from "./components/scroll-area"
export * from "./components/select"
export * from "./components/separator"
export * from "./components/sheet"
export * from "./components/sidebar"
export * from "./components/skeleton"
export * from "./components/sonner"
export * from "./components/switch"
export * from "./components/table"
export * from "./components/tabs"
export * from "./components/textarea"
export * from "./components/tooltip"
