const LABELS: Record<string, string> = {
  'security.tls.invalid_certificate': 'Invalid certificate',
  'security.https.not_used': 'No HTTPS',
  'security.mixed_content': 'Mixed content',
  'seo.noindex': 'Hidden from Google',
  'seo.robots_txt.blocks_all': 'Blocks search engines',
  'seo.title.missing': 'No title tag',
  'seo.meta_description.missing': 'No meta description',
  'seo.h1.missing': 'No main heading',
  'seo.sitemap.missing': 'No sitemap',
  'seo.title.duplicate': 'Duplicate titles',
  'ux.viewport.missing': 'Not mobile-ready',
  'a11y.images.alt_missing': 'Images lack alt text',
  'a11y.zoom_disabled': 'Zoom disabled',
  'a11y.lang.missing': 'No page language',
  'performance.compression.missing': 'No compression',
  'performance.html.large': 'Very large page',
  'performance.ttfb.slow': 'Slow server',
  'performance.redirect_chain': 'Redirect chain',
  'tech.php.end_of_life': 'End-of-life PHP',
  'tech.jquery.old_version': 'Old jQuery',
  'tech.bootstrap.unmaintained': 'Dated Bootstrap',
  'tech.angularjs.unmaintained': 'AngularJS',
  'tech.flash.content': 'Flash content',
  'tech.analytics.universal_only': 'Dead Google Analytics',
  'tech.consent.not_detected': 'No cookie consent seen',
}

export const signalLabel = (code: string): string =>
  LABELS[code] ?? code.split('.').slice(-2).join(' ').replace(/_/g, ' ')

export const SEVERE_SIGNALS = new Set([
  'security.tls.invalid_certificate',
  'security.https.not_used',
  'seo.noindex',
  'seo.robots_txt.blocks_all',
  'ux.viewport.missing',
])