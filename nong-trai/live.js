'use strict';
/* =====================================================================
   DHT Smart Farm — 📡 TRỰC TUYẾN 24/7 · 🔌 CỔNG TỰ ĐỘNG HÓA · 🧾 DỊCH VỤ
   • Cổng theo dõi trực tuyến: camera từng khu (YouTube Live, HLS, MP4,
     trang nhúng, ảnh chụp định kỳ hoặc cảnh mô phỏng), chỉ số môi trường,
     thiết bị đang chạy và nhật ký hoạt động trong ngày — phân quyền
     công khai / khách thuê khu / chỉ quản trị.
   • Cổng chờ cho hệ thống chăm sóc tự động: đăng ký bộ điều khiển
     (ESP32, PLC, tủ tưới…), cấp mã kết nối bảo mật, hàng đợi lệnh,
     lịch chăm sóc tự động, nhận dữ liệu cảm biến qua máy chủ.
   • Danh mục dịch vụ công khai, quản trị viên điều chỉnh được.
   ===================================================================== */
const CAM_KINDS = { sim: 'Mô phỏng (chưa gắn camera)', youtube: 'YouTube Live', hls: 'Luồng HLS (.m3u8)', mp4: 'Video MP4 / WebM', iframe: 'Trang nhúng (Ezviz, Imou, go2rtc…)', snapshot: 'Ảnh chụp định kỳ (JPEG)' };
const CAM_ACCESS = { public: 'Công khai', tenant: 'Khách thuê khu này', private: 'Chỉ quản trị' };
const GW_PROTO = { http: 'HTTP(S) – gọi API trực tiếp', mqtt: 'MQTT qua cầu nối (Node-RED, HA)', modbus: 'Modbus RS485 qua bộ chuyển', lora: 'LoRaWAN qua gateway' };
const GW_ST = { sim: ['Mô phỏng', 'b-info'], wait: ['Chờ kết nối', 'b-warn'], on: ['Trực tuyến', 'b-ok'], off: ['Mất kết nối', 'b-bad'] };
const CMD_ST = { 'Chờ gửi': 'b-warn', 'Đã lên máy chủ': 'b-info', 'Đã gửi': 'b-info', 'Đã thực hiện': 'b-ok', 'Lỗi': 'b-bad', 'Hết hạn': '' };
const SVC_CATS = { care: '🌱 Chăm sóc vườn & chuồng', harvest: '🧺 Thu hoạch & giao nhận', exp: '🎒 Trải nghiệm & giáo dục', tech: '🧑‍🔬 Kỹ thuật & tư vấn', process: '🏭 Sơ chế – chế biến – bảo quản', machine: '🚜 Cơ giới hóa', monitor: '📡 Giám sát & tự động hóa' };
const SVC_AUD = { all: 'Mọi khách hàng', tenant: 'Khách thuê vườn', public: 'Khách tham quan' };
const SVC_FLOW = ['Mới', 'Đã xác nhận', 'Hoàn thành'];
const WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
FIN_IN.push('Dịch vụ nông trại');
Object.assign(UI, { liveUnit: '', svcCat: '', svcQ: '', svcView: 'cards', cfgSvc: 'catalog' });

const safeUrl = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '';
const ytId = u => { const m = String(u || '').match(/(?:v=|youtu\.be\/|embed\/|live\/|shorts\/)([\w-]{11})/) || String(u || '').match(/^([\w-]{11})$/); return m ? m[1] : ''; };
const hhmm = (d = new Date()) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const modeNow = () => (typeof accessMode === 'function' ? accessMode() : 'admin');
const liveRemote = () => !!(UI.remoteState);
function tenantUnits() {
  const t = typeof tenantId === 'function' ? tenantId() : '';
  const plots = S.contracts.filter(c => c.customerId === t && ['active', 'pending'].includes(c.status)).map(c => get('plots', c.plotId)).filter(Boolean);
  return new Set(plots.map(p => p.unitId));
}
function camsVisible() {
  const m = modeNow(), on = S.cams.filter(c => c.on !== false);
  if (m === 'admin') return on;
  if (m === 'tenant') { const us = tenantUnits(); return on.filter(c => c.access === 'public' || (c.access === 'tenant' && us.has(c.unitId))); }
  return on.filter(c => c.access === 'public');
}

/* ------------------------------ CAMERA ------------------------------ */
const SCENE = {
  poultry: { bg: ['#f3e3b5', '#d8b877'], items: ['🐔', '🐓', '🐤', '🐔', '🐥', '🐔', '🐓', '🐤'], floor: '#c9a060' },
  mushroom: { bg: ['#3b3f46', '#23262b'], items: ['🍄', '🍄', '🍄', '🍄', '🍄', '🍄', '🍄', '🍄'], floor: '#4a4032' },
  veg: { bg: ['#cfe9ff', '#a9d89a'], items: ['🥬', '🥬', '🥗', '🥬', '🥬', '🥗', '🥬', '🥬'], floor: '#6b4f2e' },
  herb: { bg: ['#d8f0d0', '#9cc98a'], items: ['🌿', '🌱', '🌿', '🌿', '🌱', '🌿', '🌿', '🌱'], floor: '#5d4a2a' }
};
function simScene(c) {
  const u = get('units', c.unitId), type = u ? u.type : 'veg', sc = SCENE[type] || SCENE.veg, devs = S.devices.filter(d => d.tid === c.unitId);
  const hr = new Date().getHours(), night = hr < 6 || hr >= 18 || type === 'mushroom';
  const has = k => devs.some(d => d.kind === k && d.on), gid = 'g' + c.id.replace(/\W/g, '');
  const walk = type === 'poultry';
  const items = sc.items.map((e, i) => { const x = 30 + (i % 4) * 90 + (i > 3 ? 40 : 0), y = i > 3 ? 128 : 92, s = i > 3 ? 42 : 34; return `<text x="${x}" y="${y}" font-size="${s}" class="${walk ? 'cam-walk' : 'cam-sway'}" style="animation-delay:${(i * .7).toFixed(1)}s">${e}</text>`; }).join('');
  const rows = type === 'mushroom' ? [40, 96, 132].map(y => `<rect x="20" y="${y + 6}" width="360" height="4" fill="#8a7a5a"/>`).join('') : '';
  const mist = has('mist') ? Array.from({ length: 12 }, (_, i) => `<circle cx="${30 + i * 30}" cy="40" r="2.5" fill="#fff" opacity=".8" class="cam-drop" style="animation-delay:${(i * .23).toFixed(2)}s"/>`).join('') : '';
  const water = has('pump') ? Array.from({ length: 10 }, (_, i) => `<rect x="${35 + i * 36}" y="130" width="2" height="8" fill="#4aa3ff" class="cam-drop" style="animation-delay:${(i * .31).toFixed(2)}s"/>`).join('') : '';
  const fan = devs.some(d => d.kind === 'fan') ? `<g transform="translate(360 30)"><circle r="16" fill="#0003"/><text class="${has('fan') ? 'cam-spin' : ''}" font-size="22" text-anchor="middle" dy="8">🌀</text></g>` : '';
  const lamp = has('heater') || has('light') ? '<circle cx="200" cy="20" r="60" fill="#ffd36b" opacity=".25"/>' : '';
  return `<svg class="cam-sim ${night ? 'night' : ''}" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cảnh mô phỏng ${esc(c.name)}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.bg[0]}"/><stop offset="1" stop-color="${sc.bg[1]}"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#${gid})"/><rect y="135" width="400" height="65" fill="${sc.floor}"/>${lamp}${rows}${items}${mist}${water}${fan}</svg>`;
}
function camPlayer(c) {
  const u = safeUrl(c.url), id = ytId(c.url);
  if (c.kind === 'youtube' && id) return `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0" title="${esc(c.name)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  if (!u || c.kind === 'sim') return simScene(c);
  if (c.kind === 'iframe') return `<iframe src="${esc(u)}" title="${esc(c.name)}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  if (c.kind === 'snapshot') return `<img data-snap="${esc(u)}" src="${esc(u)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">`;
  if (c.kind === 'hls') return `<video data-hls="${esc(u)}" autoplay muted playsinline controls></video>`;
  return `<video src="${esc(u)}" autoplay muted loop playsinline controls></video>`;
}
const isSimCam = c => c.kind === 'sim' || !(c.kind === 'youtube' ? ytId(c.url) : safeUrl(c.url));
function readingChips(tid, max = 4) {
  const r = latest(tid), tg = targetOf(tid);
  if (!r) return '<small class="muted">Chưa có dữ liệu cảm biến</small>';
  const ps = Object.keys(PARAMS).filter(p => r[p] != null).slice(0, max);
  return ps.map(p => { const rg = tg && tg.env[p], ok = !rg || inRange(r[p], rg); return `<span class="chip ${ok ? '' : 'bad'}">${esc(PARAMS[p].n)} <b>${fmtP(p, r[p])}</b></span>`; }).join('');
}
function camOverlay(c) {
  const u = get('units', c.unitId), b = u && unitBatch(u.id), tg = u && targetOf(u.id);
  const on = S.devices.filter(d => d.tid === c.unitId && d.on);
  return `<div class="cam-top"><span class="cam-live ${isSimCam(c) ? 'is-sim' : ''}">${isSimCam(c) ? '◉ MÔ PHỎNG' : '● TRỰC TIẾP'}</span><span class="cam-clock">${fdt(Date.now())}</span></div>
    <div class="cam-bot"><b>${esc(c.name)}</b>${u ? `<small>${FARM_TYPES[u.type].icon} ${esc(u.name)}${b && tg && tg.stage ? ` · ngày ${bDay(b)} · ${esc(tg.stage.n)}` : ''}</small>` : ''}
    <div class="chips">${u ? readingChips(u.id, 3) : ''}${on.map(d => `<span class="chip on">${DEVICE_KINDS[d.kind].icon} ${esc(d.name)}</span>`).join('')}</div></div>`;
}
function camCard(c) {
  return `<div class="cam" data-cam="${c.id}"><div class="cam-view">${camPlayer(c)}</div><div class="cam-ov" data-ov="${c.id}">${camOverlay(c)}</div>
    <button class="cam-zoom" data-act="camOpen" data-id="${c.id}" aria-label="Phóng to ${esc(c.name)}">⛶</button></div>`;
}

/* ----------------------- NHẬT KÝ HOẠT ĐỘNG TRONG NGÀY ----------------------- */
function liveFeed(sinceMs, pub) {
  if (liveRemote() && S.liveFeedPub) return S.liveFeedPub.filter(x => x.ts >= sinceMs);
  const out = [], d0 = iso(sinceMs), unitOfBatch = id => (get('batches', id) || {}).unitId || '';
  const dT = iso(sinceMs - DAY);
  for (const t of S.tasks) if (t.done && t.doneAt >= sinceMs && t.date >= dT) {
    const priv = /^🙋/.test(t.title);
    out.push({ ts: t.doneAt, ic: priv ? '🙋' : '✅', msg: priv && pub ? 'Hoàn thành yêu cầu chăm sóc của khách thuê' : t.title, unitId: t.unitId || unitOfBatch(t.batchId) });
  }
  for (const l of S.logs) if (l.date >= d0 && LOG_TYPES[l.type] && l.type !== 'death') out.push({ ts: new Date(l.date + 'T08:00').getTime(), ic: '📝', msg: LOG_TYPES[l.type].n + (l.note && !pub ? ': ' + l.note : ''), unitId: unitOfBatch(l.batchId) });
  for (const l of S.iotLog) if (l.ts >= sinceMs) out.push({ ts: l.ts, ic: '⚙️', msg: l.msg.replace(/^[⚙️✋🗓🤖]\S*\s*/u, ''), unitId: '' });
  for (const l of S.lots) if (l.date >= d0) out.push({ ts: new Date(l.date + 'T10:00').getTime(), ic: '📦', msg: `Thu hoạch lô ${l.code}: ${nf(l.qty, 1)} ${l.unit} ${l.product}`, unitId: (get('batches', l.batchId) || {}).unitId || '' });
  return out.filter(x => x.ts <= Date.now() + 6e4).sort((a, b) => b.ts - a.ts).slice(0, 80);
}
function feedHtml(list) {
  return list.length ? `<div class="timeline">${list.map(x => { const u = get('units', x.unitId); return `<div class="tl"><span class="tl-t">${iso(x.ts) === today() ? hhmm(new Date(x.ts)) : fdt(x.ts)}</span><span class="tl-ic">${x.ic}</span><div class="grow">${esc(x.msg)}${u ? `<br><small class="muted">${FARM_TYPES[u.type].icon} ${esc(u.name)}</small>` : ''}</div></div>`; }).join('')}</div>` : empty('Chưa có hoạt động trong 24 giờ qua');
}
function envStrip(units) {
  return `<div class="grid g4">${units.map(u => { const devs = S.devices.filter(d => d.tid === u.id); return `<div class="card envc"><b>${FARM_TYPES[u.type].icon} ${esc(u.name)}</b><div class="chips">${readingChips(u.id, 5)}</div>${devs.length ? `<small class="muted">${devs.filter(d => d.on).length}/${devs.length} thiết bị đang chạy</small>` : ''}</div>`; }).join('') || empty('Chưa có khu sản xuất')}</div>`;
}
function schedToday(units) {
  const wd = new Date().getDay(), now = hhmm(), ids = new Set(units.map(u => u.id));
  const list = S.careSched.filter(s => s.en && ids.has(s.unitId) && (s.days || []).includes(wd)).sort((a, b) => a.time.localeCompare(b.time));
  return list.length ? list.map(s => { const d = get('devices', s.devId), u = get('units', s.unitId); const st = s.time > now ? 'Sắp chạy' : (d && d.on && d.onUntil && s.lastRun === today() + ' ' + s.time) ? 'Đang chạy' : 'Đã chạy'; return `<div class="task"><b class="num">${esc(s.time)}</b><div class="grow">${d ? DEVICE_KINDS[d.kind].icon + ' ' + esc(d.name) : esc(s.name || '')} · ${nf(s.dur)} phút<br><small class="muted">${u ? esc(u.name) : ''}${s.name ? ' · ' + esc(s.name) : ''}</small></div>${badge(st, st === 'Đang chạy' ? 'b-ok' : st === 'Sắp chạy' ? 'b-info' : '')}</div>`; }).join('') : '<p class="muted">Không có lịch chăm sóc tự động hôm nay</p>';
}

VIEWS.live = {
  title: 'Trực tuyến 24/7',
  render() {
    const cams = camsVisible(), units = S.units.filter(u => !UI.liveUnit || u.id === UI.liveUnit);
    const shown = cams.filter(c => !UI.liveUnit || c.unitId === UI.liveUnit), since = Date.now() - DAY;
    const feed = liveFeed(since, modeNow() !== 'admin').filter(x => !UI.liveUnit || !x.unitId || x.unitId === UI.liveUnit);
    const onDev = S.devices.filter(d => units.some(u => u.id === d.tid) && d.on).length;
    return `<div class="card hero-farm live-hero"><div class="grow"><small>📡 ${esc(S.farm.name)}</small><h2>Nông trại trực tuyến 24/7</h2>
      <p class="slogan">Minh bạch từng ngày — xem tận mắt, theo dõi từng chỉ số</p>
      <p>Quan sát chuồng trại, nhà nấm, vườn rau và vườn dược liệu qua camera, cùng chỉ số môi trường, thiết bị chăm sóc tự động đang chạy và nhật ký công việc trong ngày.</p></div>
      <div class="live-clock"><span class="dot"></span><b data-clock>${hhmm()}</b><small>${fd(today())}</small></div></div>
    <div class="grid g4 sec"><div class="card kpi"><span class="l">Camera đang phát</span><span class="v">${cams.length}</span></div><div class="card kpi"><span class="l">Khu đang theo dõi</span><span class="v">${S.units.length}</span></div><div class="card kpi"><span class="l">Thiết bị tự động đang chạy</span><span class="v t-ok" data-live-dev>${onDev}</span></div><div class="card kpi"><span class="l">Hoạt động 24 giờ qua</span><span class="v">${feed.length}</span></div></div>
    <div class="toolbar sec"><select data-chg="ui" data-k="liveUnit" aria-label="Chọn khu"><option value="">Tất cả các khu</option>${S.units.map(u => `<option value="${u.id}" ${UI.liveUnit === u.id ? 'selected' : ''}>${FARM_TYPES[u.type].icon} ${esc(u.name)}</option>`).join('')}</select><span class="grow"></span>${modeNow() === 'admin' ? '<a class="btn sm" href="#/config" data-act="goCfg" data-k="live">⚙️ Quản lý camera</a> <a class="btn sm" href="#/gateway">🔌 Cổng tự động hóa</a>' : ''}</div>
    <div class="cams">${shown.map(camCard).join('') || empty(modeNow() === 'public' ? 'Chưa có camera công khai' : 'Chưa có camera', modeNow() === 'admin' ? '<button class="btn pri" data-act="camEdit">＋ Thêm camera</button>' : '')}</div>
    <h3 class="sec">🌡️ Môi trường các khu</h3><div data-live-env>${envStrip(units)}</div>
    <div class="grid g2 sec"><div class="card"><h3>🤖 Lịch chăm sóc tự động hôm nay</h3><div data-live-sched>${schedToday(units)}</div></div>
      <div class="card"><h3>📜 Nhật ký hoạt động 24 giờ</h3><div data-live-feed class="feed-scroll">${feedHtml(feed)}</div></div></div>
    <p class="muted" style="font-size:12px">${liveRemote() ? 'Dữ liệu cập nhật từ máy chủ mỗi phút.' : 'Dữ liệu cập nhật tự động.'} Hình ảnh “mô phỏng” minh họa trạng thái khu khi chưa gắn camera thật.</p>`;
  },
  after() { attachStreams(); }
};
/* Gắn luồng HLS (Safari phát trực tiếp, trình duyệt khác tải hls.js khi cần) */
function attachStreams(root = document) {
  const vids = [...root.querySelectorAll('video[data-hls]')].filter(v => !v._hls);
  if (!vids.length) return;
  const go = () => vids.forEach(v => { v._hls = true; if (window.Hls && Hls.isSupported()) { const h = new Hls(); h.loadSource(v.dataset.hls); h.attachMedia(v); } else v.src = v.dataset.hls; });
  if (vids[0].canPlayType('application/vnd.apple.mpegurl') || window.Hls) return go();
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'; s.onload = go; s.onerror = go; document.head.appendChild(s);
}
/* Làm mới phần chữ mà không tải lại luồng camera */
function liveTick() {
  if (route().v !== 'live' || !$('#modal').hidden && !$('#modal .cam')) return;
  document.querySelectorAll('[data-clock]').forEach(e => { e.textContent = hhmm(); });
  document.querySelectorAll('.cam-clock').forEach(e => { e.textContent = fdt(Date.now()); });
}
function liveRefresh() {
  if (route().v !== 'live') return;
  const units = S.units.filter(u => !UI.liveUnit || u.id === UI.liveUnit);
  document.querySelectorAll('[data-ov]').forEach(e => { const c = get('cams', e.dataset.ov); if (c) e.innerHTML = camOverlay(c); });
  document.querySelectorAll('.cam[data-cam]').forEach(e => { const c = get('cams', e.dataset.cam); if (c && isSimCam(c)) e.querySelector('.cam-view').innerHTML = simScene(c); });
  const env = $('[data-live-env]'); if (env) env.innerHTML = envStrip(units);
  const sc = $('[data-live-sched]'); if (sc) sc.innerHTML = schedToday(units);
  const fe = $('[data-live-feed]'); if (fe) fe.innerHTML = feedHtml(liveFeed(Date.now() - DAY, modeNow() !== 'admin').filter(x => !UI.liveUnit || !x.unitId || x.unitId === UI.liveUnit));
  const dv = $('[data-live-dev]'); if (dv) dv.textContent = S.devices.filter(d => units.some(u => u.id === d.tid) && d.on).length;
  document.querySelectorAll('img[data-snap]').forEach(i => { const u = i.dataset.snap; i.src = u + (u.includes('?') ? '&' : '?') + '_t=' + Date.now(); });
}
/* Khách xem bản công khai: tải lại chỉ số trực tuyến từ máy chủ */
async function refreshRemoteLive() {
  if (!liveRemote() || typeof Cloud === 'undefined' || route().v !== 'live') return;
  try {
    const pub = await Cloud.loadPublic(), d = (pub && pub.data) || {};
    if (!liveRemote()) return;
    if (d.readings) { const ids = new Set(d.readings.map(x => x.tid)); S.readings = [...S.readings.filter(r => !ids.has(r.tid)), ...d.readings]; }
    if (d.devices) S.devices = d.devices; if (d.liveFeedPub) S.liveFeedPub = d.liveFeedPub; if (d.careSched) S.careSched = d.careSched;
    liveRefresh();
  } catch (e) { /* mất mạng: giữ dữ liệu cũ */ }
}
setInterval(liveTick, 1000);
setInterval(() => { if (!liveRemote()) liveRefresh(); }, 10000);
setInterval(refreshRemoteLive, 60000);

function camForm(id) {
  const c = id ? get('cams', id) : null;
  if (!S.units.length) { toast('Hãy thêm khu sản xuất trước'); return; }
  openForm({
    title: c ? 'Sửa camera' : 'Thêm camera', data: c || { kind: 'sim', access: 'public', unitId: S.units[0].id, on: true },
    intro: '<p class="muted" style="margin-top:0;font-size:13px">Camera IP thường phát RTSP — trình duyệt không mở trực tiếp được. Hãy phát lên YouTube Live, dùng trang chia sẻ của hãng (Ezviz, Imou…) hoặc máy chủ chuyển luồng (go2rtc, MediaMTX) để có link HLS/nhúng. Chỉ nhận link <b>https://</b>.</p>',
    fields: d => [
      { k: 'name', l: 'Tên camera', req: true, ph: 'VD: Chuồng A1 – góc máng ăn' },
      { k: 'unitId', l: 'Khu', type: 'select', opts: opts(S.units, u => FARM_TYPES[u.type].icon + ' ' + u.name) },
      { k: 'kind', l: 'Nguồn hình', type: 'select', re: true, opts: Object.entries(CAM_KINDS) },
      d.kind === 'sim' ? null : { k: 'url', l: d.kind === 'youtube' ? 'Link YouTube Live hoặc mã video' : 'Đường dẫn (https://…)', req: true, full: true },
      { k: 'access', l: 'Ai được xem', type: 'select', opts: Object.entries(CAM_ACCESS) },
      { k: 'note', l: 'Ghi chú nội bộ (vị trí lắp, tài khoản hãng…)', full: true },
      { k: 'on', l: 'Đang phát', type: 'checkbox' }
    ],
    submit: d => {
      if (d.kind === 'youtube' && !ytId(d.url)) return 'Link YouTube không hợp lệ';
      if (d.kind !== 'sim' && d.kind !== 'youtube' && !safeUrl(d.url)) return 'Đường dẫn phải bắt đầu bằng https:// hoặc http://';
      const rec = { ...d, url: d.kind === 'sim' ? '' : d.url };
      if (c) Object.assign(c, rec); else S.cams.push({ id: uid(), ...rec });
    }
  });
}

/* ------------------------- CỔNG TỰ ĐỘNG HÓA ------------------------- */
function gwStatus(g) { if (g.sim) return 'sim'; if (!g.lastSeen) return 'wait'; return Date.now() - g.lastSeen < 3 * 60e3 ? 'on' : 'off'; }
const gwOf = devId => S.gateways.find(g => (g.devIds || []).includes(devId));
const gwBadge = g => { const [l, c] = GW_ST[gwStatus(g)]; return badge(l, c); };
const cloudUrl = () => (typeof Cloud !== 'undefined' && Cloud.enabled() ? Cloud.config().url.replace(/\/$/, '') : '');
function randomToken() { const a = new Uint8Array(20), A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; crypto.getRandomValues(a); let s = ''; a.forEach((b, i) => { s += A[b % A.length]; if (i % 5 === 4 && i < 19) s += '-'; }); return s; }
/* Mọi thay đổi bật/tắt của thiết bị gắn cổng → xếp lệnh gửi xuống bộ điều khiển */
function queueDeviceCmds() {
  if (liveRemote() || !S || !S.devices) return;
  const st = UI.devState || (UI.devState = {});
  for (const d of S.devices) {
    const prev = st[d.id]; st[d.id] = !!d.on;
    if (prev === undefined || prev === !!d.on) continue;
    const g = gwOf(d.id); if (!g) continue;
    const meta = (UI.cmdMeta && UI.cmdMeta[d.id]) || {};
    S.gwCmds.push({ id: uid(), gwId: g.id, devId: d.id, act: d.on ? 'on' : 'off', dur: d.on ? meta.dur || 0 : 0, src: meta.src || 'auto', at: Date.now(), status: 'Chờ gửi' });
  }
  UI.cmdMeta = {};
  if (S.gwCmds.length > 400) S.gwCmds.splice(0, S.gwCmds.length - 400);
}
/* Lịch chăm sóc tự động + tự tắt thiết bị hết thời lượng + mô phỏng cổng */
function careTick() {
  if (liveRemote() || !S || modeNow() !== 'admin') return;
  let ch = false; const now = new Date(), t = hhmm(now), day = today(), wd = now.getDay(), ms = now.getTime();
  UI.cmdMeta = UI.cmdMeta || {};
  for (const s of S.careSched) {
    if (!s.en || !(s.days || []).includes(wd) || s.time > t) continue;
    const key = day + ' ' + s.time; if (s.lastRun === key) continue;
    s.lastRun = key;
    const late = (now - new Date(day + 'T' + s.time)) / 60e3; if (late > 15) continue;   /* bỏ lịch đã lỡ quá 15 phút */
    const d = get('devices', s.devId); if (!d) continue;
    d.on = true; d.onUntil = ms + (s.dur || 1) * 60e3; UI.cmdMeta[d.id] = { src: 'sched', dur: s.dur };
    logIot(`🗓 Lịch chăm sóc${s.name ? ' “' + s.name + '”' : ''}: BẬT ${d.name} trong ${nf(s.dur)} phút`); ch = true;
  }
  for (const d of S.devices) if (d.onUntil && ms >= d.onUntil) { delete d.onUntil; if (d.on) { d.on = false; UI.cmdMeta[d.id] = { src: 'sched' }; logIot(`🗓 Hết thời lượng: TẮT ${d.name}`); ch = true; } }
  for (const c of S.gwCmds) {
    const g = get('gateways', c.gwId);
    if (c.status === 'Chờ gửi' && g && g.sim && ms - c.at > 3000) { c.status = 'Đã thực hiện'; c.doneAt = ms; ch = true; }
    else if (['Chờ gửi', 'Đã lên máy chủ'].includes(c.status) && ms - c.at > 30 * 60e3) { c.status = 'Hết hạn'; ch = true; }
  }
  if (ch) { save(); if (['gateway', 'env'].includes(route().v) && $('#modal').hidden) render(); }
}
setInterval(careTick, 5000);

function gwForm(id) {
  const g = id ? get('gateways', id) : null;
  if (!S.units.length) { toast('Hãy thêm khu sản xuất trước'); return; }
  openForm({
    title: g ? 'Sửa bộ điều khiển' : 'Đăng ký bộ điều khiển tự động', data: g ? { ...g } : { proto: 'http', unitId: S.units[0].id, devIds: [], sim: false },
    fields: d => {
      const devs = S.devices.filter(x => x.tid === d.unitId);
      return [
        { k: 'name', l: 'Tên bộ điều khiển', req: true, ph: 'VD: Tủ tưới nhà màng R1' },
        { k: 'unitId', l: 'Khu lắp đặt', type: 'select', re: true, opts: opts(S.units, u => FARM_TYPES[u.type].icon + ' ' + u.name) },
        { k: 'proto', l: 'Cách kết nối', type: 'select', opts: Object.entries(GW_PROTO) },
        { k: 'model', l: 'Phần cứng', ph: 'ESP32, PLC S7-1200, Raspberry Pi…' },
        { k: 'html', type: 'html', html: `<span class="f"><span>Thiết bị do bộ này điều khiển</span></span><div class="picks">${devs.map(x => { const o = gwOf(x.id), taken = o && (!g || o.id !== g.id); return `<label class="pick ${taken ? 'dis' : ''}"><input type="checkbox" name="dev_${x.id}" ${(d.devIds || []).includes(x.id) ? 'checked' : ''} ${taken ? 'disabled' : ''}><span>${DEVICE_KINDS[x.kind].icon} ${esc(x.name)}${taken ? ` <small>(${esc(o.name)})</small>` : ''}</span></label>`; }).join('') || '<small class="muted">Khu này chưa có thiết bị — thêm tại Môi trường & IoT</small>'}</div>` },
        { k: 'sim', l: 'Chế độ mô phỏng (chưa có phần cứng — ứng dụng tự thực hiện lệnh)', type: 'checkbox' },
        { k: 'note', l: 'Ghi chú (vị trí tủ, sơ đồ đấu nối, số điện thoại kỹ thuật…)', type: 'textarea' }
      ];
    },
    submit: d => {
      const devIds = S.devices.filter(x => x.tid === d.unitId && $(`#theForm [name="dev_${x.id}"]`) && $(`#theForm [name="dev_${x.id}"]`).checked).map(x => x.id);
      const rec = { name: d.name, unitId: d.unitId, proto: d.proto, model: d.model || '', sim: !!d.sim, note: d.note || '', devIds };
      if (g) Object.assign(g, rec); else S.gateways.push({ id: 'gw' + uid().slice(0, 8), created: today(), lastSeen: 0, ...rec });
    }
  });
}
function schedForm(id) {
  const s = id ? get('careSched', id) : null;
  if (!S.devices.length) { toast('Chưa có thiết bị — thêm tại Môi trường & IoT'); return; }
  const u0 = (S.units.find(u => S.devices.some(d => d.tid === u.id)) || S.units[0]).id;
  openForm({
    title: s ? 'Sửa lịch chăm sóc' : 'Thêm lịch chăm sóc tự động', data: s ? { ...s, ...Object.fromEntries(WEEK.map((_, i) => ['d' + i, (s.days || []).includes(i)])) } : { unitId: u0, time: '06:00', dur: 10, en: true, ...Object.fromEntries(WEEK.map((_, i) => ['d' + i, true])) },
    fields: d => [
      { k: 'name', l: 'Tên lịch', ph: 'VD: Tưới nhỏ giọt sáng' },
      { k: 'unitId', l: 'Khu', type: 'select', re: true, opts: opts(S.units, u => FARM_TYPES[u.type].icon + ' ' + u.name) },
      { k: 'devId', l: 'Thiết bị', type: 'select', opts: S.devices.filter(x => x.tid === d.unitId).map(x => [x.id, DEVICE_KINDS[x.kind].icon + ' ' + x.name]) },
      { k: 'time', l: 'Giờ chạy', type: 'time', req: true }, { k: 'dur', l: 'Thời lượng (phút)', type: 'number', min: 1, req: true },
      ...WEEK.map((w, i) => ({ k: 'd' + i, l: w, type: 'checkbox' })),
      { k: 'en', l: 'Kích hoạt', type: 'checkbox' }
    ],
    submit: d => {
      const dv = get('devices', d.devId); if (!dv || dv.tid !== d.unitId) return 'Chọn thiết bị thuộc khu đã chọn';
      const days = WEEK.map((_, i) => i).filter(i => d['d' + i]); if (!days.length) return 'Chọn ít nhất một ngày trong tuần';
      const rec = { name: d.name || '', unitId: d.unitId, devId: d.devId, time: d.time, dur: Math.max(1, Math.round(d.dur)), days, en: !!d.en };
      if (s) Object.assign(s, rec); else S.careSched.push({ id: uid(), ...rec });
    }
  });
}
function gwGuide(id, token) {
  const g = get('gateways', id), url = cloudUrl(), key = typeof Cloud !== 'undefined' ? Cloud.config().anonKey : '';
  const ep = (url || 'https://<project>.supabase.co') + '/rest/v1/rpc/farm_gw_sync', tk = token || '<MÃ-CỔNG>';
  const devs = (g.devIds || []).map(i => get('devices', i)).filter(Boolean);
  const body = JSON.stringify({ p_gw: g.id, p_token: tk, p_readings: [{ unit: g.unitId, vals: { temp: 28.4, rh: 76, soil: 41 } }], p_acks: [{ id: 123, ok: true }], p_info: { fw: '1.0.0' } }, null, 1);
  const curl = `curl -X POST '${ep}' \\\n  -H 'apikey: ${key || '<ANON-KEY>'}' -H 'Content-Type: application/json' \\\n  -d '${body.replace(/\n\s*/g, ' ')}'`;
  const ino = `// ESP32 (Arduino) — gọi mỗi 15–30 giây
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
const char* EP = "${ep}";
const char* KEY = "${key || '<ANON-KEY>'}";
const char* GW = "${g.id}", *TOKEN = "${tk}";
${devs.map((d, i) => `const int PIN_${d.id.replace(/\W/g, '').toUpperCase()} = ${[25, 26, 27, 32, 33, 14][i % 6]}; // ${d.name}`).join('\n')}
String acks = "[]";
void loop() {
  HTTPClient h; h.begin(EP);
  h.addHeader("apikey", KEY); h.addHeader("Content-Type", "application/json");
  String body = String("{\\"p_gw\\":\\"") + GW + "\\",\\"p_token\\":\\"" + TOKEN + "\\",\\"p_acks\\":" + acks +
    ",\\"p_readings\\":[{\\"unit\\":\\"${g.unitId}\\",\\"vals\\":{\\"temp\\":" + String(readTemp()) + "}}]}";
  if (h.POST(body) == 200) {
    JsonDocument doc; deserializeJson(doc, h.getString());
    acks = "[";
    for (JsonObject c : doc["cmds"].as<JsonArray>()) {
      // c["dev"] = mã thiết bị, c["act"] = "on"/"off", c["dur"] = số phút (0 = giữ nguyên)
      runCommand(c["dev"].as<const char*>(), c["act"] == "on", c["dur"] | 0);
      acks += String(acks.length() > 1 ? "," : "") + "{\\"id\\":" + String((long)c["id"]) + ",\\"ok\\":true}";
    }
    acks += "]";
  }
  h.end(); delay(20000);
}`;
  openPanel('Hướng dẫn kết nối · ' + g.name, `${token ? alertHtml({ lv: 'warn', html: `<b>Mã cổng (chỉ hiện một lần):</b> <code class="big">${esc(token)}</code><br>Hãy nạp mã này vào bộ điều khiển. Ứng dụng chỉ lưu dạng băm — mất mã thì cấp mã mới.` }) : ''}
    ${url ? '' : alertHtml({ lv: 'info', msg: 'Chưa bật máy chủ Supabase — bộ điều khiển thật cần máy chủ để nhận lệnh. Vào Dữ liệu & cấu hình → Máy chủ.' })}
    <table class="kv"><tr><td>Mã cổng (p_gw)</td><td><code>${esc(g.id)}</code></td></tr><tr><td>Điểm kết nối</td><td><code style="word-break:break-all">POST ${esc(ep)}</code></td></tr><tr><td>Chu kỳ gọi</td><td>15–30 giây (quá 3 phút không gọi → “Mất kết nối”)</td></tr>
    <tr><td>Thiết bị</td><td>${devs.map(d => `<code>${esc(d.id)}</code> ${DEVICE_KINDS[d.kind].icon} ${esc(d.name)}`).join('<br>') || '—'}</td></tr></table>
    <h4>Mỗi lần gọi</h4><ul style="font-size:13px"><li>Gửi số đo cảm biến (<code>p_readings</code>: ${Object.keys(PARAMS).map(p => `<code>${p}</code>`).join(', ')}) và xác nhận các lệnh đã chạy (<code>p_acks</code>).</li><li>Nhận về tối đa 20 lệnh đang chờ: <code>{"cmds":[{"id":1,"dev":"…","act":"on","dur":10}]}</code>. Lệnh quá 30 phút không nhận sẽ hết hạn.</li><li>Sai mã 20 lần trong 10 phút → cổng tạm khóa.</li></ul>
    <div class="setup"><h4>Thử bằng curl</h4><pre>${esc(curl)}</pre><h4>Mã mẫu ESP32</h4><pre>${esc(ino)}</pre></div>
    <div class="no-print"><button class="btn sm" data-act="printModal">🖨 In hướng dẫn</button></div>`);
}
VIEWS.gateway = {
  title: 'Cổng tự động hóa',
  render() {
    const G = S.gateways, st = G.map(gwStatus), pend = S.gwCmds.filter(c => ['Chờ gửi', 'Đã lên máy chủ', 'Đã gửi'].includes(c.status)).length;
    const wd = new Date().getDay(), todayN = S.careSched.filter(s => s.en && (s.days || []).includes(wd)).length;
    return `${alertHtml({ lv: 'info', msg: 'Cổng chờ kết nối cho hệ thống chăm sóc tự động: đăng ký bộ điều khiển (tưới, phun sương, quạt, cho ăn…), cấp mã bảo mật và nạp vào phần cứng. Lệnh từ quy tắc cảm biến, lịch chăm sóc hoặc bật/tắt tay đều được xếp hàng và gửi xuống bộ điều khiển qua máy chủ.' })}
    <div class="grid g4 sec"><div class="card kpi"><span class="l">Bộ điều khiển</span><span class="v">${G.length}</span></div><div class="card kpi"><span class="l">Trực tuyến / mô phỏng</span><span class="v t-ok">${st.filter(s => s === 'on' || s === 'sim').length}</span></div><div class="card kpi"><span class="l">Chờ kết nối / mất kết nối</span><span class="v ${st.some(s => s === 'off') ? 't-bad' : ''}">${st.filter(s => s === 'wait' || s === 'off').length}</span></div><div class="card kpi"><span class="l">Lệnh đang chờ · lịch hôm nay</span><span class="v">${pend} · ${todayN}</span></div></div>
    <div class="card sec"><div class="card-head"><h3>🔌 Bộ điều khiển & cổng kết nối</h3><button class="btn sm pri" data-act="gwEdit">＋ Đăng ký bộ điều khiển</button></div>
    ${tbl(['Tên', 'Khu', 'Kết nối', 'Thiết bị', 'Trạng thái', 'Lần cuối', ''], G.map(g => { const u = get('units', g.unitId); return `<tr><td><b>${esc(g.name)}</b><br><small class="muted"><code>${esc(g.id)}</code>${g.model ? ' · ' + esc(g.model) : ''}</small></td><td>${u ? esc(u.name) : '—'}</td><td><small>${esc(GW_PROTO[g.proto] || '')}</small></td><td><small>${(g.devIds || []).map(i => get('devices', i)).filter(Boolean).map(d => `${DEVICE_KINDS[d.kind].icon} ${esc(d.name)}${d.on ? ' <b class="t-ok">●</b>' : ''}`).join('<br>') || '—'}</small></td><td>${gwBadge(g)}${g.tokenHash || g.sim ? '' : '<br><small class="t-warn">Chưa cấp mã</small>'}</td><td><small>${g.lastSeen ? fdt(g.lastSeen) : '—'}${g.info && g.info.fw ? '<br>fw ' + esc(String(g.info.fw).slice(0, 20)) : ''}</small></td>
      <td>${acts(`<button class="btn sm" data-act="gwToken" data-id="${g.id}" title="Cấp mã kết nối mới">🔑</button>`, `<button class="btn sm" data-act="gwGuide" data-id="${g.id}" title="Hướng dẫn kết nối">📋</button>`, editBtn('gwEdit', g.id), delBtn('gateways', g.id))}</td></tr>`; }), 'Chưa có bộ điều khiển — hệ thống đang ở chế độ chờ kết nối')}</div>
    <div class="grid g2 sec"><div class="card"><div class="card-head"><h3>🗓 Lịch chăm sóc tự động</h3><button class="btn sm pri" data-act="schedEdit">＋ Lịch</button></div>
      ${tbl(['Giờ', 'Thiết bị', 'Ngày', ['Phút', 'r'], 'Bật', ''], S.careSched.slice().sort((a, b) => a.time.localeCompare(b.time)).map(s => { const d = get('devices', s.devId), u = get('units', s.unitId); return `<tr><td><b class="num">${esc(s.time)}</b></td><td>${d ? DEVICE_KINDS[d.kind].icon + ' ' + esc(d.name) : '?'}<br><small class="muted">${u ? esc(u.name) : ''}${s.name ? ' · ' + esc(s.name) : ''}${d && gwOf(d.id) ? ' · 🔌' : ''}</small></td><td><small>${s.days.length === 7 ? 'Hằng ngày' : s.days.map(i => WEEK[i]).join(' ')}</small></td><td class="r num">${nf(s.dur)}</td><td><label class="switch"><input type="checkbox" data-lchg="sched" data-id="${s.id}" ${s.en ? 'checked' : ''}><span></span></label></td><td>${acts(editBtn('schedEdit', s.id), delBtn('careSched', s.id))}</td></tr>`; }), 'Chưa có lịch')}
      <p class="muted" style="font-size:12px">Lịch chạy khi ứng dụng quản trị đang mở; bộ điều khiển thật nhận lệnh qua máy chủ. Quy tắc theo cảm biến đặt tại <a href="#/env">Môi trường & IoT</a>.</p></div>
    <div class="card"><div class="card-head"><h3>📨 Hàng đợi lệnh</h3>${S.gwCmds.length ? '<button class="btn sm" data-act="gwClear">Dọn lệnh cũ</button>' : ''}</div>
      ${tbl(['Lúc', 'Thiết bị', 'Lệnh', 'Nguồn', 'Trạng thái'], S.gwCmds.slice(-40).reverse().map(c => { const d = get('devices', c.devId), g = get('gateways', c.gwId); return `<tr><td><small>${fdt(c.at)}</small></td><td>${d ? esc(d.name) : esc(c.devId)}<br><small class="muted">${g ? esc(g.name) : ''}</small></td><td><b>${c.act === 'on' ? 'BẬT' : 'TẮT'}</b>${c.dur ? ` ${nf(c.dur)}′` : ''}</td><td><small>${{ sched: 'Lịch', manual: 'Tay', auto: 'Tự động', rule: 'Quy tắc' }[c.src] || esc(c.src || '')}</small></td><td>${badge(c.status, CMD_ST[c.status])}${c.result ? `<br><small>${esc(c.result)}</small>` : ''}</td></tr>`; }), 'Chưa có lệnh')}</div></div>`;
  }
};

/* ---------------------------- DANH MỤC DỊCH VỤ ---------------------------- */
function svcPrice(s) { return s.price ? `${money(s.price)}<small>/${esc(s.unit)}</small>` : `<span style="font-size:15px">${esc(s.priceNote || 'Liên hệ báo giá')}</span>`; }
function svcList() {
  const m = modeNow(), q = (UI.svcQ || '').toLowerCase();
  return S.services.filter(s => !s.hidden && (!UI.svcCat || s.cat === UI.svcCat) && (!q || (s.n + ' ' + (s.desc || '') + ' ' + (s.inc || []).join(' ')).toLowerCase().includes(q)))
    .filter(s => m === 'admin' || s.aud === 'all' || !s.aud || (m === 'tenant' ? s.aud === 'tenant' || s.aud === 'public' : true))
    .sort((a, b) => Object.keys(SVC_CATS).indexOf(a.cat) - Object.keys(SVC_CATS).indexOf(b.cat) || (a.order || 0) - (b.order || 0));
}
const canBook = s => s.bookable !== false && !(s.aud === 'tenant' && modeNow() === 'public');
VIEWS.services = {
  title: 'Danh mục dịch vụ',
  render() {
    const list = svcList(), c = UI.svcCat;
    const card = s => `<div class="card svc"><div class="svc-h"><span class="pic">${esc(s.icon || '🧾')}</span><div class="grow"><b>${esc(s.n)}</b><br><small class="muted">${esc(SVC_CATS[s.cat] || '')} · ${esc(SVC_AUD[s.aud || 'all'])}</small></div></div>
      <p>${esc(s.desc || '')}</p>${(s.inc || []).length ? `<ul class="svc-inc">${s.inc.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="svc-f"><div class="price">${svcPrice(s)}</div>${s.sla ? `<small class="muted">⏱ ${esc(s.sla)}</small>` : ''}<span class="grow"></span>${canBook(s) ? `<button class="btn sm pri" data-act="svcBook" data-id="${s.id}">Đặt dịch vụ</button>` : s.aud === 'tenant' && s.bookable !== false ? '<small class="muted">Đặt qua tài khoản khách thuê</small>' : ''}</div></div>`;
    const table = tbl(['Dịch vụ', 'Nhóm', 'Bao gồm', 'Thời gian', ['Đơn giá', 'r'], ''], list.map(s => `<tr><td>${esc(s.icon || '')} <b>${esc(s.n)}</b><br><small class="muted">${esc(s.desc || '')}</small></td><td><small>${esc(SVC_CATS[s.cat] || '')}</small></td><td><small>${(s.inc || []).map(esc).join('; ')}</small></td><td><small>${esc(s.sla || '')}</small></td><td class="r num">${s.price ? money(s.price) + '/' + esc(s.unit) : esc(s.priceNote || 'Liên hệ')}</td><td>${canBook(s) ? `<button class="btn sm" data-act="svcBook" data-id="${s.id}">Đặt</button>` : ''}</td></tr>`), 'Không có dịch vụ phù hợp');
    return `<div class="card hero-farm"><div class="grow"><small>🧾 ${esc(S.farm.name)}</small><h2>Danh mục dịch vụ</h2><p class="slogan">Giá công khai – nội dung rõ ràng – đặt lịch trực tuyến</p>
      <p>Toàn bộ dịch vụ nông trại cung cấp cho khách thuê vườn, khách tham quan, hộ nông dân và doanh nghiệp. Giá đã gồm nhân công và vật tư ghi trong mục “bao gồm”; chưa gồm VAT nếu không ghi chú khác.</p></div></div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0"><button class="${!c ? 'on' : ''}" data-act="svcCat" data-k="">Tất cả</button>${Object.entries(SVC_CATS).filter(([k]) => S.services.some(s => s.cat === k && !s.hidden)).map(([k, v]) => `<button class="${c === k ? 'on' : ''}" data-act="svcCat" data-k="${k}">${v}</button>`).join('')}</div></div>
    <div class="toolbar"><input type="search" placeholder="Tìm dịch vụ…" value="${esc(UI.svcQ)}" data-chg="ui" data-k="svcQ" aria-label="Tìm dịch vụ" style="max-width:260px"><span class="grow"></span>
      <button class="btn sm ${UI.svcView === 'cards' ? 'pri' : ''}" data-act="svcView" data-k="cards">▦ Thẻ</button><button class="btn sm ${UI.svcView === 'table' ? 'pri' : ''}" data-act="svcView" data-k="table">☰ Bảng giá</button><button class="btn sm" data-act="svcPrint">🖨 In bảng giá</button>${modeNow() === 'admin' ? '<a class="btn sm" href="#/config" data-act="goCfg" data-k="services">⚙️ Chỉnh sửa</a>' : ''}</div>
    ${UI.svcView === 'table' ? `<div class="card">${table}</div>` : `<div class="svcs">${list.map(card).join('') || empty('Không có dịch vụ phù hợp')}</div>`}`;
  }
};
function svcForm(id) {
  const s = id ? get('services', id) : null;
  openForm({
    title: s ? 'Sửa dịch vụ' : 'Thêm dịch vụ', data: s ? { ...s, incT: (s.inc || []).join('\n') } : { cat: 'care', icon: '🌱', unit: 'lần', aud: 'all', bookable: true },
    fields: [
      { k: 'n', l: 'Tên dịch vụ', req: true, full: true },
      { k: 'cat', l: 'Nhóm', type: 'select', opts: Object.entries(SVC_CATS) }, { k: 'icon', l: 'Biểu tượng' },
      { k: 'desc', l: 'Mô tả ngắn', type: 'textarea' },
      { k: 'price', l: 'Đơn giá (₫, 0 = liên hệ)', type: 'number', min: 0 }, { k: 'unit', l: 'Đơn vị tính', ph: 'lần, kg, giờ, người…' },
      { k: 'priceNote', l: 'Ghi chú giá', ph: 'VD: Liên hệ báo giá, từ 2 người' }, { k: 'sla', l: 'Thời gian thực hiện / cam kết', ph: 'VD: Trong 24 giờ' },
      { k: 'aud', l: 'Đối tượng', type: 'select', opts: Object.entries(SVC_AUD) }, { k: 'order', l: 'Thứ tự hiển thị', type: 'number' },
      { k: 'incT', l: 'Bao gồm (mỗi dòng một ý)', type: 'textarea' },
      { k: 'bookable', l: 'Cho phép đặt trực tuyến', type: 'checkbox' }, { k: 'hidden', l: 'Ẩn khỏi danh mục công khai', type: 'checkbox' }
    ],
    submit: d => {
      const rec = { n: d.n, cat: d.cat, icon: d.icon || '🧾', desc: d.desc || '', price: +d.price || 0, unit: d.unit || 'lần', priceNote: d.priceNote || '', sla: d.sla || '', aud: d.aud, order: +d.order || 0, inc: String(d.incT || '').split('\n').map(x => x.trim()).filter(Boolean), bookable: !!d.bookable, hidden: !!d.hidden };
      if (s) Object.assign(s, rec); else S.services.push({ id: 'sv' + uid().slice(0, 8), ...rec });
    }
  });
}
function svcBookForm(id) {
  const s = get('services', id), tid = typeof tenantId === 'function' ? tenantId() : '', admin = modeNow() === 'admin';
  openForm({
    title: 'Đặt dịch vụ: ' + s.n, ok: 'Gửi đặt dịch vụ', data: { qty: 1, wantDate: addDays(today(), 1), customerId: tid || '' },
    intro: d => `<div class="alert info"><span class="ic">${esc(s.icon || '🧾')}</span><div class="grow"><b>${esc(s.n)}</b> · ${s.price ? money(s.price) + '/' + esc(s.unit) : esc(s.priceNote || 'Liên hệ báo giá')}${s.price ? `<br>Tạm tính <b>${money((+d.qty || 0) * s.price)}</b>` : ''}${s.sla ? `<br><small>⏱ ${esc(s.sla)}</small>` : ''}</div></div>`,
    fields: d => [
      admin ? { k: 'customerId', l: 'Khách hàng', type: 'select', re: true, opts: [['', 'Khách lẻ'], ...opts(S.customers)] } : null,
      ...((admin && d.customerId) || tid ? [] : [{ k: 'name', l: 'Họ tên / đơn vị', req: true }, { k: 'phone', l: 'Điện thoại', req: true }]),
      { k: 'qty', l: `Số lượng (${s.unit})`, type: 'number', re: true, req: true, min: 1 },
      { k: 'wantDate', l: 'Ngày mong muốn', type: 'date', req: true },
      { k: 'note', l: 'Yêu cầu cụ thể (lô vườn, địa điểm, số người…)', type: 'textarea' }
    ],
    submit: d => {
      if (!(d.qty > 0)) return 'Số lượng phải lớn hơn 0';
      if (d.wantDate < today()) return 'Ngày mong muốn không được trước hôm nay';
      const cid = admin ? d.customerId : tid, c = get('customers', cid);
      const b = { id: uid(), code: code('DV'), date: today(), serviceId: s.id, svcName: s.n, unit: s.unit, qty: d.qty, price: s.price, total: Math.round(d.qty * s.price), wantDate: d.wantDate, customerId: cid || '', name: c ? c.name : d.name, phone: c ? c.phone : d.phone, note: d.note || '', status: 'Mới' };
      S.svcBookings.push(b);
      setTimeout(() => openPanel('Phiếu đặt dịch vụ ' + b.code, `<table class="kv"><tr><td>Dịch vụ</td><td><b>${esc(b.svcName)}</b></td></tr><tr><td>Số lượng</td><td>${nf(b.qty)} ${esc(b.unit)}</td></tr><tr><td>Tạm tính</td><td><b>${b.total ? money(b.total) : 'Báo giá sau'}</b></td></tr><tr><td>Ngày mong muốn</td><td>${fd(b.wantDate)}</td></tr><tr><td>Khách</td><td>${esc(b.name || '')} · ${esc(b.phone || '')}</td></tr></table>${alertHtml({ lv: 'info', msg: 'Nông trại sẽ liên hệ xác nhận lịch thực hiện. Thanh toán sau khi hoàn thành hoặc theo hóa đơn kỳ thuê.' })}<div class="no-print"><button class="btn sm" data-act="printModal">🖨 In phiếu</button></div>`), 0);
    },
    done: 'Đã gửi đặt dịch vụ'
  });
}
function svcPrint() {
  const list = svcList();
  openPanel('Bảng giá dịch vụ · ' + S.farm.name, Object.entries(SVC_CATS).map(([k, v]) => { const xs = list.filter(s => s.cat === k); return xs.length ? `<h4>${v}</h4>` + tbl(['Dịch vụ', 'Bao gồm', ['Đơn giá', 'r']], xs.map(s => `<tr><td><b>${esc(s.n)}</b>${s.sla ? `<br><small>⏱ ${esc(s.sla)}</small>` : ''}</td><td><small>${(s.inc || []).map(esc).join('; ')}</small></td><td class="r num">${s.price ? money(s.price) + '/' + esc(s.unit) : esc(s.priceNote || 'Liên hệ')}</td></tr>`)) : ''; }).join('') + `<p class="muted" style="font-size:12px">Cập nhật ${fd(today())} · ${esc(S.farm.phone || '')} · ${esc(S.farm.address || '')}</p><div class="no-print"><button class="btn sm" data-act="printModal">🖨 In</button></div>`);
}
/* Nội dung tab trong Dữ liệu & cấu hình */
function cfgLiveHtml() {
  return `<div class="card-head"><h3>Camera & cổng trực tuyến</h3><div class="acts"><a class="btn sm" href="#/live">👁 Xem cổng trực tuyến</a><button class="btn sm pri" data-act="camEdit">＋ Camera</button></div></div>
    ${tbl(['Camera', 'Khu', 'Nguồn', 'Ai được xem', 'Trạng thái', ''], S.cams.map(c => { const u = get('units', c.unitId); return `<tr><td><b>${esc(c.name)}</b>${c.note ? `<br><small class="muted">${esc(c.note)}</small>` : ''}</td><td>${u ? esc(u.name) : '—'}</td><td><small>${esc(CAM_KINDS[c.kind] || '')}${c.url ? '<br><code>' + esc(c.url.slice(0, 48)) + (c.url.length > 48 ? '…' : '') + '</code>' : ''}</small></td><td>${badge(CAM_ACCESS[c.access] || '', c.access === 'public' ? 'b-ok' : c.access === 'tenant' ? 'b-info' : '')}</td><td>${c.on !== false ? badge('Đang phát', 'b-ok') : badge('Tắt')}</td><td>${acts(editBtn('camEdit', c.id), delBtn('cams', c.id))}</td></tr>`; }), 'Chưa có camera')}
    <p class="muted" style="font-size:12px">Camera “Khách thuê khu này” chỉ hiện với khách có hợp đồng tại khu đó; “Chỉ quản trị” không đưa lên bản công khai. Link camera công khai sẽ hiển thị trên website.</p>`;
}
function cfgSvcHtml() {
  const t = UI.cfgSvc;
  const tabs = `<div class="tabs"><button class="${t === 'catalog' ? 'on' : ''}" data-act="cfgSvc" data-k="catalog">Danh mục (${S.services.length})</button><button class="${t === 'book' ? 'on' : ''}" data-act="cfgSvc" data-k="book">Đơn đặt dịch vụ (${S.svcBookings.filter(b => b.status === 'Mới').length} mới)</button></div>`;
  if (t === 'book') return tabs + tbl(['Mã', 'Ngày', 'Khách', 'Dịch vụ', ['SL', 'r'], ['Tạm tính', 'r'], 'Ngày hẹn', 'Trạng thái', ''], S.svcBookings.slice().reverse().map(b => { const nx = SVC_FLOW[SVC_FLOW.indexOf(b.status) + 1]; return `<tr><td><b>${esc(b.code)}</b></td><td>${fds(b.date)}</td><td>${esc(b.name || '')}<br><small class="muted">${esc(b.phone || '')}</small></td><td>${esc(b.svcName)}${b.note ? `<br><small class="muted">${esc(b.note)}</small>` : ''}</td><td class="r num">${nf(b.qty)} ${esc(b.unit)}</td><td class="r num">${b.total ? money(b.total) : '—'}</td><td>${fds(b.wantDate)}</td><td>${badge(b.status, { 'Mới': 'b-warn', 'Đã xác nhận': 'b-info', 'Hoàn thành': 'b-ok' }[b.status])}</td><td>${acts(nx ? `<button class="btn sm" data-act="svcNext" data-id="${b.id}">→ ${nx}</button>` : '', b.status === 'Mới' ? `<button class="btn sm danger" data-act="svcCancel" data-id="${b.id}">Hủy</button>` : '')}</td></tr>`; }), 'Chưa có đơn đặt dịch vụ');
  return tabs + `<div class="card-head"><h3>Danh mục dịch vụ công khai</h3><div class="acts"><a class="btn sm" href="#/services">👁 Xem trang công khai</a><button class="btn sm" data-act="svcReset">↺ Nạp danh mục mẫu</button><button class="btn sm pri" data-act="svcEdit">＋ Dịch vụ</button></div></div>`
    + tbl(['Dịch vụ', 'Nhóm', ['Đơn giá', 'r'], 'Đối tượng', 'Hiển thị', ''], S.services.map(s => `<tr><td>${esc(s.icon || '')} <b>${esc(s.n)}</b><br><small class="muted">${esc(s.sla || '')}</small></td><td><small>${esc(SVC_CATS[s.cat] || '')}</small></td><td class="r num">${s.price ? money(s.price) + '/' + esc(s.unit) : esc(s.priceNote || 'Liên hệ')}</td><td><small>${esc(SVC_AUD[s.aud || 'all'])}</small></td><td>${s.hidden ? badge('Ẩn') : badge('Công khai', 'b-ok')}</td><td>${acts(editBtn('svcEdit', s.id), delBtn('services', s.id))}</td></tr>`), 'Chưa có dịch vụ');
}

/* ------------------------------ ĐIỀU HƯỚNG & HÀNH ĐỘNG ------------------------------ */
MODULES[0].groups[1][1].push(['gateway', '🔌', 'Cổng tự động hóa']);
(MODULES.find(m => m.id === 'info') || MODULES[0]).groups[0][1].push(['live', '📡', 'Trực tuyến 24/7'], ['services', '🧾', 'Danh mục dịch vụ']);
Object.assign(NAV_BADGES, {
  gateway: () => { const n = S.gateways.filter(g => gwStatus(g) === 'off').length; return n ? `<span class="badge b-bad">${n}</span>` : ''; },
  services: () => { const n = modeNow() === 'admin' ? S.svcBookings.filter(b => b.status === 'Mới').length : 0; return n ? `<span class="badge b-warn">${n}</span>` : ''; }
});
Object.assign(ACT, {
  goCfg: d => { UI.cfgTab = d.k; if (location.hash === '#/config') render(); else location.hash = '#/config'; },
  camEdit: d => camForm(d.id), camOpen: d => { const c = get('cams', d.id); openPanel(c.name, `<div class="cam big"><div class="cam-view">${camPlayer(c)}</div><div class="cam-ov" data-ov="${c.id}">${camOverlay(c)}</div></div>${c.unitId ? `<h4>Hoạt động 24 giờ tại khu</h4>${feedHtml(liveFeed(Date.now() - DAY, modeNow() !== 'admin').filter(x => x.unitId === c.unitId).slice(0, 15))}` : ''}`); attachStreams($('#modalBody')); },
  gwEdit: d => gwForm(d.id), schedEdit: d => schedForm(d.id), gwGuide: d => gwGuide(d.id),
  gwToken: d => {
    const g = get('gateways', d.id);
    if (g.tokenHash && !confirm('Cấp mã mới sẽ vô hiệu mã cũ — bộ điều khiển đang chạy cần nạp lại mã. Tiếp tục?')) return;
    const tk = randomToken(); g.salt = randomCode(8); g.tokenHash = hashCode(g.salt, tk); g.sim = false; save(); render(); gwGuide(g.id, tk);
  },
  gwClear: () => { S.gwCmds = S.gwCmds.filter(c => ['Chờ gửi', 'Đã lên máy chủ', 'Đã gửi'].includes(c.status)); save(); render(); },
  svcCat: d => { UI.svcCat = d.k; render(); }, svcView: d => { UI.svcView = d.k; render(); }, svcPrint: () => svcPrint(),
  svcEdit: d => svcForm(d.id), svcBook: d => svcBookForm(d.id), cfgSvc: d => { UI.cfgSvc = d.k; render(); },
  svcReset: () => { if (!confirm('Thêm các dịch vụ mẫu còn thiếu vào danh mục?')) return; const have = new Set(S.services.map(s => s.id)); DEFAULT_SERVICES().forEach(s => { if (!have.has(s.id)) S.services.push(s); }); save(); render(); },
  svcNext: d => {
    const b = get('svcBookings', d.id); b.status = SVC_FLOW[SVC_FLOW.indexOf(b.status) + 1];
    if (b.status === 'Hoàn thành' && b.total && confirm(`Ghi nhận doanh thu ${money(b.total)} cho ${b.code}?`)) S.fin.push({ id: uid(), date: today(), type: 'in', cat: 'Dịch vụ nông trại', amount: b.total, batchId: '', note: `${b.code} · ${b.svcName} · ${b.name || ''}` });
    save(); render();
  },
  svcCancel: d => { const b = get('svcBookings', d.id); if (!confirm('Hủy đơn ' + b.code + '?')) return; b.status = 'Đã hủy'; save(); render(); }
});
/* Ghi nguồn lệnh "bật/tắt tay" trước khi ứng dụng lưu thay đổi */
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.chg === 'dev') UI.cmdMeta = { [e.target.dataset.id]: { src: 'manual' } }; }, true);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.lchg === 'sched') { const s = get('careSched', el.dataset.id); if (s) { s.en = el.checked; save(); render(); } }
});
/* Thiết bị đổi trạng thái (tay, quy tắc, lịch) → lệnh xuống bộ điều khiển */
const _saveLive = save;
save = function () { try { queueDeviceCmds(); } catch (e) { /* bỏ qua */ } _saveLive(); };
const _alertsLive = computeAlerts;
computeAlerts = function () {
  const A = _alertsLive();
  for (const g of S.gateways || []) if (gwStatus(g) === 'off') A.push({ lv: 'warn', ic: '🔌', msg: `Bộ điều khiển “${g.name}” mất kết nối từ ${fdt(g.lastSeen)}`, link: '#/gateway' });
  const n = (S.svcBookings || []).filter(b => b.status === 'Mới').length;
  if (n) A.push({ lv: 'info', ic: '🧾', msg: `${n} đơn đặt dịch vụ mới chờ xác nhận`, link: '#/config' });
  const o = { bad: 0, warn: 1, info: 2 };
  return A.sort((a, b) => o[a.lv] - o[b.lv]);
};
const _migrateLive = migrateExtra;
migrateExtra = function () {
  _migrateLive();
  for (const k of ['cams', 'gateways', 'gwCmds', 'careSched', 'services', 'svcBookings']) if (!Array.isArray(S[k])) S[k] = [];
  if (!S.liveInit) {
    if (!S.services.length) S.services = DEFAULT_SERVICES();
    if (get('units', 'u1') && !S.cams.length) seedLive();
    S.liveInit = true;
  }
};

/* ----------------------------- DỮ LIỆU MẪU ----------------------------- */
function DEFAULT_SERVICES() {
  let i = 0;
  const V = (cat, icon, n, desc, price, unit, inc, sla, aud, priceNote) => ({ id: 'svd' + (++i), cat, icon, n, desc, price, unit, inc, sla, aud: aud || 'all', priceNote: priceNote || '', order: i, bookable: true, hidden: false });
  return [
    V('care', '💧', 'Tưới & chăm sóc hộ theo ngày', 'Kỹ thuật viên tưới, nhổ cỏ, kiểm tra sâu bệnh cho lô vườn thuê khi khách vắng mặt.', 30000, 'lần', ['Tưới theo nhu cầu cây', 'Nhổ cỏ, vệ sinh luống', 'Ảnh báo cáo qua cổng khách thuê'], 'Trong ngày yêu cầu', 'tenant'),
    V('care', '🌾', 'Bón phân hữu cơ vi sinh', 'Bón thúc bằng phân hữu cơ vi sinh, trùn quế hoặc dịch chuối theo giai đoạn cây.', 25000, 'lần/10 m²', ['Phân bón hữu cơ', 'Nhân công bón', 'Ghi nhật ký truy xuất'], '1–2 ngày', 'tenant'),
    V('care', '🐞', 'Phòng trừ sâu bệnh sinh học', 'Phun chế phẩm sinh học (nấm xanh, Bt, tinh dầu) theo nguyên tắc 4 đúng, ghi thời gian cách ly.', 40000, 'lần/10 m²', ['Chế phẩm sinh học', 'Bảo hộ & dụng cụ', 'Ghi PHI trên nhật ký'], '24 giờ', 'tenant'),
    V('care', '🐔', 'Nuôi hộ gà thả vườn', 'Cho ăn, uống, tiêm phòng, vệ sinh chuồng cho đàn gà nhận nuôi.', 150000, 'tháng/10 con', ['Thức ăn theo quy trình', 'Vaccine định kỳ', 'Camera khu chuồng'], 'Theo tháng', 'tenant'),
    V('harvest', '🧺', 'Thu hoạch hộ & sơ chế', 'Thu hoạch đúng độ chín, rửa, nhặt, đóng túi có tem truy xuất nguồn gốc.', 5000, 'kg', ['Thu hái, sơ chế', 'Túi & tem QR truy xuất'], 'Trong ngày thu hoạch'),
    V('harvest', '🚚', 'Giao tận nhà nội thành', 'Giao sản phẩm bằng thùng giữ lạnh tới nhà khách trong nội thành.', 30000, 'chuyến', ['Thùng giữ lạnh', 'Giao trong 4 giờ sau thu hoạch'], 'Theo lịch hẹn'),
    V('harvest', '📦', 'Hộp rau sạch định kỳ', 'Hộp 5–6 loại rau, củ, nấm theo mùa giao hằng tuần.', 180000, 'tuần', ['4–5 kg rau củ nấm theo mùa', 'Giao tận nhà', 'Có thể tạm dừng'], 'Giao thứ 3 & thứ 6'),
    V('exp', '🚶', 'Tham quan nông trại có hướng dẫn', 'Tham quan nhà nấm, vườn rau thủy canh, vườn dược liệu cùng kỹ sư nông nghiệp.', 80000, 'người', ['Hướng dẫn viên', 'Nước uống', 'Tự tay hái rau mang về 0,5 kg'], 'Đặt trước 1 ngày', 'public'),
    V('exp', '🧒', 'Lớp trải nghiệm “Bé làm nông dân”', 'Gieo hạt, trồng cây, cho gà ăn, làm chậu cây mang về.', 150000, 'bé', ['Dụng cụ & giá thể', 'Chậu cây mang về', 'Chứng nhận nông dân nhí'], 'Cuối tuần', 'public'),
    V('exp', '🍢', 'Thuê khu BBQ – picnic', 'Khu nướng ngoài trời cạnh vườn, bàn ghế, dụng cụ nướng.', 300000, 'buổi', ['Bàn ghế 10 người', 'Lò nướng & than', 'Dọn dẹp sau buổi'], 'Đặt trước 2 ngày', 'public'),
    V('tech', '🧑‍🔬', 'Tư vấn kỹ thuật 1–1', 'Kỹ sư tư vấn quy trình nuôi trồng, dinh dưỡng, xử lý dịch bệnh.', 200000, 'giờ', ['Tư vấn trực tiếp hoặc video', 'Phác đồ bằng văn bản'], 'Trong 48 giờ'),
    V('tech', '🧪', 'Phân tích đất & nước', 'Lấy mẫu, đo pH, EC, NPK, hữu cơ; khuyến cáo cải tạo.', 350000, 'mẫu', ['Lấy mẫu tại vườn', 'Kết quả & khuyến cáo'], '5 ngày làm việc'),
    V('tech', '🏡', 'Thiết kế vườn thủy canh tại nhà', 'Khảo sát, thiết kế và lắp đặt giàn thủy canh ban công, sân thượng.', 0, 'gói', ['Khảo sát', 'Bản vẽ & dự toán', 'Bảo hành 12 tháng'], 'Theo khảo sát', 'all', 'Báo giá sau khảo sát'),
    V('process', '🔥', 'Sấy dược liệu', 'Sấy lạnh / sấy nhiệt dược liệu tươi đạt độ ẩm bảo quản.', 15000, 'kg tươi', ['Sơ chế, thái lát', 'Sấy đạt ẩm ≤ 12%', 'Đóng túi zip'], '2–3 ngày'),
    V('process', '❄️', 'Gửi kho lạnh bảo quản', 'Bảo quản rau quả, nấm trong kho lạnh 2–6 °C có giám sát nhiệt độ.', 1000, 'kg/ngày', ['Giám sát nhiệt độ 24/7', 'Xuất nhập theo yêu cầu'], 'Nhận ngay'),
    V('process', '🫙', 'Đóng gói hút chân không', 'Đóng gói hút chân không, dán tem truy xuất QR.', 3000, 'túi', ['Túi PA/PE', 'Tem QR truy xuất'], 'Trong ngày'),
    V('machine', '🚜', 'Cày xới đất bằng máy', 'Cày, xới, lên luống bằng máy xới đa năng.', 60000, '100 m²', ['Máy & người vận hành', 'Lên luống theo yêu cầu'], 'Theo lịch máy'),
    V('machine', '🛸', 'Phun thuốc bằng drone', 'Drone phun chế phẩm sinh học, phân bón lá cho ruộng lớn.', 250000, 'ha', ['Drone & phi công', 'Bản đồ bay'], 'Đặt trước 3 ngày'),
    V('monitor', '📹', 'Camera riêng cho lô thuê', 'Lắp camera xem trực tuyến 24/7 lô vườn/chuồng của riêng bạn.', 100000, 'tháng', ['Camera ngoài trời, hồng ngoại', 'Xem trên cổng khách thuê'], 'Lắp trong 3 ngày', 'tenant'),
    V('monitor', '🤖', 'Cảm biến & tưới tự động cho lô', 'Cảm biến ẩm đất, van tưới tự động theo lịch và theo cảm biến.', 150000, 'tháng', ['Cảm biến ẩm đất', 'Van tưới & bộ điều khiển', 'Cảnh báo qua ứng dụng'], 'Lắp trong 5 ngày', 'tenant')
  ];
}
function seedLive() {
  const units = S.units, pick = t => units.filter(u => u.type === t);
  const C = (unitId, name, access) => S.cams.push({ id: uid(), name, unitId, kind: 'sim', url: '', access, on: true, note: '' });
  pick('poultry').slice(0, 2).forEach((u, i) => C(u.id, `${u.name} – ${i ? 'toàn cảnh' : 'máng ăn uống'}`, 'public'));
  pick('mushroom').slice(0, 1).forEach(u => C(u.id, `${u.name} – kệ nấm`, 'public'));
  pick('veg').slice(0, 1).forEach(u => C(u.id, `${u.name} – luống rau`, 'public'));
  const k = S.contracts.find(c => c.status === 'active' && get('plots', c.plotId)), ku = k && get('units', get('plots', k.plotId).unitId);
  if (ku) C(ku.id, `${ku.name} – khu vườn khách thuê`, 'tenant');
  pick('herb').slice(0, 1).forEach(u => C(u.id, `${u.name} – vườn dược liệu`, 'public'));
  const dev = (u, kind) => S.devices.find(d => d.tid === u.id && d.kind === kind);
  const G = (u, name, model, kinds, sim) => { const ds = kinds.map(k => dev(u, k)).filter(Boolean); if (u && ds.length) S.gateways.push({ id: 'gw' + uid().slice(0, 8), name, unitId: u.id, proto: 'http', model, devIds: ds.map(d => d.id), sim, note: '', created: today(), lastSeen: 0 }); };
  const v = pick('veg')[0], p = pick('poultry')[0], m = pick('mushroom')[0];
  if (v) G(v, 'Tủ tưới nhỏ giọt ' + v.name, 'ESP32 + relay 4 kênh', ['pump', 'doser', 'curtain'], true);
  if (p) G(p, 'Tủ điều khiển chuồng ' + p.name, 'PLC S7-1200', ['fan', 'pad', 'heater'], false);
  if (m) G(m, 'Bộ phun sương ' + m.name, 'ESP32', ['mist', 'fan'], true);
  const Sc = (u, kind, time, dur, name) => { const d = u && dev(u, kind); if (d) S.careSched.push({ id: uid(), name, unitId: u.id, devId: d.id, time, dur, days: [0, 1, 2, 3, 4, 5, 6], en: true }); };
  Sc(v, 'pump', '06:00', 15, 'Tưới nhỏ giọt sáng'); Sc(v, 'pump', '16:30', 15, 'Tưới nhỏ giọt chiều');
  Sc(m, 'mist', '09:00', 5, 'Phun sương giữ ẩm'); Sc(m, 'mist', '13:00', 5, 'Phun sương trưa'); Sc(m, 'mist', '17:00', 5, 'Phun sương chiều');
  Sc(p, 'fan', '11:00', 120, 'Thông gió giờ nóng');
  S.svcBookings.push({ id: uid(), code: code('DV'), date: today(), serviceId: 'svd8', svcName: 'Tham quan nông trại có hướng dẫn', unit: 'người', qty: 12, price: 80000, total: 960000, wantDate: addDays(today(), 3), customerId: '', name: 'Trường Tiểu học Tản Lĩnh', phone: '0243 881 222', note: 'Lớp 4A, 2 giáo viên đi kèm', status: 'Mới' });
}
