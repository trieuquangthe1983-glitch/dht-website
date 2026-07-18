-- ============================================================
-- DHT WEBSITE · LƯỢC ĐỒ SUPABASE
-- Dán toàn bộ file này vào: Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) BẢNG BÀI VIẾT --------------------------------------------------
create table if not exists public.posts (
  id          bigint primary key,
  title       text not null,
  content     text,
  excerpt     text,
  category    text,
  icon        text,
  status      text default 'draft',          -- 'published' | 'draft'
  date        text,                           -- ngày hiển thị (dd/mm/yyyy)
  ts          bigint,                         -- timestamp để sắp xếp
  cover_src   text,                           -- ảnh bìa (base64 hoặc URL)
  media       jsonb,                          -- danh sách media của bài
  updated_at  timestamptz default now()
);

-- 2) BẢNG ỨNG DỤNG / PHẦN MỀM --------------------------------------
create table if not exists public.software (
  id          bigint primary key,
  name        text not null,
  version     text,
  platform    text,
  size        text,
  notes       text,
  filename    text,
  file_url    text,                           -- link tải (dùng Storage cho file lớn)
  date        text,
  is_latest   boolean default true,
  updated_at  timestamptz default now()
);

-- 3) BẬT ROW LEVEL SECURITY ----------------------------------------
alter table public.posts    enable row level security;
alter table public.software enable row level security;

-- 4) CHÍNH SÁCH TRUY CẬP -------------------------------------------
-- Khách (anon) CHỈ đọc được bài đã xuất bản & danh sách ứng dụng
drop policy if exists "public read published posts" on public.posts;
create policy "public read published posts"
  on public.posts for select
  using (status = 'published');

drop policy if exists "public read software" on public.software;
create policy "public read software"
  on public.software for select
  using (true);

-- Chỉ tài khoản ĐÃ ĐĂNG NHẬP (admin qua Supabase Auth) mới ghi/sửa/xóa
drop policy if exists "auth write posts" on public.posts;
create policy "auth write posts"
  on public.posts for all
  to authenticated
  using (true) with check (true);

drop policy if exists "auth write software" on public.software;
create policy "auth write software"
  on public.software for all
  to authenticated
  using (true) with check (true);

-- 5) (TÙY CHỌN) STORAGE cho ảnh & file cài đặt ---------------------
-- Vào Storage > New bucket > đặt tên 'media' > Public bucket.
-- Sau đó admin có thể upload ảnh/file và lưu file_url vào bảng trên.

-- XONG. Tạo tài khoản admin tại: Authentication > Users > Add user
-- (email + mật khẩu). Dùng email đó để đăng nhập trên web.
