/**
 * Test đọc đề từ tài liệu (parseLocalExamText trong robot-tao-de/app.js)
 * Chạy: node tests/test_parse_local.js
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../robot-tao-de/app.js'), 'utf8');
const start = src.indexOf('function parseLocalExamText(');
const end = start + src.slice(start).search(/\r?\n\}\r?\n/) + 3; // chấp nhận cả xuống dòng Windows (CRLF)
const parseLocalExamText = new Function(src.slice(start, end) + '; return parseLocalExamText;')();

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) pass++; else fail++;
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     nhận: ${JSON.stringify(actual)}\n     cần:  ${JSON.stringify(expected)}`}`);
}
const brief = qs => qs.map(q => [q.type, (q.type === 'mcq' || q.type === 'tf') ? q.options[q.correctAnswerIndex] : q.correctAnswerText]);

// Nội dung file mẫu Word của app (giữ nguyên các tiêu đề "Phần ...")
const template = `ĐỀ MẪU KIỂM TRA TỪ ROBOT AI
Phần 1: Trắc nghiệm
Câu 1: Thủ đô của Việt Nam là gì?
A. Hà Nội
B. Huế
C. Đà Nẵng
D. TP. Hồ Chí Minh
Đáp án đúng: A
Phần 2: Đúng / Sai
Câu 2: Năm 2024 có 366 ngày.
Đáp án đúng: Đúng
Câu 3: Mặt trời mọc ở hướng Tây.
Đáp án đúng: Sai
Phần 3: Điền khuyết (Bắt buộc phải có "Gợi ý:" liệt kê các từ khóa)
Câu 4: Bác Hồ sinh ngày 19 tháng 5 năm ____.
Gợi ý: 1890, 1911, 1945, 1969
Đáp án đúng: 1890
Phần 4: Tính toán
Câu 5: Tính diện tích hình chữ nhật có chiều dài 5, chiều rộng 3.
Đáp án đúng: 15`;
check('File mẫu: đủ 5 dạng câu, tiêu đề "Phần" không làm sai câu trước',
    brief(parseLocalExamText(template)), [['mcq', 'Hà Nội'], ['tf', 'Đúng'], ['tf', 'Sai'], ['fill', '1890'], ['calc', '15']]);

check('Dán từ PDF bị dính chữ',
    brief(parseLocalExamText('Câu 1: Phần mềm soạn thảo văn bản?A. PaintB. WordC. ExcelD. ZaloĐáp án đúng: B Câu 2: Trái đất quay quanh Mặt trời. Đáp án đúng: Đúng')),
    [['mcq', 'Word'], ['tf', 'Đúng']]);

check('Câu hỏi nhiều dòng', parseLocalExamText('Câu 1: Cho đoạn văn:\n"Hôm nay trời đẹp"\nTừ nào là tính từ?\nA. Hôm\nB. nay\nC. trời\nD. đẹp\nĐáp án đúng: D')[0].question,
    'Cho đoạn văn:\n"Hôm nay trời đẹp"\nTừ nào là tính từ?');

check('Tính toán lấy số trong đáp án', brief(parseLocalExamText('Câu 1: 2 + 3 = ?\nĐáp án đúng: 5 đơn vị')), [['calc', '5']]);

console.log(`\n📋 KẾT QUẢ: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
