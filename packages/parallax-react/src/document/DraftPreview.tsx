import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useEffect, useState } from "react";
import type { ObjectDetail } from "@jmouse/parallax";
import { documentSubject, type SubjectView, ApiProblem } from "@jmouse/parallax";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Presentation } from "../stand/presentations";

/** How long the text must rest before the draft is computed again. */
const SETTLE_MILLISECONDS = 600;

export interface DraftState {
  /** The draft as an object, once it reads. */
  detail: ObjectDetail | null;
  /** Why the draft does not read, in words. */
  refusal: string | null;
  /** The text being read differs from the one shown. */
  reading: boolean;
}

/**
 * The draft as the object it would be: the unsaved text resolved as the subject `document:<jMX>`, read again a moment
 * after the text stops changing. The last draft that read stays on screen while a broken one is being typed.
 */
export function useDraft(source: string): DraftState & { subject: SubjectView | null } {
  const transport = useParallaxTransport();
  const [subject, setSubject] = useState<SubjectView | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [reading, setReading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setReading(true);
    const timer = window.setTimeout(() => {
      transport.subjects.resolve(documentSubject(source), controller.signal)
        .then((answer) => {
          if (answer.object) {
            setSubject(answer);
            setRefusal(null);
          } else {
            setRefusal(answer.refusal ?? "The draft does not describe an object yet.");
          }
          setReading(false);
        })
        .catch((problem) => {
          if (!controller.signal.aborted) {
            setRefusal(problem instanceof ApiProblem ? problem.detail : "The draft could not be read.");
            setReading(false);
          }
        });
    }, SETTLE_MILLISECONDS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [source]);
  return { subject, detail: subject?.object ?? null, refusal, reading };
}

/** The draft drawn as its object is: the same presentations as the object page, filling the stage. */
export function DraftPreview({ subject, values, fill = true }: { subject: SubjectView | null; values: Record<string, number>; fill?: boolean }) {
  if (!subject?.object) {
    return (
      <div className="parallax-empty parallax-draft-empty">
        <ParallaxIcon name="eye" large />
        <strong>Nothing to preview yet</strong>
        <span>The preview follows the text as soon as it reads as an object.</span>
      </div>
    );
  }
  return <Presentation detail={subject.object} target={{ subject: subject.reference }} values={values} saved={false} fill={fill} />;
}
