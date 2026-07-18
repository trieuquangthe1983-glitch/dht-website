/* ============================================================
 * DHT WEBSITE · LỚP TÍCH HỢP SUPABASE (backend thật)
 * ------------------------------------------------------------
 * Khi CHƯA điền key bên dưới: web chạy y như cũ (localStorage).
 * Khi ĐÃ điền key: khách truy cập thấy nội dung thật từ Supabase,
 * admin đăng nhập bằng Supabase Auth và "Đăng bài" sẽ đẩy lên server.
 *
 * 👉 Điền 2 giá trị lấy ở: Supabase > Project Settings > API
 * ============================================================ */
window.DHT_SUPABASE = {
  url:     'https://sjjkobhjnzryiqzbeemi.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqamtvYmhqbnpyeWlxemJlZW1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjAxOTMsImV4cCI6MjA5OTczNjE5M30.t7tz2bstD4zBPSWj6Efg5DSjEmmrQqcS5PzUzNWBurA'    // anon public key
};

(function () {
  var cfg = window.DHT_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) {
    console.info('[DHT] Supabase chưa cấu hình → dùng localStorage (chế độ cũ).');
    return;
  }
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('[DHT] Chưa nạp được thư viện supabase-js. Kiểm tra thẻ <script> CDN.');
    return;
  }

  var sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.dhtSB = sb;
  var toastFn = function (m, t) { if (typeof toast === 'function') toast(m, t); };

  /* ---- ÁNH XẠ DB <-> trạng thái web ---- */
  function rowToPost(r) {
    return { id: Number(r.id), title: r.title, content: r.content || '', excerpt: r.excerpt || '',
      category: r.category || '', icon: r.icon || '📰', status: r.status || 'draft',
      date: r.date || '', ts: Number(r.ts) || 0, coverSrc: r.cover_src || '', mediaList: r.media || [] };
  }
  function postToRow(p) {
    return { id: p.id, title: p.title, content: p.content, excerpt: p.excerpt, category: p.category,
      icon: p.icon, status: p.status, date: p.date, ts: p.ts || Date.now(),
      cover_src: p.coverSrc || null, media: p.mediaList || [] };
  }
  function rowToSw(r) {
    return { id: Number(r.id), name: r.name, version: r.version || '', platform: r.platform || '',
      size: r.size || '', notes: r.notes || '', filename: r.filename || '', file_url: r.file_url || '',
      date: r.date || '', isLatest: !!r.is_latest };
  }
  function swToRow(s) {
    return { id: s.id, name: s.name, version: s.version, platform: s.platform, size: s.size,
      notes: s.notes, filename: s.filename, file_url: s.file_url || null, date: s.date, is_latest: !!s.isLatest };
  }

  /* ---- ĐỌC NỘI DUNG CÔNG KHAI (khách thấy nội dung thật) ---- */
  async function loadRemote() {
    try {
      var pr = await sb.from('posts').select('*').order('ts', { ascending: false });
      if (pr.error) throw pr.error;
      if (pr.data) {
        posts = pr.data.map(rowToPost);            // gán thẳng binding chung của app
        if (typeof savePosts === 'function') savePosts();
      }
      var sr = await sb.from('software').select('*').order('id', { ascending: false });
      if (sr.error) throw sr.error;
      if (sr.data) {
        softwareList = sr.data.map(rowToSw);
        localStorage.setItem('dht_software', JSON.stringify(softwareList));
      }
      if (typeof renderNews === 'function') renderNews();
      if (typeof renderSoftware === 'function') renderSoftware();
      if (typeof buildSpotlight === 'function') buildSpotlight();
      console.info('[DHT] Đã tải nội dung từ Supabase: ' +
        (posts || []).length + ' bài, ' + (softwareList || []).length + ' ứng dụng.');
    } catch (e) {
      console.warn('[DHT] Tải nội dung từ Supabase lỗi → giữ dữ liệu localStorage.', e);
    }
  }

  /* ---- GHI: đồng bộ lên server khi admin lưu (cần đã đăng nhập) ---- */
  async function syncPostsUp() {
    if (!(await isAuthed())) { toastFn('⚠️ CHƯA lên server! Phiên đăng nhập hết hạn — hãy đăng nhập lại rồi lưu để bài hiển thị cho khách.', 'err'); return; }
    try {
      var rows = (posts || []).map(postToRow);
      if (rows.length) { var r = await sb.from('posts').upsert(rows); if (r.error) throw r.error; toastFn('☁️ Đã đồng bộ bài viết lên server', 'ok'); }
    } catch (e) { console.warn('[DHT] Đồng bộ bài viết lỗi', e); toastFn('⚠️ Lưu lên server lỗi (xem console)', 'err'); }
  }
  async function syncSoftwareUp() {
    if (!(await isAuthed())) { toastFn('⚠️ CHƯA lên server! Hãy đăng nhập lại rồi lưu.', 'err'); return; }
    try {
      var rows = (softwareList || []).map(swToRow);
      if (rows.length) { var r = await sb.from('software').upsert(rows); if (r.error) throw r.error; toastFn('☁️ Đã đồng bộ ứng dụng lên server', 'ok'); }
    } catch (e) { console.warn('[DHT] Đồng bộ ứng dụng lỗi', e); toastFn('⚠️ Lưu ứng dụng lên server lỗi', 'err'); }
  }
  async function isAuthed() {
    try { var s = await sb.auth.getSession(); return !!(s && s.data && s.data.session); }
    catch (e) { return false; }
  }

  /* ---- BỌC các hàm hiện có để tự đồng bộ ---- */
  function wrap(name, after) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { var r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) {} return r; };
  }

  /* ---- ĐĂNG NHẬP qua Supabase Auth (email = tên đăng nhập nếu có @, hoặc <user>@dht-v.io.vn) ---- */
  function installAuth() {
    var origLogin = window.doLogin;
    window.doLogin = async function () {
      var uEl = document.getElementById('login-user'), pEl = document.getElementById('login-pass');
      var u = (uEl ? uEl.value.trim() : ''), p = (pEl ? pEl.value : '');
      var errEl = document.getElementById('login-err');
      var email = u.indexOf('@') > -1 ? u : (u + '@dht-v.io.vn');
      var res;
      try { res = await sb.auth.signInWithPassword({ email: email, password: p }); }
      catch (e) { res = { error: { message: String(e && e.message || e) } }; }
      if (res.error) {
        console.warn('[DHT] Đăng nhập Supabase lỗi:', res.error);
        // DỰ PHÒNG: cho đăng nhập CỤC BỘ (quản trị offline) để không bị khoá ngoài
        var localList = (typeof users !== 'undefined' && users) ? users : [];
        var found = localList.filter(function (x) { return x.username === u && x.password === p; })[0];
        if (found) {
          currentUser = found;
          sessionStorage.setItem('dht_current_user', JSON.stringify(found));
          var lo0 = document.getElementById('loginOverlay'); if (lo0) lo0.classList.remove('show');
          var ao0 = document.getElementById('adminOverlay'); if (ao0) ao0.classList.add('open');
          if (errEl) errEl.textContent = '';
          if (typeof updateUserBar === 'function') updateUserBar();
          if (typeof applyPermissions === 'function') applyPermissions();
          toastFn('⚠️ Đăng nhập CỤC BỘ (chưa nối server): bài đăng sẽ KHÔNG hiện cho khách. Dùng tài khoản Supabase để đồng bộ.', 'err');
          return;
        }
        if (errEl) {
          errEl.innerHTML = '❌ ' + (res.error.message || 'Đăng nhập thất bại') +
            '<br><span style="font-size:11px;opacity:.85;line-height:1.5;display:block;margin-top:6px">Hãy dùng <b>EMAIL + mật khẩu</b> đã tạo ở Supabase → Authentication → Users.<br>Nếu báo "Email not confirmed": mở user đó và bấm xác nhận email.</span>';
        }
        return;
      }
      // Thành công: dựng currentUser tối thiểu để mở admin
      currentUser = { id: res.data.user.id, name: (email.split('@')[0] || 'Admin'),
        username: email, role: 'super', email: email, avatar: 'A', color: '#1560a8' };
      sessionStorage.setItem('dht_current_user', JSON.stringify(currentUser));
      var lo = document.getElementById('loginOverlay'); if (lo) lo.classList.remove('show');
      var ao = document.getElementById('adminOverlay'); if (ao) ao.classList.add('open');
      if (typeof updateUserBar === 'function') updateUserBar();
      if (typeof applyPermissions === 'function') applyPermissions();
      toastFn('👋 Đăng nhập Supabase thành công!', 'ok');
    };
    var origLogout = window.doLogout;
    window.doLogout = function () { try { sb.auth.signOut(); } catch (e) {} if (typeof origLogout === 'function') origLogout(); };
  }

  /* ---- TẢI FILE ỨNG DỤNG LÊN SUPABASE STORAGE (file lớn không lưu localStorage được) ---- */
  async function uploadAppFileFor(id, file) {
    if (!id || !file) return;
    if (!(await isAuthed())) { toastFn('⚠️ Đăng nhập lại để tải file lên server', 'err'); return; }
    try {
      toastFn('☁️ Đang tải file lên server…', 'info');
      var ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      var path = 'sw/' + id + '.' + ext;
      var up = await sb.storage.from('apps').upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
      if (up.error) throw up.error;
      var url = sb.storage.from('apps').getPublicUrl(path).data.publicUrl;
      var sw = (softwareList || []).find(function (x) { return x.id === id; });
      if (sw) {
        sw.file_url = url; sw.filename = file.name;
        localStorage.setItem('dht_software', JSON.stringify(softwareList));
        var r = await sb.from('software').upsert(swToRow(sw)); if (r.error) throw r.error;
      }
      toastFn('✅ Đã tải file lên server! Nút "Tải về" đã sẵn sàng.', 'ok');
      if (typeof renderSoftware === 'function') renderSoftware();
    } catch (e) {
      console.warn('[DHT] upload file lỗi', e);
      toastFn('⚠️ Tải file lỗi: ' + ((e && e.message) || e) + ' — đã tạo bucket "apps" (public) trong Supabase chưa?', 'err');
    }
  }
  function installSwSave() {
    var orig = window.saveSoftware;
    if (typeof orig !== 'function') return;
    window.saveSoftware = function () {
      var rawFile = window.__swRawFile;
      var wasEditing = (typeof editingSwId !== 'undefined') ? editingSwId : null;
      var r = orig.apply(this, arguments);
      // saveSoftware chỉ ẩn form khi lưu THÀNH CÔNG (qua kiểm tra tên/phiên bản)
      var okEl = document.getElementById('sw-form');
      if (!okEl || okEl.style.display !== 'none') { return r; }
      var targetId = wasEditing || (softwareList[0] && softwareList[0].id);
      window.__swRawFile = null;
      if (rawFile) { uploadAppFileFor(targetId, rawFile); }
      else { syncSoftwareUp(); }
      return r;
    };
  }

  window.addEventListener('load', function () {
    installAuth();
    wrap('savePost', syncPostsUp);
    wrap('deletePost', function (id) { sb.from('posts').delete().eq('id', id); });
    wrap('toggleStatus', syncPostsUp);
    installSwSave();
    wrap('deleteSw', function (id) { sb.from('software').delete().eq('id', id); });
    loadRemote();
  });
})();
