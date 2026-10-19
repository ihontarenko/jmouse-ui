import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppearanceProvider, ToastProvider } from "@jmouse/ui-kit"
import { showcaseStoragePrefix, showcaseThemes } from "./catalogue"
import { KitApp } from "./KitApp"
import "./showcase.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppearanceProvider storagePrefix={showcaseStoragePrefix} themes={showcaseThemes}>
      <ToastProvider>
        <KitApp />
      </ToastProvider>
    </AppearanceProvider>
  </StrictMode>,
)
