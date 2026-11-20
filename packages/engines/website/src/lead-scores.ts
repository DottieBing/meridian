export const LEAD_SCORE_METHOD_VERSION = 'lead-scores/1'

/** Points for each kind of way to reach a business. Each kind counts once. */
export const CONTACT_CHANNEL_POINTS: Record<string, number> = {
  email: 45,
  phone: 20,
  contact_form: 15,
  social: 10,
  address: 10,
}

/** Pass the distinct contact types found. Emails that are not for outreach must already be left out. */
export function contactability(channels: readonly string[]): number {
  const have = new Set(channels)
  let total = 0
  for (const [type, points] of Object.entries(CONTACT_CHANNEL_POINTS)) if (have.has(type)) total += points
  return total
}

export type CompletenessInput = {
  industry: boolean
  niche: boolean
  city: boolean
  hasWebsite: boolean
  auditOk: boolean
  auditPages: number
  techCount: number
  contactScanDone: boolean
  hasContact: boolean
}

type Item = { label: string; points: number; needsWebsite: boolean; done: (i: CompletenessInput) => boolean }

const ITEMS: Item[] = [
  { label: 'Industry', points: 5, needsWebsite: false, done: (i) => i.industry },
  { label: 'Niche', points: 5, needsWebsite: false, done: (i) => i.niche },
  { label: 'City', points: 5, needsWebsite: false, done: (i) => i.city },
  { label: 'Website address', points: 15, needsWebsite: false, done: (i) => i.hasWebsite },
  { label: 'Website audit', points: 25, needsWebsite: true, done: (i) => i.auditOk },
  { label: 'At least 3 pages audited', points: 10, needsWebsite: true, done: (i) => i.auditPages >= 3 },
  { label: 'Technologies identified', points: 10, needsWebsite: true, done: (i) => i.techCount > 0 },
  { label: 'Contact scan', points: 10, needsWebsite: false, done: (i) => i.contactScanDone },
  { label: 'Contact details', points: 15, needsWebsite: false, done: (i) => i.hasContact },
]

/** Points earned over the points that apply. Website steps are left out when there is no website. */
export function completeness(input: CompletenessInput): { score: number; missing: string[] } {
  let earned = 0
  let possible = 0
  const missing: string[] = []
  for (const item of ITEMS) {
    if (item.needsWebsite && !input.hasWebsite) continue
    possible += item.points
    if (item.done(input)) earned += item.points
    else missing.push(item.label)
  }
  return { score: possible === 0 ? 0 : Math.round((earned / possible) * 100), missing }
}