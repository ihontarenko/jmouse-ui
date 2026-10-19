/**
 * `@jmouse/ui-kit/code` — code being read and edited, on the kit's canvas: {@link CodeEditor}, and the languages,
 * completion and highlighting of `@jmouse/codemirror`, re-exported so a product names one package.
 *
 * Optional, like `/instruments`: `@jmouse/codemirror` and the `@codemirror/*` packages are optional peers, so a
 * product that never imports this entry never installs them. Import `@jmouse/ui-kit/code.css` once beside it.
 */
export * from "@jmouse/codemirror"
export { editorChrome, type EditorChromeOptions } from "@jmouse/codemirror/editor"
export { CodeEditor, type CodeEditorProperties } from "./CodeEditor"
