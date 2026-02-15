import path from "path"
import { PatternExtractor } from "./extractor"
import { PatternStore } from "./store"

/**
 * Learn patterns from a target codebase directory.
 * Extracts conventions and stores them in the supervisor database.
 */
export async function learn(targetPath: string, dbPath?: string): Promise<void> {
  const resolved = path.resolve(targetPath)
  const project = path.basename(resolved)
  const db = dbPath || path.join(resolved, ".aegis", "supervisor.db")

  console.log(`\n🔍 Aegis: Learning patterns from ${resolved}\n`)

  const store = new PatternStore(db)
  const extractor = new PatternExtractor(resolved)

  // Clear existing patterns for this project
  store.clearProject(project)

  const patterns = await extractor.extractAll()

  for (const p of patterns) {
    store.addPattern(
      p.project,
      p.pattern_type,
      p.pattern_value,
      p.confidence,
      p.examples,
      p.source,
    )
  }

  // Print summary
  console.log(`  Pattern Type          | Value                                    | Confidence`)
  console.log(`  ─────────────────────┼──────────────────────────────────────────┼───────────`)

  for (const p of patterns) {
    const type = p.pattern_type.padEnd(21)
    const value = p.pattern_value.substring(0, 40).padEnd(40)
    const conf = (p.confidence * 100).toFixed(0).padStart(5) + "%"
    console.log(`  ${type}| ${value} | ${conf}`)
  }

  console.log(`\n  ✅ Learned ${patterns.length} patterns from "${project}"`)
  console.log(`  📦 Stored in: ${db}\n`)

  store.close()
}
