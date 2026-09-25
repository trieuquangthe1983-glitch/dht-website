'use strict';
/* =====================================================================
   DHT Smart Farm — ứng dụng quản lý trang trại công nghệ cao khép kín
   Chuỗi: Quy trình chuẩn → Lứa/vụ → Lịch việc → Môi trường & IoT →
          Nhật ký đầu vào → Thu hoạch → Kho bảo quản → Bán → Truy xuất
   Dữ liệu lưu cục bộ (localStorage), chạy offline (service worker).
   ===================================================================== */

const KEY = 'dht_smart_farm_v1';
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const iso = d => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const today = () => iso(Date.now());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY);
const fd = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—';
const fds = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '—';
const fdt = ts => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const nf = (n, d = 0) => (isFinite(n) ? Number(n) : 0).toLocaleString('vi-VN', { maximumFractionDigits: d });
const money = n => nf(Math.round(n)) + ' ₫';
const short = n => Math.abs(n) >= 1e9 ? nf(n / 1e9, 1) + ' tỷ' : Math.abs(n) >= 1e6 ? nf(n / 1e6, 1) + ' tr' : Math.abs(n) >= 1e3 ? nf(n / 1e3, 0) + 'k' : nf(n);
const pct = (v, d = 1) => isFinite(v) ? nf(v * 100, d) + '%' : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TYPE_CODE = { poultry: 'GC', mushroom: 'NM', veg: 'RS', herb: 'DL' };
const INV_CATS = ['Con giống / hạt giống / phôi', 'Thức ăn chăn nuôi', 'Thuốc thú y – vaccine', 'Phân bón – dinh dưỡng', 'Thuốc BVTV – chế phẩm sinh học', 'Giá thể – vật tư nấm', 'Bao bì – đóng gói', 'Nhiên liệu – vật tư khác'];
const FIN_OUT = ['Con giống / hạt giống / phôi', 'Thức ăn chăn nuôi', 'Thuốc thú y – vaccine', 'Phân bón – vật tư', 'Điện – nước – nhiên liệu', 'Nhân công', 'Sửa chữa – bảo dưỡng máy', 'Vận chuyển – bao bì', 'Khác'];
const FIN_IN = ['Bán sản phẩm', 'Bán phụ phẩm (phân, phôi nấm…)', 'Hỗ trợ – khác'];
const GRADES = ['Loại 1', 'Loại 2', 'Loại 3'];
const DENSITY = {
  broiler: [8, 10, 'con/m² nền'], layer: [5, 6, 'con/m² nền (lồng: 3–4 con/ô)'], oyster: [50, 70, 'bịch/m² sàn (giàn treo)'],
  lingzhi: [40, 50, 'bịch/m² sàn'], leafy: [1, 1, 'm² luống'], hydro: [20, 25, 'hốc/m²'], tomato: [2.5, 3, 'cây/m²'],
  cagaileo: [6, 6.5, 'cây/m² (40×40 cm)'], turmeric: [10, 11, 'củ/m² (30×30 cm)']
};
const LOG_TYPES = {
  feed:   { n: 'Cho ăn (thức ăn)',            for: ['poultry'], item: true, qtyL: 'Lượng thức ăn (kg)' },
  med:    { n: 'Thuốc thú y / vaccine',       for: ['poultry'], item: true, qtyL: 'Số lượng dùng', phi: true, phiL: 'Thời gian ngừng thuốc (ngày)' },
  death:  { n: 'Chết / loại thải',            for: ['poultry'], qtyL: 'Số con' },
  weigh:  { n: 'Cân mẫu',                     for: ['poultry'], valL: 'Khối lượng bình quân (kg/con)' },
  contam: { n: 'Bịch nhiễm / loại bỏ',        for: ['mushroom'], qtyL: 'Số bịch' },
  fert:   { n: 'Bón phân / dinh dưỡng',       for: ['veg', 'herb', 'mushroom'], item: true, qtyL: 'Số lượng dùng' },
  spray:  { n: 'Phun thuốc BVTV / chế phẩm',  for: ['veg', 'herb', 'mushroom'], item: true, qtyL: 'Số lượng dùng', phi: true, phiL: 'Thời gian cách ly PHI (ngày)' },
  water:  { n: 'Tưới nước',                   for: ['veg', 'herb', 'mushroom'], valL: 'Lượng nước (m³)' },
  note:   { n: 'Ghi chú / quan sát',          for: ['poultry', 'mushroom', 'veg', 'herb'] }
};

/* ============================ LƯU TRỮ ============================ */
let S;
const EMPTY = () => ({
  v: 1, farm: { name: 'Trang trại của tôi', owner: '', address: '', phone: '', code: 'DHT' },
  units: [], batches: [], tasks: [], routine: {}, logs: [], readings: [], devices: [], rules: [], iotLog: [],
  inventory: [], invTx: [], storages: [], lots: [], fin: [], staff: [], equip: [],
  /* Cho thuê – Chợ – Thông tin chung – Hợp tác (rent.js) */
  plots: [], customers: [], contracts: [], invoices: [], requests: [], listings: [], orders: [],
  events: [], news: [], partners: [], bookings: [], pools: [], posts: [], info: {}
});
function load() { try { const r = localStorage.getItem(KEY); return r ? Object.assign(EMPTY(), JSON.parse(r)) : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* bộ nhớ bị chặn/đầy: vẫn chạy trong phiên */ } }
const get = (coll, id) => S[coll].find(x => x.id === id);

/* ======================= TRA CỨU NGHIỆP VỤ ======================= */
const sopOf = b => SOPS.find(s => s.id === (b && b.sopId));
const bDay = b => diffDays(b.start, b.status === 'done' && b.end ? b.end : today());
function stageOf(sop, day) {
  const st = sop.stages.find(s => day >= s.f && day <= s.t);
  if (st) return st;
  return day < sop.stages[0].f ? sop.stages[0] : sop.stages[sop.stages.length - 1];
}
const activeBatches = () => S.batches.filter(b => b.status === 'active');
const unitBatch = id => S.batches.filter(b => b.unitId === id && b.status === 'active').sort((a, b) => b.start.localeCompare(a.start))[0];
const inRange = (v, r) => v >= r[0] && v <= r[1];
function latest(tid) { for (let i = S.readings.length - 1; i >= 0; i--) if (S.readings[i].tid === tid) return S.readings[i]; return null; }
function targetOf(tid) {
  const st = get('storages', tid);
  if (st) { const p = STORAGE_PROFILES[st.profile]; return { kind: 'storage', name: st.name, env: p ? p.env : {}, sub: p ? p.n : '' }; }
  const u = get('units', tid);
  if (!u) return null;
  const b = unitBatch(tid);
  if (!b) return { kind: 'unit', name: u.name, env: {}, unit: u, sub: 'Chưa có lứa/vụ đang chạy' };
  const st2 = stageOf(sopOf(b), bDay(b));
  return { kind: 'unit', name: u.name, env: st2.env, unit: u, batch: b, stage: st2, sub: st2.n };
}
const allTargets = () => [...S.units.map(u => ({ id: u.id, label: FARM_TYPES[u.type].icon + ' ' + u.name })), ...S.storages.map(s => ({ id: s.id, label: '❄️ ' + s.name }))];
function rangeTxt(p, r) { const P = PARAMS[p]; return (r[0] === 0 && p !== 'temp' ? '≤ ' + nf(r[1], P.d) : nf(r[0], P.d) + '–' + nf(r[1], P.d)) + (P.u ? ' ' + P.u : ''); }
const fmtP = (p, v) => nf(v, PARAMS[p].d) + (PARAMS[p].u ? ' ' + PARAMS[p].u : '');
function phiUntil(b) {
  let end = null;
  for (const l of S.logs) if (l.batchId === b.id && l.phi > 0) { const e = addDays(l.date, l.phi); if (!end || e > end) end = e; }
  return end;
}
function interp(pts, x) {
  if (!pts || !pts.length) return null;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, va] = pts[i - 1], [c, vc] = pts[i]; return va + (vc - va) * (x - a) / (c - a); }
  return pts[pts.length - 1][1];
}
const intake = d => Math.min(12 + 1.4 * Math.max(d, 0), 100); /* g/con/ngày – gà lông màu (ước tính) */

function batchStats(b) {
  const sop = sopOf(b), logs = S.logs.filter(l => l.batchId === b.id), lots = S.lots.filter(l => l.batchId === b.id);
  const st = { sop, logs, lots, harvested: sum(lots, l => l.qty), day: bDay(b) };
  st.cost = sum(S.fin.filter(f => f.batchId === b.id && f.type === 'out'), f => f.amount);
  st.rev = sum(S.fin.filter(f => f.batchId === b.id && f.type === 'in'), f => f.amount);
  st.matCost = sum(S.invTx.filter(t => t.batchId === b.id && t.type === 'out'), t => t.qty * ((get('inventory', t.itemId) || {}).price || 0));
  st.profit = st.rev - st.cost - st.matCost;
  if (sop.type === 'poultry') {
    st.dead = sum(logs.filter(l => l.type === 'death'), l => l.qty);
    st.alive = b.qty - st.dead; st.surv = st.alive / b.qty;
    st.feed = sum(logs.filter(l => l.type === 'feed'), l => l.qty);
    const w = logs.filter(l => l.type === 'weigh' && l.value > 0).sort((a, c) => a.date.localeCompare(c.date)).pop();
    if (w) { st.w = w.value; st.wDay = diffDays(b.start, w.date); st.wStd = interp(sop.weights, st.wDay); }
    if (w && sop.id === 'broiler') {
      const feedToW = sum(logs.filter(l => l.type === 'feed' && l.date <= w.date), l => l.qty);
      const aliveW = b.qty - sum(logs.filter(l => l.type === 'death' && l.date <= w.date), l => l.qty);
      const gain = aliveW * st.w - b.qty * .035;
      st.fcr = feedToW && gain > 0 ? feedToW / gain : null;
    }
    if (sop.id === 'layer') {
      const from = addDays(today(), -6);
      st.eggs7 = sum(lots.filter(l => l.date >= from), l => l.qty);
      st.layRate = st.alive ? st.eggs7 / (st.alive * 7) : 0;
    }
  } else if (sop.type === 'mushroom') {
    st.contam = sum(logs.filter(l => l.type === 'contam'), l => l.qty);
    st.contamPct = st.contam / b.qty;
    st.perBag = st.harvested / Math.max(b.qty - st.contam, 1);
    st.be = st.harvested / (b.qty * 0.46); /* phôi 1,2 kg ướt, ẩm ~62% → ~0,46 kg khô */
  } else {
    st.perUnit = st.harvested / b.qty;
  }
  st.phiEnd = phiUntil(b);
  return st;
}

/* Tạo lịch công việc tự động từ quy trình chuẩn */
function genTasks(b, markPast) {
  const sop = sopOf(b), t = today(), unit = get('units', b.unitId);
  for (const [d, title, cat, every, until] of sop.tasks) {
    for (let x = d; x <= (until ?? d); x += (every || Infinity)) {
      const date = addDays(b.start, x);
      S.tasks.push({ id: uid(), batchId: b.id, unitId: b.unitId, title, cat, day: x, date, done: !!(markPast && date < t), auto: true, assignee: defaultAssignee(unit, cat) });
    }
  }
}
function defaultAssignee(unit, cat) {
  if (!S.staff.length) return '';
  const pick = re => (S.staff.find(s => re.test(s.role)) || {}).id;
  if (cat === 'th') return pick(/kho|sơ chế/i) || '';
  if (unit && unit.type === 'poultry') return pick(/chăn nuôi|thú y/i) || '';
  return pick(/trồng|nấm/i) || '';
}

/* ======================= CẢNH BÁO & PHÂN TÍCH ======================= */
function envDev(v, r) { const w = Math.max(r[1] - r[0], Math.abs(r[1]) * 0.1, 1e-6); return v < r[0] ? (r[0] - v) / w : v > r[1] ? (v - r[1]) / w : 0; }
function computeAlerts() {
  const A = [], t = today();
  for (const b of activeBatches()) {
    const sop = sopOf(b), u = get('units', b.unitId) || { name: '?' }, d = bDay(b), stg = stageOf(sop, d), r = latest(b.unitId), s = batchStats(b);
    if (r && Date.now() - r.ts < DAY) for (const [p, rg] of Object.entries(stg.env)) {
      if (r[p] == null) continue;
      const dev = envDev(r[p], rg);
      if (dev > 0) A.push({ lv: dev > .4 ? 'bad' : 'warn', ic: '🌡️', msg: `${u.name}: ${PARAMS[p].n} ${fmtP(p, r[p])} ngoài ngưỡng ${rangeTxt(p, rg)} (${stg.n})`, link: '#/env/' + u.id });
    }
    if (d > sop.duration) A.push({ lv: 'info', ic: '⏱️', msg: `${b.name}: đã qua ${d - sop.duration} ngày so với thời gian quy trình — xem xét kết thúc lứa/vụ`, link: '#/batch/' + b.id });
    if (sop.type === 'poultry' && s.surv < .95) A.push({ lv: s.surv < .9 ? 'bad' : 'warn', ic: '🐔', msg: `${b.name}: tỷ lệ nuôi sống ${pct(s.surv)} (< 95%) — kiểm tra dịch bệnh, môi trường`, link: '#/batch/' + b.id });
    if (s.wStd && s.w < s.wStd * .9) A.push({ lv: 'warn', ic: '⚖️', msg: `${b.name}: khối lượng ${nf(s.w, 2)} kg đạt ${pct(s.w / s.wStd, 0)} chuẩn giống ngày ${s.wDay}`, link: '#/batch/' + b.id });
    if (sop.type === 'mushroom' && s.contamPct > .05) A.push({ lv: 'warn', ic: '🍄', msg: `${b.name}: tỷ lệ bịch nhiễm ${pct(s.contamPct)} (> 5%) — rà soát thanh trùng, vô trùng khu cấy`, link: '#/batch/' + b.id });
    if (s.phiEnd && s.phiEnd >= t) A.push({ lv: 'info', ic: '⛔', msg: `${b.name}: đang trong thời gian cách ly/ngừng thuốc đến ${fd(s.phiEnd)} — KHÔNG thu hoạch/xuất bán`, link: '#/batch/' + b.id });
  }
  const od = S.tasks.filter(x => !x.done && x.date < t);
  if (od.length) A.push({ lv: 'warn', ic: '🗓️', msg: `${od.length} công việc quá hạn chưa hoàn thành`, link: '#/tasks' });
  for (const i of S.inventory) {
    if (i.qty <= i.min) A.push({ lv: i.qty <= 0 ? 'bad' : 'warn', ic: '📉', msg: `Vật tư "${i.name}" còn ${nf(i.qty, 1)} ${i.unit} (mức tối thiểu ${nf(i.min)}) — cần nhập thêm`, link: '#/inventory' });
    if (i.expiry && i.qty > 0) { const dl = diffDays(t, i.expiry); if (dl < 0) A.push({ lv: 'bad', ic: '⚠️', msg: `"${i.name}" đã hết hạn sử dụng (${fd(i.expiry)})`, link: '#/inventory' }); else if (dl <= 30) A.push({ lv: 'warn', ic: '⏳', msg: `"${i.name}" hết hạn sau ${dl} ngày (${fd(i.expiry)})`, link: '#/inventory' }); }
  }
  for (const l of S.lots) if (l.remain > 0) {
    const dl = diffDays(t, l.expiry);
    if (dl < 0) A.push({ lv: 'bad', ic: '📦', msg: `Lô ${l.code} (${l.product}) quá hạn bảo quản — còn ${nf(l.remain, 1)} ${l.unit}, cần xử lý`, link: '#/harvest' });
    else if (dl <= 2) A.push({ lv: 'warn', ic: '📦', msg: `Lô ${l.code} (${l.product}) còn ${dl} ngày bảo quản — ưu tiên xuất bán`, link: '#/harvest' });
  }
  for (const st of S.storages) {
    const r = latest(st.id), p = STORAGE_PROFILES[st.profile];
    if (r && p) for (const [k, rg] of Object.entries(p.env)) if (r[k] != null && !inRange(r[k], rg)) A.push({ lv: 'bad', ic: '❄️', msg: `${st.name}: ${PARAMS[k].n} ${fmtP(k, r[k])} ngoài ngưỡng bảo quản ${rangeTxt(k, rg)}`, link: '#/env/' + st.id });
  }
  for (const e of S.equip) {
    if (e.status === 'Hỏng') A.push({ lv: 'bad', ic: '🚜', msg: `${e.name} đang hỏng — cần sửa chữa`, link: '#/equip' });
    else if (e.interval && e.lastService && addDays(e.lastService, e.interval) <= t) A.push({ lv: 'warn', ic: '🔧', msg: `${e.name} đến hạn bảo dưỡng (${fd(addDays(e.lastService, e.interval))})`, link: '#/equip' });
  }
  const o = { bad: 0, warn: 1, info: 2 };
  return A.sort((a, b) => o[a.lv] - o[b.lv]);
}

function compliance(tid, hours = 24) {
  const tg = targetOf(tid); if (!tg || !Object.keys(tg.env).length) return null;
  const from = Date.now() - hours * 36e5;
  const rs = S.readings.filter(r => r.tid === tid && r.ts >= from);
  if (!rs.length) return null;
  let ok = 0, n = 0;
  for (const r of rs) for (const [p, rg] of Object.entries(tg.env)) if (r[p] != null) { n++; if (inRange(r[p], rg)) ok++; }
  return n ? ok / n : null;
}

function insights() {
  const I = [], t = today();
  for (const b of activeBatches()) {
    const s = batchStats(b), sop = s.sop, d = s.day, stg = stageOf(sop, d);
    const soon = S.tasks.filter(x => x.batchId === b.id && !x.done && x.date >= t && x.date <= addDays(t, 3) && (x.cat === 'tv' || x.cat === 'th'));
    for (const x of soon) I.push({ lv: 'info', msg: `<b>${esc(b.name)}</b> — ${x.date === t ? 'HÔM NAY' : 'ngày ' + fds(x.date)}: ${esc(x.title)}` });
    if (sop.type === 'poultry') {
      if (s.wStd) {
        const r = s.w / s.wStd;
        I.push({ lv: r >= .95 ? 'ok' : r >= .9 ? 'warn' : 'bad', msg: `<b>${esc(b.name)}</b>: khối lượng cân gần nhất ${nf(s.w, 2)} kg/con = ${pct(r, 0)} chuẩn giống (${nf(s.wStd, 2)} kg @ ngày ${s.wDay}). ${r < .95 ? 'Kiểm tra chất lượng thức ăn, mật độ, nước uống và bệnh tiềm ẩn.' : 'Tăng trọng đạt chuẩn.'}` });
        if (d - s.wDay > 7) I.push({ lv: 'warn', msg: `<b>${esc(b.name)}</b>: đã ${d - s.wDay} ngày chưa cân mẫu — nên cân 5% đàn mỗi tuần.` });
      }
      if (s.fcr) I.push({ lv: s.fcr <= 2.2 ? 'ok' : 'warn', msg: `<b>${esc(b.name)}</b>: FCR tính đến lần cân ngày ${s.wDay} là ${nf(s.fcr, 2)}. Giai đoạn này nên ≤ 2,2.` });
      if (sop.id === 'broiler') {
        const need = s.alive * intake(d) / 1000;
        const stock = sum(S.inventory.filter(i => i.cat === 'Thức ăn chăn nuôi' && /thịt/i.test(i.name)), i => i.qty);
        const days = need ? stock / need : Infinity;
        I.push({ lv: days < 7 ? 'warn' : 'ok', msg: `<b>${esc(b.name)}</b>: nhu cầu ước tính ${nf(need)} kg thức ăn/ngày (${nf(intake(d))} g/con). Tồn kho thức ăn gà thịt đủ ~${nf(days, 1)} ngày${days < 7 ? ' — đặt hàng ngay' : ''}.` });
      }
      if (sop.id === 'layer' && s.layRate != null) I.push({ lv: s.layRate >= .8 ? 'ok' : 'warn', msg: `<b>${esc(b.name)}</b>: tỷ lệ đẻ 7 ngày ${pct(s.layRate)} (${nf(s.eggs7)} trứng). ${s.layRate < .8 ? 'Kiểm tra ánh sáng 16h, nhiệt độ, khẩu phần Ca.' : 'Đạt mức tốt.'}` });
    }
    if (sop.type === 'mushroom') {
      I.push({ lv: s.contamPct <= .05 ? 'ok' : 'warn', msg: `<b>${esc(b.name)}</b>: tỷ lệ nhiễm ${pct(s.contamPct)}; đã thu ${nf(s.harvested)} kg = ${nf(s.perBag, 2)} kg/bịch, BE ≈ ${pct(s.be, 0)} (mục tiêu cả lứa 60–80%).` });
    }
    if (sop.type === 'veg' || sop.type === 'herb') {
      const left = sop.harvest.from - d;
      if (left > 0 && left <= 14) I.push({ lv: 'info', msg: `<b>${esc(b.name)}</b>: còn ~${left} ngày tới thời điểm thu hoạch. Chuẩn bị nhân lực, bao bì, kho ${esc(STORAGE_PROFILES[sop.harvest.storage].n)}.` });
      if (s.phiEnd && s.phiEnd >= t) I.push({ lv: 'warn', msg: `<b>${esc(b.name)}</b>: thời gian cách ly thuốc đến ${fd(s.phiEnd)} — mọi thao tác thu hoạch trước ngày này sẽ bị chặn.` });
    }
    const c = compliance(b.unitId);
    if (c != null) I.push({ lv: c >= .9 ? 'ok' : c >= .7 ? 'warn' : 'bad', msg: `<b>${esc(b.name)}</b> (${esc(stg.n)}): ${pct(c, 0)} số đo 24h qua nằm trong ngưỡng tối ưu.${c < .9 ? ' Rà soát quy tắc tự động và thiết bị.' : ''}` });
  }
  const m = t.slice(0, 7), fm = S.fin.filter(f => f.date.startsWith(m));
  const inc = sum(fm.filter(f => f.type === 'in'), f => f.amount), exp = sum(fm.filter(f => f.type === 'out'), f => f.amount);
  if (inc || exp) I.push({ lv: inc >= exp ? 'ok' : 'warn', msg: `Tài chính tháng ${m.slice(5)}: thu ${money(inc)}, chi ${money(exp)}, ${inc >= exp ? 'lãi' : 'lỗ'} ${money(Math.abs(inc - exp))}.` });
  return I;
}

/* ======================= IoT: QUY TẮC & MÔ PHỎNG ======================= */
function logIot(msg) { S.iotLog.push({ ts: Date.now(), msg }); if (S.iotLog.length > 150) S.iotLog.splice(0, S.iotLog.length - 150); }
function addReading(tid, vals, src) {
  const prev = latest(tid);
  let r;
  if (src !== 'manual' && prev && prev.src === 'sensor' && Date.now() - prev.ts < 6e5) r = Object.assign(prev, vals);
  else { r = { id: uid(), tid, ts: Date.now(), src: src || 'sensor', ...vals }; S.readings.push(r); }
  if (S.readings.length > 20000) { const cut = Date.now() - 45 * DAY; S.readings = S.readings.filter(x => x.ts >= cut); if (S.readings.length > 20000) S.readings.splice(0, 4000); }
  applyRules(tid, r);
  return r;
}
function applyRules(tid, r) {
  const tg = targetOf(tid);
  for (const ru of S.rules) {
    if (ru.tid !== tid || !ru.en || r[ru.p] == null) continue;
    const hit = ru.op === '>' ? r[ru.p] > ru.v : r[ru.p] < ru.v;
    const dev = get('devices', ru.dev);
    if (!hit || !dev || !dev.auto) continue;
    const want = ru.act === 'on';
    if (dev.on !== want) { dev.on = want; logIot(`⚙️ ${tg ? tg.name : ''}: ${PARAMS[ru.p].n} ${fmtP(ru.p, r[ru.p])} ${ru.op} ${nf(ru.v, 2)} → ${want ? 'BẬT' : 'TẮT'} ${dev.name}`); }
  }
}
function simStep(tid) {
  const tg = targetOf(tid);
  if (!tg || !Object.keys(tg.env).length) return;
  const prev = latest(tid) || {}, devs = S.devices.filter(d => d.tid === tid), vals = {};
  const now = new Date(), hr = now.getHours() + now.getMinutes() / 60;
  for (const [p, rg] of Object.entries(tg.env)) {
    const c = (rg[0] + rg[1]) / 2, w = Math.max(rg[1] - rg[0], 0.1), noise = Math.random() - .5;
    let v = prev[p] != null ? prev[p] : c + noise * w * .4;
    const relevant = devs.filter(d => DEVICE_KINDS[d.kind] && DEVICE_KINDS[d.kind].eff[p] != null);
    const effOn = sum(relevant.filter(d => d.on), d => DEVICE_KINDS[d.kind].eff[p]);
    if (p === 'lux') {
      const tgt = relevant.length ? (relevant.some(d => d.on) ? c : rg[0] * .3) : c;
      v += (tgt - v) * .6 + noise * w * .1;
    } else if (p === 'temp' && relevant.length) {
      if (tg.kind === 'storage') v += .35 + noise * .3 + effOn;
      else { const amb = (tg.unit.type === 'mushroom' ? 27 : 28) + 4 * Math.sin((hr - 9) / 24 * 2 * Math.PI); v += (amb - v) * .15 + noise * .6 + effOn; }
    } else if (relevant.length) {
      const dir = Math.sign(sum(relevant, d => DEVICE_KINDS[d.kind].eff[p]));
      const drift = { rh: 2.2, co2: 160, nh3: .9, soil: 2.2, ec: .04, ph: .02 }[p] || 0;
      v += -dir * drift + noise * w * .08 + effOn + (c - v) * .12;
    } else {
      v += (c - v) * .25 + noise * w * .3;
    }
    const lim = { rh: [15, 100], co2: [350, 10000], nh3: [0, 100], soil: [0, 100], ec: [0, 10], ph: [3, 9], lux: [0, 100000], temp: [-10, 50] }[p];
    vals[p] = +clamp(v, lim[0], lim[1]).toFixed(PARAMS[p].d);
  }
  addReading(tid, vals, 'sensor');
}
function simulateAll() { for (const t of allTargets()) simStep(t.id); save(); }

/* ============================ BIỂU ĐỒ ============================ */
function lineChart(series, o = {}) {
  const W = 640, H = o.h || 200, L = 46, R = 12, T = 10, B = 24;
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '<div class="empty">Chưa có dữ liệu</div>';
  let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0]));
  let y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  if (o.band) { y0 = Math.min(y0, o.band[0]); y1 = Math.max(y1, o.band[1]); }
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const nonNeg = y0 >= 0, py = (y1 - y0) * .08; y0 -= py; y1 += py; if (nonNeg && y0 < 0) y0 = 0; if (x0 === x1) x1 = x0 + 1;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const dg = o.yd != null ? o.yd : (y1 - y0 < 5 ? 2 : y1 - y0 < 30 ? 1 : 0);
  let g = o.band ? `<rect x="${L}" width="${W - L - R}" y="${Y(o.band[1]).toFixed(1)}" height="${Math.max(0, Y(o.band[0]) - Y(o.band[1])).toFixed(1)}" fill="var(--chart-band)"/>` : '';
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4, y = Y(v).toFixed(1); g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${+y + 4}" text-anchor="end">${o.yfmt ? o.yfmt(v) : nf(v, dg)}</text>`; }
  for (let i = 0; i <= 4; i++) { const v = x0 + (x1 - x0) * i / 4; g += `<text x="${X(v).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${(o.xfmt || fdt)(v)}</text>`; }
  const paths = series.map(s => `<path d="${s.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const last = series.length === 1 && series[0].pts.length ? series[0].pts[series[0].pts.length - 1] : null;
  const dot = last ? `<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4" fill="${series[0].color}"/>` : '';
  const leg = (series.length > 1 || o.band) ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${o.band ? '<span><i style="background:var(--chart-band)"></i>Ngưỡng tối ưu</span>' : ''}</div>` : '';
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Biểu đồ')}">${g}${paths}${dot}</svg>${leg}</div>`;
}
function barChart(labels, series, o = {}) {
  const W = 640, H = o.h || 200, L = 52, R = 10, T = 10, B = 24;
  const max = Math.max(1, ...series.flatMap(s => s.vals)) * 1.08;
  const Y = v => T + (1 - v / max) * (H - T - B), gw = (W - L - R) / labels.length, bw = Math.min(26, (gw - 10) / series.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, y = Y(v).toFixed(1); g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${+y + 4}" text-anchor="end">${short(v)}</text>`; }
  labels.forEach((lb, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2;
    series.forEach((s, j) => { const v = s.vals[i] || 0; g += `<rect x="${(x0 + j * bw + 1).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(0, H - B - Y(v)).toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(s.name)} ${esc(lb)}: ${money(v)}</title></rect>`; });
    g += `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Biểu đồ cột')}">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div></div>`;
}

/* ============================ UI CHUNG ============================ */
const UI = { btab: 'overview', envP: null, htab: 'lots', itab: 'stock', inCat: '', inQ: '', taskUnit: '', advType: 'poultry', symp: new Set(), sop: null, trace: '', finM: '', lotAll: false, batchF: 'active' };
const badge = (txt, cls = '') => `<span class="badge ${cls}">${esc(txt)}</span>`;
const typeTag = t => `<span class="tag"><i style="background:${FARM_TYPES[t].color}"></i>${FARM_TYPES[t].icon} ${FARM_TYPES[t].n}</span>`;
const catTag = c => TASK_CATS[c] ? `<span class="tag"><i style="background:${TASK_CATS[c].c}"></i>${TASK_CATS[c].n}</span>` : '';
const staffName = id => (get('staff', id) || {}).name || '';
const empty = (msg, btn = '') => `<div class="empty">${esc(msg)}${btn ? '<div style="margin-top:10px">' + btn + '</div>' : ''}</div>`;
function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3200); }
function alertHtml(a) { return `<div class="alert ${a.lv}"><span class="ic">${a.ic || ({ bad: '⛔', warn: '⚠️', info: 'ℹ️', ok: '✅' }[a.lv])}</span><div class="grow">${a.html || esc(a.msg)}</div>${a.link ? `<a class="btn sm" href="${a.link}">Xem</a>` : ''}</div>`; }
function envChips(tid, env) {
  const r = latest(tid), ks = Object.keys(env || {});
  if (!ks.length) return '<span class="muted" style="font-size:13px">Giai đoạn chuẩn bị — chưa theo dõi môi trường</span>';
  if (!r) return '<span class="muted" style="font-size:13px">Chưa có số đo</span>';
  return `<div class="envchips">${ks.filter(p => r[p] != null).map(p => `<span class="chip ${inRange(r[p], env[p]) ? 'ok' : 'bad'}" title="Ngưỡng ${esc(rangeTxt(p, env[p]))}">${PARAMS[p].n} ${fmtP(p, r[p])}</span>`).join('')}</div>`;
}
function taskRow(x, showDate) {
  const b = get('batches', x.batchId), u = get('units', x.unitId), late = !x.done && x.date < today();
  return `<div class="task ${x.done ? 'done' : ''}"><input type="checkbox" data-chg="task" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Hoàn thành">
  <div class="grow"><div class="tt">${esc(x.title)}</div><div class="meta">${showDate || late ? `<span class="${late ? 't-bad' : ''}">${late ? 'Quá hạn · ' : ''}${fd(x.date)}</span>` : ''}${b ? `<a href="#/batch/${b.id}">${esc(b.name)}</a>` : u ? esc(u.name) : ''}${catTag(x.cat)}${x.assignee ? `<span>👤 ${esc(staffName(x.assignee))}</span>` : ''}</div></div>
  <button class="btn sm" data-act="editTask" data-id="${x.id}" aria-label="Sửa">✎</button></div>`;
}
function routineHtml(b) {
  const sop = sopOf(b), key = b.id + '|' + today(), done = S.routine[key] || [];
  return sop.daily.map((t, i) => `<label class="task ${done.includes(i) ? 'done' : ''}" style="cursor:pointer"><input type="checkbox" data-chg="routine" data-key="${key}" data-i="${i}" ${done.includes(i) ? 'checked' : ''}><div class="grow tt">${esc(t)}</div></label>`).join('');
}
function tbl(head, rows, emptyMsg) {
  if (!rows.length) return empty(emptyMsg || 'Chưa có dữ liệu');
  return `<div class="tbl-wrap"><table><thead><tr>${head.map(h => { const [t, c] = Array.isArray(h) ? h : [h, '']; return `<th class="${c}">${t}</th>`; }).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
const acts = (...b) => `<div class="acts">${b.join('')}</div>`;
const delBtn = (coll, id) => `<button class="btn sm danger" data-act="del" data-coll="${coll}" data-id="${id}" aria-label="Xóa">🗑</button>`;
const editBtn = (act, id) => `<button class="btn sm" data-act="${act}" data-id="${id}" aria-label="Sửa">✎</button>`;
const opts = (arr, lbl) => arr.map(x => [x.id, lbl ? lbl(x) : x.name]);

/* ============================ BIỂU MẪU ============================ */
let FORM = null;
function openForm(cfg) { FORM = { ...cfg, data: { ...(cfg.data || {}) } }; drawForm(); $('#modal').hidden = false; setTimeout(() => { const f = $('#modalBody input:not([type=checkbox]), #modalBody select'); f && f.focus(); }, 30); }
function closeModal() { $('#modal').hidden = true; FORM = null; }
const fieldsOf = () => (typeof FORM.fields === 'function' ? FORM.fields(FORM.data) : FORM.fields).filter(Boolean);
function drawForm() {
  $('#modalTitle').textContent = FORM.title;
  const intro = typeof FORM.intro === 'function' ? FORM.intro(FORM.data) : (FORM.intro || '');
  $('#modalBody').innerHTML = `<form id="theForm" novalidate>${intro}<div class="form-grid">${fieldsOf().map(fieldHtml).join('')}</div><div id="formMsg"></div><div class="form-actions"><button type="button" class="btn" data-act="closeModal">Hủy</button><button class="btn pri" type="submit">${esc(FORM.ok || 'Lưu')}</button></div></form>`;
}
function fieldHtml(f) {
  if (f.type === 'html') return `<div class="full">${f.html}</div>`;
  const v = FORM.data[f.k] ?? f.def ?? '';
  const common = `name="${f.k}" ${f.re ? 'data-re="1"' : ''}`;
  let inp;
  if (f.type === 'select') inp = `<select ${common}>${(f.opts || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') inp = `<textarea ${common}>${esc(v)}</textarea>`;
  else if (f.type === 'checkbox') return `<label class="f full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${common} ${v ? 'checked' : ''}><span style="margin:0;color:var(--text)">${esc(f.l)}</span></label>`;
  else inp = `<input type="${f.type || 'text'}" ${common} value="${esc(v)}" ${f.type === 'number' ? `step="${f.step || 'any'}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`;
  return `<label class="f ${f.full || f.type === 'textarea' ? 'full' : ''}"><span>${esc(f.l)}${f.req ? ' *' : ''}</span>${inp}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</label>`;
}
function readForm() {
  const form = $('#theForm'), d = { ...FORM.data };
  for (const f of fieldsOf()) {
    if (!f.k || !form.elements[f.k]) continue;
    const el = form.elements[f.k];
    d[f.k] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value.trim();
  }
  return d;
}
function submitForm() {
  const d = readForm();
  for (const f of fieldsOf()) if (f.req && (d[f.k] === '' || d[f.k] == null)) { $('#formMsg').innerHTML = alertHtml({ lv: 'bad', msg: `Vui lòng nhập "${f.l}"` }); return; }
  const res = FORM.submit(d);
  if (typeof res === 'string') { $('#formMsg').innerHTML = alertHtml({ lv: 'bad', msg: res }); return; }
  const done = FORM.done;
  closeModal(); save(); render(); toast(done || 'Đã lưu');
}

/* ---------- Biểu mẫu nghiệp vụ ---------- */
function unitForm(id) {
  const u = id ? get('units', id) : null;
  openForm({
    title: u ? 'Sửa khu sản xuất' : 'Thêm khu sản xuất', data: u || { type: 'poultry' },
    fields: [
      { k: 'name', l: 'Tên khu (chuồng/nhà nấm/nhà màng/vườn)', req: true, full: true },
      { k: 'type', l: 'Loại hình', type: 'select', opts: Object.entries(FARM_TYPES).map(([k, v]) => [k, v.icon + ' ' + v.n]) },
      { k: 'location', l: 'Vị trí / phân khu' },
      { k: 'area', l: 'Diện tích (m²)', type: 'number', min: 0 },
      { k: 'capacity', l: 'Sức chứa thiết kế (con/bịch/cây…)', type: 'number', min: 0 },
      { k: 'note', l: 'Mô tả hạ tầng, thiết bị', type: 'textarea' }
    ],
    submit: d => { if (u) Object.assign(u, d); else S.units.push({ id: uid(), ...d }); }
  });
}
function batchForm(preset = {}) {
  const firstUnit = S.units[0];
  if (!firstUnit) { toast('Hãy tạo khu sản xuất trước'); location.hash = '#/units'; return; }
  const presetSop = SOPS.find(s => s.id === preset.sopId);
  const unit0 = presetSop ? (S.units.find(u => u.type === presetSop.type) || firstUnit) : firstUnit;
  openForm({
    title: 'Tạo lứa nuôi / vụ trồng mới', ok: 'Tạo & lập lịch tự động',
    data: { unitId: unit0.id, sopId: presetSop && presetSop.type === unit0.type ? presetSop.id : (SOPS.find(s => s.type === unit0.type) || {}).id, start: today(), markPast: true },
    intro: d => { const s = SOPS.find(x => x.id === d.sopId); return s ? `<div class="alert info"><span class="ic">📋</span><div class="grow"><b>${esc(s.name)}</b> · ${esc(s.std)}<br><small>${esc(s.desc)} Hệ thống sẽ tự tạo ${sum(s.tasks, t => t[3] ? Math.floor(((t[4] ?? t[0]) - t[0]) / t[3]) + 1 : 1)} công việc theo mốc ngày, ngưỡng môi trường từng giai đoạn và checklist hằng ngày.</small></div></div>` : ''; },
    fields: d => {
      const u = get('units', d.unitId) || firstUnit, sops = SOPS.filter(s => s.type === u.type);
      if (!sops.find(s => s.id === d.sopId)) d.sopId = sops[0] && sops[0].id;
      const s = SOPS.find(x => x.id === d.sopId), dens = s && DENSITY[s.id];
      return [
        { k: 'unitId', l: 'Khu sản xuất', type: 'select', re: true, opts: opts(S.units, x => FARM_TYPES[x.type].icon + ' ' + x.name) },
        { k: 'sopId', l: 'Quy trình chuẩn áp dụng', type: 'select', re: true, opts: sops.map(x => [x.id, x.name]) },
        { k: 'name', l: 'Tên lứa/vụ (mã lô sản xuất)', req: true, ph: 'VD: Gà L06-2026' },
        { k: 'start', l: s && s.type === 'poultry' ? 'Ngày nhập con giống (ngày 0)' : s && s.type === 'mushroom' ? 'Ngày cấy giống (ngày 0)' : 'Ngày gieo/trồng (ngày 0)', type: 'date', req: true },
        { k: 'qty', l: `Quy mô (${s ? s.qtyUnit : ''})`, type: 'number', req: true, min: 1, hint: dens && u.area ? `Khuyến cáo: ${dens[0]}–${dens[1]} ${dens[2]} → ${nf(u.area * dens[0])}–${nf(u.area * dens[1])} cho ${nf(u.area)} m²` : '' },
        { k: 'source', l: 'Nguồn giống / nhà cung cấp' },
        { k: 'markPast', l: 'Đánh dấu đã làm các công việc có ngày trước hôm nay', type: 'checkbox' },
        { k: 'note', l: 'Ghi chú', type: 'textarea' }
      ];
    },
    submit: d => {
      const b = { id: uid(), unitId: d.unitId, sopId: d.sopId, name: d.name, start: d.start, qty: d.qty, source: d.source, note: d.note, status: 'active' };
      S.batches.push(b); genTasks(b, d.markPast);
      setTimeout(() => { location.hash = '#/batch/' + b.id; }, 0);
    },
    done: 'Đã tạo lứa/vụ và lập lịch công việc theo quy trình'
  });
}
function logForm(batchId, type) {
  const bs = S.batches.filter(b => b.status === 'active' || b.id === batchId);
  if (!bs.length) { toast('Chưa có lứa/vụ nào'); return; }
  openForm({
    title: 'Ghi nhật ký sản xuất', data: { batchId: batchId || bs[0].id, date: today(), type },
    fields: d => {
      const b = get('batches', d.batchId), t = sopOf(b).type;
      const types = Object.entries(LOG_TYPES).filter(([, v]) => v.for.includes(t));
      if (!types.find(([k]) => k === d.type)) d.type = types[0][0];
      const L = LOG_TYPES[d.type];
      const item = get('inventory', d.itemId);
      return [
        { k: 'batchId', l: 'Lứa / vụ', type: 'select', re: true, opts: opts(bs) },
        { k: 'type', l: 'Loại ghi chép', type: 'select', re: true, opts: types.map(([k, v]) => [k, v.n]) },
        { k: 'date', l: 'Ngày', type: 'date', req: true },
        L.item && { k: 'itemId', l: 'Vật tư sử dụng (tự trừ kho)', type: 'select', re: true, opts: [['', '— Không trừ kho —'], ...opts(S.inventory, i => `${i.name} (tồn ${nf(i.qty, 1)} ${i.unit})`)] },
        L.qtyL && { k: 'qty', l: L.qtyL + (item ? ` – ${item.unit}` : ''), type: 'number', min: 0, req: d.type === 'death' || d.type === 'contam' },
        L.valL && { k: 'value', l: L.valL, type: 'number', min: 0, req: d.type === 'weigh' },
        L.phi && { k: 'phi', l: L.phiL, type: 'number', min: 0, def: item && item.phi != null ? item.phi : '', hint: 'Hệ thống sẽ CHẶN thu hoạch/xuất bán trong thời gian này (VietGAP/VietGAHP).' },
        { k: 'note', l: 'Ghi chú (người thực hiện, liều lượng, lý do…)', type: 'textarea' }
      ];
    },
    submit: d => {
      const L = LOG_TYPES[d.type], item = L.item ? get('inventory', d.itemId) : null;
      if (item && d.qty > 0) {
        if (d.qty > item.qty) return `Kho chỉ còn ${nf(item.qty, 1)} ${item.unit} "${item.name}"`;
        item.qty = +(item.qty - d.qty).toFixed(3);
        S.invTx.push({ id: uid(), itemId: item.id, date: d.date, type: 'out', qty: d.qty, batchId: d.batchId, note: L.n });
      }
      S.logs.push({ id: uid(), batchId: d.batchId, date: d.date, type: d.type, itemId: item ? item.id : '', qty: d.qty || 0, value: d.value || 0, phi: d.phi || 0, note: d.note });
    },
    done: 'Đã ghi nhật ký'
  });
}
function harvestForm(batchId) {
  const bs = S.batches.filter(b => b.status === 'active' || b.id === batchId);
  if (!bs.length) { toast('Chưa có lứa/vụ để thu hoạch'); return; }
  const init = get('batches', batchId) || bs[0], sop0 = sopOf(init);
  openForm({
    title: 'Ghi nhận thu hoạch → tạo lô truy xuất', ok: 'Tạo lô sản phẩm',
    data: { batchId: init.id, date: today(), product: sop0.harvest.product, unit: sop0.harvest.unit, grade: 'Loại 1', storageId: (S.storages.find(s => s.profile === sop0.harvest.storage) || S.storages[0] || {}).id || '' },
    onChange: (d, k) => { if (k === 'batchId') { const s = sopOf(get('batches', d.batchId)); d.product = s.harvest.product; d.unit = s.harvest.unit; d.storageId = (S.storages.find(x => x.profile === s.harvest.storage) || S.storages[0] || {}).id || ''; } },
    intro: d => {
      const b = get('batches', d.batchId), s = sopOf(b), phi = phiUntil(b), day = diffDays(b.start, d.date || today());
      let h = `<div class="alert info"><span class="ic">📦</span><div class="grow">Sơ chế – bảo quản khuyến cáo: ${esc(s.post.join('; '))}</div></div>`;
      if (phi && phi > (d.date || today())) h += alertHtml({ lv: 'bad', msg: `Lứa/vụ đang trong thời gian cách ly/ngừng thuốc đến ${fd(phi)}. Không được thu hoạch trước ngày này.` });
      if (day < s.harvest.from - 3) h += alertHtml({ lv: 'warn', msg: `Mới ngày thứ ${day}; quy trình khuyến cáo thu từ ngày ${s.harvest.from}.` });
      return h;
    },
    fields: [
      { k: 'batchId', l: 'Lứa / vụ', type: 'select', re: true, opts: opts(bs) },
      { k: 'date', l: 'Ngày thu hoạch', type: 'date', req: true, re: true },
      { k: 'product', l: 'Sản phẩm', req: true },
      { k: 'grade', l: 'Phân loại', type: 'select', opts: GRADES },
      { k: 'qty', l: 'Sản lượng', type: 'number', req: true, min: 0 },
      { k: 'unit', l: 'Đơn vị', req: true },
      { k: 'storageId', l: 'Nhập kho bảo quản', type: 'select', opts: [['', '— Bán ngay, không nhập kho —'], ...opts(S.storages, s => `${s.name} (${STORAGE_PROFILES[s.profile].n})`)] },
      { k: 'note', l: 'Ghi chú (người thu, điều kiện thời tiết…)', type: 'textarea' }
    ],
    submit: d => {
      const b = get('batches', d.batchId), s = sopOf(b), phi = phiUntil(b);
      if (phi && phi > d.date) return `Bị chặn: đang trong thời gian cách ly/ngừng thuốc đến ${fd(phi)}.`;
      if (!(d.qty > 0)) return 'Sản lượng phải lớn hơn 0';
      const st = get('storages', d.storageId), prof = STORAGE_PROFILES[st ? st.profile : s.harvest.storage];
      const code = `${(S.farm.code || 'DHT').toUpperCase()}-${TYPE_CODE[s.type]}${d.date.slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      S.lots.push({ id: uid(), code, batchId: b.id, unitId: b.unitId, product: d.product, unit: d.unit, qty: d.qty, remain: d.qty, grade: d.grade, date: d.date, storageId: d.storageId, expiry: addDays(d.date, prof.life), note: d.note, moves: [] });
      S.tasks.filter(x => x.batchId === b.id && x.cat === 'th' && !x.done && x.date <= d.date && /thu/i.test(x.title)).slice(-1).forEach(x => { x.done = true; });
      UI.lastLot = code;
    },
    done: 'Đã tạo lô sản phẩm và mã truy xuất'
  });
}
function lotMoveForm(id, type) {
  const l = get('lots', id);
  openForm({
    title: (type === 'sale' ? 'Xuất bán lô ' : 'Ghi hao hụt lô ') + l.code, ok: type === 'sale' ? 'Xuất bán' : 'Ghi hao hụt',
    data: { date: today(), qty: l.remain },
    intro: `<p class="muted" style="margin-top:0">${esc(l.product)} · tồn ${nf(l.remain, 1)} ${esc(l.unit)} · ${esc(l.grade)}</p>`,
    fields: type === 'sale' ? [
      { k: 'date', l: 'Ngày xuất', type: 'date', req: true },
      { k: 'qty', l: `Số lượng (${l.unit})`, type: 'number', req: true, min: 0 },
      { k: 'price', l: `Đơn giá (₫/${l.unit})`, type: 'number', req: true, min: 0 },
      { k: 'buyer', l: 'Khách hàng / đơn vị nhận', req: true },
      { k: 'note', l: 'Ghi chú (xe, chứng từ…)', type: 'textarea' }
    ] : [
      { k: 'date', l: 'Ngày', type: 'date', req: true },
      { k: 'qty', l: `Số lượng hao hụt (${l.unit})`, type: 'number', req: true, min: 0 },
      { k: 'note', l: 'Lý do (dập, héo, quá hạn…)', type: 'textarea', req: true }
    ],
    submit: d => {
      if (!(d.qty > 0) || d.qty > l.remain + 1e-9) return `Số lượng phải trong khoảng 0 – ${nf(l.remain, 1)}`;
      const b = get('batches', l.batchId);
      if (type === 'sale' && b) { const phi = phiUntil(b); if (phi && phi > d.date) return `Bị chặn: lứa/vụ còn trong thời gian cách ly/ngừng thuốc đến ${fd(phi)}.`; }
      l.remain = +(l.remain - d.qty).toFixed(3);
      l.moves.push({ date: d.date, type, qty: d.qty, price: d.price || 0, buyer: d.buyer || '', note: d.note || '' });
      if (type === 'sale') S.fin.push({ id: uid(), date: d.date, type: 'in', cat: 'Bán sản phẩm', amount: d.qty * d.price, batchId: l.batchId, note: `${l.code} → ${d.buyer}` });
    }
  });
}
function storageForm(id) {
  const s = id ? get('storages', id) : null;
  openForm({
    title: s ? 'Sửa kho bảo quản' : 'Thêm kho bảo quản', data: s || { profile: 'cold_veg' },
    fields: [
      { k: 'name', l: 'Tên kho', req: true },
      { k: 'profile', l: 'Chế độ bảo quản', type: 'select', opts: Object.entries(STORAGE_PROFILES).map(([k, v]) => [k, `${v.n} (${rangeTxt('temp', v.env.temp)}, ẩm ${v.env.rh[0]}–${v.env.rh[1]}%)`]) },
      { k: 'capacity', l: 'Sức chứa (tấn / m³)', type: 'number' },
      { k: 'note', l: 'Ghi chú', type: 'textarea' }
    ],
    submit: d => { if (s) Object.assign(s, d); else S.storages.push({ id: uid(), ...d }); }
  });
}
function readingForm(tid) {
  const tg = targetOf(tid);
  const ps = Object.keys(tg.env).length ? Object.keys(tg.env) : ['temp', 'rh'];
  const r = latest(tid) || {};
  openForm({
    title: 'Nhập số đo thủ công – ' + tg.name, ok: 'Ghi số đo',
    fields: ps.map(p => ({ k: p, l: `${PARAMS[p].n}${PARAMS[p].u ? ' (' + PARAMS[p].u + ')' : ''}`, type: 'number', ph: r[p] != null ? String(r[p]) : '', hint: tg.env[p] ? 'Ngưỡng: ' + esc(rangeTxt(p, tg.env[p])) : '' })),
    submit: d => {
      const vals = {}; for (const p of ps) if (d[p] !== '' && d[p] != null) vals[p] = d[p];
      if (!Object.keys(vals).length) return 'Nhập ít nhất một chỉ số';
      addReading(tid, vals, 'manual');
      const bad = Object.entries(vals).filter(([p, v]) => tg.env[p] && !inRange(v, tg.env[p]));
      if (bad.length) setTimeout(() => toast('⚠️ Ngoài ngưỡng: ' + bad.map(([p]) => PARAMS[p].n).join(', ')), 50);
    }
  });
}
function deviceForm(tid) {
  openForm({
    title: 'Thêm thiết bị điều khiển', data: { tid: tid || (allTargets()[0] || {}).id, kind: 'fan', auto: true },
    fields: [
      { k: 'tid', l: 'Lắp tại', type: 'select', opts: allTargets().map(t => [t.id, t.label]) },
      { k: 'kind', l: 'Loại thiết bị', type: 'select', opts: Object.entries(DEVICE_KINDS).map(([k, v]) => [k, v.icon + ' ' + v.n]) },
      { k: 'name', l: 'Tên thiết bị', req: true, ph: 'VD: Quạt hút số 3' },
      { k: 'auto', l: 'Cho phép điều khiển tự động theo quy tắc', type: 'checkbox' }
    ],
    submit: d => { S.devices.push({ id: uid(), tid: d.tid, kind: d.kind, name: d.name, auto: d.auto, on: false }); }
  });
}
function ruleForm(tid) {
  openForm({
    title: 'Thêm quy tắc tự động hóa', data: { tid: tid || (allTargets()[0] || {}).id, op: '>', act: 'on', p: 'temp' },
    intro: '<p class="muted" style="margin-top:0">NẾU chỉ số thỏa điều kiện THÌ bật/tắt thiết bị (thiết bị phải ở chế độ Tự động). Nên tạo cặp quy tắc bật – tắt có khoảng trễ để tránh bật tắt liên tục.</p>',
    fields: d => {
      const devs = S.devices.filter(x => x.tid === d.tid);
      return [
        { k: 'tid', l: 'Khu / kho', type: 'select', re: true, opts: allTargets().map(t => [t.id, t.label]) },
        { k: 'p', l: 'Chỉ số', type: 'select', opts: Object.entries(PARAMS).map(([k, v]) => [k, v.n]) },
        { k: 'op', l: 'Điều kiện', type: 'select', opts: [['>', 'lớn hơn (>)'], ['<', 'nhỏ hơn (<)']] },
        { k: 'v', l: 'Giá trị', type: 'number', req: true },
        { k: 'dev', l: 'Thiết bị', type: 'select', req: true, opts: devs.length ? opts(devs) : [['', '— Khu này chưa có thiết bị —']] },
        { k: 'act', l: 'Hành động', type: 'select', opts: [['on', 'BẬT'], ['off', 'TẮT']] }
      ];
    },
    submit: d => { if (!d.dev) return 'Hãy thêm thiết bị cho khu này trước'; S.rules.push({ id: uid(), tid: d.tid, p: d.p, op: d.op, v: d.v, dev: d.dev, act: d.act, en: true }); }
  });
}
function itemForm(id) {
  const i = id ? get('inventory', id) : null;
  openForm({
    title: i ? 'Sửa vật tư' : 'Thêm vật tư', data: i || { cat: INV_CATS[1], qty: 0, min: 0 },
    fields: [
      { k: 'name', l: 'Tên vật tư', req: true, full: true },
      { k: 'cat', l: 'Nhóm', type: 'select', opts: INV_CATS },
      { k: 'unit', l: 'Đơn vị tính', req: true, ph: 'kg, lít, lọ, bao…' },
      !i && { k: 'qty', l: 'Tồn đầu kỳ', type: 'number', min: 0 },
      { k: 'min', l: 'Mức tồn tối thiểu (cảnh báo)', type: 'number', min: 0 },
      { k: 'price', l: 'Đơn giá (₫)', type: 'number', min: 0 },
      { k: 'expiry', l: 'Hạn sử dụng', type: 'date' },
      { k: 'phi', l: 'Thời gian cách ly/ngừng thuốc mặc định (ngày)', type: 'number', min: 0, hint: 'Với thuốc BVTV, thuốc thú y' },
      { k: 'supplier', l: 'Nhà cung cấp', full: true }
    ],
    submit: d => { if (i) Object.assign(i, d); else S.inventory.push({ id: uid(), ...d, qty: d.qty || 0, min: d.min || 0, price: d.price || 0 }); }
  });
}
function txForm(itemId, type) {
  const i = get('inventory', itemId);
  openForm({
    title: (type === 'in' ? 'Nhập kho: ' : 'Xuất kho: ') + i.name, ok: type === 'in' ? 'Nhập kho' : 'Xuất kho',
    data: { date: today(), price: i.price, fin: true, batchId: '' },
    fields: [
      { k: 'date', l: 'Ngày', type: 'date', req: true },
      { k: 'qty', l: `Số lượng (${i.unit})`, type: 'number', req: true, min: 0 },
      type === 'in' && { k: 'price', l: 'Đơn giá (₫)', type: 'number', min: 0 },
      type === 'in' && { k: 'expiry', l: 'Hạn sử dụng lô mới', type: 'date' },
      type === 'out' && { k: 'batchId', l: 'Dùng cho lứa/vụ', type: 'select', opts: [['', '— Chung —'], ...opts(activeBatches())] },
      { k: 'note', l: 'Ghi chú / số chứng từ', full: true },
      type === 'in' && { k: 'fin', l: 'Ghi vào chi phí tài chính', type: 'checkbox' }
    ],
    submit: d => {
      if (!(d.qty > 0)) return 'Số lượng phải lớn hơn 0';
      if (type === 'out' && d.qty > i.qty) return `Kho chỉ còn ${nf(i.qty, 1)} ${i.unit}`;
      i.qty = +(i.qty + (type === 'in' ? d.qty : -d.qty)).toFixed(3);
      if (type === 'in') { if (d.price) i.price = d.price; if (d.expiry) i.expiry = d.expiry; }
      S.invTx.push({ id: uid(), itemId: i.id, date: d.date, type, qty: d.qty, price: d.price || 0, batchId: d.batchId || '', note: d.note });
      if (type === 'in' && d.fin && d.price) S.fin.push({ id: uid(), date: d.date, type: 'out', cat: FIN_OUT.includes(i.cat) ? i.cat : i.cat.startsWith('Phân') || i.cat.startsWith('Thuốc BVTV') || i.cat.startsWith('Giá thể') ? 'Phân bón – vật tư' : 'Khác', amount: d.qty * d.price, batchId: '', note: 'Nhập ' + i.name });
    }
  });
}
function finForm(id, preset = {}) {
  const f = id ? get('fin', id) : null;
  openForm({
    title: f ? 'Sửa giao dịch' : 'Thêm thu / chi', data: f || { date: today(), type: 'out', ...preset },
    fields: d => [
      { k: 'type', l: 'Loại', type: 'select', re: true, opts: [['out', 'Chi phí'], ['in', 'Doanh thu']] },
      { k: 'date', l: 'Ngày', type: 'date', req: true },
      { k: 'cat', l: 'Hạng mục', type: 'select', opts: d.type === 'in' ? FIN_IN : FIN_OUT },
      { k: 'amount', l: 'Số tiền (₫)', type: 'number', req: true, min: 0 },
      { k: 'batchId', l: 'Phân bổ cho lứa/vụ', type: 'select', opts: [['', '— Chi phí chung —'], ...opts(S.batches)] },
      { k: 'note', l: 'Diễn giải', full: true }
    ],
    submit: d => { if (f) Object.assign(f, d); else S.fin.push({ id: uid(), ...d }); }
  });
}
function staffForm(id) {
  const s = id ? get('staff', id) : null;
  openForm({
    title: s ? 'Sửa nhân sự' : 'Thêm nhân sự', data: s || {},
    fields: [{ k: 'name', l: 'Họ tên', req: true }, { k: 'role', l: 'Vị trí / chuyên môn', req: true, ph: 'Kỹ thuật chăn nuôi, Kỹ thuật trồng trọt – nấm, Kho – sơ chế…' }, { k: 'phone', l: 'Điện thoại' }, { k: 'note', l: 'Chứng chỉ / ghi chú', type: 'textarea' }],
    submit: d => { if (s) Object.assign(s, d); else S.staff.push({ id: uid(), ...d }); }
  });
}
function equipForm(id) {
  const e = id ? get('equip', id) : null;
  openForm({
    title: e ? 'Sửa máy móc – thiết bị' : 'Thêm máy móc – thiết bị', data: e || { kind: EQUIP_KINDS[0], status: 'Hoạt động', interval: 90, lastService: today() },
    fields: [
      { k: 'name', l: 'Tên máy / model', req: true, full: true },
      { k: 'kind', l: 'Nhóm cơ giới hóa', type: 'select', opts: EQUIP_KINDS },
      { k: 'unitId', l: 'Khu sử dụng', type: 'select', opts: [['', '— Dùng chung —'], ...opts(S.units)] },
      { k: 'lastService', l: 'Bảo dưỡng lần cuối', type: 'date' },
      { k: 'interval', l: 'Chu kỳ bảo dưỡng (ngày)', type: 'number', min: 1 },
      { k: 'status', l: 'Tình trạng', type: 'select', opts: ['Hoạt động', 'Bảo dưỡng', 'Hỏng', 'Ngừng sử dụng'] },
      { k: 'value', l: 'Giá trị đầu tư (₫)', type: 'number', min: 0 },
      { k: 'note', l: 'Thông số / ghi chú', type: 'textarea' }
    ],
    submit: d => { if (e) Object.assign(e, d); else S.equip.push({ id: uid(), ...d }); }
  });
}
function serviceForm(id) {
  const e = get('equip', id);
  openForm({
    title: 'Ghi nhận bảo dưỡng: ' + e.name, ok: 'Xác nhận', data: { date: today() },
    fields: [{ k: 'date', l: 'Ngày bảo dưỡng', type: 'date', req: true }, { k: 'cost', l: 'Chi phí (₫)', type: 'number', min: 0 }, { k: 'note', l: 'Nội dung (thay dầu, lọc, vệ sinh…)', type: 'textarea' }],
    submit: d => {
      e.lastService = d.date; if (e.status === 'Bảo dưỡng' || e.status === 'Hỏng') e.status = 'Hoạt động';
      (e.history = e.history || []).push({ date: d.date, cost: d.cost || 0, note: d.note });
      if (d.cost) S.fin.push({ id: uid(), date: d.date, type: 'out', cat: 'Sửa chữa – bảo dưỡng máy', amount: d.cost, batchId: '', note: e.name + (d.note ? ': ' + d.note : '') });
    }
  });
}
function taskForm(id) {
  const x = id ? get('tasks', id) : null;
  openForm({
    title: x ? 'Sửa công việc' : 'Thêm công việc', data: x || { date: today(), cat: 'kt' },
    fields: [
      { k: 'title', l: 'Nội dung công việc', req: true, full: true },
      { k: 'date', l: 'Ngày thực hiện', type: 'date', req: true },
      { k: 'cat', l: 'Nhóm', type: 'select', opts: Object.entries(TASK_CATS).map(([k, v]) => [k, v.n]) },
      { k: 'batchId', l: 'Lứa / vụ', type: 'select', opts: [['', '— Không —'], ...opts(activeBatches())] },
      { k: 'assignee', l: 'Giao cho', type: 'select', opts: [['', '— Chưa giao —'], ...opts(S.staff)] }
    ],
    submit: d => {
      const b = get('batches', d.batchId);
      if (x) Object.assign(x, d, { unitId: b ? b.unitId : x.unitId });
      else S.tasks.push({ id: uid(), ...d, unitId: b ? b.unitId : '', done: false, auto: false });
    }
  });
}

/* ============================ CÁC TRANG ============================ */
const VIEWS = {};

VIEWS.dashboard = {
  title: 'Tổng quan trang trại',
  render() {
    const t = today(), alerts = computeAlerts(), ab = activeBatches();
    const tt = S.tasks.filter(x => x.date === t), od = S.tasks.filter(x => !x.done && x.date < t);
    const m = t.slice(0, 7), fm = S.fin.filter(f => f.date.startsWith(m));
    const inc = sum(fm.filter(f => f.type === 'in'), f => f.amount), exp = sum(fm.filter(f => f.type === 'out'), f => f.amount);
    const nb = alerts.filter(a => a.lv === 'bad').length;
    const byType = Object.keys(FARM_TYPES).map(k => [k, ab.filter(b => sopOf(b).type === k).length]).filter(x => x[1]);
    const stock = S.lots.filter(l => l.remain > 0);
    return `
    <div class="grid g4">
      <div class="card kpi"><span class="l">Lứa / vụ đang vận hành</span><span class="v">${ab.length}</span><span class="s muted">${byType.map(([k, n]) => FARM_TYPES[k].icon + ' ' + n).join(' · ') || '—'}</span></div>
      <div class="card kpi"><span class="l">Công việc hôm nay</span><span class="v">${tt.filter(x => x.done).length}/${tt.length}</span><span class="s ${od.length ? 't-bad' : 'muted'}">${od.length ? od.length + ' việc quá hạn' : 'Không có việc quá hạn'}</span></div>
      <div class="card kpi"><span class="l">Cảnh báo</span><span class="v ${nb ? 't-bad' : alerts.length ? 't-warn' : 't-ok'}">${alerts.length}</span><span class="s muted">${nb} nghiêm trọng</span></div>
      <div class="card kpi"><span class="l">Lãi / lỗ tháng ${m.slice(5)}</span><span class="v ${inc - exp >= 0 ? 't-ok' : 't-bad'}">${short(inc - exp)}</span><span class="s muted">Thu ${short(inc)} · Chi ${short(exp)}</span></div>
    </div>
    <div class="grid g2 sec">
      <div class="card"><div class="card-head"><h2>Cảnh báo & khuyến nghị</h2><a class="btn sm" href="#/advisor">🧠 Phân tích</a></div>
        ${alerts.length ? alerts.slice(0, 8).map(alertHtml).join('') + (alerts.length > 8 ? `<small class="muted">+ ${alerts.length - 8} cảnh báo khác</small>` : '') : alertHtml({ lv: 'ok', msg: 'Mọi chỉ số trong ngưỡng an toàn.' })}
      </div>
      <div class="card"><div class="card-head"><h2>Việc cần làm hôm nay</h2><a class="btn sm" href="#/tasks">Lịch đầy đủ</a></div>
        ${[...od.slice(0, 4), ...tt].map(x => taskRow(x)).join('') || empty('Không có việc theo mốc hôm nay')}
        ${ab.length ? `<p class="muted" style="font-size:13px;margin:10px 0 0">+ Checklist thường nhật của ${ab.length} lứa/vụ trong trang <a href="#/tasks">Lịch công việc</a>.</p>` : ''}
      </div>
    </div>
    <div class="card-head sec"><h2>Lứa nuôi / vụ trồng đang vận hành</h2><button class="btn pri sm" data-act="newBatch">＋ Lứa/vụ mới</button></div>
    ${ab.length ? `<div class="grid g3">${ab.map(batchCard).join('')}</div>` : empty('Chưa có lứa/vụ nào', '<button class="btn pri" data-act="newBatch">Tạo lứa/vụ đầu tiên</button>')}
    <div class="grid g2 sec">
      <div class="card"><div class="card-head"><h2>Kho bảo quản</h2><a class="btn sm" href="#/harvest">Quản lý</a></div>
        ${S.storages.map(s => { const p = STORAGE_PROFILES[s.profile], ls = stock.filter(l => l.storageId === s.id); return `<div class="task"><div class="grow"><b>${esc(s.name)}</b> <small class="muted">${esc(p.n)} · ${ls.length} lô tồn</small>${envChips(s.id, p.env)}</div><a class="btn sm" href="#/env/${s.id}">📡</a></div>`; }).join('') || empty('Chưa có kho')}
      </div>
      <div class="card"><div class="card-head"><h2>Thu – chi 6 tháng</h2><a class="btn sm" href="#/finance">Chi tiết</a></div>${finChart(6)}</div>
    </div>`;
  }
};
function batchCard(b) {
  const sop = sopOf(b), u = get('units', b.unitId) || {}, d = bDay(b), st = stageOf(sop, d);
  const next = S.tasks.filter(x => x.batchId === b.id && !x.done).sort((a, c) => a.date.localeCompare(c.date))[0];
  const p = clamp(d / sop.duration, 0, 1);
  return `<a class="card batch" href="#/batch/${b.id}">
    <div class="t"><span class="ico">${FARM_TYPES[sop.type].icon}</span><div class="grow" style="min-width:0"><b>${esc(b.name)}</b><br><small class="muted">${esc(u.name || '')} · ${nf(b.qty)} ${sop.qtyUnit}</small></div></div>
    <div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(st.n)}</span><span class="muted">Ngày ${d}/${sop.duration}</span></div>
    <div class="prog"><i style="width:${(p * 100).toFixed(0)}%"></i></div>
    ${envChips(b.unitId, st.env)}
    ${next ? `<small class="${next.date < today() ? 't-bad' : 'muted'}">Tiếp theo (${fds(next.date)}): ${esc(next.title)}</small>` : ''}
  </a>`;
}
function finChart(n) {
  const labels = [], inc = [], exp = [];
  const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1), m = x.getFullYear() + '-' + pad(x.getMonth() + 1);
    labels.push('T' + (x.getMonth() + 1));
    inc.push(sum(S.fin.filter(f => f.type === 'in' && f.date.startsWith(m)), f => f.amount));
    exp.push(sum(S.fin.filter(f => f.type === 'out' && f.date.startsWith(m)), f => f.amount));
  }
  return barChart(labels, [{ name: 'Doanh thu', color: 'var(--chart-1)', vals: inc }, { name: 'Chi phí', color: 'var(--chart-3)', vals: exp }], { label: 'Thu chi theo tháng' });
}

VIEWS.units = {
  title: 'Khu sản xuất',
  render() {
    return `<div class="toolbar"><span class="grow muted">Chuồng trại, nhà nấm, nhà màng, vườn dược liệu — đơn vị quản lý môi trường & lứa/vụ.</span><button class="btn pri" data-act="newUnit">＋ Thêm khu</button></div>
    <div class="grid g3">${S.units.map(u => {
      const b = unitBatch(u.id), tg = targetOf(u.id), devs = S.devices.filter(d => d.tid === u.id);
      return `<div class="card"><div class="card-head"><div class="sop-h"><span class="ico">${FARM_TYPES[u.type].icon}</span><div><b>${esc(u.name)}</b><br><small class="muted">${esc(u.location || '')} · ${nf(u.area)} m² · sức chứa ${nf(u.capacity)}</small></div></div>${acts(editBtn('editUnit', u.id), delBtn('units', u.id))}</div>
        ${b ? `<p style="margin:0 0 6px">▶ <a href="#/batch/${b.id}">${esc(b.name)}</a> <small class="muted">· ${esc(tg.sub)} · ngày ${bDay(b)}</small></p>${envChips(u.id, tg.env)}` : `<p class="muted" style="margin:0 0 8px">Đang trống — sẵn sàng cho lứa/vụ mới.</p><button class="btn sm" data-act="newBatch">＋ Bắt đầu lứa/vụ</button>`}
        <p class="muted" style="font-size:13px;margin:10px 0 0">${devs.length} thiết bị IoT · ${S.batches.filter(x => x.unitId === u.id).length} lứa/vụ đã ghi nhận ${u.note ? '<br>' + esc(u.note) : ''}</p>
        <div style="margin-top:8px"><a class="btn sm" href="#/env/${u.id}">📡 Môi trường</a></div></div>`;
    }).join('')}</div>${S.units.length ? '' : empty('Chưa có khu sản xuất', '<button class="btn pri" data-act="newUnit">Thêm khu đầu tiên</button>')}`;
  }
};

VIEWS.batches = {
  title: 'Lứa nuôi / Vụ trồng',
  render() {
    const f = UI.batchF, list = S.batches.filter(b => f === 'all' || (f === 'active' ? b.status === 'active' : b.status === 'done')).sort((a, b) => b.start.localeCompare(a.start));
    return `<div class="toolbar"><select data-chg="ui" data-k="batchF"><option value="active" ${f === 'active' ? 'selected' : ''}>Đang vận hành</option><option value="done" ${f === 'done' ? 'selected' : ''}>Đã kết thúc</option><option value="all" ${f === 'all' ? 'selected' : ''}>Tất cả</option></select><span class="grow"></span><button class="btn pri" data-act="newBatch">＋ Lứa/vụ mới</button></div>
    <div class="card">${tbl(['Lứa / vụ', 'Khu', 'Quy trình', 'Bắt đầu', 'Ngày', 'Giai đoạn', ['Sản lượng', 'r'], ['Lãi/lỗ', 'r'], 'Trạng thái'], list.map(b => {
      const s = batchStats(b), u = get('units', b.unitId) || {};
      return `<tr><td>${FARM_TYPES[s.sop.type].icon} <a href="#/batch/${b.id}">${esc(b.name)}</a></td><td>${esc(u.name || '')}</td><td><small>${esc(s.sop.name)}</small></td><td>${fd(b.start)}</td><td class="num">${s.day}/${s.sop.duration}</td><td>${esc(stageOf(s.sop, s.day).n)}</td><td class="r num">${nf(s.harvested, 1)} ${esc(s.sop.harvest.unit)}</td><td class="r num ${s.profit >= 0 ? 't-ok' : 't-bad'}">${short(s.profit)}</td><td>${b.status === 'active' ? badge('Đang chạy', 'b-ok') : badge('Kết thúc ' + fd(b.end))}</td></tr>`;
    }), 'Không có lứa/vụ')}</div>`;
  }
};

VIEWS.batch = {
  title: id => { const b = get('batches', id); return b ? b.name : 'Lứa/vụ'; },
  nav: 'batches',
  render(id) {
    const b = get('batches', id);
    if (!b) return empty('Không tìm thấy lứa/vụ', '<a class="btn" href="#/batches">Quay lại</a>');
    const s = batchStats(b), sop = s.sop, u = get('units', b.unitId) || {}, d = s.day, stg = stageOf(sop, d);
    const tabs = [['overview', 'Tổng quan'], ['tasks', 'Công việc'], ['logs', 'Nhật ký'], ['harvest', 'Thu hoạch'], ['fin', 'Tài chính']];
    const tb = UI.btab;
    let body = '';
    if (tb === 'overview') {
      const r = latest(b.unitId);
      body = `
      <div class="card"><h3>Tiến trình theo quy trình (${sop.duration} ngày)</h3>
        <div class="stages">${sop.stages.map(x => `<div class="${x === stg ? 'cur' : ''}"><b>${esc(x.n)}</b>Ngày ${x.f} → ${x.t}</div>`).join('')}</div>
        <div class="prog"><i style="width:${(clamp(d / sop.duration, 0, 1) * 100).toFixed(0)}%"></i></div></div>
      <div class="grid g4 sec">${kpis(b, s).map(k => `<div class="card kpi"><span class="l">${k[0]}</span><span class="v ${k[3] || ''}">${k[1]}</span><span class="s muted">${k[2] || ''}</span></div>`).join('')}</div>
      <div class="grid g2 sec">
        <div class="card"><div class="card-head"><h3>Giai đoạn: ${esc(stg.n)}</h3><a class="btn sm" href="#/env/${b.unitId}">📡 IoT</a></div>
          <p class="muted" style="margin-top:0">💡 ${esc(stg.tip)}</p>
          ${Object.keys(stg.env).length ? tbl(['Chỉ số', 'Ngưỡng tối ưu', ['Hiện tại', 'r']], Object.entries(stg.env).map(([p, rg]) => `<tr><td>${PARAMS[p].n}</td><td>${esc(rangeTxt(p, rg))}</td><td class="r num">${r && r[p] != null ? `<span class="${inRange(r[p], rg) ? 't-ok' : 't-bad'}">${fmtP(p, r[p])}</span>` : '—'}</td></tr>`)) : ''}
          ${r ? `<small class="muted">Cập nhật ${fdt(r.ts)} (${r.src === 'manual' ? 'nhập tay' : 'cảm biến'})</small>` : ''}
        </div>
        <div class="card"><h3 style="margin-bottom:8px">Checklist thường nhật hôm nay</h3>${b.status === 'active' ? routineHtml(b) : empty('Lứa/vụ đã kết thúc')}</div>
      </div>
      ${sop.weights && s.w ? `<div class="card sec"><h3>Tăng trọng so với chuẩn giống</h3>${lineChart([{ name: 'Chuẩn giống', color: 'var(--chart-2)', pts: sop.weights }, { name: 'Thực tế (cân mẫu)', color: 'var(--chart-1)', pts: [[0, .035], ...s.logs.filter(l => l.type === 'weigh').map(l => [diffDays(b.start, l.date), l.value]).sort((a, c) => a[0] - c[0])] }], { xfmt: v => 'N' + Math.round(v), yd: 2, label: 'Khối lượng theo ngày tuổi' })}</div>` : ''}`;
    } else if (tb === 'tasks') {
      const ts = S.tasks.filter(x => x.batchId === b.id).sort((a, c) => a.date.localeCompare(c.date));
      const open = ts.filter(x => !x.done), done = ts.filter(x => x.done);
      body = `<div class="card"><div class="card-head"><h3>Chưa hoàn thành (${open.length})</h3><button class="btn sm" data-act="newTask">＋ Thêm việc</button></div>${open.map(x => taskRow(x, true)).join('') || empty('Đã hoàn thành mọi việc')}</div>
      <div class="card sec"><h3 style="margin-bottom:8px">Đã hoàn thành (${done.length})</h3>${done.slice().reverse().map(x => taskRow(x, true)).join('') || empty('Chưa có')}</div>`;
    } else if (tb === 'logs') {
      body = `<div class="card"><div class="card-head"><h3>Nhật ký sản xuất (hồ sơ VietGAP/GACP)</h3><button class="btn pri sm" data-act="newLog" data-id="${b.id}">＋ Ghi nhật ký</button></div>
      ${tbl(['Ngày', 'Loại', 'Vật tư', ['Số lượng', 'r'], ['Giá trị', 'r'], 'Cách ly', 'Ghi chú', ''], s.logs.slice().sort((a, c) => c.date.localeCompare(a.date)).map(l => { const it = get('inventory', l.itemId); return `<tr><td>${fd(l.date)}</td><td>${esc(LOG_TYPES[l.type].n)}</td><td>${esc(it ? it.name : '')}</td><td class="r num">${l.qty ? nf(l.qty, 2) : ''}</td><td class="r num">${l.value ? nf(l.value, 2) : ''}</td><td>${l.phi ? `${l.phi} ngày → ${fds(addDays(l.date, l.phi))}` : ''}</td><td><small>${esc(l.note)}</small></td><td>${acts(delBtn('logs', l.id))}</td></tr>`; }), 'Chưa có nhật ký')}</div>`;
    } else if (tb === 'harvest') {
      body = `<div class="card"><div class="card-head"><h3>Lô sản phẩm đã thu (${nf(s.harvested, 1)} ${esc(sop.harvest.unit)})</h3><button class="btn pri sm" data-act="newHarvest" data-id="${b.id}">＋ Thu hoạch</button></div>${lotTable(s.lots)}</div>
      <div class="card sec"><h3>Sơ chế & bảo quản theo quy trình</h3><ul class="clean">${sop.post.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    } else {
      const fs = S.fin.filter(f => f.batchId === b.id).sort((a, c) => c.date.localeCompare(a.date));
      body = `<div class="grid g4"><div class="card kpi"><span class="l">Doanh thu</span><span class="v t-ok">${short(s.rev)}</span></div><div class="card kpi"><span class="l">Chi phí trực tiếp</span><span class="v">${short(s.cost)}</span></div><div class="card kpi"><span class="l">Vật tư xuất dùng</span><span class="v">${short(s.matCost)}</span><span class="s muted">theo đơn giá kho</span></div><div class="card kpi"><span class="l">Lãi / lỗ</span><span class="v ${s.profit >= 0 ? 't-ok' : 't-bad'}">${short(s.profit)}</span><span class="s muted">${s.harvested ? 'Giá thành ' + money((s.cost + s.matCost) / s.harvested) + '/' + esc(sop.harvest.unit) : ''}</span></div></div>
      <div class="card sec"><div class="card-head"><h3>Giao dịch của lứa/vụ</h3><button class="btn sm" data-act="newFin" data-batch="${b.id}">＋ Thu/chi</button></div>${finTable(fs)}</div>`;
    }
    return `<div class="card"><div class="card-head"><div class="sop-h"><span class="ico">${FARM_TYPES[sop.type].icon}</span><div><b>${esc(b.name)}</b> ${b.status === 'active' ? badge('Đang chạy', 'b-ok') : badge('Đã kết thúc')}<br><small class="muted">${esc(u.name || '')} · ${esc(sop.name)} · ${esc(sop.std)} · Bắt đầu ${fd(b.start)} · <b>Ngày thứ ${d}</b>${b.source ? ' · Giống: ' + esc(b.source) : ''}</small></div></div>
      <div class="acts" style="flex-wrap:wrap">${b.status === 'active' ? `<button class="btn sm" data-act="newLog" data-id="${b.id}">📝 Nhật ký</button><button class="btn sm" data-act="newHarvest" data-id="${b.id}">📦 Thu hoạch</button><button class="btn sm" data-act="endBatch" data-id="${b.id}">✔ Kết thúc</button>` : `<button class="btn sm" data-act="reopenBatch" data-id="${b.id}">↺ Mở lại</button>`}${delBtn('batches', b.id)}</div></div>
      ${s.phiEnd && s.phiEnd >= today() ? alertHtml({ lv: 'warn', ic: '⛔', msg: `Đang trong thời gian cách ly/ngừng thuốc đến ${fd(s.phiEnd)} — không thu hoạch/xuất bán.` }) : ''}
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="${tb === k ? 'on' : ''}" data-act="btab" data-k="${k}">${l}</button>`).join('')}</div>${body}</div>`;
  }
};
function kpis(b, s) {
  const sop = s.sop, K = [];
  if (sop.type === 'poultry') {
    K.push(['Đàn hiện có', nf(s.alive), `Nhập ${nf(b.qty)} · hao hụt ${nf(s.dead)}`]);
    K.push(['Tỷ lệ nuôi sống', pct(s.surv), 'Mục tiêu ≥ 95%', s.surv >= .95 ? 't-ok' : 't-bad']);
    if (sop.id === 'layer') K.push(['Tỷ lệ đẻ 7 ngày', pct(s.layRate), nf(s.eggs7) + ' trứng', s.layRate >= .8 ? 't-ok' : 't-warn']);
    else K.push(['Khối lượng bình quân', s.w ? nf(s.w, 2) + ' kg' : '—', s.wStd ? `Chuẩn ${nf(s.wStd, 2)} kg (ngày ${s.wDay})` : 'Chưa cân mẫu', s.wStd ? (s.w >= s.wStd * .95 ? 't-ok' : 't-warn') : '']);
    K.push(sop.id === 'layer' ? ['Tổng trứng đã thu', nf(s.harvested), 'quả'] : ['FCR tạm tính', s.fcr ? nf(s.fcr, 2) : '—', s.fcr ? `Đến lần cân ngày ${s.wDay}` : `Thức ăn ${nf(s.feed)} kg`, s.fcr ? (s.fcr <= 2.6 ? 't-ok' : 't-warn') : '']);
  } else if (sop.type === 'mushroom') {
    K.push(['Số bịch', nf(b.qty), `Nhiễm ${nf(s.contam)} bịch`]);
    K.push(['Tỷ lệ nhiễm', pct(s.contamPct), 'Mục tiêu < 5%', s.contamPct < .05 ? 't-ok' : 't-bad']);
    K.push(['Sản lượng', nf(s.harvested, 1) + ' kg', nf(s.perBag, 3) + ' kg/bịch']);
    K.push(['Hiệu suất sinh học', pct(s.be, 0), 'Mục tiêu 60–80%', s.be >= .6 ? 't-ok' : '']);
  } else {
    K.push(['Quy mô', nf(b.qty) + ' ' + sop.qtyUnit, get('units', b.unitId) ? nf(get('units', b.unitId).area) + ' m² khu' : '']);
    K.push(['Sản lượng', nf(s.harvested, 1) + ' ' + sop.harvest.unit, nf(s.perUnit, 2) + ' ' + sop.harvest.unit + '/' + sop.qtyUnit]);
    K.push(['Thời gian cách ly', s.phiEnd && s.phiEnd >= today() ? 'Đến ' + fds(s.phiEnd) : 'Đạt', s.phiEnd && s.phiEnd >= today() ? 'Chưa được thu' : 'Được phép thu hoạch', s.phiEnd && s.phiEnd >= today() ? 't-bad' : 't-ok']);
    const left = sop.harvest.from - s.day;
    K.push(['Đến vụ thu', left > 0 ? left + ' ngày' : 'Đang thu', 'Thu từ ngày ' + sop.harvest.from]);
  }
  return K;
}
function lotTable(lots) {
  return tbl(['Mã lô', 'Sản phẩm', 'Ngày thu', ['Sản lượng', 'r'], ['Tồn', 'r'], 'Kho', 'Hạn BQ', ''], lots.slice().sort((a, c) => c.date.localeCompare(a.date)).map(l => {
    const st = get('storages', l.storageId), dl = diffDays(today(), l.expiry);
    return `<tr><td><a href="#/trace/${encodeURIComponent(l.code)}"><code>${esc(l.code)}</code></a></td><td>${esc(l.product)} <small class="muted">${esc(l.grade)}</small></td><td>${fd(l.date)}</td><td class="r num">${nf(l.qty, 1)} ${esc(l.unit)}</td><td class="r num">${nf(l.remain, 1)}</td><td>${esc(st ? st.name : '—')}</td><td>${l.remain > 0 ? (dl < 0 ? badge('Quá hạn', 'b-bad') : dl <= 2 ? badge('Còn ' + dl + ' ngày', 'b-warn') : badge(fd(l.expiry), 'b-ok')) : badge('Đã xuất hết')}</td>
    <td>${acts(l.remain > 0 ? `<button class="btn sm" data-act="sell" data-id="${l.id}">💵 Bán</button><button class="btn sm" data-act="loss" data-id="${l.id}" aria-label="Ghi hao hụt">↘</button>` : '', delBtn('lots', l.id))}</td></tr>`;
  }), 'Chưa có lô sản phẩm');
}
function finTable(fs) {
  return tbl(['Ngày', 'Loại', 'Hạng mục', 'Lứa/vụ', 'Diễn giải', ['Số tiền', 'r'], ''], fs.map(f => { const b = get('batches', f.batchId); return `<tr><td>${fd(f.date)}</td><td>${f.type === 'in' ? badge('Thu', 'b-ok') : badge('Chi', 'b-warn')}</td><td>${esc(f.cat)}</td><td>${b ? `<a href="#/batch/${b.id}">${esc(b.name)}</a>` : '<small class="muted">Chung</small>'}</td><td><small>${esc(f.note)}</small></td><td class="r num ${f.type === 'in' ? 't-ok' : ''}">${f.type === 'in' ? '+' : '−'}${money(f.amount)}</td><td>${acts(editBtn('editFin', f.id), delBtn('fin', f.id))}</td></tr>`; }), 'Chưa có giao dịch');
}

VIEWS.tasks = {
  title: 'Lịch công việc',
  render() {
    const t = today(), uf = UI.taskUnit;
    const match = x => !uf || x.unitId === uf;
    const od = S.tasks.filter(x => !x.done && x.date < t && match(x)).sort((a, b) => a.date.localeCompare(b.date));
    let days = '';
    for (let i = 0; i < 14; i++) {
      const d = addDays(t, i), ts = S.tasks.filter(x => x.date === d && match(x));
      if (!ts.length) continue;
      const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(d + 'T00:00:00').getDay()];
      days += `<div class="day-h">${i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : wd} · ${fd(d)} ${badge(ts.filter(x => x.done).length + '/' + ts.length)}</div>${ts.map(x => taskRow(x)).join('')}`;
    }
    const ab = activeBatches().filter(b => !uf || b.unitId === uf);
    return `<div class="toolbar"><select data-chg="ui" data-k="taskUnit"><option value="">Tất cả khu</option>${S.units.map(u => `<option value="${u.id}" ${uf === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select><span class="grow"></span><button class="btn pri" data-act="newTask">＋ Thêm việc</button></div>
    <div class="grid g2">
      <div>
        ${od.length ? `<div class="card" style="margin-bottom:16px"><h2 class="t-bad" style="margin-bottom:6px">Quá hạn (${od.length})</h2>${od.map(x => taskRow(x, true)).join('')}</div>` : ''}
        <div class="card"><h2 style="margin-bottom:6px">14 ngày tới</h2>${days || empty('Không có công việc theo mốc')}</div>
      </div>
      <div>${ab.map(b => `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${FARM_TYPES[sopOf(b).type].icon} ${esc(b.name)}</h3><small class="muted">Thường nhật · ${fd(t)}</small></div>${routineHtml(b)}</div>`).join('') || empty('Không có lứa/vụ đang chạy')}</div>
    </div>`;
  }
};

VIEWS.env = {
  title: 'Môi trường & IoT',
  render(arg) {
    const targets = allTargets();
    if (!targets.length) return empty('Chưa có khu sản xuất hoặc kho', '<a class="btn pri" href="#/units">Thêm khu</a>');
    const tid = (arg && targets.find(t => t.id === arg)) ? arg : targets[0].id;
    const tg = targetOf(tid), r = latest(tid), ps = Object.keys(tg.env).length ? Object.keys(tg.env) : (r ? Object.keys(PARAMS).filter(p => r[p] != null) : []);
    if (!ps.includes(UI.envP)) UI.envP = ps[0];
    const p = UI.envP, from = Date.now() - 3 * DAY;
    const pts = p ? S.readings.filter(x => x.tid === tid && x.ts >= from && x[p] != null).map(x => [x.ts, x[p]]) : [];
    const devs = S.devices.filter(d => d.tid === tid), rules = S.rules.filter(x => x.tid === tid);
    const c = compliance(tid);
    return `<div class="toolbar"><select data-chg="envT" aria-label="Chọn khu/kho">${targets.map(t => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
      <span class="grow muted" style="font-size:13px">${esc(tg.sub)}${c != null ? ` · Tuân thủ 24h: <b class="${c >= .9 ? 't-ok' : 't-warn'}">${pct(c, 0)}</b>` : ''}</span>
      <button class="btn" data-act="manualReading" data-id="${tid}">✍️ Nhập số đo</button><button class="btn pri" data-act="simNow">📡 Đọc cảm biến</button></div>
    ${ps.length ? `<div class="grid g4">${ps.map(k => { const v = r && r[k], rg = tg.env[k], ok = v == null || !rg || inRange(v, rg); return `<button class="card sensor ${v == null ? '' : ok ? 'ok' : 'bad'}" data-act="envP" data-k="${k}" style="cursor:pointer;font:inherit;color:inherit;${k === p ? 'outline:2px solid var(--primary)' : ''}"><div class="muted" style="font-size:13px">${PARAMS[k].n}</div><div class="v">${v == null ? '—' : nf(v, PARAMS[k].d)} <small class="muted" style="font-size:13px">${PARAMS[k].u}</small></div><small class="${ok ? 'muted' : 't-bad'}">${rg ? 'Ngưỡng ' + esc(rangeTxt(k, rg)) : ''}</small></button>`; }).join('')}</div>
    <div class="card sec"><div class="card-head"><h3>${p ? PARAMS[p].n : ''} – 72 giờ qua</h3>${r ? `<small class="muted">Cập nhật ${fdt(r.ts)}</small>` : ''}</div>${lineChart([{ name: p ? PARAMS[p].n : '', color: 'var(--chart-2)', pts }], { band: tg.env[p], label: 'Diễn biến ' + (p ? PARAMS[p].n : '') })}</div>` : alertHtml({ lv: 'info', msg: 'Khu đang ở giai đoạn chuẩn bị hoặc chưa có lứa/vụ — chưa có ngưỡng môi trường để giám sát.' })}
    <div class="grid g2 sec">
      <div class="card"><div class="card-head"><h3>Thiết bị điều khiển (${devs.length})</h3><button class="btn sm" data-act="newDevice" data-id="${tid}">＋ Thiết bị</button></div>
        <div class="grid" style="gap:8px">${devs.map(d => `<div class="device ${d.on ? 'on' : ''}"><span class="ic">${DEVICE_KINDS[d.kind].icon}</span><div class="grow"><b>${esc(d.name)}</b><br><small class="muted">${DEVICE_KINDS[d.kind].n} · <a href="#" data-act="devAuto" data-id="${d.id}">${d.auto ? '🤖 Tự động' : '✋ Thủ công'}</a></small></div><label class="switch" aria-label="Bật/tắt ${esc(d.name)}"><input type="checkbox" data-chg="dev" data-id="${d.id}" ${d.on ? 'checked' : ''}><span></span></label>${delBtn('devices', d.id)}</div>`).join('') || empty('Chưa có thiết bị')}</div></div>
      <div class="card"><div class="card-head"><h3>Quy tắc tự động hóa (${rules.length})</h3><button class="btn sm" data-act="newRule" data-id="${tid}">＋ Quy tắc</button></div>
        ${tbl(['Nếu', 'Thì', 'Bật', ''], rules.map(x => { const d = get('devices', x.dev); return `<tr><td>${PARAMS[x.p].n} ${x.op} ${nf(x.v, 2)} ${PARAMS[x.p].u}</td><td>${x.act === 'on' ? 'BẬT' : 'TẮT'} ${esc(d ? d.name : '?')}</td><td><label class="switch"><input type="checkbox" data-chg="rule" data-id="${x.id}" ${x.en ? 'checked' : ''}><span></span></label></td><td>${acts(delBtn('rules', x.id))}</td></tr>`; }), 'Chưa có quy tắc')}</div>
    </div>
    <div class="card sec"><div class="card-head"><h3>Nhật ký điều khiển IoT</h3><small class="muted">Bật "IoT trực tuyến" ở thanh trên để mô phỏng cảm biến gửi dữ liệu mỗi 10 giây</small></div>
      <div class="log">${S.iotLog.slice().reverse().slice(0, 40).map(l => `<div><small class="muted">${fdt(l.ts)}</small> ${esc(l.msg)}</div>`).join('') || '<div class="muted">Chưa có sự kiện</div>'}</div></div>`;
  }
};

VIEWS.harvest = {
  title: 'Thu hoạch & bảo quản',
  render() {
    const tb = UI.htab;
    const lots = S.lots.filter(l => UI.lotAll || l.remain > 0);
    const stock = S.lots.filter(l => l.remain > 0);
    const byProd = {};
    for (const l of stock) { const k = l.product + '|' + l.unit; byProd[k] = (byProd[k] || 0) + l.remain; }
    return `<div class="toolbar"><div class="tabs" style="margin:0;border:0">${[['lots', 'Lô sản phẩm'], ['store', 'Kho bảo quản']].map(([k, l]) => `<button class="${tb === k ? 'on' : ''}" data-act="htab" data-k="${k}">${l}</button>`).join('')}</div><span class="grow"></span>${tb === 'lots' ? `<button class="btn pri" data-act="newHarvest">＋ Thu hoạch</button>` : `<button class="btn pri" data-act="newStorage">＋ Thêm kho</button>`}</div>
    ${UI.lastLot ? alertHtml({ lv: 'ok', ic: '🏷️', html: `Đã tạo lô <b><code>${esc(UI.lastLot)}</code></b>. <a href="#/trace/${encodeURIComponent(UI.lastLot)}">In tem truy xuất</a>` }) : ''}
    ${tb === 'lots' ? `<div class="grid g4">${Object.entries(byProd).map(([k, v]) => { const [p, u] = k.split('|'); return `<div class="card kpi"><span class="l">${esc(p)}</span><span class="v">${nf(v, 1)}</span><span class="s muted">${esc(u)} tồn kho</span></div>`; }).join('') || '<div class="card muted">Không có tồn kho thành phẩm</div>'}</div>
      <div class="card sec"><div class="card-head"><h3>Lô sản phẩm</h3><label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-chg="lotAll" ${UI.lotAll ? 'checked' : ''}> Hiện cả lô đã xuất hết</label></div>${lotTable(lots)}</div>`
    : `<div class="grid g3">${S.storages.map(s => { const p = STORAGE_PROFILES[s.profile], ls = stock.filter(l => l.storageId === s.id), r = latest(s.id); return `<div class="card"><div class="card-head"><div><b>❄️ ${esc(s.name)}</b><br><small class="muted">${esc(p.n)}</small></div>${acts(editBtn('editStorage', s.id), delBtn('storages', s.id))}</div>
        <p style="margin:0 0 6px;font-size:13px">Chuẩn: ${esc(rangeTxt('temp', p.env.temp))}, ẩm ${p.env.rh[0]}–${p.env.rh[1]}% · thời hạn ~${p.life} ngày</p>${envChips(s.id, p.env)}
        ${r ? `<small class="muted">Đo lúc ${fdt(r.ts)}</small>` : ''}
        <p class="muted" style="font-size:13px">${esc(p.note)}</p>
        <b style="font-size:14px">${ls.length} lô tồn:</b> <small>${ls.map(l => `${esc(l.product)} ${nf(l.remain, 1)} ${esc(l.unit)}`).join(' · ') || '—'}</small>
        <div style="margin-top:10px;display:flex;gap:6px"><button class="btn sm" data-act="manualReading" data-id="${s.id}">✍️ Ghi nhiệt ẩm</button><a class="btn sm" href="#/env/${s.id}">📡 Giám sát</a></div></div>`; }).join('')}</div>${S.storages.length ? '' : empty('Chưa có kho bảo quản')}`}`;
  }
};

VIEWS.trace = {
  title: 'Truy xuất nguồn gốc',
  render(arg) {
    const code = (arg || UI.trace || '').trim().toUpperCase();
    const l = code && S.lots.find(x => x.code.toUpperCase() === code);
    let body = '';
    if (code && !l) body = alertHtml({ lv: 'bad', msg: `Không tìm thấy lô "${code}"` });
    if (l) {
      const b = get('batches', l.batchId), sop = sopOf(b), u = get('units', l.unitId) || {}, st = get('storages', l.storageId);
      const logs = S.logs.filter(x => x.batchId === l.batchId && x.date <= l.date && (x.itemId || x.phi)).sort((a, c) => a.date.localeCompare(c.date));
      const phi = S.logs.filter(x => x.batchId === l.batchId && x.phi > 0 && x.date <= l.date).map(x => addDays(x.date, x.phi)).sort().pop();
      const phiOk = !phi || phi <= l.date;
      const tStart = new Date(b.start + 'T00:00:00').getTime(), tEnd = new Date(l.date + 'T23:59:59').getTime();
      let ok = 0, n = 0;
      for (const r of S.readings) if (r.tid === l.unitId && r.ts >= tStart && r.ts <= tEnd) { const e = stageOf(sop, diffDays(b.start, iso(r.ts))).env; for (const [p, rg] of Object.entries(e)) if (r[p] != null) { n++; if (inRange(r[p], rg)) ok++; } }
      const vacc = S.tasks.filter(x => x.batchId === b.id && x.cat === 'tv' && x.done && x.date <= l.date);
      body = `<div class="card label-print" style="max-width:none">
        <div class="card-head"><div><small class="muted">MÃ LÔ TRUY XUẤT</small><div class="code">${esc(l.code)}</div></div><button class="btn no-print" data-act="print">🖨 In tem / hồ sơ</button></div>
        <div class="grid g2">
          <div><h3>Sản phẩm</h3><table><tr><td>Tên</td><td><b>${esc(l.product)}</b> · ${esc(l.grade)}</td></tr><tr><td>Ngày thu hoạch</td><td>${fd(l.date)}</td></tr><tr><td>Sản lượng lô</td><td>${nf(l.qty, 1)} ${esc(l.unit)}</td></tr><tr><td>Hạn bảo quản</td><td>${fd(l.expiry)}</td></tr><tr><td>Bảo quản</td><td>${st ? esc(st.name) + ' – ' + esc(STORAGE_PROFILES[st.profile].n) : 'Bán ngay'}</td></tr></table></div>
          <div><h3>Cơ sở sản xuất</h3><table><tr><td>Trang trại</td><td><b>${esc(S.farm.name)}</b></td></tr><tr><td>Địa chỉ</td><td>${esc(S.farm.address || '—')}</td></tr><tr><td>Liên hệ</td><td>${esc(S.farm.phone || '—')}</td></tr><tr><td>Khu sản xuất</td><td>${esc(u.name || '')}</td></tr><tr><td>Lứa / vụ</td><td>${esc(b.name)} (bắt đầu ${fd(b.start)})</td></tr><tr><td>Quy trình</td><td>${esc(sop.name)}<br><small>${esc(sop.std)}</small></td></tr>${b.source ? `<tr><td>Nguồn giống</td><td>${esc(b.source)}</td></tr>` : ''}</table></div>
        </div>
        <h3 class="sec">Đánh giá tuân thủ</h3>
        <div class="grid g3" style="margin-top:8px">
          <div class="alert ${phiOk ? 'ok' : 'bad'}"><span class="ic">${phiOk ? '✅' : '⛔'}</span><div>Thời gian cách ly/ngừng thuốc: ${phiOk ? 'ĐẠT' : 'KHÔNG ĐẠT (hết cách ly ' + fd(phi) + ')'}</div></div>
          <div class="alert ${n && ok / n >= .85 ? 'ok' : 'warn'}"><span class="ic">📡</span><div>Môi trường trong ngưỡng: ${n ? pct(ok / n, 0) + ' của ' + nf(n) + ' số đo' : 'không có dữ liệu'}</div></div>
          <div class="alert info"><span class="ic">🗓️</span><div>${S.tasks.filter(x => x.batchId === b.id && x.done && x.date <= l.date).length} công việc quy trình đã hoàn thành${vacc.length ? ', ' + vacc.length + ' mốc thú y' : ''}</div></div>
        </div>
        <h3 class="sec">Vật tư đầu vào sử dụng</h3>${tbl(['Ngày', 'Hoạt động', 'Vật tư', ['Số lượng', 'r'], 'Cách ly'], logs.map(x => { const it = get('inventory', x.itemId); return `<tr><td>${fd(x.date)}</td><td>${esc(LOG_TYPES[x.type].n)}</td><td>${esc(it ? it.name : '')}</td><td class="r num">${x.qty ? nf(x.qty, 2) + ' ' + esc(it ? it.unit : '') : ''}</td><td>${x.phi ? x.phi + ' ngày' : ''}</td></tr>`; }), 'Không ghi nhận vật tư đầu vào')}
        <h3 class="sec">Phân phối</h3>${tbl(['Ngày', 'Hình thức', ['Số lượng', 'r'], 'Nơi nhận / lý do'], l.moves.map(m => `<tr><td>${fd(m.date)}</td><td>${({ sale: 'Xuất bán', loss: 'Hao hụt', deliver: 'Giao khách thuê' })[m.type] || m.type}</td><td class="r num">${nf(m.qty, 1)} ${esc(l.unit)}</td><td>${esc(m.buyer || m.note)}</td></tr>`), 'Chưa xuất kho')}
      </div>`;
    }
    const recent = S.lots.slice().sort((a, c) => c.date.localeCompare(a.date)).slice(0, 12);
    return `<div class="toolbar no-print"><input id="traceInput" placeholder="Nhập mã lô, VD: DHT-NM260918-ABC" value="${esc(code)}" style="flex:1;min-width:220px"><button class="btn pri" data-act="traceGo">🔎 Tra cứu</button></div>
    ${body}
    <div class="card sec no-print"><h3 style="margin-bottom:8px">Lô gần đây</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${recent.map(x => `<a class="btn sm" href="#/trace/${encodeURIComponent(x.code)}"><code>${esc(x.code)}</code></a>`).join('') || '<span class="muted">Chưa có lô</span>'}</div></div>`;
  }
};

VIEWS.inventory = {
  title: 'Kho vật tư',
  render() {
    const q = UI.inQ.toLowerCase(), c = UI.inCat, t = today();
    const items = S.inventory.filter(i => (!c || i.cat === c) && (!q || i.name.toLowerCase().includes(q)));
    const val = sum(S.inventory, i => i.qty * (i.price || 0)), low = S.inventory.filter(i => i.qty <= i.min).length;
    const exp = S.inventory.filter(i => i.expiry && i.qty > 0 && diffDays(t, i.expiry) <= 30).length;
    const tb = UI.itab;
    return `<div class="grid g4"><div class="card kpi"><span class="l">Mặt hàng</span><span class="v">${S.inventory.length}</span></div><div class="card kpi"><span class="l">Giá trị tồn</span><span class="v">${short(val)}</span></div><div class="card kpi"><span class="l">Dưới mức tối thiểu</span><span class="v ${low ? 't-bad' : 't-ok'}">${low}</span></div><div class="card kpi"><span class="l">Hết hạn ≤ 30 ngày</span><span class="v ${exp ? 't-warn' : 't-ok'}">${exp}</span></div></div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0">${[['stock', 'Tồn kho'], ['tx', 'Nhập – xuất']].map(([k, l]) => `<button class="${tb === k ? 'on' : ''}" data-act="itab" data-k="${k}">${l}</button>`).join('')}</div>
      ${tb === 'stock' ? `<select data-chg="ui" data-k="inCat"><option value="">Tất cả nhóm</option>${INV_CATS.map(x => `<option ${x === c ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><input data-inp="inQ" placeholder="Tìm vật tư…" value="${esc(UI.inQ)}">` : ''}<span class="grow"></span><button class="btn pri" data-act="newItem">＋ Vật tư</button></div>
    <div class="card">${tb === 'stock' ? tbl(['Vật tư', 'Nhóm', ['Tồn', 'r'], ['Tối thiểu', 'r'], 'Hạn dùng', ['Giá trị', 'r'], ''], items.map(i => {
      const dl = i.expiry ? diffDays(t, i.expiry) : null;
      return `<tr><td><b>${esc(i.name)}</b>${i.supplier ? `<br><small class="muted">${esc(i.supplier)}</small>` : ''}</td><td><small>${esc(i.cat)}</small></td><td class="r num ${i.qty <= i.min ? 't-bad' : ''}">${nf(i.qty, 1)} ${esc(i.unit)}</td><td class="r num">${nf(i.min)}</td><td>${i.expiry ? (dl < 0 ? badge('Hết hạn', 'b-bad') : dl <= 30 ? badge(fd(i.expiry), 'b-warn') : fd(i.expiry)) : '—'}</td><td class="r num">${short(i.qty * (i.price || 0))}</td>
      <td>${acts(`<button class="btn sm" data-act="txIn" data-id="${i.id}">＋ Nhập</button>`, `<button class="btn sm" data-act="txOut" data-id="${i.id}">− Xuất</button>`, editBtn('editItem', i.id), delBtn('inventory', i.id))}</td></tr>`;
    }), 'Không có vật tư') : tbl(['Ngày', 'Loại', 'Vật tư', ['Số lượng', 'r'], 'Lứa/vụ', 'Ghi chú'], S.invTx.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200).map(x => { const i = get('inventory', x.itemId) || {}, b = get('batches', x.batchId); return `<tr><td>${fd(x.date)}</td><td>${x.type === 'in' ? badge('Nhập', 'b-ok') : badge('Xuất', 'b-warn')}</td><td>${esc(i.name || '(đã xóa)')}</td><td class="r num">${nf(x.qty, 2)} ${esc(i.unit || '')}</td><td>${b ? esc(b.name) : ''}</td><td><small>${esc(x.note)}</small></td></tr>`; }), 'Chưa có giao dịch kho')}</div>`;
  }
};

VIEWS.equip = {
  title: 'Máy móc – cơ giới hóa',
  render() {
    const t = today();
    const val = sum(S.equip, e => e.value || 0), due = S.equip.filter(e => e.interval && e.lastService && addDays(e.lastService, e.interval) <= t).length;
    return `<div class="grid g4"><div class="card kpi"><span class="l">Máy móc – thiết bị</span><span class="v">${S.equip.length}</span></div><div class="card kpi"><span class="l">Đang hoạt động</span><span class="v t-ok">${S.equip.filter(e => e.status === 'Hoạt động').length}</span></div><div class="card kpi"><span class="l">Đến hạn bảo dưỡng</span><span class="v ${due ? 't-warn' : 't-ok'}">${due}</span></div><div class="card kpi"><span class="l">Giá trị đầu tư</span><span class="v">${short(val)}</span></div></div>
    <div class="toolbar sec"><span class="grow muted">Bảo dưỡng phòng ngừa theo chu kỳ giúp giảm hỏng hóc đột xuất trong mùa vụ.</span><button class="btn pri" data-act="newEquip">＋ Thêm máy</button></div>
    <div class="card">${tbl(['Máy / thiết bị', 'Nhóm', 'Khu', 'Bảo dưỡng cuối', 'Lần tới', 'Tình trạng', ''], S.equip.map(e => {
      const nx = e.interval && e.lastService ? addDays(e.lastService, e.interval) : null, dl = nx ? diffDays(t, nx) : null, u = get('units', e.unitId);
      const cls = { 'Hoạt động': 'b-ok', 'Bảo dưỡng': 'b-warn', 'Hỏng': 'b-bad' }[e.status] || '';
      return `<tr><td><b>${esc(e.name)}</b>${e.note ? `<br><small class="muted">${esc(e.note)}</small>` : ''}</td><td><small>${esc(e.kind)}</small></td><td>${esc(u ? u.name : 'Chung')}</td><td>${fd(e.lastService)}</td><td>${nx ? (dl <= 0 ? badge('Đến hạn ' + fd(nx), 'b-warn') : fd(nx) + ` <small class="muted">(${dl} ngày)</small>`) : '—'}</td><td>${badge(e.status, cls)}</td><td>${acts(`<button class="btn sm" data-act="service" data-id="${e.id}">🔧 Đã bảo dưỡng</button>`, editBtn('editEquip', e.id), delBtn('equip', e.id))}</td></tr>`;
    }), 'Chưa có máy móc')}</div>`;
  }
};

VIEWS.staff = {
  title: 'Nhân sự',
  render() {
    const t = today();
    return `<div class="toolbar"><span class="grow muted">Phân công công việc tự động theo chuyên môn (chăn nuôi / trồng trọt – nấm / kho – sơ chế).</span><button class="btn pri" data-act="newStaff">＋ Thêm nhân sự</button></div>
    <div class="card">${tbl(['Họ tên', 'Vị trí', 'Điện thoại', ['Việc hôm nay', 'r'], ['Quá hạn', 'r'], ''], S.staff.map(s => {
      const mine = S.tasks.filter(x => x.assignee === s.id && !x.done);
      return `<tr><td><b>${esc(s.name)}</b>${s.note ? `<br><small class="muted">${esc(s.note)}</small>` : ''}</td><td>${esc(s.role)}</td><td>${s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : ''}</td><td class="r num">${mine.filter(x => x.date === t).length}</td><td class="r num ${mine.some(x => x.date < t) ? 't-bad' : ''}">${mine.filter(x => x.date < t).length}</td><td>${acts(editBtn('editStaff', s.id), delBtn('staff', s.id))}</td></tr>`;
    }), 'Chưa có nhân sự')}</div>`;
  }
};

VIEWS.finance = {
  title: 'Tài chính',
  render() {
    const y = today().slice(0, 4), fy = S.fin.filter(f => f.date.startsWith(y));
    const inc = sum(fy.filter(f => f.type === 'in'), f => f.amount), exp = sum(fy.filter(f => f.type === 'out'), f => f.amount);
    const months = [...new Set(S.fin.map(f => f.date.slice(0, 7)))].sort().reverse();
    const m = UI.finM, list = S.fin.filter(f => !m || f.date.startsWith(m)).sort((a, b) => b.date.localeCompare(a.date));
    const cats = {}; for (const f of fy.filter(f => f.type === 'out')) cats[f.cat] = (cats[f.cat] || 0) + f.amount;
    const catMax = Math.max(1, ...Object.values(cats));
    return `<div class="grid g4"><div class="card kpi"><span class="l">Doanh thu ${y}</span><span class="v t-ok">${short(inc)}</span></div><div class="card kpi"><span class="l">Chi phí ${y}</span><span class="v">${short(exp)}</span></div><div class="card kpi"><span class="l">Lợi nhuận ${y}</span><span class="v ${inc - exp >= 0 ? 't-ok' : 't-bad'}">${short(inc - exp)}</span></div><div class="card kpi"><span class="l">Biên lợi nhuận</span><span class="v">${inc ? pct((inc - exp) / inc, 0) : '—'}</span></div></div>
    <div class="grid g2 sec"><div class="card"><h3>Thu – chi 12 tháng</h3>${finChart(12)}</div>
      <div class="card"><h3 style="margin-bottom:10px">Cơ cấu chi phí ${y}</h3>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(k)}</span><span class="num">${short(v)} · ${pct(v / exp, 0)}</span></div><div class="prog"><i style="width:${(v / catMax * 100).toFixed(0)}%;background:var(--chart-3)"></i></div></div>`).join('') || empty('Chưa có chi phí')}</div></div>
    <div class="card sec"><h3 style="margin-bottom:8px">Hiệu quả theo lứa / vụ</h3>${tbl(['Lứa / vụ', ['Doanh thu', 'r'], ['Chi phí trực tiếp', 'r'], ['Vật tư xuất dùng', 'r'], ['Lãi / lỗ', 'r'], ['Giá thành', 'r']], S.batches.map(b => { const s = batchStats(b); return `<tr><td>${FARM_TYPES[s.sop.type].icon} <a href="#/batch/${b.id}">${esc(b.name)}</a></td><td class="r num">${short(s.rev)}</td><td class="r num">${short(s.cost)}</td><td class="r num">${short(s.matCost)}</td><td class="r num ${s.profit >= 0 ? 't-ok' : 't-bad'}">${short(s.profit)}</td><td class="r num">${s.harvested ? money((s.cost + s.matCost) / s.harvested) + '/' + esc(s.sop.harvest.unit) : '—'}</td></tr>`; }), 'Chưa có lứa/vụ')}</div>
    <div class="toolbar sec"><select data-chg="ui" data-k="finM"><option value="">Tất cả tháng</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>Tháng ${x.slice(5)}/${x.slice(0, 4)}</option>`).join('')}</select><span class="grow"></span><button class="btn pri" data-act="newFin">＋ Thu / chi</button></div>
    <div class="card">${finTable(list)}</div>`;
  }
};

VIEWS.advisor = {
  title: 'Cố vấn thông minh',
  render() {
    const I = insights(), ty = UI.advType, list = DIAG[ty];
    const sel = list.filter((x, i) => UI.symp.has(ty + i));
    return `<div class="card"><div class="card-head"><h2>🧠 Phân tích tự động từ dữ liệu trang trại</h2><small class="muted">Cập nhật theo thời gian thực</small></div>
      ${I.map(x => alertHtml({ lv: x.lv, html: x.msg })).join('') || empty('Chưa đủ dữ liệu để phân tích')}</div>
    <div class="grid g2 sec">
      <div class="card"><h2 style="margin-bottom:8px">Chẩn đoán theo triệu chứng</h2>
        <div class="tabs">${Object.entries(FARM_TYPES).map(([k, v]) => `<button class="${ty === k ? 'on' : ''}" data-act="advType" data-k="${k}">${v.icon} ${v.n}</button>`).join('')}</div>
        ${list.map((x, i) => `<label class="symp"><input type="checkbox" data-chg="symp" data-k="${ty + i}" ${UI.symp.has(ty + i) ? 'checked' : ''}><span>${esc(x.s)}</span></label>`).join('')}
      </div>
      <div class="card"><h2 style="margin-bottom:8px">Kết luận & hướng xử lý</h2>
        ${sel.length ? sel.map(x => alertHtml({ lv: x.lv, html: `<b>${esc(x.c)}</b><br>${esc(x.a)}` })).join('') : '<p class="muted">Chọn các triệu chứng quan sát được ở bên trái.</p>'}
        <p class="muted" style="font-size:12px">Kết quả mang tính tham khảo kỹ thuật. Với dấu hiệu dịch bệnh nguy hiểm (cúm gia cầm, Newcastle…) phải báo ngay cơ quan thú y địa phương; sử dụng thuốc theo chỉ định của cán bộ thú y/BVTV.</p>
      </div>
    </div>
    <h2 class="sec">Công cụ tính toán kỹ thuật</h2>
    <div class="grid g2" style="margin-top:12px">
      <div class="card" data-calc="dens"><h3>Mật độ & sức chứa</h3>
        <div class="form-grid" style="margin-top:10px"><label class="f"><span>Quy trình</span><select data-inp="calc">${SOPS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label class="f"><span>Diện tích (m²)</span><input type="number" data-inp="calc" value="300"></label></div><div class="out"></div></div>
      <div class="card" data-calc="feed"><h3>Dự báo thức ăn gà thịt đến xuất bán</h3>
        <div class="form-grid" style="margin-top:10px"><label class="f"><span>Số gà hiện có</span><input type="number" data-inp="calc" value="2500"></label><label class="f"><span>Ngày tuổi hiện tại</span><input type="number" data-inp="calc" value="35"></label><label class="f"><span>Ngày xuất bán</span><input type="number" data-inp="calc" value="90"></label><label class="f"><span>Giá thức ăn (₫/kg)</span><input type="number" data-inp="calc" value="12500"></label></div><div class="out"></div></div>
      <div class="card" data-calc="mix"><h3>Pha dung dịch (sát trùng, thuốc, dinh dưỡng)</h3>
        <div class="form-grid" style="margin-top:10px"><label class="f"><span>Nồng độ gốc (%)</span><input type="number" data-inp="calc" value="10"></label><label class="f"><span>Nồng độ cần pha (%)</span><input type="number" data-inp="calc" value="0.5"></label><label class="f"><span>Thể tích cần pha (lít)</span><input type="number" data-inp="calc" value="16"></label></div><div class="out"></div></div>
      <div class="card" data-calc="be"><h3>Hiệu suất sinh học nấm (BE)</h3>
        <div class="form-grid" style="margin-top:10px"><label class="f"><span>Số bịch</span><input type="number" data-inp="calc" value="5000"></label><label class="f"><span>Khối lượng bịch (kg)</span><input type="number" data-inp="calc" value="1.2"></label><label class="f"><span>Độ ẩm giá thể (%)</span><input type="number" data-inp="calc" value="62"></label><label class="f"><span>Tổng nấm tươi thu (kg)</span><input type="number" data-inp="calc" value="1650"></label></div><div class="out"></div></div>
    </div>`;
  },
  after() { document.querySelectorAll('[data-calc]').forEach(calc); }
};
function calc(card) {
  const v = [...card.querySelectorAll('[data-inp]')].map(x => x.tagName === 'SELECT' ? x.value : parseFloat(x.value) || 0), out = card.querySelector('.out');
  let h = '';
  if (card.dataset.calc === 'dens') {
    const s = SOPS.find(x => x.id === v[0]), d = DENSITY[v[0]];
    h = `Khuyến cáo <b>${d[0]}–${d[1]} ${esc(d[2])}</b> → quy mô <b>${nf(v[1] * d[0])} – ${nf(v[1] * d[1])} ${esc(s.qtyUnit)}</b>.`;
  } else if (card.dataset.calc === 'feed') {
    let kg = 0; for (let d = v[1]; d < v[2]; d++) kg += v[0] * intake(d) / 1000;
    h = `Cần khoảng <b>${nf(kg)} kg</b> thức ăn (${nf(kg / 25)} bao 25 kg), chi phí ~<b>${money(kg * v[3])}</b>. Hiện ăn ${nf(intake(v[1]))} g/con/ngày.`;
  } else if (card.dataset.calc === 'mix') {
    const ml = v[0] > 0 ? v[1] * v[2] * 1000 / v[0] : 0;
    h = v[1] >= v[0] ? '<span class="t-bad">Nồng độ cần pha phải nhỏ hơn nồng độ gốc.</span>' : `Lấy <b>${nf(ml)} ml</b> dung dịch gốc, thêm nước sạch đến đủ <b>${nf(v[2], 1)} lít</b>.`;
  } else if (card.dataset.calc === 'be') {
    const dry = v[0] * v[1] * (1 - v[2] / 100), be = dry ? v[3] / dry : 0;
    h = `Khối lượng giá thể khô ${nf(dry)} kg → BE = <b class="${be >= .6 ? 't-ok' : 't-warn'}">${pct(be, 0)}</b> (${be >= .8 ? 'rất tốt' : be >= .6 ? 'đạt' : 'thấp – xem lại giống, giá thể, chăm sóc'}). Năng suất ${nf(v[3] / Math.max(v[0], 1), 3)} kg/bịch.`;
  }
  out.innerHTML = `<div class="alert info" style="margin:0"><div>${h}</div></div>`;
}

VIEWS.sop = {
  title: 'Quy trình chuẩn',
  render() {
    const s = SOPS.find(x => x.id === UI.sop);
    if (s) {
      return `<div class="toolbar"><button class="btn" data-act="sopBack">← Tất cả quy trình</button><span class="grow"></span><button class="btn pri" data-act="newBatch" data-sop="${s.id}">＋ Tạo lứa/vụ theo quy trình này</button></div>
      <div class="card"><div class="sop-h"><span class="ico">${FARM_TYPES[s.type].icon}</span><div><h2>${esc(s.name)}</h2><small class="muted">${esc(s.std)} · ${s.duration} ngày · đơn vị ${esc(s.qtyUnit)}</small></div></div><p>${esc(s.desc)}</p>
        <h3 class="sec">Giai đoạn & ngưỡng môi trường</h3>${tbl(['Giai đoạn', 'Ngày', 'Ngưỡng tối ưu', 'Lưu ý kỹ thuật'], s.stages.map(x => `<tr><td><b>${esc(x.n)}</b></td><td class="num">${x.f} → ${x.t}</td><td><small>${Object.entries(x.env).map(([p, r]) => `${PARAMS[p].n}: ${esc(rangeTxt(p, r))}`).join('<br>') || '—'}</small></td><td><small>${esc(x.tip)}</small></td></tr>`))}
        <h3 class="sec">Lịch công việc theo mốc</h3>${tbl(['Ngày', 'Công việc', 'Nhóm'], s.tasks.map(x => `<tr><td class="num">${x[0]}${x[3] ? ` → ${x[4]} <small class="muted">(mỗi ${x[3]} ngày)</small>` : ''}</td><td>${esc(x[1])}</td><td>${catTag(x[2])}</td></tr>`))}
        <div class="grid g3 sec">
          <div><h3>Việc thường nhật</h3><ul class="clean">${s.daily.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h3>Chỉ tiêu kinh tế – kỹ thuật</h3><ul class="clean">${s.kpi.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h3>Sơ chế – bảo quản</h3><ul class="clean">${s.post.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted" style="font-size:13px">Kho: ${esc(STORAGE_PROFILES[s.harvest.storage].n)}</p></div>
        </div></div>`;
    }
    return `<p class="muted" style="margin-top:0">Thư viện quy trình kỹ thuật chuẩn — nền tảng để hệ thống tự lập lịch công việc, đặt ngưỡng cảnh báo môi trường, kiểm soát thời gian cách ly và truy xuất nguồn gốc.</p>
    ${Object.entries(FARM_TYPES).map(([k, t]) => `<h2 class="sec" style="margin-bottom:10px">${t.icon} ${t.n}</h2><div class="grid g3">${SOPS.filter(s => s.type === k).map(s => `<button class="card batch" data-act="openSop" data-k="${s.id}" style="text-align:left;font:inherit;color:inherit"><b>${esc(s.name)}</b><small class="muted">${esc(s.std)} · ${s.duration} ngày · ${s.stages.length} giai đoạn · ${s.tasks.length} mốc việc</small><small>${esc(s.desc)}</small></button>`).join('')}</div>`).join('')}
    <div class="card sec"><h2 style="margin-bottom:8px">Chế độ kho bảo quản sau thu hoạch</h2>${tbl(['Chế độ', 'Nhiệt độ', 'Ẩm độ', ['Thời hạn', 'r'], 'Lưu ý'], Object.values(STORAGE_PROFILES).map(p => `<tr><td><b>${esc(p.n)}</b></td><td>${esc(rangeTxt('temp', p.env.temp))}</td><td>${p.env.rh[0]}–${p.env.rh[1]}%</td><td class="r">${p.life} ngày</td><td><small>${esc(p.note)}</small></td></tr>`))}</div>
    <div class="card sec"><h2 style="margin-bottom:8px">Nguyên tắc vận hành trang trại khép kín</h2><ul class="clean">
      <li><b>An toàn sinh học:</b> "cùng vào – cùng ra" theo lứa; hố sát trùng, thay bảo hộ khi vào khu; để trống chuồng/nhà nuôi sau mỗi lứa.</li>
      <li><b>Tuần hoàn chất thải:</b> phân gia cầm + phôi nấm đã thu → ủ vi sinh (Trichoderma) → phân hữu cơ cho rau, dược liệu; nước thải qua biogas/hồ lắng.</li>
      <li><b>IPM:</b> ưu tiên biện pháp canh tác, sinh học (bẫy dính, lưới chắn, Bt, Trichoderma); thuốc hóa học là lựa chọn cuối cùng, trong danh mục và đúng PHI.</li>
      <li><b>Ghi chép:</b> nhật ký vật tư đầu vào, thu hoạch, bảo quản, tiêu thụ lưu tối thiểu 2 năm (VietGAP) — hệ thống tự liên kết thành hồ sơ truy xuất.</li>
      <li><b>Chuỗi lạnh:</b> làm lạnh sơ bộ ngay sau thu hoạch, giám sát nhiệt ẩm kho liên tục, xuất kho FIFO/FEFO.</li>
    </ul></div>`;
  }
};

VIEWS.settings = {
  title: 'Cài đặt & sao lưu',
  render() {
    const f = S.farm, kb = (() => { try { return (JSON.stringify(S).length / 1024).toFixed(0); } catch (e) { return '?'; } })();
    return `<div class="grid g2">
      <div class="card"><h2 style="margin-bottom:12px">Thông tin trang trại</h2>
        <form id="farmForm"><label class="f"><span>Tên trang trại</span><input name="name" value="${esc(f.name)}"></label>
        <label class="f"><span>Chủ trang trại / đơn vị</span><input name="owner" value="${esc(f.owner)}"></label>
        <label class="f"><span>Địa chỉ</span><input name="address" value="${esc(f.address)}"></label>
        <div class="form-grid"><label class="f"><span>Điện thoại</span><input name="phone" value="${esc(f.phone)}"></label><label class="f"><span>Tiền tố mã lô (truy xuất)</span><input name="code" value="${esc(f.code)}" maxlength="6"></label></div>
        <div class="form-actions"><button class="btn pri">Lưu thông tin</button></div></form></div>
      <div class="card"><h2 style="margin-bottom:12px">Dữ liệu</h2>
        <p class="muted" style="margin-top:0">Toàn bộ dữ liệu lưu trên thiết bị này (${kb} KB). Ứng dụng hoạt động offline; nên xuất bản sao lưu định kỳ.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" data-act="export">⬇️ Xuất sao lưu (JSON)</button><label class="btn">⬆️ Nhập sao lưu<input type="file" accept="application/json,.json" id="importFile" hidden></label></div>
        <h3 class="sec">Làm mới</h3><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn" data-act="resetDemo">↺ Nạp dữ liệu mẫu</button><button class="btn danger" data-act="wipe">🗑 Xóa toàn bộ, bắt đầu trống</button></div>
        <h3 class="sec">Cài như ứng dụng</h3><p class="muted" style="margin-top:4px">Trên điện thoại: mở trang bằng Chrome/Safari → "Thêm vào màn hình chính" để dùng như app, kể cả khi không có mạng.</p></div>
    </div>`;
  }
};

/* ============================ ĐIỀU HƯỚNG ============================ */
/* Mỗi phân hệ (module) có nhóm menu riêng; rent.js bổ sung các phân hệ khác */
const MODULES = [{ id: 'farm', n: 'Quản trị farm', icon: '🏭', groups: [
  ['Điều hành', [['dashboard', '📊', 'Tổng quan'], ['tasks', '🗓️', 'Lịch công việc'], ['advisor', '🧠', 'Cố vấn thông minh']]],
  ['Sản xuất', [['units', '🏡', 'Khu sản xuất'], ['batches', '🔄', 'Lứa nuôi / Vụ trồng'], ['env', '📡', 'Môi trường & IoT']]],
  ['Sau thu hoạch', [['harvest', '📦', 'Thu hoạch & bảo quản'], ['trace', '🔎', 'Truy xuất nguồn gốc']]],
  ['Nguồn lực', [['inventory', '🏬', 'Kho vật tư'], ['equip', '🚜', 'Máy móc – cơ giới hóa'], ['staff', '👷', 'Nhân sự'], ['finance', '💰', 'Tài chính']]],
  ['Tri thức & hệ thống', [['sop', '📚', 'Quy trình chuẩn'], ['settings', '⚙️', 'Cài đặt & sao lưu']]]
] }];
const NAV_BADGES = {
  dashboard: () => { const n = computeAlerts().length; return n ? `<span class="badge b-warn">${n}</span>` : ''; },
  tasks: () => { const n = S.tasks.filter(x => !x.done && x.date < today()).length; return n ? `<span class="badge b-bad">${n}</span>` : ''; }
};
const moduleOf = v => MODULES.find(m => m.groups.some(([, items]) => items.some(([k]) => k === v))) || MODULES[0];
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [v, ...rest] = h.split('/');
  return { v: VIEWS[v] ? v : 'dashboard', arg: rest.map(decodeURIComponent).join('/') };
}
let lastRoute = '';
function render() {
  const r = route(), V = VIEWS[r.v], key = r.v + '/' + r.arg, y = window.scrollY;
  document.title = (typeof V.title === 'function' ? V.title(r.arg) : V.title) + ' · DHT Smart Farm';
  $('#pageTitle').textContent = typeof V.title === 'function' ? V.title(r.arg) : V.title;
  $('#view').innerHTML = V.render(r.arg);
  if (V.after) V.after(r.arg);
  const cur = V.nav || r.v, mod = moduleOf(cur);
  $('#nav').innerHTML = `<div class="mods">${MODULES.map(m => `<a href="#/${m.groups[0][1][0][0]}" class="mod ${m === mod ? 'on' : ''}" title="${esc(m.n)}"><span>${m.icon}</span><small>${esc(m.n)}</small></a>`).join('')}</div>`
    + mod.groups.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([k, ic, l]) => `<a href="#/${k}" class="${k === cur ? 'on' : ''}"><span>${ic}</span>${l}${NAV_BADGES[k] ? NAV_BADGES[k]() : ''}</a>`).join('')).join('');
  $('#farmName').textContent = S.farm.name;
  if (key === lastRoute) window.scrollTo(0, y); else { window.scrollTo(0, 0); lastRoute = key; }
}

/* ============================ SỰ KIỆN ============================ */
const ACT = {
  closeModal, newUnit: () => unitForm(), editUnit: d => unitForm(d.id),
  newBatch: d => batchForm({ sopId: d.sop }),
  newLog: d => logForm(d.id), newHarvest: d => harvestForm(d.id),
  sell: d => lotMoveForm(d.id, 'sale'), loss: d => lotMoveForm(d.id, 'loss'),
  newStorage: () => storageForm(), editStorage: d => storageForm(d.id),
  manualReading: d => readingForm(d.id), newDevice: d => deviceForm(d.id), newRule: d => ruleForm(d.id),
  newItem: () => itemForm(), editItem: d => itemForm(d.id), txIn: d => txForm(d.id, 'in'), txOut: d => txForm(d.id, 'out'),
  newFin: d => finForm(null, d.batch ? { batchId: d.batch } : {}), editFin: d => finForm(d.id),
  newStaff: () => staffForm(), editStaff: d => staffForm(d.id),
  newEquip: () => equipForm(), editEquip: d => equipForm(d.id), service: d => serviceForm(d.id),
  newTask: () => { const r = route(); taskForm(); if (r.v === 'batch') { FORM.data.batchId = r.arg; drawForm(); } }, editTask: d => taskForm(d.id),
  btab: d => { UI.btab = d.k; render(); }, htab: d => { UI.htab = d.k; UI.lastLot = null; render(); }, itab: d => { UI.itab = d.k; render(); },
  envP: d => { UI.envP = d.k; render(); }, advType: d => { UI.advType = d.k; render(); },
  openSop: d => { UI.sop = d.k; render(); }, sopBack: () => { UI.sop = null; render(); },
  simNow: () => { simulateAll(); render(); toast('Đã đọc dữ liệu từ cảm biến'); },
  devAuto: d => { const x = get('devices', d.id); x.auto = !x.auto; save(); render(); },
  traceGo: () => { const v = $('#traceInput').value.trim().toUpperCase(); UI.trace = v; location.hash = '#/trace/' + encodeURIComponent(v); },
  print: () => window.print(),
  endBatch: d => {
    const b = get('batches', d.id), open = S.tasks.filter(x => x.batchId === b.id && !x.done).length;
    if (!confirm(`Kết thúc "${b.name}"?${open ? `\nCòn ${open} công việc chưa hoàn thành sẽ được đóng lại.` : ''}`)) return;
    b.status = 'done'; b.end = today(); S.tasks.filter(x => x.batchId === b.id && !x.done && x.date > today()).forEach(x => { x.skipped = true; x.done = true; });
    save(); render(); toast('Đã kết thúc lứa/vụ — khu sẵn sàng vệ sinh cho lứa mới');
  },
  reopenBatch: d => { const b = get('batches', d.id); b.status = 'active'; delete b.end; S.tasks.filter(x => x.batchId === b.id && x.skipped).forEach(x => { x.done = false; delete x.skipped; }); save(); render(); },
  del: d => {
    const coll = d.coll, x = get(coll, d.id);
    if (!x) return;
    if (coll === 'units' && S.batches.some(b => b.unitId === x.id)) return toast('Khu đã có lứa/vụ — không thể xóa');
    if (coll === 'storages' && S.lots.some(l => l.storageId === x.id && l.remain > 0)) return toast('Kho còn hàng tồn — không thể xóa');
    if (!confirm('Xóa mục này? Thao tác không thể hoàn tác.')) return;
    S[coll] = S[coll].filter(y => y.id !== x.id);
    if (coll === 'batches') { S.tasks = S.tasks.filter(t => t.batchId !== x.id); S.logs = S.logs.filter(l => l.batchId !== x.id); if (route().v === 'batch') location.hash = '#/batches'; }
    if (coll === 'devices') S.rules = S.rules.filter(r => r.dev !== x.id);
    if (coll === 'units' || coll === 'storages') { S.devices = S.devices.filter(v => v.tid !== x.id); S.rules = S.rules.filter(r => r.tid !== x.id); }
    if (coll === 'logs' && x.itemId && x.qty) { const it = get('inventory', x.itemId); if (it && confirm('Hoàn lại ' + x.qty + ' ' + it.unit + ' vào kho?')) { it.qty = +(it.qty + x.qty).toFixed(3); S.invTx.push({ id: uid(), itemId: it.id, date: today(), type: 'in', qty: x.qty, batchId: x.batchId, note: 'Hoàn kho do xóa nhật ký' }); } }
    save(); render(); toast('Đã xóa');
  },
  export: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `smart-farm-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  resetDemo: () => { if (!confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu mẫu?')) return; S = seed(); save(); location.hash = '#/dashboard'; render(); toast('Đã nạp dữ liệu mẫu'); },
  wipe: () => { if (!confirm('Xóa TOÀN BỘ dữ liệu? Hãy xuất sao lưu trước nếu cần.')) return; S = EMPTY(); save(); location.hash = '#/units'; render(); toast('Đã xóa dữ liệu — bắt đầu bằng việc thêm khu sản xuất'); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const f = ACT[el.dataset.act];
  if (!f) return;
  if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
  f(el.dataset, el);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.closest('#modal') && el.dataset.re) { const k = el.name; FORM.data = readForm(); if (FORM.onChange) FORM.onChange(FORM.data, k); drawForm(); return; }
  const c = el.dataset.chg;
  if (!c) { if (el.id === 'importFile') importFile(el.files[0]); return; }
  if (c === 'task') { const x = get('tasks', el.dataset.id); x.done = el.checked; x.doneAt = el.checked ? Date.now() : null; }
  else if (c === 'routine') { const k = el.dataset.key, i = +el.dataset.i, a = S.routine[k] || []; S.routine[k] = el.checked ? [...new Set([...a, i])] : a.filter(z => z !== i); }
  else if (c === 'dev') { const d = get('devices', el.dataset.id); d.on = el.checked; logIot(`✋ Điều khiển tay: ${el.checked ? 'BẬT' : 'TẮT'} ${d.name}`); }
  else if (c === 'rule') { get('rules', el.dataset.id).en = el.checked; }
  else if (c === 'ui') { UI[el.dataset.k] = el.value; }
  else if (c === 'envT') { location.hash = '#/env/' + el.value; return; }
  else if (c === 'lotAll') { UI.lotAll = el.checked; }
  else if (c === 'symp') { el.checked ? UI.symp.add(el.dataset.k) : UI.symp.delete(el.dataset.k); }
  save(); render();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.inp === 'calc') calc(el.closest('[data-calc]'));
  else if (el.dataset.inp === 'inQ') { UI.inQ = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('[data-inp="inQ"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'theForm') submitForm();
  else if (e.target.id === 'farmForm') { const f = e.target.elements; Object.assign(S.farm, { name: f.name.value.trim() || 'Trang trại', owner: f.owner.value.trim(), address: f.address.value.trim(), phone: f.phone.value.trim(), code: (f.code.value.trim() || 'DHT').toUpperCase() }); save(); render(); toast('Đã lưu thông tin trang trại'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); if (e.key === 'Enter' && e.target.id === 'traceInput') ACT.traceGo(); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function importFile(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.units) || !Array.isArray(d.batches)) throw new Error('Sai định dạng');
      if (!confirm('Thay dữ liệu hiện tại bằng bản sao lưu?')) return;
      S = Object.assign(EMPTY(), d); save(); render(); toast('Đã khôi phục dữ liệu');
    } catch (err) { toast('Không đọc được tệp sao lưu: ' + err.message); }
  };
  rd.readAsText(file);
}

/* Menu di động, giao diện, mô phỏng IoT */
const side = $('#side'), scrim = $('#scrim');
$('#menuBtn').onclick = () => { side.classList.add('open'); scrim.classList.add('open'); };
scrim.onclick = () => { side.classList.remove('open'); scrim.classList.remove('open'); };
window.addEventListener('hashchange', () => { side.classList.remove('open'); scrim.classList.remove('open'); if (route().v !== 'harvest') UI.lastLot = null; if (route().v !== 'batch') UI.btab = 'overview'; render(); });
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } } };
(function theme() { const t = store.get('dht_farm_theme'); if (t) document.documentElement.dataset.theme = t; })();
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('dht_farm_theme', nx);
};
let simTimer = null;
function setSim(on) {
  clearInterval(simTimer); simTimer = null;
  if (on) simTimer = setInterval(() => { simulateAll(); const v = route().v; if (['dashboard', 'env', 'batch', 'units'].includes(v) && $('#modal').hidden) render(); }, 10000);
  store.set('dht_farm_sim', on ? '1' : '0');
}
$('#simToggle').onchange = e => { setSim(e.target.checked); if (e.target.checked) { simulateAll(); render(); toast('IoT trực tuyến: cảm biến gửi dữ liệu mỗi 10 giây, quy tắc tự động đang chạy'); } };

/* ============================ DỮ LIỆU MẪU ============================ */
function seed() {
  const saved = S; S = EMPTY();
  const t = today(), D = n => addDays(t, n);
  S.farm = { name: 'Trang trại Nông nghiệp Công nghệ cao DHT', owner: 'HKD Dịch vụ Tổng hợp DHT', address: 'Việt Nam', phone: '0983 491 483', code: 'DHT' };
  const st = (id, name, role, phone) => (S.staff.push({ id, name, role, phone }), id);
  st('s1', 'Nguyễn Văn An', 'Quản lý trang trại', '0900 000 001'); st('s2', 'Trần Thị Bình', 'Kỹ thuật chăn nuôi – thú y', '0900 000 002');
  st('s3', 'Lê Văn Cường', 'Kỹ thuật trồng trọt – nấm', '0900 000 003'); st('s4', 'Phạm Thị Dung', 'Kho – sơ chế – đóng gói', '0900 000 004');
  const U = (id, name, type, area, capacity, location, note) => S.units.push({ id, name, type, area, capacity, location, note });
  U('u1', 'Chuồng gà thịt A1', 'poultry', 300, 3000, 'Khu A – chăn nuôi', 'Chuồng kín, tấm làm mát + quạt hút, đệm lót sinh học');
  U('u2', 'Chuồng gà đẻ A2', 'poultry', 320, 2000, 'Khu A – chăn nuôi', 'Chuồng lồng 3 tầng, máng uống núm tự động');
  U('u3', 'Nhà nấm N1', 'mushroom', 120, 7000, 'Khu B – nấm', 'Giàn treo 6 tầng, phun sương tự động, đèn LED tán xạ');
  U('u4', 'Nhà lưới rau R1', 'veg', 600, 600, 'Khu C – rau', 'Lưới chắn côn trùng 32 mesh, tưới phun mưa');
  U('u5', 'Nhà màng thủy canh T1', 'veg', 200, 4500, 'Khu C – rau', 'Hệ NFT 30 máng, bồn 2 m³, làm mát dung dịch');
  U('u6', 'Vườn dược liệu D1', 'herb', 2000, 12000, 'Khu D – dược liệu', 'Vùng trồng đạt GACP-WHO, tưới nhỏ giọt');
  const Sg = (id, name, profile, capacity) => S.storages.push({ id, name, profile, capacity });
  Sg('k1', 'Kho lạnh rau K1', 'cold_veg', 10); Sg('k2', 'Kho lạnh nấm K2', 'cold_mush', 6); Sg('k3', 'Kho dược liệu khô K3', 'dry_herb', 20); Sg('k4', 'Kho trứng K4', 'egg', 4);
  const I = (id, name, cat, unit, qty, min, price, expiry, phi, supplier) => S.inventory.push({ id, name, cat, unit, qty, min, price, expiry: expiry || '', phi: phi ?? '', supplier: supplier || '' });
  I('i1', 'Thức ăn gà thịt giai đoạn 2', 'Thức ăn chăn nuôi', 'kg', 1850, 2000, 12500, D(75), null, 'Đại lý TACN');
  I('i2', 'Thức ăn gà đẻ', 'Thức ăn chăn nuôi', 'kg', 3200, 1500, 11000, D(80));
  I('i3', 'Vaccine ND-IB (lọ 1000 liều)', 'Thuốc thú y – vaccine', 'lọ', 4, 3, 120000, D(90), 0);
  I('i4', 'Vaccine cúm gia cầm H5 (lọ 500 liều)', 'Thuốc thú y – vaccine', 'lọ', 3, 6, 250000, D(20), 0);
  I('i5', 'Thuốc sát trùng Iodine 10%', 'Thuốc thú y – vaccine', 'lít', 18, 10, 180000, D(400));
  I('i6', 'Giống nấm sò cấp 2', 'Con giống / hạt giống / phôi', 'kg', 60, 50, 35000, D(15));
  I('i7', 'Mùn cưa cao su', 'Giá thể – vật tư nấm', 'kg', 8000, 5000, 900);
  I('i8', 'Phân hữu cơ vi sinh', 'Phân bón – dinh dưỡng', 'kg', 900, 500, 6000, D(300));
  I('i9', 'Dinh dưỡng thủy canh A+B (bộ 5 L)', 'Phân bón – dinh dưỡng', 'bộ', 6, 4, 450000, D(200));
  I('i10', 'Chế phẩm Bt (Bacillus thuringiensis)', 'Thuốc BVTV – chế phẩm sinh học', 'gói', 12, 5, 45000, D(240), 3);
  I('i11', 'Chế phẩm Trichoderma', 'Thuốc BVTV – chế phẩm sinh học', 'kg', 15, 5, 60000, D(180), 0);
  I('i12', 'Túi PE đục lỗ đóng gói', 'Bao bì – đóng gói', 'cái', 3000, 1000, 300);
  I('i13', 'Hạt giống cải ngọt', 'Con giống / hạt giống / phôi', 'gói', 20, 10, 25000, D(160));
  const B = (id, unitId, sopId, name, ago, qty, source) => { const b = { id, unitId, sopId, name, start: D(-ago), qty, source, status: 'active' }; S.batches.push(b); genTasks(b, false); return b; };
  B('b1', 'u1', 'broiler', 'Gà lông màu L05', 35, 2500, 'Trại giống gà Minh Dư');
  B('b2', 'u2', 'layer', 'Gà đẻ trứng Đ02', 120, 1800, 'Gà hậu bị 20 tuần – Công ty giống');
  B('b3', 'u3', 'oyster', 'Nấm sò S09', 40, 5000, 'Viện Di truyền Nông nghiệp');
  B('b4', 'u4', 'leafy', 'Cải ngọt vụ C14', 18, 500, 'Hạt giống Rạng Đông');
  B('b5', 'u5', 'hydro', 'Xà lách thủy canh TC07', 22, 3600, 'Hạt Lollo xanh');
  B('b6', 'u6', 'cagaileo', 'Cà gai leo CGL01', 176, 2000, 'Cây giống giâm cành – Viện Dược liệu');
  for (const x of S.tasks) if (x.date < D(-1)) { x.done = true; x.doneAt = Date.now(); }
  for (const x of S.tasks) x.assignee = defaultAssignee(get('units', x.unitId), x.cat);
  const L = (batchId, ago, type, qty, value, itemId, phi, note) => S.logs.push({ id: uid(), batchId, date: D(-ago), type, qty: qty || 0, value: value || 0, itemId: itemId || '', phi: phi || 0, note: note || '' });
  [[29, 210], [22, 350], [15, 525], [8, 700]].forEach(([a, q]) => L('b1', a, 'feed', q, 0, '', 0, 'Tổng hợp tuần'));
  L('b1', 1, 'feed', 875, 0, 'i1', 0, 'Tổng hợp tuần 5'); S.invTx.push({ id: uid(), itemId: 'i1', date: D(-1), type: 'out', qty: 875, batchId: 'b1', note: 'Cho ăn' });
  [[33, 18], [30, 9], [23, 7], [15, 12], [5, 6]].forEach(([a, q]) => L('b1', a, 'death', q, 0, '', 0, 'Loại gà yếu, còi'));
  [[28, .082], [21, .168], [14, .29], [7, .43]].forEach(([a, v]) => L('b1', a, 'weigh', 0, v, '', 0, 'Cân 5% đàn'));
  L('b1', 30, 'med', 3, 0, 'i3', 0, 'ND-IB lần 1 nhỏ mắt mũi'); L('b1', 14, 'med', 5, 0, 'i4', 0, 'Vaccine cúm H5 tiêm dưới da cổ');
  L('b2', 60, 'death', 5); L('b2', 20, 'death', 3); L('b2', 10, 'weigh', 0, 1.82);
  for (let a = 118; a > 5; a -= 7) L('b2', a, 'feed', 1800 * .115 * 7, 0, '', 0, 'Tổng hợp tuần');
  [[33, 95], [26, 60], [19, 25]].forEach(([a, q]) => L('b3', a, 'contam', q, 0, '', 0, 'Mốc xanh – đã tiêu hủy'));
  L('b4', 11, 'fert', 40, 0, 'i8', 0, 'Bón thúc lần 1'); L('b4', 3, 'fert', 40, 0, 'i8', 0, 'Bón thúc lần 2');
  L('b4', 2, 'spray', 2, 0, 'i10', 3, 'Phun Bt trừ sâu tơ');
  L('b5', 10, 'fert', 1, 0, 'i9', 0, 'Pha dung dịch EC 1,5'); L('b5', 3, 'fert', 1, 0, 'i9', 0, 'Bổ sung dinh dưỡng');
  L('b6', 146, 'fert', 300, 0, '', 0, 'Bón thúc hữu cơ lần 1'); L('b6', 86, 'spray', 1, 0, 'i11', 0, 'Trichoderma phòng thối rễ');
  const lot = (batchId, ago, product, unit, qty, remain, storageId, grade, moves) => {
    const b = get('batches', batchId), prof = STORAGE_PROFILES[get('storages', storageId).profile], date = D(-ago);
    const code = `DHT-${TYPE_CODE[sopOf(b).type]}${date.slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    S.lots.push({ id: uid(), code, batchId, unitId: b.unitId, product, unit, qty, remain, grade, date, storageId, expiry: addDays(date, prof.life), note: '', moves: moves || [] });
    for (const m of moves || []) if (m.type === 'sale') S.fin.push({ id: uid(), date: m.date, type: 'in', cat: 'Bán sản phẩm', amount: m.qty * m.price, batchId, note: code + ' → ' + m.buyer });
  };
  lot('b3', 7, 'Nấm sò tươi', 'kg', 620, 0, 'k2', 'Loại 1', [{ date: D(-6), type: 'sale', qty: 620, price: 38000, buyer: 'Siêu thị BigGreen' }]);
  lot('b3', 6, 'Nấm sò tươi', 'kg', 480, 30, 'k2', 'Loại 1', [{ date: D(-4), type: 'sale', qty: 450, price: 38000, buyer: 'Chợ đầu mối' }]);
  lot('b3', 4, 'Nấm sò tươi', 'kg', 150, 150, 'k2', 'Loại 2');
  [[6, 3100], [4, 3150], [2, 3120]].forEach(([a, q]) => lot('b2', a, 'Trứng gà', 'quả', q, a < 3 ? q : 0, 'k4', 'Loại 1', a < 3 ? [] : [{ date: D(-a + 1), type: 'sale', qty: q, price: 2300, buyer: 'Đại lý trứng Hòa Phát' }]));
  lot('b2', 0, 'Trứng gà', 'quả', 1560, 1560, 'k4', 'Loại 1');
  const F = (ago, type, cat, amount, batchId, note) => S.fin.push({ id: uid(), date: D(-ago), type, cat, amount, batchId: batchId || '', note });
  F(35, 'out', 'Con giống / hạt giống / phôi', 2500 * 12000, 'b1', 'Gà 1 ngày tuổi');
  F(34, 'out', 'Thức ăn chăn nuôi', 1785 * 12500, 'b1', 'Thức ăn gà con + GĐ2');
  F(45, 'out', 'Con giống / hạt giống / phôi', 5000 * 5500, 'b3', 'Phôi nấm + giống');
  F(18, 'out', 'Con giống / hạt giống / phôi', 12 * 25000, 'b4', 'Hạt giống');
  F(22, 'out', 'Phân bón – vật tư', 3600 * 350, 'b5', 'Giá thể, hạt, dinh dưỡng');
  F(176, 'out', 'Con giống / hạt giống / phôi', 12500 * 1500, 'b6', 'Cây giống cà gai leo');
  F(120, 'out', 'Con giống / hạt giống / phôi', 1800 * 110000, 'b2', 'Gà hậu bị 20 tuần');
  for (let m = 0; m < 6; m++) {
    const a = m * 30 + 3;
    F(a, 'out', 'Nhân công', 4 * 7500000, '', 'Lương tháng');
    F(a + 1, 'out', 'Điện – nước – nhiên liệu', 11500000 + m * 400000, '', 'Điện, nước, dầu máy phát');
    if (a < 115) { F(a + 2, 'out', 'Thức ăn chăn nuôi', 1800 * .115 * 30 * 11000, 'b2', 'Thức ăn gà đẻ'); F(a + 5, 'in', 'Bán sản phẩm', 1800 * .86 * 30 * 2250, 'b2', 'Trứng gà tháng'); }
    if (m > 0) F(a + 8, 'in', 'Bán sản phẩm', 42000000 + m * 3100000, '', 'Rau, nấm vụ trước');
    if (m > 1) F(a + 10, 'in', 'Bán phụ phẩm (phân, phôi nấm…)', 3500000, '', 'Phân hữu cơ ủ vi sinh');
  }
  const E = (name, kind, unitId, lastAgo, interval, status, value, note) => S.equip.push({ id: uid(), name, kind, unitId, lastService: D(-lastAgo), interval, status, value, note });
  E('Máy phát điện 30 kVA', 'Máy phát điện', '', 100, 90, 'Hoạt động', 85000000, 'Chạy thử 15 phút mỗi tuần');
  E('Hệ thống làm mát Cooling Pad + 6 quạt 50"', 'Hệ thống làm mát chuồng', 'u1', 60, 60, 'Hoạt động', 120000000);
  E('Nồi hấp thanh trùng 2.000 bịch/mẻ', 'Nồi hấp thanh trùng', 'u3', 20, 60, 'Hoạt động', 65000000);
  E('Drone phun thuốc 20 lít', 'Drone phun thuốc', '', 40, 30, 'Hoạt động', 250000000, 'Chỉ phun chế phẩm sinh học/thuốc trong danh mục');
  E('Hệ thống tưới nhỏ giọt & phun mưa', 'Hệ thống tưới tự động', 'u4', 10, 30, 'Hoạt động', 45000000);
  E('Máy sấy dược liệu 200 kg/mẻ', 'Máy sấy', 'u6', 150, 180, 'Hoạt động', 95000000, 'Sấy bơm nhiệt 40–70°C');
  E('Máy xới đất mini', 'Máy làm đất', 'u4', 70, 90, 'Hỏng', 18000000, 'Hỏng bộ ly hợp');
  const Dv = (id, tid, kind, name, on) => S.devices.push({ id, tid, kind, name, on: !!on, auto: true });
  Dv('d1', 'u1', 'fan', 'Quạt hút 1–3', 1); Dv('d2', 'u1', 'fan', 'Quạt hút 4–6'); Dv('d3', 'u1', 'pad', 'Tấm làm mát'); Dv('d4', 'u1', 'heater', 'Đèn sưởi úm');
  Dv('d5', 'u2', 'fan', 'Quạt thông gió'); Dv('d6', 'u2', 'light', 'Đèn chiếu sáng 16h', 1);
  Dv('d7', 'u3', 'mist', 'Phun sương tầng 1–6'); Dv('d8', 'u3', 'fan', 'Quạt trao đổi khí'); Dv('d9', 'u3', 'light', 'LED tán xạ', 1);
  Dv('d10', 'u4', 'pump', 'Bơm tưới phun mưa'); Dv('d11', 'u4', 'curtain', 'Lưới cắt nắng');
  Dv('d12', 'u5', 'doser', 'Bơm định lượng A/B'); Dv('d13', 'u5', 'fan', 'Quạt nhà màng');
  Dv('d14', 'u6', 'pump', 'Bơm nhỏ giọt');
  Dv('d15', 'k1', 'cooler', 'Máy lạnh K1', 1); Dv('d16', 'k2', 'cooler', 'Máy lạnh K2', 1); Dv('d17', 'k3', 'dehum', 'Máy hút ẩm K3'); Dv('d18', 'k4', 'cooler', 'Điều hòa kho trứng', 1);
  const R = (tid, p, op, v, dev, act) => S.rules.push({ id: uid(), tid, p, op, v, dev, act, en: true });
  R('u1', 'temp', '>', 26.5, 'd1', 'on'); R('u1', 'temp', '<', 23.5, 'd1', 'off'); R('u1', 'temp', '>', 28, 'd3', 'on'); R('u1', 'temp', '<', 25.5, 'd3', 'off');
  R('u1', 'nh3', '>', 12, 'd2', 'on'); R('u1', 'nh3', '<', 6, 'd2', 'off'); R('u1', 'temp', '<', 22, 'd4', 'on'); R('u1', 'temp', '>', 24, 'd4', 'off');
  R('u2', 'temp', '>', 25, 'd5', 'on'); R('u2', 'nh3', '>', 13, 'd5', 'on'); R('u2', 'temp', '<', 21, 'd5', 'off');
  R('u3', 'rh', '<', 86, 'd7', 'on'); R('u3', 'rh', '>', 93, 'd7', 'off'); R('u3', 'co2', '>', 900, 'd8', 'on'); R('u3', 'co2', '<', 600, 'd8', 'off');
  R('u4', 'soil', '<', 66, 'd10', 'on'); R('u4', 'soil', '>', 78, 'd10', 'off');
  R('u5', 'ec', '<', 1.3, 'd12', 'on'); R('u5', 'ec', '>', 1.6, 'd12', 'off'); R('u5', 'temp', '>', 29, 'd13', 'on'); R('u5', 'temp', '<', 26, 'd13', 'off');
  R('u6', 'soil', '<', 58, 'd14', 'on'); R('u6', 'soil', '>', 72, 'd14', 'off');
  R('k1', 'temp', '>', 3.8, 'd15', 'on'); R('k1', 'temp', '<', 1.5, 'd15', 'off'); R('k2', 'temp', '>', 3.8, 'd16', 'on'); R('k2', 'temp', '<', 2.3, 'd16', 'off');
  R('k3', 'rh', '>', 58, 'd17', 'on'); R('k3', 'rh', '<', 48, 'd17', 'off'); R('k4', 'temp', '>', 15.5, 'd18', 'on'); R('k4', 'temp', '<', 12.5, 'd18', 'off');
  /* Lịch sử cảm biến 7 ngày, mỗi 2 giờ */
  const now = Date.now(), N = 84;
  for (const tg of allTargets()) {
    const phase = Math.random() * 6;
    for (let i = N; i >= 1; i--) {
      const ts = now - i * 2 * 36e5, date = iso(ts);
      let env;
      const sto = get('storages', tg.id);
      if (sto) env = STORAGE_PROFILES[sto.profile].env;
      else { const b = unitBatch(tg.id); if (!b) continue; env = stageOf(sopOf(b), diffDays(b.start, date)).env; }
      const r = { id: uid(), tid: tg.id, ts, src: 'sensor' };
      for (const [p, rg] of Object.entries(env)) {
        const w = rg[1] - rg[0], c = (rg[0] + rg[1]) / 2;
        let v = c + w * .42 * Math.sin(i / 5 + phase) + (Math.random() - .5) * w * .3;
        if (rg[0] === 0 && p !== 'temp') v = rg[1] * (.55 + .3 * Math.sin(i / 4 + phase) + (Math.random() - .5) * .2);
        r[p] = +v.toFixed(PARAMS[p].d);
      }
      S.readings.push(r);
    }
  }
  const last = tid => latest(tid);
  if (last('u3')) last('u3').co2 = 1320; /* tình huống: CO₂ nhà nấm vượt ngưỡng */
  if (last('u1')) last('u1').temp = 28.4;
  S.iotLog.push({ ts: now - 36e5, msg: '⚙️ Chuồng gà thịt A1: Nhiệt độ 27,1 °C > 26,5 → BẬT Quạt hút 1–3' });
  S.iotLog.push({ ts: now - 18e5, msg: '⚙️ Nhà nấm N1: Độ ẩm KK 84 % < 86 → BẬT Phun sương tầng 1–6' });
  if (typeof seedExtra === 'function') seedExtra(D);
  const res = S; S = saved; return res;
}

/* ============================ KHỞI ĐỘNG ============================ */
/* Khởi động sau khi mọi script (kể cả rent.js) đã nạp */
document.addEventListener('DOMContentLoaded', () => {
  S = load() || seed();
  if (typeof migrateExtra === 'function') migrateExtra();
  save();
  render();
  if (store.get('dht_farm_sim') === '1') { $('#simToggle').checked = true; setSim(true); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
});
