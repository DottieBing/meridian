import { RULES } from './rules'
import type { AuditContext, FindingDraft } from './types'
import { isScriptRendered } from './placeholder'
import { SHELL_SENSITIVE } from './rules/shell'

export const AUDIT_METHOD_VERSION = 'website-audit/1'

export function runRules(ctx: AuditContext): {
  findings: FindingDraft[]
  errors: { rule: string; message: string }[]
} {
  const findings: FindingDraft[] = []
  const errors: { rule: string; message: string }[] = []
  for (const rule of RULES) {
    try {
      findings.push(...rule.run(ctx))
    } catch (e) {
      errors.push({ rule: rule.id, message: e instanceof Error ? e.message : String(e) })
    }
  }
    const shell = isScriptRendered(ctx.home.html)
  return { findings: shell ? findings.filter((f) => !SHELL_SENSITIVE.has(f.code)) : findings, errors }
}