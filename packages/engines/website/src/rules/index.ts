import type { Rule } from '../types'
import { ACCESSIBILITY_RULES } from './accessibility'
import { FILE_RULES } from './files'
import { SEO_RULES } from './seo'
import { TECHNICAL_RULES } from './technical'

export const RULES: Rule[] = [...TECHNICAL_RULES, ...SEO_RULES, ...ACCESSIBILITY_RULES, ...FILE_RULES]