/**
 * Test Suite: Hệ thống Phân bổ Mức độ Khó - Robot Tạo Đề AI
 * Chạy: node tests/test_difficulty.js
 */

// ============================================================
// COPY OF FUNCTIONS FROM app.js (for standalone testing)
// ============================================================

function calculateDifficultyQuota(totalQuestions, pctEasy, pctMed, pctHard) {
    const N = totalQuestions || 0;

    let numEasy = Math.round(N * pctEasy / 100);
    let numHard = Math.round(N * pctHard / 100);
    let numMed = N - numEasy - numHard;

    if (numMed < 0) { numMed = 0; numEasy = Math.min(numEasy, N); numHard = N - numEasy; }

    return { 'Dễ': numEasy, 'Trung bình': numMed, 'Khó': numHard, total: N, pctTotal: pctEasy + pctMed + pctHard };
}

function normalizeDifficulty(diffStr) {
    if (!diffStr || typeof diffStr !== 'string') return 'Trung bình';
    const d = diffStr.toLowerCase().trim();

    if (d === 'dễ' || d === 'de' || d === 'easy' || d === 'dê' || d === 'nhận biết'
        || d === 'nhan biet' || d === 'recognition' || d === 'basic') return 'Dễ';

    if (d === 'khó' || d === 'kho' || d === 'hard' || d === 'difficult' || d === 'vận dụng cao'
        || d === 'van dung cao' || d === 'vận dụng' || d === 'van dung' || d === 'advanced'
        || d === 'phân tích' || d === 'phan tich' || d === 'analysis') return 'Khó';

    if (d === 'trung bình' || d === 'trung binh' || d === 'tb' || d === 'medium'
        || d === 'thông hiểu' || d === 'thong hieu' || d === 'moderate'
        || d === 'understanding' || d === 'normal') return 'Trung bình';

    return 'Trung bình';
}

function balanceDifficultyQuota(questions, diffQuota) {
    if (!questions || questions.length === 0) return questions;

    questions.forEach(q => { q.difficulty = normalizeDifficulty(q.difficulty); });

    let counts = { 'Dễ': 0, 'Trung bình': 0, 'Khó': 0 };
    questions.forEach(q => { if (counts[q.difficulty] !== undefined) counts[q.difficulty]++; });

    const target = { 'Dễ': diffQuota['Dễ'], 'Trung bình': diffQuota['Trung bình'], 'Khó': diffQuota['Khó'] };

    if (counts['Dễ'] === target['Dễ'] && counts['Trung bình'] === target['Trung bình'] && counts['Khó'] === target['Khó']) {
        return questions;
    }

    const levels = ['Dễ', 'Trung bình', 'Khó'];
    let surplus = {};
    let deficit = {};
    levels.forEach(lv => {
        let diff = counts[lv] - target[lv];
        if (diff > 0) surplus[lv] = diff;
        else if (diff < 0) deficit[lv] = -diff;
    });

    const transferOrder = [
        ['Dễ', 'Trung bình'], ['Trung bình', 'Dễ'],
        ['Trung bình', 'Khó'], ['Khó', 'Trung bình'],
        ['Dễ', 'Khó'], ['Khó', 'Dễ']
    ];

    for (let [fromLv, toLv] of transferOrder) {
        if (!surplus[fromLv] || surplus[fromLv] <= 0) continue;
        if (!deficit[toLv] || deficit[toLv] <= 0) continue;

        let transferCount = Math.min(surplus[fromLv], deficit[toLv]);
        let transferred = 0;

        for (let q of questions) {
            if (transferred >= transferCount) break;
            if (q.difficulty === fromLv) {
                q.difficulty = toLv;
                transferred++;
            }
        }

        surplus[fromLv] -= transferred;
        deficit[toLv] -= transferred;
        if (surplus[fromLv] <= 0) delete surplus[fromLv];
        if (deficit[toLv] <= 0) delete deficit[toLv];
    }

    return questions;
}

// ============================================================
// TEST FRAMEWORK (minimal)
// ============================================================
let passCount = 0;
let failCount = 0;
let totalTests = 0;

function assertEqual(actual, expected, testName) {
    totalTests++;
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        passCount++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failCount++;
        console.log(`  ❌ FAIL: ${testName}`);
        console.log(`     Expected: ${JSON.stringify(expected)}`);
        console.log(`     Actual:   ${JSON.stringify(actual)}`);
    }
}

function assert(condition, testName) {
    totalTests++;
    if (condition) {
        passCount++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failCount++;
        console.log(`  ❌ FAIL: ${testName}`);
    }
}

// ============================================================
// TEST SUITE 1: calculateDifficultyQuota
// ============================================================
console.log('\n═══════════════════════════════════════════════');
console.log('📊 TEST SUITE 1: calculateDifficultyQuota');
console.log('═══════════════════════════════════════════════');

// 1.1 Standard case: 20 câu, 40/40/20
let q1 = calculateDifficultyQuota(20, 40, 40, 20);
assertEqual(q1['Dễ'], 8, '20 câu, 40% Dễ = 8 câu');
assertEqual(q1['Trung bình'], 8, '20 câu, 40% TB = 8 câu');
assertEqual(q1['Khó'], 4, '20 câu, 20% Khó = 4 câu');
assertEqual(q1.total, 20, 'Tổng = 20');
assertEqual(q1.pctTotal, 100, 'Tổng % = 100');

// 1.2 Rounding case: 10 câu, 33/34/33
let q2 = calculateDifficultyQuota(10, 33, 34, 33);
assertEqual(q2['Dễ'] + q2['Trung bình'] + q2['Khó'], 10, '10 câu (33/34/33): Tổng 3 level = 10');
assert(q2['Dễ'] >= 3 && q2['Dễ'] <= 4, '10 câu 33%: Dễ trong [3,4]');
assert(q2['Khó'] >= 3 && q2['Khó'] <= 4, '10 câu 33%: Khó trong [3,4]');

// 1.3 Edge case: 0 câu
let q3 = calculateDifficultyQuota(0, 40, 40, 20);
assertEqual(q3['Dễ'], 0, '0 câu: Dễ = 0');
assertEqual(q3['Trung bình'], 0, '0 câu: TB = 0');
assertEqual(q3['Khó'], 0, '0 câu: Khó = 0');

// 1.4 Edge case: 1 câu
let q4 = calculateDifficultyQuota(1, 40, 40, 20);
assertEqual(q4['Dễ'] + q4['Trung bình'] + q4['Khó'], 1, '1 câu: Tổng = 1');

// 1.5 All easy (100/0/0)
let q5 = calculateDifficultyQuota(15, 100, 0, 0);
assertEqual(q5['Dễ'], 15, '15 câu 100% Dễ = 15');
assertEqual(q5['Trung bình'], 0, '15 câu 0% TB = 0');
assertEqual(q5['Khó'], 0, '15 câu 0% Khó = 0');

// 1.6 Tổng % != 100
let q6 = calculateDifficultyQuota(20, 50, 50, 50);
assertEqual(q6.pctTotal, 150, 'Phát hiện tổng % = 150');
assertEqual(q6['Dễ'] + q6['Trung bình'] + q6['Khó'], 20, 'Tổng câu vẫn = 20 (dù % lệch)');

// 1.7 Large numbers
let q7 = calculateDifficultyQuota(100, 30, 50, 20);
assertEqual(q7['Dễ'], 30, '100 câu, 30% = 30 Dễ');
assertEqual(q7['Trung bình'], 50, '100 câu, 50% = 50 TB');
assertEqual(q7['Khó'], 20, '100 câu, 20% = 20 Khó');

// ============================================================
// TEST SUITE 2: normalizeDifficulty
// ============================================================
console.log('\n═══════════════════════════════════════════════');
console.log('🏷️  TEST SUITE 2: normalizeDifficulty');
console.log('═══════════════════════════════════════════════');

// 2.1 Vietnamese standard labels
assertEqual(normalizeDifficulty('Dễ'), 'Dễ', 'Chuẩn: "Dễ"');
assertEqual(normalizeDifficulty('Trung bình'), 'Trung bình', 'Chuẩn: "Trung bình"');
assertEqual(normalizeDifficulty('Khó'), 'Khó', 'Chuẩn: "Khó"');

// 2.2 English labels
assertEqual(normalizeDifficulty('easy'), 'Dễ', 'English: "easy" -> Dễ');
assertEqual(normalizeDifficulty('medium'), 'Trung bình', 'English: "medium" -> TB');
assertEqual(normalizeDifficulty('hard'), 'Khó', 'English: "hard" -> Khó');
assertEqual(normalizeDifficulty('difficult'), 'Khó', 'English: "difficult" -> Khó');

// 2.3 Vietnamese pedagogical terms
assertEqual(normalizeDifficulty('nhận biết'), 'Dễ', 'Sư phạm: "nhận biết" -> Dễ');
assertEqual(normalizeDifficulty('thông hiểu'), 'Trung bình', 'Sư phạm: "thông hiểu" -> TB');
assertEqual(normalizeDifficulty('vận dụng cao'), 'Khó', 'Sư phạm: "vận dụng cao" -> Khó');
assertEqual(normalizeDifficulty('vận dụng'), 'Khó', 'Sư phạm: "vận dụng" -> Khó');
assertEqual(normalizeDifficulty('phân tích'), 'Khó', 'Sư phạm: "phân tích" -> Khó');

// 2.4 No-diacritics variants
assertEqual(normalizeDifficulty('de'), 'Dễ', 'Không dấu: "de" -> Dễ');
assertEqual(normalizeDifficulty('kho'), 'Khó', 'Không dấu: "kho" -> Khó');
assertEqual(normalizeDifficulty('trung binh'), 'Trung bình', 'Không dấu: "trung binh" -> TB');
assertEqual(normalizeDifficulty('tb'), 'Trung bình', 'Viết tắt: "tb" -> TB');
assertEqual(normalizeDifficulty('nhan biet'), 'Dễ', 'Không dấu: "nhan biet" -> Dễ');
assertEqual(normalizeDifficulty('thong hieu'), 'Trung bình', 'Không dấu: "thong hieu" -> TB');
assertEqual(normalizeDifficulty('van dung cao'), 'Khó', 'Không dấu: "van dung cao" -> Khó');

// 2.5 Edge cases
assertEqual(normalizeDifficulty(null), 'Trung bình', 'null -> TB (fallback)');
assertEqual(normalizeDifficulty(undefined), 'Trung bình', 'undefined -> TB (fallback)');
assertEqual(normalizeDifficulty(''), 'Trung bình', 'empty string -> TB (fallback)');
assertEqual(normalizeDifficulty('xyz random'), 'Trung bình', 'random string -> TB (fallback)');
assertEqual(normalizeDifficulty('  Dễ  '), 'Dễ', 'Spaces trimmed: "  Dễ  " -> Dễ');
assertEqual(normalizeDifficulty('DỄ'), 'Dễ', 'Uppercase: "DỄ" -> Dễ');
assertEqual(normalizeDifficulty('EASY'), 'Dễ', 'UPPERCASE: "EASY" -> Dễ');
assertEqual(normalizeDifficulty('Basic'), 'Dễ', 'Basic -> Dễ');

// ============================================================
// TEST SUITE 3: balanceDifficultyQuota
// ============================================================
console.log('\n═══════════════════════════════════════════════');
console.log('⚖️  TEST SUITE 3: balanceDifficultyQuota');
console.log('═══════════════════════════════════════════════');

function makeQ(difficulty, type) {
    return { question: `Test question (${difficulty})`, difficulty, type: type || 'mcq', options: ['A','B','C','D'], correctAnswerIndex: 0, explanation: 'test' };
}

function countDiff(questions) {
    let c = { 'Dễ': 0, 'Trung bình': 0, 'Khó': 0 };
    questions.forEach(q => { if (c[q.difficulty] !== undefined) c[q.difficulty]++; });
    return c;
}

// 3.1 Already balanced
{
    let qs = [makeQ('Dễ'), makeQ('Dễ'), makeQ('Trung bình'), makeQ('Trung bình'), makeQ('Khó')];
    let quota = { 'Dễ': 2, 'Trung bình': 2, 'Khó': 1 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 2, 'Đã cân bằng: Dễ giữ nguyên 2');
    assertEqual(c['Trung bình'], 2, 'Đã cân bằng: TB giữ nguyên 2');
    assertEqual(c['Khó'], 1, 'Đã cân bằng: Khó giữ nguyên 1');
}

// 3.2 AI sinh tất cả TB, cần phân lại
{
    let qs = [];
    for (let i = 0; i < 10; i++) qs.push(makeQ('Trung bình'));
    let quota = { 'Dễ': 4, 'Trung bình': 4, 'Khó': 2 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 4, 'Tất cả TB -> cân bằng thành 4 Dễ');
    assertEqual(c['Trung bình'], 4, 'Tất cả TB -> giữ 4 TB');
    assertEqual(c['Khó'], 2, 'Tất cả TB -> cân bằng thành 2 Khó');
}

// 3.3 AI sinh dư Dễ, thiếu Khó
{
    let qs = [
        makeQ('Dễ'), makeQ('Dễ'), makeQ('Dễ'), makeQ('Dễ'), makeQ('Dễ'),
        makeQ('Trung bình'), makeQ('Trung bình'),
        makeQ('Khó')
    ];
    let quota = { 'Dễ': 2, 'Trung bình': 3, 'Khó': 3 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 2, 'Dư Dễ: điều chỉnh về 2');
    assertEqual(c['Trung bình'], 3, 'Thiếu TB: bù lên 3');
    assertEqual(c['Khó'], 3, 'Thiếu Khó: bù lên 3');
}

// 3.4 Hỗn hợp label tiếng Anh và sư phạm
{
    let qs = [
        makeQ('easy'), makeQ('nhận biết'), makeQ('basic'),
        makeQ('medium'), makeQ('thông hiểu'), makeQ('tb'),
        makeQ('hard'), makeQ('vận dụng cao'), makeQ('difficult'), makeQ('phân tích')
    ];
    let quota = { 'Dễ': 3, 'Trung bình': 3, 'Khó': 4 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 3, 'Hỗn hợp label: Dễ = 3');
    assertEqual(c['Trung bình'], 3, 'Hỗn hợp label: TB = 3');
    assertEqual(c['Khó'], 4, 'Hỗn hợp label: Khó = 4');
    assert(result.every(q => ['Dễ', 'Trung bình', 'Khó'].includes(q.difficulty)), 'Tất cả nhãn đã chuẩn hóa');
}

// 3.5 Empty array
{
    let result = balanceDifficultyQuota([], { 'Dễ': 2, 'Trung bình': 2, 'Khó': 1 });
    assertEqual(result.length, 0, 'Mảng rỗng: trả về mảng rỗng');
}

// 3.6 All same difficulty -> redistribute
{
    let qs = [];
    for (let i = 0; i < 20; i++) qs.push(makeQ('Dễ'));
    let quota = { 'Dễ': 8, 'Trung bình': 8, 'Khó': 4 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 8, '20 Dễ -> 8 Dễ');
    assertEqual(c['Trung bình'], 8, '20 Dễ -> 8 TB');
    assertEqual(c['Khó'], 4, '20 Dễ -> 4 Khó');
}

// 3.7 Preserve question type
{
    let qs = [
        { ...makeQ('Dễ'), type: 'mcq' },
        { ...makeQ('Dễ'), type: 'tf' },
        { ...makeQ('Dễ'), type: 'fill' },
        { ...makeQ('Trung bình'), type: 'calc' },
    ];
    let quota = { 'Dễ': 1, 'Trung bình': 2, 'Khó': 1 };
    let result = balanceDifficultyQuota(qs, quota);
    assert(result[0].type === 'mcq', 'Bảo toàn type mcq');
    assert(result[1].type === 'tf', 'Bảo toàn type tf');
    assert(result[2].type === 'fill', 'Bảo toàn type fill');
    assert(result[3].type === 'calc', 'Bảo toàn type calc');
    let c = countDiff(result);
    assertEqual(c['Dễ'] + c['Trung bình'] + c['Khó'], 4, 'Tổng = 4 câu');
}

// 3.8 Null/undefined difficulty
{
    let qs = [
        makeQ(null), makeQ(undefined), makeQ(''), makeQ('xyz')
    ];
    let quota = { 'Dễ': 1, 'Trung bình': 2, 'Khó': 1 };
    let result = balanceDifficultyQuota(qs, quota);
    assert(result.every(q => ['Dễ', 'Trung bình', 'Khó'].includes(q.difficulty)), 'Null/undefined/empty đều chuẩn hóa');
    let c = countDiff(result);
    assertEqual(c['Dễ'], 1, 'Null inputs: cân bằng Dễ = 1');
    assertEqual(c['Trung bình'], 2, 'Null inputs: cân bằng TB = 2');
    assertEqual(c['Khó'], 1, 'Null inputs: cân bằng Khó = 1');
}

// 3.9 Target all one difficulty
{
    let qs = [makeQ('Dễ'), makeQ('Trung bình'), makeQ('Khó'), makeQ('Trung bình'), makeQ('Dễ')];
    let quota = { 'Dễ': 5, 'Trung bình': 0, 'Khó': 0 };
    let result = balanceDifficultyQuota(qs, quota);
    let c = countDiff(result);
    assertEqual(c['Dễ'], 5, 'Tất cả thành Dễ: 5');
    assertEqual(c['Trung bình'], 0, 'Tất cả thành Dễ: TB = 0');
    assertEqual(c['Khó'], 0, 'Tất cả thành Dễ: Khó = 0');
}

// ============================================================
// RESULTS
// ============================================================
console.log('\n═══════════════════════════════════════════════');
console.log(`📋 KẾT QUẢ: ${passCount}/${totalTests} PASS, ${failCount} FAIL`);
console.log('═══════════════════════════════════════════════');

if (failCount > 0) {
    console.log('❌ CÓ LỖI! Vui lòng kiểm tra lại.');
    process.exit(1);
} else {
    console.log('✅ TẤT CẢ TEST PASS! Hệ thống hoạt động chính xác.');
    process.exit(0);
}
