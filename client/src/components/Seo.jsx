import { useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getSeo, SEO_IMAGE_URL, SEO_SITE_URL } from '../../../shared/seo.js';

const SOCIAL_LOCALES = { en:'en_CA', uk:'uk_UA', ru:'ru_RU' };

function upsertMeta(attribute, key, content) {
  let node = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

function absoluteUrl(value) {
  if (!value) return SEO_IMAGE_URL;
  return /^https?:\/\//.test(value) ? value : `${SEO_SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

function organizationSchema() {
  return {
    '@type':'Organization',
    '@id':`${SEO_SITE_URL}/#organization`,
    name:'Project ISKRA',
    url:`${SEO_SITE_URL}/`,
    logo:{ '@type':'ImageObject', url:`${SEO_SITE_URL}/icon-512.png`, width:512, height:512 },
    sameAs:[
      'https://www.instagram.com/_project_iskra/',
      'https://t.me/ukrwavemontreal'
    ]
  };
}

function eventSchema(event) {
  if (!event?.date) return null;
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
  return {
    '@type':'Event',
    '@id':`${SEO_SITE_URL}/schedule#${event.slug || event.id}`,
    name:event.title,
    description:event.description || `${event.title}, presented by Project ISKRA in Montreal.`,
    image:[absoluteUrl(event.image)],
    startDate:start.toISOString(),
    endDate:end.toISOString(),
    eventStatus:'https://schema.org/EventScheduled',
    eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',
    location:{
      '@type':'Place',
      name:event.room || 'Montreal',
      address:{ '@type':'PostalAddress', streetAddress:event.address || '', addressLocality:'Montreal', addressRegion:'QC', addressCountry:'CA' }
    },
    organizer:{ '@id':`${SEO_SITE_URL}/#organization` },
    offers:{
      '@type':'Offer',
      url:`${SEO_SITE_URL}/schedule`,
      price:Number(event.from || 0),
      priceCurrency:'CAD',
      availability:'https://schema.org/InStock',
      validFrom:new Date().toISOString()
    }
  };
}

function structuredData(seo, route, events) {
  const graph = [organizationSchema(), {
    '@type':'WebSite',
    '@id':`${SEO_SITE_URL}/#website`,
    url:`${SEO_SITE_URL}/`,
    name:'Project ISKRA',
    alternateName:'ISKRA Montreal',
    publisher:{ '@id':`${SEO_SITE_URL}/#organization` },
    inLanguage:['en-CA','uk-UA','ru-RU']
  }];

  if (seo.path !== '/' && seo.indexable) {
    graph.push({
      '@type':'BreadcrumbList',
      itemListElement:[
        { '@type':'ListItem', position:1, name:'Project ISKRA', item:`${SEO_SITE_URL}/` },
        { '@type':'ListItem', position:2, name:seo.label, item:seo.canonical }
      ]
    });
  }

  if (route === '/schedule') {
    const upcoming = [...events]
      .filter(event => new Date(event.date).getTime() > Date.now())
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    upcoming.map(eventSchema).filter(Boolean).forEach(schema => graph.push(schema));
  }

  return { '@context':'https://schema.org', '@graph':graph };
}

export default function Seo({ route, events = [] }) {
  const { language } = useI18n();

  useEffect(() => {
    const seo = getSeo(route, language);
    const robots = seo.indexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow';

    document.title = seo.title;
    upsertCanonical(seo.canonical);
    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('name', 'googlebot', robots);
    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:url', seo.canonical);
    upsertMeta('property', 'og:type', route === '/schedule' ? 'website' : 'website');
    upsertMeta('property', 'og:site_name', 'Project ISKRA');
    upsertMeta('property', 'og:locale', SOCIAL_LOCALES[language] || SOCIAL_LOCALES.en);
    upsertMeta('property', 'og:image', SEO_IMAGE_URL);
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', 'Project ISKRA Montreal nightlife event');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    upsertMeta('name', 'twitter:image', SEO_IMAGE_URL);
    upsertMeta('name', 'twitter:image:alt', 'Project ISKRA Montreal nightlife event');

    let script = document.getElementById('iskra-structured-data');
    if (!script) {
      script = document.createElement('script');
      script.id = 'iskra-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData(seo, route, events));
  }, [events, language, route]);

  return null;
}
