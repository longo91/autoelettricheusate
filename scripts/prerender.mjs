// Pre-renderizza gli annunci attivi di Supabase dentro index.html, cosi'
// i motori di ricerca vedono il contenuto reale senza dover eseguire JS
// e attendere la fetch asincrona lato client.
// Eseguito da .github/workflows/prerender.yml.

import { readFileSync, writeFileSync } from 'node:fs';

const SUPABASE_URL = 'https://komvmedptbcsiiswoaja.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W1l56uhiAnI6g7rhvkqtZg_WesZk_rd';
const PAGE = 8;

const GRAD = [
  'linear-gradient(135deg,#d9f7ec,#a5e9d3)',
  'linear-gradient(135deg,#e3f4ff,#b7ddf4)',
  'linear-gradient(135deg,#eaf7dd,#c4e8b1)',
  'linear-gradient(135deg,#f1f1ff,#cdcff5)',
  'linear-gradient(135deg,#fff3dd,#ffd9a6)',
  'linear-gradient(135deg,#e9f1f0,#bed8d3)'
];

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
    seller: row.nome,
    stype: row.tipo_venditore === 'rivenditore' ? 'dealer' : 'private',
    city: row.citta + (row.prov ? ' (' + row.prov + ')' : ''),
    g: row.id % 6,
    desc: row.descrizione || '',
    feat: Array.isArray(row.optional) ? row.optional : [],
    foto: Array.isArray(row.foto) ? row.foto : []
  };
}

function carSvgFallback() {
  return '<svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M26 86c-7 0-12-6-10-13l6-19c3-8 10-13 18-14l34-5 26-16c8-5 17-8 26-8h30c11 0 22 4 30 12l16 16 20 5c9 3 16 11 16 21v9c0 7-6 12-13 12H26z" fill="rgba(255,255,255,.9)"/>' +
    '<path d="M132 20h26c7 0 14 3 19 8l14 14h-59V20z" fill="rgba(20,49,42,.14)"/>' +
    '<path d="M122 20h-14c-7 0-13 2-19 6l-24 16h57V20z" fill="rgba(20,49,42,.08)"/>' +
    '<circle cx="76" cy="86" r="18" fill="rgba(20,49,42,.82)"/><circle cx="76" cy="86" r="7" fill="rgba(255,255,255,.92)"/>' +
    '<circle cx="182" cy="86" r="18" fill="rgba(20,49,42,.82)"/><circle cx="182" cy="86" r="7" fill="rgba(255,255,255,.92)"/>' +
    '<path d="M124 48l-11 18h7l-2 14 12-20h-8z" fill="#00b98d"/>' +
    '</svg>';
}

function cardHtml(a) {
  const badge = a.type === 'ev'
    ? '<span class="bdg ev">100% elettrica</span>'
    : '<span class="bdg phev">Ibrida plug-in</span>';
  const verified = a.stype === 'dealer'
    ? '<div class="verified">&#10003; Rivenditore verificato</div>'
    : '<div class="verified">&#128100; Venditore privato</div>';
  const tags = a.feat.map((f) => '<span class="tag">&#9889; ' + escapeHtml(f) + '</span>').join('');
  const media = a.foto.length
    ? "center/cover no-repeat url('" + escapeHtml(a.foto[0]) + "')"
    : (GRAD[a.g] || GRAD[0]);

  return '<article class="ad">' +
    '<div class="ad-top">' +
    '<div class="media" data-open="' + a.id + '" style="background:' + media + '">' +
    (a.foto.length ? '' : carSvgFallback()) +
    '<div class="badges">' + badge + '<span class="bdg">' + String(a.battery).replace('.', ',') + ' kWh</span></div>' +
    '<span class="yeartag">' + a.year + '</span>' +
    '<div class="thumbs"><i></i><i></i><i></i></div>' +
    '</div>' +
    '<div class="info">' +
    '<div class="itop"><div class="price">' + fmt(a.price) + ' <span>&euro;</span></div>' + verified + '</div>' +
    '<h3><a href="#annunci" data-open="' + a.id + '">' + escapeHtml(a.brand) + ' ' + escapeHtml(a.model) + '</a></h3>' +
    '<p class="ver">' + escapeHtml(a.version) + ' &middot; ' + escapeHtml(a.body) + '</p>' +
    '<div class="specs">' +
    '<div class="sp"><label>Chilometri</label><b>' + fmt(a.km) + ' km</b></div>' +
    '<div class="sp"><label>Cambio</label><b>Automatico</b></div>' +
    '<div class="sp"><label>Alimentazione</label><b>' + (a.type === 'ev' ? 'Elettrica' : 'Ibrida plug-in') + '</b></div>' +
    '<div class="sp"><label>Immatricolazione</label><b>' + a.month + ' ' + a.year + '</b></div>' +
    '<div class="sp"><label>Potenza</label><b>' + a.kw + ' kW (' + a.cv + ' CV)</b></div>' +
    '<div class="sp"><label>Autonomia</label><b>' + fmt(a.range) + ' km' + (a.type === 'phev' ? ' elettrici' : '') + '</b></div>' +
    '</div>' +
    '<div class="feat"><p>In evidenza</p><div class="tags">' + tags + '</div></div>' +
    '</div>' +
    '</div>' +
    '<div class="ad-foot">' +
    '<div class="seller"><span class="avatar">' + escapeHtml(a.seller.charAt(0).toUpperCase()) + '</span>' +
    '<span>' + escapeHtml(a.seller) + '<small>' + (a.stype === 'dealer' ? 'Concessionario' : 'Privato') + ' &middot; ' + escapeHtml(a.city) + '</small></span></div>' +
    '<div class="acts">' +
    '<button class="btn sm" type="button" data-open="' + a.id + '">Vedi dettagli</button>' +
    '<button class="btn primary sm" type="button" data-open="' + a.id + '">Contatta</button>' +
    '<button class="icon like" type="button" data-like="' + a.id + '" aria-label="Salva annuncio">&#10084;</button>' +
    '</div>' +
    '</div>' +
    '</article>';
}

function buildItemList(ads) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: ads.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: (a.brand + ' ' + a.model + (a.version ? ' ' + a.version : '')).trim(),
        description: a.desc || (a.brand + ' ' + a.model + ' usata, ' + a.km + ' km, autonomia ' + a.range + ' km.'),
        ...(a.foto.length ? { image: a.foto } : {}),
        brand: { '@type': 'Brand', name: a.brand },
        offers: {
          '@type': 'Offer',
          price: a.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/UsedCondition',
          url: 'https://autoelettricheusate.eu/#annunci'
        }
      }
    }))
  };
}

function replaceBetween(html, startMarker, endMarker, content) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Marker non trovato: ' + startMarker + ' / ' + endMarker);
  }
  return html.slice(0, start + startMarker.length) + content + html.slice(end);
}

async function main() {
  const rows = await fetchActiveListings();
  const ads = rows.map(mapRow);
  const visible = ads.slice(0, PAGE);

  let html = readFileSync('index.html', 'utf8');

  html = replaceBetween(
    html,
    '<!--PRERENDER:LIST:START-->',
    '<!--PRERENDER:LIST:END-->',
    visible.map(cardHtml).join('')
  );

  html = html.replace(
    /<span id="count">[^<]*<\/span>/,
    '<span id="count">' + fmt(ads.length) + '</span>'
  );

  const itemList = buildItemList(visible);
  html = html.replace(
    /(<script type="application\/ld\+json" id="ld-annunci">)[\s\S]*?(<\/script>)/,
    '$1' + JSON.stringify(itemList) + '$2'
  );

  writeFileSync('index.html', html);
  console.log('Pre-renderizzati ' + visible.length + ' annunci (di ' + ads.length + ' attivi).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
