import { createContext, useContext } from "react";
import { DEFAULT_EMULATOR_APPEARANCE } from "@jmouse/parallax/circuit";
import type { EmulatorAppearance, ParallaxOwner } from "@jmouse/parallax";

/** What the host decides for the components it shows: where computations run, what a viewport must keep up, how current looks. */
export interface ParallaxSettings {
  /** The owner a queued computation runs for — the host's word, a workspace in Parallax; `null` runs it unowned. */
  computationOwner: ParallaxOwner | null;
  /** Frames per second a viewport must keep before what adds to the drawing may be raised; 0 turns the guard off. */
  minimumFrameRate: number;
  /** How the emulator draws current, glow and leads, as the reader chose it. */
  emulatorAppearance: EmulatorAppearance;
}

const DEFAULT_SETTINGS: ParallaxSettings = {
  computationOwner: null,
  minimumFrameRate: 0,
  emulatorAppearance: DEFAULT_EMULATOR_APPEARANCE,
};

const Settings = createContext<ParallaxSettings>(DEFAULT_SETTINGS);

/** Hands the components the host's choices; without it they compute unowned, never hold a drawing back, and draw current as shipped. */
export const ParallaxSettingsProvider = Settings.Provider;

export function useParallaxSettings(): ParallaxSettings {
  return useContext(Settings);
}
