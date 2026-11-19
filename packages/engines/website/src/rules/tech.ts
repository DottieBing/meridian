import { headerEvidence, snapshotEvidence } from '../helpers'
import { cmpVersion } from '../tech/detect'
import type { AuditContext, DetectedTech, FindingEvidence, Rule } from '../types'

const find = (ctx: AuditContext, slug: string) => ctx.tech.find((t) => t.slug === slug)
const pageOf = (ctx: AuditContext, t: DetectedTech) =>
  ctx.pages.find((p) => p.snapshotId === t.snapshotId) ?? ctx.home

function evidenceFor(ctx: AuditContext, t: DetectedTech, measurement: Record<string, unknown> = {}): FindingEvidence {
  const p = pageOf(ctx, t)
  return t.via === 'header' ? headerEvidence(p, t.excerpt, measurement) : snapshotEvidence(p, t.excerpt, measurement)
}

const phpEndOfLife: Rule = {
  id: 'tech.php.end_of_life',
  run(ctx) {
    const t = find(ctx, 'php')
    if (!t?.version || cmpVersion(t.version, '8.2') >= 0) return []
    return [
      {
        code: 'tech.php.end_of_life',
        category: 'security',
        severity: 'medium',
        isObjective: true,
        title: `Server reports PHP ${t.version}, which no longer receives security updates`,
        detail:
          'PHP versions before 8.2 are past end of life (8.1 ended on 31 December 2025). The version comes from a response header the server chooses to send. Some hosts apply security fixes to older PHP builds themselves, so confirm with the host before treating this as an exposure.',
        affectedUrl: pageOf(ctx, t).url,
        confidence: 75,
        evidence: evidenceFor(ctx, t, { version: t.version }),
      },
    ]
  },
}

const jqueryOld: Rule = {
  id: 'tech.jquery.old_version',
  run(ctx) {
    const t = find(ctx, 'jquery')
    const lowest = t?.versions.filter((v) => cmpVersion(v, '3.5.0') < 0)[0]
    if (!t || !lowest) return []
    return [
      {
        code: 'tech.jquery.old_version',
        category: 'security',
        severity: 'low',
        isObjective: true,
        title: `jQuery ${lowest} is loaded; versions before 3.5.0 have publicly documented security issues`,
        detail:
          'jQuery 3.5.0 fixed two cross-site scripting issues (CVE-2020-11022 and CVE-2020-11023) that affect earlier versions. Whether a particular site is exposed depends on how it uses jQuery, so treat this as a sign the site has not been maintained, not as proof of a vulnerability.',
        affectedUrl: pageOf(ctx, t).url,
        confidence: 85,
        evidence: evidenceFor(ctx, t, { versions: t.versions }),
      },
    ]
  },
}

const bootstrapOld: Rule = {
  id: 'tech.bootstrap.unmaintained',
  run(ctx) {
    const t = find(ctx, 'bootstrap')
    const lowest = t?.versions.filter((v) => Number.parseInt(v, 10) <= 4)[0]
    if (!t || !lowest) return []
    return [
      {
        code: 'tech.bootstrap.unmaintained',
        category: 'technical',
        severity: 'low',
        isObjective: true,
        title: `Bootstrap ${lowest} is in use, a version that is no longer maintained`,
        detail:
          'Bootstrap 3 stopped receiving updates in 2019 and Bootstrap 4 in early 2023. Sites built on them are often due for a redesign, but nothing is necessarily broken because of it.',
        affectedUrl: pageOf(ctx, t).url,
        confidence: 80,
        evidence: evidenceFor(ctx, t, { versions: t.versions }),
      },
    ]
  },
}

const angularJs: Rule = {
  id: 'tech.angularjs.unmaintained',
  run(ctx) {
    const t = find(ctx, 'angularjs')
    if (!t || t.via !== 'src') return []
    return [
      {
        code: 'tech.angularjs.unmaintained',
        category: 'technical',
        severity: 'low',
        isObjective: true,
        title: 'The site uses AngularJS (version 1.x), which is no longer supported',
        detail:
          'AngularJS support ended on 31 December 2021, so it no longer receives security fixes. It is a sign the front end has not been rebuilt in several years.',
        affectedUrl: pageOf(ctx, t).url,
        confidence: 80,
        evidence: evidenceFor(ctx, t),
      },
    ]
  },
}

const flash: Rule = {
  id: 'tech.flash.content',
  run(ctx) {
    const t = find(ctx, 'flash')
    if (!t) return []
    return [
      {
        code: 'tech.flash.content',
        category: 'technical',
        severity: 'medium',
        isObjective: true,
        title: 'Page embeds Flash content, which no browser runs any more',
        detail:
          'Adobe ended Flash support at the end of 2020 and browsers removed it, so any Flash animation, menu or widget on this page shows as blank or broken for visitors.',
        affectedUrl: pageOf(ctx, t).url,
        confidence: 85,
        evidence: evidenceFor(ctx, t),
      },
    ]
  },
}

const universalAnalytics: Rule = {
  id: 'tech.analytics.universal_only',
  run(ctx) {
    const ua = find(ctx, 'universal-analytics')
    if (!ua || find(ctx, 'ga4') || find(ctx, 'google-tag-manager')) return []
    return [
      {
        code: 'tech.analytics.universal_only',
        category: 'technical',
        severity: 'medium',
        isObjective: true,
        title: 'Site still uses Universal Analytics, which Google stopped processing in 2023',
        detail:
          'Google stopped processing data for standard Universal Analytics properties on 1 July 2023, so a site that only has this tag is probably collecting no analytics at all. A tag loaded through a tag manager or a server-side setup would not be visible to us.',
        affectedUrl: pageOf(ctx, ua).url,
        confidence: 80,
        evidence: evidenceFor(ctx, ua, { ids: ua.detail }),
      },
    ]
  },
}

const TRACKERS = [
  'ga4', 'universal-analytics', 'google-tag-manager', 'meta-pixel', 'tiktok-pixel',
  'linkedin-insight', 'hotjar', 'microsoft-clarity',
]

const consentMissing: Rule = {
  id: 'tech.consent.not_detected',
  run(ctx) {
    const trackers = ctx.tech.filter((t) => TRACKERS.includes(t.slug))
    if (trackers.length === 0 || ctx.tech.some((t) => t.category === 'consent')) return []
    const names = trackers.map((t) => t.name)
    return [
      {
        code: 'tech.consent.not_detected',
        category: 'technical',
        severity: 'low',
        isObjective: false,
        title: 'Tracking tags are loaded but no cookie-consent tool was recognised',
        detail: `The main page loads ${names.join(', ')}. We did not recognise a cookie-consent tool in the page code. A custom banner, or one that loads later, would not be detected, so this is something to check by hand, not a compliance verdict. Sites serving visitors in the EU generally need consent before non-essential tracking.`,
        affectedUrl: ctx.home.url,
        confidence: 55,
        evidence: snapshotEvidence(ctx.home, `Tracking tags detected: ${names.join(', ')}`, { trackers: names }),
      },
    ]
  },
}

export const TECH_RULES: Rule[] = [
  phpEndOfLife, jqueryOld, bootstrapOld, angularJs, flash, universalAnalytics, consentMissing,
]