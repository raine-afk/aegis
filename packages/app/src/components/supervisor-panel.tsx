import { For, Show, createSignal, onMount, onCleanup, createMemo } from "solid-js"

interface Finding {
  severity: "critical" | "warning" | "info"
  rule: string
  message: string
  file: string
  line?: number
  suggestion?: string
}

interface FindingsEntry {
  file: string
  findings: Finding[]
  timestamp: number
}

export function SupervisorPanel() {
  const [entries, setEntries] = createSignal<FindingsEntry[]>([])
  const [loading, setLoading] = createSignal(true)

  const fetchFindings = async () => {
    try {
      const res = await fetch("/api/supervisor/findings")
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch {
      // Server may not be ready
    } finally {
      setLoading(false)
    }
  }

  // Poll every 3 seconds for new findings
  let interval: ReturnType<typeof setInterval>
  onMount(() => {
    fetchFindings()
    interval = setInterval(fetchFindings, 3000)
  })
  onCleanup(() => clearInterval(interval))

  const totalFindings = createMemo(() =>
    entries().reduce((sum, e) => sum + e.findings.length, 0),
  )
  const criticalCount = createMemo(() =>
    entries().reduce(
      (sum, e) => sum + e.findings.filter((f) => f.severity === "critical").length,
      0,
    ),
  )
  const warningCount = createMemo(() =>
    entries().reduce(
      (sum, e) => sum + e.findings.filter((f) => f.severity === "warning").length,
      0,
    ),
  )

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴"
      case "warning":
        return "🟡"
      case "info":
        return "🔵"
      default:
        return "⚪"
    }
  }

  return (
    <div class="supervisor-panel" style={{ padding: "12px", "font-size": "13px" }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "12px",
        }}
      >
        <h3 style={{ margin: "0", "font-size": "14px", "font-weight": "600" }}>
          🛡️ Aegis Supervisor
        </h3>
        <Show when={totalFindings() > 0}>
          <span
            style={{
              "font-size": "12px",
              color: criticalCount() > 0 ? "var(--color-danger)" : "var(--color-warning)",
            }}
          >
            {totalFindings()} finding{totalFindings() !== 1 ? "s" : ""}
          </span>
        </Show>
      </div>

      <Show when={loading()}>
        <p style={{ color: "var(--color-muted)", "font-size": "12px" }}>Loading...</p>
      </Show>

      <Show when={!loading() && totalFindings() === 0}>
        <div
          style={{
            padding: "24px",
            "text-align": "center",
            color: "var(--color-muted)",
            "font-size": "12px",
          }}
        >
          <p style={{ margin: "0 0 4px 0" }}>✅ No issues detected</p>
          <p style={{ margin: "0" }}>Supervisor is watching for problems</p>
        </div>
      </Show>

      <Show when={!loading() && totalFindings() > 0}>
        {/* Summary bar */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "8px",
            background: "var(--color-surface)",
            "border-radius": "6px",
            "margin-bottom": "12px",
            "font-size": "12px",
          }}
        >
          <Show when={criticalCount() > 0}>
            <span>🔴 {criticalCount()} critical</span>
          </Show>
          <Show when={warningCount() > 0}>
            <span>🟡 {warningCount()} warnings</span>
          </Show>
          <span>
            🔵 {totalFindings() - criticalCount() - warningCount()} info
          </span>
        </div>

        {/* Findings list */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <For each={entries().slice().reverse()}>
            {(entry) => (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  "border-radius": "6px",
                  padding: "8px",
                }}
              >
                <div
                  style={{
                    "font-size": "11px",
                    color: "var(--color-muted)",
                    "margin-bottom": "6px",
                  }}
                >
                  {entry.file.split("/").slice(-2).join("/")}
                </div>
                <For each={entry.findings}>
                  {(finding) => (
                    <div
                      style={{
                        padding: "4px 0",
                        "border-bottom": "1px solid var(--color-border-subtle, rgba(255,255,255,0.05))",
                      }}
                    >
                      <div style={{ display: "flex", gap: "6px", "align-items": "start" }}>
                        <span>{severityIcon(finding.severity)}</span>
                        <div>
                          <div style={{ "font-size": "12px" }}>
                            {finding.message}
                            <Show when={finding.line}>
                              <span style={{ color: "var(--color-muted)", "margin-left": "4px" }}>
                                :{finding.line}
                              </span>
                            </Show>
                          </div>
                          <Show when={finding.suggestion}>
                            <div
                              style={{
                                "font-size": "11px",
                                color: "var(--color-muted)",
                                "margin-top": "2px",
                              }}
                            >
                              💡 {finding.suggestion}
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
