'use strict';
/* =====================================================================
   DHT Smart Farm — ☁️ ĐỒNG BỘ MÁY CHỦ SUPABASE
   • Quản trị viên (Supabase Auth + bảng farm_admins): kéo/đẩy toàn bộ dữ
     liệu (farm_state, khóa lạc quan theo version), xuất bản công khai
     (farm_public) và dữ liệu riêng từng khách thuê (farm_tenants), xử lý
     hộp thư đến (farm_inbox) — giá, tồn kho được tính lại tại đây.
   • Khách vãng lai: đọc farm_public; đơn hàng/đặt giống/đăng ký gửi vào inbox.
   • Khách thuê: đăng nhập qua hàm farm_tenant_login (kiểm tra băm mã ở máy
     chủ); yêu cầu/đơn gửi qua farm_tenant_submit.
   Không dùng thư viện ngoài — gọi thẳng REST API của Supabase.
   ===================================================================== */
const CLOUD_DEFAULT = {
  url: 'https://sjjkobhjnzryiqzbeemi.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqamtvYmhqbnpyeWlxemJlZW1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjAxOTMsImV4cCI6MjA5OTczNjE5M30.t7tz2bstD4zBPSWj6Efg5DSjEmmrQqcS5PzUzNWBurA',
  enabled: true
};
const Cloud = (() => {
  const K_CFG = 'dht_farm_cloud', K_SES = 'dht_farm_cloud_ses';
  const rd = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } };
  let cfg = Object.assign({}, CLOUD_DEFAULT, window.FARM_SUPABASE || {}, rd(K_CFG) || {});
  let ses = rd(K_SES);
  const enabled = () => !!(cfg.enabled && cfg.url && cfg.anonKey);
  async function http(path, o = {}) {
    const useAuth = o.auth !== false && ses && ses.access_token;
    if (useAuth && ses.expires_at && Date.now() / 1000 > ses.expires_at - 60 && !o.noRefresh) await refresh();
    let res;
    try {
      res = await fetch(cfg.url.replace(/\/$/, '') + path, {
        method: o.method || 'GET',
        headers: Object.assign({ apikey: cfg.anonKey, Authorization: 'Bearer ' + (useAuth ? ses.access_token : cfg.anonKey), 'Content-Type': 'application/json' }, o.headers || {}),
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined
      });
    } catch (e) { const err = new Error('Không kết nối được máy chủ (mất mạng hoặc sai địa chỉ)'); err.offline = true; throw err; }
    const txt = await res.text(); let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error_description || data.msg || data.error)) || ('Lỗi máy chủ ' + res.status));
      err.status = res.status; err.code = data && data.code; throw err;
    }
    return data;
  }
  function setSes(d, email) {
    ses = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), email: email || (d.user && d.user.email) || (ses && ses.email) || '', admin: !!(ses && ses.admin) };
    wr(K_SES, ses);
  }
  async function refresh() {
    try { setSes(await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: ses.refresh_token } })); }
    catch (e) { if (!e.offline) { ses = null; wr(K_SES, null); } throw e; }
  }
  const api = {
    enabled, config: () => Object.assign({}, cfg), session: () => ses,
    setConfig(c) { cfg = Object.assign({}, cfg, c); wr(K_CFG, { url: cfg.url, anonKey: cfg.anonKey, enabled: cfg.enabled }); },
    isAdminSession: () => !!(enabled() && ses && ses.admin),
    async signIn(email, password) {
      setSes(await http('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }), email);
      let ok = false;
      try { ok = await http('/rest/v1/rpc/is_farm_admin', { method: 'POST', body: {} }); }
      catch (e) { await api.signOut(); throw new Error(e.status === 404 ? 'Máy chủ chưa được thiết lập — hãy chạy file supabase-farm.sql trong Supabase' : e.message); }
      if (ok !== true) { await api.signOut(); throw new Error('Tài khoản chưa được cấp quyền quản trị nông trại (bảng farm_admins)'); }
      ses.admin = true; wr(K_SES, ses);
    },
    async signOut() { try { if (ses) await http('/auth/v1/logout', { method: 'POST', noRefresh: true }); } catch (e) { /* bỏ qua */ } ses = null; wr(K_SES, null); },
    async pullState() { const r = await http('/rest/v1/farm_state?id=eq.main&select=data,version,updated_at'); return (r && r[0]) || null; },
    async pushState(data, base) {
      if (!base) {
        try { const r = await http('/rest/v1/farm_state', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { id: 'main', data, version: 1 } }); return r[0].version; }
        catch (e) { if (e.status === 409 || e.code === '23505') return -1; throw e; }
      }
      const r = await http(`/rest/v1/farm_state?id=eq.main&version=eq.${base}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { data, version: base + 1, updated_at: new Date().toISOString() } });
      return r && r.length ? r[0].version : -1;
    },
    pushPublic: data => http('/rest/v1/farm_public?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { id: 'main', data, updated_at: new Date().toISOString() } }),
    async pushTenants(rows) {
      if (rows.length) await http('/rest/v1/farm_tenants?on_conflict=username', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows.map(r => ({ ...r, updated_at: new Date().toISOString() })) });
      const keep = rows.map(r => '"' + r.username + '"').join(',');
      await http('/rest/v1/farm_tenants?username=' + encodeURIComponent(rows.length ? `not.in.(${keep})` : 'not.is.null'), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    pullInbox: () => http('/rest/v1/farm_inbox?processed=eq.false&order=id.asc&limit=200&select=id,kind,customer_id,payload,created_at'),
    markInbox: ids => ids.length ? http('/rest/v1/farm_inbox?id=' + encodeURIComponent(`in.(${ids.join(',')})`), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { processed: true, processed_at: new Date().toISOString() } }) : null,
    async loadPublic() { const r = await http('/rest/v1/farm_public?id=eq.main&select=data,updated_at', { auth: false }); return (r && r[0]) || null; },
    submitAnon: (kind, payload) => http('/rest/v1/farm_inbox', { method: 'POST', auth: false, headers: { Prefer: 'return=minimal' }, body: { kind, payload } }),
    tenantLogin: (u, c) => http('/rest/v1/rpc/farm_tenant_login', { method: 'POST', auth: false, body: { p_user: u, p_code: c } }),
    tenantSubmit: (u, c, kind, payload) => http('/rest/v1/rpc/farm_tenant_submit', { method: 'POST', auth: false, body: { p_user: u, p_code: c, p_kind: kind, p_payload: payload } })
  };
  return api;
})();

/* ------------------------ XUẤT DỮ LIỆU LÊN MÁY CHỦ ------------------------ */
const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
function exportState() {
  const o = JSON.parse(JSON.stringify(S)); delete o.cloud;
  const cut = Date.now() - 3 * DAY;
  o.readings = (o.readings || []).filter(r => r.ts >= cut); o.iotLog = (o.iotLog || []).slice(-50);
  return o;
}
function buildPublic() {
  const lotIds = new Set(S.listings.map(l => l.lotId).filter(Boolean));
  const recentLots = S.lots.filter(l => diffDays(l.date, today()) <= 180).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 150);
  const traceDocs = {};
  for (const l of recentLots) { try { traceDocs[l.code.toUpperCase()] = traceDoc(l, true); } catch (e) { /* lô thiếu dữ liệu */ } }
  return {
    rentInit: true, seedInit: true, pubAt: Date.now(),
    farm: pick(S.farm, ['name', 'owner', 'address', 'phone', 'code']), info: S.info, pay: pick(payCfg(), ['bin', 'account', 'holder', 'vat']),
    plans: S.plans, terms: S.terms, siteZones: S.siteZones, zoneOrder: S.zoneOrder,
    units: S.units.map(u => pick(u, ['id', 'name', 'type', 'area', 'capacity', 'location', 'note'])),
    plots: S.plots.map(p => pick(p, ['id', 'code', 'unitId', 'size', 'status', 'note'])),
    batches: S.batches.filter(b => b.status === 'active').map(b => ({ ...pick(b, ['id', 'unitId', 'sopId', 'start', 'status', 'qty']), name: sopOf(b).name })),
    listings: S.listings.filter(l => l.active).map(l => ({ ...l, stock: listingStock(l), blockedUntil: listingBlocked(l) || '' })),
    lots: S.lots.filter(l => lotIds.has(l.id)).map(l => pick(l, ['id', 'code', 'date', 'remain', 'product', 'unit', 'grade', 'expiry'])),
    events: S.events.map(e => ({ ...e, regs: [{ qty: sum(e.regs, r => r.qty), agg: true }] })),
    news: S.news, seeds: S.seeds.filter(s => s.active), seedLots: S.seedLots.map(l => pick(l, ['id', 'seedId', 'code', 'qty', 'allocated', 'readyDate', 'quarantine'])),
    traceDocs
  };
}
function buildTenants() {
  return S.customers.filter(c => c.username && S.contracts.some(k => k.customerId === c.id && k.accessHash && ['active', 'pending'].includes(k.status))).map(c => {
    const cs = S.contracts.filter(k => k.customerId === c.id), bids = new Set(cs.flatMap(k => k.batchIds || []));
    const bs = S.batches.filter(b => bids.has(b.id)), units = new Set(bs.map(b => b.unitId));
    const readings = []; units.forEach(u => readings.push(...S.readings.filter(r => r.tid === u).slice(-24)));
    return {
      username: c.username.toLowerCase(), customer_id: c.id,
      auth: cs.filter(k => k.accessHash && ['active', 'pending'].includes(k.status)).map(k => ({ salt: k.salt, hash: k.accessHash })),
      data: {
        customer: c, contracts: cs.map(k => { const x = { ...k }; delete x.accessHash; delete x.salt; return x; }),
        invoices: S.invoices.filter(i => i.customerId === c.id), requests: S.requests.filter(r => r.customerId === c.id),
        orders: S.orders.filter(o => o.customerId === c.id), seedOrders: S.seedOrders.filter(o => o.customerId === c.id),
        eventRegs: S.events.flatMap(e => e.regs.filter(r => r.customerId === c.id).map(r => ({ eventId: e.id, ...r }))),
        batches: bs, tasks: S.tasks.filter(t => bids.has(t.batchId)), logs: S.logs.filter(l => bids.has(l.batchId)),
        lots: S.lots.filter(l => bids.has(l.batchId)).map(l => ({ ...l, moves: l.moves.filter(m => m.type === 'deliver') })),
        plots: S.plots.filter(p => cs.some(k => k.plotId === p.id)), readings
      }
    };
  });
}

/* ---------------- NHẬN ĐƠN TỪ WEBSITE (tính lại giá & tồn kho) ---------------- */
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
function applyInbox(rows) {
  let n = 0;
  for (const r of rows) {
    const p = r.payload || {}, cid = r.customer_id && get('customers', r.customer_id) ? r.customer_id : '';
    try {
      if (r.kind === 'order' && p.order) n += inOrder(p.order, cid);
      else if (r.kind === 'seed_order' && p.order) n += inSeedOrder(p.order, cid);
      else if (r.kind === 'event_reg') n += inEventReg(p, cid);
      else if (r.kind === 'request' && cid && p.request) n += inRequest(p.request, cid);
      else if (r.kind === 'task_done' && cid) n += inTaskDone(p, cid);
    } catch (e) { console.warn('[DHT] Bỏ qua dữ liệu inbox #' + r.id, e); }
  }
  return n;
}
function inOrder(o, cid) {
  const items = [], problems = [];
  for (const it of (o.items || []).slice(0, 30)) {
    const l = get('listings', it.lid), qty = Math.max(0, +it.qty || 0);
    if (!l || !l.active || !qty) continue;
    if (qty > listingStock(l) + 1e-9 || listingBlocked(l)) { problems.push(l.title); continue; }
    const lot = get('lots', l.lotId);
    items.push({ lid: l.id, title: l.title, qty, price: l.price, unit: l.unit, lotId: lot ? lot.id : '', lotCode: lot ? lot.code : '', sellerType: l.sellerType, sellerId: l.sellerId || '' });
  }
  if (!items.length && !problems.length) return 0;
  const cust = get('customers', cid), delivery = o.delivery === 'ship' ? 'ship' : 'pickup';
  const q = quote(items.map(i => ({ qty: i.qty, l: get('listings', i.lid) })), { customerId: cid, delivery });
  const codeOk = /^DH[0-9]{6}-[A-Z0-9]{3}$/.test(o.code || '') && !S.orders.some(x => x.code === o.code);
  const no = { id: uid(), code: codeOk ? o.code : code('DH'), date: today(), customerId: cid, name: cust ? cust.name : clip(o.name, 80), phone: cust ? cust.phone : clip(o.phone, 20), delivery, address: clip(o.address, 200), pay: ['Chuyển khoản', 'Tiền mặt', 'Ví điện tử'].includes(o.pay) ? o.pay : 'Chuyển khoản', note: clip(o.note, 300) + (problems.length ? ' ⚠ Không đủ hàng/đang cách ly: ' + problems.join(', ') : ''), status: 'Mới', paid: false, member: q.member, items, sub: q.sub, disc: q.disc, ship: q.ship, total: q.total, source: 'web' };
  for (const it of items) { const lot = get('lots', it.lotId), l = get('listings', it.lid); if (lot) { lot.remain = +(lot.remain - it.qty).toFixed(3); lot.moves.push({ date: no.date, type: 'sale', qty: it.qty, price: it.price, buyer: no.name, orderId: no.id }); } else l.stock = +(l.stock - it.qty).toFixed(3); }
  S.orders.push(no); return 1;
}
function inSeedOrder(o, cid) {
  const s = get('seeds', o.seedId); if (!s) return 0;
  const qty = Math.max(0, Math.round(+o.qty || 0)), wantDate = /^\d{4}-\d{2}-\d{2}$/.test(o.wantDate || '') ? o.wantDate : today();
  if (!qty) return 0;
  const al = qty >= (s.minOrder || 1) ? allocate(s.id, qty, wantDate) : null, cust = get('customers', cid), total = qty * s.price;
  const codeOk = /^DG[0-9]{6}-[A-Z0-9]{3}$/.test(o.code || '') && !S.seedOrders.some(x => x.code === o.code);
  S.seedOrders.push({ id: uid(), code: codeOk ? o.code : code('DG'), date: today(), customerId: cid, name: cust ? cust.name : clip(o.name, 80), phone: cust ? cust.phone : clip(o.phone, 20), address: clip(o.address, 200), seedId: s.id, seedName: s.name, unit: s.unit, qty, price: s.price, total, deposit: Math.round(total * (s.depositPct || 0) / 100), wantDate, delivery: o.delivery === 'ship' ? 'ship' : 'pickup', note: clip(o.note, 300) + (al ? '' : ' ⚠ Chưa đủ giống cho ngày yêu cầu — cần liên hệ khách'), allocations: al || [], status: 'Mới', paid: '', source: 'web' });
  return 1;
}
function inEventReg(p, cid) {
  const e = get('events', p.eventId), reg = p.reg || {}; if (!e) return 0;
  const left = e.capacity - sum(e.regs, r => r.qty), qty = Math.min(Math.max(1, Math.round(+reg.qty || 1)), left);
  if (qty <= 0) return 0;
  const c = get('customers', cid);
  e.regs.push({ customerId: cid, name: c ? c.name : clip(reg.name, 80), phone: c ? c.phone : clip(reg.phone, 20), qty, paid: false, date: today(), source: 'web' });
  return 1;
}
function inRequest(r, cid) {
  const c = get('contracts', r.contractId); if (!c || c.customerId !== cid || c.status !== 'active') return 0;
  const type = REQ_TYPES.includes(r.type) ? r.type : 'Khác', date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : today(), note = clip(r.note, 500);
  const plot = get('plots', c.plotId), b = curBatch(c), cat = /thu hoạch/i.test(type) ? 'th' : 'kt';
  const t = { id: uid(), title: `🙋 ${type} – ${custName(cid)} (lô ${plot ? plot.code : ''}): ${note}`, date, cat, batchId: b ? b.id : '', unitId: plot ? plot.unitId : '', done: false, auto: false, assignee: defaultAssignee(get('units', plot && plot.unitId), cat) };
  S.tasks.push(t);
  S.requests.push({ id: uid(), customerId: cid, contractId: c.id, type, date, created: today(), note, fee: 0, status: 'Mới', taskId: t.id, source: 'web' });
  return 1;
}
function inTaskDone(p, cid) {
  const t = get('tasks', p.taskId), b = t && get('batches', t.batchId), c = b && get('contracts', b.contractId);
  if (!c || c.customerId !== cid || !t.byCustomer) return 0;
  t.done = !!p.done; t.doneAt = t.done ? Date.now() : null; return 1;
}

/* --------------------------- ĐỒNG BỘ QUẢN TRỊ --------------------------- */
const CloudSync = {
  busy: false, timer: null, err: '',
  meta() { return S.cloud || (S.cloud = { version: 0, dirty: true, lastSync: 0 }); },
  schedule(ms = 2500) { clearTimeout(this.timer); this.timer = setTimeout(() => this.sync(), ms); },
  importServer(srv) {
    S = Object.assign(EMPTY(), srv.data); S.cloud = { version: srv.version, dirty: false, lastSync: Date.now() };
    migrateExtra(); applyConfig(); saveLocal();
  },
  backupLocal() { try { localStorage.setItem('dht_farm_backup_' + Date.now(), JSON.stringify(S)); } catch (e) { /* đầy bộ nhớ */ } },
  async sync(o = {}) {
    if (!Cloud.isAdminSession() || this.busy || accessMode() !== 'admin' || UI.remoteState) return;
    this.busy = true; setCloudChip('⏳ Đang đồng bộ…');
    try {
      let m = this.meta();
      const srv = await Cloud.pullState();
      if (srv && srv.version > (m.version || 0)) {
        if (!m.version && !o.silent && !confirm(`Máy chủ đã có dữ liệu (cập nhật ${new Date(srv.updated_at).toLocaleString('vi-VN')}).\n\nOK = tải dữ liệu máy chủ về thiết bị này (thay dữ liệu trên máy).\nHủy = giữ dữ liệu trên máy và GHI ĐÈ máy chủ.`)) { m.version = srv.version; m.dirty = true; }
        else { if (m.dirty && m.version) { this.backupLocal(); toast('⚠️ Máy chủ có bản mới hơn — đã tải về; thay đổi chưa đồng bộ được sao lưu trên máy'); } this.importServer(srv); m = this.meta(); }
      } else if (!srv && !m.version && S.demoLogin && !o.force && !confirm('Dữ liệu trên máy đang là DỮ LIỆU MẪU. Vẫn đưa lên máy chủ và công khai trên website?\n(Chọn Hủy, rồi vào Cài đặt → "Xóa toàn bộ, bắt đầu trống" nếu muốn bắt đầu bằng dữ liệu thật.)')) {
        this.err = 'Chưa đồng bộ: đang giữ dữ liệu mẫu trên máy'; setCloudChip(); return;
      }
      const inbox = await Cloud.pullInbox();
      if (inbox && inbox.length) {
        const n = applyInbox(inbox);
        await Cloud.markInbox(inbox.map(r => r.id)); m.dirty = true;
        if (n) toast(`📥 Đã nhận ${n} đơn/yêu cầu mới từ website`);
      }
      if (m.dirty || o.force) {
        const v = await Cloud.pushState(exportState(), srv ? m.version : 0);
        if (v === -1) { this.busy = false; return this.sync(o); }
        m.version = v;
        await Cloud.pushPublic(buildPublic());
        await Cloud.pushTenants(buildTenants());
        m.dirty = false;
      }
      m.lastSync = Date.now(); this.err = ''; saveLocal();
      if (inbox && inbox.length || o.render) render();
    } catch (e) { this.err = e.message; if (!o.silent) toast('☁️ ' + e.message); }
    finally { this.busy = false; setCloudChip(); }
  }
};

/* ------------------ CHẾ ĐỘ XEM TỪ MÁY CHỦ (khách / khách thuê) ------------------ */
const credStore = { get() { try { return JSON.parse(sessionStorage.getItem('dht_tenant_cred')); } catch (e) { return null; } }, set(v) { try { if (v) sessionStorage.setItem('dht_tenant_cred', JSON.stringify(v)); else sessionStorage.removeItem('dht_tenant_cred'); } catch (e) { /* phiên riêng tư */ } } };
function fromPublic(pub) {
  const d = (pub && pub.data) || {};
  const s = Object.assign(EMPTY(), d); s.customers = []; s.cloud = null;
  return s;
}
function applyTenant(s, slice) {
  const d = slice.data || {}, merge = (k, arr) => { const ids = new Set((arr || []).map(x => x.id)); s[k] = [...s[k].filter(x => !ids.has(x.id)), ...(arr || [])]; };
  s.customers = d.customer ? [d.customer] : [];
  ['contracts', 'invoices', 'requests', 'orders', 'seedOrders', 'tasks', 'logs', 'readings'].forEach(k => { s[k] = d[k] || []; });
  merge('batches', d.batches); merge('lots', d.lots); merge('plots', d.plots);
  for (const r of d.eventRegs || []) { const e = s.events.find(x => x.id === r.eventId); if (!e) continue; const agg = e.regs.find(x => x.agg); if (agg) agg.qty = Math.max(0, agg.qty - r.qty); e.regs.push({ ...r, _b: true }); }
  return s;
}
function baseline() {
  UI.base = { orders: new Set(S.orders.map(x => x.id)), seedOrders: new Set(S.seedOrders.map(x => x.id)), requests: new Set(S.requests.map(x => x.id)), tasks: new Map(S.tasks.map(t => [t.id, !!t.done])) };
  S.events.forEach(e => e.regs.forEach(r => { r._b = true; }));
}
async function loadRemote(mode) {
  const pub = await Cloud.loadPublic();
  let s = fromPublic(pub);
  if (mode === 'tenant') {
    const cr = credStore.get();
    const slice = cr && await Cloud.tenantLogin(cr.u, cr.c);
    if (!slice) { credStore.set(null); setTenant(''); throw new Error('Phiên khách thuê đã hết hạn — vui lòng đăng nhập lại'); }
    s = applyTenant(s, slice); setTenant(slice.customer_id);
  }
  S = s; UI.remoteState = mode; UI.remotePub = pub; applyConfig(); baseline();
}
/* Gửi các thay đổi của khách (đơn, đặt giống, đăng ký, yêu cầu, việc tự làm) */
async function flushOutbox() {
  if (!UI.remoteState || !UI.base) return;
  const B = UI.base, out = UI.outbox || (UI.outbox = []);
  S.orders.filter(o => !B.orders.has(o.id)).forEach(o => { B.orders.add(o.id); out.push(['order', { order: o }]); });
  S.seedOrders.filter(o => !B.seedOrders.has(o.id)).forEach(o => { B.seedOrders.add(o.id); out.push(['seed_order', { order: o }]); });
  S.requests.filter(r => !B.requests.has(r.id)).forEach(r => { B.requests.add(r.id); out.push(['request', { request: r }]); });
  S.events.forEach(e => e.regs.forEach(r => { if (!r._b) { r._b = true; out.push(['event_reg', { eventId: e.id, reg: pick(r, ['name', 'phone', 'qty']) }]); } }));
  S.tasks.forEach(t => { if (B.tasks.has(t.id) && B.tasks.get(t.id) !== !!t.done) { B.tasks.set(t.id, !!t.done); out.push(['task_done', { taskId: t.id, done: !!t.done }]); } });
  const cr = credStore.get();
  while (out.length) {
    const [kind, payload] = out[0];
    try {
      if (UI.remoteState === 'tenant' && cr) await Cloud.tenantSubmit(cr.u, cr.c, kind, payload);
      else if (['order', 'seed_order', 'event_reg'].includes(kind)) await Cloud.submitAnon(kind, payload);
      out.shift();
    } catch (e) { toast('⚠️ Chưa gửi được lên máy chủ: ' + e.message + ' — sẽ thử lại'); setTimeout(flushOutbox, 15000); return; }
  }
}

/* ------------------------------ GẮN VÀO ỨNG DỤNG ------------------------------ */
function saveLocal() { UI.syncing = true; try { save(); } finally { UI.syncing = false; } }
const _saveBase = save;
save = function () {
  if (UI.remoteState) { flushOutbox(); return; }             /* dữ liệu máy chủ: không ghi đè dữ liệu quản trị trên máy */
  if (!UI.syncing && Cloud.isAdminSession() && S && accessMode() === 'admin') { const m = CloudSync.meta(); m.dirty = true; CloudSync.schedule(); }
  _saveBase();
};
const _doLoginLocal = doLogin;
doLogin = function (u, code) {
  if (!Cloud.enabled() || UI.remoteFailed) return _doLoginLocal(u, code);
  const msg = $('#loginMsg'); if (msg) msg.innerHTML = alertHtml({ lv: 'info', msg: 'Đang kiểm tra với máy chủ…' });
  Cloud.tenantLogin(String(u).trim(), code).then(res => {
    if (!res) { if ($('#loginMsg')) $('#loginMsg').innerHTML = alertHtml({ lv: 'bad', msg: 'Tên đăng nhập hoặc mã truy cập không đúng' }); return; }
    credStore.set({ u: String(u).trim(), c: code }); setTenant(res.customer_id);
    UI.remoteState = ''; location.hash = '#/portal/' + res.customer_id; render();
  }).catch(e => {
    let m = e.message;
    if (e.offline || e.status === 404) { UI.remoteFailed = m; if (UI.remoteState) restoreLocal(); m = _doLoginLocal(u, code); }  /* máy chủ chưa sẵn sàng: dùng dữ liệu trên thiết bị */
    if (m && $('#loginMsg')) $('#loginMsg').innerHTML = alertHtml({ lv: 'bad', msg: m });
  });
  return '';
};
const _logoutTenant = ACT.logout;
ACT.logout = d => { credStore.set(null); UI.remoteState = ''; _logoutTenant(d); };
function setCloudChip(txt) {
  const el = $('#cloudChip'); if (!el) return;
  const m = S && S.cloud;
  el.hidden = !(Cloud.isAdminSession() && accessMode() === 'admin');
  el.textContent = txt || (CloudSync.err ? '⚠️ Chưa đồng bộ' : m && m.lastSync ? '☁️ ' + new Date(m.lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + (m.dirty ? ' •' : '') : '☁️ Chưa đồng bộ');
  el.title = CloudSync.err || 'Đồng bộ máy chủ Supabase — bấm để đồng bộ ngay';
}
setInterval(() => { if (Cloud.isAdminSession() && document.visibilityState === 'visible' && navigator.onLine) CloudSync.sync({ silent: true }); }, 45000);
window.addEventListener('online', () => { if (Cloud.isAdminSession()) CloudSync.sync({ silent: true }); if (UI.remoteState) flushOutbox(); });
