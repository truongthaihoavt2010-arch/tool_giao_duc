/**
 * EduScore — Quản Lý Điểm (HTML/JS thuần)
 * Đọc dữ liệu từ Apps Script (dùng chung cấu hình với Robot Tạo Đề: robotWebhookUrl, robotReadKey),
 * xử lý bằng shared/scores.js: năm học, lọc bài trùng, điểm cao nhất mỗi lần kiểm tra, giới hạn số lần.
 */
(function () {
    'use strict';
    const S = window.EduScores;
    const esc = S.escapeHtml;
    const $ = id => document.getElementById(id);

    // ================= TRẠNG THÁI =================
    const CACHE_KEY = 'eduscoreCacheV2';
    const state = {
        rows: [],             // dữ liệu thô (mọi năm học)
        year: S.currentSchoolYear(),
        result: { all: [], best: [] },
        page: 'dashboard',
        scoresMode: 'best',
        scoresSort: { key: 'className', dir: 1 },
        scoresPage: 1,
        loading: false,
        oldScript: false
    };
    const charts = {};

    function lsGet(k, d = '') { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    const cfg = () => ({ url: lsGet('robotWebhookUrl').trim(), key: lsGet('robotReadKey').trim() });

    // ================= TẢI DỮ LIỆU =================
    async function fetchRows(url, key, onRetry) {
        const u = new URL(url);
        u.searchParams.set('year', 'all');
        if (key) u.searchParams.set('key', key);
        let lastErr;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), [30000, 45000, 60000][attempt - 1]); // Google thường 3–20 giây, có lúc chậm hơn
            try {
                const res = await fetch(u.toString(), { signal: ctl.signal });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const text = await res.text();
                let json;
                try { json = JSON.parse(text); } catch (e) { throw new Error('Google trả về dữ liệu không hợp lệ (có thể đang quá tải).'); }
                if (json && json.code === 'unauthorized') {
                    const err = new Error('Sai mã đọc dữ liệu.');
                    err.fatal = err.unauthorized = true;
                    throw err;
                }
                if (!Array.isArray(json)) throw new Error('Dữ liệu không đúng định dạng.');
                return json;
            } catch (e) {
                if (e.fatal) throw e;
                lastErr = ctl.signal.aborted ? new Error('Google Sheets phản hồi quá lâu.') : e;
                console.warn(`[EduScore] Lần ${attempt} tải thất bại:`, lastErr.message);
                if (attempt < 3) { onRetry && onRetry(attempt + 1); await new Promise(r => setTimeout(r, attempt * 2000)); }
            } finally {
                clearTimeout(timer);
            }
        }
        throw lastErr;
    }

    function readCache(url) {
        try {
            const c = JSON.parse(lsGet(CACHE_KEY, 'null'));
            return c && c.url === url && Array.isArray(c.data) ? c : null;
        } catch (e) { return null; }
    }

    async function load(isManual) {
        const { url, key } = cfg();
        if (!url) { showEmpty('Chưa kết nối dữ liệu', 'Nhập URL Google Sheets và mã đọc dữ liệu để xem điểm.'); openSource(); return; }
        if (state.loading) return;
        state.loading = true;
        $('btnRefresh').disabled = true;

        const cached = readCache(url);
        if (!state.rows.length && cached) {
            setData(cached.data);
            setStatus(`⏳ Đang cập nhật từ Google Sheets… (tạm hiển thị dữ liệu lưu lúc ${new Date(cached.time).toLocaleString('vi-VN')})`, 'warn');
        } else {
            setStatus('⏳ Đang tải dữ liệu từ Google Sheets…', 'warn');
            if (!state.rows.length) showEmpty('Đang tải dữ liệu…', 'Google Sheets thường mất vài giây để phản hồi.', true);
        }

        try {
            const rows = await fetchRows(url, key, n => setStatus(`⏳ Google chưa phản hồi, đang thử lại (lần ${n}/3)…`, 'warn'));
            lsSet(CACHE_KEY, JSON.stringify({ url, time: Date.now(), data: rows }));
            setData(rows);
            const upd = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            state.oldScript = rows.length > 0 && rows.every(r => r.year === undefined);
            setStatus(`✅ ${rows.length} bài nộp · cập nhật ${upd}` + (state.oldScript ? ' · ⚠️ Apps Script bản cũ (nên cập nhật để bảo vệ dữ liệu)' : ''), state.oldScript ? 'warn' : 'ok');
        } catch (e) {
            if (e.unauthorized) {
                setStatus('❌ Sai mã đọc dữ liệu', 'off');
                if (!state.rows.length) showEmpty('Sai mã đọc dữ liệu', 'Mã đọc dữ liệu phải giống dòng READ_KEY trong Apps Script.');
                openSource('Sai mã đọc dữ liệu. Nhập đúng mã trong dòng READ_KEY của Apps Script (xem trang "Google Sheets" của Robot Tạo Đề).');
            } else if (cached || state.rows.length) {
                const t = cached ? new Date(cached.time).toLocaleString('vi-VN') : 'trước đó';
                setStatus(`⚠️ Google Sheets tạm lỗi · đang hiển thị dữ liệu lưu lúc ${t} · bấm Làm mới để thử lại`, 'warn');
            } else {
                setStatus('❌ Không tải được dữ liệu', 'off');
                showEmpty('Không tải được dữ liệu', 'Google Sheets có thể đang quá tải. Bấm "Làm mới" sau ít phút, hoặc kiểm tra URL / quyền truy cập "Bất kỳ ai".');
            }
        } finally {
            state.loading = false;
            $('btnRefresh').disabled = false;
        }
    }

    function setData(rows) {
        state.rows = rows;
        const years = S.listSchoolYears(rows);
        if (!years.includes(state.year)) state.year = years[0];
        $('yearSelect').innerHTML = years.map(y => `<option value="${esc(y)}">Năm học ${esc(y)}</option>`).join('');
        $('yearSelect').value = state.year;
        recompute();
    }

    function recompute() {
        state.result = S.process(state.rows, { year: state.year });
        hideEmpty();
        buildFilterOptions();
        render();
    }

    // ================= GIAO DIỆN CHUNG =================
    function setStatus(text, level) {
        $('statusLine').textContent = text;
        const dotCls = level === 'ok' ? '' : level === 'warn' ? 'warn' : 'off';
        const n = state.result.best.length;
        $('sidebarStatus').innerHTML = `<span class="dot ${dotCls}"></span> ${level === 'off' && !state.rows.length ? 'Chưa kết nối' : esc(n + ' lượt kiểm tra')}`;
    }
    function showEmpty(title, text, loading) {
        $('emptyTitle').textContent = title;
        $('emptyText').textContent = text;
        $('btnEmptySource').classList.toggle('hidden', !!loading);
        $('emptyState').classList.remove('hidden');
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    }
    function hideEmpty() {
        $('emptyState').classList.add('hidden');
        showPage(state.page);
    }

    const TITLES = { dashboard: 'Dashboard', scores: 'Bảng điểm', ranking: 'Xếp hạng', charts: 'Biểu đồ' };
    function showPage(page) {
        state.page = page;
        document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
        document.querySelectorAll('.page').forEach(p => p.classList.toggle('hidden', p.id !== 'page-' + page));
        $('pageTitle').textContent = TITLES[page];
        $('sidebar').classList.remove('open');
        render();
    }

    function options(sel, allLabel, values, labelFn) {
        const el = $(sel);
        const cur = el.value;
        el.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(labelFn ? labelFn(v) : v)}</option>`).join('');
        el.value = values.includes(cur) ? cur : '';
    }

    function buildFilterOptions() {
        const best = state.result.best;
        const subjects = [...new Set(best.map(b => b.subject).filter(Boolean))].sort(S.naturalCompare);
        const classes = [...new Set(best.map(b => b.className).filter(Boolean))].sort(S.naturalCompare);
        const hts = [...new Set(best.map(b => b.hinhThuc))].sort(S.naturalCompare);
        ['dashSubject', 'scoresSubject', 'rankSubject', 'chartSubject'].forEach(id => options(id, 'Tất cả môn', subjects));
        ['scoresClass', 'rankClass', 'chartClass'].forEach(id => options(id, 'Tất cả lớp', classes));
        ['dashHinhThuc', 'scoresHinhThuc'].forEach(id => options(id, 'Tất cả hình thức & lần', hts));
    }

    function render() {
        if (!state.rows.length && !readCache(cfg().url)) return;
        if (state.page === 'dashboard') renderDashboard();
        else if (state.page === 'scores') renderScores();
        else if (state.page === 'ranking') renderRanking();
        else if (state.page === 'charts') renderCharts();
    }

    // ================= TIỆN ÍCH THỐNG KÊ =================
    const pct = (n, total) => total ? (n / total * 100).toFixed(1) + '%' : '0%';
    const avgOf = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN;
    const fmt = n => isNaN(n) ? '–' : (Math.round(n * 100) / 100).toString();
    const gradeCls = s => S.gradeOf(s).key;

    function countGrades(list) {
        const c = { total: list.length, tot: 0, kha: 0, dat: 0, cd: 0, dtl: 0 };
        list.forEach(b => { c[S.gradeOf(b.score).key]++; if (b.score >= 5) c.dtl++; });
        return c;
    }

    function filterBest(subject, cls, ht) {
        return state.result.best.filter(b => (!subject || b.subject === subject) && (!cls || b.className === cls) && (!ht || b.hinhThuc === ht));
    }

    function drawChart(id, config) {
        if (charts[id]) charts[id].destroy();
        const canvas = $(id);
        if (!canvas || typeof Chart === 'undefined') return;
        charts[id] = new Chart(canvas, Object.assign({ options: {} }, config));
    }
    const baseOpts = extra => Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: 'Inter', weight: '600' } } } } }, extra);

    function csvDownload(filename, header, rows) {
        const cell = v => {
            let s = String(v == null ? '' : v);
            if (/^[=+\-@]/.test(s)) s = "'" + s; // chặn công thức khi mở bằng Excel
            return /[",\n;]/.test(s) || s !== String(v == null ? '' : v) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const text = '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
        a.download = filename.replace(/[\\/:*?"<>|\s]+/g, '_');
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // ================= DASHBOARD =================
    function statRows(list) {
        const byClass = new Map();
        list.forEach(b => {
            const k = b.className || '(Chưa rõ lớp)';
            if (!byClass.has(k)) byClass.set(k, []);
            byClass.get(k).push(b);
        });
        const rows = [...byClass.keys()].sort(S.naturalCompare).map(k => Object.assign({ lop: k }, countGrades(byClass.get(k))));
        return { rows, sum: Object.assign({ lop: 'Tổng cộng' }, countGrades(list)) };
    }
    const GCOLS = [['tot', 'Tốt', '8 – 10'], ['kha', 'Khá', '6.5 – 7.9'], ['dat', 'Đạt', '5 – 6.4'], ['cd', 'Chưa đạt', '< 5'], ['dtl', 'Đạt trở lên', '5 – 10']];

    function renderDashboard() {
        const subject = $('dashSubject').value, ht = $('dashHinhThuc').value;
        const list = filterBest(subject, '', ht);
        const allInScope = state.result.all.filter(r => !r.dup && (!subject || r.subject === subject) && (!ht || r.hinhThuc === ht));
        const c = countGrades(list);
        const students = new Set(list.map(b => S.normKey(b.name) + '|' + S.normKey(b.className))).size;
        const avg = avgOf(list.map(b => b.score));

        $('kpiTotal').textContent = c.total;
        $('kpiStudents').textContent = students + ' học sinh';
        $('kpiTotalSub').textContent = `${allInScope.length} lần làm bài · mỗi lần kiểm tra lấy điểm cao nhất`;
        $('kpiAvg').textContent = fmt(avg);
        $('kpiAvgBadge').textContent = isNaN(avg) ? '' : S.gradeOf(avg).label;
        $('kpiAvgSub').textContent = list.length ? `Cao nhất ${fmt(Math.max(...list.map(b => b.score)))} · Thấp nhất ${fmt(Math.min(...list.map(b => b.score)))}` : '';
        $('kpiPass').textContent = c.dtl;
        $('kpiPassPct').textContent = pct(c.dtl, c.total);
        $('kpiPassSub').textContent = `Điểm 5 – 10 · Tốt ${c.tot} · Khá ${c.kha} · Đạt ${c.dat}`;
        $('kpiFail').textContent = c.cd;
        $('kpiFailPct').textContent = pct(c.cd, c.total);

        // Bảng xếp loại theo lớp
        const st = statRows(list);
        const head = `<thead><tr><th rowspan="2">Lớp</th><th rowspan="2">Lượt KT</th>${GCOLS.map(([k, l, r]) => `<th colspan="2" class="${k === 'dtl' ? 'col-dtl' : ''}">${l}<div class="sub">${r}</div></th>`).join('')}</tr>
            <tr>${GCOLS.map(([k]) => `<th>SL</th><th class="${k === 'dtl' ? 'col-dtl' : ''}">%</th>`).join('')}</tr></thead>`;
        const line = (r, sum) => `<tr class="${sum ? 'sum' : ''}"><td class="strong">${esc(r.lop)}</td><td>${r.total}</td>${GCOLS.map(([k]) =>
            `<td class="${k === 'dtl' ? 'col-dtl' : ''}"><span class="pill ${k}">${r[k]}</span></td><td class="pct ${k === 'dtl' ? 'col-dtl' : ''}">${pct(r[k], r.total)}</td>`).join('')}</tr>`;
        $('statTable').innerHTML = head + '<tbody>' + (st.rows.length ? st.rows.map(r => line(r, false)).join('') + line(st.sum, true)
            : '<tr class="empty-row"><td colspan="12">Chưa có dữ liệu trong năm học này</td></tr>') + '</tbody>';

        drawChart('chartGrades', {
            type: 'doughnut',
            data: { labels: S.GRADES.map(g => `${g.label} (${g.range})`), datasets: [{ data: S.GRADES.map(g => c[g.key]), backgroundColor: S.GRADES.map(g => g.color), borderWidth: 0 }] },
            options: baseOpts({ cutout: '60%', plugins: { legend: { position: 'right' } } })
        });
        drawChart('chartClassAvg', {
            type: 'bar',
            data: { labels: st.rows.map(r => r.lop), datasets: [{ label: 'Điểm TB', data: st.rows.map(r => +avgOf(list.filter(b => (b.className || '(Chưa rõ lớp)') === r.lop).map(b => b.score)).toFixed(2)), backgroundColor: '#6366f1', borderRadius: 8, maxBarThickness: 48 }] },
            options: baseOpts({ scales: { y: { min: 0, max: 10 } }, plugins: { legend: { display: false } } })
        });
    }

    function exportStatCsv() {
        const subject = $('dashSubject').value, ht = $('dashHinhThuc').value;
        const st = statRows(filterBest(subject, '', ht));
        const header = ['Lớp', 'Lượt KT', ...GCOLS.flatMap(([, l]) => [l + ' (SL)', l + ' (%)'])];
        const rows = [...st.rows, st.sum].map(r => [r.lop, r.total, ...GCOLS.flatMap(([k]) => [r[k], pct(r[k], r.total)])]);
        csvDownload(`ThongKe_XepLoai_${state.year}_${subject || 'TatCaMon'}${ht ? '_' + ht : ''}.csv`, header, rows);
    }

    // ================= BẢNG ĐIỂM =================
    const PAGE_SIZE = 50;
    function scoresData() {
        const subject = $('scoresSubject').value, cls = $('scoresClass').value, ht = $('scoresHinhThuc').value;
        const q = S.normKey($('scoresSearch').value);
        const match = r => (!subject || r.subject === subject) && (!cls || r.className === cls) && (!ht || r.hinhThuc === ht) && (!q || S.normKey(r.name).includes(q));
        let list;
        if (state.scoresMode === 'best') {
            list = state.result.best.filter(match);
        } else {
            const bestIdx = new Set(state.result.best.map(b => b.idx));
            list = state.result.all.filter(match).map(r => Object.assign({}, r, { isBest: bestIdx.has(r.idx) }));
        }
        const { key, dir } = state.scoresSort;
        const val = r => key === 'score' ? r.score : key === 'time' ? (isNaN(r.time) ? 0 : r.time) : key === 'attempts' ? (r.attempts || r.attemptNo || 0) : String(r[key] || '');
        list.sort((a, b) => {
            const va = val(a), vb = val(b);
            const d = typeof va === 'number' ? va - vb : S.naturalCompare(va, vb);
            return d * dir || S.naturalCompare(a.className, b.className) || a.name.localeCompare(b.name, 'vi') || (a.time - b.time);
        });
        return list;
    }

    function renderScores() {
        const list = scoresData();
        const best = state.scoresMode === 'best';
        const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        state.scoresPage = Math.min(state.scoresPage, pages);
        const slice = list.slice((state.scoresPage - 1) * PAGE_SIZE, state.scoresPage * PAGE_SIZE);
        $('scoresCount').textContent = best
            ? `${list.length} kết quả (mỗi học sinh, mỗi lần kiểm tra: điểm cao nhất)`
            : `${list.length} lần nộp bài (kể cả bài gửi trùng và lần vượt giới hạn)`;

        const cols = [['name', 'Họ và tên'], ['className', 'Lớp'], ['subject', 'Môn'], ['hinhThuc', 'Hình thức'], ['time', 'Nộp lúc'], ['score', best ? 'Điểm cao nhất' : 'Điểm'], ['attempts', best ? 'Số lần làm' : 'Lần thứ']];
        const { key, dir } = state.scoresSort;
        const head = '<thead><tr><th>#</th>' + cols.map(([k, l]) => `<th data-sort="${k}">${l}${k === key ? `<span class="arrow">${dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('') + '</tr></thead>';
        const body = slice.length ? slice.map((r, i) => {
            let extra;
            if (best) {
                extra = `${r.attempts}${r.limit ? ` / tối đa ${r.limit}` : ''}${r.ignored ? ` <span class="tag over" title="Các lần vượt giới hạn không được tính">+${r.ignored} vượt giới hạn</span>` : ''}`;
            } else {
                extra = r.dup ? '<span class="tag dup">gửi trùng · không tính</span>'
                    : `${r.attemptNo || ''}${r.overLimit ? ' <span class="tag over">vượt giới hạn · không tính</span>' : ''}${r.isBest ? ' <span class="tag best">★ cao nhất</span>' : ''}`;
            }
            const title = best && r.allScores ? ` title="Điểm các lần: ${esc(r.allScores.join(', '))}"` : '';
            return `<tr class="${!best && (r.dup || r.overLimit) ? 'tr-muted' : ''}"><td>${(state.scoresPage - 1) * PAGE_SIZE + i + 1}</td>
                <td class="strong">${esc(r.name)}</td><td>${esc(r.className)}</td><td>${esc(r.subject)}</td><td>${esc(r.hinhThuc)}</td>
                <td class="muted">${esc(r.dateText)}</td><td><span class="score ${gradeCls(r.score)}">${fmt(r.score)}</span></td><td${title}>${extra}</td></tr>`;
        }).join('') : '<tr class="empty-row"><td colspan="8">Không có kết quả phù hợp</td></tr>';
        $('scoresTable').innerHTML = head + '<tbody>' + body + '</tbody>';

        // Phân trang
        const p = state.scoresPage;
        const nums = [];
        for (let n = Math.max(1, p - 2); n <= Math.min(pages, p + 2); n++) nums.push(n);
        $('scoresPager').innerHTML = `<span>Trang ${p} / ${pages}</span><div class="btns">
            <button data-p="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>
            ${nums.map(n => `<button data-p="${n}" class="${n === p ? 'on' : ''}">${n}</button>`).join('')}
            <button data-p="${p + 1}" ${p === pages ? 'disabled' : ''} aria-label="Trang sau">›</button></div>`;
    }

    function exportScoresCsv() {
        const list = scoresData();
        const best = state.scoresMode === 'best';
        const header = ['STT', 'Họ và tên', 'Lớp', 'Môn', 'Hình thức', 'Nộp lúc', best ? 'Điểm cao nhất' : 'Điểm', 'Xếp loại', best ? 'Số lần làm' : 'Lần thứ', best ? 'Điểm các lần' : 'Ghi chú'];
        const rows = list.map((r, i) => [i + 1, r.name, r.className, r.subject, r.hinhThuc, r.dateText, r.score, S.gradeOf(r.score).label,
            best ? r.attempts + (r.ignored ? ` (+${r.ignored} vượt giới hạn)` : '') : (r.attemptNo || ''),
            best ? r.allScores.join(' ; ') : (r.dup ? 'gửi trùng - không tính' : r.overLimit ? 'vượt giới hạn - không tính' : r.isBest ? 'điểm cao nhất' : '')]);
        csvDownload(`BangDiem_${state.year}_${best ? 'DiemCaoNhat' : 'TatCaLanNop'}.csv`, header, rows);
    }

    // ================= XẾP HẠNG =================
    function rankingData() {
        const list = filterBest($('rankSubject').value, $('rankClass').value, '');
        const byStudent = new Map();
        list.forEach(b => {
            const k = S.normKey(b.name) + '|' + S.normKey(b.className);
            if (!byStudent.has(k)) byStudent.set(k, { name: b.name, className: b.className, scores: [] });
            byStudent.get(k).scores.push(b.score);
        });
        const arr = [...byStudent.values()].map(s => Object.assign(s, { avg: avgOf(s.scores), max: Math.max(...s.scores) }));
        arr.sort((a, b) => b.avg - a.avg || b.max - a.max || a.name.localeCompare(b.name, 'vi'));
        let rank = 0;
        arr.forEach((s, i) => { if (i === 0 || s.avg !== arr[i - 1].avg || s.max !== arr[i - 1].max) rank = i + 1; s.rank = rank; });
        return arr;
    }

    function renderRanking() {
        const arr = rankingData();
        $('rankTable').innerHTML = '<thead><tr><th>Hạng</th><th>Họ và tên</th><th>Lớp</th><th class="num">Số lần KT</th><th class="num">Cao nhất</th><th class="num">Điểm TB</th><th>Xếp loại</th></tr></thead><tbody>' +
            (arr.length ? arr.map(s => {
                const g = S.gradeOf(s.avg);
                return `<tr><td><span class="rank ${s.rank <= 3 ? 'r' + s.rank : ''}">${s.rank}</span></td><td class="strong">${esc(s.name)}</td><td>${esc(s.className)}</td>
                    <td class="num">${s.scores.length}</td><td class="num">${fmt(s.max)}</td><td class="num"><span class="score ${g.key}">${fmt(s.avg)}</span></td><td><span class="pill ${g.key}">${esc(g.label)}</span></td></tr>`;
            }).join('') : '<tr class="empty-row"><td colspan="7">Không có dữ liệu phù hợp</td></tr>') + '</tbody>';
    }

    function exportRankCsv() {
        const rows = rankingData().map(s => [s.rank, s.name, s.className, s.scores.length, s.max, +s.avg.toFixed(2), S.gradeOf(s.avg).label]);
        csvDownload(`XepHang_${state.year}_${$('rankSubject').value || 'TatCaMon'}_${$('rankClass').value || 'TatCaLop'}.csv`,
            ['Hạng', 'Họ và tên', 'Lớp', 'Số lần KT', 'Điểm cao nhất', 'Điểm TB', 'Xếp loại'], rows);
    }

    // ================= BIỂU ĐỒ =================
    function renderCharts() {
        const subject = $('chartSubject').value, cls = $('chartClass').value;
        const list = filterBest(subject, cls, '');

        // Phổ điểm
        const bins = Array(10).fill(0);
        list.forEach(b => { bins[Math.min(9, Math.max(0, Math.floor(b.score)))]++; });
        drawChart('chartHistogram', {
            type: 'bar',
            data: { labels: bins.map((_, i) => i === 9 ? '9 – 10' : `${i} – <${i + 1}`), datasets: [{ label: 'Số lượt', data: bins, backgroundColor: bins.map((_, i) => S.gradeOf(i === 9 ? 9 : i + 0.5).color), borderRadius: 6 }] },
            options: baseOpts({ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } })
        });

        // Điểm TB theo lần kiểm tra, mỗi đường 1 hình thức (15 Phút, 45 Phút...)
        const bases = [...new Set(list.map(b => b.hinhThucBase))].sort(S.naturalCompare);
        const rounds = [...new Set(list.map(b => b.round))].sort((a, b) => a - b);
        const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];
        drawChart('chartRounds', {
            type: 'line',
            data: {
                labels: rounds.map(r => 'Lần ' + r),
                datasets: bases.map((base, i) => ({
                    label: base, borderColor: palette[i % palette.length], backgroundColor: palette[i % palette.length], tension: .3, spanGaps: true,
                    data: rounds.map(r => { const a = avgOf(list.filter(b => b.hinhThucBase === base && b.round === r).map(b => b.score)); return isNaN(a) ? null : +a.toFixed(2); })
                }))
            },
            options: baseOpts({ scales: { y: { min: 0, max: 10 } } })
        });

        // Xếp loại theo lớp (%)
        const st = statRows(filterBest(subject, '', ''));
        drawChart('chartClassGrades', {
            type: 'bar',
            data: { labels: st.rows.map(r => r.lop), datasets: S.GRADES.map(g => ({ label: g.label, backgroundColor: g.color, data: st.rows.map(r => r.total ? +(r[g.key] / r.total * 100).toFixed(1) : 0) })) },
            options: baseOpts({ scales: { x: { stacked: true }, y: { stacked: true, max: 100, ticks: { callback: v => v + '%' } } } })
        });

        // Điểm TB theo môn
        const subs = [...new Set(filterBest('', cls, '').map(b => b.subject))].sort(S.naturalCompare);
        drawChart('chartSubjectAvg', {
            type: 'bar',
            data: { labels: subs, datasets: [{ label: 'Điểm TB', data: subs.map(s => +avgOf(filterBest(s, cls, '').map(b => b.score)).toFixed(2)), backgroundColor: '#10b981', borderRadius: 8, maxBarThickness: 60 }] },
            options: baseOpts({ plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } })
        });
    }

    // ================= NGUỒN DỮ LIỆU & SAO LƯU =================
    function openSource(message) {
        const { url, key } = cfg();
        $('srcUrl').value = url;
        $('srcKey').value = key;
        $('srcErr').textContent = message || '';
        $('srcErr').classList.toggle('hidden', !message);
        $('sourceModal').classList.remove('hidden');
        setTimeout(() => (url ? $('srcKey') : $('srcUrl')).focus(), 50);
    }
    function closeSource() { $('sourceModal').classList.add('hidden'); }
    function saveSource() {
        const url = $('srcUrl').value.trim(), key = $('srcKey').value.trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/.test(url)) {
            $('srcErr').textContent = 'URL phải có dạng https://script.google.com/macros/s/.../exec';
            $('srcErr').classList.remove('hidden');
            return;
        }
        const changed = url !== cfg().url;
        lsSet('robotWebhookUrl', url);
        lsSet('robotReadKey', key);
        if (changed) { state.rows = []; state.result = { all: [], best: [] }; }
        closeSource();
        load(true);
    }

    function backup() {
        if (!state.rows.length) return alert('Chưa có dữ liệu để sao lưu.');
        const rows = state.rows.map((r, i) => [i + 1, r.name, r.subject, r.examTime, r.className, r.date, r.score, r.year || S.schoolYearOf(S.parseTime(r.date))]);
        const d = new Date(); // Ngày theo giờ máy (không dùng toISOString: giờ UTC lệch ngày lúc sáng sớm)
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        csvDownload(`SaoLuu_DuLieuDiem_TatCaNamHoc_${today}.csv`,
            ['STT', 'Họ tên', 'Môn', 'Hình thức KT', 'Lớp', 'Thời gian nộp', 'Điểm', 'Năm học'], rows);
    }

    // ================= SỰ KIỆN =================
    function bind() {
        document.querySelectorAll('.nav-item[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
        $('btnRefresh').addEventListener('click', () => load(true));
        $('btnSource').addEventListener('click', () => openSource());
        $('btnEmptySource').addEventListener('click', () => openSource());
        $('btnBackup').addEventListener('click', backup);
        $('btnMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
        $('srcCancel').addEventListener('click', closeSource);
        $('srcSave').addEventListener('click', saveSource);
        $('sourceModal').addEventListener('click', e => { if (e.target === $('sourceModal')) closeSource(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSource(); });
        ['srcUrl', 'srcKey'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') saveSource(); }));

        $('yearSelect').addEventListener('change', e => { state.year = e.target.value; state.scoresPage = 1; recompute(); });
        ['dashSubject', 'dashHinhThuc'].forEach(id => $(id).addEventListener('change', renderDashboard));
        ['scoresSubject', 'scoresClass', 'scoresHinhThuc'].forEach(id => $(id).addEventListener('change', () => { state.scoresPage = 1; renderScores(); }));
        $('scoresSearch').addEventListener('input', () => { state.scoresPage = 1; renderScores(); });
        ['rankSubject', 'rankClass'].forEach(id => $(id).addEventListener('change', renderRanking));
        ['chartSubject', 'chartClass'].forEach(id => $(id).addEventListener('change', renderCharts));
        document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => {
            state.scoresMode = b.dataset.mode;
            state.scoresPage = 1;
            document.querySelectorAll('.seg-btn').forEach(x => x.classList.toggle('active', x === b));
            renderScores();
        }));
        $('scoresTable').addEventListener('click', e => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;
            const k = th.dataset.sort;
            state.scoresSort = { key: k, dir: state.scoresSort.key === k ? -state.scoresSort.dir : (k === 'score' || k === 'time' ? -1 : 1) };
            renderScores();
        });
        $('scoresPager').addEventListener('click', e => {
            const b = e.target.closest('button[data-p]');
            if (!b || b.disabled) return;
            state.scoresPage = +b.dataset.p;
            renderScores();
        });
        $('btnStatCsv').addEventListener('click', exportStatCsv);
        $('btnScoresCsv').addEventListener('click', exportScoresCsv);
        $('btnRankCsv').addEventListener('click', exportRankCsv);
    }

    bind();
    $('yearSelect').innerHTML = `<option value="${esc(state.year)}">Năm học ${esc(state.year)}</option>`;
    load(false);

    // Cho phép kiểm thử
    window.__eduscore = { state, recompute, load };
})();
