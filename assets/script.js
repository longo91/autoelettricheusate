// assets/script.js - loads listings.json (mock) and renders cards + filters

async function fetchListings(){
  try{
    const res = await fetch('/listings.json', {cache: 'no-store'});
    if(!res.ok) throw new Error('Network response not ok');
    return await res.json();
  }catch(e){
    // fallback to embedded sample
    console.warn('Could not load listings.json, using embedded sample', e);
    return [
      { id: 1, brand: 'tesla', model: 'Model 3', version: 'Standard Range', type: 'ev', year: 2023, price: 32500, km: 15200, range: 507, acceleration: 6.1, condition: 'excellent', description: 'Ottima condizione, primo proprietario, manutenzione Tesla. Perfetta per pendolari.', seller: 'Marco R.', date: '2 giorni fa', img: '/assets/img/tesla-model3.jpg' },
      { id: 2, brand: 'bmw', model: 'X5 45e', version: 'xDrive45e Hybrid', type: 'phev', year: 2022, price: 48900, km: 32100, range: 67, acceleration: 5.3, condition: 'good', description: 'SUV luxury con batteria ibrida. Consumo ridotto, lussuoso e performante.', seller: 'Concessionario', date: '5 giorni fa', img: '/assets/img/bmw-x5.jpg' },
      { id: 3, brand: 'renault', model: 'Zoe', version: 'R135', type: 'ev', year: 2021, price: 18500, km: 45300, range: 395, acceleration: 8.4, condition: 'good', description: 'Piccola city car economica. Perfetta per l\'ambiente urbano, ottimi consumi.', seller: 'Sarah P.', date: '1 settimana fa', img: '/assets/img/renault-zoe.jpg' }
    ];
  }
}

const typeLabels = { ev: 'EV', phev: 'PHEV' };

function renderCards(data){
  const grid = document.getElementById('grid');
  const count = document.getElementById('adCount');
  count.textContent = data.length;
  if(data.length === 0){
    grid.innerHTML = '<div class="empty-state"><h3>Nessun annuncio trovato</h3><p>Prova a modificare i filtri di ricerca</p></div>';
    return;
  }
  grid.innerHTML = data.map(ad => `
    <div class="card">
      <div class="card-media">
        <span class="badge ${ad.type === 'phev' ? 'plugin' : ''}">${typeLabels[ad.type] || ''}</span>
        <span class="year-tag">${ad.year}</span>
        ${ad.img ? `<img src="${ad.img}" alt="${ad.brand} ${ad.model}">` : ''}
      </div>
      <div class="card-body">
        <h3>${capitalize(ad.brand)} ${ad.model}</h3>
        <p class="version">${ad.version || ''}</p>
        <div class="price">€${Number(ad.price).toLocaleString('it-IT')}</div>
        <div class="specs">
          <div class="spec"><span class="ico">📅</span> ${ad.year}</div>
          <div class="spec"><span class="ico">🛞</span> ${Number(ad.km).toLocaleString('it-IT')} km</div>
          <div class="spec"><span class="ico">⚡</span> ${ad.range || '-'} km</div>
          <div class="spec"><span class="ico">🏎️</span> ${ad.acceleration || '-'}s 0-100</div>
        </div>
        <p class="desc">${ad.description || ''}</p>
        <div class="card-foot">
          <div class="seller"><span>👤</span><span class="seller-name">${ad.seller}</span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <a class="btn" href="/product.html?id=${ad.id}">Vedi</a>
            <button class="like-btn" onclick="this.classList.toggle('liked')">❤️</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function capitalize(s){return s?.charAt(0).toUpperCase()+s?.slice(1) || ''}

function applyFilters(ads){
  let filtered = [...ads];
  const brand = document.getElementById('filterBrand').value;
  const model = document.getElementById('filterModel').value.toLowerCase();
  const type = document.getElementById('filterType').value;
  const yearFrom = document.getElementById('filterYearFrom').value;
  const yearTo = document.getElementById('filterYearTo').value;
  const priceFrom = parseFloat(document.getElementById('filterPriceFrom').value) || 0;
  const priceTo = parseFloat(document.getElementById('filterPriceTo').value) || Infinity;
  const km = parseFloat(document.getElementById('filterKm').value) || Infinity;
  const state = document.getElementById('filterState').value;
  const search = document.getElementById('headerSearch').value.toLowerCase();

  filtered = filtered.filter(ad => {
    if(brand && ad.brand !== brand) return false;
    if(model && !ad.model.toLowerCase().includes(model)) return false;
    if(type && ad.type !== type) return false;
    if(yearFrom && ad.year < parseInt(yearFrom)) return false;
    if(yearTo && ad.year > parseInt(yearTo)) return false;
    if(ad.price < priceFrom || ad.price > priceTo) return false;
    if(ad.km > km) return false;
    if(state && ad.condition !== state) return false;
    if(search && !ad.model.toLowerCase().includes(search) && !ad.brand.toLowerCase().includes(search)) return false;
    return true;
  });

  // sorting
  const sortBy = document.getElementById('sortBy').value;
  if(sortBy === 'price-asc') filtered.sort((a,b)=>a.price-b.price);
  if(sortBy === 'price-desc') filtered.sort((a,b)=>b.price-a.price);
  if(sortBy === 'km-asc') filtered.sort((a,b)=>a.km-b.km);

  renderCards(filtered);
}

// init
(async ()=>{
  const ads = await fetchListings();
  renderCards(ads);

  // attach listeners
  ['filterBrand','filterModel','filterType','filterYearFrom','filterYearTo','filterPriceFrom','filterPriceTo','filterKm','filterState','sortBy'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', ()=>applyFilters(ads));
  });
  document.getElementById('headerSearch')?.addEventListener('input', ()=>applyFilters(ads));
  document.getElementById('btnReset')?.addEventListener('click', ()=>{
    document.querySelectorAll('.filter-select, .filter-input').forEach(el=>el.value='');
    document.getElementById('headerSearch').value = '';
    document.getElementById('sortBy').value = 'recent';
    applyFilters(ads);
  });
  document.getElementById('heroSearchBtn')?.addEventListener('click', ()=>applyFilters(ads));
})();
