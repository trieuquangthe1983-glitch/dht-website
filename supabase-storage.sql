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
