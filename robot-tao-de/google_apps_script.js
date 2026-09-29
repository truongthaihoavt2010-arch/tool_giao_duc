/**
 * ROBOT TẠO ĐỀ TRẮC NGHIỆM - GOOGLE APPS SCRIPT (phiên bản 3)
 * Copy mã này từ trang "Google Sheets" của phần mềm Robot Tạo Đề: ở đó MÃ ĐỌC DỮ LIỆU
 * đã được điền sẵn cho bạn.
 *
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở Google Sheets. Vào menu "Tiện ích mở rộng" > "Apps Script".
 * 2. Xóa nội dung cũ, dán toàn bộ đoạn mã này vào, bấm Lưu.
 * 3. Lần đầu: "Triển khai" > "Tùy chọn triển khai mới" > Loại: "Ứng dụng web";
 *    Thực thi với tư cách: "Tôi"; Quyền truy cập: "Bất kỳ ai".
 * 4. Copy "URL Ứng dụng Web" và dán vào trang "Google Sheets" của phần mềm.
 * KHI CẬP NHẬT MÃ: Triển khai > Quản lý các lần triển khai > Sửa (bút chì) > Phiên bản mới
 * > Triển khai (giữ nguyên URL cũ).
 *
 * DỮ LIỆU: mỗi năm học một tab ("2026-2027"...), tự tạo khi có bài nộp đầu tiên của năm học.
 * Tab cũ (ví dụ "Trang tính1") được giữ nguyên và vẫn được đọc theo ngày nộp.
 */

var READ_KEY = ""; // MÃ ĐỌC DỮ LIỆU — chỉ ai có mã này mới xem được điểm (để trống = ai cũng xem được)
var SCRIPT_VERSION = 3;

var HEADERS = ["STT", "HỌ TÊN", "MÔN", "HÌNH THỨC KT", "LỚP", "THỜI GIAN NỘP", "ĐIỂM SỐ", "MÃ BÀI NỘP"];
var TZ = "GMT+7";
var DUP_WINDOW_MS = 2 * 60 * 1000; // Bài giống hệt nộp lại trong 2 phút = bài trùng
var YEAR_TAB = /^\d{4}-\d{4}$/;

// ================= TIỆN ÍCH =================
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Chặn chèn công thức (tên bắt đầu bằng =, +, -, @)
function safeText_(v) {
  var s = String(v == null ? "" : v).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function norm_(v) { return String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, " "); }

// Năm học của một thời điểm: từ tháng 9 là năm học mới
function schoolYearOf_(d) {
  var y = d.getFullYear();
  return d.getMonth() >= 8 ? y + "-" + (y + 1) : (y - 1) + "-" + y;
}

// Chuẩn hóa hình thức: "15 Phút - Lần 1" (+ " - Tối đa 5 lần")
function hinhThuc_(data) {
  var raw = String(data.examTime == null ? "" : data.examTime);
  var minutes = parseInt(data.minutes, 10);
  var round = parseInt(data.round, 10);
  var limit = parseInt(data.limit, 10);
  var m;
  if (isNaN(minutes) && (m = raw.match(/(\d+)\s*(phút)?\s*$/i))) minutes = parseInt(m[1], 10);
  if (isNaN(round) && (m = raw.match(/lần\s*(\d+)/i))) round = parseInt(m[1], 10);
  if (isNaN(limit) && (m = raw.match(/tối\s*đa\s*(\d+)/i))) limit = parseInt(m[1], 10);
  if (isNaN(minutes)) return safeText_(raw) + " Phút"; // Không nhận ra: giữ như cũ
  var s = minutes + " Phút - Lần " + (isNaN(round) ? 1 : round);
  if (limit > 0) s += " - Tối đa " + limit + " lần";
  return s;
}

// Khóa so sánh bài trùng
function dupKey_(name, className, subject, examTime, score) {
  var s = parseFloat(String(score).replace(",", "."));
  return [norm_(name), norm_(className), norm_(subject), norm_(examTime), isNaN(s) ? norm_(score) : s.toFixed(2)].join("|");
}

// Tab dữ liệu của năm học (tự tạo nếu chưa có)
function getYearSheet_(year) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    sheet = ss.insertSheet(year, 0);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#d1e7dd");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Các tab chứa dữ liệu: tab năm học + tab cũ có tiêu đề "HỌ TÊN" ở cột B
function dataSheets_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function (s) {
    if (YEAR_TAB.test(s.getName())) return true;
    return s.getLastRow() >= 1 && norm_(s.getRange(1, 2).getValue()) === "họ tên";
  });
}

// ================= GHI ĐIỂM (học sinh nộp bài) =================
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Xếp hàng khi nhiều học sinh nộp cùng lúc
  } catch (err) {
    return jsonOut_({ status: "error", message: "Máy chủ đang bận, vui lòng thử lại." });
  }
  try {
    var data = (e && e.parameter) || {};
    var now = new Date();
    var sheet = getYearSheet_(schoolYearOf_(now));
    var last = sheet.getLastRow();

    // Chống ghi trùng khi đề thi gửi lại cùng một bài nộp
    var submissionId = safeText_(data.submissionId);
    if (submissionId && last > 1) {
      var found = sheet.getRange(2, 8, last - 1, 1)
                       .createTextFinder(submissionId).matchEntireCell(true).findNext();
      if (found) return jsonOut_({ status: "success", duplicate: true });
    }

    var examTime = hinhThuc_(data);
    var score = parseFloat(String(data.score).replace(",", "."));

    // Chống trùng theo nội dung (đề cũ không có mã bài nộp): giống hệt, cách nhau dưới 2 phút
    var newKey = dupKey_(safeText_(data.name), safeText_(data.className), safeText_(data.subject), examTime, isNaN(score) ? data.score : score);
    if (last > 1) {
      var n = Math.min(100, last - 1);
      var recent = sheet.getRange(last - n + 1, 1, n, 7).getValues();
      for (var r = recent.length - 1; r >= 0; r--) {
        var t = recent[r][5] instanceof Date ? recent[r][5].getTime() : 0;
        if (t && now.getTime() - t < DUP_WINDOW_MS &&
            dupKey_(recent[r][1], recent[r][4], recent[r][2], recent[r][3], recent[r][6]) === newKey) {
          return jsonOut_({ status: "success", duplicate: true });
        }
      }
    }

    var stt = Math.max(1, last); // Dòng 1 là tiêu đề
    sheet.appendRow([
      stt,
      safeText_(data.name),
      safeText_(data.subject),
      examTime,
      safeText_(data.className),
      now,
      isNaN(score) ? safeText_(data.score) : score,
      submissionId
    ]);
    var row = sheet.getLastRow();
    sheet.getRange(row, 6).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    sheet.getRange(row, 7).setNumberFormat("0.00");
    SpreadsheetApp.flush();
    clearCache_(); // Có bài nộp mới: lần tải dữ liệu sau đọc lại từ Sheet
    return jsonOut_({ status: "success", stt: stt });
  } catch (err) {
    return jsonOut_({ status: "error", message: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ================= ĐỌC ĐIỂM (giáo viên) =================
// ?key=MÃ_ĐỌC&year=2026-2027 (mặc định năm học hiện tại; year=all: tất cả)
// ?key=MÃ_ĐỌC&action=info  -> phiên bản script + danh sách năm học
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (READ_KEY && p.key !== READ_KEY) {
    return jsonOut_({ status: "error", code: "unauthorized", message: "Sai mã đọc dữ liệu." });
  }
  if (p.action === "info") {
    return jsonOut_({ status: "success", version: SCRIPT_VERSION, years: listYears_(), protected: !!READ_KEY });
  }
  var year = p.year || schoolYearOf_(new Date());
  var cached = readCache_(year);
  if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  var json = JSON.stringify(readRows_(year));
  writeCache_(year, json);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function listYears_() {
  var set = {};
  set[schoolYearOf_(new Date())] = true;
  dataSheets_().forEach(function (s) {
    if (YEAR_TAB.test(s.getName())) { set[s.getName()] = true; return; }
    var last = s.getLastRow();
    if (last < 2) return;
    s.getRange(2, 6, last - 1, 1).getValues().forEach(function (r) {
      if (r[0] instanceof Date) set[schoolYearOf_(r[0])] = true;
    });
  });
  return Object.keys(set).sort().reverse();
}

function readRows_(year) {
  var result = [];
  dataSheets_().forEach(function (sheet) {
    var isYearTab = YEAR_TAB.test(sheet.getName());
    if (isYearTab && year !== "all" && sheet.getName() !== year) return;
    var last = sheet.getLastRow();
    if (last < 2) return;
    var data = sheet.getRange(2, 1, last - 1, 7).getValues(); // Chỉ đọc 7 cột cần dùng
    for (var i = 0; i < data.length; i++) {
      if (data[i].join("") === "") continue;
      var d = data[i][5];
      var rowYear = isYearTab ? sheet.getName() : (d instanceof Date ? schoolYearOf_(d) : "");
      if (year !== "all" && rowYear !== year) continue;
      result.push({
        stt: data[i][0],
        name: data[i][1],
        subject: data[i][2],
        examTime: data[i][3],
        className: data[i][4],
        date: d instanceof Date ? Utilities.formatDate(d, TZ, "dd/MM/yyyy HH:mm:ss") : String(d),
        score: typeof data[i][6] === "number" ? data[i][6] : parseFloat(String(data[i][6]).replace(",", ".")),
        year: rowYear
      });
    }
  });
  return result;
}

// ================= BỘ NHỚ ĐỆM (trả dữ liệu nhanh) =================
var CACHE_SECONDS = 300;   // Tự làm mới sau 5 phút (hoặc ngay khi có bài nộp mới)
var CHUNK_SIZE = 30000;    // CacheService giới hạn 100KB mỗi khóa (chữ có dấu tới 3 byte/ký tự)

function cachePrefix_(year) { return "doGet_v3_" + year + "_"; }

function readCache_(year) {
  try {
    var cache = CacheService.getScriptCache();
    var pre = cachePrefix_(year);
    var n = parseInt(cache.get(pre + "n"), 10);
    if (!n) return null;
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(pre + i);
    var parts = cache.getAll(keys);
    var out = "";
    for (var j = 0; j < n; j++) {
      if (parts[keys[j]] == null) return null;
      out += parts[keys[j]];
    }
    return out;
  } catch (err) { return null; }
}

function writeCache_(year, json) {
  try {
    var pre = cachePrefix_(year);
    var obj = {};
    var n = Math.ceil(json.length / CHUNK_SIZE);
    for (var i = 0; i < n; i++) obj[pre + i] = json.substr(i * CHUNK_SIZE, CHUNK_SIZE);
    obj[pre + "n"] = String(n);
    CacheService.getScriptCache().putAll(obj, CACHE_SECONDS);
  } catch (err) {} // Dữ liệu quá lớn để lưu đệm: vẫn trả dữ liệu bình thường
}

function clearCache_() {
  try {
    CacheService.getScriptCache().removeAll([cachePrefix_(schoolYearOf_(new Date())) + "n", cachePrefix_("all") + "n"]);
  } catch (err) {}
}

// ================= CÔNG CỤ CHẠY TAY (chọn tên hàm rồi bấm "Chạy") =================

/**
 * DỌN BÀI NỘP TRÙNG: xóa các dòng giống hệt dòng trước (cùng tên, lớp, môn, hình thức, điểm)
 * nộp cách nhau dưới 2 phút, giữ lần nộp đầu. NÊN chạy "saoLuu" trước.
 */
function xoaBaiNopTrung() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var total = 0;
  try {
    dataSheets_().forEach(function (sheet) {
      var last = sheet.getLastRow();
      if (last < 3) return;
      var data = sheet.getRange(2, 1, last - 1, 7).getValues();
      var lastSeen = {};
      var toDelete = [];
      for (var i = 0; i < data.length; i++) {
        var t = data[i][5] instanceof Date ? data[i][5].getTime() : NaN;
        var key = dupKey_(data[i][1], data[i][4], data[i][2], data[i][3], data[i][6]);
        if (!isNaN(t) && lastSeen[key] !== undefined && t - lastSeen[key] >= 0 && t - lastSeen[key] < DUP_WINDOW_MS) {
          toDelete.push(i + 2);
        } else if (!isNaN(t)) {
          lastSeen[key] = t;
        }
      }
      for (var j = toDelete.length - 1; j >= 0; j--) sheet.deleteRow(toDelete[j]);
      total += toDelete.length;
    });
    CacheService.getScriptCache().removeAll(listYears_().concat(["all"]).map(function (y) { return cachePrefix_(y) + "n"; }));
    Logger.log("Đã xóa " + total + " bài nộp trùng.");
  } finally {
    lock.releaseLock();
  }
}

/**
 * SAO LƯU: tạo bản sao toàn bộ Google Sheet trong Google Drive của bạn.
 * Lần đầu chạy Google sẽ hỏi cấp quyền — bấm "Cho phép".
 */
function saoLuu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var copy = ss.copy("Sao lưu - " + ss.getName() + " - " + Utilities.formatDate(new Date(), TZ, "dd-MM-yyyy HH'h'mm"));
  Logger.log("Đã sao lưu: " + copy.getUrl());
}
