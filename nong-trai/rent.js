'use strict';
/* =====================================================================
   DHT Smart Farm — PHÂN HỆ MỞ RỘNG
   🤝 Cho thuê nông trại  · 🛒 Chợ nông trại
   📰 Thông tin chung     · 🌐 Chia sẻ hợp tác
   Gắn chặt với phân hệ Quản trị farm: mỗi hợp đồng thuê sinh ra một
   lứa/vụ chạy theo quy trình chuẩn, mỗi sản phẩm trên chợ gắn mã lô
   truy xuất, mọi khoản thu đổ về sổ tài chính chung.
   ===================================================================== */

/* ---------------------- DANH MỤC & HẰNG SỐ ---------------------- */
const PACK = 10; /* 1 gói thuê = 10 đơn vị (m² / con / bịch) */
const RENT_PLANS = [
  { id: 'family', icon: '🥬', n: 'Vườn rau gia đình', seg: 'Gia đình đô thị bận rộn', type: 'veg', sop: 'leafy', unit: 'm²', min: 20, max: 60, def: 30, service: 'full', billing: 'month', price: 40000, priceL: '₫/m²/tháng',
    inc: ['Chăm sóc trọn gói theo VietGAP', 'Chọn rau theo mùa (10+ loại)', 'Giao rau tận nhà 2 lần/tuần (≈ 1,5–2 kg/m²/tháng)', 'Xem nhật ký, chỉ số vườn trên Cổng khách thuê'],
    terms: ['Sản lượng giao tối thiểu 1,5 kg rau/10 m²/tháng; thiếu hụt được bù trong kỳ giao sau.', 'Bên B được chọn cơ cấu rau theo mùa trong danh mục giống của Bên A.', 'Giao hàng miễn phí trong bán kính 15 km, 2 lần/tuần.'] },
  { id: 'diy', icon: '🧑‍🌾', n: 'Tự canh tác cuối tuần', seg: 'Người yêu làm vườn, gia đình có trẻ nhỏ', type: 'veg', sop: 'leafy', unit: 'm²', min: 10, max: 40, def: 20, service: 'diy', billing: 'month', price: 15000, priceL: '₫/m²/tháng',
    inc: ['Lô đất đã cải tạo, nước tưới tự động', 'Dụng cụ, hạt giống, phân hữu cơ đợt đầu', 'Kỹ sư hướng dẫn tại vườn cuối tuần', 'Lịch việc gợi ý theo quy trình chuẩn'],
    terms: ['Bên B tự chăm sóc; Bên A bảo đảm nước tưới, hướng dẫn kỹ thuật và an ninh khu vườn.', 'Bên B chỉ dùng phân bón, chế phẩm do Bên A cung cấp hoặc phê duyệt.', 'Lô bỏ hoang quá 21 ngày liên tục, Bên A được chăm sóc hộ và thu phí dịch vụ.'] },
  { id: 'flock', icon: '🐔', n: 'Nhận nuôi đàn gà đẻ', seg: 'Gia đình muốn trứng sạch hằng tuần', type: 'poultry', sop: 'layer', unit: 'con', min: 10, max: 100, def: 20, service: 'full', billing: 'month', price: 35000, priceL: '₫/con/tháng',
    inc: ['Chuồng, thức ăn, thú y trọn gói', 'Đặt tên đàn, gắn biển tên riêng', 'Giao trứng hằng tuần (≈ 5 quả/con/tuần)', 'Xem chỉ số chuồng nuôi trực tuyến'],
    terms: ['Đàn gà thuộc sở hữu của Bên A; Bên B hưởng toàn bộ trứng của đàn nhận nuôi.', 'Gà chết, loại thải được Bên A bổ sung để giữ đủ số lượng trong hợp đồng.', 'Khách tham quan tuân thủ quy định an toàn sinh học (sát trùng, bảo hộ).'] },
  { id: 'mush', icon: '🍄', n: 'Kệ nấm sạch', seg: 'Gia đình, nhà hàng nhỏ', type: 'mushroom', sop: 'oyster', unit: 'bịch', min: 100, max: 1500, def: 200, service: 'full', billing: 'season', price: 18000, priceL: '₫/bịch/lứa',
    inc: ['Phôi nấm, nhà nuôi, phun sương tự động', 'Nhận nấm tươi các đợt thu (≈ 0,6 kg/bịch/lứa)', 'Miễn phí 1 workshop cấy nấm'],
    terms: ['Bịch nhiễm được Bên A thay thế miễn phí trong 30 ngày đầu của lứa.', 'Nấm thu hái theo lịch kỹ thuật, giao trong ngày hoặc bảo quản lạnh 2–4°C tối đa 5 ngày.'] },
  { id: 'herb', icon: '🌿', n: 'Vườn dược liệu GACP', seg: 'Người quan tâm sức khỏe, phòng khám YHCT', type: 'herb', sop: 'cagaileo', unit: 'm²', min: 50, max: 1000, def: 100, service: 'full', billing: 'season', price: 60000, priceL: '₫/m²/vụ',
    inc: ['Canh tác theo GACP-WHO', 'Sơ chế, sấy, đóng gói có tem truy xuất', 'Hồ sơ nguồn gốc cho từng lô dược liệu'],
    terms: ['Dược liệu được sơ chế, sấy đạt độ ẩm ≤ 12% trước khi giao.', 'Không sử dụng thuốc BVTV hóa học ngoài danh mục GACP-WHO.'] },
  { id: 'biz', icon: '🏢', n: 'Nông trại doanh nghiệp (CSR/ESG)', seg: 'Doanh nghiệp, trường học', type: 'veg', sop: 'leafy', unit: 'm²', min: 150, max: 600, def: 240, service: 'full', billing: 'month', price: 30000, priceL: '₫/m²/tháng',
    inc: ['Biển thương hiệu tại vườn', '4 ngày trải nghiệm/năm cho nhân viên, học sinh', 'Rau cho bếp ăn tập thể', 'Báo cáo ESG: sản lượng, truy xuất, vật tư sinh học'],
    terms: ['Bên B được gắn logo, thương hiệu trên biển nhận diện theo mẫu thống nhất của nông trại.', 'Báo cáo ESG gửi theo quý; ngày trải nghiệm đặt trước tối thiểu 7 ngày.'] },
  { id: 'share', icon: '🤝', n: 'Hợp tác sản xuất – chia sản lượng', seg: 'Nhà đầu tư, HTX, nông hộ', type: '', sop: '', unit: '', min: 1, max: 100000, def: 0, service: 'full', billing: 'share', price: 0, sharePct: 40, priceL: 'Không phí thuê · chia sản lượng',
    inc: ['Thuê trọn khu/kệ/chuồng theo lứa', 'Farm vận hành theo quy trình chuẩn', 'Khách góp đầu vào, nhận % sản lượng thỏa thuận', 'Minh bạch nhật ký, chi phí trên Cổng khách thuê'],
    terms: ['Tỷ lệ chia sản lượng tính trên sản lượng thực thu sau phân loại.', 'Chi phí đầu vào do hai bên đóng góp theo phụ lục; quyết toán sau mỗi lứa.'] }
];
const COMMON_TERMS = [
  'Hợp đồng có hiệu lực sau khi Bên A xác thực đã nhận đủ thanh toán (tiền thuê trọn kỳ, thuế GTGT và tiền đặt cọc).',
  'Tiền đặt cọc được hoàn trả khi kết thúc hợp đồng, sau khi trừ chi phí khắc phục hư hỏng (nếu có).',
  'Mọi vật tư đầu vào (giống, phân bón, thuốc BVTV/thú y) phải thuộc danh mục của Bên A để bảo đảm tiêu chuẩn VietGAP/VietGAHP/GACP.',
  'Sản phẩm chỉ được thu hoạch sau thời gian cách ly thuốc; Bên A được tạm dừng thu hoạch để bảo đảm an toàn thực phẩm.',
  'Bên B được ưu tiên gia hạn nếu đề nghị trước khi hết hạn 15 ngày; hết hạn không gia hạn, lô được thu hồi.',
  'Thiên tai, dịch bệnh bất khả kháng: hai bên thương lượng; Bên A hỗ trợ trồng/nuôi lại một lần miễn phí công.',
  'Lô thuê được gắn biển nhận diện theo mẫu thống nhất của nông trại; Bên B không tự ý thay đổi kết cấu lô.',
  'Tên đăng nhập và mã truy cập tài khoản là thông tin bảo mật; Bên B tự bảo quản và có quyền yêu cầu cấp lại mã khi bị lộ.',
  'Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án có thẩm quyền.'
];
const ID_COLORS = [['#2e8b57', 'Xanh lá'], ['#1e6fb5', 'Xanh dương'], ['#16a3a3', 'Ngọc'], ['#c9a227', 'Vàng'], ['#d9822b', 'Cam'], ['#c0392b', 'Đỏ'], ['#8e5ea2', 'Tím'], ['#6d4c41', 'Nâu']];
const ID_ICONS = ['🌱', '🥬', '🍅', '🌻', '🐔', '🍄', '🌿', '🏡', '⭐', '❤️', '🦋', '🐝'];
const SIGN_STYLES = ['Biển gỗ khắc laser', 'Biển mica in UV', 'Cờ đuôi nheo', 'Cọc tiêu + tem QR'];
const SERVICE = { diy: 'Tự canh tác', assist: 'Hỗ trợ một phần', full: 'Chăm sóc trọn gói' };
const BILLING = { month: 'Theo tháng', season: 'Theo vụ/lứa', share: 'Chia sản lượng' };
const CUST_TYPES = ['Gia đình', 'Cá nhân', 'Doanh nghiệp', 'Trường học', 'Nhà hàng', 'Nhà đầu tư', 'HTX / Nông hộ'];
const REQ_TYPES = ['Thu hoạch & giao hàng', 'Chăm sóc thêm (tưới, bón, tỉa…)', 'Đổi cây trồng vụ sau', 'Đặt lịch tham quan vườn', 'Tư vấn kỹ thuật', 'Khác'];
const LIST_KINDS = { product: { n: 'Nông sản', icon: '🥬' }, box: { n: 'Hộp định kỳ', icon: '📦' }, exp: { n: 'Trải nghiệm', icon: '🎟️' }, community: { n: 'Chợ khách thuê', icon: '🧺' } };
const ORDER_FLOW = ['Mới', 'Đã xác nhận', 'Đang giao', 'Hoàn tất'];
const PARTNER_KINDS = ['HTX', 'Nông hộ vệ tinh', 'Nhà hàng / bếp ăn', 'Siêu thị / cửa hàng', 'Nhà đầu tư', 'Trường học / viện', 'Nhà cung cấp'];
const COOP_MODELS = ['Bao tiêu sản phẩm', 'Liên kết sản xuất', 'Cung ứng đầu vào', 'Góp vốn theo lứa', 'Chuyển giao kỹ thuật', 'Chia sẻ máy móc'];
const EVENT_KINDS = ['Trải nghiệm', 'Workshop', 'Ngày hội', 'Học đường', 'Tập huấn kỹ thuật'];
const POST_TAGS = ['Kinh nghiệm', 'Hỏi đáp', 'Sâu bệnh', 'Công thức nấu', 'Trao đổi giống', 'Thông báo'];
const EQUIP_RATE = { 'Drone phun thuốc': 1200000, 'Máy làm đất': 600000, 'Máy sấy': 800000, 'Máy gieo hạt': 500000, 'Nồi hấp thanh trùng': 700000, 'Xe vận chuyển': 900000 };
const MEMBER_DISCOUNT = 0.1, COMMISSION = 0.1, SHIP_FEE = 30000;
const FAQ = [
  ['Tôi không có thời gian chăm vườn thì sao?', 'Chọn mức "Chăm sóc trọn gói": đội kỹ thuật làm toàn bộ theo quy trình chuẩn, bạn theo dõi trên Cổng khách thuê và nhận sản phẩm tận nhà.'],
  ['Rau, trứng có an toàn không?', 'Mọi lứa/vụ tuân thủ VietGAP/VietGAHP. Hệ thống tự chặn thu hoạch trong thời gian cách ly thuốc; mỗi lô có mã truy xuất.'],
  ['Có được tự đến vườn không?', 'Có. Đặt lịch qua "Yêu cầu dịch vụ" hoặc đến giờ mở cửa. Khách thuê gói Tự canh tác được vào vườn mọi ngày.'],
  ['Thanh toán thế nào?', 'Theo tháng hoặc theo vụ bằng tiền mặt/chuyển khoản. Gói Hợp tác không thu phí thuê, chia sản lượng theo tỷ lệ thỏa thuận.'],
  ['Khách thuê có ưu đãi gì?', `Giảm ${MEMBER_DISCOUNT * 100}% khi mua trên Chợ nông trại, được đăng bán nông sản dư trên "Chợ khách thuê" và tham gia sự kiện ưu tiên.`]
];
FIN_IN.push('Cho thuê nông trại', 'Tiền đặt cọc thuê', 'Dịch vụ trải nghiệm', 'Cho thuê máy móc', 'Hoa hồng chợ nông trại');
FIN_OUT.push('Hoàn tiền đặt cọc', 'Chia lợi nhuận hợp tác');
Object.assign(UI, { rtab: 'map', ctab: 'contracts', mk: '', mq: '', cart: [], cust: '', otab: 'Mới', coTab: 'partners' });

/* ---------------------------- TIỆN ÍCH ---------------------------- */
const planOf = id => RENT_PLANS.find(p => p.id === id) || RENT_PLANS[0];
const custName = id => (get('customers', id) || {}).name || 'Khách lẻ';
const plotUnitL = p => ({ poultry: 'con', mushroom: 'bịch' })[(get('units', p.unitId) || {}).type] || 'm²';
const plotFits = (p, plan) => !plan.type || (get('units', p.unitId) || {}).type === plan.type;
const isMember = cid => S.contracts.some(c => c.customerId === cid && c.status === 'active');
const addMonths = (s, n) => { const d = new Date(s + 'T00:00:00'), day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return iso(d); };
const code = (pre, date) => `${pre}${(date || today()).slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const curBatch = c => c.batchIds.map(id => get('batches', id)).filter(Boolean).filter(b => b.status === 'active').pop();
const listingStock = l => { const lot = get('lots', l.lotId); return lot ? lot.remain : (l.stock || 0); };
const listingBlocked = l => { const lot = get('lots', l.lotId), b = lot && get('batches', lot.batchId), p = b && phiUntil(b); return p && p > today() ? p : null; };
const custPoints = cid => Math.floor(sum(S.orders.filter(o => o.customerId === cid && o.paid), o => o.total) / 10000);
function seasons(c) { const sop = SOPS.find(s => s.id === c.sopId); return Math.max(1, Math.round(c.months * 30 / (sop ? sop.duration : 90))); }
function contractValue(c) { return c.billing === 'month' ? c.price * c.qty * c.months : c.billing === 'season' ? c.price * c.qty * seasons(c) : 0; }
function invStatus(i) { return i.paid ? 'paid' : i.date < today() ? 'overdue' : 'due'; }
const invBadge = i => ({ paid: badge('Đã thu', 'b-ok'), overdue: badge('Quá hạn', 'b-bad'), due: badge('Chưa đến hạn') })[invStatus(i)];
function reqStatus(r) { const t = get('tasks', r.taskId); return r.status === 'Hủy' ? 'Hủy' : t && t.done ? 'Hoàn tất' : r.status; }

function genInvoices(c, fromIdx = 0) {
  const add = (date, amount, desc, kind) => S.invoices.push({ id: uid(), code: `${c.code}-${S.invoices.filter(i => i.contractId === c.id).length + 1}`, contractId: c.id, customerId: c.customerId, date, amount, desc, kind: kind || 'fee', paid: false });
  if (!fromIdx && c.deposit > 0) add(c.start, c.deposit, 'Đặt cọc hợp đồng (hoàn trả khi kết thúc)', 'deposit');
  if (c.billing === 'month') for (let i = fromIdx; i < c.months; i++) add(addMonths(c.start, i), c.price * c.qty, `Phí thuê tháng ${i + 1}/${c.months}`);
  if (c.billing === 'season') { const sop = SOPS.find(s => s.id === c.sopId), n = seasons(c); for (let i = fromIdx; i < n; i++) add(addDays(c.start, i * sop.duration), c.price * c.qty, `Phí thuê vụ/lứa ${i + 1}/${n}`); }
}
function payInvoice(i, date) {
  const c = get('contracts', i.contractId), b = c && curBatch(c);
  i.paid = true; i.paidDate = date || today();
  S.fin.push({ id: uid(), date: i.paidDate, type: 'in', cat: i.kind === 'deposit' ? 'Tiền đặt cọc thuê' : 'Cho thuê nông trại', amount: i.sub != null ? i.sub : i.amount, batchId: i.kind === 'deposit' ? '' : (b ? b.id : ''), note: `${i.code} · ${custName(i.customerId)}${i.vat ? ` (chưa gồm VAT ${money(i.vat)} phải nộp)` : ''}` });
}
function startCycle(c, sopId, start) {
  const plot = get('plots', c.plotId), cust = get('customers', c.customerId);
  const b = { id: uid(), unitId: plot.unitId, sopId, name: `${plot.code} · ${cust ? cust.name : ''}`, start, qty: c.qty, source: `Hợp đồng thuê ${c.code}`, status: 'active', contractId: c.id, diy: c.service === 'diy' };
  S.batches.push(b); genTasks(b, true);
  if (b.diy) S.tasks.filter(t => t.batchId === b.id).forEach(t => { t.assignee = ''; t.byCustomer = true; });
  c.batchIds.push(b.id); c.sopId = sopId;
  return b;
}

/* ------------------------ CẢNH BÁO TÍCH HỢP ------------------------ */
const _baseAlerts = computeAlerts;
computeAlerts = function () {
  const A = _baseAlerts(), t = today();
  const od = S.invoices.filter(i => invStatus(i) === 'overdue');
  if (od.length) A.push({ lv: 'warn', ic: '💳', msg: `${od.length} hóa đơn thuê quá hạn (${money(sum(od, i => i.amount))})`, link: '#/contracts' });
  for (const c of S.contracts) if (c.status === 'active') { const dl = diffDays(t, c.end); if (dl <= 14) A.push({ lv: dl < 0 ? 'warn' : 'info', ic: '📝', msg: `Hợp đồng ${c.code} (${custName(c.customerId)}) ${dl < 0 ? 'đã hết hạn' : 'hết hạn sau ' + dl + ' ngày'} — liên hệ gia hạn`, link: '#/portal/' + c.customerId }); }
  const rq = S.requests.filter(r => reqStatus(r) === 'Mới');
  if (rq.length) A.push({ lv: 'info', ic: '🙋', msg: `${rq.length} yêu cầu mới từ khách thuê chờ tiếp nhận`, link: '#/contracts' });
  const no = S.orders.filter(o => o.status === 'Mới');
  if (no.length) A.push({ lv: 'info', ic: '🛒', msg: `${no.length} đơn hàng mới trên Chợ nông trại chờ xác nhận`, link: '#/orders' });
  for (const e of S.events) { const dl = diffDays(t, e.date); if (dl >= 0 && dl <= 3) A.push({ lv: 'info', ic: '🎟️', msg: `Sự kiện "${e.title}" ${dl ? 'sau ' + dl + ' ngày' : 'HÔM NAY'} — ${sum(e.regs, r => r.qty)}/${e.capacity} chỗ đã đăng ký`, link: '#/info' }); }
  const o = { bad: 0, warn: 1, info: 2 };
  return A.sort((a, b) => o[a.lv] - o[b.lv]);
};
Object.assign(NAV_BADGES, {
  rent: () => { const n = S.invoices.filter(i => invStatus(i) === 'overdue').length; return n ? `<span class="badge b-bad">${n}</span>` : ''; },
  contracts: () => { const n = S.requests.filter(r => reqStatus(r) === 'Mới').length; return n ? `<span class="badge b-warn">${n}</span>` : ''; },
  orders: () => { const n = S.orders.filter(o => o.status === 'Mới').length; return n ? `<span class="badge b-warn">${n}</span>` : ''; },
  market: () => UI.cart.length ? `<span class="badge b-ok">${sum(UI.cart, x => x.qty)}</span>` : ''
});
MODULES.push(
  { id: 'rent', n: 'Cho thuê', icon: '🤝', groups: [['Cho thuê nông trại', [['rent', '🗺️', 'Tổng quan & lô thuê'], ['contracts', '📝', 'Hợp đồng & khách thuê'], ['portal', '👨‍👩‍👧', 'Cổng khách thuê']]]] },
  { id: 'market', n: 'Chợ nông trại', icon: '🛒', groups: [['Chợ nông trại', [['market', '🛍️', 'Gian hàng'], ['orders', '🧾', 'Đơn hàng']]]] },
  { id: 'info', n: 'Thông tin chung', icon: '📰', groups: [['Thông tin chung', [['info', '🏡', 'Giới thiệu & bảng giá'], ['events', '🎉', 'Sự kiện & thông báo']]]] },
  { id: 'coop', n: 'Hợp tác', icon: '🌐', groups: [['Chia sẻ hợp tác', [['partners', '🤝', 'Đối tác liên kết'], ['sharing', '🚜', 'Chia sẻ máy móc'], ['pools', '💹', 'Góp vốn theo lứa'], ['community', '💬', 'Cộng đồng']]]] }
);

/* ============================ BIỂU MẪU ============================ */
const _fieldHtml = fieldHtml;
fieldHtml = function (f) {
  if (!['cards', 'swatch', 'iconpick'].includes(f.type)) return _fieldHtml(f);
  const v = String(FORM.data[f.k] ?? f.def ?? '');
  return `<div class="f full"><span class="flabel">${esc(f.l)}${f.req ? ' *' : ''}</span><div class="picks ${f.type}">${f.opts.map(([val, html]) => `<label class="pick ${String(val) === v ? 'on' : ''}"><input type="radio" name="${f.k}" value="${esc(val)}" ${String(val) === v ? 'checked' : ''} ${f.re ? 'data-re="1"' : ''}>${html}</label>`).join('')}</div>${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
};
const _alerts2 = computeAlerts;
computeAlerts = function () {
  const A = _alerts2();
  for (const c of S.contracts) if (c.status === 'pending') A.push({ lv: diffDays(c.signedAt || c.start, today()) > 2 ? 'warn' : 'info', ic: '💳', msg: `Hợp đồng ${c.code} (${custName(c.customerId)}) chờ xác thực thanh toán ${money(c.total || 0)} — lô đang được giữ chỗ`, link: '#/rent' });
  const o = { bad: 0, warn: 1, info: 2 };
  return A.sort((a, b) => o[a.lv] - o[b.lv]);
};
function plotForm(id, unitId) {
  const p = id ? get('plots', id) : null;
  openForm({
    title: p ? 'Sửa lô cho thuê' : 'Thêm lô cho thuê', data: p || { unitId: unitId || (S.units[0] || {}).id, status: 'free' },
    fields: d => { const u = get('units', d.unitId) || {}; return [
      { k: 'unitId', l: 'Thuộc khu sản xuất', type: 'select', re: true, opts: opts(S.units, x => FARM_TYPES[x.type].icon + ' ' + x.name) },
      { k: 'code', l: 'Mã lô', req: true, ph: 'VD: R1-09' },
      { k: 'size', l: `Quy mô lô (${({ poultry: 'con', mushroom: 'bịch' })[u.type] || 'm²'})`, type: 'number', req: true, min: 1 },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: p && ['rented', 'reserved'].includes(p.status) ? [[p.status, p.status === 'rented' ? 'Đang cho thuê' : 'Giữ chỗ – chờ thanh toán']] : [['free', 'Trống – sẵn sàng cho thuê'], ['maint', 'Đang cải tạo']] },
      { k: 'note', l: 'Đặc điểm (hướng nắng, nguồn nước, lối đi…)', type: 'textarea' }
    ]; },
    submit: d => { if (S.plots.some(x => x.code === d.code && x !== p)) return 'Mã lô đã tồn tại'; if (p) Object.assign(p, d); else S.plots.push({ id: uid(), ...d }); }
  });
}
function customerForm(id) {
  const c = id ? get('customers', id) : null;
  openForm({
    title: c ? 'Sửa khách hàng' : 'Thêm khách hàng', data: c || { type: CUST_TYPES[0], joined: today() },
    fields: [{ k: 'name', l: 'Họ tên / tên đơn vị', req: true, full: true }, { k: 'type', l: 'Nhóm khách', type: 'select', opts: CUST_TYPES }, { k: 'phone', l: 'Điện thoại', req: true }, { k: 'email', l: 'Email' }, { k: 'address', l: 'Địa chỉ giao hàng' }, { k: 'note', l: 'Sở thích, ghi chú', type: 'textarea' }],
    submit: d => { if (c) Object.assign(c, d); else S.customers.push({ id: uid(), ...d }); }
  });
}
function newCustomerFields(d) {
  return d.customerId === '_new' ? [{ k: 'cName', l: 'Họ tên / tên đơn vị', req: true }, { k: 'cType', l: 'Nhóm khách', type: 'select', opts: CUST_TYPES }, { k: 'cPhone', l: 'Điện thoại', req: true }, { k: 'cAddr', l: 'Địa chỉ' }] : [];
}
function takeCustomer(d) {
  if (d.customerId !== '_new') return d.customerId;
  const c = { id: uid(), name: d.cName, type: d.cType || CUST_TYPES[0], phone: d.cPhone, address: d.cAddr || '', joined: today() };
  S.customers.push(c); return c.id;
}
/* ---------------- Tiện ích hợp đồng: gói, thuế, nhận diện, mã truy cập ---------------- */
const payCfg = () => S.pay || (S.pay = { bin: '', account: '', holder: '', vat: 10 });
const packPrice = plan => plan.price * PACK;
const periodL = plan => ({ month: '/tháng', season: '/vụ' })[plan.billing] || '';
function quoteContract(plan, packs, months, sopId, deposit) {
  const qty = packs * PACK, periods = plan.billing === 'month' ? months : plan.billing === 'season' ? seasons({ months, sopId }) : 0;
  const sub = plan.price * qty * periods, vatRate = +payCfg().vat || 0, vat = Math.round(sub * vatRate / 100);
  const dep = deposit === '' || deposit == null ? (plan.billing === 'month' ? plan.price * qty : Math.round(sub * 0.2 / 1000) * 1000) : +deposit;
  return { qty, periods, sub, vatRate, vat, deposit: dep, total: sub + vat + dep };
}
const planTerms = plan => [...COMMON_TERMS, ...(plan.terms || [])];
function issueCode(c) { const code = randomCode(8); c.salt = randomCode(8); c.accessHash = hashCode(c.salt, code); c.codeIssued = today(); return code; }
const suggestUser = (name, phone) => (String(phone || '').replace(/\D/g, '') || noAccent(name).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')) || 'khach' + Math.floor(Math.random() * 1e4);
function signHtml(c, plotCode) {
  const id = c.identity || {}, cust = get('customers', c.customerId) || {};
  const url = location.href.split('#')[0] + '#/login/' + encodeURIComponent(cust.username || '');
  return `<div class="sign" style="--sc:${esc(id.color || '#2e8b57')}"><div class="sign-body"><div class="sign-top">DHT SMART FARM · LÔ ${esc(plotCode || '')}</div><div class="sign-name">${esc(id.icon || '🌱')} ${esc(id.sign || cust.name || '')}</div><div class="sign-foot">${esc(planOf(c.planId).n)} · ${esc(id.style || SIGN_STYLES[0])}</div></div><div class="sign-qr">${QR.svg(url, 64, 'QR vườn')}</div></div>`;
}

function contractForm(preset = {}) {
  const avail = S.plots.filter(p => p.status === 'free');
  if (!avail.length) { toast(S.plots.length ? 'Tất cả lô đã được thuê hoặc giữ chỗ — hãy thêm lô mới' : 'Chưa có lô cho thuê — hãy thêm lô trước'); return; }
  const plan0 = planOf(preset.planId || (get('plots', preset.plotId) ? (RENT_PLANS.find(pl => plotFits(get('plots', preset.plotId), pl)) || {}).id : 'family'));
  const c0 = get('customers', preset.customerId) || S.customers[0];
  openForm({
    title: 'Ký hợp đồng thuê nông trại', ok: '✍️ Ký hợp đồng & lập thanh toán',
    data: { customerId: c0 ? c0.id : '_new', username: c0 ? (c0.username || suggestUser(c0.name, c0.phone)) : '', planId: plan0.id, plotId: preset.plotId || '', packs: Math.max(1, Math.ceil((plan0.def || PACK) / PACK)), start: today(), months: '', service: plan0.service, deposit: '', sharePct: plan0.sharePct || 0, color: ID_COLORS[0][0], icon: plan0.icon, style: SIGN_STYLES[0], sign: c0 ? c0.name : '', agree: false },
    onChange: (d, k) => {
      const plan = planOf(d.planId);
      if (k === 'planId') { d.service = plan.service; d.sharePct = plan.sharePct || 0; d.packs = Math.max(1, Math.ceil((plan.def || PACK) / PACK)); d.months = ''; d.sopId = ''; d.plotId = ''; d.icon = plan.icon; d.deposit = ''; }
      if (k === 'customerId') { const c = get('customers', d.customerId); d.username = c ? (c.username || suggestUser(c.name, c.phone)) : ''; d.sign = c ? c.name : ''; }
      if (k === 'cPhone' || k === 'cName') { d.username = suggestUser(d.cName, d.cPhone); d.sign = d.cName; }
      if (k === 'plotId') d.sopId = '';
      if (k === 'packs' || k === 'months') d.deposit = '';
    },
    fields: d => {
      const plan = planOf(d.planId);
      d.packs = Math.max(1, Math.round(+d.packs || 1));
      const fits = avail.filter(p => plotFits(p, plan)), need = plan.billing === 'share' ? 0 : d.packs * PACK;
      const ok = fits.filter(p => p.size >= need);
      if (!get('plots', d.plotId) || !fits.includes(get('plots', d.plotId))) d.plotId = (ok[0] || fits[0] || {}).id || '';
      const plot = get('plots', d.plotId), unit = plot ? get('units', plot.unitId) : null;
      const sops = unit ? SOPS.filter(s => s.type === unit.type) : [];
      if (!sops.find(s => s.id === d.sopId)) d.sopId = (sops.find(s => s.id === plan.sop) || sops[0] || {}).id || '';
      const sop = SOPS.find(s => s.id === d.sopId);
      if (!d.months) d.months = plan.billing === 'month' ? 6 : Math.max(1, Math.ceil((sop ? sop.duration : 90) / 30));
      const q = quoteContract(plan, d.packs, +d.months, d.sopId, d.deposit);
      if (d.deposit === '') d.deposit = q.deposit;
      const unitL = plan.unit || (plot ? plotUnitL(plot) : '');
      const sec = (n, t) => ({ type: 'html', html: `<h4 class="step"><span>${n}</span>${t}</h4>` });
      return [
        sec(1, 'Khách thuê & tài khoản'),
        { k: 'customerId', l: 'Khách thuê', type: 'select', re: true, opts: [...opts(S.customers, c => `${c.name} · ${c.type}`), ['_new', '＋ Khách hàng mới']] },
        ...newCustomerFields(d).map(f => ({ ...f, re: f.k === 'cName' || f.k === 'cPhone' })),
        { k: 'username', l: 'Tên đăng nhập tài khoản thuê', req: true, hint: '🔐 Mã truy cập bảo mật được sinh ngẫu nhiên khi ký, chỉ hiển thị một lần.' },
        sec(2, 'Gói thuê & số lượng'),
        { k: 'planId', l: 'Chọn gói thuê', type: 'cards', re: true, opts: RENT_PLANS.map(p => [p.id, `<span class="pi">${p.icon}</span><b>${esc(p.n)}</b><small>${p.price ? `${money(packPrice(p))}${periodL(p)} / gói ${PACK} ${esc(p.unit)}` : 'Chia sản lượng'}</small>`]) },
        { k: 'packs', l: `Số gói (1 gói = ${PACK} ${unitL})`, type: 'number', re: true, req: true, min: 1, hint: `<span class="stepper"><button type="button" class="btn sm" data-act="packStep" data-d="-1">− 1 gói</button><button type="button" class="btn sm" data-act="packStep" data-d="1">＋ 1 gói</button></span> = <b>${nf(d.packs * PACK)} ${esc(unitL)}</b>${plan.price ? ` × ${money(plan.price)} = <b>${money(plan.price * d.packs * PACK)}</b>${periodL(plan)}` : ''}${plan.min > 1 ? ` · khuyến nghị ${nf(Math.ceil(plan.min / PACK))}–${nf(Math.floor(plan.max / PACK))} gói` : ''}` },
        { k: 'plotId', l: 'Lô cho thuê', type: 'select', re: true, opts: fits.length ? fits.map(p => [p.id, `${p.code} · ${(get('units', p.unitId) || {}).name} · ${nf(p.size)} ${plotUnitL(p)}${p.size < need ? ' ⚠ không đủ' : ''}`]) : [['', '— Không còn lô trống phù hợp gói này —']] },
        { k: 'sopId', l: 'Cây trồng / vật nuôi (quy trình chuẩn)', type: 'select', opts: sops.length ? sops.map(s => [s.id, s.name]) : [['', '—']] },
        { k: 'service', l: 'Mức dịch vụ', type: 'select', opts: Object.entries(SERVICE) },
        { k: 'start', l: 'Ngày bắt đầu', type: 'date', req: true },
        { k: 'months', l: 'Thời hạn thuê (tháng)', type: 'number', re: true, req: true, min: 1 },
        plan.billing === 'share' ? { k: 'sharePct', l: 'Tỷ lệ sản lượng chia cho khách (%)', type: 'number', min: 0 } : null,
        sec(3, 'Nhận diện lô thống nhất'),
        { k: 'sign', l: 'Tên hiển thị trên biển lô', re: true, req: true, ph: 'VD: Vườn nhà Hoa' },
        { k: 'style', l: 'Hình thức biển', type: 'select', re: true, opts: SIGN_STYLES },
        { k: 'color', l: 'Màu nhận diện', type: 'swatch', re: true, opts: ID_COLORS.map(([c, n]) => [c, `<i style="background:${c}"></i><small>${n}</small>`]) },
        { k: 'icon', l: 'Biểu tượng', type: 'iconpick', re: true, opts: ID_ICONS.map(i => [i, i]) },
        { type: 'html', html: `<div class="muted" style="font-size:13px;margin-bottom:6px">Xem trước biển lô (mẫu thống nhất toàn nông trại):</div>${signHtml({ customerId: d.customerId, planId: plan.id, identity: { sign: d.sign, color: d.color, icon: d.icon, style: d.style } }, plot ? plot.code : '')}` },
        sec(4, 'Dịch vụ & điều khoản hợp đồng'),
        { type: 'html', html: `<div class="terms"><b>Dịch vụ bao gồm trong gói ${esc(plan.n)}:</b><ul class="clean">${plan.inc.map(x => `<li>${esc(x)}</li>`).join('')}</ul><b>Điều khoản:</b><ol>${planTerms(plan).map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` },
        { k: 'agree', l: 'Khách thuê đã đọc, hiểu và đồng ý các dịch vụ, điều khoản trên', type: 'checkbox' },
        sec(5, 'Thanh toán dự kiến'),
        { type: 'html', html: payTable(plan, { packs: d.packs, qty: q.qty, months: +d.months, periods: q.periods, sub: q.sub, vat: q.vat, vatRate: q.vatRate, deposit: +d.deposit || 0 }) },
        plan.billing !== 'share' || true ? { k: 'deposit', l: 'Tiền đặt cọc theo hợp đồng (₫)', type: 'number', re: true, min: 0 } : null,
        { k: 'note', l: 'Điều khoản bổ sung (nếu có)', type: 'textarea' }
      ];
    },
    submit: d => {
      const plan = planOf(d.planId), plot = get('plots', d.plotId);
      if (!plot) return 'Chưa chọn được lô phù hợp — hãy thêm lô hoặc chọn gói khác';
      const qty = d.packs * PACK;
      if (plan.billing !== 'share' && qty > plot.size) return `Lô ${plot.code} chỉ rộng ${nf(plot.size)} ${plotUnitL(plot)} — tối đa ${Math.floor(plot.size / PACK)} gói`;
      if (!d.sopId) return 'Khu của lô này chưa có quy trình phù hợp';
      if (!d.agree) return 'Cần xác nhận khách thuê đồng ý điều khoản hợp đồng';
      const uname = String(d.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(uname)) return 'Tên đăng nhập 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch';
      if (S.customers.some(c => (c.username || '').toLowerCase() === uname && c.id !== d.customerId)) return 'Tên đăng nhập đã có người dùng';
      const customerId = takeCustomer(d), cust = get('customers', customerId); cust.username = uname;
      const q = quoteContract(plan, d.packs, d.months, d.sopId, d.deposit);
      const c = { id: uid(), code: code('HD', d.start), customerId, planId: plan.id, plotId: plot.id, sopId: d.sopId, packs: d.packs, pack: PACK, qty: plan.billing === 'share' ? plot.size : qty, service: d.service, billing: plan.billing, price: plan.price, months: d.months, start: d.start, end: addMonths(d.start, d.months), deposit: q.deposit, sharePct: plan.billing === 'share' ? (d.sharePct || 0) : 0,
        status: 'pending', prepaid: true, batchIds: [], note: d.note || '', signedAt: today(), identity: { sign: d.sign, color: d.color, icon: d.icon, style: d.style }, terms: planTerms(plan), vatRate: q.vatRate, sub: q.sub, vat: q.vat, total: q.total };
      const accessCode = issueCode(c);
      S.contracts.push(c); plot.status = 'reserved'; plot.holdBy = c.id;
      const add = (amount, extra) => S.invoices.push({ id: uid(), code: `${c.code}-${S.invoices.filter(i => i.contractId === c.id).length + 1}`, contractId: c.id, customerId, date: c.start, paid: false, amount, ...extra });
      if (q.sub) add(q.sub + q.vat, { kind: 'fee', sub: q.sub, vat: q.vat, desc: `Tiền thuê trọn kỳ ${d.months} tháng · ${d.packs} gói × ${PACK} ${plan.unit || plotUnitL(plot)} (gồm VAT ${q.vatRate}%)` });
      if (q.deposit) add(q.deposit, { kind: 'deposit', desc: 'Đặt cọc hợp đồng (hoàn trả khi kết thúc)' });
      UI.cust = customerId;
      if (!q.total) activateContract(c, '');
      setTimeout(() => { location.hash = '#/portal/' + customerId; showPayment(c.id, accessCode); }, 0);
    },
    done: 'Đã ký hợp đồng — vui lòng hoàn tất thanh toán'
  });
}
function payTable(plan, x) {
  const rows = plan.billing === 'share'
    ? `<tr><td>Tiền thuê</td><td class="r">Chia ${nf(x.sharePct || plan.sharePct)}% sản lượng</td></tr>`
    : `<tr><td>Tiền thuê trọn kỳ<br><small class="muted">${nf(x.packs)} gói × ${money(packPrice(plan))}${periodL(plan)} × ${nf(x.periods)} ${plan.billing === 'month' ? 'tháng' : 'vụ/lứa'}</small></td><td class="r num">${money(x.sub)}</td></tr>
       <tr><td>Thuế GTGT (${nf(x.vatRate)}%)</td><td class="r num">${money(x.vat)}</td></tr>`;
  return `<table class="paytbl">${rows}<tr><td>Tiền đặt cọc theo hợp đồng</td><td class="r num">${money(x.deposit)}</td></tr><tr class="tot"><td>TỔNG THANH TOÁN</td><td class="r num">${money((x.sub || 0) + (x.vat || 0) + (x.deposit || 0))}</td></tr></table>`;
}
function paymentHtml(c, o = {}) {
  const cust = get('customers', c.customerId) || {}, plot = get('plots', c.plotId) || {}, plan = planOf(c.planId), P = payCfg();
  const due = S.invoices.filter(i => i.contractId === c.id && !i.paid), amount = sum(due, i => i.amount), bank = (BANKS.find(b => b[0] === P.bin) || [])[1];
  const qr = P.bin && P.account ? `<div class="payqr">${QR.svg(vietQR({ bin: P.bin, account: P.account, amount, purpose: c.code }), 200, 'Mã QR chuyển khoản')}<div><div class="muted" style="font-size:12px">Quét bằng ứng dụng ngân hàng (VietQR)</div><table class="kv"><tr><td>Ngân hàng</td><td><b>${esc(bank || P.bin)}</b></td></tr><tr><td>Số tài khoản</td><td><b>${esc(P.account)}</b></td></tr><tr><td>Chủ tài khoản</td><td>${esc(P.holder || '')}</td></tr><tr><td>Số tiền</td><td><b>${money(amount)}</b></td></tr><tr><td>Nội dung CK</td><td><b>${esc(c.code)}</b></td></tr></table></div></div>`
    : alertHtml({ lv: 'warn', html: `Chưa cấu hình tài khoản nhận tiền nên chưa tạo được mã QR. Vào <b>Hợp đồng & khách thuê → Thanh toán & thuế</b> để nhập ngân hàng và số tài khoản.` });
  return `<div class="paybox">
    <div class="card-head" style="margin-bottom:6px"><div><b>${esc(c.code)}</b> · ${esc(cust.name || '')}<br><small class="muted">${plan.icon} ${esc(plan.n)} · lô ${esc(plot.code || '')} · ${nf(c.packs || c.qty / PACK)} gói · ${fd(c.start)} → ${fd(c.end)}</small></div>${c.status === 'pending' ? badge('Chờ thanh toán', 'b-warn') : badge('Đã kích hoạt', 'b-ok')}</div>
    ${payTable(plan, { packs: c.packs, periods: plan.billing === 'month' ? c.months : seasons(c), sub: c.sub || 0, vat: c.vat || 0, vatRate: c.vatRate || 0, deposit: c.deposit || 0, sharePct: c.sharePct })}
    ${amount ? qr : alertHtml({ lv: 'ok', msg: 'Không còn khoản cần thanh toán.' })}
    ${o.code ? `<div class="cred"><div><small>Tên đăng nhập</small><b>${esc(cust.username)}</b></div><div><small>Mã truy cập (bảo mật)</small><b class="code">${esc(o.code)}</b></div><p>🔐 Mã chỉ hiển thị <b>một lần</b> và được lưu dưới dạng băm SHA-256. Hãy in hoặc gửi riêng cho khách. Đăng nhập tại mục <b>Khách thuê</b> trên thanh trên cùng.</p></div>` : ''}
    ${c.status === 'pending' && amount ? (o.admin ? `<div class="verify admin-only"><label class="f"><span>Mã giao dịch ngân hàng / số chứng từ</span><input class="txref" placeholder="VD: FT26269123456"></label><button class="btn pri" data-act="verifyPay" data-id="${c.id}">✅ Xác thực đã nhận ${money(amount)} & kích hoạt lô</button></div>` : alertHtml({ lv: 'info', msg: 'Sau khi chuyển khoản, nông trại sẽ xác thực thanh toán; lô thuê được kích hoạt và hiển thị đầy đủ thông tin của bạn.' })) : ''}
    <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-act="printModal">🖨 In phiếu</button><button class="btn sm" data-act="contractDoc" data-id="${c.id}">📄 Xem hợp đồng</button></div>
  </div>`;
}
function openPanel(title, html) { FORM = null; $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
function showPayment(cid, accessCode) { const c = get('contracts', cid); openPanel('Thông tin thanh toán hợp đồng', paymentHtml(c, { code: accessCode, admin: !tenantId() })); }
function activateContract(c, txRef) {
  for (const i of S.invoices.filter(x => x.contractId === c.id && !x.paid)) payInvoice(i);
  c.status = 'active'; c.verifiedAt = today(); c.txRef = txRef || '';
  const plot = get('plots', c.plotId); if (plot) { plot.status = 'rented'; delete plot.holdBy; }
  if (!curBatch(c)) startCycle(c, c.sopId, c.start > today() ? c.start : today());
}
function contractDocHtml(c) {
  const cust = get('customers', c.customerId) || {}, plot = get('plots', c.plotId) || {}, unit = get('units', plot.unitId) || {}, plan = planOf(c.planId), sop = SOPS.find(s => s.id === c.sopId), f = S.farm;
  const terms = c.terms || planTerms(plan);
  return `<div class="doc"><div class="doc-h"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><small>Độc lập – Tự do – Hạnh phúc</small><h3>HỢP ĐỒNG THUÊ NÔNG TRẠI</h3><small>Số: ${esc(c.code)} · Ngày ký: ${fd(c.signedAt || c.start)}</small></div>
    <p><b>BÊN A (Bên cho thuê):</b> ${esc(f.name)} — ${esc(f.owner || '')}<br>Địa chỉ: ${esc(f.address || '')} · Điện thoại: ${esc(f.phone || '')}</p>
    <p><b>BÊN B (Bên thuê):</b> ${esc(cust.name || '')} (${esc(cust.type || '')})<br>Điện thoại: ${esc(cust.phone || '')} · Địa chỉ: ${esc(cust.address || '')}</p>
    <p><b>Điều 1. Đối tượng thuê.</b> Lô <b>${esc(plot.code || '')}</b> thuộc ${esc(unit.name || '')}; gói <b>${esc(plan.n)}</b>, ${nf(c.packs || Math.round(c.qty / PACK))} gói × ${PACK} ${esc(plan.unit || plotUnitL(plot))} = ${nf(c.qty)} ${esc(plan.unit || plotUnitL(plot))}; quy trình: ${esc(sop ? sop.name + ' (' + sop.std + ')' : '')}; mức dịch vụ: ${esc(SERVICE[c.service])}.</p>
    <p><b>Điều 2. Thời hạn.</b> ${nf(c.months)} tháng, từ ${fd(c.start)} đến ${fd(c.end)}.</p>
    <p><b>Điều 3. Giá thuê và thanh toán.</b></p>${payTable(plan, { packs: c.packs, periods: plan.billing === 'month' ? c.months : seasons(c), sub: c.sub ?? contractValue(c), vat: c.vat || 0, vatRate: c.vatRate || 0, deposit: c.deposit || 0, sharePct: c.sharePct })}
    <p><b>Điều 4. Dịch vụ Bên A cung cấp.</b></p><ul>${plan.inc.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p><b>Điều 5. Điều khoản chung và riêng của gói.</b></p><ol>${terms.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${c.note ? `<p><b>Điều khoản bổ sung:</b> ${esc(c.note)}</p>` : ''}
    <p><b>Điều 6. Nhận diện lô.</b> Biển "${esc((c.identity || {}).sign || cust.name || '')}", ${esc((c.identity || {}).style || SIGN_STYLES[0])}, màu ${esc((ID_COLORS.find(x => x[0] === (c.identity || {}).color) || ['', 'mặc định'])[1])}, theo mẫu thống nhất của Bên A.</p>
    <p><b>Điều 7. Tài khoản truy cập.</b> Tên đăng nhập: <b>${esc(cust.username || '')}</b>; mã truy cập được cấp riêng, bảo mật, không ghi trong văn bản này.</p>
    ${c.verifiedAt ? `<p><i>Đã xác thực thanh toán ngày ${fd(c.verifiedAt)}${c.txRef ? ' · Mã giao dịch ' + esc(c.txRef) : ''}.</i></p>` : '<p><i>Hợp đồng có hiệu lực sau khi Bên A xác thực thanh toán.</i></p>'}
    <div class="sigs"><div><b>ĐẠI DIỆN BÊN A</b><small>(Ký, ghi rõ họ tên)</small></div><div><b>BÊN B</b><small>${c.agreedOnline !== false ? 'Đã đồng ý điều khoản khi ký' : ''}</small></div></div></div>`;
}
function plotInfoHtml(p) {
  const u = get('units', p.unitId) || {}, c = S.contracts.find(x => x.plotId === p.id && (x.status === 'active' || x.status === 'pending'));
  let h = `<div class="card-head"><div><b>Lô ${esc(p.code)}</b> · ${esc(u.name || '')}<br><small class="muted">${nf(p.size)} ${plotUnitL(p)} · ${esc(p.note || '')}</small></div>${badge({ free: 'Trống', rented: 'Đang cho thuê', reserved: 'Giữ chỗ – chờ thanh toán', maint: 'Đang cải tạo' }[p.status] || p.status, { free: 'b-ok', rented: 'b-info', reserved: 'b-warn', maint: '' }[p.status])}</div>`;
  if (c && c.status === 'active') {
    const cust = get('customers', c.customerId) || {}, b = curBatch(c), plan = planOf(c.planId), st = b ? stageOf(sopOf(b), bDay(b)) : null;
    h += signHtml(c, p.code) + `<table class="kv" style="margin-top:12px"><tr><td>Khách thuê</td><td><b>${esc(cust.name)}</b> · ${esc(cust.type)}</td></tr><tr><td>Liên hệ</td><td>${esc(cust.phone || '')} ${cust.email ? '· ' + esc(cust.email) : ''}</td></tr><tr><td>Địa chỉ</td><td>${esc(cust.address || '—')}</td></tr><tr><td>Tài khoản</td><td>${esc(cust.username || '—')}</td></tr>
      <tr><td>Hợp đồng</td><td>${esc(c.code)} · ${plan.icon} ${esc(plan.n)}</td></tr><tr><td>Quy mô</td><td>${c.packs ? nf(c.packs) + ' gói · ' : ''}${nf(c.qty)} ${esc(plan.unit || plotUnitL(p))} · ${esc(SERVICE[c.service])}</td></tr><tr><td>Thời hạn</td><td>${fd(c.start)} → ${fd(c.end)} (còn ${Math.max(0, diffDays(today(), c.end))} ngày)</td></tr>
      <tr><td>Thanh toán</td><td>${c.verifiedAt ? `✅ Đã xác thực ${fd(c.verifiedAt)}${c.txRef ? ' · ' + esc(c.txRef) : ''}` : 'Theo hóa đơn kỳ'}</td></tr>${st ? `<tr><td>Đang canh tác</td><td>${esc(sopOf(b).name)} · ${esc(st.n)} · ngày ${bDay(b)}</td></tr>` : ''}</table>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><a class="btn sm pri" href="#/portal/${cust.id}" data-act="closeModal">👨‍👩‍👧 Cổng khách thuê</a><button class="btn sm" data-act="contractDoc" data-id="${c.id}">📄 Hợp đồng</button><button class="btn sm" data-act="reissue" data-id="${c.id}">🔑 Cấp lại mã</button></div>`;
  } else if (c) {
    h += alertHtml({ lv: 'warn', html: `Đang giữ chỗ cho hợp đồng <b>${esc(c.code)}</b> — chờ xác thực thanh toán. Thông tin khách thuê sẽ hiển thị sau khi thanh toán được xác thực.` }) + `<div style="display:flex;gap:6px"><button class="btn sm pri" data-act="openPay" data-id="${c.id}">💳 Thanh toán / xác thực</button><button class="btn sm danger" data-act="cancelHold" data-id="${c.id}">Hủy giữ chỗ</button></div>`;
  } else if (p.status === 'free') h += `<button class="btn pri" data-act="newContract" data-plot="${p.id}">✍️ Ký hợp đồng cho lô này</button>`;
  else h += `<button class="btn" data-act="editPlot" data-id="${p.id}">✎ Sửa lô</button>`;
  return h;
}
function cycleForm(cid) {
  const c = get('contracts', cid), plot = get('plots', c.plotId), unit = get('units', plot.unitId);
  openForm({
    title: 'Bắt đầu vụ/lứa mới cho ' + custName(c.customerId), ok: 'Khởi tạo vụ mới', data: { sopId: c.sopId, start: today() },
    fields: [{ k: 'sopId', l: 'Cây trồng / vật nuôi', type: 'select', opts: SOPS.filter(s => s.type === unit.type).map(s => [s.id, s.name]) }, { k: 'start', l: 'Ngày bắt đầu', type: 'date', req: true }],
    submit: d => { if (curBatch(c)) return 'Vụ hiện tại chưa kết thúc'; startCycle(c, d.sopId, d.start); }
  });
}
function renewForm(cid) {
  const c = get('contracts', cid), plan = planOf(c.planId);
  openForm({
    title: 'Gia hạn hợp đồng ' + c.code, ok: 'Gia hạn', data: { add: c.billing === 'month' ? 6 : c.months },
    intro: `<p class="muted" style="margin-top:0">Hết hạn hiện tại: ${fd(c.end)}. ${c.prepaid ? 'Hệ thống lập hóa đơn trọn kỳ gia hạn (gồm VAT).' : 'Hệ thống tạo thêm hóa đơn cho thời gian gia hạn.'}</p>`,
    fields: [{ k: 'add', l: 'Gia hạn thêm (tháng)', type: 'number', req: true, min: 1 }],
    submit: d => {
      const before = c.billing === 'season' ? seasons(c) : c.months;
      c.months += d.add; c.end = addMonths(c.start, c.months); if (c.status === 'ended') c.status = 'active';
      if (c.prepaid) {
        const periods = (c.billing === 'season' ? seasons(c) : c.months) - before, sub = c.price * c.qty * periods, vat = Math.round(sub * (+payCfg().vat || 0) / 100);
        if (sub) S.invoices.push({ id: uid(), code: `${c.code}-${S.invoices.filter(i => i.contractId === c.id).length + 1}`, contractId: c.id, customerId: c.customerId, date: today(), amount: sub + vat, sub, vat, kind: 'fee', paid: false, desc: `Gia hạn ${d.add} tháng (${plan.billing === 'season' ? periods + ' vụ' : periods + ' tháng'}, gồm VAT)` });
      } else genInvoices(c, before);
    },
    done: 'Đã gia hạn hợp đồng'
  });
}
function requestForm(cid, contractId) {
  const cs = S.contracts.filter(c => c.customerId === cid && c.status === 'active');
  if (!cs.length) { toast('Khách chưa có hợp đồng đang hiệu lực'); return; }
  openForm({
    title: 'Gửi yêu cầu dịch vụ', ok: 'Gửi yêu cầu', data: { contractId: contractId || cs[0].id, type: REQ_TYPES[0], date: addDays(today(), 1), fee: 0 },
    fields: [
      { k: 'contractId', l: 'Hợp đồng / vườn', type: 'select', opts: cs.map(c => [c.id, `${c.code} · lô ${(get('plots', c.plotId) || {}).code}`]) },
      { k: 'type', l: 'Loại yêu cầu', type: 'select', opts: REQ_TYPES },
      { k: 'date', l: 'Ngày mong muốn', type: 'date', req: true },
      { k: 'fee', l: 'Phí dịch vụ phát sinh (₫, nếu có)', type: 'number', min: 0 },
      { k: 'note', l: 'Mô tả chi tiết', type: 'textarea', req: true }
    ],
    submit: d => {
      const c = get('contracts', d.contractId), b = curBatch(c), plot = get('plots', c.plotId);
      const t = { id: uid(), title: `🙋 ${d.type} – ${custName(cid)} (lô ${plot.code}): ${d.note}`, date: d.date, cat: /thu hoạch/i.test(d.type) ? 'th' : 'kt', batchId: b ? b.id : '', unitId: plot.unitId, done: false, auto: false, assignee: defaultAssignee(get('units', plot.unitId), /thu hoạch/i.test(d.type) ? 'th' : 'kt') };
      S.tasks.push(t);
      S.requests.push({ id: uid(), customerId: cid, contractId: c.id, type: d.type, date: d.date, created: today(), note: d.note, fee: d.fee || 0, status: 'Mới', taskId: t.id });
    },
    done: 'Đã gửi yêu cầu — đã tạo công việc cho đội kỹ thuật'
  });
}
function deliverForm(lotId, cid) {
  const l = get('lots', lotId), c = S.contracts.find(x => x.batchIds.includes(l.batchId));
  const share = c && c.billing === 'share' ? c.sharePct / 100 : 1;
  openForm({
    title: 'Giao sản phẩm cho khách thuê', ok: 'Xác nhận giao', data: { date: today(), qty: +(l.remain * share).toFixed(2) },
    intro: `<p class="muted" style="margin-top:0">Lô <b>${esc(l.code)}</b> · ${esc(l.product)} · tồn ${nf(l.remain, 1)} ${esc(l.unit)}${share < 1 ? ` · khách được chia ${nf(share * 100)}%` : ''}</p>`,
    fields: [{ k: 'date', l: 'Ngày giao', type: 'date', req: true }, { k: 'qty', l: `Số lượng (${l.unit})`, type: 'number', req: true, min: 0 }, { k: 'note', l: 'Hình thức (giao tận nhà, nhận tại farm…)' }],
    submit: d => {
      if (!(d.qty > 0) || d.qty > l.remain + 1e-9) return `Số lượng phải trong khoảng 0 – ${nf(l.remain, 1)}`;
      const b = get('batches', l.batchId), p = b && phiUntil(b);
      if (p && p > d.date) return `Bị chặn: còn trong thời gian cách ly/ngừng thuốc đến ${fd(p)}`;
      l.remain = +(l.remain - d.qty).toFixed(3);
      l.moves.push({ date: d.date, type: 'deliver', qty: d.qty, buyer: custName(cid), note: d.note || '' });
    },
    done: 'Đã ghi nhận giao hàng cho khách'
  });
}
function listingForm(id, preset = {}) {
  const l = id ? get('listings', id) : null;
  const lots = S.lots.filter(x => x.remain > 0);
  openForm({
    title: l ? 'Sửa sản phẩm' : 'Đăng sản phẩm lên chợ', data: l || { kind: 'product', active: true, sellerType: 'farm', icon: '🥬', ...preset },
    onChange: (d, k) => { if (k === 'lotId') { const lot = get('lots', d.lotId); if (lot) { d.title = d.title || `${lot.product} ${lot.grade}`; d.unit = lot.unit; } } },
    fields: d => [
      { k: 'kind', l: 'Loại', type: 'select', re: true, opts: Object.entries(LIST_KINDS).map(([k, v]) => [k, v.icon + ' ' + v.n]) },
      { k: 'icon', l: 'Biểu tượng (emoji)', ph: '🥬' },
      d.kind === 'product' && { k: 'lotId', l: 'Gắn lô thu hoạch (tồn kho & truy xuất tự động)', type: 'select', re: true, opts: [['', '— Không gắn lô (nhập tồn thủ công) —'], ...lots.map(x => [x.id, `${x.code} · ${x.product} · tồn ${nf(x.remain, 1)} ${x.unit}`])] },
      { k: 'title', l: 'Tên sản phẩm / dịch vụ', req: true, full: true },
      { k: 'price', l: 'Giá bán (₫)', type: 'number', req: true, min: 0 },
      { k: 'unit', l: 'Đơn vị', req: true, ph: 'kg, hộp, vé, quả…' },
      !(d.kind === 'product' && d.lotId) && { k: 'stock', l: 'Số lượng có thể bán', type: 'number', min: 0 },
      d.kind === 'community' && { k: 'sellerId', l: 'Người bán (khách thuê)', type: 'select', opts: opts(S.customers.filter(c => isMember(c.id))) },
      { k: 'desc', l: 'Mô tả', type: 'textarea' },
      { k: 'active', l: 'Đang mở bán', type: 'checkbox' }
    ],
    submit: d => {
      if (d.kind === 'community' && !d.sellerId) return 'Chọn khách thuê đăng bán';
      const rec = { ...d, sellerType: d.kind === 'community' ? 'customer' : 'farm', lotId: d.kind === 'product' ? d.lotId || '' : '' };
      if (l) Object.assign(l, rec); else S.listings.push({ id: uid(), created: today(), ...rec });
    }
  });
}
function cartLines() {
  return UI.cart.map(x => ({ ...x, l: get('listings', x.lid) })).filter(x => x.l);
}
function checkoutForm() {
  const lines = cartLines();
  if (!lines.length) { toast('Giỏ hàng trống'); return; }
  openForm({
    title: 'Đặt hàng', ok: 'Xác nhận đặt hàng', data: { customerId: tenantId() || UI.cust || (S.customers[0] || {}).id || '', delivery: 'pickup', pay: 'Chuyển khoản' },
    intro: d => { const q = quote(lines, d); return `<div class="alert info"><span class="ic">🧾</span><div class="grow">${lines.map(x => `${esc(x.l.title)} × ${nf(x.qty, 2)} = ${money(x.qty * x.l.price)}`).join('<br>')}<br>Tạm tính ${money(q.sub)}${q.disc ? ` · Ưu đãi thành viên −${money(q.disc)}` : ''}${q.ship ? ` · Phí giao ${money(q.ship)}` : ''}<br><b>Tổng thanh toán: ${money(q.total)}</b></div></div>`; },
    fields: d => [
      { k: 'customerId', l: 'Khách hàng', type: 'select', re: true, opts: tenantId() ? opts([get('customers', tenantId())], c => `${c.name}${isMember(c.id) ? ' ⭐ thành viên' : ''}`) : [['', 'Khách lẻ'], ...opts(S.customers, c => `${c.name}${isMember(c.id) ? ' ⭐ thành viên' : ''}`), ['_new', '＋ Khách hàng mới']] },
      ...(d.customerId === '' ? [{ k: 'name', l: 'Họ tên', req: true }, { k: 'phone', l: 'Điện thoại', req: true }] : newCustomerFields(d)),
      { k: 'delivery', l: 'Nhận hàng', type: 'select', re: true, opts: [['pickup', 'Nhận tại nông trại (miễn phí)'], ['ship', `Giao tận nơi (${money(SHIP_FEE)})`]] },
      d.delivery === 'ship' && { k: 'address', l: 'Địa chỉ giao', req: true, def: (get('customers', d.customerId) || {}).address || '' },
      { k: 'pay', l: 'Thanh toán', type: 'select', opts: ['Chuyển khoản', 'Tiền mặt', 'Ví điện tử'] },
      { k: 'note', l: 'Ghi chú', type: 'textarea' }
    ],
    submit: d => {
      for (const x of lines) {
        if (x.qty > listingStock(x.l) + 1e-9) return `"${x.l.title}" chỉ còn ${nf(listingStock(x.l), 1)} ${x.l.unit}`;
        const p = listingBlocked(x.l); if (p) return `"${x.l.title}" đang trong thời gian cách ly thuốc đến ${fd(p)} — chưa được bán`;
      }
      const customerId = d.customerId === '_new' ? takeCustomer(d) : d.customerId;
      const q = quote(lines, { ...d, customerId }), c = get('customers', customerId);
      const o = { id: uid(), code: code('DH'), date: today(), customerId, name: c ? c.name : d.name, phone: c ? c.phone : d.phone, delivery: d.delivery, address: d.address || '', pay: d.pay, note: d.note || '', status: 'Mới', paid: false, member: q.member,
        items: lines.map(x => { const lot = get('lots', x.l.lotId); return { lid: x.l.id, title: x.l.title, qty: x.qty, price: x.l.price, unit: x.l.unit, lotId: lot ? lot.id : '', lotCode: lot ? lot.code : '', sellerType: x.l.sellerType, sellerId: x.l.sellerId || '' }; }),
        sub: q.sub, disc: q.disc, ship: q.ship, total: q.total };
      for (const x of lines) { const lot = get('lots', x.l.lotId); if (lot) { lot.remain = +(lot.remain - x.qty).toFixed(3); lot.moves.push({ date: o.date, type: 'sale', qty: x.qty, price: x.l.price, buyer: o.name, orderId: o.id }); } else x.l.stock = +(x.l.stock - x.qty).toFixed(3); }
      S.orders.push(o); UI.cart = [];
      setTimeout(() => { location.hash = '#/orders'; }, 0);
    },
    done: 'Đã tạo đơn hàng'
  });
}
function quote(lines, d) {
  const member = !!d.customerId && d.customerId !== '_new' && isMember(d.customerId);
  const sub = sum(lines, x => x.qty * x.l.price);
  const disc = member ? Math.round(sum(lines.filter(x => x.l.sellerType !== 'customer'), x => x.qty * x.l.price) * MEMBER_DISCOUNT) : 0;
  const ship = d.delivery === 'ship' ? SHIP_FEE : 0;
  return { member, sub, disc, ship, total: sub - disc + ship };
}
function payOrder(o) {
  o.paid = true; o.paidDate = today();
  const rate = o.member ? MEMBER_DISCOUNT : 0;
  for (const it of o.items) {
    const lot = get('lots', it.lotId), amt = it.qty * it.price;
    if (it.sellerType === 'customer') S.fin.push({ id: uid(), date: o.paidDate, type: 'in', cat: 'Hoa hồng chợ nông trại', amount: amt * COMMISSION, batchId: '', note: `${o.code} · ${it.title} (trả người bán ${custName(it.sellerId)} ${money(amt * (1 - COMMISSION))})` });
    else S.fin.push({ id: uid(), date: o.paidDate, type: 'in', cat: 'Bán sản phẩm', amount: amt * (1 - rate), batchId: lot ? lot.batchId : '', note: `${o.code} · ${it.title}` });
  }
  if (o.ship) S.fin.push({ id: uid(), date: o.paidDate, type: 'in', cat: 'Bán sản phẩm', amount: o.ship, batchId: '', note: `${o.code} · phí giao hàng` });
}
function eventForm(id) {
  const e = id ? get('events', id) : null;
  openForm({
    title: e ? 'Sửa sự kiện' : 'Tạo sự kiện', data: e || { kind: EVENT_KINDS[0], date: addDays(today(), 7), time: '08:00', capacity: 30, price: 0 },
    fields: [{ k: 'title', l: 'Tên sự kiện', req: true, full: true }, { k: 'kind', l: 'Loại', type: 'select', opts: EVENT_KINDS }, { k: 'date', l: 'Ngày', type: 'date', req: true }, { k: 'time', l: 'Giờ', type: 'time' }, { k: 'capacity', l: 'Số chỗ', type: 'number', min: 1, req: true }, { k: 'price', l: 'Giá vé / người (₫)', type: 'number', min: 0 }, { k: 'desc', l: 'Nội dung', type: 'textarea' }],
    submit: d => { if (e) Object.assign(e, d); else S.events.push({ id: uid(), regs: [], ...d }); }
  });
}
function registerForm(id) {
  const e = get('events', id), left = e.capacity - sum(e.regs, r => r.qty);
  if (left <= 0) { toast('Sự kiện đã đủ chỗ'); return; }
  openForm({
    title: 'Đăng ký: ' + e.title, ok: 'Đăng ký', data: { customerId: tenantId(), qty: 1, paid: e.price > 0 && !tenantId() },
    intro: `<p class="muted" style="margin-top:0">${fd(e.date)} ${esc(e.time || '')} · còn ${left} chỗ · ${e.price ? money(e.price) + '/người' : 'Miễn phí'}</p>`,
    fields: d => [
      { k: 'customerId', l: 'Người đăng ký', type: 'select', re: true, opts: tenantId() ? opts([get('customers', tenantId())]) : [['', 'Khách vãng lai'], ...opts(S.customers)] },
      ...(d.customerId ? [] : [{ k: 'name', l: 'Họ tên', req: true }, { k: 'phone', l: 'Điện thoại', req: true }]),
      { k: 'qty', l: 'Số người', type: 'number', min: 1, req: true },
      e.price > 0 && !tenantId() && { k: 'paid', l: 'Đã thanh toán vé', type: 'checkbox' }
    ],
    submit: d => {
      if (d.qty > left) return `Chỉ còn ${left} chỗ`;
      const c = get('customers', d.customerId);
      e.regs.push({ customerId: d.customerId, name: c ? c.name : d.name, phone: c ? c.phone : d.phone, qty: d.qty, paid: !!d.paid, date: today() });
      if (d.paid && e.price) S.fin.push({ id: uid(), date: today(), type: 'in', cat: 'Dịch vụ trải nghiệm', amount: e.price * d.qty, batchId: '', note: `${e.title} · ${c ? c.name : d.name}` });
    },
    done: 'Đã đăng ký sự kiện'
  });
}
function newsForm(id) {
  const n = id ? get('news', id) : null;
  openForm({ title: n ? 'Sửa thông báo' : 'Đăng thông báo', data: n || { date: today() }, fields: [{ k: 'title', l: 'Tiêu đề', req: true, full: true }, { k: 'date', l: 'Ngày', type: 'date' }, { k: 'pinned', l: 'Ghim lên đầu', type: 'checkbox' }, { k: 'body', l: 'Nội dung', type: 'textarea', req: true }], submit: d => { if (n) Object.assign(n, d); else S.news.push({ id: uid(), ...d }); } });
}
function infoForm() {
  openForm({
    title: 'Sửa thông tin chung', data: { ...S.info },
    fields: [{ k: 'slogan', l: 'Khẩu hiệu', full: true }, { k: 'intro', l: 'Giới thiệu trang trại', type: 'textarea' }, { k: 'hours', l: 'Giờ mở cửa' }, { k: 'area', l: 'Tổng diện tích' }, { k: 'rules', l: 'Quy định khách thuê / tham quan (mỗi dòng một quy định)', type: 'textarea' }],
    submit: d => { Object.assign(S.info, d); }
  });
}
function partnerForm(id) {
  const p = id ? get('partners', id) : null;
  openForm({
    title: p ? 'Sửa đối tác' : 'Thêm đối tác', data: p || { kind: PARTNER_KINDS[0], model: COOP_MODELS[0], since: today(), status: 'Đang hợp tác' },
    fields: [{ k: 'name', l: 'Tên đối tác', req: true, full: true }, { k: 'kind', l: 'Loại đối tác', type: 'select', opts: PARTNER_KINDS }, { k: 'model', l: 'Mô hình hợp tác', type: 'select', opts: COOP_MODELS }, { k: 'contact', l: 'Người liên hệ' }, { k: 'phone', l: 'Điện thoại' }, { k: 'since', l: 'Hợp tác từ', type: 'date' }, { k: 'status', l: 'Trạng thái', type: 'select', opts: ['Đang hợp tác', 'Đang đàm phán', 'Tạm dừng'] }, { k: 'value', l: 'Giá trị hợp tác/năm (₫)', type: 'number', min: 0 }, { k: 'terms', l: 'Điều khoản chính (sản lượng, giá, chất lượng…)', type: 'textarea' }],
    submit: d => { if (p) Object.assign(p, d); else S.partners.push({ id: uid(), ...d }); }
  });
}
function bookingForm(equipId) {
  const eqs = S.equip.filter(e => e.status !== 'Hỏng' && e.status !== 'Ngừng sử dụng');
  if (!eqs.length) { toast('Không có máy móc sẵn sàng cho thuê'); return; }
  const e0 = get('equip', equipId) || eqs[0];
  openForm({
    title: 'Đặt lịch chia sẻ máy móc', ok: 'Đặt lịch', data: { equipId: e0.id, from: addDays(today(), 1), to: addDays(today(), 1), rate: EQUIP_RATE[e0.kind] || 500000, whoType: 'Đối tác' },
    onChange: (d, k) => { if (k === 'equipId') { const e = get('equip', d.equipId); d.rate = EQUIP_RATE[e.kind] || 500000; } },
    fields: [
      { k: 'equipId', l: 'Máy / thiết bị', type: 'select', re: true, opts: opts(eqs, e => `${e.name} (${e.kind})`) },
      { k: 'whoType', l: 'Bên thuê', type: 'select', opts: ['Đối tác', 'Khách thuê', 'Nông hộ lân cận'] },
      { k: 'who', l: 'Tên bên thuê', req: true },
      { k: 'from', l: 'Từ ngày', type: 'date', req: true }, { k: 'to', l: 'Đến ngày', type: 'date', req: true },
      { k: 'rate', l: 'Đơn giá / ngày (₫, gồm vận hành)', type: 'number', min: 0 },
      { k: 'note', l: 'Nội dung công việc (diện tích, địa điểm…)', type: 'textarea' }
    ],
    submit: d => {
      if (d.to < d.from) return 'Ngày kết thúc phải sau ngày bắt đầu';
      const clash = S.bookings.find(b => b.equipId === d.equipId && b.status !== 'Hủy' && !(d.to < b.from || d.from > b.to));
      if (clash) return `Trùng lịch với ${clash.who} (${fds(clash.from)}–${fds(clash.to)})`;
      const days = diffDays(d.from, d.to) + 1;
      S.bookings.push({ id: uid(), ...d, days, fee: days * (d.rate || 0), status: 'Đã đặt' });
    },
    done: 'Đã đặt lịch máy'
  });
}
function poolForm() {
  const bs = activeBatches();
  if (!bs.length) { toast('Chưa có lứa/vụ đang chạy'); return; }
  openForm({
    title: 'Mở đợt góp vốn theo lứa', ok: 'Mở góp vốn', data: { batchId: bs[0].id, sharePct: 30, target: 100000000 },
    fields: [{ k: 'name', l: 'Tên đợt góp vốn', req: true, full: true }, { k: 'batchId', l: 'Lứa / vụ', type: 'select', opts: opts(bs) }, { k: 'target', l: 'Mục tiêu huy động (₫)', type: 'number', min: 0, req: true }, { k: 'sharePct', l: 'Tỷ lệ lợi nhuận chia cho nhà góp vốn (%)', type: 'number', min: 0, req: true }, { k: 'desc', l: 'Mô tả, cam kết minh bạch', type: 'textarea' }],
    submit: d => { S.pools.push({ id: uid(), ...d, contributions: [], status: 'Đang huy động', created: today() }); }
  });
}
function contribForm(id) {
  const p = get('pools', id);
  openForm({
    title: 'Ghi nhận góp vốn: ' + p.name, ok: 'Ghi nhận', data: { date: today(), customerId: '' },
    fields: d => [{ k: 'customerId', l: 'Nhà góp vốn', type: 'select', re: true, opts: [['', 'Khác (nhập tên)'], ...opts(S.customers)] }, !d.customerId && { k: 'name', l: 'Họ tên', req: true }, { k: 'amount', l: 'Số tiền (₫)', type: 'number', req: true, min: 1 }, { k: 'date', l: 'Ngày', type: 'date', req: true }],
    submit: d => { const c = get('customers', d.customerId); p.contributions.push({ customerId: d.customerId, name: c ? c.name : d.name, amount: d.amount, date: d.date }); }
  });
}
function postForm() {
  openForm({
    title: 'Chia sẻ lên cộng đồng', ok: 'Đăng bài', data: { tag: POST_TAGS[0] },
    fields: [{ k: 'author', l: 'Người đăng', req: true, def: S.customers[0] ? S.customers[0].name : '' }, { k: 'tag', l: 'Chủ đề', type: 'select', opts: POST_TAGS }, { k: 'title', l: 'Tiêu đề', req: true, full: true }, { k: 'body', l: 'Nội dung', type: 'textarea', req: true }],
    submit: d => { S.posts.push({ id: uid(), ...d, date: today(), likes: 0, replies: [] }); }
  });
}
function replyForm(id) {
  const p = get('posts', id);
  openForm({ title: 'Trả lời: ' + p.title, ok: 'Gửi', fields: [{ k: 'author', l: 'Người trả lời', req: true, def: 'Kỹ sư DHT Farm' }, { k: 'body', l: 'Nội dung', type: 'textarea', req: true }], submit: d => { p.replies.push({ ...d, date: today() }); } });
}

/* ------------------ QUY HOẠCH PHÂN KHU & PHỐI CẢNH 3D ------------------ */
const TYPE_ORDER = { poultry: 0, mushroom: 1, veg: 2, herb: 3 };
const ZONE_FN = { poultry: 'Chăn nuôi gia cầm', mushroom: 'Nhà nấm công nghệ cao', veg: 'Rau sạch nhà lưới/màng', herb: 'Dược liệu GACP-WHO' };
const SERVICE_ZONES = [
  { n: 'Cổng chính & bãi xe', ic: '🚗', x: 30, y: 500, w: 135, h: 105, kind: 'lot' },
  { n: 'Nhà điều hành – đón khách', ic: '🏢', x: 175, y: 505, w: 140, h: 95, z: 34, kind: 'bld', color: '#e8dcc4' },
  { n: 'Khu trải nghiệm – sân chơi', ic: '🎪', x: 325, y: 500, w: 140, h: 105, kind: 'park' },
  { n: 'Nhà sơ chế & kho lạnh', ic: '❄️', x: 535, y: 505, w: 150, h: 95, z: 30, kind: 'bld', color: '#dfe7ee' },
  { n: 'Hồ điều hòa – nước tưới', ic: '💧', x: 695, y: 500, w: 130, h: 105, kind: 'pond' },
  { n: 'Ủ phân hữu cơ – biogas', ic: '♻️', x: 835, y: 505, w: 135, h: 95, z: 14, kind: 'bld', color: '#c9b79c' }
];
function siteLayout() {
  const us = S.units.slice().sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  const rows = Math.max(1, Math.ceil(us.length / 2)), top = 60, bottom = 458, gap = 14, rh = (bottom - top - (rows - 1) * gap) / rows;
  return us.map((u, i) => {
    const col = i < rows ? 0 : 1, row = col ? i - rows : i, z = { u, letter: String.fromCharCode(65 + i), x: col ? 530 : 30, y: top + row * (rh + gap), w: 440, h: rh };
    const plots = S.plots.filter(p => p.unitId === u.id).sort((a, b) => a.code.localeCompare(b.code));
    const inner = { x: z.x + 8, y: z.y + 26, w: z.w - 16, h: z.h - 34 };
    if (plots.length) {
      const pa = { x: inner.x, y: inner.y, w: inner.w * 0.68, h: inner.h };
      z.farm = { x: pa.x + pa.w + 8, y: inner.y, w: inner.w - pa.w - 8, h: inner.h };
      const cols = Math.max(1, Math.round(Math.sqrt(plots.length * pa.w / pa.h))), nr = Math.ceil(plots.length / cols);
      const cw = (pa.w - (cols - 1) * 4) / cols, ch = (pa.h - (nr - 1) * 4) / nr;
      z.plots = plots.map((p, k) => ({ p, x: pa.x + (k % cols) * (cw + 4), y: pa.y + Math.floor(k / cols) * (ch + 4), w: cw, h: ch }));
    } else { z.farm = inner; z.plots = []; }
    return z;
  });
}
function plotLook(p) {
  const c = S.contracts.find(x => x.plotId === p.id && (x.status === 'active' || x.status === 'pending'));
  if (p.status === 'rented' && c) { const id = c.identity || {}; return { fill: id.color || 'var(--info)', op: .55, stroke: id.color || 'var(--info)', icon: id.icon || planOf(c.planId).icon, label: id.sign || custName(c.customerId), c }; }
  if (p.status === 'reserved') return { fill: 'var(--warn)', op: .35, stroke: 'var(--warn)', icon: '⏳', label: 'Giữ chỗ – chờ thanh toán', c };
  if (p.status === 'maint') return { fill: 'var(--muted)', op: .25, stroke: 'var(--muted)', icon: '🔧', label: 'Đang cải tạo' };
  return { fill: 'var(--ok)', op: .18, stroke: 'var(--ok)', icon: '', label: 'Trống – sẵn sàng cho thuê' };
}
const plotTitle = (p, lk) => `${p.code} · ${nf(p.size)} ${plotUnitL(p)} · ${lk.label}${lk.c && p.status === 'rented' ? ' · ' + custName(lk.c.customerId) + ' · đến ' + fd(lk.c.end) : ''}`;
function sitePlan2D() {
  const Z = siteLayout(); let g = '';
  g += `<rect x="15" y="30" width="970" height="595" rx="16" class="sp-land"/><rect x="478" y="30" width="44" height="595" class="sp-road"/><rect x="15" y="470" width="970" height="22" class="sp-road"/><line x1="500" y1="36" x2="500" y2="618" class="sp-lane"/><line x1="22" y1="481" x2="978" y2="481" class="sp-lane"/>`;
  for (const z of Z) {
    const col = FARM_TYPES[z.u.type].color;
    g += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="10" class="sp-zone" style="stroke:${col}"/><circle cx="${z.x + 16}" cy="${z.y + 13}" r="10" style="fill:${col}"/><text x="${z.x + 16}" y="${z.y + 17}" class="sp-letter">${z.letter}</text><text x="${z.x + 32}" y="${z.y + 17}" class="sp-ztitle">${esc(z.u.name)} · ${esc(ZONE_FN[z.u.type])} · ${nf(z.u.area)} m²</text>`;
    if (z.farm.w > 20) g += `<rect x="${z.farm.x}" y="${z.farm.y}" width="${z.farm.w}" height="${z.farm.h}" rx="6" class="sp-farm"/><text x="${z.farm.x + z.farm.w / 2}" y="${z.farm.y + z.farm.h / 2 + 4}" class="sp-small" text-anchor="middle">${FARM_TYPES[z.u.type].icon} SX của farm</text>`;
    for (const t of z.plots) {
      const lk = plotLook(t.p);
      g += `<g class="sp-plot" data-act="plotClick" data-id="${t.p.id}"><title>${esc(plotTitle(t.p, lk))}</title><rect x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" width="${t.w.toFixed(1)}" height="${t.h.toFixed(1)}" rx="5" style="fill:${lk.fill};fill-opacity:${lk.op};stroke:${lk.stroke}"/><text x="${(t.x + 6).toFixed(1)}" y="${(t.y + 14).toFixed(1)}" class="sp-pcode">${esc(t.p.code)}</text>${t.h > 34 ? `<text x="${(t.x + 6).toFixed(1)}" y="${(t.y + 29).toFixed(1)}" class="sp-small">${lk.icon} ${esc(lk.label.slice(0, Math.max(6, Math.floor(t.w / 7))))}</text>` : lk.icon ? `<text x="${(t.x + t.w - 16).toFixed(1)}" y="${(t.y + 15).toFixed(1)}" class="sp-small">${lk.icon}</text>` : ''}</g>`;
    }
  }
  for (const s of SERVICE_ZONES) g += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8" class="sp-svc sp-${s.kind}"/><text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 - 2}" text-anchor="middle" style="font-size:20px">${s.ic}</text><text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 18}" text-anchor="middle" class="sp-small">${esc(s.n)}</text>`;
  g += `<path d="M 4 481 l 14 -9 v 18 z" class="sp-gate"/><text x="26" y="485" class="sp-small">Cổng vào ➜</text><g transform="translate(972 16)"><circle r="12" class="sp-compass"/><path d="M0 -9 L4 3 L0 0 L-4 3 Z" class="sp-needle"/></g><text x="954" y="20" text-anchor="end" class="sp-small">Hướng Bắc</text><text x="30" y="22" class="sp-title">MẶT BẰNG QUY HOẠCH PHÂN KHU · ${esc(S.farm.name)}</text>`;
  return `<div class="siteplan"><svg viewBox="0 0 1000 640" role="img" aria-label="Mặt bằng quy hoạch phân khu nông trại">${g}</svg></div>`;
}
function sitePlan3D() {
  const Z = siteLayout(), P = (x, y, z = 0) => [394 + (x - y) * 0.6, 34 + (x + y) * 0.3 - z * 0.75];
  const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const quad = (r, z = 0) => [P(r.x, r.y, z), P(r.x + r.w, r.y, z), P(r.x + r.w, r.y + r.h, z), P(r.x, r.y + r.h, z)];
  const poly = (a, cls, style = '') => `<polygon points="${pts(a)}" class="${cls}" style="${style}"/>`;
  const box = (r, z, fill, cls = '') => {
    const right = [P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x + r.w, r.y + r.h, z), P(r.x + r.w, r.y, z)], front = [P(r.x, r.y + r.h), P(r.x + r.w, r.y + r.h), P(r.x + r.w, r.y + r.h, z), P(r.x, r.y + r.h, z)];
    return `<g class="${cls}">${poly(right, 'b-face', `fill:${fill}`)}${poly(right, 'b-shade1')}${poly(front, 'b-face', `fill:${fill}`)}${poly(front, 'b-shade2')}${poly(quad(r, z), 'b-face b-top', `fill:${fill}`)}</g>`;
  };
  const ground = [], objs = [];
  ground.push(poly(quad({ x: 15, y: 30, w: 970, h: 595 }), 'sp-land'), poly(quad({ x: 478, y: 30, w: 44, h: 595 }), 'sp-road'), poly(quad({ x: 15, y: 470, w: 970, h: 22 }), 'sp-road'));
  for (const z of Z) {
    const col = FARM_TYPES[z.u.type].color, t = z.u.type;
    ground.push(poly(quad(z), 'sp-zone', `stroke:${col}`));
    const f = z.farm;
    if (f.w > 20) {
      if (t === 'poultry') objs.push({ k: f.x + f.w + f.y + f.h, s: box(f, 26, '#e3d2b0') });
      else if (t === 'mushroom') objs.push({ k: f.x + f.w + f.y + f.h, s: box(f, 24, '#c9b8a3') });
      else if (t === 'veg') objs.push({ k: f.x + f.w + f.y + f.h, s: box(f, 16, 'rgba(160,210,235,.45)', 'glass') });
      else { ground.push(poly(quad(f), 'sp-field')); for (let i = 0; i < 6; i++) { const tx = f.x + 12 + (i % 3) * (f.w - 24) / 2, ty = f.y + 10 + Math.floor(i / 3) * (f.h - 20); objs.push({ k: tx + ty, s: tree(tx, ty, P) }); } }
    }
    for (const q of z.plots) {
      const lk = plotLook(q.p), tip = `<title>${esc(plotTitle(q.p, lk))}</title>`, r = { x: q.x + 1, y: q.y + 1, w: q.w - 2, h: q.h - 2 };
      if (t === 'poultry' || t === 'mushroom') objs.push({ k: r.x + r.w + r.y + r.h, s: `<g class="sp-plot" data-act="plotClick" data-id="${q.p.id}">${tip}${box(r, t === 'poultry' ? 14 : 12, q.p.status === 'rented' ? lk.fill : q.p.status === 'reserved' ? '#f0c060' : q.p.status === 'maint' ? '#b8b8b8' : '#9fd8b0')}</g>` });
      else ground.push(`<g class="sp-plot" data-act="plotClick" data-id="${q.p.id}">${tip}${poly(quad(r), 'sp-tile', `fill:${lk.fill};fill-opacity:${Math.max(lk.op, .3)};stroke:${lk.stroke}`)}</g>`);
    }
    const [lx, ly] = P(z.x + 18, z.y + 12, 0);
    objs.push({ k: 1e5, s: `<g class="sp-badge"><circle cx="${lx.toFixed(1)}" cy="${(ly - 14).toFixed(1)}" r="11" style="fill:${col}"/><text x="${lx.toFixed(1)}" y="${(ly - 10).toFixed(1)}" class="sp-letter">${z.letter}</text></g>` });
  }
  for (const s of SERVICE_ZONES) {
    if (s.kind === 'bld') objs.push({ k: s.x + s.w + s.y + s.h, s: box(s, s.z, s.color) });
    else ground.push(poly(quad(s), 'sp-svc sp-' + s.kind));
    const [x, y] = P(s.x + s.w / 2, s.y + s.h / 2, (s.z || 0) + 6);
    objs.push({ k: 1e5, s: `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" style="font-size:16px">${s.ic}</text>` });
  }
  for (let y = 60; y < 460; y += 55) { objs.push({ k: 470 + y, s: tree(470, y, P) }); objs.push({ k: 530 + y, s: tree(530, y, P) }); }
  objs.sort((a, b) => a.k - b.k);
  return `<div class="siteplan"><svg viewBox="0 0 1000 560" role="img" aria-label="Phối cảnh 3D nông trại">${ground.join('')}${objs.map(o => o.s).join('')}<text x="20" y="24" class="sp-title">PHỐI CẢNH TỔNG THỂ · ${esc(S.farm.name)}</text></svg></div>`;
}
function tree(x, y, P) { const [a, b] = P(x, y, 0), [c, d] = P(x, y, 16); return `<g class="sp-tree"><line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}"/><circle cx="${c.toFixed(1)}" cy="${d.toFixed(1)}" r="7"/></g>`; }
function zoneTable() {
  return tbl(['Phân khu', 'Khu sản xuất', 'Chức năng', ['Diện tích', 'r'], ['Lô thuê', 'r'], ['Đang thuê', 'r'], ['Giữ chỗ', 'r'], ['Lấp đầy', 'r']], siteLayout().map(z => {
    const ps = z.plots.map(q => q.p), r = ps.filter(p => p.status === 'rented').length;
    return `<tr><td><b>${z.letter}</b></td><td>${FARM_TYPES[z.u.type].icon} ${esc(z.u.name)}</td><td>${esc(ZONE_FN[z.u.type])}</td><td class="r num">${nf(z.u.area)} m²</td><td class="r num">${ps.length}</td><td class="r num">${r}</td><td class="r num">${ps.filter(p => p.status === 'reserved').length}</td><td class="r num">${ps.length ? pct(r / ps.length, 0) : '—'}</td></tr>`;
  }));
}
const mapLegend = `<div class="legend"><span><i class="lg free"></i>Trống</span><span><i class="lg reserved"></i>Giữ chỗ – chờ thanh toán</span><span><i class="lg rented"></i>Đang thuê (màu nhận diện của khách)</span><span><i class="lg maint"></i>Cải tạo</span></div>`;

/* ============================ TRANG: CHO THUÊ ============================ */
VIEWS.rent = {
  title: 'Cho thuê nông trại',
  render() {
    const t = today(), m = t.slice(0, 7), total = S.plots.length, rented = S.plots.filter(p => p.status === 'rented').length;
    const rev = sum(S.fin.filter(f => f.type === 'in' && f.cat === 'Cho thuê nông trại' && f.date.startsWith(m)), f => f.amount);
    const od = S.invoices.filter(i => invStatus(i) === 'overdue'), act = S.contracts.filter(c => c.status === 'active'), pend = S.contracts.filter(c => c.status === 'pending');
    const expiring = act.filter(c => diffDays(t, c.end) <= 30).sort((a, b) => a.end.localeCompare(b.end));
    const tab = UI.rtab, mode = UI.rmap || 'plan';
    const grid = S.units.filter(u => S.plots.some(p => p.unitId === u.id)).map(u => `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${FARM_TYPES[u.type].icon} ${esc(u.name)}</h3><button class="btn sm" data-act="newPlot" data-id="${u.id}">＋ Lô</button></div><div class="plots">${S.plots.filter(p => p.unitId === u.id).map(p => {
      const lk = plotLook(p), c = lk.c, b = c && p.status === 'rented' && curBatch(c), s = b && stageOf(sopOf(b), bDay(b));
      return `<button class="plot ${p.status}" data-act="plotClick" data-id="${p.id}" style="${p.status === 'rented' ? `--pc:${lk.stroke}` : ''}"><b>${esc(p.code)}</b><small>${nf(p.size)} ${plotUnitL(p)}</small>${p.status === 'rented' && c ? `<span>${esc(lk.icon)} ${esc(lk.label)}</span><small>${esc(custName(c.customerId))} · ${esc(s ? s.n : 'chờ vụ mới')}</small>` : `<span>${p.status === 'maint' ? '🔧 Đang cải tạo' : p.status === 'reserved' ? '⏳ Chờ thanh toán' : '✨ Trống'}</span>`}</button>`;
    }).join('')}</div></div>`).join('');
    return `<div class="grid g4">
      <div class="card kpi"><span class="l">Tỷ lệ lấp đầy</span><span class="v">${total ? pct(rented / total, 0) : '—'}</span><span class="s muted">${rented}/${total} lô đang cho thuê</span></div>
      <div class="card kpi"><span class="l">Doanh thu thuê tháng ${m.slice(5)}</span><span class="v t-ok">${short(rev)}</span><span class="s muted">${act.length} hợp đồng hiệu lực</span></div>
      <div class="card kpi"><span class="l">Chờ thanh toán</span><span class="v ${pend.length ? 't-warn' : ''}">${pend.length}</span><span class="s muted">${short(sum(S.invoices.filter(i => !i.paid && pend.some(c => c.id === i.contractId)), i => i.amount))} đang giữ chỗ</span></div>
      <div class="card kpi"><span class="l">Công nợ quá hạn</span><span class="v ${od.length ? 't-bad' : 't-ok'}">${short(sum(od, i => i.amount))}</span><span class="s muted">${od.length} hóa đơn · ${expiring.length} HĐ hết hạn ≤ 30 ngày</span></div>
    </div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0">${[['map', '🗺️ Bản đồ lô'], ['plans', '📋 Gói thuê']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="rtab" data-k="${k}">${l}</button>`).join('')}</div><span class="grow"></span><button class="btn" data-act="newPlot">＋ Lô cho thuê</button><button class="btn pri" data-act="newContract">＋ Hợp đồng thuê</button></div>
    ${pend.length ? `<div class="card" style="margin-bottom:16px"><h3 style="margin-bottom:8px">💳 Hợp đồng chờ xác thực thanh toán</h3>${pend.map(c => alertHtml({ lv: 'warn', ic: '⏳', html: `<b>${esc(c.code)}</b> · ${esc(custName(c.customerId))} · lô ${esc((get('plots', c.plotId) || {}).code || '')} · ${money(c.total || 0)} · ký ${fd(c.signedAt)} <button class="btn sm pri" data-act="openPay" data-id="${c.id}">Xác thực</button>` })).join('')}</div>` : ''}
    ${expiring.length && tab === 'map' ? `<div class="card" style="margin-bottom:16px"><h3 style="margin-bottom:8px">⏳ Sắp hết hạn – cần chăm sóc gia hạn</h3>${expiring.map(c => alertHtml({ lv: diffDays(t, c.end) < 0 ? 'warn' : 'info', ic: planOf(c.planId).icon, html: `<b>${esc(custName(c.customerId))}</b> · ${esc(c.code)} · lô ${esc((get('plots', c.plotId) || {}).code)} · hết hạn ${fd(c.end)}`, link: '#/portal/' + c.customerId })).join('')}</div>` : ''}
    ${tab === 'map' ? `<div class="card"><div class="card-head"><div class="seg">${[['plan', '📐 Quy hoạch phân khu'], ['3d', '🏙️ Phối cảnh 3D'], ['grid', '▦ Danh sách lô']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="rmap" data-k="${k}">${l}</button>`).join('')}</div><small class="muted">Bấm vào lô để xem thông tin / ký hợp đồng</small></div>
        ${mode === 'grid' ? (grid || empty('Chưa có lô cho thuê', '<button class="btn pri" data-act="newPlot">Tạo lô đầu tiên</button>')) : mode === '3d' ? sitePlan3D() : sitePlan2D()}${mapLegend}</div>
      ${mode !== 'grid' ? `<div class="card sec"><h3 style="margin-bottom:8px">Bảng quy hoạch phân khu</h3>${zoneTable()}<p class="muted" style="font-size:12px;margin-bottom:0">Khu dịch vụ chung: ${SERVICE_ZONES.map(s => s.ic + ' ' + s.n).join(' · ')}.</p></div>` : ''}`
    : `<div class="grid g3">${RENT_PLANS.map(planCard).join('')}</div>`}`;
  }
};
function planCard(p) {
  const n = S.contracts.filter(c => c.planId === p.id && c.status === 'active').length;
  return `<div class="card plan"><div class="sop-h"><span class="ico">${p.icon}</span><div><b>${esc(p.n)}</b><br><small class="muted">${esc(p.seg)}</small></div></div>
    <div class="price">${p.price ? money(packPrice(p)) : 'Chia sản lượng'}<small> ${p.price ? `/gói ${PACK} ${esc(p.unit)}${periodL(p)}` : ''}</small></div>${p.price ? `<small class="muted">= ${money(p.price)} ${esc(p.priceL.replace(/^₫/, ''))}</small>` : ''}
    <ul class="clean">${p.inc.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="muted" style="font-size:12px;margin:8px 0">${esc(SERVICE[p.service])} · ${esc(BILLING[p.billing])}${n ? ` · ${n} khách đang thuê` : ''}</div>
    <button class="btn pri sm admin-only" data-act="newContract" data-plan="${p.id}">Tạo hợp đồng theo gói</button></div>`;
}
const cStatus = c => c.status === 'pending' ? badge('Chờ thanh toán', 'b-warn') : c.status === 'active' ? (diffDays(today(), c.end) < 0 ? badge('Quá hạn HĐ', 'b-warn') : badge('Hiệu lực', 'b-ok')) : c.status === 'cancelled' ? badge('Đã hủy') : badge('Đã kết thúc');

VIEWS.contracts = {
  title: 'Hợp đồng & khách thuê',
  render() {
    const tab = UI.ctab;
    const tabs = [['contracts', 'Hợp đồng'], ['customers', 'Khách hàng'], ['invoices', 'Hóa đơn'], ['requests', 'Yêu cầu dịch vụ'], ['plots', 'Danh mục lô'], ['pay', 'Thanh toán & thuế']];
    let body = '';
    if (tab === 'contracts') body = tbl(['Mã HĐ', 'Khách thuê', 'Gói', 'Lô', ['Quy mô', 'r'], 'Thời hạn', ['Giá trị', 'r'], 'Trạng thái', ''], S.contracts.slice().sort((a, b) => b.start.localeCompare(a.start)).map(c => {
      const p = get('plots', c.plotId) || {}, pl = planOf(c.planId), id = c.identity || {};
      return `<tr><td><b>${esc(c.code)}</b><br><button class="btn sm" data-act="contractDoc" data-id="${c.id}">📄 Văn bản</button></td><td><a href="#/portal/${c.customerId}">${esc(custName(c.customerId))}</a>${id.sign ? `<br><small><i class="dot" style="background:${esc(id.color)}"></i> ${esc(id.icon)} ${esc(id.sign)}</small>` : ''}</td><td>${pl.icon} ${esc(pl.n)}<br><small class="muted">${esc(SERVICE[c.service])}</small></td><td>${esc(p.code || '')}</td><td class="r num">${c.packs ? nf(c.packs) + ' gói<br><small class="muted">' + nf(c.qty) + '</small>' : nf(c.qty)}</td><td>${fds(c.start)} → ${fd(c.end)}</td><td class="r num">${c.billing === 'share' ? nf(c.sharePct) + '% SL' : short(c.sub != null ? c.sub : contractValue(c))}${c.vat ? `<br><small class="muted">+VAT ${short(c.vat)}</small>` : ''}</td>
      <td>${cStatus(c)}${c.verifiedAt ? `<br><small class="muted">✅ ${fds(c.verifiedAt)}</small>` : ''}</td><td>${acts(c.status === 'pending' ? `<button class="btn sm pri" data-act="openPay" data-id="${c.id}">💳 Xác thực TT</button><button class="btn sm danger" data-act="cancelHold" data-id="${c.id}">Hủy</button>` : c.status === 'active' ? `<button class="btn sm" data-act="reissue" data-id="${c.id}" title="Cấp lại mã truy cập">🔑</button><button class="btn sm" data-act="renew" data-id="${c.id}">Gia hạn</button><button class="btn sm danger" data-act="endContract" data-id="${c.id}">Kết thúc</button>` : '')}</td></tr>`;
    }), 'Chưa có hợp đồng');
    else if (tab === 'customers') body = tbl(['Khách hàng', 'Nhóm', 'Liên hệ', 'Tài khoản', ['HĐ hiệu lực', 'r'], ['Đã chi', 'r'], ['Điểm', 'r'], ''], S.customers.map(c => {
      const spent = sum(S.invoices.filter(i => i.customerId === c.id && i.paid && i.kind !== 'deposit'), i => i.amount) + sum(S.orders.filter(o => o.customerId === c.id && o.paid), o => o.total);
      return `<tr><td><a href="#/portal/${c.id}"><b>${esc(c.name)}</b></a> ${isMember(c.id) ? badge('⭐ Thành viên', 'b-ok') : ''}${c.note ? `<br><small class="muted">${esc(c.note)}</small>` : ''}</td><td>${esc(c.type)}</td><td>${esc(c.phone || '')}<br><small class="muted">${esc(c.address || '')}</small></td><td><code>${esc(c.username || '—')}</code>${c.lastLogin ? `<br><small class="muted">đăng nhập ${fds(c.lastLogin)}</small>` : ''}</td><td class="r num">${S.contracts.filter(x => x.customerId === c.id && x.status === 'active').length}</td><td class="r num">${short(spent)}</td><td class="r num">${nf(custPoints(c.id))}</td><td>${acts(editBtn('editCustomer', c.id), delBtn('customers', c.id))}</td></tr>`;
    }), 'Chưa có khách hàng');
    else if (tab === 'invoices') body = tbl(['Số HĐơn', 'Khách', 'Nội dung', 'Hạn', ['Số tiền', 'r'], 'Trạng thái', ''], S.invoices.slice().sort((a, b) => (a.paid - b.paid) || a.date.localeCompare(b.date)).map(i => `<tr><td>${esc(i.code)}</td><td>${esc(custName(i.customerId))}</td><td>${esc(i.desc)}${i.vat ? `<br><small class="muted">Chưa thuế ${money(i.sub)} · VAT ${money(i.vat)}</small>` : ''}</td><td>${fd(i.date)}</td><td class="r num">${money(i.amount)}</td><td>${invBadge(i)}${i.paid ? `<br><small class="muted">${fd(i.paidDate)}</small>` : ''}</td><td>${acts(i.paid ? '' : `<button class="btn sm pri" data-act="payInv" data-id="${i.id}">💵 Thu tiền</button>`)}</td></tr>`), 'Chưa có hóa đơn');
    else if (tab === 'requests') body = tbl(['Ngày', 'Khách', 'Yêu cầu', 'Mong muốn', ['Phí', 'r'], 'Trạng thái', ''], S.requests.slice().sort((a, b) => b.created.localeCompare(a.created)).map(r => { const st = reqStatus(r); return `<tr><td>${fd(r.created)}</td><td><a href="#/portal/${r.customerId}">${esc(custName(r.customerId))}</a></td><td><b>${esc(r.type)}</b><br><small>${esc(r.note)}</small></td><td>${fd(r.date)}</td><td class="r num">${r.fee ? money(r.fee) : ''}</td><td>${badge(st, { 'Mới': 'b-warn', 'Đang xử lý': 'b-info', 'Hoàn tất': 'b-ok' }[st] || '')}</td><td>${acts(st === 'Mới' ? `<button class="btn sm" data-act="reqAccept" data-id="${r.id}">Tiếp nhận</button>` : '', st !== 'Hoàn tất' && st !== 'Hủy' ? `<button class="btn sm pri" data-act="reqDone" data-id="${r.id}">✔ Hoàn tất</button>` : '')}</td></tr>`; }), 'Chưa có yêu cầu');
    else if (tab === 'plots') body = tbl(['Mã lô', 'Khu', ['Quy mô', 'r'], 'Trạng thái', 'Khách thuê', 'Đặc điểm', ''], S.plots.map(p => { const c = S.contracts.find(x => x.plotId === p.id && x.status === 'active'); return `<tr><td><b>${esc(p.code)}</b></td><td>${esc((get('units', p.unitId) || {}).name || '')}</td><td class="r num">${nf(p.size)} ${plotUnitL(p)}</td><td>${badge({ free: 'Trống', rented: 'Đang thuê', reserved: 'Giữ chỗ', maint: 'Cải tạo' }[p.status], { free: 'b-ok', rented: 'b-info', reserved: 'b-warn', maint: '' }[p.status])}</td><td>${c ? esc(custName(c.customerId)) : ''}</td><td><small>${esc(p.note || '')}</small></td><td>${acts(editBtn('editPlot', p.id), delBtn('plots', p.id))}</td></tr>`; }), 'Chưa có lô');
    else {
      const P = payCfg(), sample = P.bin && P.account ? QR.svg(vietQR({ bin: P.bin, account: P.account, amount: 100000, purpose: 'THU QR' }), 150, 'QR thử') : '';
      body = `<form id="payCfgForm" class="form-grid" style="max-width:720px"><label class="f"><span>Ngân hàng nhận tiền</span><select name="bin"><option value="">— Chọn ngân hàng —</option>${BANKS.map(([b, n]) => `<option value="${b}" ${P.bin === b ? 'selected' : ''}>${n} (${b})</option>`).join('')}</select></label>
        <label class="f"><span>Số tài khoản</span><input name="account" value="${esc(P.account)}" inputmode="numeric" placeholder="Số tài khoản của trang trại"></label>
        <label class="f"><span>Chủ tài khoản</span><input name="holder" value="${esc(P.holder)}" placeholder="VD: HKD DICH VU TONG HOP DHT"></label>
        <label class="f"><span>Thuế GTGT áp dụng cho tiền thuê (%)</span><input name="vat" type="number" step="any" min="0" value="${esc(P.vat)}"><div class="hint">Kiểm tra mức thuế suất với kế toán/cơ quan thuế trước khi áp dụng.</div></label>
        <div class="full form-actions" style="justify-content:flex-start"><button class="btn pri">Lưu cấu hình</button></div></form>
        ${sample ? `<div class="payqr" style="margin-top:12px">${sample}<small class="muted">Mã QR thử 100.000 ₫ — quét bằng ứng dụng ngân hàng để kiểm tra tên chủ tài khoản trước khi dùng thật.</small></div>` : alertHtml({ lv: 'info', msg: 'Nhập ngân hàng và số tài khoản để hệ thống tạo mã QR VietQR trên bảng thanh toán hợp đồng.' })}`;
    }
    const btn = { contracts: '<button class="btn pri" data-act="newContract">＋ Hợp đồng</button>', customers: '<button class="btn pri" data-act="newCustomer">＋ Khách hàng</button>', plots: '<button class="btn pri" data-act="newPlot">＋ Lô</button>' }[tab] || '';
    return `<div class="toolbar"><div class="tabs" style="margin:0;border:0">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="ctab" data-k="${k}">${l}</button>`).join('')}</div><span class="grow"></span>${btn}</div><div class="card">${body}</div>`;
  }
};

VIEWS.portal = {
  title: id => { const c = get('customers', tenantId() || id || UI.cust); return c ? (tenantId() ? 'Vườn của tôi · ' : 'Cổng khách thuê · ') + c.name : 'Cổng khách thuê'; },
  render(arg) {
    const tid = tenantId();
    const cid = tid || (get('customers', arg) ? arg : (get('customers', UI.cust) ? UI.cust : (S.contracts.find(c => c.status === 'active') || S.customers[0] || {}).customerId || (S.customers[0] || {}).id));
    const c = get('customers', cid);
    if (!c) return empty('Chưa có khách hàng', '<button class="btn pri" data-act="newContract">Ký hợp đồng đầu tiên</button>');
    UI.cust = cid;
    const rank = x => ({ pending: 0, active: 1 })[x.status] ?? 2;
    const cs = S.contracts.filter(x => x.customerId === cid && x.status !== 'cancelled').sort((a, b) => rank(a) - rank(b));
    const invs = S.invoices.filter(i => i.customerId === cid), due = invs.filter(i => !i.paid);
    const reqs = S.requests.filter(r => r.customerId === cid), orders = S.orders.filter(o => o.customerId === cid);
    const evs = S.events.filter(e => e.regs.some(r => r.customerId === cid));
    const member = isMember(cid);
    return `<div class="toolbar"><select class="admin-only" data-chg="portalCust" aria-label="Chọn khách">${S.customers.map(x => `<option value="${x.id}" ${x.id === cid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="grow"></span><button class="btn" data-act="newRequest" data-id="${cid}">🙋 Yêu cầu dịch vụ</button><a class="btn" href="#/market">🛒 Chợ nông trại</a><button class="btn pri admin-only" data-act="newContract" data-cust="${cid}">＋ Thuê thêm</button></div>
    <div class="card hero-cust"><div><small class="muted">Xin chào</small><h2>${esc(c.name)}</h2><small class="muted">${esc(c.type)} · khách từ ${fd(c.joined)} · ${esc(c.phone || '')} · tài khoản <code>${esc(c.username || '—')}</code></small></div>
      <div class="hero-stats"><div><b>${cs.filter(x => x.status === 'active').length}</b><small>vườn đang thuê</small></div><div><b>${nf(custPoints(cid))}</b><small>điểm tích lũy</small></div><div><b class="${due.some(i => invStatus(i) === 'overdue') ? 't-bad' : ''}">${short(sum(due, i => i.amount))}</b><small>chưa thanh toán</small></div><div>${member ? `<b class="t-ok">−${MEMBER_DISCOUNT * 100}%</b><small>ưu đãi thành viên</small>` : '<b>—</b><small>chưa là thành viên</small>'}</div></div></div>
    ${cs.map(portalGarden).join('') || `<div class="card sec">${empty('Chưa có hợp đồng thuê', `<button class="btn pri admin-only" data-act="newContract" data-cust="${cid}">Ký hợp đồng</button>`)}</div>`}
    <div class="grid g2 sec">
      <div class="card"><h3 style="margin-bottom:8px">💳 Hóa đơn</h3>${tbl(['Nội dung', 'Hạn', ['Số tiền', 'r'], ''], invs.slice().sort((a, b) => (a.paid - b.paid) || a.date.localeCompare(b.date)).slice(0, 12).map(i => `<tr><td>${esc(i.desc)}<br><small class="muted">${esc(i.code)}</small></td><td>${fd(i.date)}</td><td class="r num">${money(i.amount)}</td><td>${i.paid ? invBadge(i) : `${invStatus(i) === 'overdue' ? invBadge(i) + ' ' : ''}<button class="btn sm pri" data-act="payInv" data-id="${i.id}">Thanh toán</button>`}</td></tr>`), 'Không có hóa đơn')}</div>
      <div class="card"><div class="card-head"><h3>🙋 Yêu cầu dịch vụ</h3><button class="btn sm" data-act="newRequest" data-id="${cid}">＋ Gửi yêu cầu</button></div>${reqs.slice().reverse().map(r => { const st = reqStatus(r); return `<div class="task"><div class="grow"><b>${esc(r.type)}</b> ${badge(st, { 'Mới': 'b-warn', 'Đang xử lý': 'b-info', 'Hoàn tất': 'b-ok' }[st] || '')}<div class="meta">${fd(r.date)} · ${esc(r.note)}</div></div></div>`; }).join('') || '<p class="muted">Chưa có yêu cầu</p>'}</div>
      <div class="card"><h3 style="margin-bottom:8px">🛒 Đơn hàng chợ nông trại</h3>${orders.slice().reverse().map(o => `<div class="task"><div class="grow"><b>${esc(o.code)}</b> ${orderBadge(o)}<div class="meta">${fd(o.date)} · ${esc(o.items.map(i => i.title).join(', '))} · ${money(o.total)}</div></div></div>`).join('') || '<p class="muted">Chưa có đơn hàng</p>'}</div>
      <div class="card"><h3 style="margin-bottom:8px">🎉 Sự kiện đã đăng ký</h3>${evs.map(e => `<div class="task"><div class="grow"><b>${esc(e.title)}</b><div class="meta">${fd(e.date)} ${esc(e.time || '')} · ${sum(e.regs.filter(r => r.customerId === cid), r => r.qty)} người</div></div></div>`).join('') || `<p class="muted">Chưa đăng ký sự kiện. <a href="#/events">Xem lịch sự kiện</a></p>`}</div>
    </div>`;
  }
};
function portalGarden(c) {
  const plot = get('plots', c.plotId) || {}, pl = planOf(c.planId), b = curBatch(c), past = c.batchIds.map(id => get('batches', id)).filter(Boolean);
  if (c.status === 'pending') return `<div class="card sec"><h3 style="margin-bottom:8px">⏳ Hợp đồng ${esc(c.code)} đang chờ thanh toán</h3>${paymentHtml(c, { admin: !tenantId() })}</div>`;
  const lots = S.lots.filter(l => c.batchIds.includes(l.batchId));
  let prog = '';
  if (b) {
    const s = batchStats(b), sop = s.sop, st = stageOf(sop, s.day);
    const open = S.tasks.filter(t => t.batchId === b.id && !t.done).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 4);
    const diary = [...s.logs.map(l => ({ date: l.date, txt: LOG_TYPES[l.type].n + (l.note ? ': ' + l.note : '') })), ...S.tasks.filter(t => t.batchId === b.id && t.done && t.date <= today()).map(t => ({ date: t.date, txt: '✔ ' + t.title }))].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);
    prog = `<div class="stages">${sop.stages.map(x => `<div class="${x === st ? 'cur' : ''}"><b>${esc(x.n)}</b>N${x.f}→${x.t}</div>`).join('')}</div>
      <div class="grid g2" style="margin-top:12px">
        <div><h4>🌡️ Điều kiện hiện tại · ${esc(st.n)}</h4>${envChips(b.unitId, st.env)}<p class="muted" style="font-size:13px">💡 ${esc(st.tip)}</p>
          <h4>${b.diy ? '🧑‍🌾 Việc của bạn' : '📅 Sắp tới (đội kỹ thuật thực hiện)'}</h4>${open.map(t => b.diy ? taskRow(t, true) : `<div class="task"><div class="grow tt">${esc(t.title)}<div class="meta">${fd(t.date)}</div></div></div>`).join('') || '<p class="muted">Không có việc sắp tới</p>'}</div>
        <div><h4>📔 Nhật ký vườn</h4>${diary.map(x => `<div class="task"><div class="grow"><small class="muted">${fd(x.date)}</small><div>${esc(x.txt)}</div></div></div>`).join('') || '<p class="muted">Chưa có ghi chép</p>'}</div>
      </div>`;
  } else if (c.status === 'active') prog = alertHtml({ lv: 'info', html: `Vụ trước đã kết thúc. <button class="btn sm pri admin-only" data-act="newCycle" data-id="${c.id}">🌱 Bắt đầu vụ mới</button>` });
  return `<div class="card sec"><div class="card-head"><div class="sop-h"><span class="ico">${pl.icon}</span><div><b>${esc(pl.n)} · lô ${esc(plot.code || '')}</b> ${cStatus(c)}<br><small class="muted">${esc(c.code)} · ${c.packs ? nf(c.packs) + ' gói · ' : ''}${nf(c.qty)} ${b ? esc(sopOf(b).qtyUnit) : ''} · ${esc(SERVICE[c.service])} · ${fd(c.start)} → ${fd(c.end)}${b ? ` · <a href="#/batch/${b.id}" class="admin-only">${esc(sopOf(b).name)}, ngày ${bDay(b)}</a>` : ''}${c.billing === 'share' ? ` · nhận ${nf(c.sharePct)}% sản lượng` : ''}</small></div></div>
    ${acts(`<button class="btn sm" data-act="contractDoc" data-id="${c.id}">📄 Hợp đồng</button>`, c.status === 'active' ? `<button class="btn sm" data-act="newRequest" data-id="${c.customerId}" data-contract="${c.id}">🙋 Yêu cầu</button>` : '', c.status === 'active' && b ? `<button class="btn sm admin-only" data-act="newHarvest" data-id="${b.id}">📦 Ghi thu hoạch</button>` : '', c.status === 'active' ? `<button class="btn sm admin-only" data-act="renew" data-id="${c.id}">Gia hạn</button>` : '')}</div>
    ${c.identity ? `<div class="sign-wrap">${signHtml(c, plot.code)}</div>` : ''}
    ${prog}
    <h4 class="sec">🧺 Sản phẩm từ vườn (${past.length} vụ/lứa)</h4>${tbl(['Lô', 'Ngày thu', 'Sản phẩm', ['Sản lượng', 'r'], ['Đã giao', 'r'], ''], lots.slice().reverse().map(l => { const dv = sum(l.moves.filter(m => m.type === 'deliver'), m => m.qty); return `<tr><td><a href="#/trace/${encodeURIComponent(l.code)}"><code>${esc(l.code)}</code></a></td><td>${fd(l.date)}</td><td>${esc(l.product)}</td><td class="r num">${nf(l.qty, 1)} ${esc(l.unit)}</td><td class="r num">${nf(dv, 1)}</td><td>${l.remain > 0 ? `<button class="btn sm admin-only" data-act="deliver" data-id="${l.id}" data-cust="${c.customerId}">🚚 Giao khách</button>` : ''}</td></tr>`; }), 'Chưa có thu hoạch')}</div>`;
}

/* ------------------------ ĐĂNG NHẬP KHÁCH THUÊ ------------------------ */
const TENANT_VIEWS = ['portal', 'market', 'events', 'info', 'trace'];
const tenantId = () => { let t = ''; try { t = sessionStorage.getItem('dht_tenant') || ''; } catch (e) { t = UI._tenant || ''; } return t && S && get('customers', t) ? t : ''; };
function setTenant(id) { UI._tenant = id; try { if (id) sessionStorage.setItem('dht_tenant', id); else sessionStorage.removeItem('dht_tenant'); } catch (e) { /* phiên riêng tư */ } }
VIEWS.login = {
  title: 'Đăng nhập khách thuê', nav: 'portal',
  render(arg) {
    const demo = S.demoLogin;
    return `<div class="login-wrap"><div class="card login"><div style="text-align:center"><img src="icon.svg" alt="" width="52" height="52"><h2 style="margin:8px 0 2px">Tài khoản khách thuê</h2><small class="muted">${esc(S.farm.name)}</small></div>
      <form id="loginForm" autocomplete="off"><label class="f"><span>Tên đăng nhập</span><input name="u" value="${esc(arg || '')}" autocomplete="username" required></label>
      <label class="f"><span>Mã truy cập (in trên phiếu hợp đồng)</span><input name="c" type="password" autocomplete="current-password" placeholder="XXXX-XXXX" required></label>
      <div id="loginMsg"></div><button class="btn pri" style="width:100%;justify-content:center">🔐 Đăng nhập</button></form>
      <p class="muted" style="font-size:12px">Mã truy cập được cấp riêng cho từng hợp đồng khi ký và được lưu dưới dạng băm SHA-256. Quên mã? Liên hệ nông trại để được cấp lại.</p>
      ${demo ? `<div class="alert info"><span class="ic">🧪</span><div class="grow"><b>Tài khoản dùng thử (dữ liệu mẫu):</b><br>Tên đăng nhập <code>${esc(demo.username)}</code> · Mã <code>${esc(demo.code)}</code></div></div>` : ''}</div></div>`;
  }
};
function doLogin(u, code) {
  const now = Date.now();
  if (UI.lockUntil && now < UI.lockUntil) return `Tạm khóa do nhập sai nhiều lần — thử lại sau ${Math.ceil((UI.lockUntil - now) / 1000)} giây`;
  const cust = S.customers.find(x => (x.username || '').toLowerCase() === String(u).trim().toLowerCase());
  const ok = cust && S.contracts.some(k => k.customerId === cust.id && k.accessHash && (k.status === 'active' || k.status === 'pending') && hashCode(k.salt, code) === k.accessHash);
  if (!ok) { UI.fails = (UI.fails || 0) + 1; if (UI.fails >= 5) { UI.lockUntil = now + 60000; UI.fails = 0; } return 'Tên đăng nhập hoặc mã truy cập không đúng'; }
  UI.fails = 0; setTenant(cust.id); cust.lastLogin = today(); save();
  location.hash = '#/portal/' + cust.id; render(); toast('Xin chào ' + cust.name);
  return '';
}
function tenantNav(t) {
  const c = get('customers', t);
  return `<div class="tenant-card"><small>Tài khoản khách thuê</small><b>${esc(c.name)}</b><small><code>${esc(c.username || '')}</code></small></div><div class="grp">Vườn của tôi</div>`
    + [['portal/' + t, '🏡', 'Vườn & hợp đồng'], ['market', '🛒', 'Chợ nông trại'], ['events', '🎉', 'Sự kiện & thông báo'], ['info', 'ℹ️', 'Thông tin chung']].map(([k, ic, l]) => `<a href="#/${k}" class="${location.hash.startsWith('#/' + k.split('/')[0]) ? 'on' : ''}"><span>${ic}</span>${l}</a>`).join('')
    + `<a href="#" data-act="logout"><span>🚪</span>Đăng xuất</a>`;
}
const authEl = document.createElement('button');
authEl.className = 'btn sm'; authEl.id = 'authBtn';
document.querySelector('.top-actions').prepend(authEl);
authEl.addEventListener('click', () => { if (tenantId()) ACT.logout(); else location.hash = '#/login'; });
const _render0 = render;
render = function () {
  const t = tenantId();
  document.body.classList.toggle('tenant', !!t);
  if (t) { const r = route(); if (!TENANT_VIEWS.includes(r.v) || (r.v === 'portal' && r.arg !== t)) { const h = '#/portal/' + t; if (location.hash !== h) { location.hash = h; return; } } }
  _render0();
  if (t) $('#nav').innerHTML = tenantNav(t);
  authEl.innerHTML = t ? '🚪 <span class="lbl">Đăng xuất</span>' : '👤 <span class="lbl">Khách thuê</span>';
  authEl.title = t ? 'Đăng xuất tài khoản khách thuê' : 'Đăng nhập tài khoản khách thuê';
};
document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm') { const f = e.target.elements, msg = doLogin(f.u.value, f.c.value); if (msg) $('#loginMsg').innerHTML = alertHtml({ lv: 'bad', msg }); }
  if (e.target.id === 'payCfgForm') { const f = e.target.elements; Object.assign(payCfg(), { bin: f.bin.value, account: f.account.value.replace(/\s/g, ''), holder: f.holder.value.trim(), vat: +f.vat.value || 0 }); save(); render(); toast('Đã lưu cấu hình thanh toán'); }
});

/* ============================ TRANG: CHỢ ============================ */
VIEWS.market = {
  title: 'Chợ nông trại',
  render() {
    const k = UI.mk, q = UI.mq.toLowerCase();
    const ls = S.listings.filter(l => l.active && (!k || l.kind === k) && (!q || l.title.toLowerCase().includes(q)));
    const lines = cartLines(), qt = quote(lines, { customerId: UI.cust, delivery: 'pickup' });
    return `<div class="toolbar"><div class="tabs" style="margin:0;border:0"><button class="${!k ? 'on' : ''}" data-act="mk" data-k="">Tất cả</button>${Object.entries(LIST_KINDS).map(([key, v]) => `<button class="${k === key ? 'on' : ''}" data-act="mk" data-k="${key}">${v.icon} ${v.n}</button>`).join('')}</div><input data-inp="mq" placeholder="Tìm sản phẩm…" value="${esc(UI.mq)}"><span class="grow"></span><button class="btn admin-only" data-act="newListing">＋ Đăng sản phẩm</button></div>
    <div class="shop-wrap"><div class="shop">${ls.map(l => {
      const stock = listingStock(l), blocked = listingBlocked(l), lot = get('lots', l.lotId), inCart = (UI.cart.find(x => x.lid === l.id) || {}).qty || 0;
      return `<div class="card prod"><div class="pic">${esc(l.icon || LIST_KINDS[l.kind].icon)}</div><div class="grow"><b>${esc(l.title)}</b><br><small class="muted">${l.sellerType === 'customer' ? '🧺 ' + esc(custName(l.sellerId)) : '🏡 ' + esc(S.farm.name)}</small>
        <p style="font-size:13px;margin:6px 0">${esc(l.desc || '')}</p>
        ${lot ? `<a class="tag" href="#/trace/${encodeURIComponent(lot.code)}">🔎 ${esc(lot.code)} · thu ${fds(lot.date)}</a>` : ''}
        <div class="price">${money(l.price)}<small>/${esc(l.unit)}</small></div>${l.sellerType !== 'customer' ? `<small class="t-ok">Thành viên: ${money(l.price * (1 - MEMBER_DISCOUNT))}</small>` : ''}
        <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap"><small class="muted">Còn ${nf(stock, 1)} ${esc(l.unit)}</small><span class="grow"></span>${blocked ? badge('Cách ly đến ' + fds(blocked), 'b-warn') : stock > inCart ? `<button class="btn sm pri" data-act="addCart" data-id="${l.id}">＋ Giỏ${inCart ? ' (' + nf(inCart) + ')' : ''}</button>` : badge('Hết hàng')}<span class="admin-only">${editBtn('editListing', l.id)}</span></div></div></div>`;
    }).join('') || empty('Không có sản phẩm phù hợp')}</div>
    <div class="card cart"><h3>🛒 Giỏ hàng</h3>${lines.map(x => `<div class="task"><div class="grow"><b>${esc(x.l.title)}</b><div class="meta">${money(x.l.price)}/${esc(x.l.unit)}</div></div><div class="qty"><button class="btn sm" data-act="cartQty" data-id="${x.lid}" data-d="-1" aria-label="Bớt">−</button><span class="num">${nf(x.qty, 2)}</span><button class="btn sm" data-act="cartQty" data-id="${x.lid}" data-d="1" aria-label="Thêm">＋</button></div></div>`).join('') || '<p class="muted">Chưa có sản phẩm</p>'}
      ${lines.length ? `<div style="display:flex;justify-content:space-between;margin-top:10px"><span>Tạm tính</span><b class="num">${money(qt.sub)}</b></div>${qt.disc ? `<div style="display:flex;justify-content:space-between" class="t-ok"><span>Ưu đãi thành viên</span><span class="num">−${money(qt.disc)}</span></div>` : ''}<button class="btn pri" style="width:100%;justify-content:center;margin-top:10px" data-act="checkout">Đặt hàng</button>` : ''}
      <p class="muted" style="font-size:12px;margin-bottom:0">Khách thuê vườn giảm ${MEMBER_DISCOUNT * 100}% hàng của nông trại. Sản phẩm có mã lô được bảo đảm truy xuất nguồn gốc và kiểm soát thời gian cách ly.</p></div></div>`;
  }
};
const orderBadge = o => badge(o.status, { 'Mới': 'b-warn', 'Đã xác nhận': 'b-info', 'Đang giao': 'b-info', 'Hoàn tất': 'b-ok', 'Đã hủy': '' }[o.status]) + (o.paid ? ' ' + badge('Đã thu', 'b-ok') : '');
VIEWS.orders = {
  title: 'Đơn hàng',
  render() {
    const t = UI.otab, list = S.orders.filter(o => t === 'all' || o.status === t).sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
    const m = today().slice(0, 7), mo = S.orders.filter(o => o.date.startsWith(m) && o.status !== 'Đã hủy');
    return `<div class="grid g4"><div class="card kpi"><span class="l">Đơn tháng này</span><span class="v">${mo.length}</span></div><div class="card kpi"><span class="l">Doanh số tháng</span><span class="v t-ok">${short(sum(mo, o => o.total))}</span></div><div class="card kpi"><span class="l">Chờ xử lý</span><span class="v ${S.orders.some(o => o.status === 'Mới') ? 't-warn' : ''}">${S.orders.filter(o => o.status === 'Mới').length}</span></div><div class="card kpi"><span class="l">Chưa thu tiền</span><span class="v">${short(sum(S.orders.filter(o => !o.paid && o.status !== 'Đã hủy'), o => o.total))}</span></div></div>
    <div class="toolbar sec"><div class="tabs" style="margin:0;border:0">${[...ORDER_FLOW, 'Đã hủy', 'all'].map(s => `<button class="${t === s ? 'on' : ''}" data-act="otab" data-k="${s}">${s === 'all' ? 'Tất cả' : s} (${s === 'all' ? S.orders.length : S.orders.filter(o => o.status === s).length})</button>`).join('')}</div><span class="grow"></span><a class="btn pri" href="#/market">＋ Đơn mới</a></div>
    <div class="card">${tbl(['Mã đơn', 'Ngày', 'Khách hàng', 'Sản phẩm (truy xuất)', 'Nhận hàng', ['Tổng', 'r'], 'Trạng thái', ''], list.map(o => {
      const i = ORDER_FLOW.indexOf(o.status), next = ORDER_FLOW[i + 1];
      return `<tr><td><b>${esc(o.code)}</b></td><td>${fd(o.date)}</td><td>${o.customerId ? `<a href="#/portal/${o.customerId}">${esc(o.name)}</a>` : esc(o.name)}${o.member ? ' ⭐' : ''}<br><small class="muted">${esc(o.phone || '')}</small></td>
      <td>${o.items.map(it => `${esc(it.title)} × ${nf(it.qty, 2)}${it.lotCode ? ` <a href="#/trace/${encodeURIComponent(it.lotCode)}" title="Truy xuất">🔎</a>` : ''}`).join('<br>')}</td><td><small>${o.delivery === 'ship' ? '🚚 ' + esc(o.address) : '🏡 Tại farm'}<br>${esc(o.pay)}</small></td>
      <td class="r num">${money(o.total)}${o.disc ? `<br><small class="t-ok">−${money(o.disc)}</small>` : ''}</td><td>${orderBadge(o)}</td>
      <td>${acts(next && o.status !== 'Đã hủy' ? `<button class="btn sm" data-act="orderNext" data-id="${o.id}">→ ${next}</button>` : '', !o.paid && o.status !== 'Đã hủy' ? `<button class="btn sm pri" data-act="orderPaid" data-id="${o.id}">💵 Đã thu</button>` : '', !o.paid && o.status !== 'Đã hủy' && o.status !== 'Hoàn tất' ? `<button class="btn sm danger" data-act="orderCancel" data-id="${o.id}">Hủy</button>` : '')}</td></tr>`;
    }), 'Không có đơn hàng')}</div>`;
  }
};

/* ======================== TRANG: THÔNG TIN CHUNG ======================== */
VIEWS.info = {
  title: 'Thông tin chung',
  render() {
    const I = S.info, f = S.farm;
    return `<div class="card hero-farm"><div class="grow"><small>🌱 ${esc(f.owner || '')}</small><h2>${esc(f.name)}</h2><p class="slogan">${esc(I.slogan || '')}</p><p>${esc(I.intro || '')}</p>
      <div class="facts"><span>📍 ${esc(f.address || '—')}</span><span>☎️ ${esc(f.phone || '—')}</span><span>🕗 ${esc(I.hours || '—')}</span><span>📐 ${esc(I.area || '—')}</span></div></div>
      <div class="acts admin-only" style="align-self:flex-start"><button class="btn sm" data-act="editInfo">✎ Sửa</button></div></div>
    <h2 class="sec" style="margin-bottom:10px">Các khu sản xuất</h2>
    <div class="grid g3">${S.units.map(u => { const b = unitBatch(u.id), free = S.plots.filter(p => p.unitId === u.id && p.status === 'free').length; return `<div class="card"><b>${FARM_TYPES[u.type].icon} ${esc(u.name)}</b><br><small class="muted">${nf(u.area)} m² · ${esc(u.location || '')}</small><p style="font-size:13px;margin:6px 0">${esc(u.note || '')}</p>${b ? `<small>Đang có: ${esc(sopOf(b).name)}</small><br>` : ''}${S.plots.some(p => p.unitId === u.id) ? `<small class="${free ? 't-ok' : 'muted'}">${free ? free + ' lô trống cho thuê' : 'Đã kín lô cho thuê'}</small>` : ''}</div>`; }).join('')}</div>
    <h2 class="sec" style="margin-bottom:10px">Gói thuê & bảng giá</h2>
    <div class="grid g3">${RENT_PLANS.map(planCard).join('')}</div>
    <div class="grid g2 sec">
      <div class="card"><h3 style="margin-bottom:8px">📜 Quy định khách thuê & tham quan</h3><ul class="clean">${String(I.rules || '').split('\n').filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
      <div class="card"><h3 style="margin-bottom:8px">❓ Câu hỏi thường gặp</h3>${FAQ.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    </div>`;
  }
};
VIEWS.events = {
  title: 'Sự kiện & thông báo',
  render() {
    const t = today(), up = S.events.filter(e => e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), past = S.events.filter(e => e.date < t);
    const news = S.news.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
    return `<div class="grid g2"><div>
      <div class="card-head"><h2>🎉 Sự kiện sắp tới</h2><button class="btn pri sm admin-only" data-act="newEvent">＋ Sự kiện</button></div>
      ${up.map(e => { const n = sum(e.regs, r => r.qty); return `<div class="card event" style="margin-bottom:12px"><div class="date"><b>${e.date.slice(8)}</b><small>Th${+e.date.slice(5, 7)}</small></div><div class="grow"><b>${esc(e.title)}</b> ${badge(e.kind, 'b-info')}<br><small class="muted">${esc(e.time || '')} · ${e.price ? money(e.price) + '/người' : 'Miễn phí'} · ${n}/${e.capacity} chỗ</small><p style="font-size:13px;margin:6px 0">${esc(e.desc || '')}</p><div class="prog"><i style="width:${Math.min(100, n / e.capacity * 100).toFixed(0)}%"></i></div>
        <div style="display:flex;gap:6px;margin-top:8px">${n < e.capacity ? `<button class="btn sm pri" data-act="register" data-id="${e.id}">Đăng ký</button>` : badge('Đã đủ chỗ', 'b-warn')}<span class="admin-only">${editBtn('editEvent', e.id)}${delBtn('events', e.id)}</span></div>${e.regs.length ? `<details class="faq admin-only"><summary>${e.regs.length} lượt đăng ký</summary>${e.regs.map(r => `<div style="font-size:13px">${esc(r.name)} · ${r.qty} người ${r.paid ? '✅' : ''}</div>`).join('')}</details>` : ''}</div></div>`; }).join('') || empty('Chưa có sự kiện sắp tới')}
      ${past.length ? `<p class="muted" style="font-size:13px">${past.length} sự kiện đã diễn ra.</p>` : ''}</div>
      <div><div class="card-head"><h2>📣 Thông báo</h2><button class="btn sm admin-only" data-act="newNews">＋ Thông báo</button></div>
      ${news.map(n => `<div class="card" style="margin-bottom:12px"><div class="card-head" style="margin-bottom:4px"><b>${n.pinned ? '📌 ' : ''}${esc(n.title)}</b><span class="admin-only">${acts(editBtn('editNews', n.id), delBtn('news', n.id))}</span></div><small class="muted">${fd(n.date)}</small><p style="margin:6px 0 0;white-space:pre-line">${esc(n.body)}</p></div>`).join('') || empty('Chưa có thông báo')}</div></div>`;
  }
};

/* ======================== TRANG: CHIA SẺ HỢP TÁC ======================== */
VIEWS.partners = {
  title: 'Đối tác liên kết',
  render() {
    const act = S.partners.filter(p => p.status === 'Đang hợp tác');
    const byModel = COOP_MODELS.map(m => [m, S.partners.filter(p => p.model === m).length]).filter(x => x[1]);
    return `<div class="grid g4"><div class="card kpi"><span class="l">Đối tác đang hợp tác</span><span class="v">${act.length}</span></div><div class="card kpi"><span class="l">Giá trị hợp tác/năm</span><span class="v t-ok">${short(sum(act, p => p.value || 0))}</span></div><div class="card kpi"><span class="l">Đang đàm phán</span><span class="v">${S.partners.filter(p => p.status === 'Đang đàm phán').length}</span></div><div class="card kpi"><span class="l">Mô hình</span><span class="v">${byModel.length}</span><span class="s muted">${byModel.map(([m, n]) => m + ' ' + n).join(' · ')}</span></div></div>
    <div class="toolbar sec"><span class="grow muted">Chuỗi liên kết: nông hộ vệ tinh & HTX cung ứng → farm chế biến, bảo quản → nhà hàng, siêu thị bao tiêu.</span><button class="btn pri" data-act="newPartner">＋ Đối tác</button></div>
    <div class="grid g3">${S.partners.map(p => `<div class="card"><div class="card-head" style="margin-bottom:6px"><b>${esc(p.name)}</b>${acts(editBtn('editPartner', p.id), delBtn('partners', p.id))}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${badge(p.kind, 'b-info')}${badge(p.model)}${badge(p.status, p.status === 'Đang hợp tác' ? 'b-ok' : 'b-warn')}</div><p style="font-size:13px;margin:8px 0">${esc(p.terms || '')}</p><small class="muted">👤 ${esc(p.contact || '')} ${p.phone ? '· ☎️ ' + esc(p.phone) : ''} · từ ${fd(p.since)}${p.value ? ' · ' + short(p.value) + '/năm' : ''}</small></div>`).join('')}</div>${S.partners.length ? '' : empty('Chưa có đối tác')}`;
  }
};
VIEWS.sharing = {
  title: 'Chia sẻ máy móc',
  render() {
    const t = today(), up = S.bookings.filter(b => b.status === 'Đã đặt').sort((a, b) => a.from.localeCompare(b.from));
    const rev = sum(S.bookings.filter(b => b.status === 'Hoàn tất'), b => b.fee);
    const days = []; for (let i = 0; i < 14; i++) days.push(addDays(t, i));
    const eqs = S.equip.filter(e => e.status !== 'Ngừng sử dụng');
    return `<div class="grid g4"><div class="card kpi"><span class="l">Máy có thể chia sẻ</span><span class="v">${eqs.filter(e => e.status !== 'Hỏng').length}</span></div><div class="card kpi"><span class="l">Lịch đã đặt</span><span class="v">${up.length}</span></div><div class="card kpi"><span class="l">Doanh thu chia sẻ</span><span class="v t-ok">${short(rev)}</span></div><div class="card kpi"><span class="l">Công suất 14 ngày tới</span><span class="v">${eqs.length ? pct(sum(up, b => Math.max(0, Math.min(diffDays(t, b.to), 13) - Math.max(diffDays(t, b.from), 0) + 1)) / (eqs.length * 14), 0) : '—'}</span></div></div>
    <div class="toolbar sec"><span class="grow muted">Tối ưu công suất máy móc đầu tư: cho đối tác, khách thuê, nông hộ lân cận thuê theo ngày (kèm người vận hành).</span><button class="btn pri" data-act="newBooking">＋ Đặt lịch máy</button></div>
    <div class="card"><h3 style="margin-bottom:8px">Lịch 14 ngày</h3><div class="tbl-wrap"><table class="gantt"><thead><tr><th>Máy</th>${days.map(d => `<th class="r">${d.slice(8)}</th>`).join('')}</tr></thead><tbody>${eqs.map(e => `<tr><td><b>${esc(e.name)}</b>${e.status === 'Hỏng' ? ' ' + badge('Hỏng', 'b-bad') : ''}</td>${days.map(d => { const b = S.bookings.find(x => x.equipId === e.id && x.status !== 'Hủy' && d >= x.from && d <= x.to); return `<td class="${b ? 'busy' : ''}" title="${b ? esc(b.who) : ''}">${b ? '■' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="card sec">${tbl(['Máy', 'Bên thuê', 'Thời gian', ['Phí', 'r'], 'Trạng thái', ''], S.bookings.slice().sort((a, b) => b.from.localeCompare(a.from)).map(b => { const e = get('equip', b.equipId) || {}; return `<tr><td>${esc(e.name || '(đã xóa)')}</td><td>${esc(b.who)}<br><small class="muted">${esc(b.whoType)} · ${esc(b.note || '')}</small></td><td>${fds(b.from)} → ${fd(b.to)} (${b.days} ngày)</td><td class="r num">${money(b.fee)}</td><td>${badge(b.status, { 'Đã đặt': 'b-info', 'Hoàn tất': 'b-ok' }[b.status] || '')}</td><td>${acts(b.status === 'Đã đặt' ? `<button class="btn sm pri" data-act="bookDone" data-id="${b.id}">✔ Hoàn tất & thu tiền</button><button class="btn sm danger" data-act="bookCancel" data-id="${b.id}">Hủy</button>` : '')}</td></tr>`; }), 'Chưa có lịch')}</div>`;
  }
};
VIEWS.pools = {
  title: 'Góp vốn theo lứa',
  render() {
    return `<div class="toolbar"><span class="grow muted">Cộng đồng cùng đầu tư vào từng lứa/vụ cụ thể; lợi nhuận chia theo tỷ lệ góp, minh bạch bằng dữ liệu chi phí – doanh thu thực của lứa.</span><button class="btn pri" data-act="newPool">＋ Mở đợt góp vốn</button></div>
    ${S.pools.map(p => {
      const b = get('batches', p.batchId), s = b && batchStats(b), raised = sum(p.contributions, x => x.amount), share = p.sharePct / 100;
      const profit = s ? s.profit : 0, payout = Math.max(profit, 0) * share;
      return `<div class="card" style="margin-bottom:16px"><div class="card-head"><div><b>💹 ${esc(p.name)}</b> ${badge(p.status, p.status === 'Đã chia lợi nhuận' ? 'b-ok' : 'b-info')}<br><small class="muted">${b ? `<a href="#/batch/${b.id}">${esc(b.name)}</a> · ${esc(sopOf(b).name)} · ngày ${bDay(b)}/${sopOf(b).duration}` : 'Lứa đã xóa'} · chia ${nf(p.sharePct)}% lợi nhuận</small></div>${acts(p.status === 'Đang huy động' ? `<button class="btn sm" data-act="contrib" data-id="${p.id}">＋ Góp vốn</button>` : '', b && b.status === 'done' && p.status !== 'Đã chia lợi nhuận' ? `<button class="btn sm pri" data-act="settlePool" data-id="${p.id}">Chia lợi nhuận</button>` : '')}</div>
        <p style="font-size:13px;margin:0 0 8px">${esc(p.desc || '')}</p>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Đã huy động <b>${money(raised)}</b></span><span>Mục tiêu ${money(p.target)} · ${pct(raised / p.target, 0)}</span></div><div class="prog"><i style="width:${Math.min(100, raised / p.target * 100).toFixed(0)}%"></i></div>
        <div class="grid g3" style="margin-top:12px"><div class="kpi"><span class="l">Lãi/lỗ lứa ${b && b.status === 'done' ? '(chốt)' : '(tạm tính)'}</span><span class="v ${profit >= 0 ? 't-ok' : 't-bad'}">${short(profit)}</span></div><div class="kpi"><span class="l">Quỹ chia nhà góp vốn</span><span class="v">${short(payout)}</span></div><div class="kpi"><span class="l">Tỷ suất trên vốn</span><span class="v">${raised ? pct(payout / raised) : '—'}</span></div></div>
        ${tbl(['Nhà góp vốn', 'Ngày', ['Số tiền', 'r'], ['Tỷ trọng', 'r'], ['Được chia (dự kiến)', 'r']], p.contributions.map(x => `<tr><td>${esc(x.name)}</td><td>${fd(x.date)}</td><td class="r num">${money(x.amount)}</td><td class="r num">${pct(x.amount / raised)}</td><td class="r num t-ok">${money(payout * x.amount / raised)}</td></tr>`), 'Chưa có người góp vốn')}</div>`;
    }).join('') || empty('Chưa có đợt góp vốn')}
    <p class="muted" style="font-size:12px">Lưu ý: vốn góp không ghi là doanh thu. Khi chia lợi nhuận, hệ thống ghi khoản chi "Chia lợi nhuận hợp tác". Việc huy động vốn cần tuân thủ quy định pháp luật hiện hành.</p>`;
  }
};
VIEWS.community = {
  title: 'Cộng đồng',
  render() {
    return `<div class="toolbar"><span class="grow muted">Nơi khách thuê, nông hộ, đối tác và kỹ sư chia sẻ kinh nghiệm, hỏi đáp, trao đổi giống.</span><button class="btn pri" data-act="newPost">✍️ Chia sẻ</button></div>
    ${S.posts.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => `<div class="card" style="margin-bottom:12px"><div class="card-head" style="margin-bottom:4px"><div><b>${esc(p.title)}</b> ${badge(p.tag, 'b-info')}<br><small class="muted">${esc(p.author)} · ${fd(p.date)}</small></div>${acts(delBtn('posts', p.id))}</div><p style="margin:6px 0;white-space:pre-line">${esc(p.body)}</p>
      <div style="display:flex;gap:6px"><button class="btn sm" data-act="like" data-id="${p.id}">👍 ${p.likes}</button><button class="btn sm" data-act="reply" data-id="${p.id}">💬 Trả lời (${p.replies.length})</button></div>
      ${p.replies.map(r => `<div class="reply"><b>${esc(r.author)}</b> <small class="muted">${fd(r.date)}</small><div>${esc(r.body)}</div></div>`).join('')}</div>`).join('') || empty('Chưa có bài viết')}`;
  }
};

/* ============================ HÀNH ĐỘNG ============================ */
Object.assign(ACT, {
  rtab: d => { UI.rtab = d.k; render(); }, ctab: d => { UI.ctab = d.k; render(); }, otab: d => { UI.otab = d.k; render(); }, mk: d => { UI.mk = d.k; render(); },
  newPlot: d => plotForm(null, d.id), editPlot: d => plotForm(d.id),
  plotClick: d => { const p = get('plots', d.id); openPanel('Hồ sơ lô ' + p.code, plotInfoHtml(p)); },
  newContract: d => { closeModal(); contractForm({ planId: d.plan, customerId: d.cust, plotId: d.plot }); },
  rmap: d => { UI.rmap = d.k; render(); },
  packStep: d => { FORM.data = readForm(); FORM.data.packs = Math.max(1, (Math.round(+FORM.data.packs) || 1) + (+d.d)); FORM.data.deposit = ''; drawForm(); },
  openPay: d => showPayment(d.id),
  verifyPay: (d, el) => {
    const c = get('contracts', d.id), ref = ((el.closest('.paybox') || document).querySelector('.txref') || {}).value || '';
    const amt = sum(S.invoices.filter(i => i.contractId === c.id && !i.paid), i => i.amount);
    if (!confirm(`Xác nhận đã nhận đủ ${money(amt)} cho hợp đồng ${c.code}${ref ? ' (GD ' + ref + ')' : ''}?\nLô sẽ được kích hoạt và hiển thị thông tin khách thuê.`)) return;
    activateContract(c, ref.trim()); closeModal(); save(); render();
    toast(`✅ Đã xác thực thanh toán — lô ${(get('plots', c.plotId) || {}).code} đã kích hoạt`);
  },
  cancelHold: d => {
    const c = get('contracts', d.id); if (!confirm(`Hủy giữ chỗ hợp đồng ${c.code}? Lô sẽ trở về trạng thái trống.`)) return;
    c.status = 'cancelled'; delete c.accessHash;
    const p = get('plots', c.plotId); if (p && p.status === 'reserved') { p.status = 'free'; delete p.holdBy; }
    S.invoices = S.invoices.filter(i => !(i.contractId === c.id && !i.paid));
    closeModal(); save(); render(); toast('Đã hủy giữ chỗ');
  },
  contractDoc: d => openPanel('Văn bản hợp đồng', contractDocHtml(get('contracts', d.id)) + '<div class="no-print" style="margin-top:12px"><button class="btn sm" data-act="printModal">🖨 In hợp đồng</button></div>'),
  printModal: () => { document.body.classList.add('print-modal'); window.print(); setTimeout(() => document.body.classList.remove('print-modal'), 800); },
  reissue: d => {
    const c = get('contracts', d.id), cust = get('customers', c.customerId);
    if (!confirm(`Cấp lại mã truy cập cho ${cust.name}? Mã cũ của hợp đồng ${c.code} sẽ hết hiệu lực.`)) return;
    const code = issueCode(c); save();
    openPanel('Mã truy cập mới', `<div class="cred"><div><small>Tên đăng nhập</small><b>${esc(cust.username || '')}</b></div><div><small>Mã truy cập (bảo mật)</small><b class="code">${esc(code)}</b></div><p>🔐 Mã chỉ hiển thị một lần. Hợp đồng ${esc(c.code)} · cấp ngày ${fd(today())}.</p></div><div class="no-print"><button class="btn sm" data-act="printModal">🖨 In phiếu</button></div>`);
  },
  logout: () => { setTenant(''); location.hash = '#/login'; render(); toast('Đã đăng xuất'); }, renew: d => renewForm(d.id), newCycle: d => cycleForm(d.id),
  newCustomer: () => customerForm(), editCustomer: d => customerForm(d.id),
  endContract: d => {
    const c = get('contracts', d.id), unpaid = S.invoices.filter(i => i.contractId === c.id && !i.paid && i.kind !== 'deposit' && i.date <= today());
    if (!confirm(`Kết thúc hợp đồng ${c.code}?${unpaid.length ? `\nCòn ${unpaid.length} hóa đơn đến hạn chưa thu.` : ''}\nLô sẽ trở về trạng thái trống, vụ đang chạy được đóng.`)) return;
    c.status = 'ended'; c.endedAt = today();
    const p = get('plots', c.plotId); if (p) p.status = 'free';
    const b = curBatch(c); if (b) { b.status = 'done'; b.end = today(); S.tasks.filter(t => t.batchId === b.id && !t.done && t.date > today()).forEach(t => { t.done = true; t.skipped = true; }); }
    S.invoices = S.invoices.filter(i => !(i.contractId === c.id && !i.paid && i.date > today()));
    const dep = S.invoices.find(i => i.contractId === c.id && i.kind === 'deposit' && i.paid && !i.refunded);
    if (dep && confirm(`Hoàn trả tiền đặt cọc ${money(dep.amount)} cho khách?`)) { dep.refunded = true; S.fin.push({ id: uid(), date: today(), type: 'out', cat: 'Hoàn tiền đặt cọc', amount: dep.amount, batchId: '', note: `${c.code} · ${custName(c.customerId)}` }); }
    save(); render(); toast('Đã kết thúc hợp đồng');
  },
  payInv: d => {
    const i = get('invoices', d.id), c = get('contracts', i.contractId);
    if (c && c.status === 'pending') return showPayment(c.id);
    if (tenantId()) { const P = payCfg(); return openPanel('Thanh toán hóa đơn ' + i.code, `<p>${esc(i.desc)} · <b>${money(i.amount)}</b></p>` + (P.bin && P.account ? `<div class="payqr">${QR.svg(vietQR({ bin: P.bin, account: P.account, amount: i.amount, purpose: i.code }), 200, 'Mã QR chuyển khoản')}<table class="kv"><tr><td>Ngân hàng</td><td><b>${esc((BANKS.find(b => b[0] === P.bin) || [])[1] || P.bin)}</b></td></tr><tr><td>Số tài khoản</td><td><b>${esc(P.account)}</b></td></tr><tr><td>Chủ TK</td><td>${esc(P.holder || '')}</td></tr><tr><td>Nội dung CK</td><td><b>${esc(i.code)}</b></td></tr></table></div>` : alertHtml({ lv: 'info', msg: 'Vui lòng liên hệ nông trại để nhận thông tin chuyển khoản.' })) + alertHtml({ lv: 'info', msg: 'Nông trại sẽ xác nhận sau khi nhận được thanh toán.' })); }
    if (!confirm(`Xác nhận thu ${money(i.amount)} – ${i.desc}?`)) return; payInvoice(i); save(); render(); toast('Đã thu tiền và ghi sổ tài chính'); },
  newRequest: d => requestForm(d.id, d.contract),
  reqAccept: d => { get('requests', d.id).status = 'Đang xử lý'; save(); render(); },
  reqDone: d => {
    const r = get('requests', d.id), t = get('tasks', r.taskId);
    if (t) { t.done = true; t.doneAt = Date.now(); }
    r.status = 'Hoàn tất';
    if (r.fee > 0) { const c = get('contracts', r.contractId); S.invoices.push({ id: uid(), code: `${c.code}-DV${S.requests.indexOf(r) + 1}`, contractId: c.id, customerId: r.customerId, date: today(), amount: r.fee, desc: 'Dịch vụ: ' + r.type, kind: 'service', paid: false }); }
    save(); render(); toast('Đã hoàn tất yêu cầu' + (r.fee > 0 ? ' — đã lập hóa đơn phí dịch vụ' : ''));
  },
  deliver: d => deliverForm(d.id, d.cust),
  newListing: () => listingForm(), editListing: d => listingForm(d.id),
  addCart: d => { const l = get('listings', d.id), x = UI.cart.find(y => y.lid === l.id); if (x) x.qty = Math.min(x.qty + 1, listingStock(l)); else UI.cart.push({ lid: l.id, qty: Math.min(1, listingStock(l)) }); render(); },
  cartQty: d => { const x = UI.cart.find(y => y.lid === d.id), l = get('listings', d.id); x.qty = Math.min(x.qty + (+d.d), listingStock(l)); if (x.qty <= 0) UI.cart = UI.cart.filter(y => y !== x); render(); },
  checkout: () => checkoutForm(),
  orderNext: d => { const o = get('orders', d.id); o.status = ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1]; save(); render(); },
  orderPaid: d => { const o = get('orders', d.id); if (!confirm(`Xác nhận đã thu ${money(o.total)} cho đơn ${o.code}?`)) return; payOrder(o); save(); render(); toast('Đã ghi nhận thanh toán'); },
  orderCancel: d => {
    const o = get('orders', d.id); if (!confirm(`Hủy đơn ${o.code} và hoàn lại tồn kho?`)) return;
    for (const it of o.items) { const lot = get('lots', it.lotId), l = get('listings', it.lid); if (lot) { lot.remain = +(lot.remain + it.qty).toFixed(3); lot.moves = lot.moves.filter(m => m.orderId !== o.id); } else if (l) l.stock = +(l.stock + it.qty).toFixed(3); }
    o.status = 'Đã hủy'; save(); render(); toast('Đã hủy đơn');
  },
  editInfo: () => infoForm(),
  newEvent: () => eventForm(), editEvent: d => eventForm(d.id), register: d => registerForm(d.id),
  newNews: () => newsForm(), editNews: d => newsForm(d.id),
  newPartner: () => partnerForm(), editPartner: d => partnerForm(d.id),
  newBooking: d => bookingForm(d.id),
  bookDone: d => { const b = get('bookings', d.id), e = get('equip', b.equipId) || {}; b.status = 'Hoàn tất'; if (b.fee) S.fin.push({ id: uid(), date: today(), type: 'in', cat: 'Cho thuê máy móc', amount: b.fee, batchId: '', note: `${e.name} · ${b.who}` }); save(); render(); toast('Đã hoàn tất và ghi doanh thu'); },
  bookCancel: d => { get('bookings', d.id).status = 'Hủy'; save(); render(); },
  newPool: () => poolForm(), contrib: d => contribForm(d.id),
  settlePool: d => {
    const p = get('pools', d.id), s = batchStats(get('batches', p.batchId)), raised = sum(p.contributions, x => x.amount), payout = Math.max(s.profit, 0) * p.sharePct / 100;
    if (!confirm(`Chia ${money(payout)} lợi nhuận cho ${p.contributions.length} nhà góp vốn?`)) return;
    for (const x of p.contributions) if (payout > 0) S.fin.push({ id: uid(), date: today(), type: 'out', cat: 'Chia lợi nhuận hợp tác', amount: payout * x.amount / raised, batchId: '', note: `${p.name} · ${x.name}` });
    p.status = 'Đã chia lợi nhuận'; save(); render(); toast('Đã chia lợi nhuận');
  },
  newPost: () => postForm(), reply: d => replyForm(d.id), like: d => { get('posts', d.id).likes++; save(); render(); }
});
const _baseDel = ACT.del;
ACT.del = d => {
  if (d.coll === 'plots' && ['rented', 'reserved'].includes((get('plots', d.id) || {}).status)) return toast('Lô đang cho thuê/giữ chỗ — hãy kết thúc hoặc hủy hợp đồng trước');
  if (d.coll === 'customers' && S.contracts.some(c => c.customerId === d.id)) return toast('Khách đã có hợp đồng — không thể xóa');
  return _baseDel(d);
};
document.addEventListener('change', e => { if (e.target.dataset.chg === 'portalCust') location.hash = '#/portal/' + e.target.value; });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.inp === 'mq') { UI.mq = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('[data-inp="mq"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});

/* ======================== DỮ LIỆU MẪU & NÂNG CẤP ======================== */
const DEFAULT_INFO = () => ({
  slogan: 'Nông trại công nghệ cao – minh bạch từ luống đất đến bàn ăn',
  intro: 'Trang trại khép kín gia cầm – nấm – rau sạch – dược liệu, vận hành theo VietGAP/VietGAHP/GACP-WHO với IoT giám sát môi trường, truy xuất nguồn gốc từng lô. Chúng tôi mở cửa cho gia đình, doanh nghiệp và nhà đầu tư cùng thuê vườn, nuôi gà, trồng nấm, hợp tác sản xuất.',
  hours: '7:00 – 17:30, Thứ 2 – Chủ nhật', area: '5 ha · 6 khu sản xuất',
  rules: 'Đi theo lối đi quy định, qua hố sát trùng trước khi vào khu chăn nuôi\nKhông tự ý sử dụng thuốc BVTV, phân bón ngoài danh mục của nông trại\nTrẻ em dưới 12 tuổi cần người lớn đi kèm\nThu hoạch theo lịch của kỹ thuật viên để bảo đảm thời gian cách ly\nGiữ vệ sinh chung, phân loại rác tại nguồn'
});
function setDemoLogin() {
  const k = get('contracts', 'k1'), c = get('customers', 'c1');
  if (!k || !c || k.accessHash) return;
  k.salt = randomCode(8); k.accessHash = hashCode(k.salt, 'DEMO-2026'); k.codeIssued = today();
  S.demoLogin = { username: c.username, code: 'DEMO-2026' };
}
function migrateExtra() {
  payCfg();
  for (const c of S.customers) if (!c.username) { let u = suggestUser(c.name, c.phone), n = 1, base = u; while (S.customers.some(x => x !== c && x.username === u)) u = base + (++n); c.username = u; }
  S.contracts.forEach((c, i) => { if (!c.identity) c.identity = { sign: custName(c.customerId), color: ID_COLORS[i % ID_COLORS.length][0], icon: planOf(c.planId).icon, style: SIGN_STYLES[0] }; if (!c.packs) c.packs = Math.max(1, Math.round(c.qty / PACK)); });
  if (get('units', 'u1') && get('contracts', 'k1') && !S.demoLogin) setDemoLogin();
  for (const k of ['plots', 'customers', 'contracts', 'invoices', 'requests', 'listings', 'orders', 'events', 'news', 'partners', 'bookings', 'pools', 'posts']) if (!Array.isArray(S[k])) S[k] = [];
  if (!S.info || !S.info.intro) S.info = Object.assign(DEFAULT_INFO(), S.info || {});
  if (!S.rentInit) {
    if (get('units', 'u1') && get('batches', 'b1') && !S.plots.length) seedExtra(n => addDays(today(), n));
    S.rentInit = true;
  }
}
function seedExtra(D) {
  S.info = DEFAULT_INFO(); S.rentInit = true; S.pay = { bin: '', account: '', holder: '', vat: 10 };
  const P = (code, unitId, size, note) => { const p = { id: 'p-' + code, code, unitId, size, status: 'free', note: note || '' }; S.plots.push(p); return p; };
  for (let i = 1; i <= 8; i++) P('R1-0' + i, 'u4', 30, i <= 4 ? 'Gần lối đi, nắng sáng' : 'Cạnh bể nước, nắng cả ngày');
  P('R1-B', 'u4', 240, 'Lô doanh nghiệp, có chòi nghỉ');
  for (let i = 1; i <= 4; i++) P('A2-G' + i, 'u2', 25, 'Ô chuồng gà đẻ có biển tên');
  for (let i = 1; i <= 4; i++) P('N1-K' + i, 'u3', i === 4 ? 1000 : 250, 'Kệ nấm 6 tầng');
  for (let i = 1; i <= 4; i++) P('D1-0' + i, 'u6', 100, 'Luống dược liệu GACP');
  get('plots', 'p-R1-08').status = 'maint';
  const C = (id, name, type, phone, address, ago, note) => S.customers.push({ id, name, type, phone, address, joined: D(-ago), note: note || '', username: phone.replace(/\D/g, '') });
  C('c1', 'Nguyễn Thị Hoa', 'Gia đình', '0901 111 222', 'Q. Cầu Giấy, Hà Nội', 85, '2 con nhỏ, thích rau cải, xà lách');
  C('c2', 'Trần Minh Quân', 'Cá nhân', '0902 333 444', 'Q. Đống Đa, Hà Nội', 15, 'Muốn tự trồng cuối tuần');
  C('c3', 'Lê Thu Trang', 'Gia đình', '0903 555 666', 'Q. Tây Hồ, Hà Nội', 65, 'Đàn gà tên "Đàn Nắng"');
  C('c4', 'Công ty CP Xanh Việt', 'Doanh nghiệp', '024 3999 8888', 'KCN Thăng Long', 105, 'Bếp ăn 200 suất, báo cáo ESG quý');
  C('c5', 'Phòng khám YHCT An Khang', 'Doanh nghiệp', '0905 777 888', 'TP. Hà Đông', 155);
  C('c6', 'HTX Nấm sạch Ba Vì', 'HTX / Nông hộ', '0906 999 000', 'Ba Vì, Hà Nội', 35);
  C('c7', 'Nhà hàng Bếp Quê', 'Nhà hàng', '0907 121 212', 'Q. Hoàn Kiếm, Hà Nội', 20);
  const K = (id, cust, plan, plotCode, qty, startAgo, months, deposit, cycles) => {
    const pl = planOf(plan), plot = get('plots', 'p-' + plotCode), start = D(-startAgo);
    const c = { id, code: `HD${start.slice(2).replace(/-/g, '')}-${id.toUpperCase()}`, customerId: cust, planId: plan, plotId: plot.id, sopId: pl.sop || cycles[0][0], qty, service: pl.service, billing: pl.billing, price: pl.price, months, start, end: addMonths(start, months), deposit, sharePct: pl.sharePct || 0, status: 'active', batchIds: [], note: '' };
    c.packs = Math.max(1, Math.round(qty / PACK)); c.verifiedAt = start;
    c.identity = { sign: SIGNS[id] || custName(cust), color: ID_COLORS[S.contracts.length % ID_COLORS.length][0], icon: pl.icon, style: SIGN_STYLES[S.contracts.length % SIGN_STYLES.length] };
    S.contracts.push(c); plot.status = 'rented';
    cycles.forEach(([sopId, ago, done]) => { const b = startCycle(c, sopId, D(-ago)); if (done) { b.status = 'done'; b.end = D(-ago + SOPS.find(s => s.id === sopId).duration); } });
    for (const t of S.tasks) if (c.batchIds.includes(t.batchId) && t.date < D(-1)) t.done = true;
    genInvoices(c);
    for (const i of S.invoices) if (i.contractId === c.id && i.date < D(-3)) payInvoice(i, i.date);
    return c;
  };
  const SIGNS = { k1: 'Vườn nhà Hoa', k2: 'Góc vườn anh Quân', k3: 'Đàn Nắng', k4: 'Xanh Việt Green Farm', k5: 'Dược viên An Khang', k6: 'HTX Nấm sạch Ba Vì' };
  K('k1', 'c1', 'family', 'R1-01', 30, 80, 12, 1000000, [['leafy', 80, true], ['leafy', 20]]);
  K('k2', 'c2', 'diy', 'R1-02', 20, 12, 6, 0, [['leafy', 12]]);
  K('k3', 'c3', 'flock', 'A2-G1', 20, 60, 12, 500000, [['layer', 60]]);
  K('k4', 'c4', 'biz', 'R1-B', 240, 100, 12, 5000000, [['leafy', 100, true], ['leafy', 50, true], ['leafy', 15]]);
  K('k5', 'c5', 'herb', 'D1-01', 100, 150, 7, 0, [['cagaileo', 150]]);
  K('k6', 'c6', 'share', 'N1-K4', 1000, 30, 3, 0, [['oyster', 30]]);
  setDemoLogin();
  const k2i = S.invoices.find(i => i.contractId === 'k2'); if (k2i) { k2i.paid = false; delete k2i.paidDate; S.fin = S.fin.filter(f => !f.note.startsWith(k2i.code + ' ')); }
  const bOf = cid => curBatch(get('contracts', cid)), firstB = cid => get('batches', get('contracts', cid).batchIds[0]);
  const L = (b, ago, product, unit, qty, delivered, storage, grade) => {
    const date = D(-ago), prof = STORAGE_PROFILES[get('storages', storage).profile];
    const l = { id: uid(), code: `DHT-${TYPE_CODE[sopOf(b).type]}${date.slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, batchId: b.id, unitId: b.unitId, product, unit, qty, remain: +(qty - delivered).toFixed(2), grade: grade || 'Loại 1', date, storageId: storage, expiry: addDays(date, prof.life), note: '', moves: [] };
    if (delivered) l.moves.push({ date, type: 'deliver', qty: delivered, buyer: custName(get('contracts', b.contractId).customerId), note: 'Giao tận nhà' });
    S.lots.push(l); return l;
  };
  L(firstB('k1'), 48, 'Rau cải ngọt', 'kg', 42, 42, 'k1'); L(firstB('k1'), 46, 'Rau cải ngọt', 'kg', 20, 20, 'k1');
  L(bOf('k3'), 7, 'Trứng gà', 'quả', 96, 96, 'k4'); L(bOf('k3'), 1, 'Trứng gà', 'quả', 98, 0, 'k4');
  L(bOf('k6'), 3, 'Nấm sò tươi', 'kg', 180, 72, 'k2');
  L(get('batches', get('contracts', 'k4').batchIds[1]), 18, 'Rau cải ngọt', 'kg', 380, 380, 'k1');
  S.logs.push({ id: uid(), batchId: bOf('k1').id, date: D(-8), type: 'fert', itemId: '', qty: 0, value: 0, phi: 0, note: 'Bón thúc phân hữu cơ vi sinh' });
  S.logs.push({ id: uid(), batchId: bOf('k2').id, date: D(-5), type: 'note', itemId: '', qty: 0, value: 0, phi: 0, note: 'Anh Quân tự gieo thêm 1 luống xà lách' });
  const Rq = (cust, contract, type, dAgo, note, status, fee) => { const c = get('contracts', contract), plot = get('plots', c.plotId), b = curBatch(c); const t = { id: uid(), title: `🙋 ${type} – ${custName(cust)} (lô ${plot.code}): ${note}`, date: D(dAgo), cat: /thu hoạch/i.test(type) ? 'th' : 'kt', batchId: b ? b.id : '', unitId: plot.unitId, done: status === 'Hoàn tất', auto: false, assignee: 's3' }; S.tasks.push(t); S.requests.push({ id: uid(), customerId: cust, contractId: contract, type, date: D(dAgo), created: D(Math.min(dAgo, 0) - 1), note, fee: fee || 0, status, taskId: t.id }); };
  Rq('c1', 'k1', 'Thu hoạch & giao hàng', 1, 'Giao rau sáng thứ Bảy, 3 kg cải + 1 kg xà lách', 'Mới');
  Rq('c3', 'k3', 'Đặt lịch tham quan vườn', 3, 'Cả nhà 4 người muốn cho gà ăn', 'Đang xử lý');
  Rq('c4', 'k4', 'Chăm sóc thêm (tưới, bón, tỉa…)', -6, 'Làm biển tên mới cho vườn', 'Hoàn tất', 800000);
  const lotBy = (prod, rem) => S.lots.find(l => l.product === prod && l.remain > 0 && (!rem || l.remain >= rem) && !get('batches', l.batchId).contractId);
  const Ls = (kind, icon, title, price, unit, desc, extra) => S.listings.push({ id: uid(), kind, icon, title, price, unit, desc, active: true, sellerType: 'farm', lotId: '', stock: 0, created: D(-5), ...extra });
  const mush = lotBy('Nấm sò tươi', 100), egg = lotBy('Trứng gà', 1000);
  if (mush) Ls('product', '🍄', 'Nấm sò tươi loại 2', 35000, 'kg', 'Thu hái trong ngày, kho lạnh 2–4°C, hợp nấu lẩu, xào.', { lotId: mush.id });
  if (egg) Ls('product', '🥚', 'Trứng gà sạch (vỉ 10)', 32000, 'vỉ', 'Gà nuôi theo VietGAHP, không kháng sinh tăng trọng.', { stock: 300 });
  Ls('box', '📦', 'Hộp rau sạch tuần (5 kg)', 180000, 'hộp', '5–6 loại rau theo mùa + 10 trứng, giao thứ 3 & thứ 7.', { stock: 40 });
  Ls('product', '🐔', 'Gà lông màu thả vườn (đặt trước)', 140000, 'kg', 'Xuất chuồng cuối tháng, làm sẵn, đóng túi hút chân không.', { stock: 300 });
  Ls('product', '🌿', 'Trà cà gai leo túi lọc', 85000, 'hộp', 'Nguyên liệu GACP-WHO, 20 túi/hộp.', { stock: 60 });
  Ls('exp', '🎟️', 'Vé tham quan & thu hoạch', 120000, 'vé', 'Tham quan 4 khu, tự tay hái rau mang về 1 kg.', { stock: 50 });
  Ls('exp', '🍄', 'Workshop trồng nấm tại nhà', 250000, 'vé', 'Nhận 5 bịch phôi nấm sò mang về.', { stock: 20 });
  Ls('community', '🥬', 'Rau muống vườn nhà Hoa', 25000, 'kg', 'Dư từ vườn thuê R1-01, hái theo đơn.', { sellerType: 'customer', sellerId: 'c1', stock: 6 });
  Ls('community', '🍳', 'Trứng "Đàn Nắng" (vỉ 10)', 38000, 'vỉ', 'Trứng từ đàn gà nhận nuôi của gia đình Trang.', { sellerType: 'customer', sellerId: 'c3', stock: 4 });
  const O = (cust, ago, status, paid, items, delivery) => {
    const c = get('customers', cust), member = isMember(cust), lines = items.map(([title, qty]) => ({ qty, l: S.listings.find(l => l.title === title) })).filter(x => x.l);
    const q = quote(lines, { customerId: cust, delivery }), o = { id: uid(), code: `DH${D(-ago).slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, date: D(-ago), customerId: cust, name: c.name, phone: c.phone, delivery, address: delivery === 'ship' ? c.address : '', pay: 'Chuyển khoản', note: '', status, paid: false, member,
      items: lines.map(x => { const lot = get('lots', x.l.lotId); return { lid: x.l.id, title: x.l.title, qty: x.qty, price: x.l.price, unit: x.l.unit, lotId: lot ? lot.id : '', lotCode: lot ? lot.code : '', sellerType: x.l.sellerType, sellerId: x.l.sellerId || '' }; }), sub: q.sub, disc: q.disc, ship: q.ship, total: q.total };
    for (const x of lines) { const lot = get('lots', x.l.lotId); if (lot) { lot.remain -= x.qty; lot.moves.push({ date: o.date, type: 'sale', qty: x.qty, price: x.l.price, buyer: c.name, orderId: o.id }); } else x.l.stock -= x.qty; }
    S.orders.push(o); if (paid) { payOrder(o); S.fin.slice(-o.items.length - (o.ship ? 1 : 0)).forEach(f => { f.date = o.date; }); o.paidDate = o.date; }
  };
  O('c7', 4, 'Hoàn tất', true, [['Nấm sò tươi loại 2', 15], ['Trứng gà sạch (vỉ 10)', 10]], 'ship');
  O('c1', 1, 'Đang giao', false, [['Hộp rau sạch tuần (5 kg)', 1], ['Trà cà gai leo túi lọc', 1]], 'ship');
  O('c2', 0, 'Mới', false, [['Trứng "Đàn Nắng" (vỉ 10)', 1], ['Workshop trồng nấm tại nhà', 2]], 'pickup');
  const E = (title, kind, ago, time, cap, price, desc, regs) => S.events.push({ id: uid(), title, kind, date: D(ago), time, capacity: cap, price, desc, regs: regs || [] });
  E('Ngày hội thu hoạch rau cuối tuần', 'Ngày hội', 2, '07:30', 60, 50000, 'Thu hoạch, nấu ăn ngoài trời, trò chơi dân gian cho trẻ em.', [{ customerId: 'c1', name: 'Nguyễn Thị Hoa', phone: '0901 111 222', qty: 4, paid: true, date: D(-3) }, { customerId: 'c3', name: 'Lê Thu Trang', phone: '0903 555 666', qty: 3, paid: true, date: D(-2) }]);
  E('Workshop: trồng nấm sò tại ban công', 'Workshop', 9, '09:00', 20, 250000, 'Kỹ sư hướng dẫn cấy phôi, chăm sóc; mang về 5 bịch phôi.', [{ customerId: 'c2', name: 'Trần Minh Quân', phone: '0902 333 444', qty: 2, paid: false, date: D(0) }]);
  E('Học kỳ nông trại – THCS Nghĩa Tân', 'Học đường', 16, '08:00', 80, 150000, 'Chương trình STEM nông nghiệp: IoT, thủy canh, vòng đời cây trồng.', [{ customerId: '', name: 'THCS Nghĩa Tân', phone: '024 3756 1234', qty: 45, paid: false, date: D(-1) }]);
  E('Tập huấn VietGAP cho nông hộ vệ tinh', 'Tập huấn kỹ thuật', 23, '14:00', 40, 0, 'Quy trình VietGAP, ghi chép nhật ký, sử dụng thuốc BVTV an toàn.');
  S.news.push({ id: uid(), date: D(-1), title: 'Mở thêm 4 lô vườn gia đình khu R1', body: 'Lô R1-03 đến R1-07 (30 m²) đã sẵn sàng. Ưu đãi miễn phí tháng đầu cho khách ký hợp đồng 12 tháng trong tháng này.', pinned: true });
  S.news.push({ id: uid(), date: D(-6), title: 'Lịch giao rau thay đổi dịp lễ', body: 'Tuần tới giao rau vào thứ Hai và thứ Năm. Khách có nhu cầu khác vui lòng gửi yêu cầu qua Cổng khách thuê.' });
  S.news.push({ id: uid(), date: D(-15), title: 'Nhà nấm N1 đạt hiệu suất 72%', body: 'Lứa nấm sò S09 đạt hiệu suất sinh học 72%, tỷ lệ bịch nhiễm 3,6% nhờ hệ thống phun sương và thông gió tự động.' });
  const Pt = (name, kind, model, contact, phone, ago, status, value, terms) => S.partners.push({ id: uid(), name, kind, model, contact, phone, since: D(-ago), status, value, terms });
  Pt('HTX Nấm sạch Ba Vì', 'HTX', 'Liên kết sản xuất', 'Ông Đinh Văn Hùng', '0906 999 000', 35, 'Đang hợp tác', 180000000, 'Thuê kệ N1-K4, chia 40% sản lượng nấm; farm cung cấp phôi, kỹ thuật, kho lạnh.');
  Pt('Chuỗi siêu thị Xanh Mart', 'Siêu thị / cửa hàng', 'Bao tiêu sản phẩm', 'Bà Phạm Lan', '0908 222 111', 200, 'Đang hợp tác', 960000000, 'Bao tiêu 300 kg rau + 100 kg nấm/tuần, giá sàn theo quý, yêu cầu tem truy xuất.');
  Pt('Nhà hàng Bếp Quê', 'Nhà hàng / bếp ăn', 'Bao tiêu sản phẩm', 'Anh Tuấn (bếp trưởng)', '0907 121 212', 20, 'Đang hợp tác', 240000000, 'Gà thả vườn 50 kg/tuần, trứng 300 quả/tuần.');
  Pt('20 nông hộ vệ tinh xã Tản Lĩnh', 'Nông hộ vệ tinh', 'Chuyển giao kỹ thuật', 'Trưởng thôn Lê Văn Bình', '0909 010 203', 120, 'Đang hợp tác', 350000000, 'Farm chuyển giao quy trình VietGAP, cung ứng giống; thu mua lại sản phẩm đạt chuẩn.');
  Pt('Quỹ Nông nghiệp Xanh GreenSeed', 'Nhà đầu tư', 'Góp vốn theo lứa', 'Ms. Hà', '0911 234 567', 10, 'Đang đàm phán', 0, 'Đề xuất đồng đầu tư mở rộng 2 nhà màng thủy canh.');
  const drone = S.equip.find(e => e.kind === 'Drone phun thuốc'), dryer = S.equip.find(e => e.kind === 'Máy sấy');
  if (drone) { S.bookings.push({ id: uid(), equipId: drone.id, who: 'HTX Nấm sạch Ba Vì', whoType: 'Đối tác', from: D(-9), to: D(-8), days: 2, rate: 1200000, fee: 2400000, status: 'Hoàn tất', note: 'Phun chế phẩm sinh học 5 ha' }); S.fin.push({ id: uid(), date: D(-8), type: 'in', cat: 'Cho thuê máy móc', amount: 2400000, batchId: '', note: `${drone.name} · HTX Nấm sạch Ba Vì` }); S.bookings.push({ id: uid(), equipId: drone.id, who: '20 nông hộ vệ tinh xã Tản Lĩnh', whoType: 'Nông hộ lân cận', from: D(3), to: D(5), days: 3, rate: 1200000, fee: 3600000, status: 'Đã đặt', note: 'Phun Bt trừ sâu tơ 8 ha rau' }); }
  if (dryer) S.bookings.push({ id: uid(), equipId: dryer.id, who: 'Phòng khám YHCT An Khang', whoType: 'Khách thuê', from: D(6), to: D(7), days: 2, rate: 800000, fee: 1600000, status: 'Đã đặt', note: 'Sấy 300 kg dược liệu' });
  S.pools.push({ id: uid(), name: 'Đồng đầu tư lứa gà lông màu L05', batchId: 'b1', target: 90000000, sharePct: 30, desc: 'Vốn dùng mua con giống, thức ăn. Chia 30% lợi nhuận lứa theo tỷ lệ góp khi xuất bán.', status: 'Đang huy động', created: D(-40), contributions: [{ customerId: 'c4', name: 'Công ty CP Xanh Việt', amount: 30000000, date: D(-38) }, { customerId: 'c1', name: 'Nguyễn Thị Hoa', amount: 10000000, date: D(-36) }, { customerId: '', name: 'Anh Vũ Đức Minh', amount: 20000000, date: D(-35) }] });
  S.pools.push({ id: uid(), name: 'Góp vốn vụ cà gai leo CGL01', batchId: 'b6', target: 40000000, sharePct: 35, desc: 'Mở rộng sấy và đóng gói trà túi lọc.', status: 'Đang huy động', created: D(-170), contributions: [{ customerId: 'c5', name: 'Phòng khám YHCT An Khang', amount: 25000000, date: D(-165) }] });
  S.posts.push({ id: uid(), author: 'Trần Minh Quân', tag: 'Hỏi đáp', title: 'Cải ngọt bị lỗ chi chít trên lá là sao ạ?', body: 'Vườn R1-02 mới gieo 12 ngày, lá có nhiều lỗ nhỏ li ti. Có cần phun thuốc không?', date: D(-2), likes: 3, replies: [{ author: 'Kỹ sư Lê Văn Cường', body: 'Do bọ nhảy. Anh đặt thêm bẫy dính vàng, tưới ẩm đều; nếu nặng farm sẽ phun chế phẩm sinh học (cách ly 3 ngày). Không dùng thuốc hóa học.', date: D(-2) }] });
  S.posts.push({ id: uid(), author: 'Nguyễn Thị Hoa', tag: 'Công thức nấu', title: 'Canh nấm sò nấu trứng cho bé', body: 'Nấm sò xé nhỏ, trứng đánh tan, nêm nhạt. Bé nhà mình ăn 2 bát liền! Nấm lấy ở kệ N1 rất tươi.', date: D(-5), likes: 12, replies: [] });
  S.posts.push({ id: uid(), author: 'HTX Nấm sạch Ba Vì', tag: 'Trao đổi giống', title: 'Có dư 50 kg giống nấm sò cấp 2', body: 'HTX có dư giống mới cấy, ai cần trao đổi lấy phân hữu cơ vi sinh liên hệ nhé.', date: D(-9), likes: 5, replies: [{ author: 'Kho DHT Farm', body: 'Farm đổi 200 kg phân hữu cơ lấy 30 kg giống, mình gọi HTX chiều nay.', date: D(-8) }] });
}
