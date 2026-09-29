/**
 * Test bộ xử lý điểm dùng chung (shared/scores.js)
 * Chạy: node tests/test_scores.js
 */
const S = require('../shared/scores.js');

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     nhận: ${JSON.stringify(actual)}\n     cần:  ${JSON.stringify(expected)}`}`);
}

// ---------- Hình thức kiểm tra ----------
const h = v => { const r = S.parseHinhThuc(v); return [r.label, r.limit]; };
check('Dữ liệu cũ "15 Phút" = Lần 1', h('15 Phút'), ['15 Phút - Lần 1', 0]);
check('Đề mới + Apps Script cũ', h('Lần 2 - 15 Phút'), ['15 Phút - Lần 2', 0]);
check('Apps Script mới', h('15 Phút - Lần 2'), ['15 Phút - Lần 2', 0]);
check('Có giới hạn (Apps Script cũ)', h('Lần 3 - Tối đa 5 lần - 45 Phút'), ['45 Phút - Lần 3', 5]);
check('Có giới hạn (Apps Script mới)', h('45 Phút - Lần 3 - Tối đa 5 lần'), ['45 Phút - Lần 3', 5]);
check('Tham số gửi đi', S.buildExamTimeParam(15, 2, 0), 'Lần 2 - 15');
check('Tham số gửi đi có giới hạn', S.buildExamTimeParam(15, 2, 5), 'Lần 2 - Tối đa 5 lần - 15');
check('Vòng lại: tham số + " Phút" (Apps Script cũ)', h(S.buildExamTimeParam(15, 2, 5) + ' Phút'), ['15 Phút - Lần 2', 5]);

// ---------- Thời gian, năm học ----------
check('Ngày dd/MM/yyyy', new Date(S.parseTime('05/09/2026 07:08:09')).getMonth(), 8);
check('Năm học tháng 9', S.schoolYearOf(new Date(2026, 8, 1).getTime()), '2026-2027');
check('Năm học tháng 8', S.schoolYearOf(new Date(2026, 7, 31).getTime()), '2025-2026');
check('Năm học tháng 6', S.schoolYearOf(S.parseTime('2026-06-19T08:29:04.000Z')), '2025-2026');

// ---------- Lấy điểm cao nhất ----------
const T0 = new Date(2026, 8, 28, 8, 0, 0).getTime();
const row = (name, cls, score, minAfter, examTime = '15 Phút - Lần 1', subject = 'Tin học') =>
    ({ name, className: cls, subject, examTime, score, date: new Date(T0 + minAfter * 60000).toISOString() });

let r = S.process([
    row('HS1', '6A1', 5, 0), row('HS1', '6A1', 6.5, 10), row('HS1', '6A1', 8, 20), row('HS1', '6A1', 7, 30), row('HS1', '6A1', 7.5, 40)
]);
check('HS làm 5 lần -> 1 kết quả, điểm cao nhất 8', r.best.map(b => [b.name, b.score, b.attempts]), [['HS1', 8, 5]]);

r = S.process([row('HS1', '6A1', 7, 0), row('HS1', '6A1', 7, 0.4), row('HS1', '6A1', 7, 0.9), row('HS1', '6A1', 9, 5)]);
check('Bản gửi trùng không tính là 1 lần làm', r.best.map(b => [b.score, b.attempts]), [[9, 2]]);

r = S.process([
    row('HS1', '6A1', 5, 0, 'Lần 1 - Tối đa 2 lần - 15 Phút'),
    row('HS1', '6A1', 6, 10, 'Lần 1 - Tối đa 2 lần - 15 Phút'),
    row('HS1', '6A1', 10, 20, 'Lần 1 - Tối đa 2 lần - 15 Phút')
]);
check('Vượt giới hạn 2 lần -> lần 3 (điểm 10) không tính', r.best.map(b => [b.score, b.counted, b.ignored]), [[6, 2, 1]]);

r = S.process([row('HS1', '6A1', 6, 0, '15 Phút'), row('HS1', '6A1', 8, 10, 'Lần 1 - 15 Phút'), row('HS1', '6A1', 9, 20, '15 Phút - Lần 2')]);
check('Dữ liệu cũ gộp với Lần 1, Lần 2 tách riêng', r.best.map(b => [b.hinhThuc, b.score]).sort(), [['15 Phút - Lần 1', 8], ['15 Phút - Lần 2', 9]]);

r = S.process([row('Nguyễn Văn A', '6A1', 6, 0), row('nguyễn  văn a', '6A1', 8, 10), row('Nguyen Van A', '6A1', 9, 20)]);
check('Hoa thường/khoảng trắng = cùng HS; bỏ dấu = HS khác', r.best.map(b => b.score).sort(), [8, 9]);

r = S.process([row('HS1', '6A1', 6, 0), row('HS1', '6A2', 8, 10), row('HS1', '6A1', 9, 20, '15 Phút - Lần 1', 'Toán học')]);
check('Khác lớp / khác môn = kết quả riêng', r.best.length, 3);

const june = { name: 'HS1', className: '6A1', subject: 'Tin học', examTime: '15 Phút', score: 10, date: '2026-06-19T08:29:04.000Z' };
r = S.process([june, row('HS1', '6A1', 6, 0)]);
check('Năm học khác không gộp', r.best.map(b => [b.year, b.score]).sort(), [['2025-2026', 10], ['2026-2027', 6]]);
check('Lọc theo năm học', S.process([june, row('HS1', '6A1', 6, 0)], { year: '2026-2027' }).best.map(b => b.score), [6]);
check('Danh sách năm học', S.listSchoolYears([june]).includes('2025-2026'), true);

check('Bỏ dòng không có tên / điểm', S.process([{ name: '', score: 5 }, { name: 'A', score: '' }]).best.length, 0);
check('Điểm "7,5" dấu phẩy', S.process([{ name: 'A', className: '6A1', subject: 'Tin', examTime: '15', score: '7,5', date: '29/09/2026 07:00:00' }]).best[0].score, 7.5);

// ---------- Xếp loại, sắp xếp, an toàn HTML ----------
check('Xếp loại ngưỡng', [4.99, 5, 6.4, 6.49, 6.5, 7.99, 8, 10].map(s => S.gradeOf(s).label),
    ['Chưa đạt', 'Đạt', 'Đạt', 'Đạt', 'Khá', 'Khá', 'Tốt', 'Tốt']);
check('Sắp xếp lớp tự nhiên', ['7A1', '6A10', '6A2', '6A1'].sort(S.naturalCompare), ['6A1', '6A2', '6A10', '7A1']);
check('Chống chèn mã HTML', S.escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');

console.log(`\n📋 KẾT QUẢ: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
