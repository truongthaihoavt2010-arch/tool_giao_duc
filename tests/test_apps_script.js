/**
 * Test Apps Script (robot-tao-de/google_apps_script.js) với Google Sheets giả lập.
 * Chạy: node tests/test_apps_script.js
 */
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../robot-tao-de/google_apps_script.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     nhận: ${JSON.stringify(actual)}\n     cần:  ${JSON.stringify(expected)}`}`);
}

// ---------- Google Sheets giả lập ----------
function makeSheet(name, rows) {
    return {
        rows, name,
        getName() { return this.name; },
        getLastRow() { return this.rows.length; },
        appendRow(r) { this.rows.push(r.slice()); },
        deleteRow(n) { this.rows.splice(n - 1, 1); },
        setFrozenRows() {},
        getRange(r, c, nr = 1, nc = 1) {
            const sh = this;
            return {
                getValue: () => (sh.rows[r - 1] || [])[c - 1] ?? '',
                setValue: v => { sh.rows[r - 1][c - 1] = v; },
                setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
                getValues: () => sh.rows.slice(r - 1, r - 1 + nr).map(x => { const y = x.slice(c - 1, c - 1 + nc); while (y.length < nc) y.push(''); return y; }),
                createTextFinder: txt => ({ matchEntireCell: () => ({ findNext: () => sh.rows.slice(r - 1, r - 1 + nr).some(x => String(x[c - 1]) === txt) ? {} : null }) }),
            };
        },
    };
}

function load(readKey, sheets, nowMs) {
    const RealDate = Date;
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(nowMs); }
        static now() { return nowMs; }
        static [Symbol.hasInstance](x) { return x instanceof RealDate; } // ngày tạo ngoài script vẫn là Date
    }
    const ss = {
        sheets,
        getSheets() { return this.sheets; },
        getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
        insertSheet(n, i) { const s = makeSheet(n, []); this.sheets.splice(i, 0, s); return s; },
        getName() { return 'ROBOT LUU DIEM'; },
        copy(n) { return { getUrl: () => 'https://docs.google.com/copy/' + encodeURIComponent(n) }; },
    };
    const store = {};
    const logs = [];
    const ctx = {
        Date: FakeDate,
        SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
        Utilities: { formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; } },
        CacheService: { getScriptCache: () => ({
            get: k => store[k] ?? null,
            getAll: ks => Object.fromEntries(ks.filter(k => k in store).map(k => [k, store[k]])),
            putAll: o => Object.assign(store, o),
            removeAll: ks => ks.forEach(k => delete store[k]),
        }) },
        Logger: { log: m => logs.push(m) },
    };
    const code = SRC.replace('var READ_KEY = "";', `var READ_KEY = ${JSON.stringify(readKey)};`);
    const api = new Function(...Object.keys(ctx), code + '; return {doPost, doGet, xoaBaiNopTrung, saoLuu, kiemTraCaiDat};')(...Object.values(ctx));
    return { api, ss, logs };
}

const HEAD7 = ["STT", "HỌ TÊN", "MÔN", "HÌNH THỨC KT", "LỚP", "THỜI GIAN NỘP", "ĐIỂM SỐ"];
const NOW = new Date(2026, 8, 29, 9, 0, 0).getTime(); // 29/09/2026

// Tab cũ: có dữ liệu năm học trước (tháng 6) và năm nay (tháng 9)
const legacy = makeSheet('Trang tính1', [HEAD7,
    [1, 'HÒA', 'Tin học', '45 Phút', '7A1', new Date(2026, 5, 19, 15, 29), '10.00'],
    [2, 'LAN', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 28, 14, 21), 6.67],
]);
let { api, ss } = load('ma-bi-mat', [legacy, makeSheet('Ghi chú', [['Ghi chú của giáo viên']])], NOW);
const get = p => JSON.parse(api.doGet({ parameter: p }).t);
const post = p => JSON.parse(api.doPost({ parameter: p }).t);

// ---------- Mã đọc dữ liệu ----------
check('Không có mã -> từ chối', get({}).code, 'unauthorized');
check('Sai mã -> từ chối', get({ key: 'sai' }).code, 'unauthorized');
check('Đúng mã -> đọc được năm học hiện tại', get({ key: 'ma-bi-mat' }).map(r => r.name), ['LAN']);
check('Đọc năm học trước', get({ key: 'ma-bi-mat', year: '2025-2026' }).map(r => r.name), ['HÒA']);
check('Thông tin script', get({ key: 'ma-bi-mat', action: 'info' }), { status: 'success', version: 3, years: ['2026-2027', '2025-2026'], protected: true });

// ---------- Ghi điểm vào tab năm học ----------
check('Đề cũ (examTime=15)', post({ name: 'An', className: '6A1', subject: 'Tin học', examTime: '15', score: '7.50' }).status, 'success');
check('Tự tạo tab 2026-2027 ở CUỐI (tab cũ giữ vị trí đầu)', ss.getSheets().map(s => s.name), ['Trang tính1', 'Ghi chú', '2026-2027']);
check('Hình thức đề cũ -> "15 Phút - Lần 1"', ss.getSheetByName('2026-2027').rows[1][3], '15 Phút - Lần 1');
post({ name: 'Bình', className: '6A1', subject: 'Tin học', examTime: 'Lần 2 - Tối đa 5 lần - 15', score: '8', submissionId: 'x1' });
check('Hình thức đề mới có giới hạn', ss.getSheetByName('2026-2027').rows[2][3], '15 Phút - Lần 2 - Tối đa 5 lần');
post({ name: 'Chi', className: '6A2', subject: 'Tin học', examTime: '45', round: '3', minutes: '45', score: '9' });
check('Tham số riêng minutes/round', ss.getSheetByName('2026-2027').rows[3][3], '45 Phút - Lần 3');
check('Gửi lại cùng mã bài nộp -> không ghi', post({ name: 'Bình', className: '6A1', subject: 'Tin học', examTime: 'Lần 2 - Tối đa 5 lần - 15', score: '8', submissionId: 'x1' }).duplicate, true);
check('Gửi lại giống hệt (không mã) -> không ghi', post({ name: 'An', className: '6A1', subject: 'Tin học', examTime: '15', score: '7.50' }).duplicate, true);
check('Làm lại khác điểm -> ghi', post({ name: 'An', className: '6A1', subject: 'Tin học', examTime: '15', score: '9' }).stt, 4);
check('Chặn chèn công thức', (post({ name: '=HYPERLINK("x")', className: '6A1', subject: 'Tin học', examTime: '15', score: 1 }), ss.getSheetByName('2026-2027').rows[5][1]), "'=HYPERLINK(\"x\")");

const cur = get({ key: 'ma-bi-mat' });
check('Đọc năm nay = tab năm học + dòng tháng 9 của tab cũ', cur.map(r => r.name).sort(), ["'=HYPERLINK(\"x\")", 'An', 'An', 'Bình', 'Chi', 'LAN']);
check('Điểm trả về dạng số, có năm học', [typeof cur[0].score, cur[0].year], ['number', '2026-2027']);
check('Đọc tất cả năm', get({ key: 'ma-bi-mat', year: 'all' }).length, 7);

// ---------- Bộ nhớ đệm ----------
const before = get({ key: 'ma-bi-mat' }).length;
ss.getSheetByName('2026-2027').rows.push([9, 'Sửa tay', 'Tin học', '15 Phút - Lần 1', '6A1', new Date(NOW), 5]);
check('Lần đọc sau trả từ bộ nhớ đệm', get({ key: 'ma-bi-mat' }).length, before);
post({ name: 'Dũng', className: '6A1', subject: 'Tin học', examTime: '15', score: 6 });
check('Bài nộp mới xóa bộ nhớ đệm', get({ key: 'ma-bi-mat' }).length, before + 2);

// ---------- Bấm "Chạy" trong trình soạn thảo ----------
{
    const lg = makeSheet('Trang tính1', [HEAD7, [1, 'A', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 28), 7]]);
    const t = load('k', [lg], NOW);
    const r = JSON.parse(t.api.doPost(undefined).t);
    check('Chạy doPost không có dữ liệu -> không ghi, không tạo tab', [r.status, t.ss.getSheets().map(s => s.name), lg.rows.length], ['error', ['Trang tính1'], 2]);
    t.api.kiemTraCaiDat();
    check('kiemTraCaiDat chỉ báo cáo', t.logs, ['Apps Script phiên bản 3 · đã đặt mã đọc dữ liệu', 'Tab "Trang tính1": 1 bài nộp', 'Năm học có dữ liệu: 2026-2027']);
}

// ---------- Script không đặt mã ----------
({ api } = load('', [makeSheet('Trang tính1', [HEAD7, [1, 'X', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 1), 5]])], NOW));
check('Không đặt mã -> ai cũng đọc được (tương thích)', JSON.parse(api.doGet({ parameter: {} }).t).length, 1);

// ---------- Công cụ chạy tay ----------
const legacy2 = makeSheet('Trang tính1', [HEAD7,
    [1, 'A', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 28, 8, 0, 0), '7.00'],
    [2, 'A', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 28, 8, 0, 28), '7.00'],
    [3, 'A', 'Tin học', '15 Phút', '6A1', new Date(2026, 8, 28, 8, 20, 0), '8.00'],
]);
let logs;
({ api, logs } = load('k', [legacy2], NOW));
api.xoaBaiNopTrung();
check('Dọn bài trùng', [legacy2.rows.length - 1, logs[0]], [2, 'Đã xóa 1 bài nộp trùng.']);
api.saoLuu();
check('Sao lưu tạo bản sao', /Đã sao lưu: https:\/\/docs\.google\.com\/copy\/Sao%20l%C6%B0u/.test(logs[1]), true);

console.log(`\n📋 KẾT QUẢ: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
