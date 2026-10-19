import type { OpenFile, TreeNode } from "@jmouse/ui-kit"

/* Fixtures for the specimens. Every value is invented; the shapes are the products' own. */

export interface Part {
  id: string
  designator: string
  value: string
  package: string
  kind: string
  stock: number
  state: "good" | "warn" | "danger"
  stateLabel: string
  path: string
}

export const parts: Part[] = [
  { id: "p1", designator: "U1", value: "NE555", package: "DIP-8", kind: "IC", stock: 42, state: "good", stateLabel: "In stock", path: "catalogue/ic/timers/ne555.jmc" },
  { id: "p2", designator: "R1", value: "10 kΩ", package: "0805", kind: "Resistor", stock: 1840, state: "good", stateLabel: "In stock", path: "catalogue/passive/r/10k-0805.jmc" },
  { id: "p3", designator: "R2", value: "4.7 kΩ", package: "0805", kind: "Resistor", stock: 12, state: "warn", stateLabel: "Low", path: "catalogue/passive/r/4k7-0805.jmc" },
  { id: "p4", designator: "C1", value: "10 µF", package: "1206", kind: "Capacitor", stock: 0, state: "danger", stateLabel: "Out", path: "catalogue/passive/c/10u-1206.jmc" },
  { id: "p5", designator: "C2", value: "100 nF", package: "0603", kind: "Capacitor", stock: 960, state: "good", stateLabel: "In stock", path: "catalogue/passive/c/100n-0603.jmc" },
  { id: "p6", designator: "D1", value: "1N4148", package: "SOD-123", kind: "Diode", stock: 230, state: "good", stateLabel: "In stock", path: "catalogue/discrete/d/1n4148.jmc" },
  { id: "p7", designator: "Q1", value: "2N3904", package: "SOT-23", kind: "Transistor", stock: 18, state: "warn", stateLabel: "Low", path: "catalogue/discrete/q/2n3904.jmc" },
  { id: "p8", designator: "L1", value: "22 µH", package: "CD54", kind: "Inductor", stock: 64, state: "good", stateLabel: "In stock", path: "catalogue/passive/l/22u-cd54.jmc" },
]

const java = { letter: "J", color: "#c77d3a" }
const record = { letter: "R", color: "#8b6fc0" }
const markdown = { letter: "M", color: "#6b7381" }
const yaml = { letter: "Y", color: "#a05d8c" }

export const projectTree: TreeNode[] = [
  {
    id: "core",
    name: "jmouse-core",
    icon: "folder",
    expandedIcon: "folder-open",
    hint: "module",
    children: [
      {
        id: "core/src",
        name: "src/main/java",
        icon: "folder",
        expandedIcon: "folder-open",
        children: [
          { id: "core/Binder.java", name: "Binder.java", fileType: java, change: "modified", end: "M" },
          { id: "core/BeanContext.java", name: "BeanContext.java", fileType: java },
          { id: "core/Slugifier.java", name: "Slugifier.java", fileType: java, change: "added", end: "A" },
          { id: "core/PropertyPath.java", name: "PropertyPath.java", fileType: record },
        ],
      },
      { id: "core/README.md", name: "README.md", fileType: markdown },
      { id: "core/application.yaml", name: "application.yaml", fileType: yaml, change: "conflict", end: "C" },
    ],
  },
  {
    id: "el",
    name: "jmouse-el",
    icon: "folder",
    expandedIcon: "folder-open",
    hint: "module",
    children: [
      { id: "el/Expression.java", name: "Expression.java", fileType: java },
      { id: "el/Evaluator.java", name: "Evaluator.java", fileType: java, change: "deleted", end: "D" },
    ],
  },
]

export const initialOpenFiles: OpenFile[] = [
  { id: "core/README.md", name: "README.md", fileType: markdown, pinned: true },
  { id: "core/Binder.java", name: "Binder.java", fileType: java, change: "modified", unsaved: true },
  { id: "core/Slugifier.java", name: "Slugifier.java", fileType: java, change: "added" },
  { id: "core/application.yaml", name: "application.yaml", fileType: yaml, change: "conflict" },
  { id: "el/Expression.java", name: "Expression.java", hint: "jmouse-el", fileType: java, preview: true },
]

export const sourceOf: Record<string, string> = {
  "core/Binder.java": `public final class Binder {

    private final BeanContext context;

    public Binder(BeanContext context) {
        this.context = context;
    }

    /** Binds the properties under the path onto a new instance of the type. */
    public <T> T bind(PropertyPath path, Class<T> type) {
        if (path.isEmpty()) {
            throw new IllegalArgumentException("A binding needs a path.");
        }
        return context.instantiate(type, path);
    }
}`,
  "core/README.md": "# jmouse-core\n\nThe bean context, the binder and the slugifier.",
  "core/Slugifier.java": "public final class Slugifier {\n    public String slugify(String text) {\n        return text.toLowerCase();\n    }\n}",
  "core/application.yaml": "jmouse:\n<<<<<<< ours\n  binder: strict\n=======\n  binder: lenient\n>>>>>>> theirs",
  "el/Expression.java": "public sealed interface Expression permits Literal, Call {}",
}
