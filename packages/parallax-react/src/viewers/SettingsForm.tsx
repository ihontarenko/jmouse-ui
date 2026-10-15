import { humanize } from "../support/humanize";
import { useEffect, useState } from "react";
import type { ParallaxTransport, RepresentationSpecification } from "@jmouse/parallax";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useAsync } from "../support/useAsync";
import type { FrameRateGuard } from "@jmouse/parallax/playback";
import { useFrameRateGuard } from "./useFrameRateGuard";
import { ParameterField, SelectField, TextField } from "../support/fields";

type Setting = RepresentationSpecification["settings"][number];
export type SettingValues = Record<string, unknown>;

/** Each transport's representation vocabulary, asked once: it does not change while the interface runs. */
const specifications = new WeakMap<ParallaxTransport, Promise<RepresentationSpecification[]>>();

/** The representation vocabulary — asked once per transport, it does not change while the interface runs. */
export function useRepresentationSpecifications() {
  const transport = useParallaxTransport();
  return useAsync(() => {
    let request = specifications.get(transport);
    if (!request) {
      request = transport.computations.representations().catch((failure: unknown) => {
        specifications.delete(transport);
        throw failure;
      });
      specifications.set(transport, request);
    }
    return request;
  }, [transport]);
}

function labelOf(setting: Setting): string {
  return humanize(setting.name);
}

const SLIDER_SPAN_LIMIT = 100000;

/** One field per setting, generated from its specification; the server's refusal arrives as `errors`. */
export function SettingsForm({
  kind,
  values,
  onChange,
  errors,
  disabled,
}: {
  kind: string;
  values: SettingValues;
  onChange: (values: SettingValues) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const vocabulary = useRepresentationSpecifications();
  const guard = useFrameRateGuard();
  const specification = vocabulary.data?.find((candidate) => candidate.kind === kind);
  if (!specification || specification.settings.length === 0) {
    return null;
  }
  const change = (name: string, value: unknown) => {
    const next = { ...values };
    if (value === undefined) {
      delete next[name];
    } else {
      next[name] = value;
    }
    onChange(next);
  };
  return (
    <div className="parallax-stack-tight">
      {specification.settings.map((setting) => (
        <SettingField
          key={`${kind}-${setting.name}`}
          setting={setting}
          value={values[setting.name]}
          error={errors[setting.name] ?? errors[`settings.${setting.name}`]}
          disabled={disabled}
          guard={specification.renderLoad.includes(setting.name) ? guard : null}
          onChange={(value) => change(setting.name, value)}
        />
      ))}
    </div>
  );
}

/**
 * One setting's control. A setting that adds to the drawing (`guard` given) may still be lowered on a machine
 * below the minimum frame rate, but not raised: an increase is held at the current value, and the reason is shown.
 */
function SettingField({
  setting,
  value,
  error,
  disabled,
  guard,
  onChange,
}: {
  setting: Setting;
  value: unknown;
  error?: string;
  disabled?: boolean;
  guard: FrameRateGuard | null;
  onChange: (value: unknown) => void;
}) {
  const id = `setting-${setting.name}`;
  const hint = setting.description;
  const heldBack = guard !== null && guard.starved;
  const current = Number(value ?? setting.defaultValue);
  const change = (next: unknown) => {
    if (heldBack && typeof next === "number" && next > current) {
      return;
    }
    onChange(next);
  };
  const heldBackNote = heldBack ? (
    <span className="parallax-hint" role="status">
      Held at {current}: this machine draws {Math.round(guard.framesPerSecond ?? 0)} frames a second, below the minimum of {guard.minimum}. Lowering it is still possible.
    </span>
  ) : null;
  if (setting.type === "CHOICE") {
    return (
      <SelectField
        id={id}
        label={labelOf(setting)}
        value={String(value ?? setting.defaultValue)}
        disabled={disabled}
        options={setting.choices.map((choice) => ({ value: choice, label: choice.charAt(0) + choice.slice(1).toLowerCase().replaceAll("_", " ") }))}
        onChange={(event) => change(event.target.value)}
      />
    );
  }
  if ((setting.type === "INTEGER" || setting.type === "NUMBER") && setting.minimum !== null && setting.maximum !== null && setting.maximum - setting.minimum <= SLIDER_SPAN_LIMIT) {
    const integer = setting.type === "INTEGER";
    const span = setting.maximum - setting.minimum;
    return (
      <>
        <ParameterField
          id={id}
          label={labelOf(setting)}
          value={current}
          minimum={setting.minimum}
          maximum={setting.maximum}
          step={integer ? Math.max(1, Math.round(span / 200)) : span / 200}
          disabled={disabled}
          onChange={(next) => change(integer ? Math.round(next) : next)}
        />
        {heldBackNote}
        {error ? <span className="parallax-error-text">{error}</span> : null}
      </>
    );
  }
  if (setting.type === "VECTOR") {
    return <VectorField id={id} setting={setting} value={value} error={error} disabled={disabled} onChange={onChange} />;
  }
  return (
    <>
    <TextField
      id={id}
      label={labelOf(setting)}
      hint={hint}
      error={error}
      disabled={disabled}
      type={setting.type === "TEXT" ? "text" : "number"}
      inputClassName="parallax-monospace"
      value={String(value ?? setting.defaultValue ?? "")}
      onChange={(event) => change(setting.type === "TEXT" ? event.target.value : Number(event.target.value))}
    />
    {heldBackNote}
    </>
  );
}

/** Numbers separated by commas; empty means the representation's own default. */
function VectorField({ id, setting, value, error, disabled, onChange }: { id: string; setting: Setting; value: unknown; error?: string; disabled?: boolean; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(Array.isArray(value) ? value.join(", ") : "");
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    setText(Array.isArray(value) ? value.join(", ") : "");
  }, [value]);
  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setLocalError(null);
      onChange(undefined);
      return;
    }
    const numbers = trimmed.split(/[,;\s]+/).map(Number);
    if (numbers.some((number) => !Number.isFinite(number))) {
      setLocalError("Numbers separated by commas.");
      return;
    }
    if (setting.length > 0 && numbers.length !== setting.length) {
      setLocalError(`Exactly ${setting.length} numbers.`);
      return;
    }
    setLocalError(null);
    onChange(numbers);
  };
  return (
    <TextField
      id={id}
      label={labelOf(setting)}
      hint={setting.description}
      error={localError ?? error}
      disabled={disabled}
      inputClassName="parallax-monospace"
      placeholder={setting.length > 0 ? Array.from({ length: setting.length }, (_, index) => `a${index + 1}`).join(", ") : "default"}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
    />
  );
}
