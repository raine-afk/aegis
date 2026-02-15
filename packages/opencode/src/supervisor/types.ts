export type Severity = "critical" | "warning" | "info"

export type PatternType =
  | "naming_convention"
  | "import_style"
  | "formatting"
  | "error_handling"
  | "architecture"
  | "security"
  | "testing"

export interface Finding {
  severity: Severity
  rule: string
  message: string
  file: string
  line?: number
  suggestion?: string
}

export interface Pattern {
  id?: number
  project: string
  pattern_type: PatternType
  pattern_value: string
  confidence: number
  examples: string
  source: string
  created_at?: string
}
