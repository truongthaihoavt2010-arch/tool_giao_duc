# 🎓 TOOL GIÁO DỤC

**Hệ sinh thái Công cụ Giáo dục AI** - Tích hợp Robot Tạo Đề và Quản Lý Điểm.

## ✨ Tính năng

### 🤖 Robot Tạo Đề (AI)
- Tạo đề kiểm tra trắc nghiệm tự động bằng AI (DeepSeek, OpenRouter, Groq)
- Nhập dữ liệu từ PDF, Word, TXT
- Ngân hàng câu hỏi & lịch sử đề
- Xuất bài thi HTML cho học sinh
- Tự động chuyển đổi giữa các nhà cung cấp AI khi nghẽn mạng (Smart Fallback)

### 📊 Quản Lý Điểm (EduScore)
- Dashboard quản lý điểm học sinh chuyên nghiệp
- Đồng bộ điểm từ Google Sheets
- Biểu đồ thống kê theo lớp / môn
- Quản lý nhiều lớp học cùng lúc
- Xuất dữ liệu CSV, phân tích kết quả

## 🚀 Cách sử dụng

### Cách 1: Chạy trực tiếp (không cần cài đặt)
1. Tải toàn bộ mã nguồn về máy
2. Mở file `index.html` bằng trình duyệt (Chrome/Edge/Firefox)
3. Hoặc chạy file `MO_TOOL_GIAO_DUC.bat` để mở dạng App (không có thanh địa chỉ)

### Cách 2: Chạy từ GitHub Pages
Truy cập: `https://<username>.github.io/tool_giao_duc/`

### Cách 3: Cài đặt PWA
- Mở ứng dụng trên trình duyệt
- Chọn "Cài đặt ứng dụng" (Install App) từ menu trình duyệt

## ⚙️ Cấu hình AI

### DeepSeek (Khuyến nghị)
1. Đăng ký API Key tại [platform.deepseek.com](https://platform.deepseek.com)
2. Trên trang chủ, nhập API Key vào ô "Cấu hình DeepSeek AI"
3. Bấm "Kết nối" - Key sẽ được lưu trong trình duyệt

### OpenRouter / Groq (Tùy chọn)
Mở file `robot-tao-de/app.js` và nhập API Key của bạn:
```javascript
const OPENROUTER_API_KEY = 'your-openrouter-key';
const GROQ_API_KEY = 'your-groq-key';
```

## 📁 Cấu trúc dự án

```
tool_giao_duc/
├── index.html              # Cổng điều hướng chính
├── manifest.json           # PWA manifest
├── MO_TOOL_GIAO_DUC.bat    # Script mở dạng App
├── robot-tao-de/           # Robot Tạo Đề (AI)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── template_data.js
│   └── google_apps_script.js
├── quan-ly-diem/           # Quản Lý Điểm (EduScore)
│   ├── index.html
│   └── icons.svg
├── tao_sang_kien.py        # Script tạo báo cáo sáng kiến
├── tao_hdsd.py             # Script tạo hướng dẫn sử dụng
└── *.docx                  # Tài liệu báo cáo
```

## 🔗 Kết nối Google Sheets

1. Mở Google Sheets mới
2. Vào menu "Tiện ích mở rộng" > "Apps Script"
3. Dán nội dung `robot-tao-de/google_apps_script.js`
4. Triển khai dạng "Ứng dụng web" (Web app)
5. Copy URL và dán vào phần "Google Sheets" trong Robot Tạo Đề

## 👤 Tác giả

**Trương Thái Hòa** - Giáo viên Tin học
- ☎ 0773813913

## 📄 Giấy phép

Dự án phục vụ cộng đồng giáo viên - **Miễn phí 100%**.
