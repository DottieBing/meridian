import type { Severity } from '@meridian/db'

export const SCORE_METHOD_VERSION = 'website-score/1'

export const SEVERITY_POINTS: Record<Severity, number> = { critical: 50, high: 30, medium: 15, low: 6, info: 1 }
/** A judgement call costs half of what an observed fact of the same severity costs. */
export const JUDGEMENT_FACTOR = 0.5
export const CATEGORY_WEIGHTS: Record<string, number> = {
  security: 20,
  performance: 20,
  seo: 20,
  accessibility: 15,
  technical: 15,
  ux: 10,
}

export type ScoreInput = { code: string; category: string; severity: Severity; isObjective: boolean }
export type CategoryScore = { score: number; points: number; findings: number }
export type ScoreBand = 'good' | 'fair' | 'weak' | 'poor'
export type WebsiteScores = {
  method: string
  health: number
  band: ScoreBand
  categories: Record<string, CategoryScore>
  /** Only findings that cost points, so every deduction can be shown next to its finding. */
  points: { code: string; category: string; points: number }[]
}

export function findingPoints(severity: Severity, isObjective: boolean): number {
  return SEVERITY_POINTS[severity] * (isObjective ? 1 : JUDGEMENT_FACTOR)
}

export function bandOf(health: number): ScoreBand {
  return health >= 90 ? 'good' : health >= 75 ? 'fair' : health >= 50 ? 'weak' : 'poor'
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function scoreFindings(findings: ScoreInput[]): WebsiteScores {
  const categories: Record<string, CategoryScore> = {}
  for (const cat of Object.keys(CATEGORY_WEIGHTS)) categories[cat] = { score: 100, points: 0, findings: 0 }

  const points: WebsiteScores['points'] = []
  for (const f of findings) {
    const c = categories[f.category]
    if (!c) continue
    const p = findingPoints(f.severity, f.isObjective)
    c.points += p
    c.findings += 1
    if (p > 0) points.push({ code: f.code, category: f.category, points: round1(p) })
  }

  let sum = 0
  let total = 0
  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const c = categories[cat]
    if (!c) continue
    c.points = round1(c.points)
    c.score = Math.max(0, Math.round(100 - c.points))
    sum += c.score * weight
    total += weight
  }
  const health = Math.round(sum / total)
  return { method: SCORE_METHOD_VERSION, health, band: bandOf(health), categories, points }
}