import { z } from "zod"
import { BusEvent } from "../bus/bus-event"
import { Bus } from "../bus"
import { Log } from "../util/log"
import type { Finding } from "./types"

const log = Log.create({ service: "supervisor.event" })

export namespace SupervisorEvent {
  export const Finding = BusEvent.define(
    "supervisor.finding",
    z.object({
      file: z.string(),
      findings: z.array(
        z.object({
          severity: z.enum(["critical", "warning", "info"]),
          rule: z.string(),
          message: z.string(),
          file: z.string(),
          line: z.number().optional(),
          suggestion: z.string().optional(),
        }),
      ),
      intervention: z.string().nullable(),
      shouldBlock: z.boolean(),
    }),
  )

  export const Status = BusEvent.define(
    "supervisor.status",
    z.object({
      enabled: z.boolean(),
      patternCount: z.number(),
      totalFindings: z.number(),
      criticalCount: z.number(),
    }),
  )
}

// In-memory findings store for the current session
let sessionFindings: Array<{
  file: string
  findings: Finding[]
  timestamp: number
}> = []

export function recordFindings(file: string, findings: Finding[]): void {
  if (findings.length === 0) return

  sessionFindings.push({
    file,
    findings,
    timestamp: Date.now(),
  })

  // Keep last 100 entries
  if (sessionFindings.length > 100) {
    sessionFindings = sessionFindings.slice(-100)
  }
}

export function getSessionFindings() {
  return sessionFindings
}

export function clearSessionFindings() {
  sessionFindings = []
}
