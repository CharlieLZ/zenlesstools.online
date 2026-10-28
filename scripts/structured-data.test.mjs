import assert from 'node:assert/strict';
import test from 'node:test';

import { SITE_NAME, withStructuredData } from './structured-data.mjs';

const page = (head) => `<!DOCTYPE html><html lang="en"><head>
  ${head}
</head><body><h1>Hi</h1></body></html>`;

const parseBlock = (html) => {
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(raw, 'expected a JSON-LD block');
  return JSON.parse(raw.replaceAll('\\u003c', '<'));
};

test('derives a WebPage graph from title, description and canonical', () => {
  const html = withStructuredData(
    page(`
  <title>ZZZ Bangboo Guide &amp; Tier List</title>
  <meta name="description" content="Compare every Bangboo side by side." />
  <link rel="canonical" href="https://zenlesstools.online/bangboo" />`)
  );

  const graph = parseBlock(html)['@graph'];
  const website = graph.find((node) => node['@type'] === 'WebSite');
  const webpage = graph.find((node) => node['@type'] === 'WebPage');

  assert.equal(website.name, SITE_NAME);
  assert.equal(website.url, 'https://zenlesstools.online/');
  assert.equal(webpage.url, 'https://zenlesstools.online/bangboo');
  assert.equal(webpage['@id'], 'https://zenlesstools.online/bangboo#webpage');
  assert.equal(webpage.name, 'ZZZ Bangboo Guide & Tier List');
  assert.equal(webpage.description, 'Compare every Bangboo side by side.');
  assert.equal(webpage.isPartOf['@id'], 'https://zenlesstools.online/#website');
  assert.equal(webpage.inLanguage, 'en');
});

test('omits description when the page has none instead of inventing one', () => {
  const graph = parseBlock(
    withStructuredData(
      page(`
  <title>Banners</title>
  <link rel="canonical" href="https://zenlesstools.online/banners" />`)
    )
  )['@graph'];
  const webpage = graph.find((node) => node['@type'] === 'WebPage');
  assert.equal('description' in webpage, false);
});

test('is idempotent: a page that already declares a graph is untouched', () => {
  const existing = page(`
  <title>Codes</title>
  <link rel="canonical" href="https://zenlesstools.online/codes" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>`);

  assert.equal(withStructuredData(existing), existing);
  assert.equal(withStructuredData(withStructuredData(existing)), existing);
});

test('leaves a page without a canonical alone', () => {
  const html = page('<title>Draft page</title>');
  assert.equal(withStructuredData(html), html);
});

test('a title containing a closing script tag cannot break out of the block', () => {
  const html = withStructuredData(
    page(`
  <title>Tricky &lt;/script&gt; title</title>
  <link rel="canonical" href="https://zenlesstools.online/tricky" />`)
  );
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(raw);
  assert.equal(raw.includes('</script>'), false);
  assert.equal(parseBlock(html)['@graph'][1].name, 'Tricky </script> title');
});
