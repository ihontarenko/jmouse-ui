import { CodeSourceEditor } from "../viewers/CodeSourceEditor";
import { Tool } from "../controls/BenchControls";

/**
 * A component's jMX document, edited: read from a `.jmx` file, written back as one, or typed. Controlled; the host keeps
 * the text with the component's identity and saves it — the backend reads and checks it first.
 */
export function ComponentSourceSurface({ value, onChange, onImport, downloadName, error }: {
  value: string;
  onChange: (source: string) => void;
  /** Told of a file read in, with its name — after `onChange` has the text. */
  onImport?: (fileName: string) => void;
  /** The file name a download is saved under, without `.jmx`. */
  downloadName: string;
  /** Why the document was refused. */
  error?: string;
}) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${downloadName}.jmx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="parallax-stack">
      <div data-parallax-part="field" className="parallax-field">
        <label htmlFor="component-file">Import a .jmx file</label>
        <input id="component-file" data-parallax-part="input" className="parallax-input" type="file" accept=".jmx,text/plain" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            onChange(await file.text());
            onImport?.(file.name);
          }
        }} />
      </div>
      <Tool disabled={!value.trim()} onClick={download}>Download .jmx</Tool>
      <CodeSourceEditor id="component-source" label="Component model" language="jMX" minHeight={460}
        value={value} error={error} onChange={onChange} />
      <p className="parallax-hint">Define pins, equations or behaviour, and datasheet expectations in one jMX document. The saved model is checked before use.</p>
    </div>
  );
}
