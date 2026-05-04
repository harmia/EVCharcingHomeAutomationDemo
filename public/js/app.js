/* ─────────────────────────────────────────────────────────
   EV Charging Scheduler – frontend logic
   ───────────────────────────────────────────────────────── */

// ── State ────────────────────────────────────────────────
const state = {
  day: 'today',
  inputMode: 'manual',              // 'manual' | 'auto'
  prices: { today: [], tomorrow: [] },
  selected: { today: new Set(), tomorrow: new Set() },
  settings: {
    chargingPower: 11,
    energyNeeded:  22,
    windowStart:   22,
    windowEnd:      7,
    targetReadyBy:  7,
  },
};

// ── DOM helpers ──────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Initialisation ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populateHourSelects();
  tickClock();
  setInterval(tickClock, 10_000);

  await Promise.all([loadPrices(), loadSchedule()]);
  renderPriceList();
  updateSummary();
  wireEvents();
});

// ── Clock ────────────────────────────────────────────────
function tickClock() {
  const now = new Date();
  const tz  = 'Europe/Helsinki';
  const date = now.toLocaleDateString('fi-FI',  { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString('fi-FI',  { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  $('clock').textContent = `${date}  ${time}`;
}

// ── Hour <select> population ─────────────────────────────
function populateHourSelects() {
  const ids = ['windowStart', 'windowEnd', 'targetReadyBy'];
  ids.forEach(id => {
    const el = $(id);
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = String(h).padStart(2, '0') + ':00';
      el.appendChild(opt);
    }
  });
  // set defaults
  $('windowStart').value   = state.settings.windowStart;
  $('windowEnd').value     = state.settings.windowEnd;
  $('targetReadyBy').value = state.settings.targetReadyBy;
}

// ── Data loading ─────────────────────────────────────────
async function loadPrices() {
  try {
    const [r1, r2] = await Promise.all([
      fetch('/api/prices?day=today'),
      fetch('/api/prices?day=tomorrow'),
    ]);
    const d1 = await r1.json();
    const d2 = await r2.json();
    state.prices.today    = d1.prices || [];
    state.prices.tomorrow = d2.prices || [];
  } catch {
    showToast('Could not load prices.', 'error');
  }
}

async function loadSchedule() {
  try {
    const r    = await fetch('/api/schedule');
    const data = await r.json();

    for (const { day, hour } of (data.selectedHours || [])) {
      state.selected[day]?.add(hour);
    }

    const s = data.settings || {};
    if (s.charging_power)  state.settings.chargingPower = parseFloat(s.charging_power);
    if (s.energy_needed)   state.settings.energyNeeded  = parseFloat(s.energy_needed);
    if (s.window_start)    state.settings.windowStart   = parseInt(s.window_start,   10);
    if (s.window_end)      state.settings.windowEnd     = parseInt(s.window_end,     10);
    if (s.target_ready_by) state.settings.targetReadyBy = parseInt(s.target_ready_by,10);

    syncFormToState();
  } catch { /* first run – defaults are fine */ }
}

// ── Rendering ────────────────────────────────────────────
function renderPriceList() {
  const prices = state.prices[state.day];
  const list   = $('priceList');

  if (!prices || prices.length === 0) {
    list.innerHTML = '<p class="empty-msg">No price data available for this day yet.</p>';
    return;
  }

  const maxP = Math.max(...prices.map(p => p.price));
  const sortedByPrice = [...prices].sort((a, b) => a.price - b.price);
  const p33  = sortedByPrice[Math.floor(sortedByPrice.length * 0.33)]?.price ?? 0;
  const p67  = sortedByPrice[Math.floor(sortedByPrice.length * 0.67)]?.price ?? 0;

  const nowHour = new Date().getHours();

  list.innerHTML = prices.map(({ hour, price }) => {
    const selected  = state.selected[state.day].has(hour);
    const isCurrent = state.day === 'today' && hour === nowHour;
    const inWindow  = isHourInWindow(hour, state.settings.windowStart, state.settings.windowEnd);
    const barWidth  = maxP > 0 ? Math.max(3, (price / maxP) * 100) : 3;
    const color     = priceColor(price, p33, p67);
    const label     = String(hour).padStart(2, '0') + ':00';

    return `
      <div class="hour-row${selected ? ' selected' : ''}${isCurrent ? ' current' : ''}${inWindow ? ' in-window' : ''}"
           data-hour="${hour}" role="listitem button" tabindex="0"
           aria-pressed="${selected}" aria-label="${label} – ${price.toFixed(2)} snt/kWh${selected ? ', selected' : ''}">
        <div class="hour-label">
          ${label}
          ${isCurrent ? '<span class="now-badge">NOW</span>' : ''}
        </div>
        <div class="price-bar-track">
          <div class="price-bar" style="width:${barWidth.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="price-value" style="color:${color}">
          ${price.toFixed(2)}<span class="unit"> snt/kWh</span>
        </div>
        <div class="check-icon${selected ? ' visible' : ''}">✓</div>
      </div>`;
  }).join('');

  // Click / keyboard toggling
  list.querySelectorAll('.hour-row').forEach(row => {
    row.addEventListener('click', () => toggleHour(parseInt(row.dataset.hour, 10)));
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleHour(parseInt(row.dataset.hour, 10));
      }
    });
  });
}

function priceColor(price, p33, p67) {
  if (price <= p33) return 'var(--green)';
  if (price <= p67) return 'var(--amber)';
  return 'var(--red)';
}

function isHourInWindow(hour, start, end) {
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;   // midnight-crossing
}

// ── Selection ─────────────────────────────────────────────
function toggleHour(hour) {
  const sel = state.selected[state.day];
  sel.has(hour) ? sel.delete(hour) : sel.add(hour);
  renderPriceList();
  updateSummary();
}

// ── Summary ───────────────────────────────────────────────
function updateSummary() {
  const prices  = state.prices[state.day];
  const sel     = state.selected[state.day];
  const hours   = sel.size;
  const power   = state.settings.chargingPower;

  let totalCost = 0, totalPrice = 0;
  for (const h of sel) {
    const p = prices.find(x => x.hour === h);
    if (p) { totalPrice += p.price; totalCost += p.price * power / 100; }
  }
  const avg = hours > 0 ? totalPrice / hours : null;

  $('totalHours').textContent  = hours;
  $('totalEnergy').textContent = (hours * power).toFixed(1) + ' kWh';
  $('totalCost').textContent   = '€' + totalCost.toFixed(2);
  $('avgPrice').textContent    = avg !== null ? avg.toFixed(2) + ' snt/kWh' : '—';
}

function updateHoursHint() {
  const h = Math.ceil(state.settings.energyNeeded / state.settings.chargingPower);
  $('hoursHint').textContent = `→ ${h} h at ${state.settings.chargingPower} kW`;
}

// ── Auto-pick ──────────────────────────────────────────────
async function autoPick() {
  const { chargingPower, energyNeeded, windowStart, windowEnd, targetReadyBy } = state.settings;
  try {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: state.day, energyNeeded, chargingPower, windowStart, windowEnd, targetReadyBy }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.selected[state.day] = new Set(data.selectedHours);
    renderPriceList();
    updateSummary();
    showToast(`✓ ${data.selectedHours.length} cheapest hours selected (est. €${data.totalCostEur})`, 'success');
  } catch (err) {
    showToast('⚠ ' + err.message, 'error');
  }
}

// ── Save / clear ──────────────────────────────────────────
async function saveSchedule() {
  const selectedHours = [];
  for (const [day, hours] of Object.entries(state.selected)) {
    for (const hour of hours) selectedHours.push({ day, hour });
  }
  const settings = {
    charging_power: String(state.settings.chargingPower),
    energy_needed:  String(state.settings.energyNeeded),
    window_start:   String(state.settings.windowStart),
    window_end:     String(state.settings.windowEnd),
    target_ready_by:String(state.settings.targetReadyBy),
  };
  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedHours, settings }),
    });
    if (!res.ok) throw new Error('Save failed');
    showToast('💾 Schedule saved!', 'success');
  } catch (err) {
    showToast('⚠ ' + err.message, 'error');
  }
}

function clearSelection() {
  state.selected[state.day].clear();
  renderPriceList();
  updateSummary();
  showToast('Selection cleared.', 'info');
}

// ── Form sync ─────────────────────────────────────────────
function syncFormToState() {
  $('chargingPower').value = state.settings.chargingPower;
  $('energyNeeded').value  = state.settings.energyNeeded;
  $('windowStart').value   = state.settings.windowStart;
  $('windowEnd').value     = state.settings.windowEnd;
  $('targetReadyBy').value = state.settings.targetReadyBy;
  updateHoursHint();
}

function readForm() {
  state.settings.chargingPower = Math.max(0.1, parseFloat($('chargingPower').value) || 11);
  state.settings.energyNeeded  = Math.max(0.1, parseFloat($('energyNeeded').value)  || 22);
  state.settings.windowStart   = parseInt($('windowStart').value,   10);
  state.settings.windowEnd     = parseInt($('windowEnd').value,     10);
  state.settings.targetReadyBy = parseInt($('targetReadyBy').value, 10);
  updateHoursHint();
  renderPriceList();
  updateSummary();
}

// ── Event wiring ──────────────────────────────────────────
function wireEvents() {
  // Day tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.day = tab.dataset.day;
      renderPriceList();
      updateSummary();
    });
  });

  // Mode buttons
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.inputMode = btn.dataset.mode;
    });
  });

  // Settings inputs
  ['chargingPower', 'energyNeeded', 'windowStart', 'windowEnd', 'targetReadyBy'].forEach(id => {
    $(id).addEventListener('change', readForm);
  });

  // Action buttons
  $('autoPickBtn').addEventListener('click', autoPick);
  $('clearBtn').addEventListener('click',    clearSelection);
  $('saveBtn').addEventListener('click',     saveSchedule);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const t = $('toast');
  t.textContent = message;
  t.className   = `toast toast-${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
