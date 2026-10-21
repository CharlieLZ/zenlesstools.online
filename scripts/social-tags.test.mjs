import assert from 'node:assert/strict';
import test from 'node:test';

import { SHARE_IMAGE_PATH, withSocialTags } from './social-tags.mjs';

const page = (head) => `<!DOCTYPE html><html lang="en"><head>
  ${head}
</head><body><h1>Hi</h1></body></html>`;

test('derives the share card from title, description and canonical', () => {
  const html = withSocialTags(page(`
  <title>Lucia Build Guide &amp; Stats</title>
  <meta name="description" content="Best W-Engine and Drive Discs." />
  <link rel="canonical" href="https://zenlesstools.online/characters/lucia-build" />`));

  assert.match(html, /<meta property="og:image" content="https:\/\/zenlesstools\.online\/og-image\.png" \/>/);
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta property="og:title" content="Lucia Build Guide &amp; Stats" \/>/);
  assert.match(html, /<meta property="og:description" content="Best W-Engine and Drive Discs\." \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/zenlesstools\.online\/characters\/lucia-build" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/zenlesstools\.online\/og-image\.png" \/>/);
  assert.equal(SHARE_IMAGE_PATH, '/og-image.png');
});

test('is idempotent: a complete card is returned untouched', () => {
  const withCard = withSocialTags(page(`
  <title>T</title>
  <link rel="canonical" href="https://zenlesstools.online/" />
  <meta name="description" content="D" />`));

  assert.equal(withSocialTags(withCard), withCard);
});

test('completes a partial card without duplicating what is already there', () => {
  const partial = page(`
  <title>T</title>
  <link rel="canonical" href="https://zenlesstools.online/" />
  <meta property="og:image" content="https://zenlesstools.online/og-image.png" />`);
  const html = withSocialTags(partial);

  assert.equal((html.match(/property="og:image"/g) ?? []).length, 1);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta property="og:title" content="T" \/>/);
});

test('leaves pages without a title or canonical alone instead of emitting half a card', () => {
  const noCanonical = page('<title>T</title>');
  const noTitle = page('<link rel="canonical" href="https://zenlesstools.online/" />');

  assert.equal(withSocialTags(noCanonical), noCanonical);
  assert.equal(withSocialTags(noTitle), noTitle);
});

test('escapes quotes so an apostrophe or quote in the title cannot break the attribute', () => {
  const html = withSocialTags(page(`
  <title>Zenless "Code" List</title>
  <link rel="canonical" href="https://zenlesstools.online/codes" />`));

  assert.match(html, /content="Zenless &quot;Code&quot; List"/);
});
