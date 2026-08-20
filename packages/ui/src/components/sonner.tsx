import { Loader2Icon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "../theme/ThemeProvider"
import { cn } from "../lib/helpers"

// Ports Innoventa's real, currently-mounted toast system (components/error/ToastProvider.tsx — the
// one main.tsx actually wires up, not the unused components/ui/Toast.tsx style-guide leftover):
// a 1px border + 4px colored left accent per severity, and a small outlined-circle glyph badge
// (✓ / ✕ / ! / i) rather than a filled icon. Colors key off this app's own semantic tokens
// (destructive/warning/success/primary) instead of Innoventa's literal hex values, so all 27 themes
// get the right color automatically instead of one hardcoded look.
function SeverityIcon({ symbol, colorClassName }: { symbol: string; colorClassName: string }) {
  return (
    <span
      className={cn(
        "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold",
        colorClassName
      )}
    >
      {symbol}
    </span>
  )
}

const Toaster = ({ ...properties }: ToasterProps) => {
  // shadcn generates this against next-themes by default — this app has never wired that up (it
  // has its own ThemeContext, see Moneta/UI/CLAUDE.md's Styling section), so the generated
  // `useTheme` always read a disconnected "system" fallback and toasts never actually followed the
  // app's real light/dark state. resolvedTheme/darkTheme come from the app's own context instead.
  const { resolvedTheme, darkTheme } = useTheme()
  const theme: ToasterProps["theme"] = resolvedTheme === darkTheme ? "dark" : "light"

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      // position/gap/offset port Innoventa's own .stackContainer exactly (bottom:72px, right:16px,
      // gap:8px — ToastProvider.module.css) since sonner's own defaults sit flush in the corner
      // with a tighter stack.
      position="bottom-right"
      gap={8}
      offset={{ bottom: 72, right: 16 }}
      icons={{
        success: <SeverityIcon symbol="✓" colorClassName="border-success text-success" />,
        info: <SeverityIcon symbol="i" colorClassName="border-primary text-primary" />,
        warning: <SeverityIcon symbol="!" colorClassName="border-warning text-warning" />,
        error: <SeverityIcon symbol="✕" colorClassName="border-destructive text-destructive-ink" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          // 13px/600 title + 11.5px muted description ports .title/.detail; shadow ports
          // .toastItem's `0 4px 24px rgba(0,0,0,0.14)`; border + border-l-4 ports .toastItem's
          // `border: 1px solid X; border-left: 4px solid X` — only the color differs per severity.
          toast: "border border-l-4 shadow-[0_4px_24px_rgba(0,0,0,0.14)]",
          title: "text-[13px] font-semibold",
          description: "text-[11.5px] text-muted-foreground",
          success: "border-success",
          error: "border-destructive",
          warning: "border-warning",
          info: "border-primary",
        },
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "10px",
          "--width": "min(380px, calc(100vw - 32px))",
        } as React.CSSProperties
      }
      {...properties}
    />
  )
}

export { Toaster }
