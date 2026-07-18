# DHT Website — Cài đặt Backend (Supabase) + Deploy (Netlify)

Mục tiêu: để **khách truy cập thấy nội dung thật** admin đăng (hiện tại nội dung chỉ
nằm trong trình duyệt admin vì dùng `localStorage`).

Khi chưa làm các bước này, web vẫn chạy bình thường ở chế độ cũ.

---

## A. Tạo backend Supabase (10 phút)

1. Vào https://supabase.com → **New project** (chọn vùng Singapore cho nhanh ở VN).
2. Mở **SQL Editor → New query**, dán toàn bộ nội dung file
   [`supabase-schema.sql`](supabase-schema.sql) → bấm **Run**.
   (Tạo 2 bảng `posts`, `software` + chính sách bảo mật RLS.)
3. Tạo tài khoản admin: **Authentication → Users → Add user** → nhập email + mật khẩu.
   - Email này dùng để đăng nhập trên web (ví dụ `admin@dht-v.io.vn`).
4. Lấy khóa kết nối: **Project Settings → API**, copy 2 giá trị:
   - **Project URL** (dạng `https://xxxx.supabase.co`)
   - **anon public** key.

## B. Bật backend trên web (1 phút)

Mở file [`dht-supabase.js`](dht-supabase.js), điền 2 giá trị vào đầu file:

```js
window.DHT_SUPABASE = {
  url:     'https://xxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'   // anon public key
};
```

Lưu lại. Mở `index.html` → đăng nhập bằng **email + mật khẩu** vừa tạo ở bước A3 →
đăng bài. Mở web ở máy/trình duyệt khác để kiểm tra: nội dung đã hiển thị cho mọi người.

> `anon key` công khai là **an toàn** — RLS đã chặn: khách chỉ ĐỌC bài đã xuất bản,
> chỉ tài khoản đăng nhập mới ghi/sửa/xóa.

## C. Đưa web lên Netlify (5 phút)

**Cách 1 — kéo thả (đơn giản nhất):**
1. Vào https://app.netlify.com → **Add new site → Deploy manually**.
2. Kéo cả **thư mục `trang web`** thả vào. Xong, có link `*.netlify.app`.
3. Đổi domain: **Domain settings → Add custom domain** → trỏ `dht-v.io.vn`.

**Cách 2 — qua GitHub (tự động cập nhật mỗi lần sửa):**
1. Đẩy thư mục này lên một repo GitHub.
2. Netlify → **Import from Git** → chọn repo. File [`netlify.toml`](netlify.toml) đã cấu hình sẵn
   (publish thư mục gốc + security headers).

---

## Ghi chú & bước nâng cao (không bắt buộc)
- **File cài đặt / ảnh lớn:** hiện lưu base64 trong localStorage; với Supabase nên dùng
  **Storage bucket `media`** (đã ghi chú trong `supabase-schema.sql`) rồi lưu `file_url`.
- **Phân quyền nhiều người:** hiện mọi tài khoản Supabase Auth = quyền admin. Có thể thêm
  bảng `profiles` + cột `role` để phân Editor/Viewer.
- Sau khi bạn gửi mình **Project URL + anon key**, mình sẽ điền giúp, kiểm thử đăng/đọc
  bài thật và tinh chỉnh phần còn lại.
