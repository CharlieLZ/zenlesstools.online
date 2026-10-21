// Adds the share-card meta tags to a static page, deriving everything from what
// the page already declares (title / description / canonical). Existing tags are
// left alone and only the missing ones are inserted, so running this over the
// whole tree on every build is idempotent and also completes pages that ship a
// partial card (e.g. og:* but no twitter:*).
//
// Why here and not in the HTML files: the site is 20+ hand-written pages; the
// build already walks all of them, and a per-page edit silently misses new pages.

export const SHARE_IMAGE_PATH = '/og-image.png';
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;
const SITE_NAME = 'ZZZ Tools Hub';
const ORIGIN = 'https://zenlesstools.online';

const decodeEntities = (value) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** @param {string} html @param {string} [origin] */
export function withSocialTags(html, origin = ORIGIN) {
  const rawTitle = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const rawDescription = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim();
  const canonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i.exec(html)?.[1]?.trim();
  if (!rawTitle || !canonical) return html;

  const title = escapeAttribute(decodeEntities(rawTitle));
  const description = rawDescription ? escapeAttribute(decodeEntities(rawDescription)) : '';
  const shareImage = `${origin}${SHARE_IMAGE_PATH}`;
  const candidates = [
    ['og:type', `<meta property="og:type" content="website" />`],
    ['og:site_name', `<meta property="og:site_name" content="${SITE_NAME}" />`],
    ['og:title', `<meta property="og:title" content="${title}" />`],
    ...(description ? [['og:description', `<meta property="og:description" content="${description}" />`]] : []),
    ['og:url', `<meta property="og:url" content="${escapeAttribute(canonical)}" />`],
    ['og:image', `<meta property="og:image" content="${shareImage}" />`],
    ['og:image:width', `<meta property="og:image:width" content="${SHARE_IMAGE_WIDTH}" />`],
    ['og:image:height', `<meta property="og:image:height" content="${SHARE_IMAGE_HEIGHT}" />`],
    ['twitter:card', `<meta name="twitter:card" content="summary_large_image" />`],
    ['twitter:title', `<meta name="twitter:title" content="${title}" />`],
    ...(description ? [['twitter:description', `<meta name="twitter:description" content="${description}" />`]] : []),
    ['twitter:image', `<meta name="twitter:image" content="${shareImage}" />`],
  ];

  const missing = candidates.filter(([key]) => !new RegExp(`(?:property|name)=["']${key}["']`, 'i').test(html));
  if (missing.length === 0) return html;

  const block = missing.map(([, tag]) => tag).join('\n  ');
  return html.replace(/<\/head>/i, `  ${block}\n</head>`);
}
