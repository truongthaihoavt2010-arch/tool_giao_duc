# 📖 Sổ Tay Dự Án: TOOL GIÁO DỤC (AI Robot)

## 1. 🎯 Tổng quan (Overview)
- **Mục tiêu:** Hệ sinh thái công cụ hỗ trợ giáo dục miễn phí cho giáo viên:
  - **Robot Tạo Đề bằng AI:** sinh đề theo ma trận độ khó, xuất file làm bài trắc nghiệm HTML hoặc **đăng lên GitHub Pages và lấy link** gửi học sinh; điểm gửi về Google Sheets.
  - **Quản Lý Điểm (EduScore):** đọc điểm từ Google Sheets, thống kê xếp loại, bảng điểm, xếp hạng, biểu đồ.
- **Công nghệ:** HTML5, CSS3, Vanilla JS (ES6+), Google Apps Script, Chart.js, Python (build).
- **Nguyên lý:** chạy hoàn toàn phía client; cấu hình lưu `localStorage` (hai app dùng chung khi mở cùng nguồn: cùng máy hoặc cùng tên miền).
- **Mở app:** chạy `MO_TOOL_GIAO_DUC.bat` (mở `index.html` bằng Chrome/Edge dạng app).
- **GitHub:** https://github.com/truongthaihoavt2010-arch/tool_giao_duc (công khai, GitHub Pages từ nhánh `main`).
  - Bản web: https://truongthaihoavt2010-arch.github.io/tool_giao_duc/

---

## 2. 🗂️ Bản đồ cấu trúc (Project Map)
- `index.html` (gốc): trang chủ hệ sinh thái, cấu hình DeepSeek, mở các công cụ (iframe).
- `shared/scores.js`: **bộ xử lý điểm dùng chung** (năm học, hình thức + lần kiểm tra, lọc trùng, điểm cao nhất, giới hạn số lần, xếp loại, chống chèn HTML). Dùng ở cả hai app.
- `robot-tao-de/`
  - `index.html`: giao diện giáo viên (tạo đề, quản lý lớp + danh sách học sinh, xem kết quả, Google Sheets, AI dự phòng, đăng GitHub).
  - `app.js`: gọi AI (DeepSeek → OpenRouter → Groq nếu có key), parse JSON, tạo bù câu thiếu, phân bổ độ khó, xuất đề (`buildExamHtml`), đọc Google Sheets (`fetchSheetJson`), đăng/gỡ đề GitHub.
  - `google_apps_script.js`: **nguồn duy nhất** của mã Apps Script (phiên bản 3).
  - `template_test.html`: **file nguồn** giao diện làm bài của học sinh.
  - `template_data.js`: Base64 của template (sinh tự động, KHÔNG sửa tay).
  - `build.py`: sinh `template_data.js` VÀ chép `google_apps_script.js` vào ô mã (`<textarea id="gasCode">`) của trang Google Sheets.
- `quan-ly-diem/` (`index.html`, `style.css`, `app.js`): app Quản Lý Điểm viết bằng HTML/JS thuần (đã thay bản React build cũ không có mã nguồn).
- `de-thi/`: đề đã xuất trong kho này (Khảo sát Tin 6, 7). Đề mới nên đăng vào **kho riêng** qua nút "Đăng lên GitHub".
- `tests/`: `node tests/test_scores.js` (26 test) · `node tests/test_apps_script.js` (22 test, Google Sheets giả lập) · `node tests/test_difficulty.js` (76 test).

---

## 3. 🧩 Quy ước & Thuật toán Cốt lõi

### A. Quy ước lập trình
- Không dùng framework UI (React, Tailwind…). Vanilla JS + CSS thuần.
- **Dữ liệu từ Google Sheets / AI khi chèn vào HTML phải qua `EduScores.escapeHtml` (`esc`)** — tên học sinh là dữ liệu người ngoài nhập, có thể chứa mã độc (đánh cắp API key / token GitHub).
- CSV xuất ra: ô bắt đầu bằng `= + - @` được thêm `'` (chống chèn công thức Excel).
- Sửa `template_test.html` hoặc `google_apps_script.js` → chạy `python build.py` (trong `robot-tao-de`).
- Chèn dữ liệu vào template: `JSON.stringify` + escape `<` + **hàm thay thế** trong `String.replace` (tránh lỗi với `"`, `$&`, `</script>`).
- Đổi CSS/JS thì tăng số `?v=` trong thẻ `<link>/<script>` để trình duyệt tải bản mới.

### B. Phân bổ độ khó AI
`calculateDifficultyQuota` · `normalizeDifficulty` · `balanceDifficultyQuota` (76 test).

### C. Sinh đề bằng AI
- `parseAIQuestionsJSON` chịu lỗi (code fence, `\` sai, dấu phẩy thừa, output bị cắt); `protectLatex` giữ lệnh LaTeX.
- `normalizeQuestionType`; tạo bù câu thiếu tối đa 3 lượt; số câu theo "Cấu trúc đề".
- Key OpenRouter/Groq nhập ở trang Google Sheets (`robotAiKeys`); không có key thì bỏ qua dịch vụ đó.

### D. Hình thức, lần kiểm tra, điểm cao nhất (shared/scores.js)
- Hình thức = thời gian làm bài + **Lần 1–6**, ví dụ `15 Phút - Lần 1`. Dữ liệu cũ không ghi lần = **Lần 1**.
- Giới hạn số lần (tùy chọn khi xuất đề): ghi kèm hình thức `... - Tối đa 5 lần`. App **không chặn** học sinh mà **không tính** các lần vượt giới hạn.
- Đề gửi `examTime = "Lần 2 - Tối đa 5 lần - 15"` (Apps Script cũ tự nối " Phút" vẫn đọc đúng) kèm `minutes/round/limit`; Apps Script mới ghi gọn `15 Phút - Lần 2 - Tối đa 5 lần`.
- Mỗi **tên + lớp + môn + hình thức + lần + năm học** → lấy **điểm cao nhất** trong N lần đầu. Gõ tên khác = học sinh khác (chỉ bỏ qua hoa thường/khoảng trắng).
- Bài gửi trùng (giống hệt, cách nhau < 2 phút) không tính là một lần làm.
- Năm học: 01/09 → 31/08.
- Xếp loại: Tốt 8–10 · Khá 6.5–7.9 · Đạt 5–6.4 · Chưa đạt < 5 · **Đạt trở lên 5–10**.
- Xuất đề: cảnh báo nếu "môn + thời gian + lần" đã có bài nộp trong năm học (gợi ý lần còn trống).

### E. Google Sheets & Apps Script (phiên bản 3)
- **Mã đọc dữ liệu (`READ_KEY`)**: app tự sinh (`robotReadKey`), điền sẵn vào mã Apps Script trong trang cài đặt. `doGet` cần `key` đúng; `doPost` (học sinh nộp bài) không cần.
- **Mỗi năm học một tab** (`2026-2027`), tự tạo; tab cũ (vd "Trang tính1") vẫn được đọc theo ngày nộp.
- `doGet?key=&year=2026-2027|all`, `doGet?key=&action=info` (phiên bản, năm học, đã bảo vệ chưa).
- LockService, chống trùng (submissionId + nội dung trong 2 phút), CacheService theo năm học (5 phút, xóa khi có bài mới).
- Công cụ chạy tay: `saoLuu` (bản sao Sheet trong Drive), `xoaBaiNopTrung`.
- Cập nhật: dán mã → Triển khai › Quản lý các lần triển khai › Sửa › **Phiên bản mới** (giữ URL).
- Đọc dữ liệu: thử lại 3 lần (chờ 30/45/60 giây — Google có lúc 20 giây mới phản hồi); Quản Lý Điểm hiện ngay dữ liệu lưu lần trước (`eduscoreCacheV2`) rồi cập nhật ở nền.

### F. Đề thi (template_test.html)
- Khởi tạo bằng `DOMContentLoaded`; khung cảnh báo khi JS không chạy (xem trước Zalo/iPhone).
- Chọn lớp → nếu lớp có danh sách (`STUDENT_LISTS`, nhập ở trang Quản lý lớp) thì chọn tên, có lựa chọn "nhập tay" dự phòng.
- `SHUFFLE`: xáo trộn câu hỏi + đáp án (không đảo đáp án kiểu "Cả A và B", "Tất cả…").
- Gửi điểm: chờ tối đa 90 giây, thử lại 3 lần, lưu tạm + nút "Gửi lại điểm"; khóa nút NỘP BÀI sau lần bấm đầu.

### G. Đăng đề lên GitHub (Robot Tạo Đề)
- Cấu hình ở trang Google Sheets: tài khoản, kho (nên là **kho riêng**, Public, bật Pages), thư mục, nhánh, **token fine-grained chỉ quyền Contents cho kho đó** (`robotGithub`).
- **Không dùng token trên bản web `*.github.io`** (các trang Pages cùng tài khoản dùng chung localStorage) — app tự chặn.
- Nút "Đăng lên GitHub & lấy link": PUT Contents API, tên file có đoạn ngẫu nhiên, chờ Pages cập nhật, hiện link + mã QR. Danh sách "Đề đã đăng" có nút **Gỡ đề** (DELETE).

---

## 4. ⏳ Lịch sử & Trạng thái

- **29/09/2026 — Nâng cấp toàn diện:**
  - Bảo mật: chống chèn mã khi hiển thị dữ liệu Sheet/AI; mã đọc dữ liệu cho Apps Script; chặn token trên bản web.
  - Apps Script v3: tab theo năm học, mã đọc, lần kiểm tra, `saoLuu`.
  - Viết lại Quản Lý Điểm (HTML/JS thuần): năm học, điểm cao nhất theo lần, số lần làm, xem tất cả lần nộp, xếp hạng, biểu đồ, sao lưu CSV.
  - Lần kiểm tra 1–6, giới hạn số lần, cảnh báo trùng lần, danh sách học sinh theo lớp, xáo trộn câu hỏi, đăng đề GitHub + QR.
  - AI dự phòng nhập key trong app; build.py tự đồng bộ mã Apps Script.
- **28–29/09/2026:** sửa lỗi JSON từ AI, tạo bù câu thiếu, đồng bộ Google Sheets tin cậy, sửa lỗi điện thoại, chống nộp trùng, xếp loại & bảng thống kê.
- **15/08/2026:** hệ thống độ khó (76 test), sửa phân tách lớp.

- **Việc giáo viên cần làm (chưa xác nhận):**
  - Dán mã Apps Script **v3** (trang Google Sheets của Robot Tạo Đề, đã có mã đọc) → triển khai **Phiên bản mới**. Hiện Google vẫn chạy bản cũ.
  - Chạy `saoLuu`, rồi `xoaBaiNopTrung` để dọn bài trùng cũ.
  - Tạo kho GitHub riêng cho đề thi + token fine-grained, cấu hình ở trang Google Sheets.
  - Nhập danh sách học sinh các lớp (trang Quản lý lớp học).
  - Kiểm tra token GitHub cũ (`ghp_...`) đã bị thu hồi.

- **To-Do:**
  - Chấm điểm phía Apps Script để giấu đáp án khỏi file đề (bài kiểm tra quan trọng).
  - Phân tích từng câu hỏi (câu sai nhiều, đáp án nhiễu) — cần đề gửi kèm lựa chọn của học sinh.
  - Xuất điểm theo mẫu sổ điểm điện tử (vnEdu/SMAS).
  - Flashcard ôn tập; bài tập cá nhân hóa; hồ sơ SKKN theo Nghị định 30.
