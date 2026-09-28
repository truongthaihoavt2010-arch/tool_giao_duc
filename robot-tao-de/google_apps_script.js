/**
 * ROBOT TẠO ĐỀ TRẮC NGHIỆM - GOOGLE APPS SCRIPT
 * (Mã này giống hệt đoạn mã trong trang "Google Sheets" của phần mềm)
 *
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở Google Sheets mới.
 * 2. Vào menu "Tiện ích mở rộng" (Extensions) > "Apps Script".
 * 3. Xóa nội dung cũ, dán toàn bộ đoạn mã này vào, bấm Lưu.
 * 4. Bấm "Triển khai" (Deploy) > "Tùy chọn triển khai mới" > Loại: "Ứng dụng web".
 * 5. Thực thi với tư cách: "Tôi"; Quyền truy cập: "Bất kỳ ai" (Anyone).
 * 6. Copy "URL Ứng dụng Web" và dán vào trang "Google Sheets" của phần mềm.
 * KHI CẬP NHẬT MÃ: Triển khai > Quản lý các lần triển khai > Sửa > Phiên bản mới
 * (giữ nguyên URL cũ).
 */

var HEADERS = ["STT", "HỌ TÊN", "MÔN", "HÌNH THỨC KT", "LỚP", "THỜI GIAN NỘP", "ĐIỂM SỐ", "MÃ BÀI NỘP"];
var TZ = "GMT+7";

// Luôn ghi vào tab đầu tiên, không phụ thuộc tab đang mở
function getDataSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Chặn chèn công thức (tên bắt đầu bằng =, +, -, @)
function safeText_(v) {
  var s = String(v == null ? "" : v).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Xếp hàng khi nhiều học sinh nộp cùng lúc
  } catch (err) {
    return jsonOut_({ status: "error", message: "Máy chủ đang bận, vui lòng thử lại." });
  }
  try {
    var sheet = getDataSheet_();
    var data = (e && e.parameter) || {};
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    } else if (sheet.getRange(1, 8).getValue() === "") {
      sheet.getRange(1, 8).setValue(HEADERS[7]); // Bảng tính tạo từ phiên bản cũ
    }

    // Chống ghi trùng khi đề thi gửi lại cùng một bài nộp
    var submissionId = safeText_(data.submissionId);
    if (submissionId && sheet.getLastRow() > 1) {
      var found = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1)
                       .createTextFinder(submissionId).matchEntireCell(true).findNext();
      if (found) return jsonOut_({ status: "success", duplicate: true });
    }

    var stt = sheet.getLastRow(); // Dòng 1 là tiêu đề nên STT = số dòng hiện có
    var score = parseFloat(String(data.score).replace(",", "."));
    sheet.appendRow([
      stt,
      safeText_(data.name),
      safeText_(data.subject),
      safeText_(data.examTime) + " Phút",
      safeText_(data.className),
      new Date(),
      isNaN(score) ? safeText_(data.score) : score,
      submissionId
    ]);
    var row = sheet.getLastRow();
    sheet.getRange(row, 6).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    sheet.getRange(row, 7).setNumberFormat("0.00");
    SpreadsheetApp.flush();
    return jsonOut_({ status: "success", stt: stt });
  } catch (err) {
    return jsonOut_({ status: "error", message: err.message });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var sheet = getDataSheet_();
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i].join("") === "") continue;
    var d = data[i][5];
    result.push({
      stt: data[i][0],
      name: data[i][1],
      subject: data[i][2],
      examTime: data[i][3],
      className: data[i][4],
      date: d instanceof Date ? Utilities.formatDate(d, TZ, "dd/MM/yyyy HH:mm:ss") : String(d),
      score: typeof data[i][6] === "number" ? data[i][6] : parseFloat(String(data[i][6]).replace(",", ".")) || 0
    });
  }
  return jsonOut_(result);
}
