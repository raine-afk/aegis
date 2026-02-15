import { z } from "zod"

export const SupervisorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().optional(),
  strictness: z.enum(["strict", "moderate", "lenient"]).default("moderate"),
  autoLearn: z.boolean().default(true),
})

export type SupervisorConfig = z.infer<typeof SupervisorConfigSchema>

const DEFAULT_CONFIG: SupervisorConfig = {
  enabled: true,
  strictness: "moderate",
  autoLearn: true,
}

export function getConfig(raw?: Partial<SupervisorConfig>): SupervisorConfig {
  if (!raw) return DEFAULT_CONFIG
  return SupervisorConfigSchema.parse({ ...DEFAULT_CONFIG, ...raw })
}
