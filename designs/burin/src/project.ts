/*
 * Burin — the fixture project the editor opens: a cut of jMouse with three modules. Carried over value for value from
 * Html/Burin/scripts/project.js, so the two editors show the same files. Line numbers are 1-based.
 */
import type { CodeProblem, LineChanges, SyntaxLanguage } from "@jmouse/ui-kit"

export type FileKind = "class" | "interface" | "record" | "enum" | "test" | "yaml" | "xml" | "md" | "method" | "field"

export interface ProjectFile {
  language: SyntaxLanguage
  type: FileKind
  source: string
  vcs: LineChanges
  breakpoints: number[]
  folds: Array<[number, number]>
  vision: Record<number, string>
  problems: CodeProblem[]
}

export type NodeKind = "module" | "folder" | "source" | "test" | "resources" | "package" | "file"

export interface ProjectNode {
  name: string
  kind: NodeKind
  children?: ProjectNode[]
  file?: string
  type?: FileKind
  vcs?: "modified" | "added" | "ignored"
  hint?: string
  end?: string
  goal?: boolean
}

export const projectName = "jmouse"
export const branchName = "feature/bean-binder-depth"

export const files: Record<string, ProjectFile> = {
  "jmouse-core/src/main/java/org/jmouse/core/bind/BeanBinder.java": {
    "language": "java",
    "type": "class",
    "vcs": {
      "modified": [
        22,
        39,
        40
      ],
      "added": [
        44,
        45,
        46
      ],
      "deleted": [
        51
      ]
    },
    "breakpoints": [
      39
    ],
    "folds": [
      [
        3,
        8
      ],
      [
        10,
        16
      ],
      [
        32,
        50
      ],
      [
        38,
        48
      ],
      [
        53,
        55
      ],
      [
        57,
        59
      ]
    ],
    "vision": {
      "17": "4 usages · 2 implementations",
      "32": "12 usages · Ivan Hontarenko, 2 days ago"
    },
    "source": "package org.jmouse.core.bind;\n\nimport org.jmouse.core.convert.Conversion;\nimport org.jmouse.core.convert.Converter;\nimport org.jmouse.core.reflection.JavaType;\nimport org.jmouse.core.reflection.Property;\nimport java.util.List;\nimport java.util.Optional;\n\n/**\n * Binds a flat source of named values onto a bean, property by property.\n * <p>\n * A property that cannot be converted is reported, not thrown: the caller\n * receives every failure at once in the {@link BindResult}.\n * @see Binder\n */\npublic final class BeanBinder implements Binder {\n\n    private static final int MAXIMUM_DEPTH = 32;\n\n    private final Conversion conversion;\n    private final BindingCallback callback;\n    private final PropertyNaming naming;\n\n    public BeanBinder(Conversion conversion, BindingCallback callback, PropertyNaming naming) {\n        this.conversion = conversion;\n        this.callback = callback;\n        this.naming = naming;\n    }\n\n    @Override\n    public <T> BindResult<T> bind(BindName name, Bindable<T> bindable, BindContext context) {\n        if (context.depth() > MAXIMUM_DEPTH) {\n            return BindResult.failure(name, \"Nesting deeper than \" + MAXIMUM_DEPTH);\n        }\n        JavaType type = bindable.type();\n        List<Property> properties = type.properties();\n        for (Property property : properties) {\n            BindName child = name.append(naming.resolve(⟦property: ⟧property.name()));\n            Optional<Object> value = context.source().lookup(child);\n            if (⟨value.isPresent() == false⟩) {\n                continue;\n            }\n            Converter<Object, ?> converter = conversion.findConverter(⟦source: ⟧Object.class, ⟦target: ⟧property.rawType());\n            Object converted = converter.convert(value.get());\n            callback.onBound(child, converted);\n            property.write(bindable.instance(), converted);‸\n        }\n        return BindResult.of(name, bindable.instance());\n    }\n\n    @Override\n    public String toString() {\n        return \"BeanBinder[\" + naming + \"]\";\n    }\n\n    /**\n     * The depth at which a cycle is assumed and binding stops.\n     */\n    public static int maximumDepth() {\n        return MAXIMUM_DEPTH;\n    }\n}",
    "problems": [
      {
        "severity": "warn",
        "line": 41,
        "message": "Condition 'value.isPresent() == false' can be simplified to '!value.isPresent()'"
      },
      {
        "severity": "weak",
        "line": 7,
        "message": "Import 'java.util.List' could be replaced by a static import"
      }
    ]
  },
  "jmouse-core/src/main/java/org/jmouse/core/bind/Binder.java": {
    "language": "java",
    "type": "interface",
    "vcs": {},
    "breakpoints": [],
    "folds": [],
    "vision": {
      "6": "3 implementations"
    },
    "source": "package org.jmouse.core.bind;\n\n/**\n * Turns a source of named values into a typed object.\n */\npublic sealed interface Binder permits BeanBinder, RecordBinder, CollectionBinder {\n\n    <T> BindResult<T> bind(BindName name, Bindable<T> bindable, BindContext context);\n\n    default <T> BindResult<T> bind(String name, Class<T> type, BindContext context) {\n        return bind(BindName.of(name), Bindable.of(type), context);\n    }\n}",
    "problems": []
  },
  "jmouse-core/src/main/java/org/jmouse/core/bind/BindResult.java": {
    "language": "java",
    "type": "record",
    "vcs": {},
    "breakpoints": [],
    "folds": [],
    "vision": {},
    "source": "package org.jmouse.core.bind;\n\nimport java.util.List;\n\n/**\n * What one bind produced: the value, or every reason it could not be produced.\n */\npublic record BindResult<T>(BindName name, T value, List<String> failures) {\n\n    public static <T> BindResult<T> of(BindName name, T value) {\n        return new BindResult<>(name, value, List.of());\n    }\n\n    public static <T> BindResult<T> failure(BindName name, String reason) {\n        return new BindResult<>(name, null, List.of(reason));\n    }\n\n    public boolean isBound() {\n        return failures.isEmpty();\n    }\n}",
    "problems": []
  },
  "jmouse-core/src/test/java/org/jmouse/core/bind/BeanBinderTest.java": {
    "language": "java",
    "type": "test",
    "vcs": {
      "added": [
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25
      ]
    },
    "breakpoints": [],
    "folds": [],
    "vision": {},
    "source": "package org.jmouse.core.bind;\n\nimport org.junit.jupiter.api.Test;\nimport static org.assertj.core.api.Assertions.assertThat;\n\nclass BeanBinderTest {\n\n    private final Binder binder = Binders.defaults();\n\n    @Test\n    void bindsNestedProperties() {\n        MapSource source = MapSource.of(\"server.port\", \"8080\", \"server.host\", \"localhost\");\n        BindResult<Server> result = binder.bind(\"server\", Server.class, BindContext.of(source));\n        assertThat(result.value().port()).isEqualTo(8080);\n    }\n\n    @Test\n    void stopsAtMaximumDepth() {\n        BindContext context = BindContext.of(MapSource.empty()).withDepth(33);\n        BindResult<Server> result = binder.bind(\"server\", Server.class, context);\n        assertThat(result.isBound()).isFalse();\n        assertThat(result.failures()).containsExactly(\"Nesting deeper than 32\");\n    }\n\n    record Server(String host, int port) {}\n}",
    "problems": []
  },
  "jmouse-el/src/main/java/org/jmouse/el/ExpressionParser.java": {
    "language": "java",
    "type": "class",
    "vcs": {
      "added": "all"
    },
    "breakpoints": [],
    "folds": [
      [
        18,
        32
      ]
    ],
    "vision": {
      "9": "6 usages",
      "18": "3 usages"
    },
    "source": "package org.jmouse.el;\n\nimport java.util.ArrayDeque;\nimport java.util.Deque;\n\n/**\n * A Pratt parser for jME: precedence climbs, never recurses per level.\n */\npublic final class ExpressionParser {\n\n    private final Lexer lexer;\n    private final Deque<Token> lookahead = new ArrayDeque<>();\n\n    public ExpressionParser(Lexer lexer) {\n        this.lexer = lexer;\n    }\n\n    public Node parse(int precedence) {\n        Token token = next();\n        Node left = switch (token.type()) {\n            case NUMBER -> new Node.Literal(token.value());\n            case IDENTIFIER -> new Node.Variable(token.text());\n            case OPEN_PARENTHESIS -> parenthesised();\n            default -> throw new ParseException(\"Unexpected \" + token, token.position());\n        };\n        while (precedence < peek().type().precedence()) {\n            Token operator = next();\n            Node right = parse(operator.type().precedence());\n            left = new Node.Binary(operator.type(), left, right);\n        }\n        return left;\n    }\n\n    private Node parenthesised() {\n        Node inner = parse(0);\n        expect(TokenType.CLOSE_PARENTHESIS);\n        return inner;\n    }\n\n    private Token next() {\n        return lookahead.isEmpty() ? lexer.next() : lookahead.pop();\n    }\n\n    private Token peek() {\n        if (lookahead.isEmpty()) {\n            lookahead.push(lexer.next());\n        }\n        return lookahead.peek();\n    }\n}",
    "problems": [
      {
        "severity": "danger",
        "line": 36,
        "message": "Cannot resolve method 'expect' in 'ExpressionParser'"
      }
    ]
  },
  "jmouse-el/src/main/java/org/jmouse/el/TokenType.java": {
    "language": "java",
    "type": "enum",
    "vcs": {},
    "breakpoints": [],
    "folds": [],
    "vision": {},
    "source": "package org.jmouse.el;\n\npublic enum TokenType {\n    NUMBER(0), IDENTIFIER(0), OPEN_PARENTHESIS(0), CLOSE_PARENTHESIS(0),\n    PLUS(10), MINUS(10), MULTIPLY(20), DIVIDE(20), POWER(30), END(-1);\n\n    private final int precedence;\n\n    TokenType(int precedence) {\n        this.precedence = precedence;\n    }\n\n    public int precedence() {\n        return precedence;\n    }\n}",
    "problems": []
  },
  "jmouse-core/src/main/resources/application.yaml": {
    "language": "yaml",
    "type": "yaml",
    "vcs": {
      "modified": [
        6,
        7
      ]
    },
    "breakpoints": [],
    "folds": [],
    "vision": {},
    "source": "# jMouse — defaults for a local run\njmouse:\n  application:\n    name: jmouse-sandbox\n  binding:\n    maximum-depth: 32\n    fail-fast: false\n  conversion:\n    date-format: \"yyyy-MM-dd\"\n    trim-strings: true\n  web:\n    port: ${PORT:8080}\n    context-path: /\n    compression:\n      enabled: true\n      minimum-size: 2KB\n  logging:\n    level:\n      org.jmouse: debug\n      org.jmouse.core.bind: info",
    "problems": []
  },
  "pom.xml": {
    "language": "xml",
    "type": "xml",
    "vcs": {},
    "breakpoints": [],
    "folds": [],
    "vision": {},
    "source": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- jMouse: the reactor that builds every module -->\n<project xmlns=\"http://maven.apache.org/POM/4.0.0\">\n    <modelVersion>4.0.0</modelVersion>\n\n    <groupId>org.jmouse</groupId>\n    <artifactId>jmouse</artifactId>\n    <version>0.9.0-SNAPSHOT</version>\n    <packaging>pom</packaging>\n\n    <modules>\n        <module>jmouse-core</module>\n        <module>jmouse-el</module>\n        <module>jmouse-web</module>\n    </modules>\n\n    <properties>\n        <java.version>21</java.version>\n        <maven.compiler.release>${java.version}</maven.compiler.release>\n        <junit.version>5.11.3</junit.version>\n    </properties>\n\n    <dependencyManagement>\n        <dependencies>\n            <dependency>\n                <groupId>org.junit</groupId>\n                <artifactId>junit-bom</artifactId>\n                <version>${junit.version}</version>\n                <type>pom</type>\n                <scope>import</scope>\n            </dependency>\n        </dependencies>\n    </dependencyManagement>\n</project>",
    "problems": []
  }
}

export const projectTree: ProjectNode = {
  "name": "jmouse",
  "kind": "module",
  "hint": "~/Git/jmouse",
  "children": [
    {
      "name": ".idea",
      "kind": "folder",
      "vcs": "ignored",
      "children": []
    },
    {
      "name": "jmouse-core",
      "kind": "module",
      "children": [
        {
          "name": "src",
          "kind": "folder",
          "children": [
            {
              "name": "main",
              "kind": "folder",
              "children": [
                {
                  "name": "java",
                  "kind": "source",
                  "children": [
                    {
                      "name": "org.jmouse.core.bind",
                      "kind": "package",
                      "children": [
                        {
                          "name": "BeanBinder",
                          "kind": "file",
                          "file": "jmouse-core/src/main/java/org/jmouse/core/bind/BeanBinder.java",
                          "vcs": "modified"
                        },
                        {
                          "name": "Binder",
                          "kind": "file",
                          "file": "jmouse-core/src/main/java/org/jmouse/core/bind/Binder.java"
                        },
                        {
                          "name": "BindResult",
                          "kind": "file",
                          "file": "jmouse-core/src/main/java/org/jmouse/core/bind/BindResult.java"
                        }
                      ]
                    },
                    {
                      "name": "org.jmouse.core.convert",
                      "kind": "package",
                      "children": []
                    },
                    {
                      "name": "org.jmouse.core.reflection",
                      "kind": "package",
                      "children": []
                    }
                  ]
                },
                {
                  "name": "resources",
                  "kind": "resources",
                  "children": [
                    {
                      "name": "application.yaml",
                      "kind": "file",
                      "file": "jmouse-core/src/main/resources/application.yaml",
                      "vcs": "modified"
                    }
                  ]
                }
              ]
            },
            {
              "name": "test",
              "kind": "folder",
              "children": [
                {
                  "name": "java",
                  "kind": "test",
                  "children": [
                    {
                      "name": "org.jmouse.core.bind",
                      "kind": "package",
                      "children": [
                        {
                          "name": "BeanBinderTest",
                          "kind": "file",
                          "file": "jmouse-core/src/test/java/org/jmouse/core/bind/BeanBinderTest.java",
                          "vcs": "modified"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name": "pom.xml",
          "kind": "file",
          "type": "xml"
        }
      ]
    },
    {
      "name": "jmouse-el",
      "kind": "module",
      "children": [
        {
          "name": "src/main/java",
          "kind": "source",
          "children": [
            {
              "name": "org.jmouse.el",
              "kind": "package",
              "children": [
                {
                  "name": "ExpressionParser",
                  "kind": "file",
                  "file": "jmouse-el/src/main/java/org/jmouse/el/ExpressionParser.java",
                  "vcs": "added"
                },
                {
                  "name": "TokenType",
                  "kind": "file",
                  "file": "jmouse-el/src/main/java/org/jmouse/el/TokenType.java"
                }
              ]
            }
          ]
        },
        {
          "name": "pom.xml",
          "kind": "file",
          "type": "xml"
        }
      ]
    },
    {
      "name": "jmouse-web",
      "kind": "module",
      "children": []
    },
    {
      "name": ".gitignore",
      "kind": "file",
      "type": "md"
    },
    {
      "name": "pom.xml",
      "kind": "file",
      "file": "pom.xml"
    },
    {
      "name": "README.md",
      "kind": "file",
      "type": "md"
    }
  ]
}

export const actions: Array<{ name: string; where: string; keys: string[] }> = [
  {
    "name": "Reformat Code",
    "where": "Code",
    "keys": [
      "Ctrl",
      "Alt",
      "L"
    ]
  },
  {
    "name": "Optimize Imports",
    "where": "Code",
    "keys": [
      "Ctrl",
      "Alt",
      "O"
    ]
  },
  {
    "name": "Rename…",
    "where": "Refactor",
    "keys": [
      "Shift",
      "F6"
    ]
  },
  {
    "name": "Extract Method…",
    "where": "Refactor",
    "keys": [
      "Ctrl",
      "Alt",
      "M"
    ]
  },
  {
    "name": "Run 'BeanBinderTest'",
    "where": "Run",
    "keys": [
      "Ctrl",
      "Shift",
      "F10"
    ]
  },
  {
    "name": "Debug 'jmouse-sandbox'",
    "where": "Run",
    "keys": [
      "Shift",
      "F9"
    ]
  },
  {
    "name": "Commit…",
    "where": "Git",
    "keys": [
      "Ctrl",
      "K"
    ]
  },
  {
    "name": "Push…",
    "where": "Git",
    "keys": [
      "Ctrl",
      "Shift",
      "K"
    ]
  },
  {
    "name": "Show Appearance",
    "where": "View",
    "keys": []
  },
  {
    "name": "Toggle Theme",
    "where": "View",
    "keys": []
  },
  {
    "name": "Settings…",
    "where": "File",
    "keys": [
      "Ctrl",
      "Alt",
      "S"
    ]
  },
  {
    "name": "Find in Files…",
    "where": "Edit",
    "keys": [
      "Ctrl",
      "Shift",
      "F"
    ]
  }
]
