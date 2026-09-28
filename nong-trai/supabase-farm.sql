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
--   farm_gateways, farm_gw_cmds, farm_gw_readings : cổng tự động hóa —
--                  bộ điều khiển gọi hàm farm_gw_sync bằng mã cổng
-- Khi cập nhật ứng dụng, chạy lại toàn bộ file này để bổ sung bảng/hàm mới.
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
  with check (kind in ('order', 'seed_order', 'event_reg', 'service_req') and customer_id is null
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
  if p_kind not in ('order', 'seed_order', 'event_reg', 'service_req', 'request', 'task_done') then raise exception 'Loại dữ liệu không hợp lệ'; end if;
  if pg_column_size(p_payload) > 20000 then raise exception 'Dữ liệu quá lớn'; end if;
  t := public.farm_tenant_check(p_user, p_code);
  if t.username is null then return null; end if;   -- không raise: giữ bản ghi đếm sai mã (khóa sau 10 lần)
  insert into public.farm_inbox(kind, customer_id, payload) values (p_kind, t.customer_id, p_payload) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.farm_tenant_login(text, text) from public;
revoke all on function public.farm_tenant_submit(text, text, text, jsonb) from public;
grant execute on function public.farm_tenant_login(text, text) to anon, authenticated;
grant execute on function public.farm_tenant_submit(text, text, text, jsonb) to anon, authenticated;

-- 7) CỔNG TỰ ĐỘNG HÓA (bộ điều khiển tưới, phun sương, quạt…) ----------
--    Bộ điều khiển gọi POST /rest/v1/rpc/farm_gw_sync (header apikey = anon key)
--    với mã cổng; chỉ quản trị viên đọc/ghi trực tiếp các bảng.
create table if not exists public.farm_gateways (
  id         text primary key,
  name       text,
  salt       text not null,
  token_hash text not null,
  last_seen  timestamptz,
  info       jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.farm_gateways enable row level security;
drop policy if exists "farm_gateways admin all" on public.farm_gateways;
create policy "farm_gateways admin all" on public.farm_gateways
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

create table if not exists public.farm_gw_cmds (
  id         bigint generated always as identity primary key,
  gw_id      text not null references public.farm_gateways(id) on delete cascade,
  dev_id     text not null,
  act        text not null check (act in ('on', 'off')),
  dur        int not null default 0,
  status     text not null default 'pending',   -- pending → sent → done | error | expired
  created_at timestamptz default now(),
  sent_at    timestamptz,
  done_at    timestamptz,
  result     text
);
create index if not exists farm_gw_cmds_idx on public.farm_gw_cmds(gw_id, status);
alter table public.farm_gw_cmds enable row level security;
drop policy if exists "farm_gw_cmds admin all" on public.farm_gw_cmds;
create policy "farm_gw_cmds admin all" on public.farm_gw_cmds
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

create table if not exists public.farm_gw_readings (
  id        bigint generated always as identity primary key,
  gw_id     text not null,
  unit_id   text not null,
  vals      jsonb not null,
  ts        timestamptz default now(),
  processed boolean not null default false
);
create index if not exists farm_gw_readings_idx on public.farm_gw_readings(processed, id);
alter table public.farm_gw_readings enable row level security;
drop policy if exists "farm_gw_readings admin all" on public.farm_gw_readings;
create policy "farm_gw_readings admin all" on public.farm_gw_readings
  for all to authenticated using (public.is_farm_admin()) with check (public.is_farm_admin());

create or replace function public.farm_gw_sync(p_gw text, p_token text, p_readings jsonb default '[]', p_acks jsonb default '[]', p_info jsonb default '{}')
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare g public.farm_gateways; r jsonb; a jsonb; cmds jsonb; k text := 'gw:' || left(coalesce(p_gw, ''), 60);
begin
  if (select count(*) from public.farm_login_fail where username = k and at > now() - interval '10 minutes') >= 20 then
    raise exception 'Cổng tạm khóa do sai mã nhiều lần, thử lại sau 10 phút';
  end if;
  select * into g from public.farm_gateways where id = p_gw;
  if not found or public.farm_hash(g.salt, p_token) <> g.token_hash then
    insert into public.farm_login_fail(username) values (k);      -- không raise để giữ lại bản ghi đếm sai mã
    return jsonb_build_object('ok', false, 'error', 'Sai mã cổng hoặc cổng chưa được đăng ký', 'cmds', '[]'::jsonb);
  end if;
  if pg_column_size(p_readings) > 50000 or pg_column_size(p_acks) > 20000 then raise exception 'Dữ liệu quá lớn'; end if;
  update public.farm_gateways set last_seen = now(),
    info = case when jsonb_typeof(p_info) = 'object' and p_info <> '{}'::jsonb and pg_column_size(p_info) < 2000 then p_info else info end
    where id = g.id;
  if jsonb_typeof(p_readings) = 'array' then
    for r in select value from jsonb_array_elements(p_readings) limit 50 loop
      if jsonb_typeof(r->'vals') = 'object' and coalesce(r->>'unit', '') <> '' then
        insert into public.farm_gw_readings(gw_id, unit_id, vals) values (g.id, left(r->>'unit', 60), r->'vals');
      end if;
    end loop;
  end if;
  if jsonb_typeof(p_acks) = 'array' then
    for a in select value from jsonb_array_elements(p_acks) limit 100 loop
      update public.farm_gw_cmds set status = case when a->>'ok' = 'false' then 'error' else 'done' end,
        done_at = now(), result = left(a->>'msg', 200)
        where id::text = a->>'id' and gw_id = g.id and status in ('pending', 'sent');
    end loop;
  end if;
  update public.farm_gw_cmds set status = 'expired' where gw_id = g.id and status = 'pending' and created_at < now() - interval '30 minutes';
  with c as (
    update public.farm_gw_cmds set status = 'sent', sent_at = now()
    where id in (select id from public.farm_gw_cmds where gw_id = g.id and status = 'pending' order by id limit 20)
    returning id, dev_id, act, dur
  ) select coalesce(jsonb_agg(jsonb_build_object('id', id, 'dev', dev_id, 'act', act, 'dur', dur) order by id), '[]') into cmds from c;
  return jsonb_build_object('ok', true, 'time', now(), 'cmds', cmds);
end $$;
revoke all on function public.farm_gw_sync(text, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.farm_gw_sync(text, text, jsonb, jsonb, jsonb) to anon, authenticated;

-- 8) QUYỀN BẢNG CHO API (RLS vẫn áp dụng) ------------------------------
grant select on public.farm_public to anon, authenticated;
grant insert on public.farm_inbox to anon, authenticated;
grant select, insert, update, delete on public.farm_state, public.farm_public, public.farm_tenants, public.farm_inbox,
  public.farm_gateways, public.farm_gw_cmds, public.farm_gw_readings to authenticated;
grant select on public.farm_admins to authenticated;

-- 9) CẤP QUYỀN QUẢN TRỊ ------------------------------------------------
-- Tạo tài khoản tại Authentication > Users > Add user (email + mật khẩu),
-- rồi sửa email dưới đây và chạy dòng này (có thể chạy cho nhiều email):
-- insert into public.farm_admins(user_id, email)
--   select id, email from auth.users where email = 'email-quan-tri@vi-du.vn'
--   on conflict (user_id) do nothing;
