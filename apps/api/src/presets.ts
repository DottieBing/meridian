export const PRESETS = {
  dentist: {
    label: 'Dental clinics',
    filters: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  },
  hotel: {
    label: 'Hotels, guest houses, apartments',
    filters: ['["tourism"~"^(hotel|guest_house|apartment|hostel|motel)$"]'],
  },
  law: {
    label: 'Law firms',
    filters: ['["office"="lawyer"]'],
  },
  professional: {
    label: 'Professional services',
    filters: ['["office"~"^(lawyer|accountant|tax_advisor|architect|consulting|insurance)$"]'],
  },
  beauty_spa: {
    label: 'Beauty and spa (rough proxy for medical spas)',
    filters: ['["shop"="beauty"]', '["leisure"="spa"]', '["beauty"~"."]'],
  },
  shops_with_website: {
    label: 'Physical shops that list a website (weak proxy for e-commerce)',
    filters: ['["shop"]["website"]', '["shop"]["contact:website"]'],
  },
} as const satisfies Record<string, { label: string; filters: readonly string[] }>

export type PresetId = keyof typeof PRESETS
export const isPresetId = (v: string): v is PresetId => Object.hasOwn(PRESETS, v)