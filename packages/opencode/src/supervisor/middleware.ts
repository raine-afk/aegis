import type { Finding } from "./types"
import { Analyzer } from "./analyzer"
import { PatternStore } from "./store"
import path from "path"

export class SupervisorMiddleware {
  private analyzer: Analyzer
  private store: PatternStore
  private findings: Finding[] = []
  private enabled: boolean = true

  constructor(store: PatternStore) {
    this.store = store
    const patterns = store.getPatterns()
    this.analyzer = new Analyzer(patterns)
  }

  /**
   * Review proposed file content before it's written.
   * Returns findings. Critical findings should block the write.
   */
  reviewWrite(filePath: string, content: string): Finding[] {
    if (!this.enabled) return []
    const findings = this.analyzer.analyzeCode(content, filePath)
    this.findings.push(...findings)
    return findings
  }

  /**
   * Review a patch/edit before it's applied.
   * Analyzes the new content that will result from the edit.
   */
  reviewEdit(filePath: string, newContent: string): Finding[] {
    if (!this.enabled) return []
    return this.reviewWrite(filePath, newContent)
  }

  /**
   * Generate a fix prompt to inject into the agent's context
   * when critical or warning findings are detected.
   */
  generateIntervention(findings: Finding[]): string | null {
    const critical = findings.filter((f) => f.severity === "critical")
    const warnings = findings.filter((f) => f.severity === "warning")

    if (critical.length === 0 && warnings.length === 0) return null

    const lines: string[] = [
      "⚠️ SUPERVISOR REVIEW — Issues detected in your recent changes:\n",
    ]

    if (critical.length > 0) {
      lines.push("🔴 CRITICAL (must fix before proceeding):")
      for (const f of critical) {
        lines.push(`  - ${f.message} (${f.file}${f.line ? `:${f.line}` : ""})`)
        if (f.suggestion) lines.push(`    💡 ${f.suggestion}`)
      }
      lines.push("")
    }

    if (warnings.length > 0) {
      lines.push("🟡 WARNINGS (should fix):")
      for (const f of warnings) {
        lines.push(`  - ${f.message} (${f.file}${f.line ? `:${f.line}` : ""})`)
        if (f.suggestion) lines.push(`    💡 ${f.suggestion}`)
      }
      lines.push("")
    }

    lines.push("Please fix these issues in your implementation.")

    return lines.join("\n")
  }

  /**
   * Check if findings contain any critical issues that should block execution.
   */
  shouldBlock(findings: Finding[]): boolean {
    return findings.some((f) => f.severity === "critical")
  }

  /**
   * Get all accumulated findings.
   */
  getFindings(): Finding[] {
    return [...this.findings]
  }

  /**
   * Clear accumulated findings.
   */
  clearFindings(): void {
    this.findings = []
  }

  /**
   * Enable/disable the supervisor.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Reload patterns from store (call after learning new patterns).
   */
  reloadPatterns(): void {
    const patterns = this.store.getPatterns()
    this.analyzer = new Analyzer(patterns)
  }
}
