import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppearanceProvider, standardThemes } from "@jmouse/ui-kit"
import "@jmouse/ui-kit/styles.css"
import { burinDefaults, burinStoragePrefix } from "./appearance"
import { EditorScreen } from "./EditorScreen"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppearanceProvider storagePrefix={burinStoragePrefix} themes={standardThemes} defaults={burinDefaults}>
      <EditorScreen />
    </AppearanceProvider>
  </StrictMode>,
)
