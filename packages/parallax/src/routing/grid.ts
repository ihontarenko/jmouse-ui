/** The sheet's grid step: every part, pin and wire corner stands on it. */
export const GRID = 20;

/** A coordinate moved to the nearest grid line. */
export const snap = (value: number) => Math.round(value / GRID) * GRID;

/** The key a wire names one of a part's pins by: the part's id and the pin's name. */
export const portKey = (id: string, name: string) => `${id}:${name}`;

/** A pin's key read back into the part's id and the pin's name. */
export const parsePort = (key: string) => {
  const separator = key.indexOf(":");
  return { id: key.slice(0, separator), name: key.slice(separator + 1) };
};
