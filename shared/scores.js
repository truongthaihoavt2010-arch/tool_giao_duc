/**
 * XỬ LÝ ĐIỂM DÙNG CHUNG — Robot Tạo Đề & Quản Lý Điểm
 *
 * Quy tắc:
 *  - Hình thức kiểm tra = thời gian làm bài + lần kiểm tra (Lần 1–6), ví dụ "15 Phút - Lần 1".
 *    Dữ liệu cũ không ghi lần → tính là Lần 1.
 *  - Năm học: 01/09 → 31/08 năm sau, theo thời gian nộp.
 *  - Bài trùng (cùng tên, lớp, môn, hình thức, điểm; nộp cách nhau < 2 phút) chỉ tính 1 lần làm.
 *  - Mỗi học sinh (tên + lớp) + môn + hình thức + lần + năm học: lấy ĐIỂM CAO NHẤT
 *    trong N lần làm đầu tiên (N = giới hạn ghi trong hình thức, không có thì không giới hạn).
 *  - Gõ tên khác = học sinh khác (chỉ bỏ qua khác biệt hoa thường và khoảng trắng).
 */
(function (root) {
    'use strict';

    const DUP_WINDOW_MS = 2 * 60 * 1000;

    const norm = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    const normKey = v => norm(v).toLowerCase();

    // Ký tự đặc biệt HTML -> an toàn khi chèn vào innerHTML
    function escapeHtml(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Thời gian nộp: "dd/MM/yyyy HH:mm:ss" (Apps Script mới) hoặc ISO (Apps Script cũ) -> mili giây
    function parseTime(v) {
        if (v == null || v === '') return NaN;
        if (typeof v === 'number') return v;
        const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (m) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
        return Date.parse(v);
    }

    // Năm học của một thời điểm: từ tháng 9 là năm học mới
    function schoolYearOf(t) {
        if (isNaN(t)) return '';
        const d = new Date(t);
        const y = d.getFullYear();
        return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }

    function currentSchoolYear() {
        return schoolYearOf(Date.now());
    }

    function parseScore(v) {
        const s = parseFloat(String(v == null ? '' : v).replace(',', '.'));
        return isNaN(s) ? NaN : s;
    }

    /**
     * Tách hình thức kiểm tra. Hỗ trợ:
     *  "15 Phút" (cũ) · "Lần 1 - 15 Phút" (đề mới + Apps Script cũ) · "15 Phút - Lần 1" (Apps Script mới)
     *  "Lần 2 - Tối đa 5 lần - 15 Phút" · "15 Phút - Lần 2 - Tối đa 5 lần"
     */
    function parseHinhThuc(v) {
        const s = norm(v);
        const mMin = s.match(/(\d+)\s*phút/i);
        const mRound = s.match(/lần\s*(\d+)/i);
        const mLimit = s.match(/tối\s*đa\s*(\d+)/i);
        const minutes = mMin ? parseInt(mMin[1], 10) : null;
        const round = mRound ? parseInt(mRound[1], 10) : 1; // Dữ liệu cũ = Lần 1
        const limit = mLimit ? parseInt(mLimit[1], 10) : 0;  // 0 = không giới hạn
        const base = minutes != null ? `${minutes} Phút` : (s.replace(/lần\s*\d+|tối\s*đa\s*\d+\s*lần|[-–·]/gi, ' ').trim().replace(/\s+/g, ' ') || 'Không rõ');
        return { minutes, round, limit, base, label: `${base} - Lần ${round}` };
    }

    // Tạo chuỗi hình thức gửi lên Sheet. Đặt số phút ở CUỐI để Apps Script cũ (tự nối " Phút") vẫn ghi đúng.
    function buildExamTimeParam(minutes, round, limit) {
        let s = `Lần ${round || 1}`;
        if (limit > 0) s += ` - Tối đa ${limit} lần`;
        return `${s} - ${minutes}`;
    }

    // Chuẩn hóa một dòng dữ liệu từ Google Sheets
    function normalizeRow(r, i) {
        const t = parseTime(r.date);
        const ht = parseHinhThuc(r.examTime);
        return {
            idx: i,
            name: norm(r.name),
            className: norm(r.className),
            subject: norm(r.subject),
            hinhThuc: ht.label,          // "15 Phút - Lần 1"
            hinhThucBase: ht.base,       // "15 Phút"
            round: ht.round,
            limit: ht.limit,
            time: t,
            dateText: isNaN(t) ? norm(r.date) : formatDateTime(t),
            year: r.year ? norm(r.year) : schoolYearOf(t),
            score: parseScore(r.score),
            raw: r
        };
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function formatDateTime(t) {
        const d = new Date(t);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // Khóa một "lần kiểm tra" của một học sinh
    function attemptKey(r) {
        return [normKey(r.name), normKey(r.className), normKey(r.subject), normKey(r.hinhThucBase), r.round, r.year].join('|');
    }

    /**
     * Xử lý toàn bộ dữ liệu.
     * Trả về:
     *  - all: mọi dòng hợp lệ (đã chuẩn hóa), đánh dấu dup / overLimit
     *  - best: mỗi học sinh + lần kiểm tra 1 dòng điểm cao nhất (kèm attempts, counted, ignored)
     */
    function process(rows, opts) {
        opts = opts || {};
        const all = (rows || []).map(normalizeRow).filter(r => r.name && !isNaN(r.score));
        const yearFilter = opts.year && opts.year !== 'all' ? opts.year : null;
        const scoped = yearFilter ? all.filter(r => r.year === yearFilter) : all;

        // Sắp xếp theo thời gian nộp (dòng không có thời gian giữ thứ tự gốc, xếp sau)
        const ordered = scoped.slice().sort((a, b) => {
            const ta = isNaN(a.time) ? Infinity : a.time, tb = isNaN(b.time) ? Infinity : b.time;
            return ta - tb || a.idx - b.idx;
        });

        const groups = new Map();
        const lastKeptDup = {};
        for (const r of ordered) {
            // 1. Bài gửi trùng
            const dupK = attemptKey(r) + '|' + r.score.toFixed(2);
            if (!isNaN(r.time) && lastKeptDup[dupK] !== undefined && r.time - lastKeptDup[dupK] < DUP_WINDOW_MS) {
                r.dup = true;
                continue;
            }
            if (!isNaN(r.time)) lastKeptDup[dupK] = r.time;

            // 2. Gom theo học sinh + lần kiểm tra
            const k = attemptKey(r);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(r);
        }

        const best = [];
        for (const list of groups.values()) {
            // Giới hạn: lấy giá trị nhỏ nhất khác 0 được ghi trong các lần làm (phòng khi đề bị xuất lại với giới hạn khác)
            const limits = list.map(r => r.limit).filter(n => n > 0);
            const limit = limits.length ? Math.min(...limits) : 0;
            list.forEach((r, i) => { r.attemptNo = i + 1; r.overLimit = limit > 0 && i >= limit; });
            const counted = list.filter(r => !r.overLimit);
            let top = counted[0];
            for (const r of counted) if (r.score > top.score) top = r;
            best.push(Object.assign({}, top, {
                attempts: list.length,
                counted: counted.length,
                ignored: list.length - counted.length,
                limit,
                allScores: list.map(r => r.score)
            }));
        }
        best.sort((a, b) => (isNaN(a.time) ? Infinity : a.time) - (isNaN(b.time) ? Infinity : b.time) || a.idx - b.idx);
        return { all: scoped, best };
    }

    // Danh sách năm học có trong dữ liệu (mới nhất trước), luôn có năm học hiện tại
    function listSchoolYears(rows) {
        const set = new Set([currentSchoolYear()]);
        (rows || []).forEach(r => {
            const y = r.year ? norm(r.year) : schoolYearOf(parseTime(r.date));
            if (y) set.add(y);
        });
        return [...set].sort().reverse();
    }

    // Xếp loại
    const GRADES = [
        { key: 'tot', label: 'Tốt', range: '8 – 10', min: 8, cls: 'g-tot', color: '#10b981' },
        { key: 'kha', label: 'Khá', range: '6.5 – 7.9', min: 6.5, cls: 'g-kha', color: '#0ea5e9' },
        { key: 'dat', label: 'Đạt', range: '5 – 6.4', min: 5, cls: 'g-dat', color: '#f59e0b' },
        { key: 'cd', label: 'Chưa đạt', range: '< 5', min: -Infinity, cls: 'g-cd', color: '#ef4444' }
    ];
    function gradeOf(score) {
        return GRADES.find(g => score >= g.min) || GRADES[3];
    }

    // So sánh tự nhiên: 6A1 < 6A2 < 6A10 < 7A1
    function naturalCompare(a, b) {
        return String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' });
    }

    const api = {
        DUP_WINDOW_MS, escapeHtml, parseTime, schoolYearOf, currentSchoolYear, parseScore,
        parseHinhThuc, buildExamTimeParam, normalizeRow, formatDateTime, attemptKey,
        process, listSchoolYears, GRADES, gradeOf, naturalCompare, normKey
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.EduScores = api;
})(typeof window !== 'undefined' ? window : globalThis);
