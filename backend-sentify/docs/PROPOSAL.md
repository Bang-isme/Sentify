# Sentify Proposal

Updated: 2026-03-24

## 1. Dự án này là gì

Sentify là một hệ thống SaaS giúp nhà hàng nhỏ hoặc quán F&B đọc được ý nghĩa thật sự phía sau review khách hàng. Thay vì chỉ thấy nhiều bình luận rời rạc, người dùng nhìn thấy những tín hiệu có thể hành động: khách đang phàn nàn điều gì, vấn đề nào lặp lại nhiều nhất, xu hướng đang tốt lên hay xấu đi, và nên sửa việc gì trước.

Phiên bản hiện tại của dự án đi theo hướng thực tế hơn: dữ liệu không còn được hứa hẹn là tự động cào hoàn toàn, mà được đưa vào qua một quy trình admin intake có kiểm duyệt. Cách làm này giúp hệ thống tạo ra một dataset đáng tin hơn, phù hợp với mục tiêu chính của sản phẩm là hỗ trợ quyết định vận hành chứ không phải phô diễn kỹ thuật crawling.

## 2. Bài toán cần giải quyết

Các quán ăn và nhà hàng nhỏ thường có rất nhiều review nằm rải rác. Họ biết là có khách phàn nàn, nhưng lại không biết phàn nàn về cái gì, có lặp lại không, hay mức độ nghiêm trọng đang tăng hay giảm. Dữ liệu thì có, nhưng insight để ra quyết định thì không rõ.

Điều chủ quán thật sự cần không phải là một danh sách review dài hơn. Họ cần một câu trả lời ngắn gọn và đáng tin:

- vấn đề nào đang nổi lên nhiều nhất
- có bằng chứng review nào để kiểm tra lại
- nên ưu tiên xử lý việc gì trước trong tuần này

Sentify được xây để lấp đúng khoảng trống đó.

## 3. Mục tiêu của dự án

### Mục tiêu sản phẩm

Tạo ra một hệ thống có thể biến review khách hàng thành thông tin có ích cho vận hành. Khi người dùng mở dashboard, họ phải nhìn thấy nhanh:

- tổng quan chất lượng phản hồi
- top complaint keywords
- sentiment split
- xu hướng rating
- review evidence để kiểm tra lại
- gợi ý hành động tiếp theo

### Mục tiêu kỹ thuật

Xây một backend có cấu trúc rõ ràng, dữ liệu tách lớp hợp lý, và đủ sạch để mở rộng dần về sau. Dự án cần thể hiện được:

- tư duy SaaS theo từng nhà hàng
- database design có chủ đích
- module boundaries rõ ràng
- security cơ bản nghiêm túc
- xử lý dữ liệu đầu vào có validate
- pipeline insight đủ thực tế để biến dữ liệu thành tín hiệu

### Mục tiêu trình bày đề tài

Sau khi hoàn thiện, dự án phải đủ rõ để có thể trình bày như một sản phẩm thật:

- có mục tiêu cụ thể
- có kiến trúc rõ
- có database hợp lý
- có luồng dữ liệu từ intake đến dashboard
- có môi trường demo và dữ liệu mẫu

## 4. Người dùng chính

Dự án hiện có hai nhóm người dùng chính.

Nhóm thứ nhất là merchant owner hoặc manager. Đây là người đọc dashboard, review evidence, trạng thái dataset, và dùng insight để ra quyết định.

Nhóm thứ hai là admin hoặc analyst nội bộ. Đây là người nhập, chuẩn hóa, duyệt, và publish review vào dataset canonical.

Sản phẩm được thiết kế theo nguyên tắc: merchant phải thấy dữ liệu ổn định và dễ hiểu; admin mới là người xử lý intake mechanics phía sau.

## 5. Giải pháp được chọn

Thay vì cho merchant tự kích hoạt import và chờ một pipeline crawling phức tạp, Sentify hiện chọn giải pháp manual-first:

1. Admin tạo intake batch cho từng nhà hàng.
2. Admin nhập review thủ công, bulk paste, hoặc chuẩn bị cho CSV nội bộ sau này.
3. Review được chỉnh sửa và chuẩn hóa.
4. Từng item được approve hoặc reject.
5. Chỉ dữ liệu đã duyệt mới được publish vào bảng `Review` canonical.
6. Insight được tính lại từ dataset canonical đó.
7. Merchant đọc dashboard và review evidence từ dữ liệu đã ổn định.

Đây là lựa chọn thực tế vì nó ưu tiên độ tin cậy của dữ liệu hơn việc cố gắng tự động hóa quá sớm.

## 6. Phạm vi MVP hiện tại

MVP hiện tại tập trung vào phần backend và data foundation, với các năng lực cốt lõi sau:

- authentication và session management
- restaurant-scoped authorization
- tạo và cập nhật nhà hàng
- admin intake workflow
- publish sang canonical review dataset
- sentiment breakdown, complaint keywords, rating trend
- review evidence có filter
- dashboard read APIs

Phần chưa coi là trọng tâm của MVP hiện tại:

- multi-source crawling hoàn chỉnh
- Facebook hoặc ShopeeFood integration
- async worker phức tạp
- billing hoặc subscription
- organization model lớn
- advanced AI như clustering sâu, RAG, hoặc tự động summary quá tham vọng

## 7. Cách hệ thống được tổ chức

Hệ thống hiện được xây theo dạng modular monolith với Express và Prisma.

Về mặt dữ liệu, có hai lớp rất quan trọng:

- lớp canonical cho merchant đọc
- lớp intake để admin xử lý trước khi publish

Cách tách này giúp hệ thống giữ được sự ổn định cho dashboard. Merchant không đọc trực tiếp dữ liệu thô đang chỉnh sửa. Mọi thứ merchant nhìn thấy đều đi qua một bước review và publish rõ ràng.

Đây là quyết định kiến trúc quan trọng nhất của dự án hiện nay vì nó giữ cho hệ thống vừa dễ hiểu vừa dễ bảo trì.

## 8. Giá trị mà sản phẩm mang lại

Nếu hệ thống chạy đúng mục tiêu, chủ quán không còn phải tự đọc hàng chục hoặc hàng trăm review để đoán vấn đề. Họ chỉ cần vào dashboard và trả lời được ba câu hỏi:

- khách đang phàn nàn điều gì nhiều nhất
- xu hướng có đang tốt lên hay xấu đi không
- hành động nào nên làm trước

Giá trị của Sentify không nằm ở việc "có AI". Giá trị nằm ở việc rút ngắn khoảng cách giữa phản hồi khách hàng và quyết định vận hành.

## 9. Tiêu chí để gọi là thành công

Đề tài này chỉ nên được xem là thành công khi:

- backend có kiến trúc đủ rõ để người khác đọc và tiếp tục phát triển
- database phản ánh đúng business flow manual-first
- intake workflow và publish flow hoạt động ổn định
- merchant đọc được insight từ canonical dataset
- tài liệu mô tả đúng codebase hiện tại, không còn bám proposal cũ
- có thể demo được một luồng hoàn chỉnh từ intake đến dashboard

## 10. Hướng mở rộng sau MVP

Sau khi nền backend và database đủ chắc, dự án có thể mở rộng theo các hướng sau:

- seed data và real Postgres smoke test
- staging deployment, backup, restore, rollback
- CSV intake nội bộ
- tách rõ merchant app và admin app
- async processing cho publish hoặc recalculation nếu dữ liệu tăng
- support thêm nguồn dữ liệu khi quy trình intake đủ ổn định

Nhưng các bước đó chỉ nên làm sau khi nền hiện tại đã vững. Nếu nền chưa chắc mà mở rộng quá sớm, dự án sẽ lại quay về tình trạng có nhiều tính năng nhưng khó bảo trì và khó chứng minh giá trị thật.

## 11. Kết luận

Sentify không nên được hiểu như một dự án crawler hay dashboard đẹp đơn thuần. Nó là một hệ thống giúp biến review khách hàng thành quyết định vận hành rõ ràng cho chủ nhà hàng. Hướng manual-first hiện tại là một phiên bản thực tế hơn, dễ kiểm soát hơn, và phù hợp hơn với mục tiêu làm ra một sản phẩm có thể giải thích, vận hành, và mở rộng dần một cách nghiêm túc.
