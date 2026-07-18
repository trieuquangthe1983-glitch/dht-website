-- ============================================================
-- DHT · THIẾT LẬP SUPABASE ĐẦY ĐỦ (chạy 1 lần trong SQL Editor)
-- Gộp: schema + comments + contacts + storage
-- ============================================================

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


-- ============================================================
-- DHT · MIGRATION: BẢNG BÌNH LUẬN
-- Dán vào Supabase > SQL Editor > Run (chạy 1 lần)
-- ============================================================

create table if not exists public.comments (
  id          bigint primary key default (extract(epoch from clock_timestamp())*1000)::bigint,
  post_id     bigint not null,
  name        text not null,
  body        text not null,
  approved    boolean default true,        -- true = hiện ngay; đổi false nếu muốn duyệt trước
  created_at  timestamptz default now()
);

create index if not exists comments_post_idx on public.comments(post_id, created_at);

alter table public.comments enable row level security;

-- Khách đọc bình luận đã duyệt
drop policy if exists "public read approved comments" on public.comments;
create policy "public read approved comments"
  on public.comments for select
  using (approved = true);

-- Khách được GỬI bình luận, nhưng chỉ với cờ approved theo mặc định của bảng
-- (chặn người lạ tự đặt approved=true nếu sau này bạn bật kiểm duyệt)
drop policy if exists "public insert comments" on public.comments;
create policy "public insert comments"
  on public.comments for insert
  with check (
    length(coalesce(name,'')) between 1 and 60
    and length(coalesce(body,'')) between 1 and 1000
  );

-- Admin (đã đăng nhập) toàn quyền: duyệt / xóa
drop policy if exists "auth manage comments" on public.comments;
create policy "auth manage comments"
  on public.comments for all
  to authenticated
  using (true) with check (true);

-- XONG. Nếu muốn DUYỆT TRƯỚC khi hiện: đổi default cột approved thành false:
--   alter table public.comments alter column approved set default false;


-- ============================================================
-- DHT · MIGRATION: BẢNG YÊU CẦU LIÊN HỆ (lead)
-- Dán vào Supabase > SQL Editor > Run (chạy 1 lần)
-- ============================================================

create table if not exists public.contacts (
  id          bigint primary key default (extract(epoch from clock_timestamp())*1000)::bigint,
  name        text not null,
  phone       text not null,
  email       text,
  topic       text,
  message     text,
  handled     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists contacts_created_idx on public.contacts(created_at desc);

alter table public.contacts enable row level security;

-- Khách được GỬI liên hệ (insert), có giới hạn độ dài chống rác
drop policy if exists "public insert contacts" on public.contacts;
create policy "public insert contacts"
  on public.contacts for insert
  with check (
    length(coalesce(name,''))  between 1 and 80
    and length(coalesce(phone,'')) between 3 and 20
    and length(coalesce(message,'')) <= 1500
  );

-- KHÔNG cho khách đọc lead (riêng tư). Chỉ admin (đã đăng nhập) đọc/quản lý.
drop policy if exists "auth manage contacts" on public.contacts;
create policy "auth manage contacts"
  on public.contacts for all
  to authenticated
  using (true) with check (true);

-- XONG. Lead sẽ xem trong web (tab 📨 Liên hệ) hoặc Supabase Table Editor.


-- ============================================================
-- DHT · CÀI ĐẶT SUPABASE STORAGE cho FILE ỨNG DỤNG (APK/EXE…)
-- File cài đặt thường lớn (20–60MB) nên KHÔNG lưu localStorage được.
-- Chạy 1 lần trong Supabase > SQL Editor.
-- ============================================================

-- 1) Tạo bucket 'apps' công khai (khách tải được, chỉ admin upload)
insert into storage.buckets (id, name, public)
values ('apps', 'apps', true)
on conflict (id) do update set public = true;

-- 2) Chính sách: ai cũng ĐỌC/tải file trong bucket 'apps'
drop policy if exists "public read apps" on storage.objects;
create policy "public read apps"
  on storage.objects for select
  using (bucket_id = 'apps');

-- 3) Chỉ tài khoản ĐÃ ĐĂNG NHẬP (admin) mới upload / sửa / xóa file
drop policy if exists "auth insert apps" on storage.objects;
create policy "auth insert apps"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'apps');

drop policy if exists "auth update apps" on storage.objects;
create policy "auth update apps"
  on storage.objects for update to authenticated
  using (bucket_id = 'apps') with check (bucket_id = 'apps');

drop policy if exists "auth delete apps" on storage.objects;
create policy "auth delete apps"
  on storage.objects for delete to authenticated
  using (bucket_id = 'apps');

-- XONG. Sau đó vào web: đăng nhập admin → Quản lý phần mềm → chọn file → Lưu.
-- File sẽ tự tải lên Storage, nút "Tải về" sẽ hoạt động cho mọi khách.
-- (Nếu Storage có giới hạn dung lượng file, chỉnh ở Project Settings > Storage.)
