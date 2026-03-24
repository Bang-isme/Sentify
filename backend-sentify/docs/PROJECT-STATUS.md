# Sentify Backend Project Status

Updated: 2026-03-24

Tài liệu này trả lời ngắn gọn dự án backend đang ở đâu, đã xong gì, và nên làm gì tiếp.

## 1. Tổng quan

Đánh giá hiện tại:

- product direction: đã chốt
- backend foundation: đã đủ chắc
- database direction: đúng hướng
- core business flow: đã có
- release evidence: chưa đủ

Backend hiện không còn ở mức mock-demo. Nó đã có shape của một sản phẩm thật, nhưng vẫn thiếu một số bằng chứng vận hành trước khi gọi là production-ready.

## 2. Trạng thái theo workstream

| Hạng mục | Trạng thái | Hiện có | Còn thiếu |
|---|---|---|---|
| Product direction | Done | Manual-first, merchant reads from curated data | Giữ scope không drift |
| Core architecture | Mostly done | Modular monolith, `admin-intake` và `review-crawl` đã rõ | Refactor nốt auth, restaurants, dashboard |
| Auth and security | Mostly done | JWT, refresh, cookies, CSRF, lockout, reset token | Thêm smoke depth cho refresh và reset |
| Merchant read APIs | Mostly done | Dashboard, reviews, complaints, sentiment, trend, top issue | Seeded read-path smoke rộng hơn |
| Admin intake | Mostly done | Create, edit, review, publish, canonical reuse | Smoke qua nhiều batch states hơn |
| Review crawl runtime | Mostly done | Source, run, worker, checkpoint, raw persistence, materialize | Load test SMB và production Redis ops evidence |
| Publish integrity | Mostly done | Dedupe và canonical review reuse đã ổn hơn nhiều | Duplicate publish smoke trên real DB |
| Database | Mostly done | Schema đúng hướng, queue runtime đã có, seed dataset đã có | Backup/restore evidence |
| Testing | Partial | `npm test`, `db:seed`, `test:realdb`, queued smoke | Load test, staged smoke, wider read-path proof |
| Docs | Mostly done | Docs lõi đã bám code hơn trước | Duy trì sync khi code tiếp tục đổi |
| Ops and release | Partial | Health endpoints, setup docs, worker flow | Staging proof, backup, restore, rollback |

## 3. Sprint lens

### Sprint 1 backend

Gần đóng xong nhưng chưa hoàn tất 100%.

Đã có:

- auth/CSRF trust contract
- restaurant-scoped authorization
- docs sync

Còn thiếu:

- refresh lifecycle evidence sâu hơn
- forgot/reset password evidence sâu hơn

### Sprint 2 backend

Đã tiến thêm rõ rệt.

Đã có:

- shared seed and demo dataset
- one real Postgres smoke path cho publish và dashboard refresh

Còn thiếu:

- mở rộng smoke sang merchant read APIs trên seeded data
- mở rộng admin-intake smoke qua nhiều trạng thái batch hơn

### Sprint 3 backend

Mới có một phần nền.

Đã có:

- publish invariants tốt hơn
- canonical dedupe xuyên batch tốt hơn

Còn thiếu:

- seeded read-path confidence đầy đủ
- load behavior awareness ở mức SMB

### Sprint 4 backend

Chưa có đủ evidence release.

Còn thiếu:

- staging deployment proof
- health smoke routine trong môi trường gần production
- backup/restore/rollback drill

## 4. Mốc đã đạt

Các mốc đáng kể nhất hiện tại:

1. Chuyển hẳn sang manual-first admin intake
2. Tách canonical dataset khỏi intake workflow
3. Đóng CSRF trust contract cho cookie-auth writes
4. Siết publish invariants và canonical review reuse
5. Đưa review crawl sang queue + worker thay vì request dài
6. Có seed dataset dùng chung
7. Có real DB publish smoke
8. Có queued crawl smoke với Redis local binary

## 5. Rủi ro nếu dừng ở đây

- vẫn còn tự tin hơi nhiều vào mocked suite
- read-path chưa được chứng minh đủ rộng trên seeded data
- chưa có load signal cho queue worker
- chưa có release evidence thật ở staging

## 6. Ưu tiên tiếp theo

Thứ tự nên làm tiếp:

1. thêm seeded smoke cho merchant read APIs
2. thêm duplicate publish smoke trên real DB
3. tăng độ sâu cho refresh/password reset
4. chuẩn bị load test SMB cho queue và dashboard reads
5. chuẩn bị staging, backup, restore, rollback

## 7. Kết luận

Backend hiện đã đủ chắc để FE sửa lại dựa vào sau này. Phần thiếu bây giờ chủ yếu là evidence, scale proof, và release discipline, không còn là thiếu business flow cốt lõi.
