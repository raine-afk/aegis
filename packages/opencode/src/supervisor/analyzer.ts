import type { Finding, Pattern } from "./types"
import path from "path"

// Security patterns — things that should never appear in code
const SECURITY_RULES: Array<{
  name: string
  pattern: RegExp
  severity: "critical" | "warning"
  message: string
  suggestion: string
}> = [
  {
    name: "hardcoded-secret",
    pattern: /(?:password|secret|api_key|apikey|token|private_key)\s*[:=]\s*["'][^"']{4,}["']/gi,
    severity: "critical",
    message: "Hardcoded secret or password detected",
    suggestion: "Use environment variables or a secrets manager instead",
  },
  {
    name: "sql-injection",
    pattern: /(?:query|execute|run)\s*\(\s*`[^`]*\$\{/gi,
    severity: "critical",
    message: "Potential SQL injection — string interpolation in query",
    suggestion: "Use parameterized queries with placeholders (?, $1)",
  },
  {
    name: "eval-usage",
    pattern: /\beval\s*\(/g,
    severity: "critical",
    message: "eval() usage detected — arbitrary code execution risk",
    suggestion: "Use JSON.parse() for data, or a safe parser for expressions",
  },
  {
    name: "innerhtml",
    pattern: /\.innerHTML\s*=/g,
    severity: "warning",
    message: "innerHTML assignment — XSS risk",
    suggestion: "Use textContent or a sanitization library",
  },
  {
    name: "cors-wildcard",
    pattern: /['"]Access-Control-Allow-Origin['"]\s*[:=]\s*['"]\*['"]/g,
    severity: "warning",
    message: "CORS wildcard (*) allows any origin",
    suggestion: "Restrict to specific allowed origins",
  },
]

// Quality patterns
const QUALITY_RULES: Array<{
  name: string
  check: (content: string, lines: string[]) => Finding | null
}> = [
  {
    name: "excessive-any",
    check: (content) => {
      const anyCount = (content.match(/:\s*any\b/g) || []).length
      if (anyCount > 3) {
        return {
          severity: "warning",
          rule: "excessive-any",
          message: `${anyCount} uses of 'any' type — weakens type safety`,
          file: "",
          suggestion: "Replace with specific types, unknown, or generics",
        }
      }
      return null
    },
  },
  {
    name: "deep-nesting",
    check: (_content, lines) => {
      let maxIndent = 0
      for (const line of lines) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0
        if (indent > maxIndent) maxIndent = indent
      }
      if (maxIndent > 20) {
        return {
          severity: "warning",
          rule: "deep-nesting",
          message: `Deep nesting detected (${Math.floor(maxIndent / 2)} levels)`,
          file: "",
          suggestion: "Extract helper functions or use early returns to reduce nesting",
        }
      }
      return null
    },
  },
  {
    name: "large-file",
    check: (_content, lines) => {
      if (lines.length > 500) {
        return {
          severity: "info",
          rule: "large-file",
          message: `File is ${lines.length} lines long`,
          file: "",
          suggestion: "Consider splitting into smaller, focused modules",
        }
      }
      return null
    },
  },
  {
    name: "console-log",
    check: (content) => {
      const count = (content.match(/console\.(log|debug|info)\(/g) || []).length
      if (count > 5) {
        return {
          severity: "info",
          rule: "console-log",
          message: `${count} console.log statements — clean up before shipping`,
          file: "",
          suggestion: "Use a proper logging library or remove debug statements",
        }
      }
      return null
    },
  },
  {
    name: "todo-fixme",
    check: (content) => {
      const count = (content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)\b/gi) || []).length
      if (count > 3) {
        return {
          severity: "info",
          rule: "todo-fixme",
          message: `${count} TODO/FIXME comments — technical debt markers`,
          file: "",
          suggestion: "Address or track these in an issue tracker",
        }
      }
      return null
    },
  },
]

export class Analyzer {
  private patterns: Pattern[]

  constructor(patterns: Pattern[] = []) {
    this.patterns = patterns
  }

  analyzeCode(content: string, filePath: string): Finding[] {
    const findings: Finding[] = []
    const lines = content.split("\n")

    // Run security checks
    for (const rule of SECURITY_RULES) {
      const matches = content.matchAll(rule.pattern)
      for (const match of matches) {
        const lineNum = content.substring(0, match.index).split("\n").length
        findings.push({
          severity: rule.severity,
          rule: rule.name,
          message: rule.message,
          file: filePath,
          line: lineNum,
          suggestion: rule.suggestion,
        })
      }
    }

    // Run quality checks
    for (const rule of QUALITY_RULES) {
      const finding = rule.check(content, lines)
      if (finding) {
        findings.push({ ...finding, file: filePath })
      }
    }

    // Always add a "heartbeat" finding to prove the supervisor is alive (DEBUG)
    findings.push({
      severity: "info",
      rule: "supervisor-active",
      message: "🛡️ Aegis Supervisor is actively monitoring this change",
      file: filePath,
      suggestion: "This is a status marker to confirm the real-time hook is working.",
    })

    // Run convention checks against learned patterns
    this.checkConventions(content, filePath, findings)

    return findings
  }

  private checkConventions(content: string, filePath: string, findings: Finding[]): void {
    const basename = path.basename(filePath, path.extname(filePath))

    for (const pattern of this.patterns) {
      switch (pattern.pattern_type) {
        case "naming_convention": {
          if (pattern.pattern_value.includes("kebab-case") && !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(basename) && !/^index$/.test(basename)) {
            // Only flag PascalCase/camelCase files if project uses kebab-case
            if (/[A-Z]/.test(basename)) {
              findings.push({
                severity: "warning",
                rule: "naming-convention",
                message: `File "${basename}" doesn't match project's kebab-case convention`,
                file: filePath,
                suggestion: `Rename to: ${basename.replace(/([A-Z])/g, (m, c, i) => (i > 0 ? "-" : "") + c.toLowerCase())}${path.extname(filePath)}`,
              })
            }
          }
          break
        }

        case "import_style": {
          if (pattern.pattern_value.includes("ESM") && /\brequire\s*\(/.test(content)) {
            findings.push({
              severity: "warning",
              rule: "import-consistency",
              message: "File uses require() but project convention is ESM imports",
              file: filePath,
              suggestion: 'Convert to ESM: import x from "module"',
            })
          }
          break
        }

        case "formatting": {
          if (pattern.pattern_value.includes("semicolons") && pattern.pattern_value !== "No semicolons (ASI)") {
            // Check if significant lines are missing semicolons
            const statementsWithout = lines.filter(
              (l) =>
                l.trim() &&
                !l.trimEnd().endsWith(";") &&
                !l.trimEnd().endsWith("{") &&
                !l.trimEnd().endsWith("}") &&
                !l.trimEnd().endsWith("(") &&
                !l.trimEnd().endsWith(",") &&
                !l.trim().startsWith("//") &&
                !l.trim().startsWith("*") &&
                !l.trim().startsWith("/*") &&
                !l.trim().startsWith("import") &&
                !l.trim().startsWith("export") &&
                /^(const|let|var|return|throw)\s/.test(l.trim()),
            ).length

            if (statementsWithout > 3) {
              findings.push({
                severity: "info",
                rule: "formatting-consistency",
                message: `${statementsWithout} statements missing semicolons — project uses semicolons`,
                file: filePath,
                suggestion: "Add semicolons to match project convention",
              })
            }
          }
          break
        }
      }
    }
  }

  analyzeChanges(changes: Array<{ content?: string; relativePath: string }>): Finding[] {
    const findings: Finding[] = []
    for (const change of changes) {
      if (change.content) {
        findings.push(...this.analyzeCode(change.content, change.relativePath))
      }
    }
    return findings
  }
}
