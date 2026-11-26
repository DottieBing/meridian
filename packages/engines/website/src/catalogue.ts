export type Priority = 'now' | 'soon' | 'worth_doing'

export type CatalogueEntry = {
  observed: string // plain restatement of what the finding means, written for a non-technical reader
  whyItMatters: string // general, non-numeric framing — never a specific cost or revenue claim
  recommendation: string
  priority: Priority
}

/** Codes without an entry here fall back to the finding's own title and detail, so nothing is dropped. */
export const CATALOGUE: Record<string, CatalogueEntry> = {
  'security.https.not_used': {
    observed: 'The site does not use a secure (HTTPS) connection.',
    whyItMatters: 'Browsers mark pages without HTTPS as "Not secure," which can make visitors hesitate before entering contact or payment details.',
    recommendation: 'Install an SSL certificate and redirect all traffic to HTTPS. Most hosts offer a free certificate.',
    priority: 'now',
  },
  'security.mixed_content': {
    observed: 'A secure page loads some of its content over an insecure connection.',
    whyItMatters: 'Browsers can block or flag this content, and it undermines the padlock the rest of the page earns.',
    recommendation: 'Update the few insecure links to use https:// instead of http://.',
    priority: 'soon',
  },
  'security.headers.missing_basic': {
    observed: 'The server does not send some standard security headers.',
    whyItMatters: 'These headers are a baseline hardening step most modern sites include by default.',
    recommendation: 'Add the missing headers at the server or CDN level. A developer can usually do this in under an hour.',
    priority: 'worth_doing',
  },
  'ux.viewport.missing': {
    observed: 'The page has no mobile viewport setting.',
    whyItMatters: 'Phones default to showing the page as a shrunken desktop layout, which visitors have to pinch and zoom to read.',
    recommendation: 'Add a viewport meta tag, or use a responsive theme that includes one.',
    priority: 'now',
  },
  'mobile.layout.not_responsive': {
    observed: 'On a phone screen, the page is laid out for a desktop and shrunk to fit.',
    whyItMatters: 'Most visitors now arrive on a phone. A page that needs pinching and zooming is harder to read and act on.',
    recommendation: 'Switch to a responsive theme or template designed for phone screens.',
    priority: 'now',
  },
  'mobile.overflow.horizontal': {
    observed: 'The page scrolls sideways on a phone screen.',
    whyItMatters: 'Visitors have to drag the page left and right to read it, which is easy to give up on.',
    recommendation: 'Find the element causing the overflow (shown in the evidence) and give it a flexible width.',
    priority: 'soon',
  },
  'performance.page_weight.heavy': {
    observed: 'The page downloads an unusually large amount of data when opened.',
    whyItMatters: 'Heavy pages are slow to load, especially on mobile data, and visitors often leave before they finish loading.',
    recommendation: 'Compress images, remove unused scripts and styles, and consider lazy-loading anything below the fold.',
    priority: 'soon',
  },
  'performance.render_blocking_scripts': {
    observed: 'Several scripts in the page load before anything is shown on screen.',
    whyItMatters: 'This delays the first thing a visitor sees, even on a fast connection.',
    recommendation: 'Add the async or defer attribute to scripts that do not need to run immediately.',
    priority: 'worth_doing',
  },
  'performance.compression.missing': {
    observed: 'The server does not compress its responses before sending them.',
    whyItMatters: 'Uncompressed pages take longer to download than they need to.',
    recommendation: 'Enable gzip or Brotli compression on the server or CDN. This is usually a one-line configuration change.',
    priority: 'worth_doing',
  },
  'performance.ttfb.slow': {
    observed: 'The server took longer than usual to send the first byte of the page.',
    whyItMatters: 'A slow first response delays everything else on the page.',
    recommendation: 'Check the hosting plan and server load, or consider a faster host.',
    priority: 'worth_doing',
  },
  'performance.redirect_chain': {
    observed: 'Loading the page involves more than one redirect before it arrives.',
    whyItMatters: 'Each redirect adds a round trip, slowing down the first thing the visitor sees.',
    recommendation: 'Point the link directly at the final address instead of through intermediate redirects.',
    priority: 'worth_doing',
  },
  'performance.html.large': {
    observed: 'The page\'s HTML itself is unusually large.',
    whyItMatters: 'A large page takes longer to download and parse before the browser can draw anything.',
    recommendation: 'Simplify the page markup, or split long pages into smaller ones.',
    priority: 'worth_doing',
  },
  'mobile.layout_shift.high': {
    observed: 'Content visibly moves around while the page finishes loading.',
    whyItMatters: 'Visitors can end up clicking the wrong thing because something shifted under their finger. This was measured once, in a single lab run, so treat it as a signal worth checking rather than a certainty.',
    recommendation: 'Reserve space for images and ads before they load, and avoid injecting content above what\'s already visible.',
    priority: 'soon',
  },
  'mobile.resources.failed': {
    observed: 'Some files the page asks for from its own domain failed to load.',
    whyItMatters: 'A missing stylesheet or script can break the page\'s look or features for visitors.',
    recommendation: 'Check the affected file paths (in the evidence) and fix or remove the broken references.',
    priority: 'soon',
  },
  'mobile.js.errors': {
    observed: 'The browser logged JavaScript errors while the page loaded.',
    whyItMatters: 'Some errors come from third-party widgets and are harmless, but others quietly break features.',
    recommendation: 'Open the page in a browser\'s developer console to see which errors matter.',
    priority: 'worth_doing',
  },
  'seo.title.missing': {
    observed: 'A page has no title tag, or an empty one.',
    whyItMatters: 'The title is what shows as the clickable headline in search results.',
    recommendation: 'Add a clear, specific title to every page.',
    priority: 'now',
  },
  'seo.title.duplicate': {
    observed: 'Several pages share the same title.',
    whyItMatters: 'Search engines use the title to tell pages apart; identical titles make that harder.',
    recommendation: 'Give each page its own descriptive title.',
    priority: 'soon',
  },
  'seo.meta_description.missing': {
    observed: 'A page has no meta description.',
    whyItMatters: 'Search engines often use this text as the preview snippet under the page\'s title.',
    recommendation: 'Write a one- or two-sentence description for each page.',
    priority: 'soon',
  },
  'seo.h1.missing': {
    observed: 'Pages have no main heading (H1).',
    whyItMatters: 'A main heading helps both visitors and search engines understand what a page is about.',
    recommendation: 'Add one clear H1 heading to each page.',
    priority: 'soon',
  },
  'seo.canonical.missing': {
    observed: 'The main page has no canonical link.',
    whyItMatters: 'Without it, search engines may treat near-duplicate addresses as separate pages, splitting their value.',
    recommendation: 'Add a canonical link tag pointing at the preferred address for each page.',
    priority: 'worth_doing',
  },
  'seo.open_graph.missing': {
    observed: 'The page has no social sharing preview tags.',
    whyItMatters: 'Without them, a shared link on social media or in a chat app shows no image or description.',
    recommendation: 'Add Open Graph tags (title, description, image) to the page head.',
    priority: 'worth_doing',
  },
  'seo.structured_data.missing': {
    observed: 'The page has no structured data.',
    whyItMatters: 'Structured data helps search engines show richer results, such as star ratings or opening hours.',
    recommendation: 'Add structured data markup relevant to the business type (for example, a LocalBusiness or Hotel schema).',
    priority: 'worth_doing',
  },
  'seo.sitemap.missing': {
    observed: 'No sitemap was found for this site.',
    whyItMatters: 'A sitemap helps search engines find and understand every page on the site.',
    recommendation: 'Generate and submit a sitemap.xml file.',
    priority: 'worth_doing',
  },
  'seo.robots.blocks_everything': {
    observed: 'The site\'s robots.txt file asks all crawlers to stay away.',
    whyItMatters: 'This can prevent the site from appearing in search results at all.',
    recommendation: 'Review the robots.txt file; it may be blocking more than intended.',
    priority: 'now',
  },
  'seo.script_rendered.content': {
    observed: 'The page\'s content is built by scripts rather than sent directly by the server.',
    whyItMatters: 'Most search engines handle this today, but some crawlers, link previews and older tools only see an empty page.',
    recommendation: 'Consider server-side rendering for key pages, especially the homepage.',
    priority: 'worth_doing',
  },
  'a11y.lang.missing': {
    observed: 'The page does not declare its language.',
    whyItMatters: 'Screen readers and translation tools rely on this to work correctly.',
    recommendation: 'Add a lang attribute to the HTML tag.',
    priority: 'worth_doing',
  },
  'a11y.images.alt_missing': {
    observed: 'Some images on the page have no alt text.',
    whyItMatters: 'Alt text lets visitors using screen readers know what an image shows, and helps search engines understand it too.',
    recommendation: 'Add a short, descriptive alt attribute to each meaningful image.',
    priority: 'soon',
  },
  'a11y.zoom.disabled': {
    observed: 'The page prevents visitors from zooming in.',
    whyItMatters: 'This makes the page harder to use for anyone who needs larger text, which is a real share of visitors.',
    recommendation: 'Remove the maximum-scale and user-scalable restrictions from the viewport tag.',
    priority: 'soon',
  },
  'tech.php.end_of_life': {
    observed: 'The server reports a version of PHP that no longer receives security updates.',
    whyItMatters: 'Unpatched software is a more likely target for automated attacks.',
    recommendation: 'Ask the host to upgrade PHP to a currently supported version.',
    priority: 'soon',
  },
  'tech.jquery.old_version': {
    observed: 'The site loads an old version of a common script library (jQuery) with known, published security issues.',
    whyItMatters: 'It\'s a sign the site hasn\'t been updated in some time, and the specific issues may or may not apply depending on how the library is used.',
    recommendation: 'Update to a current version, or rebuild the relevant feature without the old library.',
    priority: 'worth_doing',
  },
  'tech.bootstrap.unmaintained': {
    observed: 'The site is built on an old, unmaintained version of a common design framework.',
    whyItMatters: 'It\'s often a sign the site is overdue for a broader refresh.',
    recommendation: 'Plan a redesign using a current framework or theme.',
    priority: 'worth_doing',
  },
  'tech.angularjs.unmaintained': {
    observed: 'The site is built on AngularJS, a framework that stopped receiving support some years ago.',
    whyItMatters: 'The front end likely hasn\'t been touched in several years and carries unpatched risk.',
    recommendation: 'Plan a rebuild on a currently supported framework.',
    priority: 'worth_doing',
  },
  'tech.flash.content': {
    observed: 'The page embeds Flash content, which no modern browser runs.',
    whyItMatters: 'Any menu, animation or feature built in Flash shows as blank or broken to every visitor today.',
    recommendation: 'Replace the Flash content with a modern equivalent (video, CSS animation or a JavaScript library).',
    priority: 'now',
  },
  'tech.analytics.universal_only': {
    observed: 'The only analytics tag found is Universal Analytics, which Google stopped processing in 2023.',
    whyItMatters: 'This almost certainly means no usable visitor data has been collected for some time.',
    recommendation: 'Install Google Analytics 4 or another current analytics tool.',
    priority: 'soon',
  },
  'tech.consent.not_detected': {
    observed: 'Tracking tags were found, but no recognised cookie-consent tool.',
    whyItMatters: 'Sites serving visitors in the EU generally need consent before non-essential tracking runs. This is our best read of the page, not a legal determination.',
    recommendation: 'Add a cookie-consent banner from a reputable provider, or confirm with a professional that none is needed.',
    priority: 'soon',
  },
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  now: 'Fix now',
  soon: 'Fix soon',
  worth_doing: 'Worth doing',
}

export const PRIORITY_ORDER: Priority[] = ['now', 'soon', 'worth_doing']

export function catalogueFor(code: string): CatalogueEntry | null {
  return CATALOGUE[code] ?? null
}