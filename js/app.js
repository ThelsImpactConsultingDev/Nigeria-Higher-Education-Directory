(function(){
"use strict";

const zoneOrder = ["North Central","North East","North West","South East","South South","South West"];
const PAGE_SIZE = 60;

const KIND_META = {
  universities:  { label: "University",           unitLabel: "Faculty" },
  colleges:      { label: "College of Education", unitLabel: "School" },
  polytechnics:  { label: "Polytechnic",          unitLabel: "School" },
  monotechnics:  { label: "Monotechnic",          unitLabel: "Department" },
  health:        { label: "College of Health",    unitLabel: "School" },
};

/* Live data lives in a Google Sheet (published to the web as CSV, one tab
   per category). SHEET_KEY is the "publish to web" document key -- found in
   the /d/e/<KEY>/pub URL Google gives you from File > Share > Publish to
   web. Each tab has its own gid (visible in the browser URL as ?gid=... when
   that tab is selected) and its own column names, which is why `columns`
   below maps this app's field names to whatever that tab actually calls
   them. Monotechnics and Colleges of Health have no tab yet, so they're
   left out of SHEET_SOURCES entirely and stay "coming soon". */
const SHEET_KEY = "2PACX-1vSSW4sqeZFTc9kQdHFOALOvRcwD8KuSZGraEoZuJa4JdevPedDKH0a3eQ0zwlMHjOnxvaQihO2C4Eea";

function sheetCsvUrl(gid){
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_KEY}/pub?gid=${gid}&single=true&output=csv`;
}

const SHEET_SOURCES = {
  universities: {
    gid: "2065139486",
    columns: { institution: "UNIVERSITIES", unit: "Faculty", programme: "Programmes", state: "STATE", website: "WEBSITE", proprietorship: "TYPE OF PROPRIETARY" },
  },
  colleges: {
    gid: "1234885830",
    columns: { institution: "COLLEGE OF EDUCATION", unit: "SCHOOLS", programme: "PROGRAMME", programmeType: "PROGRAMME TYPE", state: "STATE", website: "WEBSITES", proprietorship: "PROPRIETY" },
  },
  polytechnics: {
    gid: "1375561536",
    columns: { institution: "Polytechnic", unit: "Facilities", programme: "Programmes", state: "STATE", website: "WEBSITE", proprietorship: "TYPE OF PROPREITARY" },
  },
};

/* Zone is never read from the sheet -- it's derived from State here, so an
   editor can never leave a listing with a state/zone that disagree. Add a
   state to a sheet without an entry below and it will throw, on purpose,
   rather than silently ship a listing with no zone. */
const STATE_ZONE = {
  "Benue":"North Central", "Kogi":"North Central", "Kwara":"North Central",
  "Nasarawa":"North Central", "Niger":"North Central", "Plateau":"North Central",
  "FCT (Abuja)":"North Central",
  "Adamawa":"North East", "Bauchi":"North East", "Borno":"North East",
  "Gombe":"North East", "Taraba":"North East", "Yobe":"North East",
  "Jigawa":"North West", "Kaduna":"North West", "Kano":"North West",
  "Katsina":"North West", "Kebbi":"North West", "Sokoto":"North West",
  "Zamfara":"North West",
  "Abia":"South East", "Anambra":"South East", "Ebonyi":"South East",
  "Enugu":"South East", "Imo":"South East",
  "Akwa Ibom":"South South", "Bayelsa":"South South", "Cross River":"South South",
  "Delta":"South South", "Edo":"South South", "Rivers":"South South",
  "Ekiti":"South West", "Lagos":"South West", "Ogun":"South West",
  "Ondo":"South West", "Osun":"South West", "Oyo":"South West",
};

// The sheets spell FCT a couple of different ways -- normalize to the
// STATE_ZONE key before doing the zone lookup below.
const STATE_ALIASES = {
  "FCT": "FCT (Abuja)",
  "Federal Capital Territory": "FCT (Abuja)",
  "Abuja": "FCT (Abuja)",
};

/* Minimal RFC4180 CSV parser -- handles quoted fields, embedded commas,
   escaped quotes ("") and embedded newlines. Google's published-CSV export
   is the only format this app reads now, and the vendored SheetJS "core"
   build's CSV support is unverified, so this is deliberately self-contained
   rather than a dependency. */
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if(c === '"'){
      inQuotes = true;
    } else if(c === ','){
      row.push(field); field = "";
    } else if(c === '\r'){
      // skip; \n (bare or as part of \r\n) ends the row
    } else if(c === '\n'){
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if(field.length > 0 || row.length > 0){ row.push(field); rows.push(row); }
  return rows;
}

function csvToObjects(text){
  const rows = parseCSV(text);
  if(rows.length === 0) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ""; });
    return obj;
  });
}

/* Universities have no programme-type column in the sheet, so this used to
   read as blank/"Not specified". Per correction #2, universities should show
   "Degree" for now instead of an unspecified value. Other kinds keep
   "Coming Soon" until their award-type data is sourced. */
function normalizeProgrammeType(raw, kind){
  const isBlank = !raw || raw.toLowerCase() === "not specified";
  if(!isBlank) return raw;
  return kind === "universities" ? "Degree" : "Coming Soon";
}

function rowsToRecords(rows, kind, columns){
  const meta = KIND_META[kind];
  return rows.map((row, n) => {
    const institution = String(row[columns.institution] || "").trim();
    let stateName = String(row[columns.state] || "").trim();
    const programme = String(row[columns.programme] || "").trim();
    if(!institution || !stateName || !programme) return null;
    stateName = STATE_ALIASES[stateName] || stateName;
    const zone = STATE_ZONE[stateName];
    if(!zone) throw new Error(`Unknown state "${stateName}" on sheet for ${kind} (row ${n+2}). Add it to STATE_ZONE/STATE_ALIASES in js/app.js or fix the spelling in the source sheet.`);
    return {
      id: kind + "-" + n,
      kind,
      kindLabel: meta.label,
      institution,
      unit: String(row[columns.unit] || "").trim(),
      unitLabel: meta.unitLabel,
      programme,
      programmeType: normalizeProgrammeType(
        (columns.programmeType && String(row[columns.programmeType] || "").trim()) || "",
        kind
      ),
      state: stateName,
      zone,
      website: String(row[columns.website] || "").trim().replace(/^https?:\/\//i, ""),
      proprietorship: String(row[columns.proprietorship] || "").trim(),
      cutoffs: {},            // not yet sourced
      accreditation: null,    // not yet sourced
    };
  }).filter(Boolean);
}

let ALL = [];
let COMING_SOON = new Set();

const state = {
  type: "all",
  zone: null,
  stateFilter: "",
  progQuery: "",
  progTypeFilter: "",
  unitFilter: "",
  instFilter: "",
  heroQuery: "",
  owners: new Set(["Federal","State","Private"]),
  sort: "institution",
  compare: new Set(),
  visibleCount: PAGE_SIZE,
};

/* Award type only carries real, sourced data for Colleges of Education right
   now (universities/polytechnics show a placeholder) -- and per correction
   #2, the filter itself should be hidden entirely when the selected
   institution type is "Universities", since it doesn't apply there yet. */
function awardTypeApplies(type){
  return type !== "universities";
}

const fmt = n => n.toLocaleString('en-US');

let toastTimer = null;
function showToast(message){
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function showLoadError(message){
  const grid = document.getElementById('resultsGrid');
  document.getElementById('loadMoreWrap').style.display = 'none';
  document.getElementById('comingSoon').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">
    <div class="display">Could not load the directory</div>
    <div>${message}</div>
  </div>`;
}

async function loadData(){
  const recordsByKind = {};
  Object.keys(KIND_META).forEach(k => { recordsByKind[k] = []; });

  let fetched;
  try {
    fetched = await Promise.all(Object.entries(SHEET_SOURCES).map(async ([kind, src]) => {
      const url = sheetCsvUrl(src.gid);
      const res = await fetch(url);
      if(!res.ok) throw new Error(`HTTP ${res.status} fetching the "${kind}" sheet`);
      const text = await res.text();
      return [kind, text];
    }));
  } catch(err){
    showLoadError(`Couldn't fetch the live directory data from Google Sheets (${err.message}). Check your connection, or that the sheet is still published to the web (File > Share > Publish to web in the source spreadsheet).`);
    throw err;
  }

  try {
    for(const [kind, text] of fetched){
      const rows = csvToObjects(text);
      recordsByKind[kind] = rowsToRecords(rows, kind, SHEET_SOURCES[kind].columns);
    }
    ALL = Object.values(recordsByKind).flat();
    COMING_SOON = new Set(Object.keys(recordsByKind).filter(k => recordsByKind[k].length === 0));
  } catch(err){
    showLoadError(`The live sheet data didn't parse cleanly: ${err.message}`);
    throw err;
  }

  init();
}

function init(){
const institutionCount = new Set(ALL.map(r=>r.institution)).size;
document.getElementById('statInstitutions').textContent = fmt(institutionCount);
document.getElementById('statProgrammes').textContent = fmt(ALL.length);
const stateCount = new Set(ALL.map(r=>r.state)).size;
const hasFCT = new Set(ALL.map(r=>r.state)).has('FCT (Abuja)');
document.getElementById('statStates').textContent = hasFCT ? (stateCount - 1) + ' + FCT' : fmt(stateCount);
document.getElementById('subCount').textContent = fmt(ALL.length);
document.getElementById('heroInstCount').textContent = fmt(institutionCount);
document.getElementById('heroInstCount2').textContent = fmt(institutionCount);

const states = [...new Set(ALL.map(r=>r.state))].sort();
const stateOptions = document.getElementById('stateOptions');
states.forEach(s => {
  const opt = document.createElement('option');
  opt.value = s;
  stateOptions.appendChild(opt);
});

const progTypes = [...new Set(ALL.map(r=>r.programmeType))].sort();
const progTypeSelect = document.getElementById('progTypeSelect');
progTypes.forEach(t => {
  const opt = document.createElement('option');
  opt.value = t; opt.textContent = t;
  progTypeSelect.appendChild(opt);
});

const zoneSelect = document.getElementById('zoneSelect');
zoneOrder.forEach(z => {
  const opt = document.createElement('option');
  opt.value = z; opt.textContent = z;
  zoneSelect.appendChild(opt);
});

/* Faculty/School and Programme are dependent dropdowns: their option lists
   narrow to whatever institution type (and, once one is picked, faculty)
   is currently selected, so e.g. choosing "Engineering" as a faculty only
   offers Engineering-related programmes rather than every programme in the
   whole directory. */
function scopedRecords({ toUnit } = {}){
  return ALL.filter(r => {
    if(state.type !== 'all' && r.kind !== state.type) return false;
    if(state.instFilter && r.institution !== state.instFilter) return false;
    if(toUnit && state.unitFilter && r.unit !== state.unitFilter) return false;
    return true;
  });
}

function refreshDependentOptions(){
  const unitOptions = document.getElementById('unitOptions');
  const progOptions = document.getElementById('progOptions');
  unitOptions.innerHTML = "";
  progOptions.innerHTML = "";

  const units = [...new Set(scopedRecords().map(r=>r.unit))].filter(Boolean).sort();
  units.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u;
    unitOptions.appendChild(opt);
  });

  const programmes = [...new Set(scopedRecords({toUnit:true}).map(r=>r.programme))].filter(Boolean).sort();
  programmes.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    progOptions.appendChild(opt);
  });
}
refreshDependentOptions();

/* Award type is only meaningful once Colleges of Education (or another
   non-university type) is selected -- hide the whole field for
   Universities per correction #2. */
function syncAwardTypeVisibility(){
  document.getElementById('progTypeField').style.display = awardTypeApplies(state.type) ? '' : 'none';
  if(!awardTypeApplies(state.type) && state.progTypeFilter){
    state.progTypeFilter = '';
    document.getElementById('progTypeSelect').value = '';
  }
}
syncAwardTypeVisibility();

const zoneStrip = document.getElementById('zoneStrip');
zoneOrder.forEach(z => {
  const count = ALL.filter(r=>r.zone===z).length;
  const btn = document.createElement('button');
  btn.className = 'zone-chip';
  btn.dataset.zone = z;
  btn.innerHTML = '<div class="zn">'+fmt(count)+' listings</div><div class="zc">'+z+'</div>';
  btn.addEventListener('click', () => {
    state.zone = (state.zone === z) ? null : z;
    document.getElementById('zoneSelect').value = state.zone || '';
    state.visibleCount = PAGE_SIZE;
    render();
  });
  zoneStrip.appendChild(btn);
});

document.querySelectorAll('#typeToggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#typeToggle button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.type = btn.dataset.type;
    // Faculty/programme picks made under the previous type rarely carry
    // over cleanly, so clear the dependent fields rather than leaving a
    // stale (and now possibly invalid) selection in place.
    state.unitFilter = ''; document.getElementById('unitSelect').value = '';
    state.progQuery = ''; document.getElementById('progInput').value = '';
    document.getElementById('unitSelectLabel').textContent =
      (KIND_META[btn.dataset.type] ? KIND_META[btn.dataset.type].unitLabel : 'Faculty / School / Department');
    syncAwardTypeVisibility();
    refreshDependentOptions();
    state.visibleCount = PAGE_SIZE;
    render();
  });
});

document.getElementById('zoneSelect').addEventListener('change', e => {
  state.zone = e.target.value || null; state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('stateSelect').addEventListener('input', e => {
  state.stateFilter = e.target.value.trim(); state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('progInput').addEventListener('input', e => {
  state.progQuery = e.target.value.toLowerCase(); state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('progTypeSelect').addEventListener('change', e => {
  state.progTypeFilter = e.target.value; state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('unitSelect').addEventListener('input', e => {
  state.unitFilter = e.target.value.trim(); state.visibleCount = PAGE_SIZE;
  refreshDependentOptions();
  render();
});
document.getElementById('heroSearch').addEventListener('input', e => {
  state.heroQuery = e.target.value.toLowerCase(); state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('heroSearchBtn').addEventListener('click', () => {
  document.querySelector('.layout').scrollIntoView({behavior:'smooth'});
});
document.getElementById('ownerFilters').addEventListener('change', () => {
  const checked = [...document.querySelectorAll('#ownerFilters input:checked')].map(i=>i.value);
  state.owners = new Set(checked); state.visibleCount = PAGE_SIZE; render();
});
document.getElementById('sortSelect').addEventListener('change', e => {
  state.sort = e.target.value; render();
});
document.getElementById('loadMoreBtn').addEventListener('click', () => {
  state.visibleCount += PAGE_SIZE; render();
});
document.getElementById('resetBtn').addEventListener('click', () => {
  state.type = "all"; state.zone = null; state.stateFilter = ""; state.progQuery = "";
  state.progTypeFilter = ""; state.unitFilter = ""; state.instFilter = "";
  state.heroQuery = ""; state.owners = new Set(["Federal","State","Private"]);
  state.sort = "institution"; state.visibleCount = PAGE_SIZE;
  document.getElementById('stateSelect').value = "";
  document.getElementById('progInput').value = "";
  document.getElementById('progTypeSelect').value = "";
  document.getElementById('unitSelect').value = "";
  document.getElementById('zoneSelect').value = "";
  document.getElementById('unitSelectLabel').textContent = "Faculty / School / Department";
  document.getElementById('heroSearch').value = "";
  document.querySelectorAll('#ownerFilters input').forEach(i=>i.checked=true);
  document.querySelectorAll('#typeToggle button').forEach(b=>b.classList.remove('active'));
  document.querySelector('#typeToggle button[data-type="all"]').classList.add('active');
  syncAwardTypeVisibility();
  refreshDependentOptions();
  render();
});

function filtered(){
  return ALL.filter(r => {
    if(state.type !== "all" && r.kind !== state.type) return false;
    if(state.instFilter && r.institution !== state.instFilter) return false;
    if(state.zone && r.zone !== state.zone) return false;
    if(state.stateFilter && !r.state.toLowerCase().includes(state.stateFilter.toLowerCase())) return false;
    if(!state.owners.has(r.proprietorship)) return false;
    if(awardTypeApplies(state.type) && state.progTypeFilter && r.programmeType !== state.progTypeFilter) return false;
    if(state.unitFilter && !r.unit.toLowerCase().includes(state.unitFilter.toLowerCase())) return false;
    if(state.progQuery && !r.programme.toLowerCase().includes(state.progQuery)) return false;
    if(state.heroQuery){
      const hay = (r.programme+" "+r.institution+" "+r.state+" "+r.unit).toLowerCase();
      if(!hay.includes(state.heroQuery)) return false;
    }
    return true;
  }).sort((a,b) => {
    return (a[state.sort]||"").localeCompare(b[state.sort]||"");
  });
}

function render(){
  document.querySelectorAll('.zone-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.zone === state.zone);
  });

  const rows = filtered();
  document.getElementById('resultCount').textContent = fmt(rows.length);
  const grid = document.getElementById('resultsGrid');
  const empty = document.getElementById('emptyState');
  const soon = document.getElementById('comingSoon');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  grid.innerHTML = "";

  if(COMING_SOON.has(state.type)){
    soon.style.display = 'block';
    empty.style.display = 'none';
    loadMoreWrap.style.display = 'none';
    renderActiveFilters(); renderTray();
    return;
  }
  soon.style.display = 'none';

  if(rows.length === 0){
    empty.style.display = 'block';
    loadMoreWrap.style.display = 'none';
  } else {
    empty.style.display = 'none';
    const visible = rows.slice(0, state.visibleCount);
    const frag = document.createDocumentFragment();
    visible.forEach(r => frag.appendChild(card(r)));
    grid.appendChild(frag);
    loadMoreWrap.style.display = rows.length > state.visibleCount ? 'flex' : 'none';
  }
  renderActiveFilters();
  renderTray();
}

function renderActiveFilters(){
  const wrap = document.getElementById('activeFilters');
  wrap.innerHTML = "";
  const chips = [];
  if(state.type !== 'all'){
    const label = document.querySelector('#typeToggle button[data-type="'+state.type+'"]').textContent;
    chips.push(['Type: '+label, () => { state.type='all'; document.querySelectorAll('#typeToggle button').forEach(b=>b.classList.remove('active')); document.querySelector('#typeToggle button[data-type="all"]').classList.add('active'); }]);
  }
  if(state.instFilter) chips.push(['Institution: '+state.instFilter, () => { state.instFilter=''; }]);
  if(state.zone) chips.push(['Zone: '+state.zone, () => { state.zone=null; document.getElementById('zoneSelect').value=''; }]);
  if(state.stateFilter) chips.push(['State: '+state.stateFilter, () => { state.stateFilter=''; document.getElementById('stateSelect').value=''; }]);
  if(state.unitFilter) chips.push(['Faculty/School: '+state.unitFilter, () => { state.unitFilter=''; document.getElementById('unitSelect').value=''; refreshDependentOptions(); }]);
  if(state.progQuery) chips.push(['Programme: "'+state.progQuery+'"', () => { state.progQuery=''; document.getElementById('progInput').value=''; }]);
  if(awardTypeApplies(state.type) && state.progTypeFilter) chips.push(['Award: '+state.progTypeFilter, () => { state.progTypeFilter=''; document.getElementById('progTypeSelect').value=''; }]);
  if(state.owners.size < 3) chips.push(['Ownership: '+[...state.owners].join(', '), () => { state.owners=new Set(['Federal','State','Private']); document.querySelectorAll('#ownerFilters input').forEach(i=>i.checked=true); }]);

  if(chips.length === 0){
    const span = document.createElement('span');
    span.style.cssText = 'font-size:0.78rem; color:var(--ink-muted);';
    span.textContent = 'No filters applied — showing everything.';
    wrap.appendChild(span);
    return;
  }
  chips.forEach(([text, clearFn]) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `<span>${text}</span><button aria-label="Clear">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => { clearFn(); state.visibleCount = PAGE_SIZE; render(); });
    wrap.appendChild(chip);
  });
}

function card(r){
  const el = document.createElement('div');
  el.className = 'card';
  const siteAction = r.website
    ? `<a href="https://${r.website}" target="_blank" rel="noopener">Visit site</a>`
    : `<span class="unavailable" aria-disabled="true">Not available</span>`;
  el.innerHTML = `
    <div class="card-top">
      <span class="badge type">${r.kindLabel}</span>
      <span class="badge ${r.proprietorship}">${r.proprietorship}</span>
    </div>
    <div class="prog">${r.programme}</div>
    <button type="button" class="inst inst-link" title="See every faculty and programme at ${r.institution}">${r.institution}</button>
    <button type="button" class="fac fac-link" title="See every programme under ${r.unitLabel} of ${r.unit}">${r.unitLabel}: ${r.unit}</button>
    <div class="meta">
      <span>📍 ${r.state}, ${r.zone}</span>
      <span class="mono">${r.programmeType}</span>
    </div>
    <div class="meta">
      <span class="mono soon-inline">Cut-off: coming soon</span>
      <span class="soon-inline">Accreditation: coming soon</span>
    </div>
    <div class="card-actions">
      ${siteAction}
      <button class="add ${state.compare.has(r.id)?'added':''}" data-id="${r.id}">${state.compare.has(r.id) ? 'Added ✓' : '+ Compare'}</button>
    </div>
  `;
  el.querySelector('button.add').addEventListener('click', () => {
    if(state.compare.has(r.id)){
      state.compare.delete(r.id);
    } else {
      if(state.compare.size >= 3){ showToast('You can compare up to 3 listings at a time.'); return; }
      state.compare.add(r.id);
    }
    render();
  });
  // Institution-type link logic: the institution name navigates within the
  // directory to that institution's own faculties/programmes, rather than
  // out to a generic external page.
  el.querySelector('button.inst-link').addEventListener('click', () => {
    state.instFilter = r.institution;
    state.unitFilter = ''; document.getElementById('unitSelect').value = '';
    state.progQuery = ''; document.getElementById('progInput').value = '';
    state.visibleCount = PAGE_SIZE;
    refreshDependentOptions();
    render();
    document.querySelector('.layout').scrollIntoView({behavior:'smooth'});
  });
  // Faculty -> Programmes navigation: clicking a faculty/school drops
  // straight into the list of programmes under that faculty.
  el.querySelector('button.fac-link').addEventListener('click', () => {
    state.instFilter = r.institution;
    state.unitFilter = r.unit;
    document.getElementById('unitSelect').value = r.unit;
    state.progQuery = ''; document.getElementById('progInput').value = '';
    state.visibleCount = PAGE_SIZE;
    refreshDependentOptions();
    render();
    document.querySelector('.layout').scrollIntoView({behavior:'smooth'});
  });
  return el;
}

function renderTray(){
  const tray = document.getElementById('tray');
  const items = document.getElementById('trayItems');
  const btn = document.getElementById('compareBtn');
  items.innerHTML = "";
  if(state.compare.size === 0){ tray.classList.remove('show'); return; }
  tray.classList.add('show');
  [...state.compare].forEach(id => {
    const r = ALL.find(x=>x.id===id);
    const chip = document.createElement('div');
    chip.className = 'tray-chip';
    chip.innerHTML = `<span>${r.programme} · ${r.institution}</span><button aria-label="Remove">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => { state.compare.delete(id); render(); });
    items.appendChild(chip);
  });
  btn.disabled = state.compare.size < 2;
}

function openCompareView(){
  const heading = document.querySelector('.modal-head h2');
  const modalBody = document.getElementById('modalBody');
  const rows = [...state.compare].map(id => ALL.find(x=>x.id===id));

  if(rows.length === 0){
    heading.textContent = 'Compare';
    modalBody.innerHTML = `
      <div style="text-align:center; padding:40px 10px; color:var(--ink-muted);">
        <div class="display" style="font-size:1.15rem; margin-bottom:10px;">Nothing added to compare yet</div>
        <p>Go back to the directory and tap <b style="color:var(--navy);">+ Compare</b> on up to 3 listings you're weighing up, then open Compare again from the header.</p>
      </div>`;
  } else if(rows.length === 1){
    heading.textContent = 'Compare';
    modalBody.innerHTML = `
      <p style="color:var(--ink-muted); margin-bottom:16px;">You've added one listing. Add at least one more from the directory to see a side-by-side table.</p>
      <div class="grid" style="grid-template-columns:1fr;"></div>`;
    modalBody.querySelector('.grid').appendChild(card(rows[0]));
  } else {
    heading.textContent = 'Side-by-side comparison';
    const unitLabels = [...new Set(rows.map(r => r.unitLabel))];
    const unitFieldLabel = unitLabels.join(' / '); // e.g. "Faculty" alone, or "Faculty / School" when comparing across institution types
    const fields = [
      ['Institution','institution'], ['Type','kindLabel'], ['Programme','programme'],
      [unitFieldLabel,'unit'], ['Award type','programmeType'],
      ['Cut-off mark','__soon__'], ['Accreditation','__soon__'],
      ['State','state'], ['Zone','zone'], ['Proprietorship','proprietorship'], ['Website','website'],
    ];
    let html = '<p style="font-size:0.8rem; color:var(--ink-muted); margin-bottom:12px;">Cut-off marks and accreditation status are not yet available.</p>';
    html += '<table class="compare-table"><thead><tr><th></th>';
    rows.forEach(r => html += `<th>${r.programme}</th>`);
    html += '</tr></thead><tbody>';
    fields.forEach(([label,key]) => {
      html += `<tr><td class="label">${label}</td>`;
      rows.forEach(r => {
        let val = key === '__soon__' ? '<span class="soon-inline">Coming soon</span>' : r[key];
        if(key==='website') val = val ? `<a href="https://${val}" target="_blank">${val}</a>` : '<span class="unavailable">Not available</span>';
        html += `<td>${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    modalBody.innerHTML = html;
  }
  document.getElementById('modalBackdrop').classList.add('show');
}

function setNav(activeId){
  document.querySelectorAll('nav.top button').forEach(b => b.classList.remove('on'));
  document.getElementById(activeId).classList.add('on');
}

document.getElementById('compareBtn').addEventListener('click', () => {
  if(state.compare.size < 2) return;
  openCompareView();
});
document.getElementById('navDirectory').addEventListener('click', () => {
  setNav('navDirectory');
  document.querySelector('.layout').scrollIntoView({behavior:'smooth'});
});
document.getElementById('navCompare').addEventListener('click', () => {
  setNav('navCompare');
  openCompareView();
});
/* Correct dashboard link, kept ready for when the researcher tooling goes
   live -- for now the nav item is intentionally "Coming soon" (see the
   click handler below) rather than opening this. */
const RESEARCHER_DASHBOARD_URL = "https://public.tableau.com/app/profile/thels.impact.consulting/viz/ThelsUni_Data/Dashboard5";
document.getElementById('navResearchers').addEventListener('click', () => {
  showToast("For researchers: coming soon — get information on Nigerian higher institutions.");
});
document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('modalBackdrop').classList.remove('show');
});
document.getElementById('modalBackdrop').addEventListener('click', (e) => {
  if(e.target.id === 'modalBackdrop') e.target.classList.remove('show');
});

render();
}

loadData().catch(err => console.error('Failed to load directory data:', err));

/* Phone and tablet: filters start collapsed so results lead the page. */
(function(){
  var btn = document.getElementById('filterToggle');
  var panel = document.getElementById('filterPanel');
  if(!btn || !panel) return;
  var label = btn.querySelector('.ft-label');
  function set(open){
    panel.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    label.textContent = open ? 'Hide filters' : 'Show filters';
  }
  btn.addEventListener('click', function(){ set(!panel.classList.contains('open')); });
  /* Resizing up to desktop must not strand the rail hidden. */
  var wide = window.matchMedia('(min-width:901px)');
  function sync(){ if(wide.matches) set(false); }
  if(wide.addEventListener) wide.addEventListener('change', sync);
  else if(wide.addListener) wide.addListener(sync);
})();

})();
