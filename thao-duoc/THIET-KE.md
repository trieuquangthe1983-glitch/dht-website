# DHT Thảo Dược — thiết kế ứng dụng

Ứng dụng tra cứu bài thuốc & dược liệu: **tĩnh, không cần build, chạy offline (PWA)**, cùng kiểu với `nong-trai/`. Mở `thao-duoc/index.html` hoặc deploy cả repo lên Netlify.

## Đáp ứng yêu cầu

| Yêu cầu | Cách làm |
|---|---|
| Tìm nhanh bài thuốc cho từng bệnh (kể cả dân gian) | Ô tìm kiếm toàn cục: gõ bệnh, triệu chứng, bài thuốc hoặc vị thuốc, **có/không dấu** (“mat ngu”, “mất ngủ”). Mỗi bệnh có danh sách từ khóa dân gian (“ho gió”, “nóng trong”, “ăn không tiêu”…). Kết quả gộp 3 nhóm: bệnh → bài thuốc → dược liệu, xếp theo độ liên quan. |
| Kho dữ liệu nhận biết thảo dược | Mỗi dược liệu có: tên gọi khác, tên khoa học, họ, **cách nhận biết** (hình thái, mùi, vị, dễ nhầm với gì), tính–vị, bộ phận dùng, công dụng, liều tham khảo, lưu ý. Phân loại theo 11 nhóm công năng (giải biểu, thanh nhiệt, an thần, bổ…). |
| Tổng hợp bài thuốc theo bệnh thông thường | 20 nhóm bệnh thường gặp (hô hấp, tiêu hóa, thần kinh, tim mạch, chuyển hóa, gan mật, da liễu, xương khớp, tiết niệu, phụ khoa…). Trang bệnh = mô tả + **dấu hiệu phải đi khám** + bài thuốc xếp theo mức bằng chứng. |
| Bài thuốc bồi bổ | Tab “Bồi bổ” riêng (`loai: "boi-bo"`). |
| Cập nhật thường xuyên bài thuốc quý | **Gói cập nhật** `capnhat.json` (có `version`), tự kiểm tra ≤1 lần/ngày khi có mạng, hoặc bấm tay / nhập file. Gộp theo `id`, không ghi đè dữ liệu cá nhân, có nhật ký cập nhật và nhãn “Mới”. Người dùng tự thêm bài gia truyền (gắn nhãn *chưa kiểm chứng*, chỉ lưu trên máy). |

## Điểm khác biệt về an toàn (quan trọng với dược học)

- **Nguồn & bằng chứng** trên mọi bài thuốc: Cổ truyền / Dân gian / Có nghiên cứu / Cá nhân; mức ★ (kinh nghiệm → bằng chứng tốt).
- **Hồ sơ an toàn** 🛡️: người dùng tick thai kỳ, cho con bú, trẻ nhỏ, huyết áp cao, tiểu đường, chống đông, dạ dày, gan/thận, tim mạch, dị ứng. Mỗi dược liệu mang mã chống chỉ định; bài thuốc **kế thừa tự động** từ thành phần → cảnh báo đỏ trên thẻ và trang chi tiết.
- **Dấu hiệu cần đi khám** hiển thị nổi bật ở trang bệnh và trang bài thuốc; banner miễn trừ trách nhiệm cố định.
- Bài chỉ hỗ trợ (huyết áp, tiểu đường, gan) ghi rõ **không thay thuốc điều trị**.

## Cấu trúc

```
thao-duoc/
  index.html, app.css, app.js   giao diện + logic (router hash, tìm kiếm, hồ sơ, cập nhật)
  data.js                       kho gốc v1: herbs / diseases / remedies
  capnhat.json                  gói cập nhật mẫu (v2) — thay bằng URL máy chủ qua localStorage `dht_update_url`
  sw.js, manifest.webmanifest   offline + cài lên màn hình chính
```

### Mô hình dữ liệu (rút gọn)

```
herb:    id, ten, khac[], latin, ho, nhom, tinh, vi, bo, congDung[], nhanBiet, lieu, luuY, cd[]
disease: id, ten, nhom, tk[] (từ khóa dân gian), mota, canKham[]
remedy:  id, ten, benh[], loai(benh|boi-bo), nguon, bc(1-3), tp[[herbId,liều]], lam, dung, luuY
pack:    version, date, note, herbs[], diseases[], remedies[], removed{herbs[],remedies[]}
```
Mã cd: `thai bu tre ha dd cd dayday gan mach di`.

## Quy trình biên tập khi cập nhật bài thuốc (khuyến nghị)

1. Nguồn tối thiểu: Dược điển Việt Nam, Dược liệu Việt Nam, sách cổ phương có trích dẫn, hoặc nghiên cứu công bố. Dân gian phải ghi rõ là *dân gian*.
2. Dược sĩ/thầy thuốc thứ hai duyệt liều, chống chỉ định, tương tác trước khi đưa vào gói.
3. Tăng `version`, ghi `note`, deploy `capnhat.json` (header `Cache-Control: no-cache`). Thu hồi bài có vấn đề bằng `removed`.

## Lộ trình mở rộng

- **Máy chủ** (Supabase đã dùng trong repo): bảng `herbs/diseases/remedies/packs`, người dùng gửi bài thuốc → hàng chờ duyệt → xuất gói JSON.
- Tra cứu ảnh dược liệu / nhận diện bằng ảnh; kiểm tra **tương tác thuốc tây – thảo dược**; nhắc lịch dùng thuốc; đa ngôn ngữ; so sánh dược liệu; bản in đơn thuốc.
- Hiện kho gồm 65 dược liệu, 41 nhóm bệnh, 304 bài thuốc (+ gói v2). Cần mở rộng dần qua quy trình duyệt ở trên; **nội dung cần được dược sĩ/thầy thuốc có chuyên môn thẩm định trước khi công bố rộng rãi.**

## Nguồn dữ liệu đã tích hợp

| File | Nguồn | Nội dung |
|---|---|---|
| `data.js` | Biên soạn ban đầu | 46 dược liệu, 20 nhóm bệnh, 33 bài thuốc |
| `data-rau.js` | *Cây rau cây thuốc* — Bộ Y tế, Vụ Y học cổ truyền, NXB Y học, 2005 (bản scan, 31 cây) | 18 dược liệu mới (bí ngô, bí xanh, cải canh, cải củ, cần tây, đậu ván trắng, gai, hành, hẹ, húng giổi, mồng tơi, mơ tam thể, mùi, mướp, rau ngót, rau răm, riềng, thổ cao ly sâm), bổ sung tên gọi khác/cách trồng/thu hái/liều cho 13 dược liệu sẵn có, 65 bài thuốc ứng dụng |
| `data-kampo.js` | *206 bài thuốc Nhật Bản* (cổ phương Kampo, bản dịch tiếng Việt, file `.prc`) | 205 bài (bài 178 trong bản gốc bị mất nội dung) kèm thành phần, liều, công dụng, giải thích; gắn nhãn **kê đơn – không tự dùng** |

Cách chuyển đổi: file `.prc` giải nén PalmDOC → văn bản, tách theo mục *Thành phần / Cách dùng / Công dụng / Giải thích*, tự gán bệnh theo từ khóa trong phần công dụng. PDF là bản scan nên được đọc và chuyển thủ công từng trang. Các lưu ý an toàn bổ sung của ứng dụng (mật ong với trẻ <12 tháng, rau ngót, rượu thuốc, rắn cắn, Ma hoàng/Phụ tử…) được ghi rõ là “bổ sung của ứng dụng”.

**Cần kiểm tra:** (1) bản quyền/giấy phép dùng lại nội dung hai cuốn sách khi công bố công khai; (2) thẩm định chuyên môn các bài từ nguồn cũ (một số bài dân gian như rượu thuốc, dùng mật ong cho trẻ, đắp tỏi… có nguy cơ — đã gắn cảnh báo); (3) gán bệnh cho bài Kampo là tự động, cần rà soát.
