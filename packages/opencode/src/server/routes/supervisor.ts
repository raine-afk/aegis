import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod"
import { getSessionFindings, clearSessionFindings } from "../../supervisor/event"
import { lazy } from "../../util/lazy"

const FindingSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  rule: z.string(),
  message: z.string(),
  file: z.string(),
  line: z.number().optional(),
  suggestion: z.string().optional(),
})

const FindingsEntrySchema = z.object({
  file: z.string(),
  findings: z.array(FindingSchema),
  timestamp: z.number(),
})

export const SupervisorRoutes = lazy(() =>
  new Hono()
    .get("/", (c) => c.redirect("/findings", 302))
    .get(
      "/findings",
      describeRoute({
        summary: "Get supervisor findings",
        description: "Get all supervisor findings from the current session.",
        operationId: "supervisor.findings",
        responses: {
          200: {
            description: "List of supervisor findings",
            content: {
              "application/json": {
                schema: resolver(z.array(FindingsEntrySchema)),
              },
            },
          },
        },
      }),
      async (c) => {
        const findings = getSessionFindings()
        return c.json(findings)
      },
    )
    .delete(
      "/findings",
      describeRoute({
        summary: "Clear supervisor findings",
        description: "Clear all supervisor findings from the current session.",
        operationId: "supervisor.clearFindings",
        responses: {
          200: {
            description: "Findings cleared",
          },
        },
      }),
      async (c) => {
        clearSessionFindings()
        return c.json({ ok: true })
      },
    ),
)
