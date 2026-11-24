import { snapshotEvidence } from '../helpers'
import { isScriptRendered, visibleText } from '../placeholder'
import type { Rule } from '../types'

/** Findings that read page content. On a script-rendered site they would describe an empty shell, so they are dropped. */
export const SHELL_SENSITIVE = new Set([
  'seo.h1.missing',
  'seo.title.missing',
  'seo.title.duplicate',
  'seo.meta_description.missing',
  'seo.structured_data.missing',
  'seo.canonical.missing',
])

const scriptRendered: Rule = {
  id: 'seo.script_rendered.content',
  run(ctx) {
    if (!isScriptRendered(ctx.home.html)) return []
    const chars = visibleText(ctx.home.html).length
    return [
      {
        code: 'seo.script_rendered.content',
        category: 'seo',
        severity: 'info',
        isObjective: true,
        title: 'The page content is built by scripts: the HTML the server sends contains almost no text',
        detail:
          'Checks that read page content, or tags that scripts usually fill in (headings, titles, descriptions, structured data, canonical link), were skipped, because they would describe the empty page and not the real one.',
        affectedUrl: ctx.home.url,
        confidence: 85,
        evidence: snapshotEvidence(ctx.home, `Visible text in the page HTML: ${chars} characters`, { textChars: chars }),
      },
    ]
  },
}

export const SHELL_RULES: Rule[] = [scriptRendered]