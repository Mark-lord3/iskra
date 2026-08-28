const htmlEscape = value => String(value).replace(/[&<>"']/g, character => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[character]));

const replaceMeta = (html, attribute, key, value) => html.replace(
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*\\/?>`, 'i'),
  `<meta ${attribute}="${key}" content="${htmlEscape(value)}">`
);

export function injectSeo(html, seo, imageUrl) {
  let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${htmlEscape(seo.title)}</title>`);
  output = replaceMeta(output, 'name', 'description', seo.description);
  output = replaceMeta(output, 'name', 'robots', seo.indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow');
  output = replaceMeta(output, 'name', 'googlebot', seo.indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow');
  output = replaceMeta(output, 'property', 'og:title', seo.title);
  output = replaceMeta(output, 'property', 'og:description', seo.description);
  output = replaceMeta(output, 'property', 'og:url', seo.canonical);
  output = replaceMeta(output, 'property', 'og:image', imageUrl);
  output = replaceMeta(output, 'name', 'twitter:title', seo.title);
  output = replaceMeta(output, 'name', 'twitter:description', seo.description);
  output = replaceMeta(output, 'name', 'twitter:image', imageUrl);
  return output.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${htmlEscape(seo.canonical)}">`
  );
}
