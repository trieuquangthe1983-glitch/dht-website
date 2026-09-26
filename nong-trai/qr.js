'use strict';
/* =====================================================================
   DHT Smart Farm — tiện ích độc lập, chạy offline:
   • Bộ mã hóa QR Code (byte mode, mức sửa lỗi M, phiên bản 1–40)
   • Chuỗi thanh toán VietQR (chuẩn EMVCo / NAPAS 247)
   • SHA-256 đồng bộ + sinh mã truy cập ngẫu nhiên an toàn
   ===================================================================== */

const QR = (() => {
  const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v];
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
    return r;
  }
  function alignPositions(v, size) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
    for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }
  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1;
    for (; v <= 40; v++) { const cc = v < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(v) * 8) break; }
    if (v > 40) throw new Error('Dữ liệu quá dài cho QR');
    const cap = dataCodewords(v) * 8, bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    push(0, Math.min(4, cap - bits.length)); push(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // Sửa lỗi Reed–Solomon + đan xen khối
    const nb = BLOCKS_M[v], eccLen = ECC_M[v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });
    // Ma trận
    const size = v * 4 + 17, M = [...Array(size)].map(() => Array(size).fill(false)), F = [...Array(size)].map(() => Array(size).fill(false));
    const setF = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPositions(v, size), na = ap.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const format = mask => {
      const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
      setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
      setF(8, size - 8, true);
    };
    format(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, bit(b, i)); setF(c, a, bit(b, i)); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && i < all.length * 8) { M[y][x] = bit(all[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => { // N1 (chuỗi cùng màu), N2 (khối 2×2), N4 (cân bằng sáng/tối)
      let p = 0, dark = 0;
      for (let a = 0; a < size; a++) for (const row of [true, false]) {
        let run = 1;
        for (let b = 1; b <= size; b++) {
          const same = b < size && (row ? M[a][b] === M[a][b - 1] : M[b][a] === M[b - 1][a]);
          if (same) run++; else { if (run >= 5) p += run - 2; run = 1; }
        }
      }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (M[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
      }
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); format(m); const s = penalty(); if (s < bestP) { bestP = s; best = m; } apply(m); }
    apply(best); format(best);
    return M;
  }
  function svg(text, px = 220, label = 'Mã QR') {
    const M = encode(text), n = M.length, q = 4, t = n + q * 2;
    let d = '';
    M.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
    return `<svg class="qr" viewBox="0 0 ${t} ${t}" width="${px}" height="${px}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  return { encode, svg };
})();

/* ------------------------------ VietQR ------------------------------ */
const BANKS = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'], ['970407', 'Techcombank'],
  ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'], ['970403', 'Sacombank'], ['970423', 'TPBank']
];
function crc16(s) {
  let c = 0xFFFF;
  for (const b of new TextEncoder().encode(s)) { c ^= b << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
const noAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
function vietQR({ bin, account, amount, purpose }) {
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const info = noAccent(purpose).replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 25);
  let p = tlv('00', '01') + tlv('01', amount ? '12' : '11')
    + tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA'))
    + tlv('53', '704') + (amount ? tlv('54', String(Math.round(amount))) : '') + tlv('58', 'VN') + (info ? tlv('62', tlv('08', info)) : '') + '6304';
  return p + crc16(p);
}

/* ------------------------- SHA-256 & mã truy cập ------------------------- */
function sha256(str) {
  const K = [], H = [], isPrime = n => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
  for (let n = 2, i = 0; i < 64; n++) if (isPrime(n)) { if (i < 8) H[i] = (Math.pow(n, 1 / 2) * 2 ** 32) | 0; K[i++] = (Math.pow(n, 1 / 3) * 2 ** 32) | 0; }
  const bytes = Array.from(new TextEncoder().encode(str)), bitLen = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xFF);
  const rot = (x, n) => (x >>> n) | (x << (32 - n)), W = new Array(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = (bytes[o + t * 4] << 24) | (bytes[o + t * 4 + 1] << 16) | (bytes[o + t * 4 + 2] << 8) | bytes[o + t * 4 + 3];
    for (let t = 16; t < 64; t++) { const s0 = rot(W[t - 15], 7) ^ rot(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = rot(W[t - 2], 17) ^ rot(W[t - 2], 19) ^ (W[t - 2] >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0, t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((x, i) => { H[i] = (H[i] + x) | 0; });
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function randomCode(len = 8) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = [], buf = new Uint32Array(len);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 2 ** 32); });
  buf.forEach(x => out.push(A[x % A.length]));
  return out.join('').replace(/(.{4})(?=.)/g, '$1-');
}
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashCode = (salt, code) => { let h = normCode(code); for (let i = 0; i < 1000; i++) h = sha256(salt + ':' + h); return h; };
