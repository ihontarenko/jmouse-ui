/*
 * Burin — the tool windows whose content is a fixture rather than the open file: the git log with its graph, the Maven
 * lifecycle, the database explorer, the run's log and completion's proposals. From Html/Burin/scripts/panels.js and
 * editor.js, unchanged.
 */
import type { CommitRow, ConsoleTone } from "@jmouse/ui-kit"
import type { FileKind, ProjectNode } from "./project"

export const commits: CommitRow[] = [
  { lane: 0, edges: [[0, 0]], subject: "Stop binding at a fixed depth", references: [{ kind: "head", name: "feature/bean-binder-depth" }], author: "Ivan Hontarenko", date: "2026-10-16 09:14", hash: "a41c9e2" },
  { lane: 0, edges: [[0, 0]], subject: "Report conversion failures instead of throwing", author: "Ivan Hontarenko", date: "2026-10-15 18:02", hash: "7d03b18" },
  { lane: 0, edges: [[0, 0], [0, 1]], subject: "Name every property through PropertyNaming", references: [{ kind: "remote", name: "origin/feature/bean-binder-depth" }], author: "Ivan Hontarenko", date: "2026-10-15 11:40", hash: "c9e7720" },
  { lane: 1, edges: [[0, 0], [1, 1]], subject: "jME: precedence climbing replaces the recursive descent", references: [{ kind: "head", name: "feature/jme-pratt" }], author: "Claude", date: "2026-10-14 16:25", hash: "5b2f0aa" },
  { lane: 1, edges: [[0, 0], [1, 0]], subject: "jME: a Lexer that keeps positions", author: "Claude", date: "2026-10-14 12:08", hash: "e81d433" },
  { lane: 0, edges: [[0, 0]], subject: "Merge branch 'feature/conversion-registry'", references: [{ kind: "remote", name: "origin/master" }, { kind: "tag", name: "v0.8.0" }], author: "Ivan Hontarenko", date: "2026-10-12 20:51", hash: "0f6a2d9" },
  { lane: 0, edges: [[0, 0]], subject: "Conversion: register converters by source and target pair", author: "Ivan Hontarenko", date: "2026-10-11 15:33", hash: "92ab7c1" },
  { lane: 0, edges: [[0, 0]], subject: "Binder becomes a sealed interface", author: "Ivan Hontarenko", date: "2026-10-10 10:02", hash: "3e4d5f6" },
]

const lifecycle = ["clean", "validate", "compile", "test", "package", "verify", "install", "deploy"]
const goal = (name: string): ProjectNode => ({ name, kind: "file", type: "xml", goal: true })

export const mavenTree: ProjectNode = {
  name: "jmouse", kind: "module", children: [
    { name: "Lifecycle", kind: "folder", children: lifecycle.map(goal) },
    { name: "Plugins", kind: "folder", children: [{ name: "compiler", kind: "folder", children: [] }, { name: "surefire", kind: "folder", children: [] }] },
    {
      name: "Modules", kind: "folder", children: [
        { name: "jmouse-core", kind: "module", children: [{ name: "Lifecycle", kind: "folder", children: lifecycle.map(goal) }] },
        { name: "jmouse-el", kind: "module", children: [{ name: "Lifecycle", kind: "folder", children: lifecycle.map(goal) }] },
        { name: "jmouse-web", kind: "module", children: [] },
      ],
    },
  ],
}

const column = (name: string, type: string): ProjectNode => ({ name, kind: "file", type: "field", end: type })

export const databaseTree: ProjectNode = {
  name: "jmouse@localhost", kind: "folder", hint: "MySQL 8.4", children: [
    {
      name: "jmouse", kind: "folder", children: [
        {
          name: "tables", kind: "folder", end: "3", children: [
            { name: "bindings", kind: "folder", children: [column("id", "bigint"), column("name", "varchar(255)"), column("depth", "int"), column("created_at", "timestamp")] },
            { name: "converters", kind: "folder", children: [column("id", "bigint"), column("source_type", "varchar(255)"), column("target_type", "varchar(255)")] },
            { name: "flyway_schema_history", kind: "folder", children: [] },
          ],
        },
        { name: "views", kind: "folder", children: [] },
        { name: "routines", kind: "folder", children: [] },
      ],
    },
  ],
}

export const runCommandLine = "/usr/lib/jvm/temurin-21/bin/java -XX:TieredStopAtLevel=1 -Dfile.encoding=UTF-8 -classpath … org.jmouse.Application"

export const runLog: Array<[ConsoleTone, string]> = [
  ["level-info", "[INFO] Scanning for projects…"],
  ["level-info", "[INFO] Building jmouse-core 0.9.0-SNAPSHOT                    [1/3]"],
  ["level-debug", "[DEBUG] Compiling 214 source files with javac [release 21]"],
  ["level-info", "[INFO] Building jmouse-el 0.9.0-SNAPSHOT                      [2/3]"],
  ["level-warn", "[WARN] ExpressionParser.java:36 cannot find symbol: method expect(TokenType)"],
  ["level-info", "[INFO] Building jmouse-sandbox 0.9.0-SNAPSHOT                 [3/3]"],
  ["level-info", "  _ __  __"],
  ["level-info", " (_)  \\/  | ___  _   _ ___  ___     jMouse 0.9.0-SNAPSHOT"],
  ["level-info", " | | |\\/| |/ _ \\| | | / __|/ _ \\    profile: local"],
  ["level-info", " | | |  | | (_) | |_| \\__ \\  __/"],
  ["level-info", "_/ |_|  |_|\\___/ \\__,_|___/\\___|"],
  ["level-info", "|__/"],
  ["level-info", "2026-10-16 10:42:07.118  INFO  o.j.core.bind.BeanBinder     : bound 'jmouse.binding' (2 properties)"],
  ["level-debug", "2026-10-16 10:42:07.140  DEBUG o.j.core.convert.Conversion  : 48 converters registered"],
  ["level-info", "2026-10-16 10:42:07.402  INFO  o.j.web.server.WebServer     : listening on http://localhost:8080/"],
  ["level-info", "2026-10-16 10:42:07.403  INFO  o.j.Application              : started in 0.84 s (JVM running for 1.31 s)"],
]

export const completionProposals: Array<{ glyph: FileKind; name: string; signature: string; returns: string }> = [
  { glyph: "method", name: "write", signature: "(Object instance, Object value)", returns: "void" },
  { glyph: "method", name: "name", signature: "()", returns: "String" },
  { glyph: "method", name: "rawType", signature: "()", returns: "Class<?>" },
  { glyph: "method", name: "type", signature: "()", returns: "JavaType" },
  { glyph: "method", name: "isWritable", signature: "()", returns: "boolean" },
  { glyph: "method", name: "annotation", signature: "(Class<A> type)", returns: "Optional<A>" },
  { glyph: "field", name: "UNKNOWN", signature: "", returns: "Property" },
]

export const bookmarks = [
  { path: "jmouse-core/src/main/java/org/jmouse/core/bind/BeanBinder.java", line: 33, name: "BeanBinder.java", note: ":33 depth guard" },
  { path: "jmouse-el/src/main/java/org/jmouse/el/ExpressionParser.java", line: 26, name: "ExpressionParser.java", note: ":26 precedence loop" },
]
