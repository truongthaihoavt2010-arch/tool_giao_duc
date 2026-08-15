/**
 * ROBOT TẠO ĐỀ TRẮC NGHIỆM - GOOGLE APPS SCRIPT
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở Google Sheets mới.
 * 2. Vào menu "Tiện ích mở rộng" (Extensions) > "Apps Script".
 * 3. Xóa nội dung cũ, dán toàn bộ đoạn mã này vào.
 * 4. Bấm Lưu (biểu tượng đĩa mềm).
 * 5. Bấm "Triển khai" (Deploy) > "Tùy chọn triển khai mới" (New deployment).
 * 6. Loại: "Ứng dụng web" (Web app).
 * 7. Thiết lập Quyền truy cập: "Bất kỳ ai" (Anyone).
 * 8. Bấm "Triển khai" và cấp quyền truy cập bằng tài khoản Google.
 * 9. Copy "URL Ứng dụng Web" và dán vào phần xuất đề HTML trên phần mềm.
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Nếu bảng tính trống, tạo tiêu đề các cột
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Thời Gian Nộp", 
        "Họ Tên", 
        "Mã Số HS", 
        "Điểm (Hệ 10)", 
        "Số Câu Đúng", 
        "Tổng Số Câu", 
        "Thời Gian Làm Bài (giây)", 
        "Số Lần Chuyển Tab (Cảnh báo gian lận)"
      ]);
      sheet.getRange("A1:H1").setFontWeight("bold").setBackground("#d1e7dd");
    }

    // Parse dữ liệu từ ứng dụng Web gửi lên
    const payload = JSON.parse(e.postData.contents);
    
    // Thêm dữ liệu vào dòng mới
    sheet.appendRow([
      payload.timestamp,
      payload.studentName,
      payload.studentId,
      payload.score,
      payload.correctAnswers,
      payload.totalQuestions,
      payload.timeSpent,
      payload.cheatCount
    ]);

    // Trả về JSON cho Client biết đã lưu thành công
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
