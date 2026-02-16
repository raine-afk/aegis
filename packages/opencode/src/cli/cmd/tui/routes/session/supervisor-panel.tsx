import { createMemo, For, Show, createSignal, onMount, onCleanup } from "solid-js"
import { useTheme } from "../../context/theme"
import { getSessionFindings } from "../../../../../supervisor/event"

export function SupervisorPanel() {
  const { theme } = useTheme()

  // Poll supervisor findings every 2 seconds
  const [supervisorFindings, setSupervisorFindings] = createSignal(getSessionFindings())
  let svInterval: ReturnType<typeof setInterval>
  onMount(() => {
    svInterval = setInterval(() => setSupervisorFindings(getSessionFindings()), 2000)
  })
  onCleanup(() => clearInterval(svInterval))

  const findings = createMemo(() => {
    return supervisorFindings().slice().reverse().flatMap(entry => 
      entry.findings.map(finding => ({
        ...finding,
        timestamp: entry.timestamp
      }))
    )
  })

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      width={42}
      height="100%"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      paddingRight={2}
      border={["left"]}
      borderColor={theme.border}
    >
      <box flexShrink={0} paddingBottom={1}>
        <text fg={theme.text}>
          <b>🛡️ Supervisor Findings</b>
        </text>
      </box>
      
      <scrollbox flexGrow={1}>
        <Show when={findings().length === 0}>
          <text fg={theme.textMuted}>No findings yet.</text>
        </Show>
        <box gap={1}>
          <For each={findings()}>
            {(finding) => (
              <box border={["bottom"]} borderColor={theme.backgroundElement} paddingBottom={1} marginBottom={1} gap={0}>
                <box flexDirection="row" gap={1}>
                  <text
                    flexShrink={0}
                    style={{
                      fg: finding.severity === "critical"
                        ? theme.error
                        : finding.severity === "warning"
                          ? theme.warning
                          : theme.textMuted,
                    }}
                  >
                    {finding.severity === "critical" ? "🔴" : finding.severity === "warning" ? "🟡" : "🔵"}
                  </text>
                  <text fg={theme.text} wrapMode="word">
                    <b>{finding.message}</b>
                  </text>
                </box>
                <box paddingLeft={3}>
                   <text fg={theme.textMuted} wrapMode="word">
                    {finding.file}{finding.line ? `:${finding.line}` : ""}
                  </text>
                  <Show when={finding.suggestion}>
                    <text fg={theme.textMuted} italic={true} wrapMode="word">
                      Tip: {finding.suggestion}
                    </text>
                  </Show>
                </box>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </box>
  )
}
