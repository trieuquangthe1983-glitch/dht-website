-- =====================================================================
-- DHT SMART FARM · THIẾT LẬP MÁY CHỦ SUPABASE (chạy 1 lần)
-- Supabase > SQL Editor > New query > dán toàn bộ file này > Run
-- Chạy lại nhiều lần vẫn an toàn (idempotent).
--
-- Mô hình dữ liệu:
--   farm_state   : toàn bộ dữ liệu quản trị (chỉ QUẢN TRỊ VIÊN đọc/ghi)
--   farm_public  : bản công khai đã lọc thông tin cá nhân (ai cũng đọc)
--   farm_tenants : dữ liệu riêng từng khách thuê + băm mã truy cập
--                  (chỉ đọc qua hàm kiểm tra mã, không đọc trực tiếp)
--   farm_inbox   : đơn hàng / đặt giống / đăng ký / yêu cầu gửi từ website
--   farm_admins  : danh sách tài khoản Supabase Auth là quản trị viên farm
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) QUẢN TRỊ VIÊN -----------------------------------------------------
create table if not exists public.farm_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz default now()
);
alter table public.farm_admins enable row level security;

create or replace function public.is_farm_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.farm_admins where user_id = auth.uid());
$$;
revoke all on function public.is_farm_admin() from public;
grant execute on function public.is_farm_admin() to anon, authenticated;

drop policy if exists "farm_admins read self" on public.farm_admins;
create policy "farm_admins read self" on public.farm_admins
  for select to authenticated using (user_id = auth.uid() or public.is_farm_admin());

-- 2) DỮ LIỆU QUẢN TRỊ --------------------------------------------------
create table if not exists public.farm_state (
  id         text primary key default 'main',
  data       jsonb not null,
  version    bigint not null default 1,
  updated_at timestamptz default now(),
  updated_by uuid default auth.uid()
);
alter table public.farm_state enable row level security;
drop policy if exists "farm_state admin all" on public.farm_state;
create policy "farm_state admin all" on public.farm_state
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

-- 3) DỮ LIỆU CÔNG KHAI -------------------------------------------------
create table if not exists public.farm_public (
  id         text primary key default 'main',
  data       jsonb not null,
  updated_at timestamptz default now()
);
alter table public.farm_public enable row level security;
drop policy if exists "farm_public read" on public.farm_public;
create policy "farm_public read" on public.farm_public for select using (true);
drop policy if exists "farm_public admin write" on public.farm_public;
create policy "farm_public admin write" on public.farm_public
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

-- 4) KHÁCH THUÊ --------------------------------------------------------
create table if not exists public.farm_tenants (
  username    text primary key,
  customer_id text not null,
  auth        jsonb not null default '[]',   -- [{salt, hash}] băm SHA-256 × 1000
  data        jsonb not null default '{}',
  updated_at  timestamptz default now()
);
alter table public.farm_tenants enable row level security;
drop policy if exists "farm_tenants admin all" on public.farm_tenants;
create policy "farm_tenants admin all" on public.farm_tenants
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

create table if not exists public.farm_login_fail (
  username text not null,
  at       timestamptz not null default now()
);
create index if not exists farm_login_fail_idx on public.farm_login_fail(username, at);
alter table public.farm_login_fail enable row level security;   -- không có policy: chỉ hàm nội bộ dùng

-- 5) HỘP THƯ ĐẾN (đơn từ website) --------------------------------------
create table if not exists public.farm_inbox (
  id           bigint generated always as identity primary key,
  kind         text not null,
  customer_id  text,                         -- chỉ hàm xác thực khách thuê mới đặt được
  payload      jsonb not null,
  created_at   timestamptz default now(),
  processed    boolean not null default false,
  processed_at timestamptz
);
alter table public.farm_inbox enable row level security;
drop policy if exists "farm_inbox public insert" on public.farm_inbox;
create policy "farm_inbox public insert" on public.farm_inbox
  for insert to anon, authenticated
  with check (kind in ('order', 'seed_order', 'event_reg') and customer_id is null
              and processed = false and pg_column_size(payload) < 20000);
drop policy if exists "farm_inbox admin all" on public.farm_inbox;
create policy "farm_inbox admin all" on public.farm_inbox
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

-- 6) HÀM XÁC THỰC KHÁCH THUÊ -------------------------------------------
-- Băm giống hệt ứng dụng: h = mã chuẩn hóa; lặp 1000 lần h = sha256(salt || ':' || h)
create or replace function public.farm_hash(p_salt text, p_code text)
returns text language plpgsql immutable set search_path = public, extensions as $$
declare h text := upper(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'));
begin
  for i in 1..1000 loop
    h := encode(extensions.digest(p_salt || ':' || h, 'sha256'), 'hex');
  end loop;
  return h;
end $$;

create or replace function public.farm_tenant_check(p_user text, p_code text)
returns public.farm_tenants language plpgsql volatile security definer set search_path = public, extensions as $$
declare t public.farm_tenants; a jsonb; u text := lower(trim(coalesce(p_user, '')));
begin
  if (select count(*) from public.farm_login_fail where username = u and at > now() - interval '10 minutes') >= 10 then
    raise exception 'Tài khoản tạm khóa do nhập sai nhiều lần, thử lại sau 10 phút';
  end if;
  select * into t from public.farm_tenants where username = u;
  if found then
    for a in select * from jsonb_array_elements(t.auth) loop
      if public.farm_hash(a->>'salt', p_code) = a->>'hash' then return t; end if;
    end loop;
  end if;
  insert into public.farm_login_fail(username) values (u);
  return null;
end $$;
revoke all on function public.farm_hash(text, text) from public, anon, authenticated;
revoke all on function public.farm_tenant_check(text, text) from public, anon, authenticated;

create or replace function public.farm_tenant_login(p_user text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare t public.farm_tenants;
begin
  t := public.farm_tenant_check(p_user, p_code);
  if t.username is null then return null; end if;
  return jsonb_build_object('customer_id', t.customer_id, 'data', t.data, 'updated_at', t.updated_at);
end $$;

create or replace function public.farm_tenant_submit(p_user text, p_code text, p_kind text, p_payload jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare t public.farm_tenants; new_id bigint;
begin
  if p_kind not in ('order', 'seed_order', 'event_reg', 'request', 'task_done') then raise exception 'Loại dữ liệu không hợp lệ'; end if;
  if pg_column_size(p_payload) > 20000 then raise exception 'Dữ liệu quá lớn'; end if;
  t := public.farm_tenant_check(p_user, p_code);
  if t.username is null then raise exception 'Sai tên đăng nhập hoặc mã truy cập'; end if;
  insert into public.farm_inbox(kind, customer_id, payload) values (p_kind, t.customer_id, p_payload) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.farm_tenant_login(text, text) from public;
revoke all on function public.farm_tenant_submit(text, text, text, jsonb) from public;
grant execute on function public.farm_tenant_login(text, text) to anon, authenticated;
grant execute on function public.farm_tenant_submit(text, text, text, jsonb) to anon, authenticated;

-- 7) QUYỀN BẢNG CHO API (RLS vẫn áp dụng) ------------------------------
grant select on public.farm_public to anon, authenticated;
grant insert on public.farm_inbox to anon, authenticated;
grant select, insert, update, delete on public.farm_state, public.farm_public, public.farm_tenants, public.farm_inbox to authenticated;
grant select on public.farm_admins to authenticated;

-- 8) CẤP QUYỀN QUẢN TRỊ ------------------------------------------------
-- Tạo tài khoản tại Authentication > Users > Add user (email + mật khẩu),
-- rồi sửa email dưới đây và chạy dòng này (có thể chạy cho nhiều email):
-- insert into public.farm_admins(user_id, email)
--   select id, email from auth.users where email = 'email-quan-tri@vi-du.vn'
--   on conflict (user_id) do nothing;
