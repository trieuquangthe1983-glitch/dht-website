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
