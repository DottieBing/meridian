import { metaContent, snapshotEvidence } from '../helpers'
import type { Rule } from '../types'

const viewportMissing: Rule = {
  id: 'ux.viewport.missing',
  run(ctx) {
    if (metaContent(ctx.home, 'viewport') !== '') return []
    return [
      {
        code: 'ux.viewport.missing',
        category: 'ux',
        severity: 'high',
        isObjective: true,
        title: 'Main page has no mobile viewport setting',
        detail:
          'Without a viewport tag, phones show the page as a shrunken desktop layout, so text is tiny and visitors have to pinch and scroll sideways.',
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: snapshotEvidence(ctx.home, 'No <meta name="viewport"> found in the page HTML.'),
      },
    ]
  },
}

const zoomDisabled: Rule = {
  id: 'a11y.zoom_disabled',
  run(ctx) {
    const vp = metaContent(ctx.home, 'viewport')
    if (!/user-scalable\s*=\s*(no|0)/i.test(vp) && !/maximum-scale\s*=\s*1(\.0+)?(?![\d.])/i.test(vp)) return []
    return [
      {
        code: 'a11y.zoom_disabled',
        category: 'accessibility',
        severity: 'low',
        isObjective: true,
        title: 'Pinch-to-zoom is disabled on mobile',
        detail:
          'The viewport setting stops visitors from zooming in. People with low vision rely on zoom to read small text.',
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: snapshotEvidence(ctx.home, `<meta name="viewport" content="${vp}">`),
      },
    ]
  },
}

const langMissing: Rule = {
  id: 'a11y.lang.missing',
  run(ctx) {
    if ((ctx.home.$('html').attr('lang') ?? '').trim() !== '') return []
    return [
      {
        code: 'a11y.lang.missing',
        category: 'accessibility',
        severity: 'low',
        isObjective: true,
        title: 'Page does not declare its language',
        detail:
          'The lang attribute lets screen readers pick the right pronunciation and helps browsers offer translation correctly.',
        affectedUrl: ctx.home.url,
        confidence: 95,
        evidence: snapshotEvidence(ctx.home, 'The <html> element has no lang attribute.'),
      },
    ]
  },
}

const imagesWithoutAlt: Rule = {
  id: 'a11y.images.alt_missing',
  run(ctx) {
    const $ = ctx.home.$
    const imgs = $('img')
      .toArray()
      .filter((el) => {
        const e = $(el)
        if (e.attr('role') === 'presentation' || e.attr('aria-hidden') === 'true') return false
        return !(Number(e.attr('width')) === 1 && Number(e.attr('height')) === 1)
      })
    const missing = imgs.filter((el) => $(el).attr('alt') === undefined)
    if (imgs.length === 0 || missing.length < 3 || missing.length / imgs.length < 0.2) return []
    const ratio = missing.length / imgs.length
    const sample = missing.slice(0, 3).map((el) => $(el).attr('src') ?? '')
    return [
      {
        code: 'a11y.images.alt_missing',
        category: 'accessibility',
        severity: ratio >= 0.5 && missing.length >= 5 ? 'medium' : 'low',
        isObjective: true,
        title: `${missing.length} of ${imgs.length} images have no alt text`,
        detail:
          'Alt text describes images to screen-reader users and to search engines. Decorative images should carry an empty alt attribute; here the attribute is missing altogether.',
        affectedUrl: ctx.home.url,
        confidence: 90,
        evidence: snapshotEvidence(ctx.home, sample.join('\n'), {
          missing: missing.length,
          total: imgs.length,
          sample,
        }),
      },
    ]
  },
}

export const ACCESSIBILITY_RULES: Rule[] = [viewportMissing, zoomDisabled, langMissing, imagesWithoutAlt]