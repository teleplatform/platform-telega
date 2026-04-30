/** @type {import("eslint").Linter.Config} */
module.exports = {
  rules: {
    "no-duplicate-imports": "error",
  },
  overrides: [
    // A) DENY-BY-DEFAULT: runtime keypath запрещён везде
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "**/i18n/messages.keypath.runtime.{ts,js}",
                  "**/i18n/messages.keypath.runtime.*",
                ],
                message:
                  "messages.keypath.runtime запрещён по умолчанию. Разрешён ТОЛЬКО в **/config/** и **/dsl/**.",
              },
            ],
          },
        ],
      },
    },

    // B) CORE: запрещаем keypath-API
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/i18n/messages.{ts,js}", "**/i18n/messages.*"],
                importNames: ["tMsg", "tExplain", "tFrom"],
                message:
                  "Keypath i18n запрещён в core-коде. Используй только ref-режим: t(MSG....) / t(EXPLAIN_MSG....). " +
                  "Keypath допускается только в config/ и dsl/.",
              },
              {
                group: ["**/i18n/messages.keypath.{ts,js}", "**/i18n/messages.keypath.*"],
                message:
                  "messages.keypath запрещён в core-коде. Разрешён только в config/ и dsl/.",
              },
            ],
          },
        ],
      },
    },

    // C) ALLOWLIST: только здесь можно runtime keypath
    {
      files: ["**/config/**/*.{ts,tsx,js,jsx}", "**/dsl/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": "off",
      },
    },

    // D) BARREL: запрещаем реэкспорт runtime keypath из barrel-файлов
    {
      files: [
        "**/index.{ts,tsx,js,jsx}",
        "**/*/index.{ts,tsx,js,jsx}",
        "**/*.barrel.{ts,tsx,js,jsx}",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ExportAllDeclaration[source.value=/messages\\.keypath\\.runtime(\\.|$)/]",
            message:
              "Запрещён re-export messages.keypath.runtime из barrel-файлов. " +
              "Не делай `export * from ...runtime`. Импортируй runtime keypath точечно только там, где нужно (config/dsl).",
          },
          {
            selector:
              "ExportNamedDeclaration[source.value=/messages\\.keypath\\.runtime(\\.|$)/]",
            message:
              "Запрещён re-export messages.keypath.runtime из barrel-файлов. " +
              "Не делай `export { ... } from ...runtime`.",
          },
        ],
      },
    },

    // E) SEALED I18N: запрещаем любые `export * from` внутри i18n/ кроме allowlist
    {
      files: ["**/i18n/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ExportAllDeclaration[source.value]:not(" +
              "ExportAllDeclaration[source.value=/\\/i18n\\/(messages)(\\.|$)/]" +
              ")",
            message:
              "В i18n/ запрещён `export * from ...` (sealed boundary). " +
              "Разрешено только для allowlist-модулей (например i18n/messages). " +
              "Используй явные экспорты: `export { MSG, EXPLAIN_MSG, t } ...`.",
          },
        ],
      },
    },

    // F) GLOBAL: запрещаем ЛЮБОЙ re-export messages.keypath.runtime
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ExportNamedDeclaration[source.value=/messages\\.keypath\\.runtime(\\.|$)/]",
            message:
              "Запрещён ЛЮБОЙ re-export messages.keypath.runtime. " +
              "Runtime keypath можно ТОЛЬКО импортировать напрямую в config/dsl " +
              "и НИКОГДА не проксировать через export.",
          },
          {
            selector:
              "ExportAllDeclaration[source.value=/messages\\.keypath\\.runtime(\\.|$)/]",
            message:
              "Запрещён ЛЮБОЙ re-export messages.keypath.runtime. " +
              "Даже `export *` недопустим вне самого runtime-модуля.",
          },
        ],
      },
    },

    // G) PARANOIA: запрещаем type-прокси из messages.keypath.types вне i18n/
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      excludedFiles: ["**/i18n/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ExportNamedDeclaration[source.value=/messages\\.keypath\\.types(\\.|$)/]",
            message:
              "Запрещён re-export из messages.keypath.types вне i18n/. " +
              "Типы keypath считаются capability и должны жить только внутри i18n boundary. " +
              "Если тип нужен — импортируй его напрямую из i18n внутри i18n/ и прокидывай наружу через явный доменный тип, а не LeafPaths.",
          },
        ],
      },
    },

    // H) SEALED TYPES: запрещаем любые imports из messages.keypath.types вне i18n/ и dsl/
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      excludedFiles: ["**/i18n/**/*.{ts,tsx,js,jsx}", "**/dsl/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "**/i18n/messages.keypath.types.{ts,js}",
                  "**/i18n/messages.keypath.types.*",
                ],
                message:
                  "messages.keypath.types запрещён вне i18n/ и dsl/. " +
                  "Не импортируй LeafPaths/PathValue напрямую — это capability types. " +
                  "Если нужен доменный тип — объяви его в dsl/ как явный union/alias.",
              },
            ],
          },
        ],
      },
    },

    // I) TYPE-ONLY: в i18n/ и dsl/ требуем import type
    {
      files: ["**/i18n/**/*.{ts,tsx}", "**/dsl/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/consistent-type-imports": [
          "error",
          {
            prefer: "type-imports",
            fixStyle: "separate-type-imports",
          },
        ],
      },
    },

    // J) ABSOLUTE BOUNDARY: запрещаем относительные импорты в i18n/ вне i18n/ и dsl/
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      excludedFiles: ["**/i18n/**/*.{ts,tsx,js,jsx}", "**/dsl/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ImportDeclaration[source.value=/^\\.{1,2}\\//][source.value=/\\/i18n\\//]",
            message:
              "Запрещены относительные импорты в i18n boundary. " +
              "Используй только alias-импорты (#i18n/messages и т.п.).",
          },
          {
            selector:
              "CallExpression[callee.name='require'] > Literal[value=/^\\.{1,2}\\//][value=/\\/i18n\\//]",
            message:
              "Запрещены относительные require() в i18n boundary. Используй alias (#i18n/...).",
          },
        ],
      },
    },
  ],
};
