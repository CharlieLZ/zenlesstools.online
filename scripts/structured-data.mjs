// Adds a WebPage JSON-LD block to a static page that ships none, deriving every
// claim from what the page already declares (title / description / canonical).
//
// Why here and not in the HTML files: the same reason `social-tags.mjs` lives in
// the build. The site is 25+ hand-written pages and four of them carry their own
// Article/FAQPage/WebSite blocks; the rest shipped zero structured data, which is
// what the 2026-10-29 fleet audit reported as `jsonld-missing` for /bangboo,
// /banners, /characters/, /daily-checklist, /drive-discs, /tools/team-builder and
// /w-engines. A per-page edit at the source silently misses every page added
// later, and re-running the build must not stack a second copy on the pages that
// already declare their own graph.
//
// What this deliberately does NOT emit: ratings, prices, FAQ entries or
// `SoftwareApplication` feature lists. None of those can be derived from the page
// head, and inventing them is the failure mode `search-gallery` and the spam
// policy both name. A WebPage that repeats the visible title and description is
// the honest floor; richer types belong in the pages that have the content.

export const SITE_NAME = 'ZZZ Tools Hub';
export const ORIGIN = 'https://zenlesstools.online';
export const LOCALE = 'en';

const decodeEntities = (value) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

/** `<` is escaped so a title containing `</script>` cannot close the block. */
const toScriptJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

/**
 * @param {string} html a full page
 * @param {string} [origin]
 * @returns {string} the page, with one WebPage graph appended when it had none
 */
export function withStructuredData(html, origin = ORIGIN) {
  if (/<script[^>]+application\/ld\+json/i.test(html)) return html;

  const rawTitle = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const rawDescription = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim();
  const canonical = /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i.exec(html)?.[1]?.trim();
  if (!rawTitle || !canonical) return html;

  const url = canonical.replace(/^https?:\/\/[^/]+/i, '') || '/';
  const absoluteUrl = /^https?:\/\//i.test(canonical) ? canonical : `${origin}${url}`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: SITE_NAME,
        url: `${origin}/`,
        inLanguage: LOCALE,
      },
      {
        '@type': 'WebPage',
        '@id': `${absoluteUrl}#webpage`,
        url: absoluteUrl,
        name: decodeEntities(rawTitle),
        ...(rawDescription ? { description: decodeEntities(rawDescription) } : {}),
        isPartOf: { '@id': `${origin}/#website` },
        inLanguage: LOCALE,
      },
    ],
  };

  const block = `  <script type="application/ld+json">\n  ${toScriptJson(graph)}\n  </script>\n`;
  return html.replace(/<\/head>/i, `${block}</head>`);
}
