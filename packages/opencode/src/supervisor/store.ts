import { Database } from "bun:sqlite"
import type { Pattern, PatternType } from "./types"
import path from "path"

export class PatternStore {
  private db: Database

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(process.cwd(), "aegis-supervisor.db")
    this.db = new Database(resolvedPath)
    this.init()
  }

  init(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        pattern_value TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        examples TEXT DEFAULT '',
        source TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_patterns_project ON patterns(project)
    `)
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type)
    `)
  }

  addPattern(
    project: string,
    patternType: PatternType,
    patternValue: string,
    confidence: number,
    examples: string = "",
    source: string = "",
  ): void {
    this.db.run(
      `INSERT INTO patterns (project, pattern_type, pattern_value, confidence, examples, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project, patternType, patternValue, confidence, examples, source],
    )
  }

  getPatterns(): Pattern[] {
    return this.db.query("SELECT * FROM patterns ORDER BY confidence DESC").all() as Pattern[]
  }

  getPatternsByType(patternType: PatternType): Pattern[] {
    return this.db
      .query("SELECT * FROM patterns WHERE pattern_type = ? ORDER BY confidence DESC")
      .all(patternType) as Pattern[]
  }

  getPatternsByProject(project: string): Pattern[] {
    return this.db
      .query("SELECT * FROM patterns WHERE project = ? ORDER BY confidence DESC")
      .all(project) as Pattern[]
  }

  clearProject(project: string): void {
    this.db.run("DELETE FROM patterns WHERE project = ?", [project])
  }

  close(): void {
    this.db.close()
  }
}
