export const PRESETS = {
  dentist: {
    label: 'Dental clinics', industry: 'healthcare', niche: 'dental',
    filters: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  },
  hotel: {
    label: 'Hotels, guest houses, apartments', industry: 'hospitality', niche: 'accommodation',
    filters: ['["tourism"~"^(hotel|guest_house|apartment|hostel|motel)$"]'],
  },
  law: {
    label: 'Law firms', industry: 'professional_services', niche: 'law',
    filters: ['["office"="lawyer"]'],
  },
  professional: {
    label: 'Professional services', industry: 'professional_services', niche: null,
    filters: ['["office"~"^(lawyer|accountant|tax_advisor|architect|consulting|insurance)$"]'],
  },
  beauty_spa: {
    label: 'Beauty and spa (rough proxy for medical spas)', industry: 'health_beauty', niche: 'beauty_spa',
    filters: ['["shop"="beauty"]', '["leisure"="spa"]', '["beauty"~"."]'],
  },
  shops_with_website: {
    label: 'Physical shops that list a website (weak proxy for e-commerce)', industry: 'retail', niche: null,
    filters: ['["shop"]["website"]', '["shop"]["contact:website"]'],
  },
} as const satisfies Record<
  string,
  { label: string; industry: string; niche: string | null; filters: readonly string[] }
>

export type PresetId = keyof typeof PRESETS
export const isPresetId = (v: string): v is PresetId => Object.hasOwn(PRESETS, v)