# 📖 SỔ TAY DỰ ÁN: TOOL GIÁO DỤC (AI Robot)

> Tác giả: **Trương Thái Hòa** · Cập nhật: **01/10/2026** (sau khi hoàn thiện hồ sơ SKKN)
> Kho mã nguồn: https://github.com/truongthaihoavt2010-arch/tool_giao_duc
> Bản web: https://truongthaihoavt2010-arch.github.io/tool_giao_duc/

---

## MỤC LỤC
1. Tổng quan
2. Bản đồ cấu trúc thư mục
3. Hướng dẫn sử dụng (dành cho giáo viên)
4. Kiến trúc & luồng dữ liệu
5. Quy tắc nghiệp vụ (điểm, lần kiểm tra, xếp loại)
6. Google Sheets & Apps Script
7. Quy ước lập trình & kiểm thử
8. Lịch sử phát triển (từ đầu đến nay)
9. Sự cố đã gặp & cách xử lý
10. Trạng thái hiện tại & việc cần làm
11. Định hướng bản Pro

---

## 1. 🎯 TỔNG QUAN

**TOOL GIÁO DỤC** là hệ sinh thái công cụ miễn phí hỗ trợ giáo viên, gồm 2 ứng dụng:

| Ứng dụng | Chức năng |
|---|---|
| **Robot Tạo Đề** | Tạo đề kiểm tra bằng AI (theo ma trận độ khó) hoặc từ tài liệu có sẵn; xuất file bài làm trắc nghiệm HTML hoặc **đăng lên GitHub lấy link + mã QR**; học sinh nộp bài → điểm tự lưu vào Google Sheets |
| **Quản Lý Điểm (EduScore)** | Đọc điểm từ Google Sheets: thống kê xếp loại theo lớp, bảng điểm, xếp hạng, biểu đồ, xuất Excel (CSV), sao lưu |

- **Giai đoạn hiện tại:** **bản dùng thử** phục vụ thi **Sáng kiến kinh nghiệm (SKKN)** năm học 2026–2027 → **đóng băng tính năng, chỉ sửa lỗi**. Năm học sau nâng lên **bản Pro** (mục 11).
- **Công nghệ:** HTML5, CSS3, JavaScript thuần (không framework), Google Apps Script, Chart.js, Python (script build).
- **Nguyên lý:** chạy hoàn toàn trên trình duyệt; không có máy chủ riêng. Cấu hình lưu trong `localStorage` của trình duyệt. Dữ liệu điểm lưu ở Google Sheets của giáo viên.
- **Mở phần mềm trên máy:** chạy `MO_TOOL_GIAO_DUC.bat` (mở `index.html` bằng Chrome/Edge dạng cửa sổ ứng dụng).

---

## 2. 🗂️ BẢN ĐỒ CẤU TRÚC THƯ MỤC

```
TOOL GIAO DUC/
├── index.html                  Trang chủ: cấu hình DeepSeek, mở 2 ứng dụng (iframe)
├── MO_TOOL_GIAO_DUC.bat        Mở phần mềm bằng Chrome/Edge
├── SO_TAY_DU_AN.md             Sổ tay này
├── KE_HOACH_VIET_DU_AN.md      Kế hoạch đã thực hiện: vấn đề → phân tích → quyết định → kiểm chứng
├── SKKN_TOOL_GIAO_DUC.docx     Báo cáo Sáng kiến kinh nghiệm (18 trang, 15 hình, theo thể thức Nghị định 30)
├── SKKN_anh_minh_chung/        17 ảnh chụp phần mềm dùng làm minh chứng (dữ liệu mẫu, tên học sinh hư cấu)
├── shared/
│   └── scores.js               Bộ xử lý điểm DÙNG CHUNG cho 2 ứng dụng
├── robot-tao-de/
│   ├── index.html              Giao diện giáo viên
│   ├── app.js                  Logic: AI, đọc tài liệu, xuất/đăng đề, đọc Google Sheets
│   ├── style.css
│   ├── google_apps_script.js   NGUỒN DUY NHẤT của mã Apps Script (phiên bản 3)
│   ├── template_test.html      NGUỒN giao diện làm bài của học sinh
│   ├── template_data.js        (tự sinh) Base64 của template — KHÔNG sửa tay
│   └── build.py                Sinh template_data.js + chép mã Apps Script vào trang cài đặt
├── quan-ly-diem/
│   ├── index.html, style.css, app.js   App Quản Lý Điểm (JavaScript thuần)
├── de-thi/                     Đề đã đăng trong kho này (Khảo sát Tin 6, 7)
└── tests/                      Bộ test tự động (chạy bằng node)
    ├── test_scores.js          26 test — bộ xử lý điểm
    ├── test_apps_script.js     24 test — Apps Script với Google Sheets giả lập
    ├── test_parse_local.js      4 test — đọc đề từ tài liệu / file mẫu Word
    └── test_difficulty.js      76 test — phân bổ độ khó
```

**Khóa `localStorage` quan trọng** (dùng chung giữa 2 ứng dụng khi mở cùng nguồn):

| Khóa | Nội dung |
|---|---|
| `robotWebhookUrl` | URL ứng dụng web Apps Script |
| `robotReadKey` | Mã đọc dữ liệu (READ_KEY) |
| `robotClasses` | Danh sách lớp + danh sách học sinh |
| `robotStats` | Đề đã tạo, ngân hàng câu hỏi |
| `robotExportOptions` | Tùy chọn xáo trộn / chọn tên từ danh sách |
| `robotGithub`, `robotPublishedExams` | Cấu hình GitHub (có token), danh sách đề đã đăng |
| `robotAiKeys` | Key OpenRouter / Groq (AI dự phòng) |
| `deepseek_config` | Key + model DeepSeek (trang chủ) |
| `eduscoreCacheV2` | Bản sao dữ liệu điểm gần nhất (hiện ngay khi mở Quản Lý Điểm) |
| `aiRobotPendingScores` | (trên máy học sinh) điểm chưa gửi được, chờ gửi lại |

---

## 3. 📘 HƯỚNG DẪN SỬ DỤNG (DÀNH CHO GIÁO VIÊN)

### 3.1. Cài đặt lần đầu
1. **Kết nối AI:** trang chủ → nhập DeepSeek API key → Kết nối. (Tùy chọn: key OpenRouter/Groq ở trang "Google Sheets" của Robot Tạo Đề làm dự phòng.)
2. **Kết nối Google Sheets:**
   - Robot Tạo Đề → trang **Google Sheets** → **Sao chép mã** (mã đã có sẵn *mã đọc dữ liệu* riêng của bạn).
   - Mở Google Sheets → **Tiện ích mở rộng › Apps Script** → xóa mã cũ, dán mã, **Lưu**.
   - Lần đầu: **Triển khai › Tùy chọn triển khai mới › Ứng dụng web** · Thực thi: *Tôi* · Quyền truy cập: *Bất kỳ ai* → copy **URL ứng dụng web**.
   - Dán URL vào app → **Lưu & kiểm tra kết nối** → phải thấy *"✅ Apps Script phiên bản 3 · đã bảo vệ bằng mã đọc"*.
3. **Danh sách học sinh:** trang **Quản lý lớp học** → thêm lớp → **Danh sách** → dán cột họ tên từ Excel (tự bỏ số thứ tự, tên trùng).
4. **(Tùy chọn) Đăng đề qua GitHub:** 9 kho theo môn đã tạo sẵn (xem mục 3.7). Chỉ cần tạo **một token** *fine-grained* (Only select repositories → chọn 9 kho `kttx-…`, quyền **Contents: Read and write**) → dán ở trang Google Sheets › Đăng đề lên GitHub → **Lưu & kiểm tra** (phải thấy "9/9 kho sẵn sàng"). Chỉ nhập token trên phần mềm chạy ở máy tính, không nhập trên bản web.

### 3.2. Cập nhật mã Apps Script (khi phần mềm có bản mới)
- Sao chép mã mới → dán vào Apps Script → **Lưu** → **Triển khai › Quản lý các lần triển khai › chọn lần triển khai đang dùng › Sửa (bút chì) › Phiên bản: Phiên bản mới › Triển khai**.
- ⚠️ **"Lưu" và "Chạy" không làm URL đổi sang mã mới.** "Tùy chọn triển khai mới" tạo **URL mới** (các đề đã phát vẫn gửi về URL cũ).
- Muốn kiểm tra: chọn hàm **`kiemTraCaiDat`** → Chạy → xem Nhật ký (không ghi, không xóa gì).

### 3.3. Tạo đề
- **Bằng AI:** nhập môn, chủ đề, lớp áp dụng (`6A1, 6A2` hoặc `6A1; 6A2`), số câu từng dạng, tỷ lệ Dễ/TB/Khó → **Tạo tự động bằng AI**.
- **Từ tài liệu:** **Tạo từ tài liệu tải lên** → dán nội dung hoặc tải Word/PDF theo **file mẫu** (tải ở nút "Tải file mẫu"):
  - `Câu N:` nội dung · `A.` `B.` `C.` `D.` · `Đáp án đúng: A` (hoặc `Đúng`/`Sai`, hoặc số cho câu tính toán)
  - `Gợi ý: từ1, từ2, …` **chỉ dành cho câu điền khuyết** (danh sách từ gợi ý), đặt trước dòng Đáp án đúng.
- Chọn **Thời gian làm bài**, **Lần kiểm tra (1–6)**, **Số lần làm tối đa** (mặc định không giới hạn).
- **Khi DeepSeek hết tiền** vẫn soạn được đề: (1) **Đề của tôi › Tải HTML** để xuất lại đề đã có; (2) **tạo từ tài liệu** (không dùng AI); (3) nhập key **Groq** (có gói miễn phí) hoặc OpenRouter ở mục "AI dự phòng" — chất lượng mô hình miễn phí thấp hơn nên cần duyệt kỹ, phần này chưa thử với key thật.

### 3.7. Kho GitHub theo môn (đăng đề: chọn kho + đặt tên)
- Mỗi môn **một kho công khai đã bật GitHub Pages** (tài khoản `truongthaihoavt2010-arch`): `kttx-toan`, `kttx-nguvan`, `kttx-tienganh`, `kttx-vatly`, `kttx-hoahoc`, `kttx-sinhhoc`, `kttx-lichsu`, `kttx-dialy`, `kttx-tinhoc` (hai kho `kttx-lichsu`, `kttx-dialy` có từ trước, 7 kho còn lại tạo ngày 05/10/2026). Kho `kttxdialy` (không có chữ `-`) là bản cũ không dùng.
- **Cách đăng:** Xem trước đề › **Đăng lên GitHub & lấy link** › hộp thoại tự chọn kho theo môn của đề (đổi được) › **đặt tên đề** › Đăng & lấy link. Tên đề thành tên file (bỏ dấu, `_`); link dạng `https://truongthaihoavt2010-arch.github.io/kttx-tinhoc/Tin_hoc_15_phut_Lan_1.html`; đề được đặt ở thư mục gốc kho, nhánh `main`.
- Trùng tên đề trong kho → hỏi **ghi đè** (link giữ nguyên). Danh sách "Đề đã đăng" có nút **Gỡ đề**.
- **Đăng đề đã tạo từ trang "Đề của tôi"** (06/10/2026): nút **Đăng GitHub** ở mỗi dòng (1 đề) hoặc tick nhiều đề rồi **Đăng các đề đã chọn** (nhiều đề). Hộp thoại cho từng đề: tên đề, **kho lưu trữ (môn)**, thời gian, lần kiểm tra, số lần tối đa, lớp áp dụng; phía trên: đổi kho cho tất cả, xáo trộn, chọn tên từ danh sách, ghi đè nếu trùng tên. Đăng xong hiện link + Sao chép + Mã QR + tự báo "link đã hoạt động"; đề đã đăng có dấu **✅ Đã đăng** trong bảng. Đề được lưu kèm thời gian/lần/số lần tối đa từ lúc tạo; đề cũ thiếu các thông số này lấy theo giá trị đang chọn trên form (sửa được trong hộp thoại); đề cũ chưa lưu câu hỏi bị bỏ qua có thông báo. Cảnh báo 1 lần nếu có đề trùng "môn + thời gian + lần" đã có bài nộp.
- File `.html` đã tải về máy: phần mềm chưa có chỗ chọn file để đăng (đưa vào kho bằng Git).
- Tên kho theo môn sửa được ở trang cài đặt (mặc định như trên); cấu hình lưu `robotGithub` = `{owner, token, repos}`.
- Đã kiểm thử thật (05/10/2026): lưu cấu hình 9/9 kho → đăng đề thử vào `kttx-tinhoc` → link mở được, có mã QR → đăng lại cùng tên (hỏi ghi đè) → gỡ đề, kho trở lại như cũ.

### 3.4. Xuất / phát đề cho học sinh
Trong cửa sổ **Xem trước đề**:
- Tùy chọn: **Xáo trộn câu hỏi & đáp án**, **Học sinh chọn tên từ danh sách lớp**.
- **Cách chọn tên:** học sinh chọn **lớp** trước, ô họ tên chỉ hiện danh sách **đúng lớp đó** (có dòng "nhập tay" dự phòng). Điều kiện: lớp đã có danh sách ở trang Quản lý lớp học và **tên lớp ở ô "Lớp áp dụng" ghi giống hệt** tên lớp đã khai báo. Đề xuất trước khi có danh sách (vd 2 đề Khảo sát Tin 6, 7) vẫn là ô tự gõ tên.
- **Tải xuống HTML** (gửi file) hoặc **Đăng lên GitHub & lấy link** (khuyên dùng: mở được trên iPhone, Android, máy tính; có mã QR).
- Nếu "môn + thời gian + lần" đã có bài nộp trong năm học → app cảnh báo và gợi ý lần còn trống.
- Học sinh mở link bằng trình duyệt (trong Zalo: **⋯ › Mở bằng trình duyệt**). iPhone không làm được bằng file .html tải về.

### 3.5. Xem điểm
- **Robot Tạo Đề › Xem kết quả:** chọn năm học, lớp → bảng điểm cao nhất + số lần làm → tải CSV.
- **Quản Lý Điểm:** chọn năm học; Dashboard (thẻ số liệu, bảng xếp loại theo lớp, biểu đồ), Bảng điểm (chế độ *Điểm cao nhất* / *Tất cả lần nộp*), Xếp hạng, Biểu đồ; **Sao lưu (tải CSV)** toàn bộ dữ liệu.

### 3.6. Công cụ trong Apps Script (chọn tên hàm → Chạy)
| Hàm | Tác dụng |
|---|---|
| `kiemTraCaiDat` | Báo phiên bản, số bài nộp từng tab, năm học — an toàn |
| `saoLuu` | Tạo bản sao toàn bộ Google Sheet trong Drive (nên chạy cuối học kỳ) |
| `xoaBaiNopTrung` | Xóa bài bị ghi trùng (giống hệt, cách nhau < 2 phút) — chạy `saoLuu` trước |
| ⚠️ `doPost`, `doGet` | **Không bấm Chạy** — chỉ dùng khi học sinh nộp bài / app đọc dữ liệu |

---

## 4. 🔁 KIẾN TRÚC & LUỒNG DỮ LIỆU

```
Robot Tạo Đề ──xuất / đăng GitHub──▶ Đề thi (.html / link)
                                        │ học sinh nộp bài (POST, không cần mã)
                                        ▼
                               Apps Script (doPost) ──▶ Google Sheets (tab theo năm học)
                                        │
                     GET ?key=MÃ_ĐỌC&year=… (doGet)
                                        ▼
            Robot Tạo Đề (Xem kết quả) · Quản Lý Điểm  ──▶ shared/scores.js xử lý
```

- Đề thi là **một file HTML độc lập** (câu hỏi, đáp án, URL Apps Script nhúng sẵn).
- Hai ứng dụng dùng chung `shared/scores.js` để kết quả thống kê luôn giống nhau.

---

## 5. 📐 QUY TẮC NGHIỆP VỤ

### 5.1. Hình thức & lần kiểm tra
- **Hình thức** = thời gian làm bài + **lần kiểm tra (Lần 1–6)**, ví dụ `15 Phút - Lần 1`.
- **Dữ liệu cũ không ghi lần = Lần 1.**
- **Giới hạn số lần** (tùy chọn): ghi kèm `… - Tối đa 5 lần`. App **không chặn** học sinh làm bài, chỉ **không tính** các lần vượt giới hạn.
- Đề gửi `examTime = "Lần 2 - Tối đa 5 lần - 15"` (để Apps Script cũ tự nối " Phút" vẫn đọc đúng) kèm `minutes`, `round`, `limit`; Apps Script v3 ghi gọn `15 Phút - Lần 2 - Tối đa 5 lần`.

### 5.2. Điểm được tính
- Nhóm theo **họ tên + lớp + môn + hình thức + lần + năm học** → lấy **ĐIỂM CAO NHẤT** trong N lần làm đầu tiên.
- **Gõ tên khác = học sinh khác** (chỉ bỏ qua khác biệt hoa/thường, khoảng trắng). → Nên dùng danh sách học sinh.
- **Bài gửi trùng** (cùng tên, lớp, môn, hình thức, điểm; cách nhau < 2 phút) không tính là một lần làm.
- **Năm học:** 01/09 → 31/08 năm sau, theo thời gian nộp.

### 5.3. Xếp loại
| Xếp loại | Điểm |
|---|---|
| Tốt | 8 – 10 |
| Khá | 6.5 – 7.9 |
| Đạt | 5 – 6.4 |
| Chưa đạt | dưới 5 |
| **Đạt trở lên** | **5 – 10** |

(Ngưỡng liên tục: 6.45 là Đạt, 7.95 là Khá.)

---

## 6. 📊 GOOGLE SHEETS & APPS SCRIPT (PHIÊN BẢN 3)

- **Cột dữ liệu:** STT · HỌ TÊN · MÔN · HÌNH THỨC KT · LỚP · THỜI GIAN NỘP · ĐIỂM SỐ · MÃ BÀI NỘP.
- **Mỗi năm học một tab** (`2026-2027`, tự tạo **ở cuối** khi có bài nộp đầu tiên). Tab cũ (vd "Trang tính1") vẫn được đọc theo ngày nộp; thứ tự tab không quan trọng.
- **Mã đọc dữ liệu (`READ_KEY`):** app tự sinh, điền sẵn vào mã. `doGet` phải kèm `key` đúng; `doPost` không cần (học sinh nộp bài).
- **API:** `doGet?key=&year=2026-2027` (mặc định năm hiện tại) · `year=all` · `action=info` (phiên bản, năm học, đã bảo vệ chưa).
- **An toàn dữ liệu:** `LockService` (nhiều học sinh nộp cùng lúc), chống trùng theo `submissionId` và theo nội dung (2 phút), chặn chèn công thức (`=`, `+`, `-`, `@`), `doPost` thiếu họ tên thì không ghi.
- **Tốc độ:** `CacheService` theo năm học (5 phút, xóa khi có bài mới), chỉ đọc 7 cột. Google thường phản hồi 3–20 giây, có lúc treo → app thử lại 3 lần (chờ 30/45/60 giây).

---

## 7. 🧑‍💻 QUY ƯỚC LẬP TRÌNH & KIỂM THỬ

- Không dùng framework UI (React, Tailwind…). JavaScript + CSS thuần.
- **Dữ liệu từ Google Sheets / AI chèn vào HTML phải qua `EduScores.escapeHtml` (`esc`)** — tên học sinh do người ngoài nhập, có thể chứa mã độc (đánh cắp API key / token).
- CSV: ô bắt đầu bằng `= + - @` được thêm `'` (chống chèn công thức Excel).
- Sửa `template_test.html` hoặc `google_apps_script.js` → chạy `python build.py` trong `robot-tao-de`.
- Chèn dữ liệu vào template: `JSON.stringify` + escape `<` + **hàm thay thế** trong `String.replace` (tránh lỗi với `"`, `$&`, `</script>`).
- Đổi CSS/JS → tăng `?v=` trong `<link>/<script>` để trình duyệt tải bản mới.
- Ngày giờ: dùng giờ máy, **không dùng `toISOString()`** (UTC lệch ngày trước 7 giờ sáng).
- **Trước khi commit:** chạy đủ 4 file test:
  ```
  node tests/test_scores.js
  node tests/test_apps_script.js
  node tests/test_parse_local.js
  node tests/test_difficulty.js
  ```
- Push bằng Git Credential Manager (đăng nhập qua trình duyệt). **Không để token trong địa chỉ remote.**

---

## 8. ⏳ LỊCH SỬ PHÁT TRIỂN (TỪ ĐẦU ĐẾN NAY)

### Giai đoạn 1 — Khởi tạo (15/08/2026) · `e4f8672`
- Dựng hệ sinh thái: trang chủ, **Robot Tạo Đề** (AI tạo đề qua OpenRouter/Groq, DeepSeek từ trang chủ), **Quản Lý Điểm** (bản React đã build sẵn, không kèm mã nguồn), mẫu đề thi HTML, Apps Script ghi/đọc điểm.
- **Hệ thống độ khó:** `calculateDifficultyQuota`, `normalizeDifficulty`, `balanceDifficultyQuota` (76 test); hiển thị số câu theo tỷ lệ real-time; prompt theo Nhận biết / Thông hiểu / Vận dụng.
- Sửa lỗi phân tách lớp (`;` → `,`).

### Giai đoạn 2 — Sửa lỗi & đồng bộ tin cậy (28/09/2026)
- `6691133` **Lỗi "AI không trả về đúng định dạng JSON":** viết lại bộ đọc JSON chịu lỗi (code fence chưa đóng, `\` sai, dấu phẩy thừa, output bị cắt → lấy từng câu hoàn chỉnh); giữ lệnh LaTeX; tăng `max_tokens`; sửa thông báo hiện `\n`.
- `a12c065` **Tạo bù câu thiếu:** yêu cầu 20 câu mà ra 15 → đếm câu thiếu từng dạng, gọi AI tạo bù (tối đa 3 lượt); chuẩn hóa `type`.
- `04b5fdc` **Đồng bộ Google Sheets tin cậy:** chỉ báo "Đã lưu" khi Google xác nhận; thử lại + lưu tạm + nút "Gửi lại điểm"; `submissionId`; Apps Script có LockService, ngày/điểm đúng kiểu; khôi phục file nguồn `template_test.html`.
- `aa3b846` **Lỗi không chọn được lớp trên điện thoại:** khởi tạo bằng `DOMContentLoaded` (không chờ font/icon); cảnh báo khi xem trước trong Zalo/iPhone; chèn dữ liệu an toàn khi xuất đề.
- `1057b5a`, `830ddb9` **Đưa đề Khảo sát Tin học 6, 7 lên GitHub Pages** để học sinh làm bài qua link (iPhone không mở được file .html).
- Chuyển remote GitHub sang đăng nhập bằng Git Credential Manager (token cũ trong URL đã hỏng).

### Giai đoạn 3 — Thống kê & ổn định (29/09/2026 sáng)
- `62cd6a3` **Sheet 500+ dòng lúc được lúc không:** thử lại, timeout, dùng dữ liệu lưu khi Google lỗi, bộ nhớ đệm trong Apps Script. **Xếp loại mới:** Tốt / Khá / Đạt / Chưa đạt / Đạt trở lên.
- `b804a0b` **Bảng "Thống kê xếp loại theo lớp"** (SL, %, Tổng cộng, lọc, CSV); mở app hiện ngay dữ liệu lưu, cập nhật ở nền.
- `ed54edb` **Chống nộp bài trùng** (527 → 385 bài): nguyên nhân là đề hủy yêu cầu sau 25 giây rồi gửi lại trong khi Google vẫn ghi; sắp xếp lớp tăng dần tự nhiên (6A1, 6A2, …, 6A10).

### Giai đoạn 4 — Nâng cấp toàn diện (29/09/2026) · `1f06477`
- **Bảo mật:** chống chèn mã khi hiển thị dữ liệu Sheet/AI; mã đọc dữ liệu cho Apps Script; chặn token trên bản web; chống chèn công thức CSV.
- **Apps Script v3:** tab theo năm học, `doGet?year=/action=info`, cache theo năm, `saoLuu`; `build.py` tự đồng bộ mã vào trang cài đặt.
- **`shared/scores.js`:** bộ xử lý điểm dùng chung.
- **Viết lại Quản Lý Điểm** bằng JavaScript thuần: năm học, điểm cao nhất / tất cả lần nộp, số lần làm, xếp hạng, biểu đồ, sao lưu CSV, nhớ nguồn dữ liệu.
- **Robot Tạo Đề:** lần kiểm tra 1–6, giới hạn số lần, cảnh báo trùng lần; danh sách học sinh theo lớp; xáo trộn câu hỏi; đăng đề GitHub + QR + gỡ đề; trang Xem kết quả theo năm học; AI dự phòng nhập key trong app; sửa bố cục cửa sổ.
- Bỏ chặn "chỉ nộp 1 lần" (thay bằng lấy điểm cao nhất + giới hạn số lần).

### Giai đoạn 5 — Sự cố & kiểm tra (30/09 – 01/10/2026)
- `83f9910` **Sự cố "mất dữ liệu"** (mục 9.1): tab năm học tạo ở cuối; `doPost` thiếu tên không ghi; thêm `kiemTraCaiDat`; lưu ý "chỉ Triển khai phiên bản mới mới có hiệu lực".
- `b9dc2ca` **Kiểm tra toàn bộ tính năng (không nâng cấp):** sửa lỗi đọc file mẫu Word (dòng tiêu đề "Phần 3 … "Gợi ý:" …" bị hiểu nhầm); sửa ngày trong tên file sao lưu; thêm `tests/test_parse_local.js`.
- Chốt: **bản dùng thử thi SKKN — đóng băng tính năng.**

### Giai đoạn 7 — Kho GitHub theo môn (05–06/10/2026)
- Theo yêu cầu của tác giả: tạo sẵn kho cho từng môn học (7 kho mới `kttx-*`, bật Pages; giữ 2 kho cũ), phần mềm **chọn kho theo môn + chỉ đặt tên đề**, đăng xong ra link + mã QR ngay. Đây là thay đổi tính năng theo yêu cầu trực tiếp của tác giả (ngoại lệ so với quyết định đóng băng).
- Thay cấu hình GitHub cũ (một kho + thư mục + nhánh) bằng **tài khoản + token + 9 kho theo môn**; thêm hộp thoại đăng đề; kiểm tra 9 kho khi lưu cấu hình.
- 06/10/2026: sửa lỗi "Lưu & kiểm tra" báo sai quyền ghi (token fine-grained luôn đọc được kho công khai → kiểm tra bằng yêu cầu ghi bỏ trống: 422 = có quyền, 403/404 = thiếu); token đúng cho 9 kho `kttx-…` (Contents: Read and write), **không** cấp quyền cho kho mã nguồn `tool_giao_duc`.
- 06/10/2026: thêm đăng **một hoặc nhiều đề đã tạo** từ "Đề của tôi" (xem mục 3.7); kiểm thử thật với 2 kho.

### Giai đoạn 6 — Hoàn thiện hồ sơ SKKN (01/10/2026) · `8ba053a`, `47c90b0`
- Viết lại `SO_TAY_DU_AN.md` đầy đủ; viết `KE_HOACH_VIET_DU_AN.md` (14 kế hoạch đã thực hiện, 12 quyết định thiết kế, bài học).
- **Báo cáo SKKN mới** `SKKN_TOOL_GIAO_DUC.docx` (18 trang): giữ nguyên hệ thống tiêu đề/tiểu mục và căn cứ pháp lý của bản `SKKN2027_Antigravity_HoanMy_ND30.docx`; thay nội dung bằng dự án hiện tại; **15 hình chụp từ phần mềm** + bảng số liệu thực tế (555 lượt gửi, 148 bài trùng bị loại, 407 lần làm hợp lệ, 282 lượt kiểm tra, ĐTB 7,79, Đạt trở lên 90,1%).
- **Ảnh minh chứng** chụp bằng Chrome headless với **dữ liệu mẫu** (tên học sinh hư cấu, phân bố điểm khớp số liệu thật) để bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). Bỏ khỏi báo cáo các nội dung bản cũ mô tả nhưng phần mềm không có (email phụ huynh, biểu đồ Radar, khóa bài khi chuyển tab).
- Tác giả chủ động xóa 4 file Word SKKN cũ (vẫn còn trong lịch sử Git).
- Xác nhận cách chọn tên theo lớp đã có sẵn; không thay đổi tính năng (đóng băng).

---

## 9. 🚑 SỰ CỐ ĐÃ GẶP & CÁCH XỬ LÝ

### 9.1. "Chạy Apps Script mới thì mất hết dữ liệu" (01/10/2026)
- **Hiện tượng:** Google Sheet mở ra tab trống; Quản Lý Điểm báo 0 bài nộp.
- **Nguyên nhân:** dán mã v3 rồi bấm **Chạy** (`doPost`) → tạo tab "2026-2027" ở đầu; URL vẫn chạy **bản cũ** (đọc tab đầu tiên) → thấy trống. **Dữ liệu không mất**, vẫn ở tab "Trang tính1".
- **Xử lý:** kéo tab "Trang tính1" về đầu; triển khai đúng cách (mục 3.2). Nếu thật sự mất: **Tệp › Lịch sử phiên bản › Khôi phục**.

### 9.2. Bảng tổng hợp
| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| "AI không trả về đúng định dạng JSON" | AI trả JSON lỗi / bị cắt | Đã sửa (bộ đọc chịu lỗi); nếu vẫn lỗi: giảm số câu hoặc thử lại |
| Đề thiếu câu so với yêu cầu | AI đếm sai / bị cắt | Đã có tạo bù tự động; kiểm tra "Cấu trúc đề" (tổng số câu) |
| Không chọn được lớp trên điện thoại | Mở trong khung xem trước (Zalo, iPhone) | Mở bằng trình duyệt; dùng **link** thay vì file |
| Link GitHub báo 404 | Chưa push / Pages chưa cập nhật | Chờ 1–2 phút, nhấn Ctrl+F5 |
| Tải điểm lúc được lúc không | Google Apps Script chậm/treo | App tự thử lại, hiện dữ liệu lưu; bấm Làm mới sau ít phút |
| Một bài bị tính nhiều lần | Đề cũ gửi lại khi Google chậm | Đã chặn (đề, Apps Script, thống kê); chạy `xoaBaiNopTrung` |
| "Sai mã đọc dữ liệu" | Mã trong app khác READ_KEY trong Apps Script | Nhập đúng mã, hoặc sao chép lại mã Apps Script và triển khai |
| App báo "Apps Script CŨ" | Chưa triển khai phiên bản mới | Làm đúng mục 3.2 |
| Tab mới trống ở đầu Sheet | Bấm "Chạy" hàm `doPost` | Không bấm Chạy doPost; dùng `kiemTraCaiDat` |
| Đọc đề Word sai dạng câu | Dòng tiêu đề chứa từ khóa | Đã sửa (01/10/2026) |
| Tạo đề bằng AI báo lỗi / không ra đề | DeepSeek hết tiền | Dùng Đề của tôi › Tải HTML, tạo từ tài liệu, hoặc nhập key Groq miễn phí (mục 3.3) |
| Học sinh vẫn phải tự gõ tên | Lớp chưa có danh sách, tên lớp không khớp, hoặc dùng đề xuất cũ | Nhập danh sách ở Quản lý lớp học; ghi "Lớp áp dụng" đúng tên lớp; xuất lại đề (mục 3.4) |

---

## 10. 📌 TRẠNG THÁI HIỆN TẠI & VIỆC CẦN LÀM (01/10/2026)

- **Mã nguồn:** đã push đến `47c90b0`. Toàn bộ test đạt: 26 · 24 · 4 · 76.
- **Hồ sơ SKKN:** `SKKN_TOOL_GIAO_DUC.docx` + `SKKN_anh_minh_chung/` + `KE_HOACH_VIET_DU_AN.md` đã hoàn thành và đưa lên GitHub. **Kho đang công khai** — ảnh/báo cáo chỉ chứa dữ liệu mẫu, nhưng cân nhắc trước khi chia sẻ rộng.
- **DeepSeek hết tiền** (tác giả chưa soạn đề mới) → chưa kiểm tra thực tế phần tạo đề bằng AI và chưa xuất đề mới có danh sách học sinh.
- **Apps Script:** giáo viên đã triển khai v3 và kiểm tra kết nối. URL cũ `…AKfycbywuNpk…` **vẫn chạy bản cũ** (không đòi mã) — có thể v3 đã được triển khai thành URL mới. Các đề đã phát (kể cả `de-thi/`) vẫn gửi điểm về URL cũ: **điểm không mất** nhưng URL cũ **chưa được bảo vệ**.
- **Google Sheet** "ROBOT LUU DIEM" thuộc tài khoản Google "L" (không phải `truongthaihoavt2010@gmail.com`).

**Việc giáo viên cần làm:**
- [ ] Cập nhật **lần triển khai cũ** lên v3: Quản lý các lần triển khai › chọn lần triển khai cũ › Sửa › Phiên bản mới.
- [ ] Chạy `saoLuu`, rồi `xoaBaiNopTrung`.
- [ ] Nạp tiền DeepSeek (hoặc nhập key Groq miễn phí) để tạo đề bằng AI.
- [ ] Nhập danh sách học sinh các lớp, rồi **xuất lại** đề (Khảo sát Tin 6, 7 đang là bản chưa có danh sách chọn tên).
- [ ] Rà soát SKKN trước khi nộp: tên trường/đơn vị, bảng so sánh thời gian (là ước tính), số liệu mới nhất từ Quản Lý Điểm (mục 4.1.3).
- [ ] Tạo **một token** fine-grained cho 9 kho `kttx-…` (Contents: Read and write) và dán vào trang Google Sheets › Đăng đề lên GitHub (mục 3.7).
- [ ] Kiểm tra token GitHub cũ (`ghp_…`) đã bị thu hồi.
- [ ] Đổi mật khẩu admin đang lưu dạng chữ trong Sheet `HOSOHS20262027` (tab TaiKhoan) — không thuộc dự án này nhưng đã phát hiện.

**Chưa kiểm tra thực tế:** tạo đề bằng AI (DeepSeek hết tiền), AI dự phòng Groq/OpenRouter với key thật, đăng đề GitHub thật, làm bài trên iPhone thật.
**Lỗi cũ vô hại, chưa sửa:** `hideLoading is not defined` ở trang chủ khi vừa mở (không ảnh hưởng người dùng).

---

## 11. 🚀 ĐỊNH HƯỚNG BẢN PRO (NĂM HỌC SAU — CHƯA LÀM)
- **Agent tự động ra đề & kiểm thử:** tự sinh đề theo ma trận, tự kiểm tra đáp án/độ khó, tự đăng và thu kết quả.
- **Chấm điểm phía Apps Script** để giấu đáp án khỏi file đề (bài kiểm tra quan trọng).
- **Phân tích từng câu hỏi:** câu sai nhiều, đáp án nhiễu (đề cần gửi kèm lựa chọn của học sinh).
- **Xuất điểm theo mẫu sổ điểm điện tử** (vnEdu / SMAS).
- Flashcard ôn tập; bài tập cá nhân hóa theo phổ điểm.
- Cập nhật hồ sơ SKKN (số liệu mới, thêm minh chứng từ bài kiểm tra thật) khi nâng lên bản Pro.
