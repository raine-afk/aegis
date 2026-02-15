/**
 * Supervisor integration hooks for OpenCode's tool system.
 *
 * This module provides hooks that intercept file write/edit operations,
 * run them through the supervisor analyzer, and inject findings back
 * into the agent's context when issues are detected.
 */

import { Bus } from "../bus"
import { Log } from "../util/log"
import { SupervisorMiddleware } from "./middleware"
import { PatternStore } from "./store"
import { PatternExtractor } from "./extractor"
import type { Finding } from "./types"
import { Instance } from "../project/instance"
import { SupervisorEvent, recordFindings } from "./event"
import path from "path"

const log = Log.create({ service: "supervisor" })

export namespace SupervisorHooks {
  let middleware: SupervisorMiddleware | null = null
  let initialized = false

  /**
   * Initialize the supervisor for the current project.
   * Learns patterns on first run, then creates the middleware.
   */
  export async function init(): Promise<void> {
    if (initialized) return

    const dbPath = path.join(Instance.directory, ".aegis", "supervisor.db")
    // Ensure .aegis directory exists
    await Bun.write(path.join(Instance.directory, ".aegis", ".gitkeep"), "")

    const store = new PatternStore(dbPath)
    const project = path.basename(Instance.directory)

    // Auto-learn patterns if none exist for this project
    const existing = store.getPatternsByProject(project)
    if (existing.length === 0) {
      log.info("auto-learning patterns for project", { project })
      const extractor = new PatternExtractor(Instance.directory)
      const patterns = await extractor.extractAll()

      for (const p of patterns) {
        store.addPattern(p.project, p.pattern_type, p.pattern_value, p.confidence, p.examples, p.source)
      }
      log.info("learned patterns", { count: patterns.length, project })
    }

    middleware = new SupervisorMiddleware(store)
    initialized = true

    const patternCount = store.getPatterns().length
    log.info("supervisor initialized", { project, patterns: patternCount })

    // Publish initial status
    Bus.publish(SupervisorEvent.Status, {
      enabled: true,
      patternCount,
      totalFindings: 0,
      criticalCount: 0,
    })
  }

  /**
   * Review a file write operation.
   * Called by the write tool before committing changes.
   * Returns findings and an optional intervention message.
   */
  export function reviewWrite(
    filePath: string,
    content: string,
  ): { findings: Finding[]; intervention: string | null; shouldBlock: boolean } {
    if (!middleware) return { findings: [], intervention: null, shouldBlock: false }

    const findings = middleware.reviewWrite(filePath, content)
    const intervention = middleware.generateIntervention(findings)
    const shouldBlock = middleware.shouldBlock(findings)

    if (findings.length > 0) {
      log.info("supervisor findings", {
        file: filePath,
        total: findings.length,
        critical: findings.filter((f) => f.severity === "critical").length,
        warnings: findings.filter((f) => f.severity === "warning").length,
      })

      // Record for session history
      recordFindings(filePath, findings)

      // Publish to bus for TUI consumption
      Bus.publish(SupervisorEvent.Finding, {
        file: filePath,
        findings,
        intervention,
        shouldBlock,
      })
    }

    return { findings, intervention, shouldBlock }
  }

  /**
   * Get all accumulated findings from the current session.
   */
  export function getFindings(): Finding[] {
    return middleware?.getFindings() ?? []
  }

  /**
   * Clear findings (e.g., after agent acknowledges them).
   */
  export function clearFindings(): void {
    middleware?.clearFindings()
  }
}
