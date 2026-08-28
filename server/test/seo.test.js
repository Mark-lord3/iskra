import test from 'node:test';
import assert from 'node:assert/strict';
import { getSeo } from '../../shared/seo.js';
import { injectSeo } from '../src/lib/seoHtml.js';

const template = `<!doctype html><head>
<title>Default</title>
<meta name="description" content="Default description">
<meta name="robots" content="index">
<meta name="googlebot" content="index">
<meta property="og:title" content="Default">
<meta property="og:description" content="Default">
<meta property="og:url" content="https://example.com/">
<meta property="og:image" content="https://example.com/old.jpg">
<meta name="twitter:title" content="Default">
<meta name="twitter:description" content="Default">
<meta name="twitter:image" content="https://example.com/old.jpg">
<link rel="canonical" href="https://example.com/">
</head>`;

test('public routes receive route-specific canonical metadata', () => {
  const seo = getSeo('/offers', 'en');
  const html = injectSeo(template, seo, 'https://project-iskra.com/og/share.jpg');
  assert.match(html, /<title>ISKRA Ticket Offers &amp; Group Deals \| Montreal<\/title>/);
  assert.match(html, /property="og:url" content="https:\/\/project-iskra\.com\/offers"/);
  assert.match(html, /rel="canonical" href="https:\/\/project-iskra\.com\/offers"/);
  assert.match(html, /name="robots" content="index, follow/);
});

test('private and unknown routes are not indexable', () => {
  for (const route of ['/admin', '/account', '/tickets', '/not-a-page']) {
    const seo = getSeo(route, 'en');
    const html = injectSeo(template, seo, 'https://project-iskra.com/og/share.jpg');
    assert.equal(seo.indexable, false);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
  }
});
