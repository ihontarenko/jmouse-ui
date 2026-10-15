import { useMemo, useState } from "react";
import type { ObjectDetail } from "@jmouse/parallax";
import type { SceneDocument, SceneView } from "@jmouse/parallax";
import { initialSceneState, sceneDocumentOf, timelineParameterOf, type SceneEditorState, type SceneStart } from "@jmouse/parallax/scene";

/** Everything the scene editor changes, and the `SceneDocument` it saves. */
export function useSceneEditor(object: ObjectDetail, saved: SceneView | null, start: SceneStart, playbackSeconds: number) {
  const [state, setState] = useState<SceneEditorState>(() => initialSceneState(object, saved, start));
  const timelineParameter = useMemo(() => timelineParameterOf(object.parameters), [object.parameters]);

  const change = <K extends keyof SceneEditorState>(key: K, value: SceneEditorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const changeParameter = (name: string, value: number) => {
    setState((current) => {
      const next = { ...current, values: { ...current.values, [name]: value } };
      if (timelineParameter?.name === name) {
        next.time = value;
      }
      return next;
    });
  };

  const changeTime = (time: number) => {
    setState((current) => {
      const next = { ...current, time };
      if (timelineParameter) {
        next.values = { ...current.values, [timelineParameter.name]: time };
      }
      return next;
    });
  };

  const timeRange = timelineParameter
    ? { minimum: timelineParameter.minimum, maximum: timelineParameter.maximum, step: timelineParameter.step }
    : { minimum: 0, maximum: playbackSeconds, step: 0.01 };

  const toDocument = (): SceneDocument => sceneDocumentOf(object, state, timelineParameter);

  return { state, change, changeParameter, changeTime, timeRange, timelineParameter, toDocument };
}
