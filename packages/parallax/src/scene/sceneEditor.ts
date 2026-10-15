import type { ObjectDetail, ParameterDefinition, SceneDocument, SceneView } from "../transport/wire";

/** What the address asks a new scene to start with: a representation, a named example. */
export interface SceneStart {
  representation?: string;
  preset?: string;
}

const OBJECT_ID = "object-1";
const REPRESENTATION_ID = "representation-1";

export interface SceneEditorState {
  values: Record<string, number>;
  /** The representation on the main viewport, as the backend names it (`SURFACE`, `STREAMLINES`, …). */
  representationKind: string;
  /** The settings of that representation, as its specification names them; empty means every default. */
  settings: Record<string, unknown>;
  material: "wireframe" | "surface";
  projection: "perspective" | "orthographic";
  showGrid: boolean;
  showAxes: boolean;
  slice: number;
  time: number;
}

/** The parameter the timeline drives: the object's first animatable one, if it has any. */
export function timelineParameterOf(parameters: readonly ParameterDefinition[]): ParameterDefinition | null {
  return parameters.find((parameter) => parameter.animatable) ?? null;
}

/** Where a scene editor starts: the saved scene, else what the address asks for, else the object's own defaults. */
export function initialSceneState(object: ObjectDetail, saved: SceneView | null, start: SceneStart): SceneEditorState {
  const defaults = Object.fromEntries(object.parameters.map((parameter) => [parameter.name, parameter.defaultValue]));
  const savedObject = saved?.document.objects[0];
  const savedRepresentation = savedObject?.representations[0];
  const style = (savedRepresentation?.style ?? {}) as Partial<{ material: string; showGrid: boolean; showAxes: boolean }>;
  const asked = start.representation && object.applicableRepresentations.includes(start.representation) ? start.representation : null;
  const representationKind =
    savedRepresentation && object.applicableRepresentations.includes(savedRepresentation.kind)
      ? savedRepresentation.kind
      : (asked ?? object.summary.primaryRepresentation ?? object.applicableRepresentations[0] ?? "");
  const preset = object.presets.find((candidate) => candidate.id === start.preset);
  const timelineParameter = timelineParameterOf(object.parameters);
  const values = { ...defaults, ...preset?.values, ...savedObject?.values };
  return {
    values,
    representationKind,
    settings: savedRepresentation && savedRepresentation.kind === representationKind ? { ...savedRepresentation.settings } : {},
    material: style.material === "surface" ? "surface" : "wireframe",
    projection: saved?.document.camera?.projection === "ORTHOGRAPHIC" ? "orthographic" : "perspective",
    showGrid: style.showGrid ?? true,
    showAxes: style.showAxes ?? true,
    slice: Number(savedRepresentation?.settings.offset ?? 0),
    time: timelineParameter ? values[timelineParameter.name] : (saved?.document.timeline?.position ?? 0),
  };
}

/** The scene document an editor's state saves as: one object, one representation on one viewport, its camera and timeline. */
export function sceneDocumentOf(object: ObjectDetail, state: SceneEditorState, timelineParameter: ParameterDefinition | null): SceneDocument {
  return {
    formatVersion: 1,
    objects: [
      {
        id: OBJECT_ID,
        label: object.summary.title,
        objectId: object.summary.id,
        source: object.summary.id ? null : object.source,
        parameters: [],
        values: state.values,
        representations: [
          {
            id: REPRESENTATION_ID,
            kind: state.representationKind,
            settings: state.representationKind === "CROSS_SECTION" ? { axis: "Y", offset: state.slice, ...state.settings } : state.settings,
            visible: true,
            style: { material: state.material, showGrid: state.showGrid, showAxes: state.showAxes },
          },
        ],
        visible: true,
        color: null,
      },
    ],
    camera: {
      projection: state.projection === "orthographic" ? "ORTHOGRAPHIC" : "PERSPECTIVE",
      position: [6, 6, 6],
      target: [0, 0, 0],
      up: [0, 0, 1],
      fieldOfView: 45,
      rotations: [],
    },
    timeline: timelineParameter
      ? {
          objectId: OBJECT_ID,
          parameter: timelineParameter.name,
          start: timelineParameter.minimum,
          end: timelineParameter.maximum,
          durationSeconds: timelineParameter.maximum - timelineParameter.minimum,
          loop: true,
          speed: 1,
          position: state.time,
          trail: false,
        }
      : null,
    viewports: [{ id: "main", title: "Scene", representationIds: [REPRESENTATION_ID], synchronizeCamera: true }],
  };
}

/** The definition's domain as the design writes it, `[−3, 3]²`, when x and y share one. */
export function domainOf(definition: Record<string, unknown>): string {
  const x = definition.x as { minimum: number; maximum: number } | undefined;
  const y = definition.y as { minimum: number; maximum: number } | undefined;
  const format = (value: number) => String(value).replace("-", "−");
  if (x && y && x.minimum === y.minimum && x.maximum === y.maximum) {
    return `[${format(x.minimum)}, ${format(x.maximum)}]²`;
  }
  if (x && y) {
    return `[${format(x.minimum)}, ${format(x.maximum)}] × [${format(y.minimum)}, ${format(y.maximum)}]`;
  }
  // A definition that unfolds in time (a flow, a circuit) is studied over its time span.
  const time = definition.time as { minimum: number; maximum: number } | undefined;
  if (time) {
    return `t ∈ [${format(time.minimum)}, ${format(time.maximum)}]`;
  }
  return "—";
}
