import { readdir, readFile, stat } from "fs/promises"
import path from "path"
import type { Pattern, PatternType } from "./types"

export class PatternExtractor {
  private repoPath: string

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath)
  }

  async extractAll(): Promise<Omit<Pattern, "id" | "created_at">[]> {
    const patterns: Omit<Pattern, "id" | "created_at">[] = []
    const project = path.basename(this.repoPath)

    // Scan source files for conventions
    const files = await this.getSourceFiles(this.repoPath)

    // Naming convention detection
    const namingPatterns = this.detectNamingConventions(files)
    patterns.push(
      ...namingPatterns.map((p) => ({ ...p, project, source: "file-scan" })),
    )

    // Import style detection
    const importPatterns = await this.detectImportStyle(files)
    patterns.push(
      ...importPatterns.map((p) => ({ ...p, project, source: "file-scan" })),
    )

    // Formatting detection
    const formatPatterns = await this.detectFormatting(files)
    patterns.push(
      ...formatPatterns.map((p) => ({ ...p, project, source: "file-scan" })),
    )

    // Config-based patterns
    const configPatterns = await this.detectFromConfigs()
    patterns.push(
      ...configPatterns.map((p) => ({ ...p, project, source: "config-file" })),
    )

    return patterns
  }

  private async getSourceFiles(
    dir: string,
    depth: number = 0,
  ): Promise<string[]> {
    if (depth > 5) return []
    const results: string[] = []

    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue

        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...(await this.getSourceFiles(fullPath, depth + 1)))
        } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
          results.push(fullPath)
        }
      }
    } catch {
      // Permission denied or similar
    }

    return results
  }

  private detectNamingConventions(
    files: string[],
  ): Omit<Pattern, "id" | "created_at" | "project" | "source">[] {
    const patterns: Omit<Pattern, "id" | "created_at" | "project" | "source">[] = []
    const basenames = files.map((f) => path.basename(f, path.extname(f)))

    let kebab = 0, camel = 0, pascal = 0, snake = 0
    for (const name of basenames) {
      if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) kebab++
      else if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camel++
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascal++
      else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) snake++
    }

    const total = basenames.length || 1
    const conventions = [
      { name: "kebab-case", count: kebab },
      { name: "camelCase", count: camel },
      { name: "PascalCase", count: pascal },
      { name: "snake_case", count: snake },
    ]

    const dominant = conventions.sort((a, b) => b.count - a.count)[0]
    if (dominant.count > 0) {
      patterns.push({
        pattern_type: "naming_convention",
        pattern_value: `Files use ${dominant.name} naming`,
        confidence: dominant.count / total,
        examples: basenames.filter((_, i) => i < 3).join(", "),
      })
    }

    return patterns
  }

  private async detectImportStyle(
    files: string[],
  ): Promise<Omit<Pattern, "id" | "created_at" | "project" | "source">[]> {
    const patterns: Omit<Pattern, "id" | "created_at" | "project" | "source">[] = []
    let esmCount = 0, cjsCount = 0
    const sampled = files.slice(0, 30)

    for (const file of sampled) {
      try {
        const content = await readFile(file, "utf-8")
        const esmMatches = content.match(/^import\s/gm)?.length || 0
        const cjsMatches = content.match(/require\(/gm)?.length || 0
        esmCount += esmMatches
        cjsCount += cjsMatches
      } catch {
        // Skip unreadable files
      }
    }

    const total = esmCount + cjsCount || 1
    if (esmCount > cjsCount) {
      patterns.push({
        pattern_type: "import_style",
        pattern_value: "ESM imports (import/export)",
        confidence: esmCount / total,
        examples: "import x from 'y'",
      })
    } else if (cjsCount > 0) {
      patterns.push({
        pattern_type: "import_style",
        pattern_value: "CommonJS imports (require)",
        confidence: cjsCount / total,
        examples: "const x = require('y')",
      })
    }

    return patterns
  }

  private async detectFormatting(
    files: string[],
  ): Promise<Omit<Pattern, "id" | "created_at" | "project" | "source">[]> {
    const patterns: Omit<Pattern, "id" | "created_at" | "project" | "source">[] = []
    let semiCount = 0, noSemiCount = 0
    let tabCount = 0, spaceCount = 0
    const sampled = files.slice(0, 20)

    for (const file of sampled) {
      try {
        const content = await readFile(file, "utf-8")
        const lines = content.split("\n")

        // Semicolons
        const statementsWithSemi = lines.filter((l) => l.trimEnd().endsWith(";")).length
        const statementsWithoutSemi = lines.filter(
          (l) => l.trim() && !l.trimEnd().endsWith(";") && !l.trimEnd().endsWith("{") && !l.trimEnd().endsWith("}") && !l.trimEnd().endsWith(",") && !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"),
        ).length
        semiCount += statementsWithSemi
        noSemiCount += statementsWithoutSemi

        // Indentation
        for (const line of lines) {
          if (line.startsWith("\t")) tabCount++
          else if (line.startsWith("  ")) spaceCount++
        }
      } catch {
        // Skip
      }
    }

    if (semiCount > noSemiCount * 2) {
      patterns.push({
        pattern_type: "formatting",
        pattern_value: "Uses semicolons",
        confidence: semiCount / (semiCount + noSemiCount || 1),
        examples: "const x = 1;",
      })
    } else if (noSemiCount > semiCount * 2) {
      patterns.push({
        pattern_type: "formatting",
        pattern_value: "No semicolons (ASI)",
        confidence: noSemiCount / (semiCount + noSemiCount || 1),
        examples: "const x = 1",
      })
    }

    if (spaceCount > tabCount) {
      patterns.push({
        pattern_type: "formatting",
        pattern_value: "Uses spaces for indentation",
        confidence: spaceCount / (spaceCount + tabCount || 1),
        examples: "  const x = 1",
      })
    } else if (tabCount > spaceCount) {
      patterns.push({
        pattern_type: "formatting",
        pattern_value: "Uses tabs for indentation",
        confidence: tabCount / (spaceCount + tabCount || 1),
        examples: "\\tconst x = 1",
      })
    }

    return patterns
  }

  private async detectFromConfigs(): Promise<
    Omit<Pattern, "id" | "created_at" | "project" | "source">[]
  > {
    const patterns: Omit<Pattern, "id" | "created_at" | "project" | "source">[] = []

    // Check tsconfig
    try {
      const tsconfig = JSON.parse(
        await readFile(path.join(this.repoPath, "tsconfig.json"), "utf-8"),
      )
      if (tsconfig?.compilerOptions?.strict) {
        patterns.push({
          pattern_type: "architecture",
          pattern_value: "TypeScript strict mode enabled",
          confidence: 1.0,
          examples: "tsconfig.json: strict: true",
        })
      }
    } catch {
      // No tsconfig
    }

    // Check for ESLint
    const eslintFiles = [".eslintrc", ".eslintrc.json", ".eslintrc.js", "eslint.config.js", "eslint.config.mjs"]
    for (const f of eslintFiles) {
      try {
        await stat(path.join(this.repoPath, f))
        patterns.push({
          pattern_type: "architecture",
          pattern_value: "Uses ESLint for linting",
          confidence: 1.0,
          examples: f,
        })
        break
      } catch {
        // File doesn't exist
      }
    }

    // Check for Prettier
    const prettierFiles = [".prettierrc", ".prettierrc.json", "prettier.config.js", "prettier.config.mjs"]
    for (const f of prettierFiles) {
      try {
        await stat(path.join(this.repoPath, f))
        patterns.push({
          pattern_type: "formatting",
          pattern_value: "Uses Prettier for formatting",
          confidence: 1.0,
          examples: f,
        })
        break
      } catch {
        // File doesn't exist
      }
    }

    return patterns
  }
}
