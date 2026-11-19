import type { TechCategory } from '@meridian/db'

export type Sig = {
  slug: string
  name: string
  category: TechCategory
  headers?: Record<string, RegExp>
  meta?: Record<string, RegExp>
  srcs?: RegExp[]
  links?: RegExp[]
  hrefs?: RegExp[]
  html?: RegExp[]
  inline?: RegExp[]
  /** What capture group 1 holds: a version (default) or an id such as a tracking id. */
  capture?: 'version' | 'id'
  implies?: string[]
}

const chat = (slug: string, name: string, re: RegExp): Sig => ({ slug, name, category: 'chat', srcs: [re] })
const booking = (slug: string, name: string, re: RegExp): Sig => ({
  slug, name, category: 'booking', srcs: [re], hrefs: [re],
})
const consent = (slug: string, name: string, srcs: RegExp[], html: RegExp[] = []): Sig => ({
  slug, name, category: 'consent', srcs, html,
})

export const SIGS: Sig[] = [
  // Platforms
  {
    slug: 'wordpress', name: 'WordPress', category: 'cms',
    meta: { generator: /^WordPress\s*(\d+\.\d+(?:\.\d+)?)?/i },
    srcs: [/\/wp-(?:content|includes)\//i, /\/wp-emoji-release\.min\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i],
    links: [/\/wp-(?:content|includes)\//i],
    html: [/<link[^>]+rel=["']https:\/\/api\.w\.org\//i],
  },
  {
    slug: 'joomla', name: 'Joomla', category: 'cms',
    meta: { generator: /Joomla/i },
    srcs: [/\/media\/(?:system|jui|vendor)\/js\//i],
  },
  {
    slug: 'drupal', name: 'Drupal', category: 'cms',
    meta: { generator: /Drupal\s*(\d+(?:\.\d+)*)?/i },
    headers: { 'x-generator': /Drupal\s*(\d+(?:\.\d+)*)?/i },
    srcs: [/\/sites\/(?:default|all)\/(?:files|modules|themes)\//i, /\/core\/misc\/drupal\.js/i],
    inline: [/\bdrupalSettings\b|Drupal\.settings/],
  },
  { slug: 'ghost', name: 'Ghost', category: 'cms', meta: { generator: /^Ghost\s*(\d+(?:\.\d+)*)?/i } },
  { slug: 'typo3', name: 'TYPO3', category: 'cms', meta: { generator: /TYPO3/i } },
  { slug: 'hubspot-cms', name: 'HubSpot CMS', category: 'cms', meta: { generator: /HubSpot/i } },
  {
    slug: 'wix', name: 'Wix', category: 'website_builder',
    meta: { generator: /Wix\.com/i },
    headers: { 'x-wix-request-id': /.+/ },
    srcs: [/static\.parastorage\.com/i, /static\.wixstatic\.com/i],
  },
  {
    slug: 'squarespace', name: 'Squarespace', category: 'website_builder',
    meta: { generator: /Squarespace/i },
    srcs: [/static1\.squarespace\.com/i, /assets\.squarespace\.com/i],
    html: [/<!--\s*This is Squarespace\./i],
  },
  {
    slug: 'webflow', name: 'Webflow', category: 'website_builder',
    meta: { generator: /Webflow/i },
    html: [/\bdata-wf-(?:page|site)=/i],
  },
  { slug: 'weebly', name: 'Weebly', category: 'website_builder', srcs: [/(?:editmysite|weebly)\.com/i] },
  {
    slug: 'godaddy-builder', name: 'GoDaddy Website Builder', category: 'website_builder',
    meta: { generator: /GoDaddy|Go Daddy|Starfield/i },
    srcs: [/img\d*\.wsimg\.com/i],
  },
  {
    slug: 'shopify', name: 'Shopify', category: 'ecommerce',
    headers: { 'x-shopid': /.+/, 'x-shopify-stage': /.+/ },
    srcs: [/cdn\.shopify\.com/i],
    html: [/Shopify\.(?:theme|shop|routes)/],
  },
  {
    slug: 'woocommerce', name: 'WooCommerce', category: 'ecommerce', implies: ['wordpress'],
    srcs: [/\/plugins\/woocommerce\/[^"']*?\?ver=(\d+\.\d+(?:\.\d+)?)/i, /\/plugins\/woocommerce\//i],
    html: [/\/wp-content\/plugins\/woocommerce\//i, /class=["'][^"']*\bwoocommerce\b/i],
  },
  {
    slug: 'magento', name: 'Magento', category: 'ecommerce',
    srcs: [/\/(?:static\/version\d+|pub\/static)\//i, /\/mage\/[a-z-]+\.js/i],
    html: [/text\/x-magento-init/i],
  },
  {
    slug: 'prestashop', name: 'PrestaShop', category: 'ecommerce',
    meta: { generator: /PrestaShop/i },
    html: [/var prestashop\s*=/i, /\/modules\/ps_[a-z]+\//i],
  },
  { slug: 'opencart', name: 'OpenCart', category: 'ecommerce', html: [/catalog\/view\/(?:theme|javascript)\//i] },

  // WordPress builders and plugins
  {
    slug: 'elementor', name: 'Elementor', category: 'page_builder', implies: ['wordpress'],
    meta: { generator: /Elementor\s*(\d+\.\d+(?:\.\d+)?)/i },
    srcs: [/\/plugins\/elementor(?:-pro)?\/[^"']*?\?ver=(\d+\.\d+(?:\.\d+)?)/i],
    html: [/\/wp-content\/plugins\/elementor\//i, /\belementor-(?:element|section|widget)\b/],
  },
  {
    slug: 'divi', name: 'Divi', category: 'page_builder', implies: ['wordpress'],
    html: [/\/wp-content\/themes\/Divi\//i, /\bet_pb_section\b/],
  },
  {
    slug: 'wpbakery', name: 'WPBakery', category: 'page_builder', implies: ['wordpress'],
    html: [/\/plugins\/js_composer\//i, /\bvc_row\b/],
  },
  {
    slug: 'revslider', name: 'Slider Revolution', category: 'plugin', implies: ['wordpress'],
    html: [/\/plugins\/revslider\//i, /\brev_slider\b/],
  },
  {
    slug: 'yoast', name: 'Yoast SEO', category: 'plugin', implies: ['wordpress'],
    html: [/optimized with the Yoast SEO plugin v?(\d+\.\d+(?:\.\d+)?)/i, /Yoast SEO/i],
  },
  { slug: 'rankmath', name: 'Rank Math', category: 'plugin', implies: ['wordpress'], html: [/<!--[^>]*Rank Math[^>]*-->/i] },
  {
    slug: 'wp-rocket', name: 'WP Rocket', category: 'plugin', implies: ['wordpress'],
    headers: { 'x-powered-by': /WP Rocket\/?(\d+\.\d+(?:\.\d+)?)?/i },
    html: [/<!--\s*This website is like a Rocket/i, /\bwp-rocket\b/i],
  },
  {
    slug: 'litespeed-cache', name: 'LiteSpeed Cache', category: 'plugin',
    headers: { 'x-litespeed-cache': /.+/ },
    html: [/<!--\s*Page (?:generated|cached) by LiteSpeed Cache/i],
  },
  {
    slug: 'contact-form-7', name: 'Contact Form 7', category: 'plugin', implies: ['wordpress'],
    html: [/\bwpcf7\b/i, /\/plugins\/contact-form-7\//i],
  },

  // Servers, hosting, languages
  { slug: 'cloudflare', name: 'Cloudflare', category: 'hosting', headers: { server: /cloudflare/i, 'cf-ray': /.+/ } },
  { slug: 'cloudfront', name: 'Amazon CloudFront', category: 'hosting', headers: { 'x-amz-cf-id': /.+/, via: /CloudFront/i } },
  { slug: 'vercel', name: 'Vercel', category: 'hosting', headers: { server: /Vercel/i, 'x-vercel-id': /.+/ } },
  { slug: 'netlify', name: 'Netlify', category: 'hosting', headers: { server: /Netlify/i, 'x-nf-request-id': /.+/ } },
  { slug: 'fastly', name: 'Fastly', category: 'hosting', headers: { 'x-served-by': /cache-[a-z0-9-]+/i } },
  { slug: 'varnish', name: 'Varnish', category: 'hosting', headers: { 'x-varnish': /.+/, via: /varnish/i } },
  { slug: 'nginx', name: 'nginx', category: 'server', headers: { server: /nginx(?:\/(\d+\.\d+(?:\.\d+)?))?/i } },
  { slug: 'apache', name: 'Apache', category: 'server', headers: { server: /Apache(?:\/(\d+\.\d+(?:\.\d+)?))?/i } },
  { slug: 'litespeed', name: 'LiteSpeed', category: 'server', headers: { server: /LiteSpeed/i } },
  { slug: 'iis', name: 'Microsoft IIS', category: 'server', headers: { server: /Microsoft-IIS(?:\/(\d+\.\d+))?/i } },
  { slug: 'express', name: 'Express (Node.js)', category: 'server', headers: { 'x-powered-by': /Express/i } },
  { slug: 'php', name: 'PHP', category: 'language', headers: { 'x-powered-by': /PHP\/(\d+\.\d+(?:\.\d+)?)/i } },
  {
    slug: 'aspnet', name: 'ASP.NET', category: 'language',
    headers: { 'x-powered-by': /ASP\.NET/i, 'x-aspnet-version': /(\d+\.\d+(?:\.\d+)*)/ },
  },

  // JavaScript libraries and frameworks
  {
    slug: 'jquery', name: 'jQuery', category: 'js_library',
    srcs: [
      /(?:^|\/)jquery[-.](\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js/i,
      /\/jquery\/(\d+\.\d+(?:\.\d+)?)\/jquery/i,
      /\/jquery@(\d+\.\d+(?:\.\d+)?)/i,
      /\/jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
      /(?:^|\/)jquery(?:\.min)?\.js(?:$|\?)/i,
    ],
  },
  {
    slug: 'jquery-migrate', name: 'jQuery Migrate', category: 'js_library',
    srcs: [/jquery-migrate(?:[-.](\d+\.\d+(?:\.\d+)?))?(?:\.min)?\.js/i, /jquery-migrate(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i],
  },
  {
    slug: 'jquery-ui', name: 'jQuery UI', category: 'js_library',
    srcs: [
      /jquery-ui(?:[-.](\d+\.\d+(?:\.\d+)?))?(?:\.min)?\.js/i,
      /jqueryui\/(\d+\.\d+(?:\.\d+)?)\//i,
      /\/jquery\/ui\/[a-z.-]+\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
      /\/ui\/(\d+\.\d+(?:\.\d+)?)\/jquery-ui/i,
    ],
  },
  {
    slug: 'bootstrap', name: 'Bootstrap', category: 'js_library',
    srcs: [
      /bootstrap(?:\.bundle)?(?:[-.](\d+\.\d+(?:\.\d+)?))?(?:\.min)?\.js/i,
      /\/bootstrap\/(\d+\.\d+(?:\.\d+)?)\//i,
      /\/bootstrap@(\d+\.\d+(?:\.\d+)?)/i,
      /bootstrap(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i,
    ],
    links: [
      /bootstrap(?:[-.](\d+\.\d+(?:\.\d+)?))?(?:\.min)?\.css/i,
      /\/bootstrap\/(\d+\.\d+(?:\.\d+)?)\/css/i,
      /\/bootstrap@(\d+\.\d+(?:\.\d+)?)/i,
      /bootstrap(?:\.min)?\.css\?ver=(\d+\.\d+(?:\.\d+)?)/i,
    ],
  },
  {
    slug: 'angularjs', name: 'AngularJS', category: 'framework',
    srcs: [
      /angular(?:js)?(?:[-.](\d+\.\d+\.\d+))?(?:\.min)?\.js/i,
      /ajax\/libs\/angular\.js\/(\d+\.\d+\.\d+)\//i,
      /angularjs\/(\d+\.\d+\.\d+)\/angular/i,
    ],
    html: [/<[a-z][^>]*\sdata-ng-app\b|<[a-z][^>]*\sng-app\b/i],
  },
  { slug: 'angular', name: 'Angular', category: 'framework', html: [/\bng-version="(\d+(?:\.\d+)*)"/] },
  {
    slug: 'react', name: 'React', category: 'framework',
    srcs: [/react(?:-dom)?(?:\.production)?(?:\.min)?\.js/i, /react(?:-dom)?@(\d+\.\d+(?:\.\d+)?)/i],
    html: [/data-reactroot|__reactContainer|data-react-helmet/],
  },
  { slug: 'nextjs', name: 'Next.js', category: 'framework', srcs: [/\/_next\/static\//], html: [/id="__NEXT_DATA__"/] },
  { slug: 'nuxt', name: 'Nuxt', category: 'framework', srcs: [/\/_nuxt\//], html: [/window\.__NUXT__|id="__nuxt"/] },
  {
    slug: 'vue', name: 'Vue.js', category: 'framework',
    srcs: [/\/vue(?:[-.](\d+\.\d+(?:\.\d+)?))?(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/i, /vue@(\d+\.\d+(?:\.\d+)?)/i],
    html: [/\bdata-v-[0-9a-f]{8}\b/, /data-server-rendered="true"/],
  },
  { slug: 'gatsby', name: 'Gatsby', category: 'framework', meta: { generator: /^Gatsby\s*(\d+(?:\.\d+)*)?/i } },
  {
    slug: 'flash', name: 'Adobe Flash content', category: 'legacy',
    html: [/<(?:object|embed)\b[^>]*(?:\.swf\b|application\/x-shockwave-flash)/i],
  },

  // Analytics, tags, advertising, marketing
  {
    slug: 'ga4', name: 'Google Analytics 4', category: 'analytics', capture: 'id',
    srcs: [/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]{6,})/i],
    inline: [/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]{6,})['"]/i],
  },
  {
    slug: 'universal-analytics', name: 'Universal Analytics', category: 'analytics', capture: 'id',
    srcs: [/google-analytics\.com\/(?:analytics|ga)\.js/i, /googletagmanager\.com\/gtag\/js\?id=(UA-\d{4,10}-\d+)/i],
    inline: [/['"](UA-\d{4,10}-\d{1,3})['"]/, /google-analytics\.com\/(?:analytics|ga)\.js/i],
  },
  {
    slug: 'google-tag-manager', name: 'Google Tag Manager', category: 'tag_manager', capture: 'id',
    srcs: [/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]{4,})/i],
    html: [/googletagmanager\.com\/ns\.html\?id=(GTM-[A-Z0-9]{4,})/i],
    inline: [/['"](GTM-[A-Z0-9]{4,})['"]/],
  },
  {
    slug: 'meta-pixel', name: 'Meta Pixel', category: 'advertising', capture: 'id',
    srcs: [/connect\.facebook\.net\/[^"']*\/fbevents\.js/i],
    inline: [/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,})['"]/],
  },
  {
    slug: 'tiktok-pixel', name: 'TikTok Pixel', category: 'advertising', capture: 'id',
    srcs: [/analytics\.tiktok\.com/i],
    inline: [/ttq\.load\(\s*['"]([A-Z0-9]{8,})['"]/],
  },
  {
    slug: 'linkedin-insight', name: 'LinkedIn Insight Tag', category: 'advertising', capture: 'id',
    srcs: [/snap\.licdn\.com\/li\.lms-analytics/i],
    inline: [/_linkedin_partner_id\s*=\s*["'](\d+)["']/],
  },
  { slug: 'hotjar', name: 'Hotjar', category: 'analytics', srcs: [/(?:static|script)\.hotjar\.com/i] },
  { slug: 'microsoft-clarity', name: 'Microsoft Clarity', category: 'analytics', capture: 'id', srcs: [/clarity\.ms\/tag\/([a-z0-9]+)/i] },
  {
    slug: 'hubspot', name: 'HubSpot', category: 'marketing', capture: 'id',
    srcs: [/js\.hs-scripts\.com\/(\d+)\.js/i, /js\.hsforms\.net/i, /js\.hs-analytics\.net/i],
  },
  { slug: 'mailchimp', name: 'Mailchimp', category: 'marketing', srcs: [/chimpstatic\.com/i, /list-manage\.com/i] },
  { slug: 'klaviyo', name: 'Klaviyo', category: 'marketing', srcs: [/static\.klaviyo\.com/i] },

  // Chat
  chat('tawk', 'Tawk.to', /embed\.tawk\.to/i),
  chat('intercom', 'Intercom', /widget\.intercom\.io|js\.intercomcdn\.com/i),
  chat('crisp', 'Crisp', /client\.crisp\.chat/i),
  chat('drift', 'Drift', /js\.driftt\.com/i),
  chat('tidio', 'Tidio', /code\.tidio\.co/i),
  chat('livechat', 'LiveChat', /cdn\.livechatinc\.com/i),
  chat('zendesk', 'Zendesk', /static\.zdassets\.com/i),
  {
    slug: 'whatsapp-link', name: 'WhatsApp chat link', category: 'chat',
    hrefs: [/(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)/i],
  },

  // Booking and scheduling
  booking('sabee', 'Sabee', /sabeeapp\.com/i),
  booking('beds24', 'Beds24', /beds24\.com/i),
  booking('cloudbeds', 'Cloudbeds', /cloudbeds\.com/i),
  booking('little-hotelier', 'Little Hotelier', /littlehotelier\.com/i),
  booking('mews', 'Mews', /mews\.(?:li|com)/i),
  booking('siteminder', 'SiteMinder', /siteminder\.com|thebookingbutton\.com|direct-book\.com/i),
  booking('synxis', 'Synxis', /synxis\.com/i),
  booking('eviivo', 'eviivo', /eviivo\.com/i),
  booking('lodgify', 'Lodgify', /lodgify\.com/i),
  booking('smoobu', 'Smoobu', /smoobu\.com/i),
  booking('hotelrunner', 'HotelRunner', /hotelrunner\.com/i),
  booking('amenitiz', 'Amenitiz', /amenitiz\.(?:io|com)/i),
  booking('quendoo', 'Quendoo', /quendoo\.com/i),
  booking('roomcloud', 'RoomCloud', /roomcloud\.net/i),
  booking('calendly', 'Calendly', /calendly\.com/i),
  booking('acuity', 'Acuity Scheduling', /acuityscheduling\.com/i),
  booking('simplybook', 'SimplyBook.me', /simplybook\.(?:me|it)/i),
  booking('setmore', 'Setmore', /setmore\.com/i),
  booking('doctolib', 'Doctolib', /doctolib\./i),

  // Payments
  { slug: 'stripe', name: 'Stripe', category: 'payment', srcs: [/js\.stripe\.com/i] },
  { slug: 'paypal', name: 'PayPal', category: 'payment', srcs: [/paypal\.com\/sdk|paypalobjects\.com/i] },
  { slug: 'jcc', name: 'JCC Payment Systems', category: 'payment', srcs: [/jcc(?:secure)?\.com(?:\.cy)?/i], hrefs: [/jcc(?:secure)?\.com(?:\.cy)?/i] },
  { slug: 'viva-wallet', name: 'Viva Wallet', category: 'payment', srcs: [/vivawallet\.com/i], hrefs: [/vivawallet\.com/i] },

  // Cookie consent
  consent('cookiebot', 'Cookiebot', [/consent\.cookiebot\.com/i]),
  consent('onetrust', 'OneTrust', [/cdn\.cookielaw\.org|onetrust\.com/i]),
  consent('cookieyes', 'CookieYes', [/cdn-cookieyes\.com|cookieyes\.com/i], [/cookie-law-info|\bcli-bar\b/i]),
  consent('complianz', 'Complianz', [/\/plugins\/complianz-gdpr/i], [/\bcmplz-/i]),
  consent('iubenda', 'iubenda', [/cdn\.iubenda\.com/i]),
  consent('termly', 'Termly', [/app\.termly\.io/i]),
  consent('borlabs', 'Borlabs Cookie', [/borlabs-cookie/i], [/borlabs-cookie/i]),
  consent('cookie-notice', 'Cookie Notice', [/cookie-notice(?:\.min)?\.js/i], [/id=["']cookie-notice["']/i]),
  consent('cookieconsent', 'CookieConsent', [/cookieconsent(?:\.min)?\.js/i], [/\bcc-window\b/]),
]