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
                setValues: vals => { vals.forEach((row, i) => row.forEach((v, j) => { sh.rows[r - 1 + i][c - 1 + j] = v; })); },
                setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
                getValues: () => sh.rows.slice(r - 1, r - 1 + nr).map(x => { const y = x.slice(c - 1, c - 1 + nc); while (y.length < nc) y.push(''); return y; }),
                createTextFinder: txt => ({ matchEntireCell: () => ({ findNext: () => sh.rows.slice(r - 1, r - 1 + nr).some(x => String(x[c - 1]) === txt) ? {} : null }) }),
            };
        },
    };
}

function load(readKey, sheets, nowMs, tweak) {
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
    let code = SRC.replace('var READ_KEY = "";', `var READ_KEY = ${JSON.stringify(readKey)};`);
    if (tweak) code = tweak(code);
    const api = new Function(...Object.keys(ctx), code + '; return {doPost, doGet, xoaBaiNopTrung, saoLuu, kiemTraCaiDat, doiNhanKhaoSat, xemTruocNhanKhaoSat};')(...Object.values(ctx));
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
check('Thông tin script', get({ key: 'ma-bi-mat', action: 'info' }), { status: 'success', version: 4, years: ['2026-2027', '2025-2026'], protected: true });

// ---------- Ghi điểm vào tab năm học ----------
check('Đề cũ (examTime=15)', post({ name: 'An', className: '6A1', subject: 'Tin học', examTime: '15', score: '7.50' }).status, 'success');
check('Tự tạo tab 2026-2027 ở CUỐI (tab cũ giữ vị trí đầu)', ss.getSheets().map(s => s.name), ['Trang tính1', 'Ghi chú', '2026-2027']);
check('Đề khảo sát cũ (Tin học 6, examTime=15) -> ghi là Khảo sát', ss.getSheetByName('2026-2027').rows[1][3], 'Khảo sát - 15 Phút - Lần 1');
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
    check('kiemTraCaiDat chỉ báo cáo', t.logs, ['Apps Script phiên bản 4 · đã đặt mã đọc dữ liệu', 'Tab "Trang tính1": 1 bài nộp', 'Năm học có dữ liệu: 2026-2027']);
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

// ---------- Loại kiểm tra (phiên bản 4) ----------
{
    const sh = makeSheet('Trang tính1', [HEAD7]);
    const t = load('k', [sh], NOW);
    const pt = p => JSON.parse(t.api.doPost({ parameter: p }).t);
    const last = () => t.ss.getSheetByName('2026-2027').rows.slice(-1)[0][3];
    pt({ name: 'A', className: '6A1', subject: 'Tin học', examTime: 'Giữa kỳ I - Lần 1 - 15', minutes: '15', round: '1', type: 'Giữa kỳ I', score: '8' });
    check('Loại kiểm tra ghi vào hình thức', last(), 'Giữa kỳ I - 15 Phút - Lần 1');
    pt({ name: 'B', className: '6A1', subject: 'Tin học', examTime: 'Thường xuyên - Lần 3 - Tối đa 2 lần - 15', minutes: '15', round: '3', limit: '2', score: '7' });
    check('Loại lấy từ chuỗi hình thức khi không có tham số type', last(), 'Thường xuyên - 15 Phút - Lần 3 - Tối đa 2 lần');
    pt({ name: 'C', className: '6A1', subject: 'Tin học', examTime: 'Lần 1 - 15', minutes: '15', round: '1', type: '<script>alert(1)</script>', score: '6' });
    check('Loại lạ bị bỏ qua (chống chèn chữ)', last(), '15 Phút - Lần 1');
    pt({ name: 'D', className: '6A1', subject: 'Tin học', examTime: 'Lần 1 - 15', minutes: '15', round: '1', score: '5' });
    check('Đề cũ không gửi loại (Tin học 6, 15 phút) -> Khảo sát', last(), 'Khảo sát - 15 Phút - Lần 1');
    pt({ name: 'D2', className: '9A1', subject: 'Toán học', examTime: 'Lần 1 - 15', minutes: '15', round: '1', score: '5' });
    check('Đề cũ không gửi loại (môn/khối khác): như trước', last(), '15 Phút - Lần 1');
    const r1 = pt({ name: 'E', className: '6A1', subject: 'Tin học', examTime: 'Giữa kỳ I - Lần 1 - 15', minutes: '15', round: '1', type: 'Giữa kỳ I', score: '9' });
    const r2 = pt({ name: 'E', className: '6A1', subject: 'Tin học', examTime: 'Thường xuyên - Lần 1 - 15', minutes: '15', round: '1', type: 'Thường xuyên', score: '9' });
    check('Cùng tên, điểm, 15 phút nhưng khác loại: không bị coi là bài trùng', [r1.duplicate, r2.duplicate], [undefined, undefined]);
}

// ---------- Đợt KHẢO SÁT: nhận bài từ mọi loại file đề + đổi nhãn dữ liệu cũ ----------
{
    const mk = (tweak) => { const sh = makeSheet('Trang tính1', [HEAD7]); const t = load('k', [sh], NOW, tweak); return { t, sh, ss: t.ss, post: p => JSON.parse(t.api.doPost({ parameter: p }).t), lastLabel: () => t.ss.getSheetByName('2026-2027').rows.slice(-1)[0][3] }; };
    const m = mk();
    const base = { name: 'HS', subject: 'Tin học', className: '7A1', score: '8' };
    let n = 0; const next = o => Object.assign({}, base, { name: 'HS' + (++n), submissionId: 'id' + n }, o);
    const label = o => { const r = m.post(next(o)); return [r.status, m.lastLabel()]; };

    check('Nộp bài: đề mẫu cũ (chỉ có examTime=15) -> Khảo sát', label({ examTime: '15' }), ['success', 'Khảo sát - 15 Phút - Lần 1']);
    check('Nộp bài: đề khảo sát xuất lại (có minutes/round, không có type)', label({ examTime: 'Lần 1 - 15', minutes: '15', round: '1', limit: '0' }), ['success', 'Khảo sát - 15 Phút - Lần 1']);
    check('Nộp bài: đề hiện tại có loại + giới hạn -> giữ nguyên loại', label({ examTime: 'Thường xuyên - Lần 1 - Tối đa 2 lần - 15', minutes: '15', round: '1', limit: '2', type: 'Thường xuyên' }), ['success', 'Thường xuyên - 15 Phút - Lần 1 - Tối đa 2 lần']);
    check('Nộp bài: đề không loại có giới hạn 2 lần -> KHÔNG đổi', label({ examTime: 'Lần 1 - Tối đa 2 lần - 15', minutes: '15', round: '1', limit: '2' }), ['success', '15 Phút - Lần 1 - Tối đa 2 lần']);
    check('Nộp bài: khối 8 -> KHÔNG đổi', label({ examTime: '15', className: '8A1' }), ['success', '15 Phút - Lần 1']);
    check('Nộp bài: môn khác -> KHÔNG đổi', label({ examTime: '15', subject: 'Toán học' }), ['success', '15 Phút - Lần 1']);
    check('Nộp bài: 30 phút -> KHÔNG đổi', label({ examTime: '30', minutes: '30' }), ['success', '30 Phút - Lần 1']);
    check('Nộp bài: có gửi type rỗng (đề mới không loại) -> KHÔNG đổi', label({ examTime: 'Lần 1 - 15', minutes: '15', round: '1', type: '' }), ['success', '15 Phút - Lần 1']);
    check('Nộp bài: thiếu môn và lớp vẫn ghi được', (() => { const r = m.post({ name: 'KhongMon', examTime: '15', score: '5', submissionId: 'z1' }); return [r.status, m.lastLabel()]; })(), ['success', '15 Phút - Lần 1']);
    const dupA = m.post(next({ examTime: '15', score: '9', name: 'Trung', submissionId: '' }));
    const dupB = m.post(next({ examTime: '15', score: '9', name: 'Trung', submissionId: '' }));
    check('Nộp bài khảo sát gửi lại trong 2 phút vẫn chống trùng', [dupA.status, dupB.duplicate], ['success', true]);
    const off = mk(c => c.replace('var LEGACY_KHAO_SAT = true;', 'var LEGACY_KHAO_SAT = false;'));
    check('Tắt LEGACY_KHAO_SAT -> không đổi nhãn nhưng vẫn ghi bài', (() => { const r = off.post(Object.assign({}, base, { examTime: '15', submissionId: 'q1' })); return [r.status, off.lastLabel()]; })(), ['success', '15 Phút - Lần 1']);
}
{
    const D = (i, label, subject, cls, h) => [i, 'HS' + i, subject, label, cls, new Date(2026, 8, 28, h, 0), 7];
    const mkSheets = () => [
        makeSheet('Trang tính1', [HEAD7, D(1, '15 Phút', 'Tin học', '6A1', 8), D(2, 'Lần 1 - 15 Phút', 'Tin học', '7A2', 9), D(3, '15 Phút', 'Toán học', '6A1', 10)]),
        makeSheet('2026-2027', [HEAD7.concat(['MÃ BÀI NỘP']), D(1, '15 Phút', 'Tin học', '6A3', 8), D(2, ' lần 1 - 15 PHÚT ', 'Tin học', '7A1', 9),
            D(3, '15 Phút - Lần 1 - Tối đa 2 lần', 'Tin học', '7A1', 10), D(4, '30 Phút - Lần 1 - Tối đa 2 lần', 'Tin học', '6A1', 11),
            D(5, '15 Phút', 'Tin học', '8A1', 12), D(6, '10 Phút - Lần 1 - Tối đa 3 lần', 'Lịch sử', '7A1', 13), D(7, 'Thường xuyên - 15 Phút - Lần 1', 'Tin học', '7A1', 14)])
    ];
    const cols = sheets => sheets.map(s => s.rows.slice(1).map(r => r[3]));
    const before = cols(mkSheets());

    // Xem trước: không ghi gì
    const s1 = mkSheets(); const t = load('k', s1, NOW); let copies = 0; t.ss.copy = () => { copies++; return { getUrl: () => 'u' }; };
    const total = t.api.xemTruocNhanKhaoSat();
    check('Xem trước: đếm đúng (4 dòng), không ghi, không sao lưu', [total, JSON.stringify(cols(s1)) === JSON.stringify(before), copies], [4, true, 0]);
    check('Xem trước: nhật ký nói rõ số dòng giữ nguyên', t.logs.some(l => /Giữ nguyên 2 dòng/.test(l)), true);

    // Đổi thật
    t.api.doiNhanKhaoSat();
    const after = cols(s1);
    const KS = 'Khảo sát - 15 Phút - Lần 1';
    check('Đổi nhãn: 4 dòng khảo sát Tin 6, 7 (cả 2 tab) thành Khảo sát', [after[0][0], after[0][1], after[1][0], after[1][1]], [KS, KS, KS, KS]);
    check('Đổi nhãn: đề hiện tại / Toán / khối 8 / Lịch sử / có loại KHÔNG đổi', [after[0][2], after[1][2], after[1][3], after[1][4], after[1][5], after[1][6]], [before[0][2], before[1][2], before[1][3], before[1][4], before[1][5], before[1][6]]);
    check('Đổi nhãn: đã sao lưu đúng 1 lần', copies, 1);
    check('Đổi nhãn: chỉ đổi cột HÌNH THỨC KT (tên, điểm, ngày giữ nguyên)', [s1[1].rows[1][1], s1[1].rows[1][6], s1[1].rows[1][5] instanceof Date], ['HS1', 7, true]);

    // Chạy lại: không làm gì, không sao lưu thêm
    t.api.doiNhanKhaoSat();
    check('Chạy lại: không đổi thêm, không sao lưu thêm', [JSON.stringify(cols(s1)) === JSON.stringify(after), copies], [true, 1]);

    // Sao lưu lỗi -> dừng, không đổi gì
    const s2 = mkSheets(); const t2 = load('k', s2, NOW); t2.ss.copy = () => { throw new Error('Không có quyền Drive'); };
    t2.api.doiNhanKhaoSat();
    check('Sao lưu lỗi -> dừng, dữ liệu giữ nguyên', JSON.stringify(cols(s2)) === JSON.stringify(before), true);

    // Sau khi đổi, ứng dụng đọc được bình thường
    const rows = JSON.parse(t.api.doGet({ parameter: { key: 'k', year: 'all' } }).t);
    check('Sau khi đổi: doGet vẫn trả đủ dữ liệu, có nhãn Khảo sát', [rows.length, rows.filter(r => r.examTime === KS).length], [10, 4]);
}

console.log(`\n📋 KẾT QUẢ: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
