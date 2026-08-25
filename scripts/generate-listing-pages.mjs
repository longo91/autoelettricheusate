// Genera una pagina HTML statica indicizzabile per ogni annuncio attivo,
// con URL, titolo, meta description e dati strutturati (JSON-LD Product) unici.
// Cancella le pagine di annunci non piu' attivi e rigenera sitemap.xml.
// Eseguito da .github/workflows/prerender.yml insieme a prerender.mjs.

import { readdirSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = 'https://komvmedptbcsiiswoaja.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W1l56uhiAnI6g7rhvkqtZg_WesZk_rd';
const SITE = 'https://autoelettricheusate.eu';
const OUT_DIR = 'annuncio';

const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT');
}

async function fetchActiveListings() {
  const url = SUPABASE_URL + '/rest/v1/annunci?stato=eq.attivo&order=creato_il.desc&select=*';
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY
    }
  });
  if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

function mapRow(row) {
  const createdDate = new Date(row.creato_il);
  return {
    id: 1000000 + row.id,
    brand: row.marca,
    model: row.modello,
    version: row.versione || '',
    type: row.alimentazione === 'ibrida plug-in' ? 'phev' : 'ev',
    body: row.carrozzeria || '',
    year: row.anno,
    month: MONTH_NAMES[createdDate.getMonth()] || '',
    price: row.prezzo,
    km: row.km,
    battery: row.batteria_kwh || 0,
    range: row.autonomia_km || 0,
    kw: row.potenza_kw || 0,
    cv: row.potenza_kw ? Math.round(row.potenza_kw / 0.7355) : 0,
    charge: row.ricarica_dc_kw ? (row.ricarica_dc_kw + ' kW DC') : (row.ricarica_ac_kw ? (row.ricarica_ac_kw + ' kW AC') : 'N/D'),
    seller: row.nome,
    stype: row.tipo_venditore === 'rivenditore' ? 'dealer' : 'private',
    city: row.citta + (row.prov ? ' (' + row.prov + ')' : ''),
    desc: row.descrizione || '',
    feat: Array.isArray(row.optional) ? row.optional : [],
    foto: Array.isArray(row.foto) ? row.foto : [],
    creatoIl: row.creato_il
  };
}

function specRowHtml(a) {
  const alim = a.type === 'ev' ? 'Elettrica' : 'Ibrida plug-in';
  return `<div class="specs">
    <div class="sp"><label>Prezzo</label><b>${fmt(a.price)} &euro;</b></div>
    <div class="sp"><label>Chilometri</label><b>${fmt(a.km)} km</b></div>
    <div class="sp"><label>Immatricolazione</label><b>${escapeHtml(a.month)} ${a.year}</b></div>
    <div class="sp"><label>Alimentazione</label><b>${alim}</b></div>
    <div class="sp"><label>Cambio</label><b>Automatico</b></div>
    <div class="sp"><label>Batteria</label><b>${String(a.battery).replace('.', ',')} kWh</b></div>
    <div class="sp"><label>Autonomia</label><b>${fmt(a.range)} km</b></div>
    <div class="sp"><label>Ricarica max</label><b>${escapeHtml(a.charge)}</b></div>
    <div class="sp"><label>Potenza</label><b>${a.kw} kW (${a.cv} CV)</b></div>
  </div>`;
}

function jsonLd(a, url, image) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${a.brand} ${a.model}${a.version ? ' ' + a.version : ''}`.trim(),
    description: a.desc || `${a.brand} ${a.model} usata, ${fmt(a.km)} km, autonomia ${fmt(a.range)} km.`,
    ...(image ? { image: [image] } : {}),
    brand: { '@type': 'Brand', name: a.brand },
    offers: {
      '@type': 'Offer',
      price: a.price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url
    }
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function pageHtml(a) {
  const url = `${SITE}/${OUT_DIR}/${a.id}.html`;
  const title = `${a.brand} ${a.model}${a.version ? ' ' + a.version : ''} usata - ${fmt(a.price)} € | Auto Elettriche Usate`;
  const desc = (a.desc || `${a.brand} ${a.model} usata, ${fmt(a.km)} km, autonomia ${fmt(a.range)} km, batteria ${a.battery} kWh.`).slice(0, 300);
  const image = a.foto[0] || `${SITE}/og-image.png`;
  const badge = a.type === 'ev' ? '100% elettrica' : 'Ibrida plug-in';
  const verified = a.stype === 'dealer' ? '&#10003; Rivenditore verificato' : '&#128100; Venditore privato';
  const tags = a.feat.map((f) => `<span class="tag">&#9889; ${escapeHtml(f)}</span>`).join('');
  const photos = a.foto.length
    ? a.foto.map((f, i) => `<img src="${escapeHtml(f)}" alt="${escapeHtml(a.brand + ' ' + a.model)} - foto ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">`).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="Auto Elettriche Usate">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%2300dda8'/><path d='M18 3 8 19h5l-1 10 10-16h-6z' fill='%23103c33'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,500;0,600;0,700;0,800;1,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${jsonLd(a, url, a.foto[0])}</script>
<style>
  * { box-sizing: border-box; }
  :root { --accent:#00dda8; --accent-d:#00b98d; --mint:#e5faf5; --ink:#14312a; --dark:#1d4a42; --body:#212529; --muted:#6f7d79; --line:#e5e9e7; --soft:#f8faf9; }
  html,body { max-width:100%; overflow-x:hidden; }
  body { margin:0; font-family:'Inter',system-ui,Arial,sans-serif; color:var(--body); background:#fff; }
  h1,h2,.price,.logo { font-family:'Plus Jakarta Sans','Inter',sans-serif; }
  a { color:inherit; text-decoration:none; }
  .wrap { max-width:900px; margin:0 auto; padding:0 20px; }
  header.site { border-bottom:1px solid var(--line); padding:16px 0; }
  .logo { display:flex; align-items:center; gap:10px; font-weight:800; font-size:17px; color:var(--ink); }
  .bolt { width:34px; height:34px; border-radius:50%; background:var(--accent); display:grid; place-items:center; font-size:17px; }
  main { padding:26px 0 50px; }
  .crumbs { font-size:13px; color:var(--muted); margin-bottom:14px; }
  .crumbs a:hover { color:var(--accent-d); }
  .gallery { display:grid; grid-template-columns:${a.foto.length > 1 ? 'repeat(auto-fill, minmax(220px,1fr))' : '1fr'}; gap:8px; border-radius:18px; overflow:hidden; margin-bottom:22px; background:var(--mint); }
  .gallery img { width:100%; height:100%; max-height:420px; object-fit:cover; display:block; }
  .gallery:empty { min-height:220px; }
  .itop { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
  .price { font-size:32px; font-weight:800; color:var(--ink); }
  .price span { font-size:16px; font-weight:600; color:var(--muted); }
  .verified { font-size:13.5px; font-weight:600; color:var(--dark); }
  h1 { font-size:26px; margin:6px 0 2px; color:var(--ink); }
  .ver { margin:0 0 18px; color:var(--muted); font-size:15px; }
  .badges { display:flex; gap:8px; margin-bottom:18px; }
  .bdg { border-radius:999px; padding:6px 13px; font-size:12.5px; font-weight:700; background:var(--accent); color:#08312a; }
  .bdg.kwh { background:var(--mint); color:var(--ink); }
  .specs { display:grid; grid-template-columns:repeat(3,1fr); gap:14px 18px; margin:0 0 22px; }
  .sp label { display:block; font-size:12px; color:var(--muted); margin-bottom:2px; }
  .sp b { font-size:14.5px; font-weight:600; color:var(--ink); }
  .desc { font-size:15px; line-height:1.7; color:#40514c; margin:0 0 22px; white-space:pre-line; }
  .feat p { margin:0 0 8px; font-size:13px; color:var(--muted); }
  .tags { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:26px; }
  .tag { background:var(--mint); border-radius:9px; padding:6px 10px; font-size:12.5px; font-weight:600; color:var(--dark); }
  .seller-box { display:flex; align-items:center; gap:12px; background:var(--mint); border-radius:16px; padding:18px 20px; flex-wrap:wrap; }
  .avatar { width:40px; height:40px; border-radius:50%; background:var(--dark); color:#fff; display:grid; place-items:center; font-weight:700; font-size:16px; }
  .seller-name { font-weight:700; font-size:15px; color:var(--ink); }
  .seller-sub { font-size:13px; color:var(--muted); }
  .cta { margin-left:auto; background:var(--accent); border-color:var(--accent); color:#08312a; border-radius:999px; padding:12px 22px; font-weight:700; font-size:14.5px; display:inline-block; }
  .cta:hover { background:var(--accent-d); }
  .back { display:inline-block; margin-top:26px; font-size:13.5px; color:var(--muted); }
  .back:hover { color:var(--accent-d); }
  @media (max-width:640px) { .specs { grid-template-columns:repeat(2,1fr); } .cta { margin-left:0; width:100%; text-align:center; } }
</style>
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="logo" href="${SITE}/">
      <span class="bolt">&#9889;</span>
      <span>AutoElettriche usate.eu</span>
    </a>
  </div>
</header>
<main class="wrap">
  <p class="crumbs"><a href="${SITE}/">Home</a> &rsaquo; <a href="${SITE}/#annunci">Annunci</a> &rsaquo; ${escapeHtml(a.brand)} ${escapeHtml(a.model)}</p>
  <div class="gallery">${photos}</div>
  <div class="badges"><span class="bdg">${badge}</span><span class="bdg kwh">${String(a.battery).replace('.', ',')} kWh</span></div>
  <div class="itop">
    <div class="price">${fmt(a.price)} <span>&euro;</span></div>
    <div class="verified">${verified}</div>
  </div>
  <h1>${escapeHtml(a.brand)} ${escapeHtml(a.model)}</h1>
  <p class="ver">${escapeHtml(a.version)} &middot; ${escapeHtml(a.body)}</p>
  ${specRowHtml(a)}
  ${a.desc ? `<p class="desc">${escapeHtml(a.desc)}</p>` : ''}
  ${tags ? `<div class="feat"><p>Dotazioni in evidenza</p><div class="tags">${tags}</div></div>` : ''}
  <div class="seller-box">
    <span class="avatar">${escapeHtml(a.seller.charAt(0).toUpperCase())}</span>
    <div>
      <div class="seller-name">${escapeHtml(a.seller)}</div>
      <div class="seller-sub">${a.stype === 'dealer' ? 'Concessionario' : 'Privato'} &middot; ${escapeHtml(a.city)}</div>
    </div>
    <a class="cta" href="${SITE}/#annuncio-${a.id}">Vedi tutti i dettagli e contatta</a>
  </div>
  <a class="back" href="${SITE}/#annunci">&larr; Torna a tutti gli annunci</a>
</main>
</body>
</html>`;
}

function buildSitemap(ids) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...ids.map((id) => `<url><loc>${SITE}/${OUT_DIR}/${id}.html</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

async function main() {
  const rows = await fetchActiveListings();
  const ads = rows.map(mapRow);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const activeFilenames = new Set(ads.map((a) => `${a.id}.html`));
  const existing = readdirSync(OUT_DIR).filter((f) => f.endsWith('.html'));
  for (const f of existing) {
    if (!activeFilenames.has(f)) {
      unlinkSync(join(OUT_DIR, f));
      console.log('Rimossa pagina annuncio non piu attivo: ' + f);
    }
  }

  for (const a of ads) {
    writeFileSync(join(OUT_DIR, `${a.id}.html`), pageHtml(a));
  }

  writeFileSync('sitemap.xml', buildSitemap(ads.map((a) => a.id)));

  console.log('Generate ' + ads.length + ' pagine annuncio + sitemap.xml (' + (ads.length + 1) + ' URL).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
