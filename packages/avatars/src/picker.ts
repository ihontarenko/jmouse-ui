/**
 * `@jmouse/avatars/picker` — the React half.
 *
 * A separate entry point so that the engine stays a leaf: a product that only has to *draw* an avatar
 * imports `@jmouse/avatars` and pays for no render layer at all. Everything here needs React, and the
 * dialog needs `@jmouse/ui` on top of it.
 *
 * ⚠️ **Nothing here calls an API.** The dialog reports a choice; the product saves it. Three products
 * have three routes, three error shapes and three cache invalidations, and a dialog that knew any of
 * them could not be shared — which is how there came to be three of it in the first place.
 */

export { Avatar, type AvatarProperties } from "./picker/Avatar"
export { AvatarPicker, type AvatarPickerProperties } from "./picker/AvatarPicker"
export {
  AvatarPickerDialog,
  type AvatarChoice,
  type AvatarPickerDialogProperties,
  type AvatarPickerLabels,
} from "./picker/AvatarPickerDialog"
export { ControlPanel, type ControlPanelProperties } from "./picker/ControlPanel"
export { StrategyStrip, type StrategyStripProperties } from "./picker/StrategyStrip"
export { VariantGrid, type VariantGridProperties } from "./picker/VariantGrid"
export { OPENING_SEED_COUNT, ROLL_SIZE, rollSeeds } from "./picker/seeds"
