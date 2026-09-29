# 📖 Sổ Tay Dự Án: TOOL GIÁO DỤC (AI Robot)

## 1. 🎯 Tổng quan (Overview)
- **Mục tiêu:** Xây dựng hệ sinh thái công cụ hỗ trợ giáo dục All-in-one miễn phí dành cho giáo viên, bao gồm:
  - **Robot Tạo Đề bằng AI:** Công cụ sinh đề tự động bám sát ma trận và độ khó của giáo viên thiết lập, hỗ trợ xuất đề tự động dạng file làm bài trắc nghiệm HTML (nhúng Webhook thu thập điểm).
  - **Sổ Điểm Điện Tử & Dashboard Quản Lý Điểm (EduScore):** Kết nối 2 chiều với Google Sheets thông qua Google Apps Script API để thống kê, xếp loại và vẽ biểu đồ kết quả học sinh.
- **Công nghệ chính:** HTML5, CSS3, Vanilla JS (ES6+), Google Apps Script API, Chart.js, Python (build scripts).
- **Nguyên lý cốt lõi:** Hoạt động hoàn toàn ở phía client (Client-side), lưu trữ cục bộ bằng `localStorage`, và truyền dữ liệu thông qua webhook Apps Script.
- **Mở app:** chạy `MO_TOOL_GIAO_DUC.bat` (mở `index.html` bằng Chrome/Edge dạng app).
- **GitHub:** https://github.com/truongthaihoavt2010-arch/tool_giao_duc (công khai, bật GitHub Pages từ nhánh `main`).
  - Bản web: https://truongthaihoavt2010-arch.github.io/tool_giao_duc/

---

## 2. 🗂️ Bản đồ cấu trúc (Project Map)
- `index.html` (gốc): Trang chủ hệ sinh thái, mở các công cụ.
- `robot-tao-de/`
  - `index.html`: Giao diện quản trị (SPA) của giáo viên (tạo đề, tỷ lệ khó dễ, quản lý lớp, cấu hình Google Sheets). Trang "Google Sheets" chứa **đoạn mã Apps Script để giáo viên copy** (phải luôn giống hệt `google_apps_script.js`).
  - `app.js`: Logic lõi: gọi AI (DeepSeek → OpenRouter → Groq fallback), parse JSON từ AI, tạo bù câu thiếu, phân bổ độ khó, xuất file đề thi, đọc dữ liệu Google Sheets.
  - `style.css`: CSS giao diện.
  - `google_apps_script.js`: Mã nguồn Apps Script (doPost ghi điểm / doGet trả dữ liệu / hàm dọn bài trùng).
  - `template_test.html`: **File nguồn** giao diện làm bài của học sinh (Student UI).
  - `template_data.js`: Base64 của `template_test.html` (sinh tự động, KHÔNG sửa tay).
  - `build.py`: Mã hóa `template_test.html` → `template_data.js`.
- `quan-ly-diem/index.html`: App Quản Lý Điểm (EduScore) — **chỉ có bản đã build (React, minified), không có mã nguồn gốc**. Mọi thay đổi phải vá trực tiếp bằng thay thế chuỗi chính xác (xem mục 3E).
- `de-thi/`: Các file đề đã xuất, đưa lên GitHub Pages để học sinh làm bài qua link.
- `tests/test_difficulty.js`: Bộ test tự động (76 test cases) cho 3 hàm phân bổ độ khó. Chạy: `node tests/test_difficulty.js`.

---

## 3. 🧩 Quy ước & Thuật toán Cốt lõi (Guidelines & Core Logic)

### A. Quy ước Lập trình:
- Robot Tạo Đề: không dùng thư viện/framework UI bên ngoài (Tailwind, React). Vanilla JS và CSS thuần.
- Dữ liệu cấu hình (API key, Webhook URL) lưu trong `localStorage`, không ghi vào mã nguồn.
- Sau khi sửa `template_test.html`, bắt buộc chạy `python build.py` (trong thư mục `robot-tao-de`) để cập nhật `template_data.js`.
- Sửa `google_apps_script.js` thì phải đồng bộ lại đoạn mã trong `<textarea>` ở trang Google Sheets của `robot-tao-de/index.html`.
- Khi chèn dữ liệu vào template lúc xuất đề: dùng `JSON.stringify` + escape `<` và **hàm thay thế** trong `String.replace` (tránh lỗi với `"`, `$&`, `</script>` trong nội dung câu hỏi).

### B. Hệ thống Phân bổ Độ Khó AI (Difficulty Quota System):
1. **`calculateDifficultyQuota`**: tính số câu chính xác cho mỗi mức độ, tổng luôn khớp.
2. **`normalizeDifficulty`**: chuẩn hóa 20+ biến thể nhãn từ AI về `"Dễ"`, `"Trung bình"`, `"Khó"`.
3. **`balanceDifficultyQuota`**: chuyển nhãn theo mức lân cận để đúng ma trận đặc tả.

### C. Sinh đề bằng AI (app.js):
- **`parseAIQuestionsJSON`**: chịu được code fence (kể cả chưa đóng), văn bản thừa, dấu `\` không hợp lệ, dấu phẩy thừa; khi output bị cắt ngang thì lấy từng câu hoàn chỉnh. `protectLatex` giữ nguyên lệnh LaTeX (`\frac`, `\theta`...).
- **`normalizeQuestionType`**: chuẩn hóa `type` (tiếng Việt/Anh/thiếu) về `mcq | tf | fill | calc`.
- **Tạo bù:** sau lần gọi đầu, đếm số câu thiếu theo từng dạng và gọi AI tạo bù (tối đa 3 lượt, gửi kèm câu đã có để tránh trùng).
- Số câu lấy từ "Cấu trúc đề" (ưu tiên hơn số ghi trong "Mô tả chi tiết").

### D. Đồng bộ Google Sheets:
- **Đề thi gửi điểm** (`template_test.html`): POST form (`name, subject, examTime, className, score, submissionId`), đọc phản hồi để xác nhận; chờ tối đa 90 giây (Google có lúc ~30 giây nhưng vẫn ghi — hủy sớm rồi gửi lại sẽ tạo bài trùng); thử lại 3 lần; lỗi thì lưu tạm `localStorage` (`aiRobotPendingScores`) + nút "Gửi lại điểm".
- **Chống nộp trùng:**
  - Đề thi: khóa nút NỘP BÀI sau lần bấm đầu; ghi nhớ bài đã nộp trên máy (`aiRobotSubmittedExams`, theo đề + tên + lớp) để chặn tải lại trang rồi nộp lại.
  - Apps Script: bỏ qua bài trùng `submissionId`, hoặc trùng nội dung (tên + lớp + môn + hình thức + điểm) trong 2 phút. Hàm `xoaBaiNopTrung()` (chạy tay) dọn bài trùng cũ.
  - Ứng dụng đọc dữ liệu (Quản Lý Điểm, Robot Tạo Đề): lọc bài trùng cùng quy tắc khi thống kê.
- **Apps Script:** `LockService` chống ghi đồng thời; luôn ghi tab đầu tiên; thời gian nộp ghi dạng Date, điểm dạng số; `doGet` trả ngày `dd/MM/yyyy HH:mm:ss`; `CacheService` lưu đệm 5 phút (xóa khi có bài nộp mới).
- **Đọc dữ liệu:** thử lại 3 lần (timeout 15s/15s/40s). Quản Lý Điểm hiện ngay dữ liệu lưu lần trước (`eduscoreCache`) rồi cập nhật ở nền; đọc được cả ngày ISO (Apps Script cũ) lẫn `dd/MM/yyyy`.
- **Cập nhật Apps Script:** dán mã mới → Triển khai → Quản lý các lần triển khai → Sửa → **Phiên bản mới** (giữ nguyên URL). Không tạo "triển khai mới" vì sẽ đổi URL.

### E. App Quản Lý Điểm (bundle đã build):
- Không có mã nguồn: vá bằng script Node thay thế chuỗi, **kiểm tra chuỗi cần thay xuất hiện đúng 1 lần**, sau đó kiểm tra cú pháp bằng `new Function(...)` và chạy thử qua `python -m http.server`.
- **Xếp loại:** Tốt 8–10 · Khá 6.5–7.9 · Đạt 5–6.4 · Chưa đạt < 5 · **Đạt trở lên 5–10**.
- Dashboard: thẻ Tổng bài thi, Điểm TB, Đạt trở lên, Chưa đạt; bảng **"Thống Kê Xếp Loại Theo Lớp"** (SL, %, dòng Tổng cộng, lọc môn/hình thức, tải CSV).
- Danh sách lớp/môn/hình thức sắp xếp tự nhiên (`localeCompare(..., 'vi', {numeric: true})`: 6A1, 6A2, …, 6A10).

### F. Đề thi trên điện thoại:
- Khởi tạo đề bằng `DOMContentLoaded` (không chờ font/icon CDN).
- Khung cảnh báo hiện khi JavaScript không chạy (xem trước trong Zalo/Tệp trên iPhone). iPhone không chạy được file .html tải về → **gửi học sinh link GitHub Pages** thay vì gửi file.
- Đưa đề lên: lưu file vào `de-thi/` (tên không dấu, không khoảng trắng) → commit → push. Link: `https://truongthaihoavt2010-arch.github.io/tool_giao_duc/de-thi/<TEN_FILE>.html`. Lưu ý: kho công khai nên ai có link đều xem được đề và đáp án.

---

## 4. ⏳ Lịch sử & Trạng thái (State & Memory)

- **28–29/09/2026:**
  - Sửa lỗi "AI không trả về đúng định dạng JSON" (parse chịu lỗi, tăng `max_tokens`), giữ LaTeX, tạo bù khi AI trả thiếu câu.
  - Đồng bộ Google Sheets tin cậy: xác nhận lưu điểm, thử lại, lưu tạm, LockService, bộ nhớ đệm, đọc lại khi Google lỗi tạm thời (Sheet 500+ dòng).
  - Sửa lỗi không chọn được lớp trên điện thoại; đưa đề Khảo sát Tin học 6, 7 lên GitHub Pages (`de-thi/`).
  - Quản Lý Điểm: xếp loại theo thang mới, thẻ "Đạt trở lên", bảng thống kê theo lớp, hiện ngay dữ liệu đã lưu, sắp xếp lớp tăng dần.
  - Chống nộp bài trùng (nguyên nhân: đề thi hủy yêu cầu sau 25 giây rồi gửi lại trong khi Google vẫn ghi) — dữ liệu thật 527 bài → 385 bài sau khi lọc trùng.
- **15/08/2026:**
  - Nâng cấp Hệ thống Độ Khó (hiển thị số câu real-time, prompt sư phạm, `balanceDifficultyQuota`, 76/76 test pass).
  - Sửa lỗi phân tách lớp (`;` → `,`).

- **Việc giáo viên cần làm (chưa xác nhận đã làm):**
  - Dán mã Apps Script mới vào Sheet "ROBOT LUU DIEM" và triển khai **Phiên bản mới** (hiện Google vẫn chạy bản cũ).
  - Tạo bản sao Sheet rồi chạy `xoaBaiNopTrung` để dọn bài trùng cũ.
  - Xuất lại các file đề đang dùng bằng mẫu mới (các đề trong `de-thi/` đang dùng mẫu trước khi có chống nộp trùng).
  - Kiểm tra token GitHub cũ (`ghp_...`, từng lưu trong địa chỉ remote) đã bị thu hồi.

- **Task tiếp theo (To-Do):**
  - Tùy chọn thống kê "mỗi học sinh một kết quả" (lần nộp đầu / điểm cao nhất) khi học sinh làm lại.
  - Cấu hình thêm tính năng ôn tập bằng Flashcard 3D tự động lấy dữ liệu từ Dashboard.
  - Tạo Module bài tập cá nhân hóa tự sinh dựa trên phân tích phổ điểm.
  - Viết và biên dịch hồ sơ Sáng kiến kinh nghiệm (SKKN) chuẩn Nghị định 30.
