import { clip } from '../helpers'
import type { FindingDraft, FindingEvidence } from '../types'
import type { BrowserMeasurement } from './measure'

export const BROWSER_METHOD_VERSION = 'browser-audit/1'

export type BrowserContext = { screenshotRel: string | null }
export type BrowserRule = { id: string; run: (m: BrowserMeasurement, ctx: BrowserContext) => FindingDraft[] }

function evidenceFor(
  m: BrowserMeasurement,
  ctx: BrowserContext,
  excerpt: string,
  measurement: Record<string, unknown>,
  withScreenshot = false,
): FindingEvidence {
  const base = { sourceUrl: m.finalUrl, excerpt: clip(excerpt), measurement }
  return withScreenshot && ctx.screenshotRel
    ? { kind: 'screenshot', method: 'browser-audit:screenshot', storagePath: ctx.screenshotRel, ...base }
    : { kind: 'measurement', method: 'browser-audit:measure', ...base }
}

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const notResponsive: BrowserRule = {
  id: 'mobile.layout.not_responsive',
  run(m, ctx) {
    if (m.layoutWidth <= 600) return []
    return [
      {
        code: 'mobile.layout.not_responsive',
        category: 'ux',
        severity: 'high',
        isObjective: true,
        title: `The page does not adapt to a phone screen (it is laid out ${m.layoutWidth} px wide)`,
        detail: `On a ${m.viewport.width} px wide phone, the browser had to lay this page out at ${m.layoutWidth} px and shrink it to fit, so text and buttons look tiny and visitors have to pinch and zoom. This usually means the page has no mobile viewport setting or uses a fixed-width design. The screenshot shows what a phone displays.`,
        affectedUrl: m.finalUrl,
        confidence: 90,
        evidence: evidenceFor(
          m,
          ctx,
          `Layout width ${m.layoutWidth} px on a ${m.viewport.width} px screen`,
          { layoutWidth: m.layoutWidth, viewportWidth: m.viewport.width },
          true,
        ),
      },
    ]
  },
}

const overflow: BrowserRule = {
  id: 'mobile.overflow.horizontal',
  run(m, ctx) {
    const px = m.overflow.pixels
    if (!m.overflow.scrollable || px < 8) return []
    const culprits = m.overflow.offenders.map((o) => `${o.el} (ends at ${o.right}px)`).join('\n')
    return [
      {
        code: 'mobile.overflow.horizontal',
        category: 'ux',
        severity: px >= 60 ? 'medium' : 'low',
        isObjective: true,
        title: `The page scrolls sideways on a phone (${px} px wider than the screen)`,
        detail: `On a ${m.viewport.width} px wide phone the page is wider than the screen, so visitors can drag it sideways. This usually comes from an image, table, embed or fixed-width block that does not shrink. The screenshot shows the page as a phone renders it.`,
        affectedUrl: m.finalUrl,
        confidence: 85,
        evidence: evidenceFor(m, ctx, culprits || 'No single element identified', { overflowPx: px, offenders: m.overflow.offenders }, true),
      },
    ]
  },
}

const layoutShift: BrowserRule = {
  id: 'mobile.layout_shift.high',
  run(m, ctx) {
    const cls = m.cls
    if (cls === null || cls <= 0.1) return []
    return [
      {
        code: 'mobile.layout_shift.high',
        category: 'ux',
        severity: cls > 0.25 ? 'medium' : 'low',
        isObjective: false,
        title: `Content jumps around while the page loads (layout shift ${cls})`,
        detail:
          'Layout shift measures how much visible content moves unexpectedly while a page loads. Google rates up to 0.1 as good and above 0.25 as poor. This was measured in one lab run from the machine running Meridian, so re-test before relying on it.',
        affectedUrl: m.finalUrl,
        confidence: 60,
        evidence: evidenceFor(m, ctx, `Cumulative layout shift: ${cls}`, { cls }),
      },
    ]
  },
}

const pageWeight: BrowserRule = {
  id: 'performance.page_weight.heavy',
  run(m, ctx) {
    const mb = m.transferBytes / 1e6
    if (mb <= 4) return []
    return [
      {
        code: 'performance.page_weight.heavy',
        category: 'performance',
        severity: mb > 10 ? 'medium' : 'low',
        isObjective: true,
        title: `The page downloads ${mb.toFixed(1)} MB when opened on a phone`,
        detail: `Loading the page and waiting a few seconds transferred ${mb.toFixed(1)} MB across ${m.requests} requests. Heavy pages are slow and costly on mobile data. The 4 MB and 10 MB thresholds are our judgement. The figure comes from a single lab run.`,
        affectedUrl: m.finalUrl,
        confidence: 80,
        evidence: evidenceFor(m, ctx, `Transferred ${mb.toFixed(2)} MB in ${m.requests} requests`, {
          transferBytes: m.transferBytes,
          requests: m.requests,
        }),
      },
    ]
  },
}

const firstPartyFailures: BrowserRule = {
  id: 'mobile.resources.failed',
  run(m, ctx) {
    const site = hostOf(m.finalUrl)
    const failed = m.failedRequests.filter((f) => {
      const h = hostOf(f.url)
      return site !== '' && h !== '' && (h === site || h.endsWith(`.${site}`))
    })
    if (failed.length === 0) return []
    const n = failed.length
    return [
      {
        code: 'mobile.resources.failed',
        category: 'technical',
        severity: 'low',
        isObjective: true,
        title: `${n} file${n === 1 ? '' : 's'} on the site's own domain fail${n === 1 ? 's' : ''} to load`,
        detail:
          'Files the page asks for from its own domain returned errors, for example a missing stylesheet or script. That can break styling or features. Third-party services are not counted here.',
        affectedUrl: m.finalUrl,
        confidence: 85,
        evidence: evidenceFor(m, ctx, failed.slice(0, 5).map((f) => `${f.reason} ${f.url}`).join('\n'), {
          failed: failed.slice(0, 10),
        }),
      },
    ]
  },
}

const jsErrors: BrowserRule = {
  id: 'mobile.js.errors',
  run(m, ctx) {
    const errs = [...m.pageErrors, ...m.consoleErrors]
    if (errs.length === 0) return []
    return [
      {
        code: 'mobile.js.errors',
        category: 'technical',
        severity: 'info',
        isObjective: true,
        title: `${errs.length} JavaScript error${errs.length === 1 ? '' : 's'} appear in the browser console on load`,
        detail:
          'The page logs errors in the browser console when it loads. Some come from third-party widgets and are harmless, others break features. Shown for context, and it barely affects the score.',
        affectedUrl: m.finalUrl,
        confidence: 80,
        evidence: evidenceFor(m, ctx, errs.slice(0, 3).join('\n'), { count: errs.length, sample: errs.slice(0, 5) }),
      },
    ]
  },
}

export const BROWSER_RULES: BrowserRule[] = [notResponsive, overflow, layoutShift, pageWeight, firstPartyFailures, jsErrors]

export function runBrowserRules(
  m: BrowserMeasurement,
  ctx: BrowserContext,
): { findings: FindingDraft[]; errors: { rule: string; message: string }[] } {
  const findings: FindingDraft[] = []
  const errors: { rule: string; message: string }[] = []
  for (const rule of BROWSER_RULES) {
    try {
      findings.push(...rule.run(m, ctx))
    } catch (e) {
      errors.push({ rule: rule.id, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return { findings, errors }
}