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
