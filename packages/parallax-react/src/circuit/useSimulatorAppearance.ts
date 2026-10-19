import type { CSSProperties } from "react";
import type { CurrentColor, SimulatorAppearance } from "@jmouse/parallax";
import { CURRENT_COLORS, DEFAULT_SIMULATOR_APPEARANCE } from "@jmouse/parallax/circuit";
import { useParallaxSettings } from "../providers/ParallaxSettings";

/*
 * The simulator's appearance as the host hands it over (`ParallaxSettingsProvider` — Parallax keeps it on the reader's
 * account), and as the sheet's layers read it: custom properties for the flow and the glow. Without a host's choice it
 * is drawn as it always was.
 */

export function useSimulatorAppearance(): SimulatorAppearance {
  return useParallaxSettings().simulatorAppearance;
}

const tokenOf = (color: CurrentColor) => (CURRENT_COLORS.find((choice) => choice.value === color) ?? CURRENT_COLORS[0]).token;

/**
 * The colours of current, flowing and alternating, as the custom properties the flow layer's paths read — and how the
 * two rows of an alternating wire run: a spot a third of the spacing, one spacing apart, at a calm 22 units a second.
 */
export function flowStyle(appearance: SimulatorAppearance): CSSProperties {
  const alternatingColor = appearance.alternatingColor ?? DEFAULT_SIMULATOR_APPEARANCE.alternatingColor;
  const returnColor = appearance.alternatingReturnColor ?? DEFAULT_SIMULATOR_APPEARANCE.alternatingReturnColor;
  const period = appearance.lightSpacing;
  const spot = Math.round(period / 3);
  return { "--parallax-flow-color": tokenOf(appearance.currentColor),
    "--parallax-flow-alternating-color": tokenOf(alternatingColor),
    "--parallax-flow-alternating-return-color": tokenOf(returnColor === "SAME" ? alternatingColor : returnColor),
    "--parallax-alternating-period": `${period}`,
    "--parallax-alternating-dash": `${spot} ${period - spot}`,
    "--parallax-alternating-duration": `${Math.round(period * 45)}ms` } as CSSProperties;
}

/** The colours of the glow behind parts — taking power, giving it back — as the custom properties the heat layer reads. */
export function glowStyle(appearance: SimulatorAppearance): CSSProperties {
  return { "--parallax-glow-taking-color": tokenOf(appearance.takingColor), "--parallax-glow-giving-color": tokenOf(appearance.givingColor) } as CSSProperties;
}
