/* =====================================================================
   DHT Smart Farm — THƯ VIỆN QUY TRÌNH CHUẨN (SOP)
   Kiến thức kỹ thuật tổng hợp theo VietGAP / VietGAHP / GACP-WHO.
   Mỗi quy trình gồm:
     stages : giai đoạn [từ ngày f đến ngày t] + ngưỡng môi trường
     tasks  : [ngày, việc, nhóm, lặp mỗi N ngày?, đến ngày?]
              (ngày 0 = ngày nhập con giống / cấy giống / gieo trồng,
               ngày âm = công việc chuẩn bị trước)
     daily  : việc thường nhật (checklist mỗi ngày)
   Số liệu mang tính tham khảo kỹ thuật — luôn tuân thủ hướng dẫn của
   cơ quan thú y / BVTV địa phương và nhà cung cấp giống.
   ===================================================================== */

const FARM_TYPES = {
  poultry:  { n: 'Gia cầm',   icon: '🐔', color: 'var(--c-poultry)' },
  mushroom: { n: 'Nấm',       icon: '🍄', color: 'var(--c-mushroom)' },
  veg:      { n: 'Rau sạch',  icon: '🥬', color: 'var(--c-veg)' },
  herb:     { n: 'Dược liệu', icon: '🌿', color: 'var(--c-herb)' }
};

const PARAMS = {
  temp: { n: 'Nhiệt độ',       u: '°C',    d: 1 },
  rh:   { n: 'Độ ẩm KK',       u: '%',     d: 0 },
  co2:  { n: 'CO₂',            u: 'ppm',   d: 0 },
  nh3:  { n: 'NH₃',            u: 'ppm',   d: 1 },
  lux:  { n: 'Ánh sáng',       u: 'lux',   d: 0 },
  ph:   { n: 'pH',             u: '',      d: 2 },
  ec:   { n: 'EC',             u: 'mS/cm', d: 2 },
  soil: { n: 'Ẩm độ đất/giá thể', u: '%', d: 0 }
};

const TASK_CATS = {
  vs: { n: 'Vệ sinh – sát trùng', c: 'var(--c-vs)' },
  tv: { n: 'Thú y – vaccine',     c: 'var(--c-tv)' },
  dd: { n: 'Dinh dưỡng – phân bón', c: 'var(--c-dd)' },
  bv: { n: 'Bảo vệ thực vật',     c: 'var(--c-bv)' },
  kt: { n: 'Kỹ thuật – chăm sóc', c: 'var(--c-kt)' },
  mt: { n: 'Môi trường',          c: 'var(--c-mt)' },
  th: { n: 'Thu hoạch – sơ chế',  c: 'var(--c-th)' }
};

/* Hồ sơ kho bảo quản sau thu hoạch */
const STORAGE_PROFILES = {
  cold_veg:    { n: 'Kho lạnh rau ăn lá',     env: { temp: [1, 4],   rh: [90, 95] }, life: 10,  note: 'Làm lạnh sơ bộ trong 1–2h sau thu; túi PE đục lỗ; tránh để chung quả sinh ethylene.' },
  cold_mush:   { n: 'Kho lạnh nấm tươi',      env: { temp: [2, 4],   rh: [85, 90] }, life: 6,   note: 'Không rửa nấm trước khi bảo quản; khay thoáng, màng bọc đục lỗ.' },
  cool_fruit:  { n: 'Kho mát quả (cà chua…)', env: { temp: [10, 13], rh: [85, 90] }, life: 14,  note: 'Quả xanh chín ở 18–21°C; không để dưới 10°C (tổn thương lạnh).' },
  egg:         { n: 'Kho trứng',              env: { temp: [12, 16], rh: [70, 80] }, life: 28,  note: 'Đầu to hướng lên; không rửa trứng; loại trứng dập, bẩn trước khi nhập kho.' },
  chill_meat:  { n: 'Kho mát thịt',           env: { temp: [0, 4],   rh: [85, 90] }, life: 5,   note: 'Chuỗi lạnh liên tục; tách riêng sản phẩm sống – chín.' },
  dry_herb:    { n: 'Kho dược liệu / nông sản khô', env: { temp: [15, 28], rh: [45, 60] }, life: 540, note: 'Độ ẩm sản phẩm ≤ 12%; kê pallet cách tường 30 cm; kiểm tra mốc, mọt định kỳ.' }
};

const SOPS = [
  /* ------------------------------ GIA CẦM ------------------------------ */
  {
    id: 'broiler', type: 'poultry', name: 'Gà thịt lông màu (gà ta lai)', std: 'VietGAHP chăn nuôi gà',
    qtyUnit: 'con', duration: 90,
    desc: 'Nuôi nền đệm lót, chuồng thông thoáng tự nhiên hoặc chuồng kín làm mát. Xuất bán 85–95 ngày, khối lượng 1,8–2,2 kg/con.',
    stages: [
      { f: -14, t: -1, n: 'Chuẩn bị chuồng trại', env: {}, tip: 'Để trống chuồng tối thiểu 7 ngày sau sát trùng. Hố sát trùng ở cổng và mỗi cửa chuồng.' },
      { f: 0,  t: 7,  n: 'Úm giai đoạn 1', env: { temp: [31, 33], rh: [60, 70], nh3: [0, 10], co2: [0, 3000], lux: [20, 40] }, tip: 'Chiếu sáng 23–24h/ngày. Gà tụm dưới chụp sưởi = lạnh; tản xa, há mỏ = nóng.' },
      { f: 8,  t: 14, n: 'Úm giai đoạn 2', env: { temp: [28, 31], rh: [60, 70], nh3: [0, 10], co2: [0, 3000], lux: [15, 30] }, tip: 'Giảm nhiệt 2–3°C/tuần. Nới rộng quây úm theo tốc độ lớn.' },
      { f: 15, t: 21, n: 'Chuyển tiếp', env: { temp: [25, 28], rh: [60, 70], nh3: [0, 15], co2: [0, 3000], lux: [10, 25] }, tip: 'Tập cho gà quen máng ăn/uống gà lớn.' },
      { f: 22, t: 42, n: 'Gà choai', env: { temp: [22, 27], rh: [55, 75], nh3: [0, 15], co2: [0, 3000], lux: [5, 20] }, tip: 'Mật độ 8–10 con/m² (nuôi nền). Giảm ánh sáng để hạn chế mổ cắn.' },
      { f: 43, t: 90, n: 'Vỗ béo – xuất bán', env: { temp: [20, 28], rh: [55, 75], nh3: [0, 20], co2: [0, 3000], lux: [5, 20] }, tip: 'Ngừng thuốc kháng sinh đúng thời gian ngừng thuốc trước khi xuất bán.' }
    ],
    tasks: [
      [-14, 'Dọn đệm lót cũ; tháo rửa máng ăn, máng uống, rèm bằng nước áp lực', 'vs'],
      [-12, 'Phun thuốc sát trùng toàn chuồng và khu vực xung quanh (lần 1)', 'vs'],
      [-10, 'Quét vôi tường, rắc vôi bột nền; diệt chuột, côn trùng', 'vs'],
      [-5,  'Phun sát trùng lần 2; đóng chuồng, để trống', 'vs'],
      [-3,  'Rải đệm lót trấu dày 5–10 cm (hoặc đệm lót sinh học); lắp quây úm', 'kt'],
      [-2,  'Kiểm tra hệ thống sưởi, quạt, đèn, máy phát điện dự phòng', 'kt'],
      [-1,  'Làm ấm chuồng úm trước 12–24h đạt 32–33°C; chuẩn bị nước điện giải + đường glucose', 'mt'],
      [0,   'Nhập gà: kiểm tra chất lượng, đếm số, cân mẫu 1 ngày tuổi; cho uống điện giải 2–3h trước khi cho ăn', 'kt'],
      [1,   'Kiểm tra diều gà (≥ 95% diều đầy sau 24h)', 'kt'],
      [5,   'Vaccine Newcastle + IB lần 1 (ND-IB) – nhỏ mắt, mũi', 'tv'],
      [7,   'Vaccine Gumboro lần 1 – nhỏ miệng / pha nước uống', 'tv'],
      [7,   'Vaccine Đậu gà – chủng màng cánh', 'tv'],
      [7,   'Cân mẫu 5% đàn, đánh giá độ đồng đều; ghi khối lượng bình quân', 'kt', 7, 84],
      [10,  'Phòng cầu trùng đợt 1 (3–5 ngày) theo chỉ định thú y', 'tv'],
      [14,  'Vaccine Gumboro lần 2', 'tv'],
      [15,  'Tháo quây úm, mở rộng diện tích; điều chỉnh độ cao máng', 'kt'],
      [21,  'Vaccine Newcastle + IB lần 2 (Lasota)', 'tv'],
      [21,  'Vaccine cúm gia cầm H5 (tiêm dưới da cổ) theo hướng dẫn thú y địa phương', 'tv'],
      [25,  'Phòng cầu trùng đợt 2', 'tv'],
      [28,  'Chuyển sang thức ăn giai đoạn 2 (chuyển dần trong 3 ngày)', 'dd'],
      [30,  'Phun sát trùng có gà trong chuồng (định kỳ 7 ngày/lần)', 'vs', 7, 84],
      [42,  'Vaccine Newcastle nhũ dầu (tiêm) – miễn dịch dài', 'tv'],
      [45,  'Chuyển sang thức ăn giai đoạn 3 (vỗ béo)', 'dd'],
      [49,  'Tiêm nhắc vaccine cúm gia cầm', 'tv'],
      [78,  'NGỪNG toàn bộ kháng sinh/thuốc có thời gian ngừng thuốc trước xuất bán', 'tv'],
      [84,  'Liên hệ thương lái/cơ sở giết mổ; hoàn thiện hồ sơ lứa nuôi (nhật ký, vaccine)', 'th'],
      [89,  'Cắt thức ăn 6–8h trước khi bắt; bắt gà ban đêm/sáng sớm giảm stress', 'th'],
      [90,  'Xuất bán: cân tổng, tính FCR, tỷ lệ nuôi sống; bắt đầu vệ sinh chuồng', 'th']
    ],
    daily: [
      'Kiểm tra nhiệt độ – ẩm độ, quan sát phân bố đàn (sáng/trưa/chiều/tối)',
      'Cho ăn đúng định lượng; vệ sinh máng uống, thay nước sạch',
      'Ghi số chết/loại thải, lượng thức ăn tiêu thụ',
      'Xới đệm lót khu ẩm ướt, bổ sung trấu mới',
      'Kiểm tra quạt, rèm, sưởi; thay nước/vôi hố sát trùng'
    ],
    weights: [[0, .035], [7, .08], [14, .17], [21, .30], [28, .45], [35, .62], [42, .80], [49, .98], [56, 1.17], [63, 1.35], [70, 1.52], [77, 1.68], [84, 1.82], [90, 1.95]],
    harvest: { product: 'Gà thịt (hơi)', unit: 'kg', storage: 'chill_meat', from: 85 },
    kpi: ['Tỷ lệ nuôi sống ≥ 95%', 'FCR 2,6–3,0 kg thức ăn/kg tăng trọng', 'Độ đồng đều ≥ 80%', 'Khối lượng xuất 1,8–2,2 kg/con'],
    post: ['Vận chuyển gà sống bằng lồng thoáng, mật độ vừa phải, tránh nắng nóng', 'Giết mổ tại cơ sở được cấp phép; làm lạnh thân thịt 0–4°C trong 2h', 'Bảo quản thịt mát 0–4°C tối đa 5 ngày; đông lạnh ≤ -18°C']
  },
  {
    id: 'layer', type: 'poultry', name: 'Gà đẻ trứng thương phẩm', std: 'VietGAHP chăn nuôi gà',
    qtyUnit: 'con', duration: 360,
    desc: 'Tính từ khi gà vào đẻ (18–20 tuần tuổi). Nuôi lồng hoặc nền có ổ đẻ. Chiếu sáng 16h/ngày ổn định.',
    stages: [
      { f: 0,   t: 30,  n: 'Khởi đẻ', env: { temp: [18, 26], rh: [60, 75], nh3: [0, 15], co2: [0, 3000], lux: [15, 30] }, tip: 'Tăng thời gian chiếu sáng 30 phút/tuần đến 16h. Không giảm thời gian chiếu sáng trong kỳ đẻ.' },
      { f: 31,  t: 200, n: 'Đẻ đỉnh', env: { temp: [18, 26], rh: [60, 75], nh3: [0, 15], co2: [0, 3000], lux: [15, 30] }, tip: 'Tỷ lệ đẻ đỉnh 85–92%. Stress nhiệt > 30°C làm giảm đẻ và mỏng vỏ.' },
      { f: 201, t: 360, n: 'Cuối kỳ đẻ', env: { temp: [18, 26], rh: [60, 75], nh3: [0, 15], co2: [0, 3000], lux: [15, 30] }, tip: 'Loại thải gà đẻ kém (mào nhợt, khoảng cách xương chậu hẹp).' }
    ],
    tasks: [
      [0,  'Chuyển gà lên chuồng đẻ; chuyển thức ăn gà đẻ (Ca 3,5–4%)', 'dd'],
      [0,  'Chiếu sáng tăng dần đến 16h/ngày', 'mt'],
      [14, 'Cân mẫu, kiểm tra độ đồng đều và tỷ lệ đẻ theo chuẩn giống', 'kt', 14, 350],
      [7,  'Phun sát trùng có gà (định kỳ 7 ngày/lần)', 'vs', 7, 357],
      [30, 'Vaccine ND-IB nhắc lại (định kỳ 2–3 tháng)', 'tv', 75, 330],
      [90, 'Tiêm nhắc vaccine cúm gia cầm (6 tháng/lần)', 'tv', 180, 300],
      [60, 'Tẩy giun sán định kỳ', 'tv', 90, 330],
      [180,'Đánh giá, loại thải gà đẻ kém', 'kt', 60, 360]
    ],
    daily: [
      'Thu nhặt trứng 3–4 lần/ngày; loại trứng dập, bẩn, dị hình',
      'Ghi số trứng, tỷ lệ đẻ, trứng loại',
      'Kiểm tra đèn chiếu sáng đủ 16h/ngày',
      'Cho ăn, nước uống sạch; bổ sung vỏ sò/Ca buổi chiều',
      'Theo dõi gà ốm, gà không đẻ'
    ],
    harvest: { product: 'Trứng gà', unit: 'quả', storage: 'egg', from: 0 },
    kpi: ['Tỷ lệ đẻ đỉnh ≥ 85%', 'Tiêu tốn thức ăn ≤ 1,8–2,0 kg/10 trứng', 'Tỷ lệ trứng loại ≤ 3%', 'Hao hụt đàn ≤ 1%/tháng'],
    post: ['Làm sạch khô (không rửa) trứng bẩn nhẹ', 'Phân loại theo khối lượng, soi trứng', 'Kho trứng 12–16°C, ẩm 70–80%, đầu to hướng lên, tối đa 28 ngày']
  },

  /* ------------------------------- NẤM -------------------------------- */
  {
    id: 'oyster', type: 'mushroom', name: 'Nấm sò / bào ngư (giá thể mùn cưa)', std: 'VietGAP – quy trình sản xuất nấm ăn',
    qtyUnit: 'bịch', duration: 90,
    desc: 'Bịch phôi 1,2–1,5 kg mùn cưa cao su + 3–5% cám. 3–4 đợt thu, hiệu suất sinh học 60–80%.',
    stages: [
      { f: -7, t: -1, n: 'Xử lý giá thể & thanh trùng', env: {}, tip: 'Độ ẩm giá thể đạt khi nắm chặt có nước rịn kẽ tay nhưng không chảy thành giọt (60–65%).' },
      { f: 0,  t: 25, n: 'Ủ tơ (nuôi sợi)', env: { temp: [24, 28], rh: [65, 75], co2: [0, 5000], lux: [0, 50] }, tip: 'Phòng tối, sạch, thông thoáng nhẹ. Không tưới nước. Nhiệt > 32°C tơ yếu, dễ nhiễm.' },
      { f: 26, t: 32, n: 'Kích thích ra quả', env: { temp: [18, 26], rh: [85, 95], co2: [0, 1000], lux: [200, 500] }, tip: 'Sốc nhiệt/ẩm: hạ nhiệt độ ban đêm, tăng ẩm, bật ánh sáng tán xạ.' },
      { f: 33, t: 90, n: 'Ra quả – thu hái', env: { temp: [20, 28], rh: [85, 95], co2: [0, 1000], lux: [200, 1000] }, tip: 'CO₂ cao → chân dài, mũ nhỏ. Ẩm thấp → mũ khô, nứt. Không phun trực tiếp lên quả non.' }
    ],
    tasks: [
      [-7, 'Làm ướt mùn cưa bằng nước vôi 1% (ẩm 60–65%), ủ đống 3–5 ngày, đảo 1–2 lần', 'kt'],
      [-3, 'Trộn phụ gia (cám gạo/bột ngô 3–5%), đóng bịch 1,2–1,5 kg, nút cổ bịch', 'kt'],
      [-2, 'Hấp thanh trùng 100°C trong 10–12h (hoặc 121°C, 1,5–2h với nồi áp suất)', 'vs'],
      [-1, 'Để nguội bịch < 30°C; khử trùng phòng cấy, dụng cụ bằng cồn 70°', 'vs'],
      [0,  'Cấy giống cạnh ngọn lửa đèn cồn/tủ cấy (15–20 g giống/bịch); ghi nhãn lô', 'kt'],
      [7,  'Kiểm tra bịch nhiễm (mốc xanh, mốc đen, vàng) – loại bỏ, tiêu hủy xa khu nuôi', 'vs', 7, 21],
      [20, 'Đánh giá độ lan tơ (≥ 80% bịch); vệ sinh, phun vôi nhà ra quả', 'kt'],
      [25, 'Chuyển bịch sang nhà ra quả; rạch 4–6 vết/bịch (hoặc mở nút cổ)', 'kt'],
      [26, 'Sốc nhiệt/ẩm: phun sương nền, tăng ẩm lên 90%; bật đèn tán xạ', 'mt'],
      [33, 'Thu hái đợt 1 – khi mép mũ còn hơi cong, chưa phẳng; thu cả cụm', 'th'],
      [35, 'Nghỉ tưới 2–3 ngày; vệ sinh gốc nấm sót', 'kt'],
      [48, 'Thu hái đợt 2', 'th'],
      [63, 'Thu hái đợt 3', 'th'],
      [78, 'Thu hái đợt 4', 'th'],
      [90, 'Kết thúc lứa: thu gom phôi làm phân hữu cơ; tổng vệ sinh, sát trùng nhà nuôi', 'vs']
    ],
    daily: [
      'Đo nhiệt – ẩm – CO₂ nhà nuôi 3 lần/ngày',
      'Phun sương 3–5 lần/ngày (giai đoạn ra quả), không phun trực tiếp quả non',
      'Mở cửa/bật quạt thông gió khi CO₂ > 1000 ppm',
      'Kiểm tra ruồi nấm, côn trùng; thay bẫy dính/bẫy đèn',
      'Ghi sản lượng thu hái trong ngày'
    ],
    harvest: { product: 'Nấm sò tươi', unit: 'kg', storage: 'cold_mush', from: 33 },
    kpi: ['Hiệu suất sinh học (BE) 60–80%', 'Tỷ lệ bịch nhiễm < 5%', 'Sản lượng ≥ 0,6 kg/bịch/lứa', 'Nấm loại 1 ≥ 80%'],
    post: ['Cắt gốc, phân loại, để ráo – không rửa', 'Đóng khay xốp bọc màng đục lỗ / túi PE', 'Kho lạnh 2–4°C, ẩm 85–90%: 5–7 ngày', 'Sấy 50–60°C đến ẩm ≤ 12% để bảo quản dài']
  },
  {
    id: 'lingzhi', type: 'mushroom', name: 'Nấm linh chi (dược liệu)', std: 'GACP-WHO / VietGAP',
    qtyUnit: 'bịch', duration: 100,
    desc: 'Giá thể mùn cưa gỗ mềm. Mỗi bịch giữ 1 quả thể. Thu khi viền trắng mép tán chuyển hết sang vàng nâu.',
    stages: [
      { f: -7, t: -1, n: 'Xử lý giá thể & thanh trùng', env: {}, tip: 'Thanh trùng triệt để quyết định tỷ lệ nhiễm.' },
      { f: 0,  t: 40, n: 'Ủ tơ', env: { temp: [25, 28], rh: [60, 70], co2: [0, 5000], lux: [0, 50] }, tip: 'Tơ linh chi ăn chậm hơn nấm sò (35–45 ngày).' },
      { f: 41, t: 55, n: 'Hình thành mầm quả', env: { temp: [24, 30], rh: [85, 95], co2: [0, 800], lux: [300, 700] }, tip: 'CO₂ cao làm quả thể dạng sừng hươu (không hình thành tán).' },
      { f: 56, t: 100, n: 'Phát triển tán – thu hái', env: { temp: [24, 30], rh: [80, 90], co2: [0, 800], lux: [300, 700] }, tip: 'Ngừng tưới 5–7 ngày trước thu để tích lũy hoạt chất.' }
    ],
    tasks: [
      [-7, 'Làm ẩm mùn cưa (60–65%), ủ đống 5–7 ngày có vôi 1%', 'kt'],
      [-3, 'Phối trộn cám, đóng bịch, nút cổ', 'kt'],
      [-2, 'Hấp thanh trùng 100°C, 12h', 'vs'],
      [-1, 'Làm nguội; khử trùng phòng cấy', 'vs'],
      [0,  'Cấy giống linh chi; ghi nhãn lô', 'kt'],
      [10, 'Kiểm tra, loại bỏ bịch nhiễm', 'vs', 10, 30],
      [40, 'Tơ kín bịch: chuyển nhà nuôi quả, mở nút cổ bịch', 'kt'],
      [45, 'Kiểm tra mầm quả; tỉa giữ 1 mầm/bịch', 'kt'],
      [60, 'Điều chỉnh thông gió để tán nở đều', 'mt'],
      [88, 'Ngừng tưới 5–7 ngày trước thu hái', 'kt'],
      [95, 'Thu hái khi viền trắng mép tán hết; cắt sát gốc', 'th'],
      [96, 'Sấy 40–50°C đến ẩm ≤ 12–13%; đóng túi PE kín + gói hút ẩm', 'th']
    ],
    daily: [
      'Đo nhiệt – ẩm – CO₂ 3 lần/ngày',
      'Phun sương nền, vách giữ ẩm (giai đoạn quả thể)',
      'Thông gió giữ CO₂ < 800 ppm',
      'Kiểm tra côn trùng, bịch nhiễm'
    ],
    harvest: { product: 'Linh chi khô', unit: 'kg', storage: 'dry_herb', from: 95 },
    kpi: ['Tỷ lệ bịch nhiễm < 5%', 'Quả thể đạt chuẩn (tán tròn, dày) ≥ 85%', 'Năng suất khô 40–60 g/bịch'],
    post: ['Sấy 40–50°C (không quá 60°C làm giảm hoạt chất)', 'Độ ẩm thành phẩm ≤ 12–13%', 'Túi PE kín + gói hút ẩm; kho khô mát, tránh ánh sáng']
  },

  /* ------------------------------ RAU SẠCH ---------------------------- */
  {
    id: 'leafy', type: 'veg', name: 'Rau ăn lá ngắn ngày (cải, rau muống…)', std: 'VietGAP trồng trọt (TCVN 11892-1:2017)',
    qtyUnit: 'm²', duration: 35,
    desc: 'Trồng đất trong nhà lưới, tưới phun mưa/nhỏ giọt. Quản lý dịch hại tổng hợp IPM, tuân thủ thời gian cách ly thuốc.',
    stages: [
      { f: -10, t: -1, n: 'Chuẩn bị đất', env: {}, tip: 'Phân chuồng phải ủ hoai mục; nước tưới đạt QCVN 39:2011/BTNMT.' },
      { f: 0,  t: 10, n: 'Nảy mầm – cây con', env: { temp: [18, 30], soil: [70, 85] }, tip: 'Giữ ẩm đều, che lưới khi nắng gắt/mưa to.' },
      { f: 11, t: 25, n: 'Sinh trưởng thân lá', env: { temp: [18, 32], soil: [65, 80] }, tip: 'Bón thúc hòa loãng, tưới sau bón.' },
      { f: 26, t: 35, n: 'Thu hoạch', env: { temp: [18, 32], soil: [60, 75] }, tip: 'Ngừng bón đạm ≥ 10 ngày trước thu để giảm nitrat.' }
    ],
    tasks: [
      [-10, 'Lấy mẫu đất, nước tưới phân tích kim loại nặng, vi sinh (yêu cầu VietGAP)', 'kt'],
      [-7,  'Cày bừa, phơi ải 5–7 ngày; bón vôi 30–50 kg/sào nếu pH < 5,5', 'kt'],
      [-3,  'Lên luống cao 20–25 cm; bón lót phân hữu cơ hoai mục + lân', 'dd'],
      [-1,  'Lắp/kiểm tra hệ thống tưới; kiểm tra lưới chắn côn trùng', 'kt'],
      [0,   'Gieo hạt/trồng cây con; ghi nhật ký giống (nguồn gốc, lô hạt)', 'kt'],
      [7,   'Tỉa dặm, định mật độ; bón thúc lần 1 (hữu cơ vi sinh hoặc đạm hòa loãng)', 'dd'],
      [7,   'Thăm đồng IPM: bọ nhảy, sâu tơ, rệp – đặt bẫy dính vàng', 'bv', 7, 28],
      [15,  'Bón thúc lần 2; xới xáo, làm cỏ', 'dd'],
      [22,  'Ngừng bón phân đạm (≥ 10 ngày trước thu)', 'dd'],
      [26,  'Kiểm tra thời gian cách ly thuốc BVTV (PHI) trước khi thu', 'bv'],
      [30,  'Thu hoạch sáng sớm/chiều mát; loại lá già, sâu', 'th'],
      [33,  'Vệ sinh ruộng, thu gom tàn dư; tổng kết chi phí – sản lượng', 'vs']
    ],
    daily: [
      'Tưới sáng sớm và chiều mát (ẩm đất 70–80%)',
      'Thăm đồng, phát hiện sớm sâu bệnh',
      'Ghi nhật ký canh tác (phân bón, thuốc BVTV, tưới)',
      'Kiểm tra lưới, nhà lưới sau mưa gió'
    ],
    harvest: { product: 'Rau cải', unit: 'kg', storage: 'cold_veg', from: 28 },
    kpi: ['Năng suất 1,5–2,5 kg/m²/vụ', 'Dư lượng thuốc BVTV, nitrat < MRL', 'Tỷ lệ rau loại 1 ≥ 85%'],
    post: ['Loại lá úa, rửa nước sạch, để ráo', 'Làm lạnh sơ bộ 1–2h sau thu hoạch', 'Đóng túi PE đục lỗ/khay, dán tem truy xuất', 'Kho lạnh 1–4°C, ẩm 90–95%: 7–10 ngày']
  },
  {
    id: 'hydro', type: 'veg', name: 'Xà lách thủy canh hồi lưu (NFT)', std: 'VietGAP – thủy canh nhà màng',
    qtyUnit: 'hốc', duration: 45,
    desc: 'Máng NFT, dung dịch tuần hoàn. Kiểm soát EC/pH hằng ngày, nhiệt độ dung dịch < 28°C.',
    stages: [
      { f: -2, t: -1, n: 'Vệ sinh hệ thống', env: {}, tip: 'Rửa máng, bồn bằng H₂O₂ 3% hoặc Chlorine 50 ppm, xả sạch.' },
      { f: 0,  t: 12, n: 'Ươm cây con', env: { temp: [18, 28], rh: [60, 80], ec: [0.6, 1.2], ph: [5.5, 6.5] }, tip: 'Che tối 2 ngày đầu, sau đó đưa ra sáng để tránh vống.' },
      { f: 13, t: 32, n: 'Sinh trưởng', env: { temp: [18, 30], rh: [55, 80], ec: [1.2, 1.8], ph: [5.5, 6.5] }, tip: 'Nhiệt dung dịch > 28°C → thiếu oxy, thối rễ Pythium.' },
      { f: 33, t: 45, n: 'Hoàn thiện – thu hoạch', env: { temp: [18, 30], rh: [55, 80], ec: [1.0, 1.6], ph: [5.5, 6.5] }, tip: 'Giảm EC 10–20% trước thu 5–7 ngày để giảm nitrat.' }
    ],
    tasks: [
      [-2, 'Vệ sinh máng NFT, bồn chứa bằng H₂O₂/Chlorine, xả sạch', 'vs'],
      [0,  'Gieo hạt vào giá thể (mút xốp/xơ dừa/rockwool), giữ ẩm, che tối 2 ngày', 'kt'],
      [3,  'Đưa khay ươm ra sáng; tưới dung dịch EC 0,6–0,8', 'dd'],
      [12, 'Chuyển cây con (3–4 lá thật) lên hệ thống NFT', 'kt'],
      [19, 'Bổ sung nước + dinh dưỡng A/B, hiệu chỉnh EC/pH', 'dd', 7, 40],
      [26, 'Thay toàn bộ dung dịch dinh dưỡng', 'dd'],
      [35, 'Giảm EC 10–20% trước thu hoạch', 'dd'],
      [40, 'Thu hoạch (nhổ cả rễ hoặc cắt gốc); đóng gói ngay', 'th'],
      [42, 'Vệ sinh hệ thống, chuẩn bị vụ mới', 'vs']
    ],
    daily: [
      'Đo EC, pH, nhiệt độ dung dịch (sáng – chiều)',
      'Kiểm tra bơm tuần hoàn, lưu lượng máng, rò rỉ',
      'Quan sát rễ (trắng = khỏe; nâu nhớt = thối rễ)',
      'Kiểm tra lưới chắn côn trùng, nhà màng'
    ],
    harvest: { product: 'Xà lách thủy canh', unit: 'kg', storage: 'cold_veg', from: 38 },
    kpi: ['Khối lượng 120–180 g/cây', 'Tỷ lệ cây đạt ≥ 95%', 'Nitrat < 1.500 mg/kg (xà lách)'],
    post: ['Thu buổi sáng, giữ bầu rễ để tươi lâu', 'Đóng túi/hộp có lỗ thoáng', 'Kho lạnh 1–4°C, ẩm 90–95%']
  },
  {
    id: 'tomato', type: 'veg', name: 'Cà chua nhà màng (tưới nhỏ giọt)', std: 'VietGAP – nhà màng công nghệ cao',
    qtyUnit: 'cây', duration: 150,
    desc: 'Giá thể xơ dừa, tưới nhỏ giọt fertigation. Mật độ 2,5–3 cây/m². Thu kéo dài 2–3 tháng.',
    stages: [
      { f: -7, t: -1, n: 'Chuẩn bị nhà màng', env: {}, tip: 'Xả giá thể xơ dừa đến EC < 0,5 mS/cm trước khi trồng.' },
      { f: 0,  t: 20, n: 'Hồi xanh – sinh trưởng', env: { temp: [20, 28], rh: [60, 80], ec: [1.5, 2.2], ph: [5.8, 6.5] }, tip: 'Tưới ít lần, lượng vừa, kích thích ra rễ.' },
      { f: 21, t: 60, n: 'Ra hoa – đậu quả', env: { temp: [18, 28], rh: [60, 80], ec: [2.2, 3.0], ph: [5.8, 6.5] }, tip: 'Nhiệt > 32°C hoặc < 13°C hạt phấn bất dục, rụng hoa.' },
      { f: 61, t: 150, n: 'Thu hoạch', env: { temp: [18, 28], rh: [60, 80], ec: [2.5, 3.5], ph: [5.8, 6.5] }, tip: 'Tỷ lệ nước thoát (drain) 20–30% mỗi ngày.' }
    ],
    tasks: [
      [-7,  'Khử trùng nhà màng, giá thể, túi/bầu trồng', 'vs'],
      [-2,  'Xả giá thể; lắp và kiểm tra béc nhỏ giọt', 'kt'],
      [0,   'Trồng cây con 25–30 ngày tuổi (4–5 lá thật); tưới EC 1,5', 'kt'],
      [10,  'Căng dây, cuốn ngọn cây theo dây treo', 'kt'],
      [14,  'Tỉa chồi nách, giữ 1 thân chính (hàng tuần)', 'kt', 7, 140],
      [25,  'Rung/thụ phấn hoa (9–11h sáng), 2–3 lần/tuần', 'kt'],
      [30,  'Thăm IPM: bọ phấn, nhện, sương mai, xoăn lá', 'bv', 10, 140],
      [40,  'Tỉa quả giữ 4–5 quả/chùm; tỉa lá già phía dưới', 'kt'],
      [65,  'Bắt đầu thu hoạch (quả chuyển màu 30–50%)', 'th'],
      [120, 'Bấm ngọn khi đủ số chùm dự kiến', 'kt'],
      [150, 'Kết thúc vụ; thu dọn cây, khử trùng nhà màng', 'vs']
    ],
    daily: [
      'Đo EC, pH dịch tưới vào & dịch thoát (drain 20–30%)',
      'Điều chỉnh lịch tưới theo bức xạ/nhiệt độ',
      'Theo dõi nhiệt – ẩm nhà màng, mở rèm/quạt khi > 30°C',
      'Thu quả chín cách ngày (giai đoạn thu)'
    ],
    harvest: { product: 'Cà chua', unit: 'kg', storage: 'cool_fruit', from: 65 },
    kpi: ['Năng suất 15–25 kg/m²/vụ', 'Tỷ lệ quả loại 1 ≥ 80%', 'Độ Brix ≥ 5'],
    post: ['Thu quả chuyển màu 30–50% nếu vận chuyển xa', 'Phân loại theo kích cỡ, màu sắc', 'Kho mát 10–13°C, ẩm 85–90%; không để < 10°C']
  },

  /* ----------------------------- DƯỢC LIỆU ---------------------------- */
  {
    id: 'cagaileo', type: 'herb', name: 'Cà gai leo (thân, lá)', std: 'GACP-WHO (TT 19/2019/TT-BYT)',
    qtyUnit: 'm²', duration: 190,
    desc: 'Dược liệu thu thân lá. Thu lần 1 sau 6 tháng, tái sinh thu 2–3 lần/năm. Không dùng thuốc BVTV hóa học ngoài danh mục.',
    stages: [
      { f: -15, t: -1, n: 'Chọn vùng & làm đất', env: {}, tip: 'Vùng trồng cách xa nguồn ô nhiễm; lưu hồ sơ phân tích đất, nước.' },
      { f: 0,   t: 30, n: 'Bén rễ – hồi xanh', env: { temp: [20, 33], soil: [65, 80] }, tip: 'Trồng ngày râm mát, tưới giữ ẩm 2 lần/ngày.' },
      { f: 31,  t: 150, n: 'Sinh trưởng thân lá', env: { temp: [18, 35], soil: [60, 75] }, tip: 'Ưu tiên phân hữu cơ; chế phẩm sinh học cho sâu bệnh.' },
      { f: 151, t: 190, n: 'Thu hoạch – sơ chế', env: { temp: [18, 35], soil: [45, 65] }, tip: 'Thu ngày nắng ráo khi cây bắt đầu ra hoa (hàm lượng hoạt chất cao).' }
    ],
    tasks: [
      [-15, 'Đánh giá vùng trồng; lấy mẫu đất, nước phân tích (hồ sơ GACP)', 'kt'],
      [-10, 'Làm đất, lên luống; bón lót phân chuồng hoai + lân', 'dd'],
      [0,   'Trồng cây giống (giâm cành/hạt, cao 25–30 cm), mật độ 40×40 cm; ghi nguồn giống', 'kt'],
      [15,  'Trồng dặm cây chết', 'kt'],
      [30,  'Làm cỏ, xới xáo; bón thúc lần 1 phân hữu cơ', 'dd'],
      [30,  'Thăm đồng: sâu, nhện đỏ, rệp – ưu tiên biện pháp sinh học', 'bv', 30, 150],
      [60,  'Làm cỏ, bón thúc lần 2', 'dd'],
      [90,  'Bón thúc lần 3', 'dd'],
      [170, 'Ngừng tưới 5–7 ngày trước thu hoạch', 'kt'],
      [180, 'Thu hoạch lần 1: cắt cách gốc 10–15 cm vào ngày nắng ráo', 'th'],
      [181, 'Sơ chế: loại tạp, rửa, thái đoạn 2–3 cm; sấy 50–60°C đến ẩm ≤ 12%', 'th'],
      [183, 'Đóng gói bao PE kín + bao ngoài; nhãn lô, ngày thu, vùng trồng', 'th'],
      [185, 'Bón phân, tưới phục hồi cho lứa tái sinh (thu lần 2 sau 4–5 tháng)', 'dd']
    ],
    daily: [
      'Tưới giữ ẩm theo thời tiết (tránh úng)',
      'Thăm vườn phát hiện sâu bệnh',
      'Ghi nhật ký canh tác theo mẫu GACP'
    ],
    harvest: { product: 'Cà gai leo khô', unit: 'kg', storage: 'dry_herb', from: 175 },
    kpi: ['Năng suất tươi 1,5–2 kg/m²/lần thu', 'Tỷ lệ tươi/khô ≈ 4:1', 'Độ ẩm dược liệu ≤ 12%, tạp chất ≤ 1%'],
    post: ['Sấy 50–60°C, đảo đều; không phơi trực tiếp trên nền đất', 'Độ ẩm ≤ 12% trước khi đóng gói', 'Kho khô mát < 28°C, ẩm < 60%, kê pallet cách tường 30 cm', 'Kiểm tra mốc, mọt hàng tháng; FIFO']
  },
  {
    id: 'turmeric', type: 'herb', name: 'Nghệ vàng (thân rễ)', std: 'GACP-WHO',
    qtyUnit: 'm²', duration: 280,
    desc: 'Trồng tháng 2–4, thu hoạch sau 8–9 tháng khi lá vàng lụi. Hàm lượng curcumin cao nhất khi thu đúng thời điểm.',
    stages: [
      { f: -10, t: -1, n: 'Làm đất', env: {}, tip: 'Đất tơi xốp, thoát nước tốt; tránh chân ruộng trũng.' },
      { f: 0,   t: 60, n: 'Mọc mầm – ra lá', env: { temp: [20, 32], soil: [65, 80] }, tip: 'Phủ rơm giữ ẩm, hạn chế cỏ dại.' },
      { f: 61,  t: 210, n: 'Phát triển thân củ', env: { temp: [20, 35], soil: [60, 80] }, tip: 'Vun gốc kịp thời để củ phát triển.' },
      { f: 211, t: 280, n: 'Tích lũy – thu hoạch', env: { temp: [15, 32], soil: [45, 65] }, tip: 'Giảm tưới khi lá bắt đầu vàng.' }
    ],
    tasks: [
      [-10, 'Làm đất sâu 25–30 cm, lên luống 1–1,2 m; bón lót phân chuồng + lân + vôi', 'dd'],
      [-2,  'Chọn củ giống bánh tẻ; xử lý nấm bằng chế phẩm Trichoderma', 'kt'],
      [0,   'Trồng củ giống 30×30 cm, sâu 5–7 cm; phủ rơm rạ', 'kt'],
      [45,  'Làm cỏ, bón thúc lần 1', 'dd'],
      [60,  'Kiểm tra thối củ, sâu đục thân; khơi rãnh thoát nước', 'bv', 60, 240],
      [90,  'Vun gốc, bón thúc lần 2 (kali)', 'dd'],
      [150, 'Vun gốc lần 2, bón thúc lần 3', 'dd'],
      [255, 'Ngừng tưới khi lá chuyển vàng', 'kt'],
      [270, 'Thu hoạch khi 70% lá vàng lụi; đào tránh dập củ', 'th'],
      [271, 'Sơ chế: rửa, hấp 30–45 phút, thái lát 2–3 mm, sấy 50–60°C đến ẩm ≤ 12%', 'th']
    ],
    daily: [
      'Kiểm tra độ ẩm đất, thoát nước sau mưa',
      'Thăm ruộng phát hiện sâu bệnh',
      'Ghi nhật ký canh tác'
    ],
    harvest: { product: 'Nghệ vàng khô (lát)', unit: 'kg', storage: 'dry_herb', from: 260 },
    kpi: ['Năng suất củ tươi 2–3 kg/m²', 'Curcumin ≥ 3% (khô)', 'Độ ẩm ≤ 12%'],
    post: ['Hấp/luộc chín trước khi thái để giữ màu', 'Sấy 50–60°C', 'Đóng bao kín, kho khô mát, tránh ánh sáng (curcumin dễ phân hủy)']
  }
];

/* =================== CƠ SỞ TRI THỨC CHẨN ĐOÁN (CỐ VẤN) =================== */
const DIAG = {
  poultry: [
    { s: 'Gà tụm lại dưới đèn/chụp sưởi, kêu nhiều', c: 'Nhiệt độ chuồng thấp hơn yêu cầu', a: 'Tăng sưởi, che rèm chắn gió lùa; kiểm tra nhiệt ở độ cao lưng gà.', lv: 'warn' },
    { s: 'Gà há mỏ thở, tản xa nguồn nhiệt, uống nhiều nước', c: 'Stress nhiệt', a: 'Tăng thông gió/quạt, làm mát; bổ sung điện giải, vitamin C; cho ăn giờ mát.', lv: 'warn' },
    { s: 'Phân sáp, phân lẫn máu, gà ủ rũ xù lông', c: 'Nghi cầu trùng', a: 'Cách ly, dùng thuốc đặc trị theo chỉ định thú y; thay đệm lót ẩm ướt.', lv: 'bad' },
    { s: 'Khò khè, chảy nước mũi, sưng mặt, chảy nước mắt', c: 'Bệnh hô hấp (CRD, IB, Coryza)', a: 'Kiểm tra NH₃, thông gió; khám thú y để dùng kháng sinh phù hợp.', lv: 'warn' },
    { s: 'Phân xanh/trắng loãng, vẹo cổ, chết nhiều đột ngột', c: 'NGHI Newcastle hoặc Cúm gia cầm', a: 'BÁO NGAY thú y địa phương; cách ly, không bán chạy, không vận chuyển; tăng sát trùng.', lv: 'bad' },
    { s: 'Mùi khai nặng, cay mắt khi vào chuồng', c: 'NH₃ cao do đệm lót ẩm, thông gió kém', a: 'Tăng thông gió, xới/bổ sung đệm lót, men vi sinh xử lý đệm lót.', lv: 'warn' },
    { s: 'Gà mổ cắn nhau, rỉa lông', c: 'Mật độ cao, ánh sáng mạnh, thiếu đạm/muối', a: 'Giảm cường độ sáng, giãn đàn, bổ sung khoáng, tách con bị mổ.', lv: 'warn' },
    { s: 'Giảm đẻ đột ngột, vỏ trứng mỏng/dị hình', c: 'Stress nhiệt, IB/EDS, thiếu Ca-P', a: 'Kiểm tra nhiệt, khẩu phần Ca; xét nghiệm bệnh; bổ sung vỏ sò buổi chiều.', lv: 'warn' },
    { s: 'Gà ăn kém, tăng trọng thấp hơn chuẩn', c: 'Chất lượng thức ăn, nước uống, bệnh tiềm ẩn', a: 'Kiểm tra thức ăn (mốc), nước uống, độ cao máng; cân mẫu so chuẩn giống.', lv: 'warn' },
    { s: 'Gà què, khớp sưng, đệm lót ướt', c: 'Viêm khớp, đệm lót kém', a: 'Thay đệm lót, kiểm tra núm uống rò rỉ; điều trị theo thú y.', lv: 'warn' }
  ],
  mushroom: [
    { s: 'Mốc xanh (Trichoderma) trên bịch', c: 'Thanh trùng chưa đạt / nhiễm lúc cấy', a: 'Loại bỏ, tiêu hủy xa khu nuôi; kiểm tra thời gian – nhiệt độ hấp; vô trùng khu cấy.', lv: 'bad' },
    { s: 'Tơ ăn chậm, không lan hết bịch', c: 'Nhiệt thấp, giống yếu, giá thể quá ẩm/chặt', a: 'Giữ phòng ủ 25–28°C; kiểm tra tuổi giống; điều chỉnh độ ẩm giá thể 60–65%.', lv: 'warn' },
    { s: 'Quả thể chân dài, mũ nhỏ', c: 'CO₂ cao, thiếu ánh sáng', a: 'Tăng thông gió (CO₂ < 1000 ppm), bổ sung ánh sáng tán xạ 200–500 lux.', lv: 'warn' },
    { s: 'Mũ nấm khô, nứt, vàng mép', c: 'Độ ẩm không khí thấp, gió lùa trực tiếp', a: 'Tăng phun sương (RH 85–95%), che chắn gió.', lv: 'warn' },
    { s: 'Nấm úng nước, thối nhũn, có mùi', c: 'Tưới trực tiếp quá nhiều, ẩm đọng', a: 'Phun sương mịn lên nền/vách, không phun trực tiếp quả; tăng thông thoáng.', lv: 'warn' },
    { s: 'Ruồi nấm, bọ, sâu non trong bịch', c: 'Vệ sinh kém, không có lưới chắn', a: 'Lưới chắn côn trùng, bẫy đèn/bẫy dính; vệ sinh nhà nuôi, loại bịch hỏng.', lv: 'warn' },
    { s: 'Không ra quả sau khi rạch bịch', c: 'Thiếu sốc nhiệt/ẩm, tơ chưa chín', a: 'Sốc lạnh ban đêm, tăng ẩm, bật đèn; chờ tơ chín thêm 5–7 ngày.', lv: 'warn' }
  ],
  veg: [
    { s: 'Lá vàng từ lá già lên', c: 'Thiếu đạm (N)', a: 'Bón thúc đạm hòa loãng/hữu cơ; thủy canh: tăng EC.', lv: 'warn' },
    { s: 'Lá thủng lỗ nhỏ li ti', c: 'Bọ nhảy', a: 'Bẫy dính vàng, luân canh, chế phẩm sinh học; tuân thủ PHI.', lv: 'warn' },
    { s: 'Lá bị ăn khuyết, có sâu xanh nhỏ', c: 'Sâu tơ / sâu xanh', a: 'Thuốc sinh học Bt, lưới chắn; thăm đồng thường xuyên.', lv: 'warn' },
    { s: 'Cây héo xanh đột ngột (cà chua)', c: 'Héo xanh vi khuẩn', a: 'Nhổ bỏ, tiêu hủy; xử lý vôi hố trồng; luân canh, dùng giống kháng.', lv: 'bad' },
    { s: 'Rễ thủy canh nâu, nhớt, có mùi', c: 'Thối rễ Pythium (thiếu O₂, dung dịch nóng)', a: 'Làm mát dung dịch < 26°C, sục khí, thay dung dịch, vệ sinh hệ thống.', lv: 'bad' },
    { s: 'Mép lá non cháy khô (xà lách)', c: 'Tipburn – thiếu Ca cục bộ, EC/nhiệt cao', a: 'Giảm EC, tăng thông gió, đảm bảo Ca trong dung dịch.', lv: 'warn' },
    { s: 'Đít quả cà chua thâm đen, lõm', c: 'Thối đít quả – thiếu Ca, tưới không đều', a: 'Tưới đều, ổn định EC; bổ sung Canxi.', lv: 'warn' },
    { s: 'Lá xoăn, vàng khảm, cây lùn', c: 'Virus xoăn lá (bọ phấn truyền)', a: 'Nhổ bỏ cây bệnh, quản lý bọ phấn, lưới 50 mesh.', lv: 'bad' },
    { s: 'Vết bệnh úng nước, mốc trắng mặt dưới lá', c: 'Sương mai', a: 'Giảm ẩm, thông gió, không tưới chiều tối; thuốc sinh học/đặc hiệu theo PHI.', lv: 'warn' }
  ],
  herb: [
    { s: 'Củ/rễ thối, cây héo dần', c: 'Úng nước, nấm bệnh đất', a: 'Khơi rãnh thoát nước, Trichoderma, nhổ bỏ cây bệnh.', lv: 'bad' },
    { s: 'Dược liệu sau sấy bị mốc', c: 'Độ ẩm sản phẩm > 12% hoặc kho ẩm', a: 'Sấy lại, kiểm tra ẩm kho < 60%, dùng pallet, gói hút ẩm.', lv: 'bad' },
    { s: 'Rệp, nhện đỏ trên lá', c: 'Thời tiết khô nóng', a: 'Tưới phun rửa lá, chế phẩm thảo mộc/sinh học; không dùng thuốc hóa học ngoài danh mục.', lv: 'warn' },
    { s: 'Dược liệu nhạt màu, mùi kém', c: 'Sấy quá nhiệt / thu sai thời điểm', a: 'Sấy ≤ 60°C; thu đúng giai đoạn khuyến cáo trong quy trình.', lv: 'warn' },
    { s: 'Cây sinh trưởng kém, lá nhỏ', c: 'Đất nghèo dinh dưỡng, chua', a: 'Bón hữu cơ hoai, điều chỉnh pH bằng vôi.', lv: 'warn' },
    { s: 'Mọt, côn trùng trong kho', c: 'Kho không đạt, hàng tồn lâu', a: 'Vệ sinh kho, xoay vòng FIFO, bẫy côn trùng, kiểm tra hàng tháng.', lv: 'warn' }
  ]
};

/* Loại thiết bị IoT / cơ giới hóa và tác động mô phỏng tới môi trường */
const DEVICE_KINDS = {
  fan:    { n: 'Quạt thông gió',     icon: '🌀', eff: { temp: -1.6, co2: -350, nh3: -3 } },
  heater: { n: 'Sưởi / đèn úm',      icon: '🔥', eff: { temp: 2.2 } },
  mist:   { n: 'Phun sương',         icon: '💧', eff: { rh: 7 } },
  pad:    { n: 'Tấm làm mát',        icon: '❄️', eff: { temp: -2.4 } },
  light:  { n: 'Đèn chiếu sáng',     icon: '💡', eff: { lux: 1 } },
  pump:   { n: 'Bơm tưới/tuần hoàn', icon: '🚿', eff: { soil: 6 } },
  doser:  { n: 'Bơm định lượng A/B', icon: '🧪', eff: { ec: 0.15 } },
  curtain:{ n: 'Rèm / lưới cắt nắng', icon: '🪟', eff: { temp: -0.8 } },
  cooler: { n: 'Máy lạnh kho',       icon: '🧊', eff: { temp: -1.2 } },
  dehum:  { n: 'Máy hút ẩm',         icon: '🌬️', eff: { rh: -5 } }
};

const EQUIP_KINDS = ['Máy làm đất', 'Máy gieo hạt', 'Drone phun thuốc', 'Hệ thống tưới tự động', 'Nồi hấp thanh trùng', 'Máy sấy', 'Kho lạnh / máy nén', 'Máy phát điện', 'Hệ thống làm mát chuồng', 'Máy băng tải / máy đóng gói', 'Xe vận chuyển', 'Khác'];
