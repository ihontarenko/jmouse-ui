import { formatQuantity } from "@jmouse/parallax/quantities";
import { Formula } from "./Formula";
import { Facts } from "../support/feedback";
import { partition, type Dataset, type FeaturePointsDataset, type PanelDataset } from "@jmouse/parallax/visual";

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const magnitude = Math.abs(value);
  const text = magnitude !== 0 && (magnitude >= 1e5 || magnitude < 1e-3) ? value.toExponential(3) : Number(value.toFixed(4)).toString();
  return text.replace("-", "−");
}

function PanelPart({ name, dataset }: { name: string; dataset: PanelDataset }) {
  if (dataset.format === "SYMBOLIC") {
    return (
      <div className="parallax-dataset-symbolic">
        {Object.entries(dataset.latex).map(([key, latex]) => (
          <div key={key} className="parallax-dataset-symbolic-row">
            <span className="parallax-technical-label">{key}</span>
            <Formula latex={latex} />
          </div>
        ))}
      </div>
    );
  }
  if (dataset.format === "MEASUREMENTS") {
    // A measurement is named as the circuit names it — RL, U1.output, sense —, never reworded.
    const row = ([key, value]: [string, number]) => [
      dataset.notes[key] ? <abbr title={dataset.notes[key]}>{key}</abbr> : <span className="parallax-monospace">{key}</span>,
      <span className="parallax-monospace">{dataset.units?.[key] ? formatQuantity(value, dataset.units[key]) : formatNumber(value)}</span>,
    ] as const;
    const groups = measurementGroups(dataset.values, dataset.units ?? {});
    if (groups.length < 2) {
      return <Facts rows={Object.entries(dataset.values).map(row)} />;
    }
    // Grouped by what they measure, side by side: an operating point reads as voltages, currents and powers.
    return (
      <div data-parallax-part="measurement-groups" className="parallax-measurement-groups">
        {groups.map(([heading, entries]) => (
          <section key={heading} aria-label={heading}>
            <h4 className="parallax-technical-label">{heading}</h4>
            <Facts rows={entries.map(row)} />
          </section>
        ))}
      </div>
    );
  }
  return (
    <>
      <Facts
        rows={[
          ["Size", `${dataset.rows} × ${dataset.columns}`],
          ["Determinant", <span className="parallax-monospace">{formatNumber(dataset.determinant)}</span>],
          ["Rank", <span className="parallax-monospace">{dataset.rank}</span>],
          ["Trace", <span className="parallax-monospace">{formatNumber(dataset.trace)}</span>],
          ...dataset.eigenpairs.map(
            (pair, index) =>
              [
                `λ${index + 1}`,
                <span className="parallax-monospace">
                  {formatNumber(pair.real)}
                  {pair.imaginary ? ` ${pair.imaginary < 0 ? "−" : "+"} ${formatNumber(Math.abs(pair.imaginary))}i` : ""}
                </span>,
              ] as const,
          ),
          ["σ", <span className="parallax-monospace">{dataset.singularValues.map(formatNumber).join(" · ")}</span>],
        ]}
      />
      <span className="parallax-screen-reader-only">{name}</span>
    </>
  );
}

const UNIT_HEADINGS: Record<string, string> = { V: "Voltages", A: "Currents", W: "Power", Hz: "Frequencies", "Ω": "Resistances" };

/** The measurements grouped by unit, in the order the units first appear; a value without a unit goes last. */
function measurementGroups(values: Record<string, number>, units: Record<string, string>): [string, [string, number][]][] {
  const groups = new Map<string, [string, number][]>();
  for (const entry of Object.entries(values)) {
    const unit = units[entry[0]];
    const heading = unit ? UNIT_HEADINGS[unit] ?? unit : "Values";
    groups.set(heading, [...(groups.get(heading) ?? []), entry]);
  }
  return [...groups.entries()];
}

function FeatureTable({ dataset }: { dataset: FeaturePointsDataset }) {
  return (
    <Facts
      rows={dataset.features.map((feature) => [
        feature.classification.toLowerCase().replaceAll("_", " "),
        <span className="parallax-monospace">({feature.position.map(formatNumber).join(", ")})</span>,
      ])}
    />
  );
}

/**
 * The numbers a canvas cannot show — symbolic results, measurements, matrix analysis, the list of feature
 * points — and the table alternative to a drawn feature set.
 */
export function DatasetFacts({ dataset }: { dataset: Dataset }) {
  const { drawable, panels } = partition(dataset);
  const features = drawable.filter(([, part]) => part.format === "FEATURE_POINTS") as [string, FeaturePointsDataset][];
  if (panels.length === 0 && features.length === 0) {
    return null;
  }
  return (
    <div data-parallax-part="dataset-facts" className="parallax-dataset-facts">
      {features.map(([name, part]) => (
        <FeatureTable key={name} dataset={part} />
      ))}
      {panels.map(([name, part]) => (
        <PanelPart key={name} name={name} dataset={part} />
      ))}
    </div>
  );
}

/** Whether the dataset has anything for a canvas at all. */
export function hasDrawable(dataset: Dataset): boolean {
  return partition(dataset).drawable.length > 0;
}

export function hasSeriesBeside(dataset: Dataset): boolean {
  const { drawable } = partition(dataset);
  return drawable.length > 1 && drawable.some(([, part]) => part.format === "TIME_SERIES");
}
