# 🗺️ KẾ HOẠCH VIẾT DỰ ÁN: TOOL GIÁO DỤC (AI Robot)

> Tác giả: **Trương Thái Hòa** · Tổng hợp ngày **01/10/2026**
> Tài liệu này ghi lại **toàn bộ các kế hoạch đã lập và thực hiện** để hoàn thành bản dùng thử (thi SKKN 2026–2027):
> mỗi kế hoạch gồm *vấn đề → phân tích → phương án → quyết định → các bước → kiểm chứng → kết quả*.
> Chi tiết kỹ thuật và hướng dẫn sử dụng xem `SO_TAY_DU_AN.md`.

---

## MỤC LỤC
- Phần A. Mục tiêu & nguyên tắc chung
- Phần B. Quy trình làm việc chung cho mọi kế hoạch
- Phần C. 14 kế hoạch đã thực hiện (theo thứ tự thời gian)
- Phần D. Các quyết định thiết kế quan trọng (và lý do)
- Phần E. Kế hoạch kiểm thử
- Phần F. Bài học rút ra
- Phần G. Kế hoạch tiếp theo

---

## PHẦN A. MỤC TIÊU & NGUYÊN TẮC CHUNG

### A1. Mục tiêu dự án
1. Giúp giáo viên **tạo đề kiểm tra nhanh** bằng AI hoặc từ tài liệu có sẵn, đúng ma trận độ khó.
2. Học sinh **làm bài trực tuyến** trên mọi thiết bị (máy tính, Android, iPhone), điểm **tự lưu** về Google Sheets.
3. Giáo viên **thống kê, xếp loại** kết quả theo lớp, theo lần kiểm tra, xuất Excel.
4. **Miễn phí hoàn toàn**: không máy chủ riêng, chỉ dùng trình duyệt + Google Sheets + GitHub Pages.

### A2. Nguyên tắc xuyên suốt
| Nguyên tắc | Ý nghĩa thực tế |
|---|---|
| **Không mất dữ liệu học sinh** | Mọi thay đổi phải tương thích với dữ liệu và Apps Script cũ; có thử lại, lưu tạm, sao lưu |
| **Tương thích ngược** | Đề đã phát cho học sinh, Apps Script chưa cập nhật vẫn phải chạy đúng |
| **Đơn giản cho giáo viên** | Cấu hình một lần, dùng chung cho 2 ứng dụng; hướng dẫn ngay trong phần mềm |
| **An toàn** | Không lưu mật khẩu/token trong mã nguồn; chống chèn mã; bảo vệ điểm học sinh bằng mã đọc |
| **Thảo luận trước, code sau** | Tính năng lớn: phân tích mâu thuẫn, chốt thiết kế với giáo viên rồi mới làm |
| **Kiểm chứng bằng dữ liệu thật** | Mỗi lỗi đều tái hiện được trước khi sửa, kiểm tra lại sau khi sửa |

---

## PHẦN B. QUY TRÌNH LÀM VIỆC CHUNG

Mỗi yêu cầu đều đi qua 6 bước:

1. **Tái hiện / thu thập dữ liệu:** đọc ảnh chụp lỗi, gọi thử URL Apps Script, đo thời gian, thống kê dữ liệu thật.
2. **Tìm nguyên nhân gốc:** không sửa triệu chứng; ví dụ bài trùng → phát hiện đề hủy yêu cầu sau 25 giây.
3. **Lập phương án:** liệt kê các cách, ưu/nhược, rủi ro; với việc lớn thì thảo luận và để giáo viên chọn.
4. **Thực hiện nhỏ, có kiểm soát:** sửa đúng phạm vi, giữ tương thích ngược.
5. **Kiểm chứng:** test tự động + chạy thử trong trình duyệt (dữ liệu giả lập, không ghi vào Sheet thật).
6. **Ghi nhận & bàn giao:** commit có mô tả rõ, cập nhật sổ tay, liệt kê việc giáo viên cần làm (dán Apps Script, triển khai…).

---

## PHẦN C. CÁC KẾ HOẠCH ĐÃ THỰC HIỆN

### KH1 — Khởi tạo hệ sinh thái (15/08/2026)
- **Mục tiêu:** dựng khung sản phẩm có thể dùng được.
- **Các bước:** trang chủ + cấu hình DeepSeek → Robot Tạo Đề (AI + tài liệu) → mẫu đề thi HTML → Apps Script ghi/đọc điểm → Quản Lý Điểm → hệ thống phân bổ độ khó (3 hàm + 76 test).
- **Kết quả:** bản đầu tiên chạy được (`e4f8672`).

### KH2 — Sửa lỗi "AI không trả về đúng định dạng JSON" (28/09)
- **Vấn đề:** tạo đề bằng AI báo lỗi JSON.
- **Phân tích:** AI trả JSON bị cắt (giới hạn token thấp), có code fence, ký tự `\` của công thức toán, dấu phẩy thừa; bộ đọc cũ chỉ cứu được một trường hợp.
- **Kế hoạch:** (1) viết bộ đọc JSON chịu lỗi, lấy từng câu hoàn chỉnh khi bị cắt; (2) giữ lệnh LaTeX; (3) tăng `max_tokens`; (4) sửa thông báo lỗi.
- **Kiểm chứng:** bộ mẫu JSON lỗi (cắt ngang, fence, LaTeX, dấu phẩy) → đọc đúng.

### KH3 — Tạo bù khi AI trả thiếu câu (28/09)
- **Vấn đề:** yêu cầu 20 câu, ra 15 câu.
- **Phân tích:** một phần do cấu hình (tổng số câu theo "Cấu trúc đề" = 15), một phần lỗi thật: AI đếm sai/bị cắt/ghi sai `type` → câu bị loại âm thầm.
- **Kế hoạch:** đếm câu thiếu theo từng dạng → gọi AI tạo bù (tối đa 3 lượt, gửi kèm câu đã có để tránh trùng); chuẩn hóa `type`; cảnh báo nếu vẫn thiếu.
- **Kiểm chứng:** AI giả lập trả 10/15 câu → tự bù đủ 15.

### KH4 — Đồng bộ Google Sheets tin cậy (28/09)
- **Vấn đề:** giáo viên hỏi "kết nối Google Sheets có bị ngắt dữ liệu không".
- **Phân tích (7 rủi ro):** gửi kiểu `no-cors` không biết Google có nhận không; lỗi mạng mất điểm; không khóa khi nhiều học sinh nộp cùng lúc; file Apps Script mẫu không khớp đề; ngày/điểm bị Sheet đổi kiểu; ghi nhầm tab; app không tự tải.
- **Kế hoạch:** đề thi đọc phản hồi xác nhận + thử lại + lưu tạm + nút "Gửi lại điểm"; Apps Script dùng LockService, mã bài nộp, ghi đúng kiểu dữ liệu; đồng bộ file mẫu với trang cài đặt.
- **Kiểm chứng:** mô phỏng thành công / lỗi rồi thành công / bị chặn CORS / mất mạng → đều xử lý đúng.

### KH5 — Học sinh làm bài trên điện thoại (28/09)
- **Vấn đề:** điện thoại không chọn được lớp, "Môn: Đang tải…".
- **Phân tích:** mã chờ tải xong font/icon (mạng chậm); mở file trong khung xem trước Zalo/iPhone không chạy JavaScript.
- **Kế hoạch:** khởi tạo ngay khi trang sẵn sàng; hiện cảnh báo khi JS không chạy; chèn dữ liệu an toàn khi xuất đề.
- **Mở rộng:** iPhone không chạy được file .html tải về → **phát đề bằng link GitHub Pages** (đưa 2 đề Khảo sát Tin 6, 7 lên).

### KH6 — Kết nối ổn định với Sheet lớn (29/09)
- **Vấn đề:** Sheet 500+ dòng lúc tải được lúc không; tải chậm.
- **Phân tích (đo thực tế):** Google mất 3–5 giây mỗi lần, thỉnh thoảng treo ~28 giây rồi báo lỗi; app chỉ thử 1 lần.
- **Kế hoạch:** thử lại 3 lần với thời gian chờ hợp lý; hiện ngay dữ liệu đã lưu lần trước rồi cập nhật ở nền; bộ nhớ đệm trong Apps Script.
- **Điều chỉnh sau đo lại:** Google có lúc 20 giây mới trả lời → nới thời gian chờ 30/45/60 giây.

### KH7 — Xếp loại & bảng thống kê (29/09)
- **Yêu cầu:** Chưa đạt < 5 · Đạt 5–6.4 · Khá 6.5–7.9 · Tốt 8–10 · Đạt trở lên 5–10.
- **Kế hoạch:** đổi ngưỡng ở mọi nơi (thẻ số liệu, biểu đồ, xếp hạng, màu ô điểm); thêm bảng **Thống kê xếp loại theo lớp** (SL, %, Tổng cộng, lọc môn/hình thức, tải CSV); sắp xếp lớp tự nhiên (6A1, 6A2, …, 6A10).
- **Kiểm chứng:** bộ điểm sát ngưỡng (4.99; 5; 6.4; 6.49; 6.5; 7.99; 8; 10) → xếp loại đúng.

### KH8 — Chống nộp bài trùng (29/09)
- **Vấn đề:** một bài bị tính nhiều lần.
- **Phân tích dữ liệu thật:** 174 bài trùng hệt bài trước, phần lớn cách nhau 26–29 giây → **nguyên nhân gốc:** đề hủy yêu cầu sau 25 giây rồi gửi lại, trong khi Google vẫn ghi.
- **Kế hoạch 3 lớp:** (1) đề thi chờ 90 giây, khóa nút NỘP BÀI; (2) Apps Script bỏ qua bài giống hệt trong 2 phút + hàm `xoaBaiNopTrung`; (3) ứng dụng thống kê lọc trùng.
- **Kết quả:** 527 → 385 bài hợp lệ.

### KH9 — Phát đề bằng link GitHub (thảo luận, 29/09)
- **Phương án:** (1) đẩy thẳng lên GitHub bằng API; (2) Apps Script phục vụ đề.
- **So sánh:** (1) nhanh, ổn định, cần token; (2) không cần token, giấu được đáp án nhưng chậm, giới hạn 30 lượt đồng thời.
- **Quyết định:** chọn (1), dùng **kho riêng cho đề thi** (không dùng chung kho mã nguồn) vì: token chỉ sửa được đề, không sửa được phần mềm; không làm lệch Git trên máy; học sinh khó tìm đề; dễ xóa sạch; phù hợp chia sẻ cho giáo viên khác sau này.

### KH10 — Lần kiểm tra & điểm cao nhất (thảo luận, 29/09)
- **Yêu cầu:** mỗi hình thức có Lần 1–6; học sinh làm nhiều lần → lấy điểm cao nhất.
- **Phân tích mâu thuẫn & cách gỡ:**
  | Mâu thuẫn | Cách gỡ đã chốt |
  |---|---|
  | Dữ liệu cũ = Lần 1 → gộp nhầm bài năm trước | Tách theo **năm học** (01/09–31/08) |
  | Giới hạn số lần ↔ gõ tên khác thành "học sinh mới" | Học sinh **chọn tên từ danh sách lớp** |
  | Chặn chắc chắn cần Apps Script mới, chậm | App **không chặn**, chỉ **không tính** lần vượt giới hạn |
  | Hai đề khác nhau cùng "Lần 1" | **Cảnh báo khi xuất đề** trùng môn + hình thức + lần |
  | Chặn "chỉ nộp 1 lần" vừa thêm | **Bỏ**, thay bằng điểm cao nhất + giới hạn |
- **Lưu năm học — 3 phương án:** A. mỗi năm một Sheet (đổi URL hằng năm) · B. một Sheet, mỗi năm một tab (URL không đổi) · C. một tab, lọc theo ngày (chậm dần). → **Chọn B**, dùng C làm phương án tạm khi chưa cập nhật Apps Script.

### KH11 — Đánh giá & xếp thứ tự nâng cấp (29/09)
- **Rà soát 12 điểm**, chia 3 nhóm: bảo mật & dữ liệu học sinh · độ ổn định · tính năng.
- **Thứ tự đã thống nhất:**
  1. Sửa lỗi chèn mã qua tên học sinh (nhỏ, rủi ro cao).
  2. Một lần cập nhật Apps Script gộp: mã đọc dữ liệu + tab năm học + lần kiểm tra.
  3. Viết lại Quản Lý Điểm (bản cũ không có mã nguồn) rồi làm tính năng lần kiểm tra.
  4. Chọn tên từ danh sách lớp, xáo trộn câu hỏi.
  5. Đăng đề lên GitHub.

### KH12 — Nâng cấp toàn diện (29/09) · `1f06477`
- **Bước 1 – Nền chung:** viết `shared/scores.js` (năm học, lần kiểm tra, lọc trùng, điểm cao nhất, giới hạn, xếp loại) + 26 test.
- **Bước 2 – Apps Script v3:** mã đọc dữ liệu tự sinh, tab năm học, `action=info`, cache theo năm, `saoLuu`; 22 test với Sheet giả lập; `build.py` tự đồng bộ mã vào trang cài đặt.
- **Bước 3 – Bảo mật:** escape mọi dữ liệu Sheet/AI; chống chèn công thức CSV; chặn token trên bản web.
- **Bước 4 – Viết lại Quản Lý Điểm:** HTML/JS thuần, đủ tính năng cũ + năm học, điểm cao nhất / tất cả lần nộp, số lần làm, sao lưu.
- **Bước 5 – Robot Tạo Đề:** lần kiểm tra, giới hạn, cảnh báo trùng lần, danh sách học sinh, xáo trộn, trang kết quả mới, AI dự phòng.
- **Bước 6 – Đăng đề GitHub:** tải lên bằng API, chờ Pages, link + QR, gỡ đề.
- **Bước 7 – Bàn giao:** tạo lại đề Tin 6, 7 bằng mẫu mới (giữ link), cập nhật sổ tay, liệt kê việc giáo viên cần làm.
- **Kiểm chứng:** dữ liệu thật 558 bài → 283 lượt kiểm tra; học sinh làm đề xáo trộn đúng hết = 10 điểm; đăng/gỡ đề với GitHub giả lập.

### KH13 — Xử lý sự cố "mất dữ liệu" (01/10)
- **Chẩn đoán:** gọi URL → trả `[]` (bản cũ); Sheet có tab mới trống ở đầu → giáo viên đã bấm **Chạy** `doPost` → tạo tab năm học ở đầu, bản cũ đọc tab đầu → thấy trống. **Dữ liệu không mất.**
- **Khôi phục:** kéo tab "Trang tính1" về đầu (dự phòng: Lịch sử phiên bản của Google Sheets).
- **Phòng ngừa:** tạo tab mới ở cuối; `doPost` thiếu tên không ghi; hàm an toàn `kiemTraCaiDat`; lưu ý "chỉ Triển khai phiên bản mới mới có hiệu lực"; test mô phỏng sự cố.

### KH14 — Kiểm tra toàn bộ, đóng băng tính năng (01/10)
- **Mục tiêu:** bản dùng thử thi SKKN → **không nâng cấp, chỉ sửa lỗi**.
- **Kế hoạch kiểm tra:** trang chủ → Quản Lý Điểm (mã sai/đúng, số liệu so với tính tay, CSV) → Robot (kết nối, kết quả, tạo đề từ file mẫu) → học sinh (5 dạng câu, mất mạng, hết giờ) → bản web GitHub Pages.
- **Lỗi tìm thấy & sửa:** đọc file mẫu Word sai (dòng tiêu đề "Phần 3 … "Gợi ý:"") — lỗi có từ bản đầu; tên file sao lưu lệch ngày (UTC). Thêm 4 test.
- **Ghi nhận không sửa:** lỗi vô hại `hideLoading` ở trang chủ.
- **Bàn giao:** viết lại `SO_TAY_DU_AN.md` đầy đủ; tài liệu kế hoạch này.

---

## PHẦN D. CÁC QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Chạy hoàn toàn trên trình duyệt + Google Sheets + GitHub Pages | Miễn phí, không cần máy chủ, giáo viên tự quản lý dữ liệu |
| 2 | Phát đề bằng **link** thay vì file | iPhone/Zalo không chạy được file .html tải về |
| 3 | Lấy **điểm cao nhất** theo tên + lớp + môn + hình thức + lần + năm học | Khuyến khích ôn luyện; đúng yêu cầu giáo viên |
| 4 | Giới hạn số lần: **không chặn, chỉ không tính** | Không cần máy chủ chặn; hoạt động cả với Apps Script cũ |
| 5 | **Gõ tên khác = học sinh khác** | Tránh gộp nhầm (Hòa ≠ Hoa); bù lại bằng danh sách lớp |
| 6 | Mỗi năm học **một tab**, cùng một Sheet | URL không đổi, xem được năm cũ, Sheet không phình |
| 7 | **Mã đọc dữ liệu** tự sinh, điền sẵn vào mã Apps Script | Bảo vệ điểm học sinh mà giáo viên không phải thao tác thêm |
| 8 | Đề gửi hình thức dạng `Lần 1 - 15` | Apps Script cũ tự nối " Phút" vẫn ghi đúng → tương thích ngược |
| 9 | **Bộ xử lý điểm dùng chung** (`shared/scores.js`) | Hai ứng dụng luôn cho cùng một kết quả; dễ kiểm thử |
| 10 | Viết lại Quản Lý Điểm bằng JS thuần | Bản cũ chỉ có file đã build, không sửa an toàn được |
| 11 | **Kho GitHub riêng** cho đề + token quyền tối thiểu | Lộ token không ảnh hưởng phần mềm; không làm lệch Git |
| 12 | **Đóng băng tính năng** từ 01/10/2026 | Cần bản ổn định cho thi SKKN |

---

## PHẦN E. KẾ HOẠCH KIỂM THỬ

### E1. Test tự động (chạy trước mỗi lần commit)
| File | Số test | Nội dung |
|---|---|---|
| `tests/test_scores.js` | 26 | Hình thức/lần, năm học, điểm cao nhất, gửi trùng, giới hạn, xếp loại, sắp xếp, chống chèn mã |
| `tests/test_apps_script.js` | 24 | Mã đọc, tab năm học, chống trùng, cache, sao lưu, dọn trùng, bấm "Chạy" nhầm |
| `tests/test_parse_local.js` | 4 | Đọc file mẫu Word, văn bản dán từ PDF, câu nhiều dòng |
| `tests/test_difficulty.js` | 76 | Phân bổ độ khó |

### E2. Kiểm tra trên trình duyệt (không ghi vào Sheet thật)
- Giả lập Apps Script v3 / GitHub bằng cách thay hàm `fetch` trong trang.
- Kịch bản học sinh: chọn lớp → chọn tên → làm bài → nộp (thành công / mất mạng / hết giờ / bấm nhiều lần).
- Kịch bản giáo viên: kết nối (mã sai/đúng), tạo đề từ tài liệu, xuất/đăng đề, xem thống kê, tải CSV.
- Đối chiếu số liệu với **tính tay**; kiểm tra giao diện ở kích thước điện thoại.

### E3. Kiểm tra với dữ liệu thật (chỉ đọc)
- Gọi URL Apps Script để đo thời gian, xác định phiên bản đang chạy, thống kê bài trùng.

---

## PHẦN F. BÀI HỌC RÚT RA
1. **Đo trước khi sửa:** nguyên nhân bài trùng (25 giây) và tải chậm (Google 3–20 giây) chỉ lộ ra khi đo dữ liệu thật.
2. **Tương thích ngược là bắt buộc:** đề đã phát và Apps Script cũ vẫn chạy song song rất lâu.
3. **Hướng dẫn phải nói rõ thao tác nguy hiểm:** "Chạy" ≠ "Triển khai"; "Triển khai mới" đổi URL.
4. **Thời gian chờ quá ngắn có thể gây hại** (tạo bài trùng), quá dài làm giáo viên sốt ruột → cần hiện dữ liệu lưu trong lúc chờ.
5. **Dữ liệu người ngoài nhập (tên học sinh) phải luôn được coi là không an toàn.**
6. **Thảo luận mâu thuẫn trước khi code** tiết kiệm công sửa lại (ví dụ: chặn nộp 1 lần ↔ lấy điểm cao nhất).

---

## PHẦN G. KẾ HOẠCH TIẾP THEO

### G1. Trước khi nộp SKKN (bản dùng thử — chỉ sửa lỗi)
- [ ] Cập nhật lần triển khai Apps Script cũ lên v3 (đề đã phát dùng URL cũ).
- [ ] Chạy `saoLuu`, rồi `xoaBaiNopTrung`.
- [ ] Nhập danh sách học sinh các lớp; chạy thử một bài kiểm tra thật trên iPhone/Android.
- [ ] Kiểm tra tạo đề bằng AI với DeepSeek key thật.
- [ ] Hoàn thiện hồ sơ SKKN theo Nghị định 30 (số liệu thực tế lấy từ Quản Lý Điểm).

### G2. Bản Pro (năm học sau)
- Agent tự động ra đề & kiểm thử (sinh đề theo ma trận, tự kiểm tra đáp án/độ khó, tự đăng, thu kết quả).
- Chấm điểm phía Apps Script để giấu đáp án.
- Phân tích từng câu hỏi (câu sai nhiều, đáp án nhiễu).
- Xuất điểm theo mẫu vnEdu/SMAS; flashcard ôn tập; bài tập cá nhân hóa.
