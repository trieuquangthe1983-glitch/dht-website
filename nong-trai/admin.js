'use strict';
/* =====================================================================
   DHT Smart Farm — 🔐 PHÂN QUYỀN & CẤU HÌNH DỮ LIỆU
   • 3 vai trò: khách vãng lai (xem công khai) · khách thuê · quản trị viên
   • Quản trị đăng nhập bằng tài khoản Supabase (khi có máy chủ) hoặc mã
     quản trị ngoại tuyến của thiết bị (băm SHA-256 có salt)
   • Trang "Dữ liệu & cấu hình": gói thuê, điều khoản, quy hoạch & phân lô,
     hợp đồng, thanh toán, cổng thông tin, máy chủ & tài khoản
   ===================================================================== */
const PUBLIC_VIEWS = ['info', 'events', 'market', 'seeds', 'trace', 'login', 'adminlogin'];
const DEFAULT_PLANS = JSON.parse(JSON.stringify(RENT_PLANS)), DEFAULT_TERMS = COMMON_TERMS.slice(), DEFAULT_ZONES = JSON.parse(JSON.stringify(SERVICE_ZONES));
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return UI['_ss_' + k] || null; } }, set: (k, v) => { UI['_ss_' + k] = v; try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } } };
const isAdmin = () => Cloud.isAdminSession() || ss.get('dht_admin') === '1';
const tenantSession = () => !!ss.get('dht_tenant');
function accessMode() { return tenantSession() ? 'tenant' : isAdmin() ? 'admin' : 'public'; }
function applyConfig() {
  if (!Array.isArray(S.plans) || !S.plans.length) S.plans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
  if (!Array.isArray(S.terms) || !S.terms.length) S.terms = DEFAULT_TERMS.slice();
  if (!Array.isArray(S.siteZones)) S.siteZones = JSON.parse(JSON.stringify(DEFAULT_ZONES));
  RENT_PLANS.splice(0, RENT_PLANS.length, ...S.plans);
  COMMON_TERMS.splice(0, COMMON_TERMS.length, ...S.terms);
  SERVICE_ZONES.splice(0, SERVICE_ZONES.length, ...S.siteZones);
  UI._cfgRef = S.plans;
}
const _migrate0 = migrateExtra;
migrateExtra = function () { _migrate0(); applyConfig(); };
/* Dữ liệu quản trị lưu trên thiết bị (không lẫn với bản công khai đang xem) */
function localAdminData() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
function restoreLocal() { S = load() || seed(); migrateExtra(); UI.remoteState = ''; UI.base = null; save(); }
const hashPass = (salt, p) => { let h = String(p); for (let i = 0; i < 1000; i++) h = sha256(salt + ':' + h); return h; };

/* ------------------------------ ĐIỀU HƯỚNG ------------------------------ */
MODULES[0].groups[4][1].splice(1, 0, ['config', '🛠️', 'Dữ liệu & cấu hình']);
const adminEl = document.createElement('button'); adminEl.className = 'btn sm'; adminEl.id = 'adminBtn';
const chipEl = document.createElement('button'); chipEl.className = 'btn sm'; chipEl.id = 'cloudChip'; chipEl.hidden = true;
document.querySelector('.top-actions').prepend(adminEl); document.querySelector('.top-actions').prepend(chipEl);
adminEl.addEventListener('click', () => { if (isAdmin()) ACT.adminLogout(); else location.hash = '#/adminlogin'; });
chipEl.addEventListener('click', () => CloudSync.sync({ render: true }));
function publicNav(v) {
  const it = [['info', '🏡', 'Giới thiệu & bảng giá'], ['events', '🎉', 'Sự kiện & thông báo'], ['market', '🛒', 'Chợ nông trại'], ['seeds', '🧬', 'Ngân hàng con giống'], ['trace', '🔎', 'Truy xuất nguồn gốc']];
  return `<div class="grp">Nông trại</div>${it.map(([k, ic, l]) => `<a href="#/${k}" class="${v === k ? 'on' : ''}"><span>${ic}</span>${l}</a>`).join('')}<div class="grp">Tài khoản</div><a href="#/login" class="${v === 'login' ? 'on' : ''}"><span>👤</span>Khách thuê đăng nhập</a><a href="#/adminlogin" class="${v === 'adminlogin' ? 'on' : ''}"><span>🔐</span>Quản trị viên</a>`;
}
const _renderRent = render;
render = function () {
  const mode = accessMode(), r = route();
  document.body.classList.toggle('public', mode === 'public');
  document.body.classList.toggle('is-admin', mode === 'admin');
  if (mode === 'admin' && UI.remoteState) restoreLocal();
  if (mode !== 'admin' && Cloud.enabled() && UI.remoteState !== mode && !UI.remoteFailed) {
    $('#view').innerHTML = '<div class="empty">⏳ Đang tải dữ liệu nông trại từ máy chủ…</div>';
    if (!UI.remoteLoading) {
      UI.remoteLoading = true;
      loadRemote(mode).then(() => { UI.remoteLoading = false; render(); }).catch(e => {
        UI.remoteLoading = false;
        if (mode === 'tenant') { ss.set('dht_tenant', null); toast(e.message); location.hash = '#/login'; }
        else { UI.remoteFailed = e.message; if (!S || !S.farm) restoreLocal(); }
        render();
      });
    }
    return;
  }
  if (S) applyConfig();
  if (mode === 'public' && !PUBLIC_VIEWS.includes(r.v)) { if (location.hash !== '#/info') { location.hash = '#/info'; return; } }
  if (mode !== 'admin' && r.v === 'adminlogin' && isAdmin()) { location.hash = '#/dashboard'; return; }
  _renderRent();
  if (mode === 'public') $('#nav').innerHTML = publicNav(route().v);
  if (mode !== 'admin' && UI.remoteFailed && ['info', 'market', 'seeds', 'events'].includes(r.v)) $('#view').insertAdjacentHTML('afterbegin', alertHtml({ lv: 'warn', msg: 'Chưa kết nối được máy chủ — đang hiển thị dữ liệu trên thiết bị này. (' + UI.remoteFailed + ')' }));
  adminEl.innerHTML = mode === 'admin' ? '🔓 <span class="lbl">Thoát quản trị</span>' : '🔐 <span class="lbl">Quản trị</span>';
  adminEl.hidden = mode === 'tenant';
  setCloudChip();
};

/* ---------------------------- ĐĂNG NHẬP QUẢN TRỊ ---------------------------- */
VIEWS.adminlogin = {
  title: 'Đăng nhập quản trị', nav: 'dashboard',
  render() {
    const loc = localAdminData(), hasLocal = loc && loc.adminAuth;
    return `<div class="login-wrap"><div class="card login"><div style="text-align:center"><img src="icon.svg" alt="" width="52" height="52"><h2 style="margin:8px 0 2px">Quản trị nông trại</h2><small class="muted">Chỉ quản trị viên được truy cập phân hệ Quản trị farm và sửa dữ liệu</small></div>
      ${Cloud.enabled() ? `<h4>☁️ Tài khoản máy chủ (Supabase)</h4><form id="cloudLogin" autocomplete="on"><label class="f"><span>Email</span><input name="email" type="email" autocomplete="username" required></label><label class="f"><span>Mật khẩu</span><input name="pass" type="password" autocomplete="current-password" required></label><div id="cloudMsg"></div><button class="btn pri" style="width:100%;justify-content:center">Đăng nhập & đồng bộ</button></form>` : ''}
      <h4 class="sec">💻 ${hasLocal ? 'Mã quản trị trên thiết bị này (ngoại tuyến)' : 'Thiết lập mã quản trị cho thiết bị này'}</h4>
      ${hasLocal ? `<form id="localLogin"><label class="f"><span>Mã quản trị</span><input name="pass" type="password" autocomplete="current-password" required></label><div id="localMsg"></div><button class="btn ${Cloud.enabled() ? '' : 'pri'}" style="width:100%;justify-content:center">Đăng nhập ngoại tuyến</button></form>`
        : `<form id="localSetup"><label class="f"><span>Mã quản trị mới (≥ 8 ký tự)</span><input name="p1" type="password" autocomplete="new-password" minlength="8" required></label><label class="f"><span>Nhập lại</span><input name="p2" type="password" autocomplete="new-password" required></label><div id="localMsg"></div><button class="btn" style="width:100%;justify-content:center">Tạo mã & đăng nhập</button></form>`}
      <p class="muted" style="font-size:12px">${Cloud.enabled() ? 'Đăng nhập máy chủ để dữ liệu được đồng bộ và bảo vệ trên Supabase. ' : ''}Mã ngoại tuyến chỉ mở dữ liệu lưu trên chính thiết bị này, được lưu dạng băm SHA-256; sai 5 lần sẽ khóa 60 giây.</p></div></div>`;
  }
};
function adminIn() { UI.remoteState = ''; UI.remoteFailed = ''; restoreLocal(); location.hash = '#/dashboard'; render(); }
document.addEventListener('submit', e => {
  const f = e.target.elements, id = e.target.id;
  if (id === 'cloudLogin') {
    $('#cloudMsg').innerHTML = alertHtml({ lv: 'info', msg: 'Đang đăng nhập…' });
    Cloud.signIn(f.email.value.trim(), f.pass.value).then(() => { ss.set('dht_tenant', null); adminIn(); CloudSync.sync({ render: true }); toast('Đã đăng nhập quản trị (máy chủ)'); })
      .catch(err => { $('#cloudMsg').innerHTML = alertHtml({ lv: 'bad', msg: /invalid/i.test(err.message) ? 'Sai email hoặc mật khẩu' : err.message }); });
  }
  if (id === 'localLogin' || id === 'localSetup') {
    const now = Date.now(); if (UI.admLock && now < UI.admLock) { $('#localMsg').innerHTML = alertHtml({ lv: 'bad', msg: 'Tạm khóa, thử lại sau ' + Math.ceil((UI.admLock - now) / 1000) + ' giây' }); return; }
    const data = localAdminData() || null;
    if (id === 'localSetup') {
      if (f.p1.value.length < 8) { $('#localMsg').innerHTML = alertHtml({ lv: 'bad', msg: 'Mã tối thiểu 8 ký tự' }); return; }
      if (f.p1.value !== f.p2.value) { $('#localMsg').innerHTML = alertHtml({ lv: 'bad', msg: 'Hai lần nhập không khớp' }); return; }
      const salt = randomCode(8); restoreLocal(); S.adminAuth = { salt, hash: hashPass(salt, f.p1.value), at: today() }; save();
    } else {
      const a = data.adminAuth;
      if (hashPass(a.salt, f.pass.value) !== a.hash) { UI.admFail = (UI.admFail || 0) + 1; if (UI.admFail >= 5) { UI.admLock = now + 60000; UI.admFail = 0; } $('#localMsg').innerHTML = alertHtml({ lv: 'bad', msg: 'Mã quản trị không đúng' }); return; }
    }
    UI.admFail = 0; ss.set('dht_admin', '1'); ss.set('dht_tenant', null); adminIn(); toast('Đã đăng nhập quản trị');
  }
});
ACT.adminLogout = () => { ss.set('dht_admin', null); Cloud.signOut().finally(() => { UI.remoteState = ''; UI.remoteFailed = ''; location.hash = '#/info'; render(); }); toast('Đã thoát quản trị'); };

/* ---------------------------- DỮ LIỆU & CẤU HÌNH ---------------------------- */
Object.assign(UI, { cfgTab: 'plans' });
VIEWS.config = {
  title: 'Dữ liệu & cấu hình',
  render() {
    const t = UI.cfgTab;
    const tabs = [['plans', '📋 Gói thuê'], ['terms', '📜 Điều khoản'], ['site', '🗺️ Quy hoạch & phân lô'], ['contracts', '📝 Hợp đồng'], ['pay', '💳 Thanh toán'], ['portal', '📰 Cổng thông tin & hợp tác'], ['server', '☁️ Máy chủ & tài khoản']];
    let body = '';
    if (t === 'plans') body = `<div class="card-head"><h3>Gói thuê (hiển thị trên bảng giá & hợp đồng mới)</h3><div class="acts"><button class="btn sm" data-act="resetPlans">↺ Mặc định</button><button class="btn sm pri" data-act="planEdit">＋ Gói mới</button></div></div>` + tbl(['Gói', 'Đối tượng', 'Loại hình', ['Đơn giá', 'r'], ['Giá/gói', 'r'], 'Tính phí', 'Dịch vụ', ['Đang thuê', 'r'], ''], RENT_PLANS.map(p => `<tr><td>${esc(p.icon)} <b>${esc(p.n)}</b>${p.hidden ? ' ' + badge('Ẩn') : ''}</td><td><small>${esc(p.seg)}</small></td><td>${p.type ? esc(FARM_TYPES[p.type].n) : 'Mọi khu'}</td><td class="r num">${p.price ? money(p.price) + '/' + esc(p.unit) : '—'}</td><td class="r num">${p.price ? money(packPrice(p)) : nf(p.sharePct) + '% SL'}</td><td>${esc(BILLING[p.billing])}</td><td>${esc(SERVICE[p.service])}</td><td class="r num">${S.contracts.filter(c => c.planId === p.id && c.status === 'active').length}</td><td>${acts(editBtn('planEdit', p.id), S.contracts.some(c => c.planId === p.id) ? '' : `<button class="btn sm danger" data-act="planDel" data-id="${p.id}" aria-label="Xóa">🗑</button>`)}</td></tr>`));
    else if (t === 'terms') body = `<h3>Điều khoản chung của mọi hợp đồng thuê</h3><p class="muted" style="font-size:13px">Mỗi dòng là một điều khoản. Điều khoản riêng từng gói sửa trong tab Gói thuê. Hợp đồng đã ký giữ nguyên điều khoản tại thời điểm ký.</p><form id="termsForm"><textarea name="terms" style="min-height:280px">${esc(COMMON_TERMS.join('\n'))}</textarea><div class="form-actions" style="justify-content:flex-start"><button class="btn pri">Lưu điều khoản</button><button class="btn" type="button" data-act="resetTerms">↺ Mặc định</button></div></form>`;
    else if (t === 'site') {
      const Z = siteLayout();
      body = `<div class="grid g2"><div><div class="card-head"><h3>Thứ tự phân khu sản xuất</h3><button class="btn sm" data-act="bulkPlots">▦ Tạo lô hàng loạt</button></div>${Z.map((z, i) => `<div class="task"><div class="grow"><b>${z.letter}</b> · ${FARM_TYPES[z.u.type].icon} ${esc(z.u.name)} <small class="muted">${nf(z.u.area)} m² · ${z.plots.length} lô</small></div><div class="acts"><button class="btn sm" data-act="zoneMove" data-id="${z.u.id}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Lên">↑</button><button class="btn sm" data-act="zoneMove" data-id="${z.u.id}" data-d="1" ${i < Z.length - 1 ? '' : 'disabled'} aria-label="Xuống">↓</button><button class="btn sm" data-act="newPlot" data-id="${z.u.id}">＋ Lô</button><button class="btn sm" data-act="editUnit" data-id="${z.u.id}">✎</button></div></div>`).join('')}
        <div class="card-head sec"><h3>Khu dịch vụ chung</h3><div class="acts"><button class="btn sm" data-act="resetZones">↺ Mặc định</button><button class="btn sm pri" data-act="zoneEdit">＋ Khu</button></div></div>
        ${tbl(['Khu', 'Loại', 'Vị trí (x,y)', 'Kích thước', ''], SERVICE_ZONES.map((s, i) => `<tr><td>${esc(s.ic)} ${esc(s.n)}</td><td>${esc({ bld: 'Nhà/công trình', lot: 'Bãi', park: 'Sân/vườn', pond: 'Hồ nước' }[s.kind] || s.kind)}</td><td class="num">${s.x}, ${s.y}</td><td class="num">${s.w}×${s.h}${s.z ? ' · cao ' + s.z : ''}</td><td>${acts(`<button class="btn sm" data-act="zoneEdit" data-i="${i}">✎</button>`, `<button class="btn sm danger" data-act="zoneDel" data-i="${i}" aria-label="Xóa">🗑</button>`)}</td></tr>`))}
        <p class="muted" style="font-size:12px">Khung mặt bằng rộng 1000 × 640; dải khu dịch vụ nằm ở y ≈ 490–610 (phía dưới đường nội bộ).</p></div>
        <div>${sitePlan2D()}</div></div>
        <h3 class="sec" style="margin-bottom:8px">Danh mục lô</h3>${tbl(['Mã lô', 'Khu', ['Quy mô', 'r'], 'Trạng thái', 'Đặc điểm', ''], S.plots.map(p => `<tr><td><b>${esc(p.code)}</b></td><td>${esc((get('units', p.unitId) || {}).name || '')}</td><td class="r num">${nf(p.size)} ${plotUnitL(p)}</td><td>${badge({ free: 'Trống', rented: 'Đang thuê', reserved: 'Giữ chỗ', maint: 'Cải tạo' }[p.status])}</td><td><small>${esc(p.note || '')}</small></td><td>${acts(editBtn('editPlot', p.id), delBtn('plots', p.id))}</td></tr>`), 'Chưa có lô')}`;
    }
    else if (t === 'contracts') body = `<div class="card-head"><h3>Sửa hợp đồng với khách hàng</h3><button class="btn sm pri" data-act="newContract">＋ Hợp đồng mới</button></div>` + tbl(['Mã HĐ', 'Khách', 'Gói · lô', 'Thời hạn', ['Giá trị', 'r'], 'Trạng thái', ''], S.contracts.slice().sort((a, b) => b.start.localeCompare(a.start)).map(c => `<tr><td><b>${esc(c.code)}</b></td><td>${esc(custName(c.customerId))}</td><td>${planOf(c.planId).icon} ${esc(planOf(c.planId).n)} · ${esc((get('plots', c.plotId) || {}).code || '')}</td><td>${fds(c.start)} → ${fd(c.end)}</td><td class="r num">${short(c.sub != null ? c.sub : contractValue(c))}</td><td>${cStatus(c)}</td><td>${acts(`<button class="btn sm" data-act="contractEdit" data-id="${c.id}">✎ Sửa</button>`, `<button class="btn sm" data-act="contractDoc" data-id="${c.id}">📄</button>`)}</td></tr>`), 'Chưa có hợp đồng');
    else if (t === 'pay') { const P = payCfg(); body = `<h3>Thông tin thanh toán & thuế</h3><form id="payCfgForm" class="form-grid" style="max-width:720px;margin-top:10px"><label class="f"><span>Ngân hàng nhận tiền</span><select name="bin"><option value="">— Chọn ngân hàng —</option>${BANKS.map(([b, n]) => `<option value="${b}" ${P.bin === b ? 'selected' : ''}>${n} (${b})</option>`).join('')}</select></label><label class="f"><span>Số tài khoản</span><input name="account" value="${esc(P.account)}" inputmode="numeric"></label><label class="f"><span>Chủ tài khoản</span><input name="holder" value="${esc(P.holder)}"></label><label class="f"><span>Thuế GTGT tiền thuê (%)</span><input name="vat" type="number" step="any" min="0" value="${esc(P.vat)}"></label><div class="full form-actions" style="justify-content:flex-start"><button class="btn pri">Lưu</button></div></form>${P.bin && P.account ? `<div class="payqr">${QR.svg(vietQR({ bin: P.bin, account: P.account, amount: 100000, purpose: 'THU QR' }), 140, 'QR thử')}<small class="muted">QR thử 100.000 ₫ — quét để kiểm tra tên chủ tài khoản.</small></div>` : ''}`; }
    else if (t === 'portal') {
      const L = (h, ic, n, s) => `<a class="card batch" href="${h}"><b>${ic} ${n}</b><small class="muted">${s}</small></a>`;
      body = `<h3 style="margin-bottom:10px">Nội dung công khai & dữ liệu hợp tác</h3><div class="grid g3">
        <button class="card batch" data-act="editInfo" style="text-align:left;font:inherit;color:inherit"><b>🏡 Giới thiệu, giờ mở cửa, quy định</b><small class="muted">Sửa thông tin cổng thông tin</small></button>
        ${L('#/events', '🎉', 'Sự kiện & thông báo', `${S.events.length} sự kiện · ${S.news.length} thông báo`)}${L('#/market', '🛒', 'Gian hàng chợ nông trại', `${S.listings.length} sản phẩm`)}
        ${L('#/seedadmin', '🧬', 'Ngân hàng con giống', `${S.seeds.length} giống · ${S.seedLots.length} lô`)}${L('#/partners', '🤝', 'Đối tác liên kết', `${S.partners.length} đối tác`)}${L('#/sharing', '🚜', 'Chia sẻ máy móc', `${S.bookings.length} lịch`)}
        ${L('#/pools', '💹', 'Góp vốn theo lứa', `${S.pools.length} đợt`)}${L('#/community', '💬', 'Cộng đồng', `${S.posts.length} bài viết`)}${L('#/contracts', '👥', 'Khách hàng & hóa đơn', `${S.customers.length} khách`)}</div>`;
    }
    else {
      const c = Cloud.config(), sesn = Cloud.session(), m = S.cloud || {}, loc = localAdminData();
      body = `<div class="grid g2"><div><h3>☁️ Máy chủ Supabase</h3>
        ${Cloud.isAdminSession() ? alertHtml({ lv: CloudSync.err ? 'warn' : 'ok', html: `Đã đăng nhập <b>${esc(sesn.email)}</b> · phiên bản dữ liệu v${m.version || 0} · lần đồng bộ cuối ${m.lastSync ? new Date(m.lastSync).toLocaleString('vi-VN') : '—'}${m.dirty ? ' · <b>có thay đổi chưa đẩy</b>' : ''}${CloudSync.err ? '<br>⚠️ ' + esc(CloudSync.err) : ''}` }) : alertHtml({ lv: 'info', msg: Cloud.enabled() ? 'Đang dùng mã ngoại tuyến — dữ liệu chỉ lưu trên thiết bị này. Đăng xuất rồi đăng nhập bằng tài khoản Supabase để đồng bộ.' : 'Đồng bộ máy chủ đang tắt.' })}
        ${Cloud.isAdminSession() ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="btn pri" data-act="cloudSync">🔄 Đồng bộ ngay</button><button class="btn" data-act="cloudPush">⬆️ Đẩy toàn bộ lên máy chủ</button></div>` : ''}
        <form id="cloudCfgForm"><label class="f"><span>Project URL</span><input name="url" value="${esc(c.url)}"></label><label class="f"><span>Anon public key</span><input name="key" value="${esc(c.anonKey)}"></label><label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="en" ${c.enabled ? 'checked' : ''}><span style="margin:0;color:var(--text)">Bật đồng bộ máy chủ</span></label><button class="btn">Lưu cấu hình máy chủ</button></form>
        <h3 class="sec">🔑 Mã quản trị ngoại tuyến</h3><p class="muted" style="font-size:13px">${loc && loc.adminAuth ? 'Đã thiết lập ngày ' + fd(loc.adminAuth.at) : 'Chưa thiết lập'} — dùng khi mất mạng hoặc không dùng máy chủ.</p>
        <form id="passForm" class="form-grid"><label class="f"><span>Mã mới (≥ 8 ký tự)</span><input name="p1" type="password" autocomplete="new-password"></label><label class="f"><span>Nhập lại</span><input name="p2" type="password" autocomplete="new-password"></label><div class="full"><button class="btn">Đổi mã quản trị</button></div></form></div>
        <div><h3>🧭 Thiết lập máy chủ lần đầu</h3><ol class="setup">
          <li>Mở <b>Supabase → SQL Editor → New query</b>, dán toàn bộ nội dung file <a href="supabase-farm.sql" target="_blank" rel="noopener"><code>nong-trai/supabase-farm.sql</code></a> → <b>Run</b>.</li>
          <li><b>Authentication → Users → Add user</b>: tạo email + mật khẩu cho quản trị viên.</li>
          <li>Chạy lệnh cấp quyền (thay email):<pre>insert into public.farm_admins(user_id, email)
  select id, email from auth.users
  where email = '${esc((sesn && sesn.email) || 'email-quan-tri@vi-du.vn')}'
  on conflict (user_id) do nothing;</pre></li>
          <li>Thoát quản trị → đăng nhập lại bằng email/mật khẩu ở ô <b>Tài khoản máy chủ</b>. Lần đầu hệ thống hỏi dùng dữ liệu nào rồi đẩy lên máy chủ.</li>
          <li>Từ đó: khách xem website thấy <b>bản công khai</b> (không có thông tin cá nhân), khách thuê đăng nhập bằng mã hợp đồng, mọi đơn/đặt giống/yêu cầu gửi về hộp thư và được nhận khi quản trị viên mở ứng dụng.</li></ol></div></div>`;
    }
    return `<div class="tabs">${tabs.map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="cfgTab" data-k="${k}">${l}</button>`).join('')}</div><div class="card">${body}</div>`;
  }
};
function planEditForm(id) {
  const p = id ? RENT_PLANS.find(x => x.id === id) : null;
  openForm({
    title: p ? 'Sửa gói thuê' : 'Thêm gói thuê', data: p ? { ...p, incT: p.inc.join('\n'), termsT: (p.terms || []).join('\n') } : { icon: '🌱', type: 'veg', unit: 'm²', service: 'full', billing: 'month', min: 10, max: 100, def: 30, price: 20000, sharePct: 0, incT: '', termsT: '' },
    fields: d => [
      { k: 'icon', l: 'Biểu tượng' }, { k: 'n', l: 'Tên gói', req: true },
      { k: 'seg', l: 'Đối tượng khách hàng', full: true },
      { k: 'type', l: 'Loại hình khu', type: 'select', re: true, opts: [['', 'Mọi khu (hợp tác)'], ...Object.entries(FARM_TYPES).map(([k, v]) => [k, v.icon + ' ' + v.n])] },
      { k: 'sop', l: 'Quy trình mặc định', type: 'select', opts: [['', '—'], ...SOPS.filter(s => !d.type || s.type === d.type).map(s => [s.id, s.name])] },
      { k: 'unit', l: 'Đơn vị (1 gói = 10 đơn vị)', ph: 'm², con, bịch' },
      { k: 'billing', l: 'Tính phí', type: 'select', re: true, opts: Object.entries(BILLING) },
      { k: 'price', l: 'Đơn giá (₫/đơn vị/kỳ)', type: 'number', min: 0, hint: d.price ? `= ${money((+d.price || 0) * PACK)} mỗi gói ${PACK} đơn vị` : '' },
      d.billing === 'share' ? { k: 'sharePct', l: 'Tỷ lệ sản lượng chia khách (%)', type: 'number', min: 0 } : { k: 'priceL', l: 'Nhãn đơn giá', ph: '₫/m²/tháng' },
      { k: 'service', l: 'Mức dịch vụ mặc định', type: 'select', opts: Object.entries(SERVICE) },
      { k: 'min', l: 'Quy mô tối thiểu (đơn vị)', type: 'number', min: 1 }, { k: 'max', l: 'Quy mô tối đa', type: 'number', min: 1 }, { k: 'def', l: 'Quy mô gợi ý', type: 'number', min: 0 },
      { k: 'incT', l: 'Dịch vụ bao gồm (mỗi dòng một ý)', type: 'textarea' },
      { k: 'termsT', l: 'Điều khoản riêng của gói (mỗi dòng một điều)', type: 'textarea' },
      { k: 'hidden', l: 'Ẩn gói (không nhận hợp đồng mới, không hiện bảng giá)', type: 'checkbox' }
    ],
    submit: d => {
      const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
      const rec = { icon: d.icon || '🌱', n: d.n, seg: d.seg || '', type: d.type, sop: d.sop, unit: d.unit || 'm²', billing: d.billing, price: d.billing === 'share' ? 0 : (+d.price || 0), sharePct: d.billing === 'share' ? (+d.sharePct || 0) : 0, priceL: d.billing === 'share' ? 'Không phí thuê · chia sản lượng' : (d.priceL || `₫/${d.unit || 'm²'}/${d.billing === 'month' ? 'tháng' : 'vụ'}`), service: d.service, min: +d.min || 1, max: +d.max || 1000, def: +d.def || 0, inc: lines(d.incT), terms: lines(d.termsT), hidden: !!d.hidden };
      if (!rec.inc.length) return 'Nhập ít nhất một dịch vụ bao gồm';
      if (p) Object.assign(p, rec); else S.plans.push({ id: 'p' + uid(), ...rec });
    }
  });
}
function zoneEditForm(i) {
  const z = i != null ? SERVICE_ZONES[i] : null;
  openForm({
    title: z ? 'Sửa khu dịch vụ' : 'Thêm khu dịch vụ', data: z || { ic: '🏠', kind: 'bld', x: 30, y: 500, w: 130, h: 100, z: 24 },
    fields: [{ k: 'n', l: 'Tên khu', req: true, full: true }, { k: 'ic', l: 'Biểu tượng' }, { k: 'kind', l: 'Loại', type: 'select', opts: [['bld', 'Nhà / công trình (có chiều cao 3D)'], ['lot', 'Bãi xe / sân'], ['park', 'Sân chơi / vườn'], ['pond', 'Hồ nước']] },
      { k: 'x', l: 'Tọa độ x (0–1000)', type: 'number' }, { k: 'y', l: 'Tọa độ y (0–640)', type: 'number' }, { k: 'w', l: 'Rộng', type: 'number', min: 10 }, { k: 'h', l: 'Sâu', type: 'number', min: 10 }, { k: 'z', l: 'Chiều cao 3D (nhà)', type: 'number', min: 0 }],
    submit: d => {
      const rec = { n: d.n, ic: d.ic || '🏠', kind: d.kind, x: clamp(+d.x || 0, 0, 980), y: clamp(+d.y || 0, 0, 620), w: clamp(+d.w || 10, 10, 960), h: clamp(+d.h || 10, 10, 600), z: d.kind === 'bld' ? (+d.z || 20) : 0, color: z && z.color || '#e8dcc4' };
      if (z) Object.assign(z, rec); else S.siteZones.push(rec);
    }
  });
}
function bulkPlotsForm() {
  openForm({
    title: 'Tạo lô hàng loạt', ok: 'Tạo lô', data: { unitId: (S.units[0] || {}).id, count: 4, size: 30, start: 1 },
    fields: d => { const u = get('units', d.unitId) || {}; return [
      { k: 'unitId', l: 'Khu sản xuất', type: 'select', re: true, opts: opts(S.units, x => FARM_TYPES[x.type].icon + ' ' + x.name) },
      { k: 'prefix', l: 'Tiền tố mã lô', ph: 'VD: R1-', def: (u.name || '').split(' ').pop() + '-' },
      { k: 'start', l: 'Bắt đầu từ số', type: 'number', min: 1 }, { k: 'count', l: 'Số lô', type: 'number', min: 1 },
      { k: 'size', l: `Quy mô mỗi lô (${({ poultry: 'con', mushroom: 'bịch' })[u.type] || 'm²'})`, type: 'number', min: 1 }, { k: 'note', l: 'Đặc điểm chung', full: true }]; },
    submit: d => {
      const pre = d.prefix || '', made = [];
      if (!(d.count >= 1 && d.count <= 200)) return 'Số lô từ 1 đến 200';
      for (let i = 0, n = +d.start || 1; made.length < d.count && i < 1000; i++, n++) { const code = pre + String(n).padStart(2, '0'); if (S.plots.some(p => p.code === code)) continue; S.plots.push({ id: uid(), code, unitId: d.unitId, size: +d.size, status: 'free', note: d.note || '' }); made.push(code); }
      FORM.done = `Đã tạo ${made.length} lô: ${made[0]} → ${made[made.length - 1]}`;
    }
  });
}
function contractEditForm(id) {
  const c = get('contracts', id), id0 = c.identity || {};
  openForm({
    title: 'Sửa hợp đồng ' + c.code,
    data: { customerId: c.customerId, plotId: c.plotId, planId: c.planId, packs: c.packs || Math.round(c.qty / PACK), price: c.price, months: c.months, start: c.start, deposit: c.deposit, service: c.service, sharePct: c.sharePct, status: c.status, note: c.note, sign: id0.sign, color: id0.color, icon: id0.icon, style: id0.style },
    intro: alertHtml({ lv: 'info', msg: 'Hóa đơn đã lập không tự thay đổi. Nếu đổi giá hoặc thời hạn, hãy lập hóa đơn điều chỉnh (Gia hạn) hoặc ghi thu/chi trong Tài chính.' }),
    fields: [
      { k: 'customerId', l: 'Khách thuê', type: 'select', opts: opts(S.customers) },
      { k: 'plotId', l: 'Lô', type: 'select', opts: S.plots.filter(p => p.status === 'free' || p.id === c.plotId).map(p => [p.id, `${p.code} · ${nf(p.size)} ${plotUnitL(p)}`]) },
      { k: 'planId', l: 'Gói', type: 'select', opts: RENT_PLANS.map(p => [p.id, p.icon + ' ' + p.n]) },
      { k: 'packs', l: `Số gói (× ${PACK})`, type: 'number', min: 1 }, { k: 'price', l: 'Đơn giá (₫/đơn vị/kỳ)', type: 'number', min: 0 },
      { k: 'start', l: 'Ngày bắt đầu', type: 'date' }, { k: 'months', l: 'Thời hạn (tháng)', type: 'number', min: 1 },
      { k: 'deposit', l: 'Đặt cọc (₫)', type: 'number', min: 0 }, { k: 'service', l: 'Mức dịch vụ', type: 'select', opts: Object.entries(SERVICE) },
      c.billing === 'share' ? { k: 'sharePct', l: 'Tỷ lệ chia sản lượng (%)', type: 'number', min: 0 } : null,
      { k: 'status', l: 'Trạng thái', type: 'select', opts: [['pending', 'Chờ thanh toán'], ['active', 'Hiệu lực'], ['ended', 'Đã kết thúc'], ['cancelled', 'Đã hủy']] },
      { k: 'sign', l: 'Tên trên biển lô' }, { k: 'style', l: 'Hình thức biển', type: 'select', opts: SIGN_STYLES },
      { k: 'color', l: 'Màu nhận diện', type: 'select', opts: ID_COLORS.map(([v, n]) => [v, n]) }, { k: 'icon', l: 'Biểu tượng', type: 'select', opts: ID_ICONS },
      { k: 'note', l: 'Điều khoản bổ sung', type: 'textarea' }
    ],
    submit: d => {
      const plot = get('plots', d.plotId), plan = planOf(d.planId), qty = c.billing === 'share' ? plot.size : d.packs * PACK;
      if (c.billing !== 'share' && qty > plot.size) return `Lô ${plot.code} chỉ rộng ${nf(plot.size)} — tối đa ${Math.floor(plot.size / PACK)} gói`;
      if (d.plotId !== c.plotId) { const old = get('plots', c.plotId); if (old) { old.status = 'free'; delete old.holdBy; } }
      Object.assign(c, { customerId: d.customerId, plotId: d.plotId, planId: plan.id, packs: d.packs, qty, price: +d.price || 0, start: d.start, months: +d.months, end: addMonths(d.start, +d.months), deposit: +d.deposit || 0, service: d.service, sharePct: +d.sharePct || 0, status: d.status, note: d.note, identity: { sign: d.sign, color: d.color, icon: d.icon, style: d.style } });
      plot.status = c.status === 'active' ? 'rented' : c.status === 'pending' ? 'reserved' : 'free';
      if (c.status === 'active' && !curBatch(c) && c.sopId) startCycle(c, c.sopId, c.start > today() ? c.start : today());
      if (c.status !== 'active' && c.status !== 'pending') delete c.accessHash;
    }
  });
}
Object.assign(ACT, {
  cfgTab: d => { UI.cfgTab = d.k; render(); },
  planEdit: d => planEditForm(d.id),
  planDel: d => { if (!confirm('Xóa gói thuê này?')) return; S.plans = S.plans.filter(p => p.id !== d.id); applyConfig(); save(); render(); },
  resetPlans: () => { if (!confirm('Khôi phục 7 gói thuê mặc định? Gói tự tạo sẽ bị xóa (hợp đồng cũ vẫn giữ).')) return; const used = new Set(S.contracts.map(c => c.planId)); S.plans = [...JSON.parse(JSON.stringify(DEFAULT_PLANS)), ...S.plans.filter(p => used.has(p.id) && !DEFAULT_PLANS.some(x => x.id === p.id)).map(p => ({ ...p, hidden: true }))]; applyConfig(); save(); render(); },
  resetTerms: () => { if (!confirm('Khôi phục điều khoản mặc định?')) return; S.terms = DEFAULT_TERMS.slice(); applyConfig(); save(); render(); },
  resetZones: () => { if (!confirm('Khôi phục khu dịch vụ mặc định?')) return; S.siteZones = JSON.parse(JSON.stringify(DEFAULT_ZONES)); applyConfig(); save(); render(); },
  zoneEdit: d => zoneEditForm(d.i != null ? +d.i : null),
  zoneDel: d => { if (!confirm('Xóa khu dịch vụ này khỏi mặt bằng?')) return; S.siteZones.splice(+d.i, 1); applyConfig(); save(); render(); },
  zoneMove: d => { const ids = siteLayout().map(z => z.u.id), i = ids.indexOf(d.id), j = i + (+d.d); if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; S.zoneOrder = ids; save(); render(); },
  bulkPlots: () => bulkPlotsForm(), contractEdit: d => contractEditForm(d.id),
  cloudSync: () => CloudSync.sync({ render: true }),
  cloudPush: () => { if (!confirm('Đẩy toàn bộ dữ liệu trên máy lên máy chủ (ghi đè bản trên máy chủ)?')) return; CloudSync.meta().dirty = true; CloudSync.sync({ force: true, render: true }); }
});
document.addEventListener('submit', e => {
  const f = e.target.elements, id = e.target.id;
  if (id === 'termsForm') { S.terms = f.terms.value.split('\n').map(x => x.trim()).filter(Boolean); applyConfig(); save(); render(); toast('Đã lưu điều khoản'); }
  if (id === 'cloudCfgForm') { Cloud.setConfig({ url: f.url.value.trim(), anonKey: f.key.value.trim(), enabled: f.en.checked }); UI.remoteFailed = ''; render(); toast('Đã lưu cấu hình máy chủ'); }
  if (id === 'passForm') {
    if (f.p1.value.length < 8 || f.p1.value !== f.p2.value) { toast('Mã tối thiểu 8 ký tự và hai lần nhập phải khớp'); return; }
    const salt = randomCode(8); S.adminAuth = { salt, hash: hashPass(salt, f.p1.value), at: today() }; save(); render(); toast('Đã đổi mã quản trị ngoại tuyến');
  }
});
