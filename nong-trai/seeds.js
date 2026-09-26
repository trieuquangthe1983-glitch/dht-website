'use strict';
/* =====================================================================
   DHT Smart Farm — 🧬 NGÂN HÀNG CON GIỐNG
   Danh mục giống (gia cầm, nấm, rau, dược liệu) → lô sản xuất giống
   (số lượng, ngày xuất, nguồn bố mẹ, kiểm dịch) → đặt giống, giữ chỗ
   theo lô, thu cọc qua QR → giao giống.
   ===================================================================== */
const SEED_CATS = { poultry: '🐣 Gia cầm giống', mushroom: '🍄 Giống nấm', veg: '🌱 Cây giống & hạt rau', herb: '🌿 Giống dược liệu' };
const SEED_FLOW = ['Mới', 'Đã xác nhận', 'Sẵn sàng giao', 'Đã giao'];
const QUARANTINE = ['Đạt', 'Chờ kiểm', 'Không đạt'];
FIN_IN.push('Bán con giống');
Object.assign(UI, { seedCat: '', seedTab: 'orders' });
const adminNow = () => (typeof isAdmin === 'function' ? isAdmin() : true);

const lotFree = l => Math.max(0, (l.qty || 0) - (l.allocated || 0));
const usableLot = l => l.quarantine !== 'Không đạt';
function seedLotsOf(id) { return S.seedLots.filter(l => l.seedId === id && usableLot(l)).sort((a, b) => a.readyDate.localeCompare(b.readyDate)); }
function seedAvail(id) {
  const ls = seedLotsOf(id), t = today();
  const now = sum(ls.filter(l => l.readyDate <= t && l.quarantine === 'Đạt'), lotFree), later = ls.filter(l => lotFree(l) > 0 && (l.readyDate > t || l.quarantine !== 'Đạt'));
  return { now, total: sum(ls, lotFree), next: later[0] ? later[0].readyDate : '' };
}
/* Phân bổ số lượng từ các lô sẵn sàng trước hoặc đúng ngày khách cần */
function allocate(seedId, qty, wantDate, dry) {
  const ls = seedLotsOf(seedId).filter(l => l.readyDate <= wantDate && lotFree(l) > 0), out = [];
  let need = qty;
  for (const l of ls) { if (need <= 0) break; const take = Math.min(lotFree(l), need); out.push({ lotId: l.id, qty: take }); need -= take; }
  if (need > 0) return null;
  if (!dry) out.forEach(a => { const l = get('seedLots', a.lotId); l.allocated = (l.allocated || 0) + a.qty; });
  return out;
}
function release(o) { (o.allocations || []).forEach(a => { const l = get('seedLots', a.lotId); if (l) l.allocated = Math.max(0, (l.allocated || 0) - a.qty); }); o.allocations = []; }
function earliestDate(seedId, qty) {
  let acc = 0;
  for (const l of seedLotsOf(seedId)) { acc += lotFree(l); if (acc >= qty) return l.readyDate > today() ? l.readyDate : today(); }
  return '';
}
const seedOrderBadge = o => badge(o.status, { 'Mới': 'b-warn', 'Đã xác nhận': 'b-info', 'Sẵn sàng giao': 'b-info', 'Đã giao': 'b-ok', 'Đã hủy': '' }[o.status]) + (o.paid === 'full' ? ' ' + badge('Đã thu đủ', 'b-ok') : o.paid === 'deposit' ? ' ' + badge('Đã cọc', 'b-ok') : '');

/* ------------------------------ BIỂU MẪU ------------------------------ */
function seedForm(id) {
  const s = id ? get('seeds', id) : null;
  openForm({
    title: s ? 'Sửa giống' : 'Thêm giống vào danh mục', data: s || { cat: 'poultry', depositPct: 30, minOrder: 1, icon: '🐣', active: true },
    fields: d => [
      { k: 'name', l: 'Tên giống', req: true, full: true },
      { k: 'cat', l: 'Nhóm', type: 'select', re: true, opts: Object.entries(SEED_CATS) },
      { k: 'icon', l: 'Biểu tượng', ph: '🐣' },
      { k: 'variety', l: 'Giống / dòng', ph: 'VD: Ri lai Lương Phượng' },
      { k: 'origin', l: 'Nguồn gốc / đàn bố mẹ' },
      { k: 'standard', l: 'Tiêu chuẩn, chứng nhận, kiểm dịch', full: true },
      { k: 'unit', l: 'Đơn vị', req: true, ph: 'con, kg, bịch, khay, gói…' },
      { k: 'price', l: 'Giá (₫/đơn vị)', type: 'number', req: true, min: 0 },
      { k: 'minOrder', l: 'Đặt tối thiểu', type: 'number', min: 1 },
      { k: 'depositPct', l: 'Đặt cọc (%)', type: 'number', min: 0 },
      { k: 'sopId', l: 'Quy trình nuôi/trồng phù hợp', type: 'select', opts: [['', '—'], ...SOPS.filter(x => x.type === d.cat).map(x => [x.id, x.name])] },
      { k: 'commit', l: 'Cam kết chất lượng (tỷ lệ sống, nảy mầm, đổi bù…)', type: 'textarea' },
      { k: 'guide', l: 'Hướng dẫn nhận & chăm sóc ban đầu', type: 'textarea' },
      { k: 'active', l: 'Hiển thị trên ngân hàng giống', type: 'checkbox' }
    ],
    submit: d => { if (s) Object.assign(s, d); else S.seeds.push({ id: uid(), ...d }); }
  });
}
function seedLotForm(id, seedId) {
  const l = id ? get('seedLots', id) : null;
  if (!S.seeds.length) { toast('Hãy thêm giống vào danh mục trước'); return; }
  openForm({
    title: l ? 'Sửa lô giống ' + l.code : 'Thêm lô sản xuất giống', data: l || { seedId: seedId || S.seeds[0].id, readyDate: addDays(today(), 14), quarantine: 'Chờ kiểm', allocated: 0 },
    fields: [
      { k: 'seedId', l: 'Giống', type: 'select', opts: opts(S.seeds, x => `${x.icon || ''} ${x.name}`) },
      { k: 'code', l: 'Mã lô giống', ph: 'Để trống để tự sinh' },
      { k: 'qty', l: 'Số lượng sản xuất', type: 'number', req: true, min: 1 },
      { k: 'readyDate', l: 'Ngày sẵn sàng xuất', type: 'date', req: true },
      { k: 'source', l: 'Nguồn bố mẹ / vật liệu nhân giống', full: true },
      { k: 'quarantine', l: 'Kiểm dịch / kiểm định', type: 'select', opts: QUARANTINE },
      { k: 'note', l: 'Ghi chú (số giấy kiểm dịch, điều kiện bảo quản…)', type: 'textarea' }
    ],
    submit: d => {
      if (l && d.qty < (l.allocated || 0)) return `Lô đã giữ chỗ ${nf(l.allocated)} — không thể giảm dưới mức này`;
      const rec = { ...d, code: d.code || code('LG', d.readyDate) };
      if (l) Object.assign(l, rec); else S.seedLots.push({ id: uid(), allocated: 0, ...rec });
    }
  });
}
function seedOrderForm(seedId) {
  const s = get('seeds', seedId), tid = typeof tenantId === 'function' ? tenantId() : '', admin = adminNow();
  const av = seedAvail(seedId);
  if (!av.total) { toast('Giống này tạm hết — vui lòng quay lại sau'); return; }
  openForm({
    title: `Đặt giống: ${s.name}`, ok: 'Gửi đặt giống',
    data: { qty: Math.max(s.minOrder || 1, 1), wantDate: earliestDate(seedId, Math.max(s.minOrder || 1, 1)) || today(), customerId: tid || (admin ? '' : ''), delivery: 'pickup' },
    intro: d => {
      const q = +d.qty || 0, total = q * s.price, dep = Math.round(total * (s.depositPct || 0) / 100), ok = q > 0 && allocate(seedId, q, d.wantDate || today(), true);
      const e = earliestDate(seedId, q);
      return `<div class="alert info"><span class="ic">${esc(s.icon || '🧬')}</span><div class="grow"><b>${esc(s.name)}</b> · ${money(s.price)}/${esc(s.unit)}<br><small>${esc(s.standard || '')}</small><br>Thành tiền <b>${money(total)}</b> · đặt cọc ${nf(s.depositPct || 0)}% = <b>${money(dep)}</b>${s.commit ? `<br><small>✅ ${esc(s.commit)}</small>` : ''}</div></div>${q && !ok ? alertHtml({ lv: 'warn', msg: e ? `Chưa đủ ${nf(q)} ${s.unit} vào ngày ${fd(d.wantDate)} — sớm nhất ${fd(e)}.` : `Hiện chỉ còn ${nf(av.total)} ${s.unit}.` }) : ''}`;
    },
    fields: d => [
      admin ? { k: 'customerId', l: 'Khách hàng', type: 'select', re: true, opts: [['', 'Khách lẻ'], ...opts(S.customers), ['_new', '＋ Khách hàng mới']] } : null,
      ...(admin ? (d.customerId === '_new' ? newCustomerFields(d) : d.customerId ? [] : [{ k: 'name', l: 'Họ tên', req: true }, { k: 'phone', l: 'Điện thoại', req: true }])
        : tid ? [] : [{ k: 'name', l: 'Họ tên / đơn vị', req: true }, { k: 'phone', l: 'Điện thoại', req: true }]),
      { k: 'qty', l: `Số lượng (${s.unit}) · tối thiểu ${nf(s.minOrder || 1)}`, type: 'number', re: true, req: true, min: s.minOrder || 1 },
      { k: 'wantDate', l: 'Ngày muốn nhận', type: 'date', re: true, req: true },
      { k: 'delivery', l: 'Nhận giống', type: 'select', opts: [['pickup', 'Nhận tại nông trại'], ['ship', 'Giao tận nơi (phí theo thỏa thuận)']] },
      { k: 'address', l: 'Địa chỉ nhận', full: true },
      { k: 'note', l: 'Ghi chú (mục đích nuôi/trồng, quy mô…)', type: 'textarea' }
    ],
    submit: d => {
      if (!(d.qty >= (s.minOrder || 1))) return `Đặt tối thiểu ${nf(s.minOrder || 1)} ${s.unit}`;
      if (d.wantDate < today()) return 'Ngày nhận không được trước hôm nay';
      const al = allocate(seedId, d.qty, d.wantDate);
      if (!al) { const e = earliestDate(seedId, d.qty); return e ? `Chưa đủ giống vào ngày ${fd(d.wantDate)} — hãy chọn từ ngày ${fd(e)}` : 'Không đủ số lượng giống'; }
      const customerId = admin ? (d.customerId === '_new' ? takeCustomer(d) : d.customerId) : tid;
      const c = get('customers', customerId), total = d.qty * s.price;
      const o = { id: uid(), code: code('DG'), date: today(), customerId: customerId || '', name: c ? c.name : d.name, phone: c ? c.phone : d.phone, address: d.address || (c ? c.address : '') || '', seedId, seedName: s.name, unit: s.unit, qty: d.qty, price: s.price, total, deposit: Math.round(total * (s.depositPct || 0) / 100), wantDate: d.wantDate, delivery: d.delivery, note: d.note || '', allocations: al, status: 'Mới', paid: '' };
      S.seedOrders.push(o);
      setTimeout(() => seedOrderPanel(o.id), 0);
    },
    done: 'Đã gửi đặt giống'
  });
}
function seedOrderPanel(id) {
  const o = get('seedOrders', id), P = payCfg();
  const lots = (o.allocations || []).map(a => { const l = get('seedLots', a.lotId); return l ? `${esc(l.code)} (${nf(a.qty)}, xuất ${fds(l.readyDate)})` : ''; }).filter(Boolean).join(', ');
  const qr = o.deposit && P.bin && P.account ? `<div class="payqr">${QR.svg(vietQR({ bin: P.bin, account: P.account, amount: o.deposit, purpose: o.code }), 180, 'QR đặt cọc')}<table class="kv"><tr><td>Ngân hàng</td><td><b>${esc((BANKS.find(b => b[0] === P.bin) || [])[1] || P.bin)}</b></td></tr><tr><td>Số tài khoản</td><td><b>${esc(P.account)}</b></td></tr><tr><td>Chủ TK</td><td>${esc(P.holder || '')}</td></tr><tr><td>Tiền cọc</td><td><b>${money(o.deposit)}</b></td></tr><tr><td>Nội dung CK</td><td><b>${esc(o.code)}</b></td></tr></table></div>` : '';
  openPanel('Phiếu đặt giống ' + o.code, `<table class="kv"><tr><td>Giống</td><td><b>${esc(o.seedName)}</b></td></tr><tr><td>Số lượng</td><td>${nf(o.qty)} ${esc(o.unit)} × ${money(o.price)}</td></tr><tr><td>Thành tiền</td><td><b>${money(o.total)}</b></td></tr><tr><td>Đặt cọc</td><td>${money(o.deposit)}</td></tr><tr><td>Ngày nhận</td><td>${fd(o.wantDate)} · ${o.delivery === 'ship' ? 'giao tận nơi' : 'nhận tại trại'}</td></tr><tr><td>Người đặt</td><td>${esc(o.name || '')} ${esc(o.phone || '')}</td></tr>${adminNow() && lots ? `<tr><td>Giữ chỗ từ lô</td><td>${lots}</td></tr>` : ''}</table>
    ${qr}${alertHtml({ lv: 'info', msg: 'Nông trại sẽ gọi xác nhận đơn trong giờ làm việc. Giống được kiểm dịch và giao kèm hướng dẫn chăm sóc.' })}
    <div class="no-print"><button class="btn sm" data-act="printModal">🖨 In phiếu</button></div>`);
}

/* ------------------------------ TRANG ------------------------------ */
VIEWS.seeds = {
  title: 'Ngân hàng con giống',
  render() {
    const c = UI.seedCat, list = S.seeds.filter(s => s.active && (!c || s.cat === c));
    const admin = adminNow();
    return `<div class="card hero-farm"><div class="grow"><small>🧬 ${esc(S.farm.name)}</small><h2>Ngân hàng con giống</h2><p class="slogan">Giống sạch bệnh – rõ nguồn gốc – kiểm dịch từng lô</p>
      <p>Cung cấp con giống, phôi nấm, cây giống và giống dược liệu từ đàn bố mẹ, vườn nhân giống của nông trại. Đặt trước theo lịch xuất lô, giữ chỗ ngay khi đặt, nhận kèm hướng dẫn kỹ thuật theo quy trình chuẩn.</p></div></div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0"><button class="${!c ? 'on' : ''}" data-act="seedCat" data-k="">Tất cả</button>${Object.entries(SEED_CATS).map(([k, v]) => `<button class="${c === k ? 'on' : ''}" data-act="seedCat" data-k="${k}">${v}</button>`).join('')}</div><span class="grow"></span>${admin ? `<a class="btn admin-only" href="#/seedadmin">📋 Quản lý lô & đơn</a><button class="btn pri admin-only" data-act="newSeed">＋ Giống</button>` : ''}</div>
    <div class="shop">${list.map(s => {
      const av = seedAvail(s.id), sop = SOPS.find(x => x.id === s.sopId);
      return `<div class="card prod"><div class="pic">${esc(s.icon || '🧬')}</div><div class="grow"><b>${esc(s.name)}</b><br><small class="muted">${esc(s.variety || '')}${s.origin ? ' · ' + esc(s.origin) : ''}</small>
        <p style="font-size:13px;margin:6px 0">${esc(s.standard || '')}</p>${s.commit ? `<small class="t-ok">✅ ${esc(s.commit)}</small><br>` : ''}${sop ? `<small class="muted">📚 Phù hợp: ${esc(sop.name)}</small>` : ''}
        <div class="price">${money(s.price)}<small>/${esc(s.unit)}</small></div><small class="muted">Tối thiểu ${nf(s.minOrder || 1)} ${esc(s.unit)} · cọc ${nf(s.depositPct || 0)}%</small>
        <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap"><small>${av.now ? `<b class="t-ok">Sẵn ${nf(av.now)}</b>` : '<span class="muted">Chưa có sẵn</span>'}${av.next ? ` · lô tới ${fds(av.next)}` : ''}</small><span class="grow"></span>${av.total ? `<button class="btn sm pri" data-act="orderSeed" data-id="${s.id}">Đặt giống</button>` : badge('Tạm hết')}${admin ? `<span class="admin-only">${editBtn('editSeed', s.id)}</span>` : ''}</div></div></div>`;
    }).join('') || empty('Chưa có giống trong danh mục')}</div>`;
  }
};
VIEWS.seedadmin = {
  title: 'Lô giống & đơn đặt giống',
  render() {
    const t = UI.seedTab, today0 = today();
    const act = S.seedOrders.filter(o => o.status !== 'Đã hủy'), m = today0.slice(0, 7);
    const tabs = [['orders', `Đơn đặt giống (${S.seedOrders.filter(o => o.status === 'Mới').length} mới)`], ['lots', 'Lô sản xuất giống'], ['catalog', 'Danh mục giống']];
    let body = '';
    if (t === 'orders') body = tbl(['Mã', 'Ngày', 'Khách', 'Giống', ['SL', 'r'], 'Nhận', ['Tiền', 'r'], 'Trạng thái', ''], S.seedOrders.slice().sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code)).map(o => {
      const nx = SEED_FLOW[SEED_FLOW.indexOf(o.status) + 1];
      return `<tr><td><a href="#" data-act="seedPanel" data-id="${o.id}"><b>${esc(o.code)}</b></a></td><td>${fd(o.date)}</td><td>${o.customerId ? `<a href="#/portal/${o.customerId}">${esc(o.name)}</a>` : esc(o.name || '')}<br><small class="muted">${esc(o.phone || '')}</small></td><td>${esc(o.seedName)}</td><td class="r num">${nf(o.qty)} ${esc(o.unit)}</td><td>${fd(o.wantDate)}<br><small class="muted">${o.delivery === 'ship' ? '🚚 ' + esc(o.address || '') : '🏡 tại trại'}</small></td><td class="r num">${money(o.total)}<br><small class="muted">cọc ${short(o.deposit)}</small></td><td>${seedOrderBadge(o)}</td>
      <td>${acts(nx && o.status !== 'Đã hủy' ? `<button class="btn sm" data-act="seedNext" data-id="${o.id}">→ ${nx}</button>` : '', o.status !== 'Đã hủy' && !o.paid && o.deposit ? `<button class="btn sm" data-act="seedPay" data-id="${o.id}" data-k="deposit">Thu cọc</button>` : '', o.status !== 'Đã hủy' && o.paid !== 'full' ? `<button class="btn sm pri" data-act="seedPay" data-id="${o.id}" data-k="full">Thu đủ</button>` : '', o.status !== 'Đã giao' && o.status !== 'Đã hủy' ? `<button class="btn sm danger" data-act="seedCancel" data-id="${o.id}">Hủy</button>` : '')}</td></tr>`;
    }), 'Chưa có đơn đặt giống');
    else if (t === 'lots') body = tbl(['Mã lô', 'Giống', ['Sản xuất', 'r'], ['Đã giữ', 'r'], ['Còn', 'r'], 'Ngày xuất', 'Nguồn', 'Kiểm dịch', ''], S.seedLots.slice().sort((a, b) => a.readyDate.localeCompare(b.readyDate)).map(l => { const s = get('seeds', l.seedId) || {}; return `<tr><td><b>${esc(l.code)}</b></td><td>${esc(s.icon || '')} ${esc(s.name || '(đã xóa)')}</td><td class="r num">${nf(l.qty)}</td><td class="r num">${nf(l.allocated || 0)}</td><td class="r num ${lotFree(l) ? 't-ok' : ''}">${nf(lotFree(l))}</td><td>${fd(l.readyDate)}${l.readyDate <= today0 ? ' ' + badge('Sẵn sàng', 'b-ok') : ''}</td><td><small>${esc(l.source || '')}</small></td><td>${badge(l.quarantine, { 'Đạt': 'b-ok', 'Chờ kiểm': 'b-warn', 'Không đạt': 'b-bad' }[l.quarantine])}</td><td>${acts(editBtn('editSeedLot', l.id), (l.allocated || 0) ? '' : delBtn('seedLots', l.id))}</td></tr>`; }), 'Chưa có lô giống');
    else body = tbl(['Giống', 'Nhóm', ['Giá', 'r'], ['Sẵn / tổng còn', 'r'], 'Quy trình', 'Hiển thị', ''], S.seeds.map(s => { const av = seedAvail(s.id), sop = SOPS.find(x => x.id === s.sopId); return `<tr><td>${esc(s.icon || '')} <b>${esc(s.name)}</b><br><small class="muted">${esc(s.origin || '')}</small></td><td>${esc(SEED_CATS[s.cat] || '')}</td><td class="r num">${money(s.price)}/${esc(s.unit)}</td><td class="r num">${nf(av.now)} / ${nf(av.total)}</td><td><small>${esc(sop ? sop.name : '—')}</small></td><td>${s.active ? badge('Đang bán', 'b-ok') : badge('Ẩn')}</td><td>${acts(`<button class="btn sm" data-act="newSeedLot" data-id="${s.id}">＋ Lô</button>`, editBtn('editSeed', s.id), S.seedLots.some(l => l.seedId === s.id) ? '' : delBtn('seeds', s.id))}</td></tr>`; }), 'Chưa có giống');
    const btn = { lots: '<button class="btn pri" data-act="newSeedLot">＋ Lô giống</button>', catalog: '<button class="btn pri" data-act="newSeed">＋ Giống</button>' }[t] || '<a class="btn pri" href="#/seeds">＋ Đặt giống cho khách</a>';
    return `<div class="grid g4"><div class="card kpi"><span class="l">Đơn đang xử lý</span><span class="v">${act.filter(o => o.status !== 'Đã giao').length}</span></div><div class="card kpi"><span class="l">Doanh số tháng ${m.slice(5)}</span><span class="v t-ok">${short(sum(act.filter(o => o.date.startsWith(m)), o => o.total))}</span></div><div class="card kpi"><span class="l">Lô chờ kiểm dịch</span><span class="v ${S.seedLots.some(l => l.quarantine === 'Chờ kiểm') ? 't-warn' : ''}">${S.seedLots.filter(l => l.quarantine === 'Chờ kiểm').length}</span></div><div class="card kpi"><span class="l">Giống đang bán</span><span class="v">${S.seeds.filter(s => s.active).length}</span></div></div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0">${tabs.map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-act="seedTab" data-k="${k}">${l}</button>`).join('')}</div><span class="grow"></span>${btn}</div><div class="card">${body}</div>`;
  }
};
MODULES.push({ id: 'seeds', n: 'Ngân hàng giống', icon: '🧬', groups: [['Ngân hàng con giống', [['seeds', '🧬', 'Danh mục & đặt giống'], ['seedadmin', '📋', 'Lô giống & đơn đặt']]]] });
Object.assign(NAV_BADGES, { seedadmin: () => { const n = S.seedOrders.filter(o => o.status === 'Mới').length; return n ? `<span class="badge b-warn">${n}</span>` : ''; } });
Object.assign(ACT, {
  seedCat: d => { UI.seedCat = d.k; render(); }, seedTab: d => { UI.seedTab = d.k; render(); },
  newSeed: () => seedForm(), editSeed: d => seedForm(d.id), newSeedLot: d => seedLotForm(null, d.id), editSeedLot: d => seedLotForm(d.id),
  orderSeed: d => seedOrderForm(d.id), seedPanel: d => seedOrderPanel(d.id),
  seedNext: d => { const o = get('seedOrders', d.id); o.status = SEED_FLOW[SEED_FLOW.indexOf(o.status) + 1]; if (o.status === 'Đã giao') o.deliveredAt = today(); save(); render(); },
  seedPay: d => {
    const o = get('seedOrders', d.id), amt = d.k === 'deposit' ? o.deposit : o.total - (o.paid === 'deposit' ? o.deposit : 0);
    if (!confirm(`Xác nhận đã thu ${money(amt)} (${d.k === 'deposit' ? 'tiền cọc' : 'thanh toán đủ'}) đơn ${o.code}?`)) return;
    S.fin.push({ id: uid(), date: today(), type: 'in', cat: 'Bán con giống', amount: amt, batchId: '', note: `${o.code} · ${o.seedName} · ${o.name || ''}` });
    o.paid = d.k === 'deposit' ? 'deposit' : 'full'; save(); render(); toast('Đã ghi nhận thanh toán');
  },
  seedCancel: d => { const o = get('seedOrders', d.id); if (!confirm(`Hủy đơn ${o.code}? Số giống giữ chỗ sẽ được trả lại lô.`)) return; release(o); o.status = 'Đã hủy'; save(); render(); toast('Đã hủy đơn'); }
});
const _alertsSeed = computeAlerts;
computeAlerts = function () {
  const A = _alertsSeed(), n = S.seedOrders.filter(o => o.status === 'Mới').length, t = today();
  if (n) A.push({ lv: 'info', ic: '🧬', msg: `${n} đơn đặt giống mới chờ xác nhận`, link: '#/seedadmin' });
  for (const l of S.seedLots) if (l.quarantine === 'Chờ kiểm' && diffDays(t, l.readyDate) <= 3 && (l.allocated || 0) > 0) A.push({ lv: 'warn', ic: '🧪', msg: `Lô giống ${l.code} xuất ngày ${fd(l.readyDate)} chưa có kết quả kiểm dịch (${nf(l.allocated)} đã giữ chỗ)`, link: '#/seedadmin' });
  const o = { bad: 0, warn: 1, info: 2 };
  return A.sort((a, b) => o[a.lv] - o[b.lv]);
};

/* ----------------------------- DỮ LIỆU MẪU ----------------------------- */
function seedSeeds(D) {
  S.seedInit = true;
  const I = (id, cat, icon, name, variety, origin, standard, unit, price, minOrder, depositPct, sopId, commit, guide) => S.seeds.push({ id, cat, icon, name, variety, origin, standard, unit, price, minOrder, depositPct, sopId, commit, guide, active: true });
  I('sd1', 'poultry', '🐣', 'Gà lông màu 1 ngày tuổi', 'Ri lai × Lương Phượng', 'Đàn bố mẹ trại DHT', 'Đã tiêm Marek tại lò ấp · có giấy kiểm dịch vận chuyển', 'con', 12000, 50, 30, 'broiler', 'Tỷ lệ sống 7 ngày ≥ 97%; đổi bù con chết trong 3 ngày đầu', 'Làm ấm chuồng úm 32–33°C trước 24h; cho uống điện giải trước khi cho ăn.');
  I('sd2', 'poultry', '🐔', 'Gà đẻ hậu bị 18 tuần', 'Lương Phượng / ISA Brown', 'Trại hậu bị DHT', 'Đủ vaccine ND, IB, Gumboro, cúm H5, đậu', 'con', 115000, 10, 30, 'layer', 'Đồng đều ≥ 85%; vào đẻ tuần 20–21', 'Chuyển chuồng nhẹ nhàng, tăng dần ánh sáng lên 16h.');
  I('sd3', 'mushroom', '🌾', 'Giống nấm sò cấp 2 (hạt lúa)', 'Pleurotus ostreatus HK-35', 'Viện Di truyền Nông nghiệp', 'Tơ trắng đều, không nhiễm, 25–30 ngày tuổi', 'kg', 35000, 5, 20, 'oyster', 'Đổi giống nhiễm phát hiện trong 7 ngày', 'Bảo quản 15–20°C nơi tối, dùng trong 15 ngày.');
  I('sd4', 'mushroom', '🍄', 'Phôi nấm sò đã cấy (bịch 1,2 kg)', 'Nấm sò trắng', 'Xưởng phôi DHT', 'Hấp thanh trùng 100°C 12h, tơ ăn ≥ 80%', 'bịch', 9000, 50, 30, 'oyster', 'Tỷ lệ bịch nhiễm ≤ 5%, thay miễn phí phần vượt', 'Treo giàn, rạch bịch khi tơ kín, phun sương giữ ẩm 85–95%.');
  I('sd5', 'mushroom', '🟤', 'Phôi linh chi', 'Ganoderma lucidum GL-02', 'Xưởng phôi DHT', 'Mùn cưa cao su, tơ kín bịch', 'bịch', 15000, 50, 30, 'lingzhi', 'Tỷ lệ ra quả thể ≥ 90%', 'Mở nút cổ bịch, giữ CO₂ < 800 ppm khi ra quả.');
  I('sd6', 'veg', '🥬', 'Cây giống cải ngọt (khay 128 lỗ)', 'Cải ngọt lá xanh', 'Vườn ươm DHT', 'Giá thể sạch, cây 3–4 lá thật, không sâu bệnh', 'khay', 90000, 1, 0, 'leafy', 'Tỷ lệ sống sau trồng ≥ 95%', 'Trồng chiều mát, tưới đẫm ngay sau trồng.');
  I('sd7', 'veg', '🍅', 'Cây giống cà chua ghép', 'Cà chua beef ghép gốc cà tím', 'Vườn ươm DHT', 'Cây ghép 25–30 ngày, kháng héo xanh', 'cây', 3500, 100, 30, 'tomato', 'Đổi bù cây chết trong 7 ngày', 'Không vùi mắt ghép xuống đất; căng dây sau 10 ngày.');
  I('sd8', 'veg', '🥗', 'Hạt giống xà lách Lollo xanh', 'Lollo Bionda', 'Nhập khẩu, đóng gói lại', 'Tỷ lệ nảy mầm ≥ 90%, hạn dùng 12 tháng', 'gói', 25000, 1, 0, 'hydro', 'Nảy mầm ≥ 90% hoặc hoàn tiền', 'Gieo giá thể ẩm, che tối 2 ngày.');
  I('sd9', 'herb', '🌿', 'Hom giống cà gai leo', 'Cà gai leo tím', 'Vườn cây mẹ GACP D1', 'Hom bánh tẻ 25–30 cm, đã ra rễ', 'cây', 1500, 200, 30, 'cagaileo', 'Tỷ lệ sống ≥ 90%', 'Trồng ngày râm mát, mật độ 40×40 cm.');
  I('sd10', 'herb', '🫚', 'Củ giống nghệ vàng', 'Nghệ vàng địa phương', 'Ruộng giống DHT', 'Củ bánh tẻ, xử lý Trichoderma', 'kg', 30000, 10, 30, 'turmeric', 'Tỷ lệ mọc mầm ≥ 90%', 'Trồng tháng 2–4, sâu 5–7 cm, phủ rơm.');
  const L = (seedId, code, qty, ago, quarantine, source) => S.seedLots.push({ id: uid(), seedId, code, qty, allocated: 0, readyDate: D(-ago), quarantine, source, note: '' });
  L('sd1', 'LG-GA-0926', 3000, 0, 'Đạt', 'Đàn bố mẹ BM-03, ấp ngày ' + fds(D(-21))); L('sd1', 'LG-GA-1010', 3000, -14, 'Chờ kiểm', 'Đàn bố mẹ BM-04');
  L('sd2', 'LG-HB-0920', 400, 6, 'Đạt', 'Lứa hậu bị HB-07');
  L('sd3', 'LG-NS2-0915', 120, 11, 'Đạt', 'Giống cấp 1 HK-35'); L('sd4', 'LG-PS-0922', 5000, 4, 'Đạt', 'Mẻ hấp 22/09'); L('sd4', 'LG-PS-1006', 6000, -10, 'Chờ kiểm', 'Mẻ hấp dự kiến');
  L('sd5', 'LG-LC-0901', 800, 25, 'Đạt', 'Giống GL-02');
  L('sd6', 'LG-CN-0928', 60, -2, 'Đạt', 'Gieo ngày ' + fds(D(-16))); L('sd7', 'LG-CC-1003', 3000, -7, 'Chờ kiểm', 'Ghép ngày ' + fds(D(-18)));
  L('sd8', 'LG-HX-0801', 300, 50, 'Đạt', 'Lô nhập 08/2026'); L('sd9', 'LG-CGL-0925', 5000, 1, 'Đạt', 'Vườn cây mẹ D1'); L('sd10', 'LG-NG-0301', 400, 200, 'Đạt', 'Vụ giống 2026');
  const O = (cust, seedId, qty, ago, wantIn, status, paid, note) => {
    const s = get('seeds', seedId), c = get('customers', cust), wantDate = D(wantIn), al = allocate(seedId, qty, wantDate) || [], total = qty * s.price;
    S.seedOrders.push({ id: uid(), code: `DG${D(-ago).slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, date: D(-ago), customerId: c ? cust : '', name: c ? c.name : cust, phone: c ? c.phone : '0912 000 111', address: c ? c.address : 'Xã Tản Lĩnh, Ba Vì', seedId, seedName: s.name, unit: s.unit, qty, price: s.price, total, deposit: Math.round(total * s.depositPct / 100), wantDate, delivery: 'pickup', note: note || '', allocations: al, status, paid });
    if (paid) S.fin.push({ id: uid(), date: D(-ago), type: 'in', cat: 'Bán con giống', amount: paid === 'full' ? total : Math.round(total * s.depositPct / 100), batchId: '', note: `Đặt giống ${s.name}` });
  };
  O('c6', 'sd4', 1000, 3, 2, 'Đã xác nhận', 'deposit', 'Bổ sung kệ N1-K4');
  O('Anh Đinh Văn Hùng (nông hộ)', 'sd1', 500, 1, 16, 'Mới', '', 'Nuôi thả vườn 500 con');
  O('c5', 'sd9', 1000, 8, 1, 'Sẵn sàng giao', 'full', 'Mở rộng vườn dược liệu');
}
