import { Segmented } from "../controls/Segmented";

const materials = [
  { value: "surface", label: "Fill" },
  { value: "wireframe", label: "Wireframe" },
] as const;

export function MaterialSwitcher({
  value,
  onChange,
  wireLabel = "Wireframe",
  order = "surface-first",
}: {
  value: "surface" | "wireframe";
  onChange: (material: "surface" | "wireframe") => void;
  wireLabel?: string;
  order?: "surface-first" | "wire-first";
}) {
  const labelled = materials.map((material) => (material.value === "wireframe" ? { ...material, label: wireLabel } : material));
  const ordered = order === "surface-first" ? labelled : [...labelled].reverse();
  return <Segmented small label="Material" options={ordered} value={value} onChange={onChange} />;
}
