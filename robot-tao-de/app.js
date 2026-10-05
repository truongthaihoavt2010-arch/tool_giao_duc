// API Key: DeepSeek cấu hình ở trang chủ; OpenRouter/Groq (dự phòng) nhập ở trang "Google Sheets" -> lưu trên máy (robotAiKeys)

// ======= DEEPSEEK CONFIG (nhận từ parent hoặc localStorage) =======
let DEEPSEEK_API_KEY = '';
let DEEPSEEK_MODEL = 'deepseek-chat';
let DEEPSEEK_CONNECTED = false;

// Khôi phục config từ localStorage (hỗ trợ mở standalone)
(function loadDeepSeekFromStorage() {
    try {
        const saved = localStorage.getItem('deepseek_config');
        if (saved) {
            const cfg = JSON.parse(saved);
            DEEPSEEK_API_KEY = cfg.apiKey || '';
            DEEPSEEK_MODEL = cfg.model || 'deepseek-chat';
            DEEPSEEK_CONNECTED = cfg.connected || false;
        }
    } catch(e) {}
})();

// Lắng nghe config từ parent window (khi chạy trong iframe)
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'DEEPSEEK_CONFIG') {
        DEEPSEEK_API_KEY = event.data.apiKey || '';
        DEEPSEEK_MODEL = event.data.model || 'deepseek-chat';
        DEEPSEEK_CONNECTED = event.data.connected || false;
        console.log('[Robot Tạo Đề] Nhận config DeepSeek:', DEEPSEEK_MODEL, DEEPSEEK_CONNECTED ? '✅' : '❌');
    }
});

let currentExamData = [];
let diffChartInstance = null;
let lineChartInstance = null;
let extractedFileText = "";
let aiKnowledgeText = "";
let chatHistory = [];

// ======= 1. SPA ROUTING =======
function switchPage(pageId, menuItemEl) {
    // Ẩn tất cả page
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    // Bỏ active menu
    if (menuItemEl) {
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        menuItemEl.classList.add('active');
    }
    // Hiện page
    const page = document.getElementById(pageId);
    if(page) page.style.display = 'block';

    if(pageId === 'page-exams') renderExamsTable();
    if(pageId === 'page-questions') renderQuestionsTable();
    if(pageId === 'page-classes') renderClassesTable();
    if(pageId === 'page-results') renderResultsTable();
}

// ======= 2. QUẢN LÝ DỮ LIỆU & LOCAL STORAGE =======
function getStats() {
    let stats = localStorage.getItem("robotStats");
    if (!stats) {
        stats = { totalExams: 0, totalQuestions: 0, recentExams: [], questionBank: [] };
        localStorage.setItem("robotStats", JSON.stringify(stats));
    } else {
        stats = JSON.parse(stats);
        if(!stats.questionBank) stats.questionBank = [];
    }
    return stats;
}

function saveExamToHistory(subject, grade, numQuestions, title, questionsData, settings) {
    const stats = getStats();
    stats.totalExams++;
    stats.totalQuestions += parseInt(numQuestions);
    
    // Lưu Đề
    stats.recentExams.unshift({
        id: Date.now(),
        title: title || `Đề kiểm tra ${subject} - ${grade}`,
        subject, grade, numQuestions,
        timestamp: new Date().getTime(),
        data: questionsData,
        ...(settings || {})
    });

    // Lưu vào Ngân hàng câu hỏi
    if(questionsData && questionsData.length > 0) {
        questionsData.forEach(q => {
            stats.questionBank.unshift({
                question: q.question,
                difficulty: q.difficulty,
                subject: subject,
                timestamp: new Date().getTime()
            });
        });
    }

    localStorage.setItem("robotStats", JSON.stringify(stats));
    updateStatsUI();
}

function updateStatsUI() {
    const stats = getStats();
    document.getElementById("statTotalExams").innerText = stats.totalExams;
    document.getElementById("statTotalQuestions").innerText = stats.totalQuestions.toLocaleString();
    
    // Render Dashboard list
    const list = document.getElementById("recentExamsList");
    if (stats.recentExams.length === 0) {
        list.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size:13px; padding: 20px;">Chưa có đề nào được tạo.</div>`;
    } else {
        list.innerHTML = "";
        stats.recentExams.slice(0, 5).forEach(exam => {
            const dateStr = new Date(exam.timestamp).toLocaleString("vi-VN");
            list.innerHTML += `
            <div class="recent-item">
                <div class="recent-icon" style="background: rgba(108, 92, 231, 0.1); color: var(--primary);">
                    <i class="fa-solid fa-file-lines"></i>
                </div>
                <div class="recent-info flex-1">
                    <h4>${esc(exam.title)}</h4>
                    <p>${esc(exam.subject)} ${esc(exam.grade)} • ${exam.numQuestions} câu • Tạo lúc: ${dateStr}</p>
                </div>
            </div>`;
        });
    }
}

// Render Bảng Đề của tôi
function renderExamsTable() {
    try {
        const stats = getStats();
        const tbody = document.getElementById('tableExamsBody');
        tbody.innerHTML = '';
        stats.recentExams.forEach(exam => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" value="${exam.id}"></td>
                <td style="font-weight:600; color:var(--primary)">${esc(exam.title || 'Chưa đặt tên')}${exam.type ? `<div style="font-size:12px; font-weight:500; color:var(--text-muted);">${esc(exam.type)} · ${exam.minutes || ''} phút · Lần ${exam.round || 1}</div>` : ''}${publishedBadge(exam.id)}</td>
                <td>${esc(exam.subject || '-')}</td>
                <td>${(exam.khoi || inferKhoi(exam.grade)) ? `<b>Khối ${esc(exam.khoi || inferKhoi(exam.grade))}</b><div style="font-size:12px; color:var(--text-muted);">${esc(exam.grade || '')}</div>` : esc(exam.grade || '-')}</td>
                <td>${exam.numQuestions || 0}</td>
                <td>${exam.timestamp ? new Date(exam.timestamp).toLocaleDateString("vi-VN") : '-'}</td>
                <td>
                    <button class="btn-view" onclick="downloadExam(${exam.id})"><i class="fa-solid fa-download"></i> Tải HTML</button>
                    <button class="btn-view" style="margin-left:5px;" onclick="openBatchPublish([${exam.id}])" title="Đăng đề này lên GitHub và lấy link"><i class="fa-brands fa-github"></i> Đăng GitHub</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) { console.error("Lỗi renderExamsTable", e); }
}

async function downloadExam(id) {
    const stats = getStats();
    const exam = stats.recentExams.find(e => e.id === id);
    if(!exam || !exam.data) return alert("Không tìm thấy dữ liệu gốc của đề này (Có thể đề cũ chưa lưu nội dung).");
    currentExamData = exam.data;
    // Tạm thời gán Môn học trên form giống môn học của đề để file xuất ra đúng tên
    document.getElementById('subject').value = exam.subject || "DeThi";
    exportHTML();
}

// Render Ngân hàng câu hỏi
function renderQuestionsTable() {
    try {
        const stats = getStats();
        const tbody = document.getElementById('tableQuestionsBody');
        tbody.innerHTML = '';
        if(!stats.questionBank) return;
        stats.questionBank.slice(0, 100).forEach((q, index) => { // Limit 100
            let color = q.difficulty === 'Dễ' ? 'var(--c-green)' : (q.difficulty === 'Khó' ? 'var(--c-red)' : 'var(--c-orange)');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" value="${index}"></td>
                <td><span style="background:${color}; color:white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${esc(q.difficulty)}</span></td>
                <td>${esc(q.question)}</td>
                <td>
                    <button class="btn-view" onclick="editQuestion(${index})"><i class="fa-solid fa-pen"></i> Sửa</button>
                    <button class="btn-view" onclick="deleteQuestion(${index})" style="color:var(--c-red); margin-left: 5px;"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) { console.error("Lỗi renderQuestionsTable", e); }
}

function editQuestion(index) {
    const stats = getStats();
    if(stats.questionBank[index]) {
        let newQ = prompt("Chỉnh sửa nội dung câu hỏi:", stats.questionBank[index].question);
        if(newQ && newQ.trim() !== "") {
            stats.questionBank[index].question = newQ.trim();
            localStorage.setItem("robotStats", JSON.stringify(stats));
            renderQuestionsTable();
        }
    }
}

function deleteQuestion(index) {
    if(confirm("Bạn có chắc chắn muốn xóa câu hỏi này khỏi Ngân hàng?")) {
        const stats = getStats();
        stats.questionBank.splice(index, 1);
        localStorage.setItem("robotStats", JSON.stringify(stats));
        renderQuestionsTable();
    }
}

// ======= CÁC HÀM XÓA NHIỀU (BULK DELETE) =======
function toggleSelectAll(tableBodyId, checkbox) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"].row-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

function deleteSelectedExams() {
    const tbody = document.getElementById('tableExamsBody');
    const checkedBoxes = Array.from(tbody.querySelectorAll('input[type="checkbox"].row-checkbox:checked'));
    if (checkedBoxes.length === 0) return alert("Vui lòng chọn ít nhất một đề để xóa.");
    
    if(confirm(`Bạn có chắc chắn muốn xóa ${checkedBoxes.length} đề đã chọn?`)) {
        let stats = getStats();
        const idsToDelete = checkedBoxes.map(cb => parseInt(cb.value));
        stats.recentExams = stats.recentExams.filter(exam => !idsToDelete.includes(exam.id));
        stats.totalExams = stats.recentExams.length;
        localStorage.setItem("robotStats", JSON.stringify(stats));
        document.getElementById('selectAllExams').checked = false;
        renderExamsTable();
        updateStatsUI();
    }
}

function deleteSelectedQuestions() {
    const tbody = document.getElementById('tableQuestionsBody');
    const checkedBoxes = Array.from(tbody.querySelectorAll('input[type="checkbox"].row-checkbox:checked'));
    if (checkedBoxes.length === 0) return alert("Vui lòng chọn ít nhất một câu hỏi để xóa.");
    
    if(confirm(`Bạn có chắc chắn muốn xóa ${checkedBoxes.length} câu hỏi đã chọn?`)) {
        let stats = getStats();
        const indicesToDelete = checkedBoxes.map(cb => parseInt(cb.value)).sort((a, b) => b - a);
        indicesToDelete.forEach(idx => {
            stats.questionBank.splice(idx, 1);
        });
        localStorage.setItem("robotStats", JSON.stringify(stats));
        document.getElementById('selectAllQuestions').checked = false;
        renderQuestionsTable();
    }
}

// ======= CÁC HÀM QUẢN LÝ LỚP HỌC =======
function getClasses() {
    let classes = localStorage.getItem("robotClasses");
    if (!classes) {
        classes = [
            { id: 1, grade: "7", name: "7A1" },
            { id: 2, grade: "12", name: "12A1" },
            { id: 3, grade: "11", name: "11A1" },
            { id: 4, grade: "10", name: "10A1" },
            { id: 5, grade: "9", name: "9A1" },
            { id: 6, grade: "8", name: "8A1" },
            { id: 7, grade: "6", name: "6A1" }
        ];
        localStorage.setItem("robotClasses", JSON.stringify(classes));
    } else {
        classes = JSON.parse(classes);
    }
    return classes;
}

function renderClassesOptions() {
    const classes = getClasses();
    const gradeSelect = document.getElementById("grade");
    if (gradeSelect) {
        gradeSelect.innerHTML = '';
        if (classes.length === 0) {
            gradeSelect.innerHTML = '<option value="">-- Chưa có lớp --</option>';
        } else {
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = `Lớp ${c.name}`;
                opt.textContent = `Lớp ${c.name}`;
                gradeSelect.appendChild(opt);
            });
        }
    }
}

function renderClassesTable() {
    const classes = getClasses();
    const tbody = document.getElementById("tableClassesBody");
    if (tbody) {
        tbody.innerHTML = '';
        classes.forEach(c => {
            const n = Array.isArray(c.students) ? c.students.length : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Khối ${esc(c.grade)}</td>
                <td style="font-weight:600;">Lớp ${esc(c.name)}</td>
                <td>${n ? `<span style="color:var(--c-green); font-weight:600;">${n} học sinh</span>` : '<span style="color:var(--text-muted);">Chưa có</span>'}</td>
                <td>
                    <button class="btn-view" onclick="openStudentsModal(${c.id})"><i class="fa-solid fa-user-group"></i> Danh sách</button>
                    <button class="btn-view" style="color:var(--c-red); margin-left:5px;" onclick="deleteClass(${c.id})"><i class="fa-solid fa-trash"></i> Xóa</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ======= DANH SÁCH HỌC SINH THEO LỚP =======
let editingClassId = null;

function parseStudentNames(text) {
    const seen = new Set();
    return String(text || '').split(/\r?\n/)
        .map(line => line.split('\t').map(x => x.trim()).filter(Boolean))
        // Dán từ Excel: bỏ cột số thứ tự, lấy cột chữ đầu tiên
        .map(cells => cells.find(x => !/^\d+[.)]?$/.test(x)) || '')
        .map(n => n.replace(/^\d+\s*[.)\-:]\s*/, '').replace(/\s+/g, ' ').trim())
        .filter(n => {
            const k = n.toLowerCase();
            if (!n || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
}

function openStudentsModal(id) {
    const c = getClasses().find(x => x.id === id);
    if (!c) return;
    editingClassId = id;
    document.getElementById('studentsModalTitle').innerText = `Danh sách học sinh lớp ${c.name}`;
    const input = document.getElementById('studentsInput');
    input.value = (c.students || []).join('\n');
    const count = () => { document.getElementById('studentsCount').innerText = `${parseStudentNames(input.value).length} học sinh`; };
    input.oninput = count;
    count();
    document.getElementById('studentsModal').classList.add('active');
    setTimeout(() => input.focus(), 50);
}

function closeStudentsModal() {
    document.getElementById('studentsModal').classList.remove('active');
    editingClassId = null;
}

function saveStudentsList() {
    const classes = getClasses();
    const c = classes.find(x => x.id === editingClassId);
    if (!c) return closeStudentsModal();
    c.students = parseStudentNames(document.getElementById('studentsInput').value);
    lsSet('robotClasses', JSON.stringify(classes));
    closeStudentsModal();
    renderClassesTable();
    updateExportOptionNote();
}

// { "6A1": ["Nguyễn Văn An", ...] } cho các lớp áp dụng có danh sách
function getStudentListsFor(classNames) {
    const classes = getClasses();
    const out = {};
    classNames.forEach(name => {
        const c = classes.find(x => String(x.name).trim().toLowerCase() === String(name).trim().toLowerCase());
        if (c && Array.isArray(c.students) && c.students.length) out[name] = c.students.slice();
    });
    return out;
}

function addClass() {
    const grade = document.getElementById("newClassGrade").value;
    const name = document.getElementById("newClassName").value.trim();
    if (!name) return alert("Vui lòng nhập tên lớp!");
    
    let classes = getClasses();
    classes.push({
        id: Date.now(),
        grade: grade,
        name: name
    });
    localStorage.setItem("robotClasses", JSON.stringify(classes));
    document.getElementById("newClassName").value = '';
    renderClassesTable();
    renderClassesOptions();
}

function deleteClass(id) {
    if(confirm("Bạn có chắc chắn muốn xóa lớp này?")) {
        let classes = getClasses();
        classes = classes.filter(c => c.id !== id);
        localStorage.setItem("robotClasses", JSON.stringify(classes));
        renderClassesTable();
        renderClassesOptions();
    }
}

async function downloadWordTemplate() {
    let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>Mẫu Nhập Liệu Tạo Đề</title>
        <style>
            body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; }
            h1 { text-align: center; color: #333; font-size: 18pt; text-transform: uppercase; }
            h3 { color: #2c3e50; }
        </style>
    </head>
    <body>
        <h1>MẪU DỮ LIỆU ĐỂ AI TẠO ĐỀ</h1>
        <p><i>Hướng dẫn: Bạn có thể dán nội dung bài học, hoặc gõ danh sách các câu hỏi có sẵn theo mẫu bên dưới. Sau đó lưu lại và tải lên phần mềm.</i></p>
        <hr>
        
        <h3>1. Dạng Trắc nghiệm 4 lựa chọn</h3>
        <p>Câu 1: Ngôn ngữ lập trình nào phổ biến nhất để làm web frontend?</p>
        <p>A. Python</p>
        <p>B. JavaScript</p>
        <p>C. C++</p>
        <p>D. Java</p>
        <p>Đáp án đúng: B</p>

        <h3>2. Dạng Đúng / Sai</h3>
        <p>Câu 2: Trái đất quay quanh mặt trời.</p>
        <p>Đáp án đúng: Đúng</p>

        <h3>3. Dạng Điền khuyết</h3>
        <p>Câu 3: Bác Hồ sinh năm ___.</p>
        <p>Gợi ý: 1890, 1911, 1895</p>
        <p>Đáp án đúng: 1890</p>

        <h3>4. Dạng Tính toán</h3>
        <p>Câu 4: Tính kết quả của phép tính: 15 + 25 = ?</p>
        <p>Đáp án đúng: 40</p>

        <hr>
        <p><b>--- XÓA NỘI DUNG MẪU TRÊN VÀ NHẬP DỮ LIỆU CỦA BẠN VÀO DƯỚI ĐÂY ---</b></p>
        <p></p>
    </body>
    </html>
    `;
    
    const suggestedName = "Mau_Du_Lieu_Tao_De.doc";
    let finalName = suggestedName;
    
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ 
                suggestedName: suggestedName, 
                types: [{ description: 'Word Document', accept: {'application/msword': ['.doc']} }] 
            });
            const writable = await handle.createWritable();
            await writable.write(new Blob([htmlContent], { type: 'application/msword;charset=utf-8;' }));
            await writable.close();
            return;
        } catch (err) { if (err.name === 'AbortError') return; }
    } else {
        let userInput = prompt("Nhập tên file bạn muốn lưu:", suggestedName);
        if (!userInput) return; 
        if (!userInput.endsWith('.doc') && !userInput.endsWith('.docx')) userInput += '.doc';
        finalName = userInput;
    }
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([htmlContent], { type: 'application/msword;charset=utf-8;' }));
    a.download = finalName;
    a.click();
}

async function downloadQuestionBank() {
    const stats = getStats();
    if(!stats.questionBank || stats.questionBank.length === 0) {
        return alert("Ngân hàng câu hỏi hiện đang trống!");
    }
    
    // Tạo nội dung HTML tương thích với MS Word
    let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>Ngân Hàng Câu Hỏi</title>
        <style>
            body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; }
            h1 { text-align: center; color: #333; font-size: 18pt; text-transform: uppercase; }
            .question { margin-bottom: 20px; }
            .meta { font-style: italic; color: #555; }
            .q-content { font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>NGÂN HÀNG CÂU HỎI TỔNG HỢP</h1>
        <hr>
    `;
    
    stats.questionBank.forEach((q, idx) => {
        let monHoc = q.subject || "Chung";
        let doKho = q.difficulty || "Chưa phân loại";
        let noiDung = (q.question || "").replace(/\n/g, '<br>');
        
        htmlContent += `
        <div class="question">
            <p class="meta"><strong>Câu ${idx + 1}:</strong> [Môn: ${monHoc}] (${doKho})</p>
            <p class="q-content">${noiDung}</p>
        </div>
        `;
    });
    
    htmlContent += `</body></html>`;
    
    const suggestedName = "Ngan_Hang_Cau_Hoi.doc";
    
    let finalName = suggestedName;
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ suggestedName: suggestedName, types: [{ description: 'Word Document', accept: {'application/msword': ['.doc']} }] });
            const writable = await handle.createWritable();
            await writable.write(new Blob([htmlContent], { type: 'application/msword;charset=utf-8;' }));
            await writable.close();
            return;
        } catch (err) { if (err.name === 'AbortError') return; }
    } else {
        let userInput = prompt("Nhập tên file bạn muốn lưu:", suggestedName);
        if (!userInput) return; // Người dùng bấm Hủy
        if (!userInput.endsWith('.doc')) userInput += '.doc';
        finalName = userInput;
        alert("Lưu ý: Nếu file tải thẳng vào thư mục Downloads mà không hỏi nơi lưu, bạn cần vào Cài đặt trình duyệt (Chrome/Edge) -> Tìm kiếm 'Ask where to save each file before downloading' và BẬT tính năng đó lên nhé.");
    }
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([htmlContent], { type: 'application/msword;charset=utf-8;' }));
    a.download = finalName;
    a.click();
}

// ======= 3. BIỂU ĐỒ CHART.JS & GOOGLE SHEETS =======
function initCharts() {
    const ctxDiff = document.getElementById('diffChart').getContext('2d');
    diffChartInstance = new Chart(ctxDiff, {
        type: 'doughnut',
        data: {
            labels: ['Dễ', 'Trung bình', 'Khó'],
            datasets: [{ data: [40, 40, 20], backgroundColor: ['#00b894', '#fdcb6e', '#d63031'], borderWidth: 0, hoverOffset: 4 }]
        },
        options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: true } }, maintainAspectRatio: false }
    });

    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['Chưa có dữ liệu'],
            datasets: [{
                label: 'Điểm TB',
                data: [0],
                borderColor: '#6c5ce7', backgroundColor: 'rgba(108, 92, 231, 0.1)', borderWidth: 2, fill: true, tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10 } } }
    });
}

function updateChart() {
    if (!diffChartInstance) return;
    const easy = parseInt(document.getElementById('diffEasy').value) || 0;
    const med = parseInt(document.getElementById('diffMedium').value) || 0;
    const hard = parseInt(document.getElementById('diffHard').value) || 0;
    diffChartInstance.data.datasets[0].data = [easy, med, hard];
    diffChartInstance.update();
}

// ======= DIFFICULTY QUOTA SYSTEM =======
// Tính toán chính xác số câu hỏi cho từng mức độ khó
function calculateDifficultyQuota(totalQuestions) {
    const pctEasy = parseInt(document.getElementById('diffEasy').value) || 0;
    const pctMed = parseInt(document.getElementById('diffMedium').value) || 0;
    const pctHard = parseInt(document.getElementById('diffHard').value) || 0;
    const N = totalQuestions || parseInt(document.getElementById('numQuestions').value) || 0;
    
    let numEasy = Math.round(N * pctEasy / 100);
    let numHard = Math.round(N * pctHard / 100);
    let numMed = N - numEasy - numHard;
    
    // Đảm bảo không âm
    if (numMed < 0) { numMed = 0; numEasy = Math.min(numEasy, N); numHard = N - numEasy; }
    
    return { 'Dễ': numEasy, 'Trung bình': numMed, 'Khó': numHard, total: N, pctTotal: pctEasy + pctMed + pctHard };
}

// Cập nhật hiển thị số câu hỏi theo mức độ khó real-time
function updateDifficultyQuotaDisplay() {
    const quota = calculateDifficultyQuota();
    const elEasy = document.getElementById('diffEasyCount');
    const elMed = document.getElementById('diffMediumCount');
    const elHard = document.getElementById('diffHardCount');
    const elWarn = document.getElementById('diffWarning');
    
    if (elEasy) elEasy.innerText = quota.total > 0 ? `(${quota['Dễ']} câu)` : '';
    if (elMed) elMed.innerText = quota.total > 0 ? `(${quota['Trung bình']} câu)` : '';
    if (elHard) elHard.innerText = quota.total > 0 ? `(${quota['Khó']} câu)` : '';
    
    if (elWarn) {
        if (quota.pctTotal !== 100) {
            elWarn.style.display = 'block';
            elWarn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Tổng tỷ lệ hiện tại: ${quota.pctTotal}% (phải bằng 100%!)`;
        } else {
            elWarn.style.display = 'none';
        }
    }
}

// Chuẩn hóa nhãn độ khó từ AI (xử lý mọi biến thể)
function normalizeDifficulty(diffStr) {
    if (!diffStr || typeof diffStr !== 'string') return 'Trung bình';
    const d = diffStr.toLowerCase().trim();
    
    // Map Dễ
    if (d === 'dễ' || d === 'de' || d === 'easy' || d === 'dê' || d === 'nhận biết'
        || d === 'nhan biet' || d === 'recognition' || d === 'basic') return 'Dễ';
    
    // Map Khó
    if (d === 'khó' || d === 'kho' || d === 'hard' || d === 'difficult' || d === 'vận dụng cao'
        || d === 'van dung cao' || d === 'vận dụng' || d === 'van dung' || d === 'advanced'
        || d === 'phân tích' || d === 'phan tich' || d === 'analysis') return 'Khó';
    
    // Map Trung bình (mặc định)
    if (d === 'trung bình' || d === 'trung binh' || d === 'tb' || d === 'medium'
        || d === 'thông hiểu' || d === 'thong hieu' || d === 'moderate'
        || d === 'understanding' || d === 'normal') return 'Trung bình';
    
    return 'Trung bình'; // Fallback
}

// Thuật toán cân bằng hạn ngạch mức độ khó
// Đảm bảo kết quả khớp 100% quota Dễ/TB/Khó trong khi tôn trọng phân loại dạng câu hỏi
function balanceDifficultyQuota(questions, diffQuota) {
    if (!questions || questions.length === 0) return questions;
    
    // Bước 1: Chuẩn hóa tất cả nhãn difficulty
    questions.forEach(q => { q.difficulty = normalizeDifficulty(q.difficulty); });
    
    // Bước 2: Đếm hiện trạng
    let counts = { 'Dễ': 0, 'Trung bình': 0, 'Khó': 0 };
    questions.forEach(q => { if (counts[q.difficulty] !== undefined) counts[q.difficulty]++; });
    
    const target = { 'Dễ': diffQuota['Dễ'], 'Trung bình': diffQuota['Trung bình'], 'Khó': diffQuota['Khó'] };
    
    // Bước 3: Nếu đã khớp hoàn hảo, trả về ngay
    if (counts['Dễ'] === target['Dễ'] && counts['Trung bình'] === target['Trung bình'] && counts['Khó'] === target['Khó']) {
        return questions;
    }
    
    // Bước 4: Điều chỉnh - ưu tiên giữ nguyên nhãn AI gán, chỉ chuyển đổi các câu thừa
    const levels = ['Dễ', 'Trung bình', 'Khó'];
    
    // Tìm mức thừa và mức thiếu
    let surplus = {}; // mức -> số câu thừa
    let deficit = {}; // mức -> số câu thiếu
    levels.forEach(lv => {
        let diff = counts[lv] - target[lv];
        if (diff > 0) surplus[lv] = diff;
        else if (diff < 0) deficit[lv] = -diff;
    });
    
    // Chuyển câu từ nhóm thừa sang nhóm thiếu (ưu tiên chuyển mức gần nhất)
    // Thứ tự ưu tiên: Dễ <-> Trung bình <-> Khó (chuyển mức lân cận trước)
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

// ======= GOOGLE SHEETS: CẤU HÌNH, ĐỌC DỮ LIỆU, KẾT QUẢ =======
// Dữ liệu thô từ Google Sheets (mọi năm học); xử lý bằng EduScores (shared/scores.js)
let sheetRows = [];

function lsGet(k, d = '') { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const esc = v => EduScores.escapeHtml(v);

// Mã đọc dữ liệu: chỉ ai có mã mới xem được điểm (được điền sẵn vào mã Apps Script)
function generateReadKey() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, b => chars[b % chars.length]).join('');
}
function getReadKey() {
    let k = lsGet('robotReadKey').trim();
    if (!k) { k = generateReadKey(); lsSet('robotReadKey', k); }
    return k;
}

let gasTemplate = null;
function renderGasCode() {
    const ta = document.getElementById('gasCode');
    if (!ta) return;
    if (gasTemplate === null) gasTemplate = ta.value;
    const input = document.getElementById('readKeyInput');
    const key = (input && input.value.trim()) || getReadKey();
    ta.value = gasTemplate.replace('var READ_KEY = "";', 'var READ_KEY = ' + JSON.stringify(key) + ';');
}
function onReadKeyInput() { renderGasCode(); }
function regenerateReadKey() {
    if (!confirm('Tạo mã đọc dữ liệu mới?\nSau đó bạn PHẢI dán lại mã Apps Script và triển khai Phiên bản mới, nếu không app sẽ không đọc được điểm.')) return;
    document.getElementById('readKeyInput').value = generateReadKey();
    renderGasCode();
}
async function copyGasCode() {
    const ta = document.getElementById('gasCode');
    const status = document.getElementById('gasCopyStatus');
    const key = document.getElementById('readKeyInput').value.trim();
    if (key) lsSet('robotReadKey', key);
    try {
        await navigator.clipboard.writeText(ta.value);
    } catch (e) {
        ta.select();
        document.execCommand('copy');
    }
    status.innerText = 'Đã sao chép! Dán vào Apps Script rồi triển khai.';
    setTimeout(() => { status.innerText = ''; }, 4000);
}

function initSheetSettings() {
    const url = document.getElementById('webhookUrl');
    if (url) url.value = lsGet('robotWebhookUrl');
    const key = document.getElementById('readKeyInput');
    if (key) key.value = getReadKey();
    renderGasCode();
    const ai = getFallbackKeys();
    const or = document.getElementById('openRouterKeyInput');
    const gq = document.getElementById('groqKeyInput');
    if (or) or.value = ai.openrouter;
    if (gq) gq.value = ai.groq;
}

// Gọi Apps Script, thử lại khi Google lỗi tạm thời. Trả về JSON.
async function fetchSheetJson(params, onRetry) {
    const base = lsGet('robotWebhookUrl').trim();
    if (!base) throw new Error('Chưa cấu hình URL Google Sheets (trang "Google Sheets").');
    const u = new URL(base);
    Object.entries(Object.assign({ key: getReadKey() }, params || {})).forEach(([k, v]) => { if (v != null && v !== '') u.searchParams.set(k, v); });

    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), [30000, 45000, 60000][attempt - 1]); // Google thường 3–20 giây, có lúc chậm hơn
        try {
            const res = await fetch(u.toString(), { signal: controller.signal });
            if (!res.ok) throw new Error('Lỗi kết nối Web App URL (HTTP ' + res.status + ').');
            const text = await res.text();
            let json;
            try { json = JSON.parse(text); } catch (e) { throw new Error('Google trả về dữ liệu không hợp lệ (có thể đang quá tải hoặc sai URL).'); }
            if (json && json.code === 'unauthorized') {
                const err = new Error('Sai mã đọc dữ liệu. Mã trong ô "Mã đọc dữ liệu" phải giống mã trong Apps Script.');
                err.fatal = true;
                throw err;
            }
            return json;
        } catch (e) {
            if (e.fatal) throw e;
            lastErr = controller.signal.aborted ? new Error('Google Sheets phản hồi quá lâu.') : e;
            console.warn(`[Google Sheets] Lần ${attempt} thất bại:`, lastErr.message);
            if (attempt < 3) {
                if (onRetry) onRetry(attempt + 1);
                await new Promise(r => setTimeout(r, attempt * 2000));
            }
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastErr;
}

function setSheetStatus(text, color) {
    const el = document.getElementById('csvStatus');
    if (!el) return;
    el.innerText = text;
    el.style.color = color || 'var(--c-green)';
}

async function saveSheetConfigAndCheck() {
    const url = document.getElementById('webhookUrl').value.trim();
    const key = document.getElementById('readKeyInput').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/.test(url)) {
        return setSheetStatus('URL không đúng dạng https://script.google.com/macros/s/.../exec', 'red');
    }
    if (!key) return setSheetStatus('Vui lòng nhập mã đọc dữ liệu (hoặc bấm "Tạo mã mới").', 'red');
    lsSet('robotWebhookUrl', url);
    lsSet('robotReadKey', key);
    setSheetStatus('Đang kiểm tra kết nối...', 'var(--text-muted)');
    try {
        const info = await fetchSheetJson({ action: 'info' }, n => setSheetStatus(`Kết nối chưa được, đang thử lại (lần ${n}/3)...`, 'orange'));
        lsSet('robotGasVersion', Array.isArray(info) ? '1' : String((info && info.version) || ''));
        if (Array.isArray(info)) {
            setSheetStatus('⚠️ Kết nối được, nhưng Google đang chạy Apps Script CŨ: điểm chưa được bảo vệ bằng mã và chưa chia theo năm học. Hãy dán mã ở Bước 1 rồi triển khai "Phiên bản mới".', 'orange');
        } else if (info && info.status === 'success') {
            const prot = info.protected ? 'đã bảo vệ bằng mã đọc' : '⚠️ CHƯA đặt mã đọc (ai có URL đều xem được điểm)';
            const oldVer = info.version < 4 ? ` · ⚠️ Cần cập nhật Apps Script lên bản 4 để lưu "Loại kiểm tra" (dán mã mới, Triển khai › Phiên bản mới)` : '';
            setSheetStatus(`✅ Kết nối thành công · Apps Script phiên bản ${info.version} · ${prot} · Năm học có dữ liệu: ${(info.years || []).join(', ')}${oldVer}`, info.protected && !oldVer ? 'var(--c-green)' : 'orange');
        } else {
            throw new Error('Phản hồi không đúng. Kiểm tra lại URL.');
        }
        await fetchChartData(true);
    } catch (e) {
        setSheetStatus('❌ ' + e.message, 'red');
    }
}

// Tải dữ liệu (mọi năm học) rồi cập nhật trang chủ + trang Xem kết quả
async function fetchChartData(keepStatus) {
    if (!lsGet('robotWebhookUrl').trim()) {
        if (!keepStatus) setSheetStatus('Chưa cấu hình URL Google Sheets.', 'orange');
        return;
    }
    if (!keepStatus) setSheetStatus('Đang tải dữ liệu từ Google Sheets...', 'var(--text-muted)');
    try {
        const rows = await fetchSheetJson({ year: 'all' }, n => { if (!keepStatus) setSheetStatus(`Kết nối chưa được, đang thử lại (lần ${n}/3)...`, 'orange'); });
        if (!Array.isArray(rows)) throw new Error('Dữ liệu không đúng định dạng.');
        sheetRows = rows;
        renderResultsYears();
        renderResultsClasses();
        updateHomeStats();
        if (!keepStatus) setSheetStatus(`Đã tải ${rows.length} bài nộp từ Google Sheets.`);
    } catch (e) {
        setSheetStatus('Lỗi tải dữ liệu: ' + e.message, 'red');
    }
}

// Trang chủ: số học sinh, lượt làm bài, điểm TB (điểm cao nhất mỗi lần kiểm tra) của năm học hiện tại
function updateHomeStats() {
    const r = EduScores.process(sheetRows, { year: EduScores.currentSchoolYear() });
    const cards = document.querySelectorAll('.stat-card h3');
    const students = new Set(r.best.map(b => EduScores.normKey(b.name) + '|' + EduScores.normKey(b.className))).size;
    const counted = r.all.filter(x => !x.dup).length;
    const avg = r.best.length ? (r.best.reduce((s, b) => s + b.score, 0) / r.best.length).toFixed(1) : '-';
    if (cards[2]) cards[2].innerText = students;
    if (cards[3]) cards[3].innerText = counted;
    if (cards[4]) cards[4].innerHTML = esc(avg) + '<span style="font-size:14px;color:var(--text-muted)">/10</span>';

    // Biểu đồ: điểm TB theo ngày
    const byDay = new Map();
    r.best.filter(b => !isNaN(b.time)).sort((a, b) => a.time - b.time).forEach(b => {
        const d = new Date(b.time);
        const k = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(b.score);
    });
    if (lineChartInstance && byDay.size) {
        lineChartInstance.data.labels = [...byDay.keys()];
        lineChartInstance.data.datasets[0].data = [...byDay.values()].map(a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1));
        lineChartInstance.update();
    }
}

// ======= XEM KẾT QUẢ (điểm cao nhất mỗi lần kiểm tra) =======
function renderResultsYears() {
    const sel = document.getElementById('resultsYearSelect');
    if (!sel) return;
    const cur = sel.value || EduScores.currentSchoolYear();
    sel.innerHTML = EduScores.listSchoolYears(sheetRows).map(y => `<option value="${esc(y)}">Năm học ${esc(y)}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : sel.options[0].value;
}

function getResultsBest() {
    const year = document.getElementById('resultsYearSelect')?.value || EduScores.currentSchoolYear();
    return EduScores.process(sheetRows, { year }).best;
}

function renderResultsClasses() {
    const select = document.getElementById('resultsClassSelect');
    if (!select) return;
    const currentVal = select.value;
    const classes = [...new Set(getResultsBest().map(b => b.className).filter(Boolean))].sort(EduScores.naturalCompare);
    select.innerHTML = '<option value="">-- Tất cả các lớp --</option>' + classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if (classes.includes(currentVal)) select.value = currentVal;
    renderResultsTable();
}

function getResultsFiltered() {
    const selectedClass = document.getElementById('resultsClassSelect')?.value || '';
    return getResultsBest()
        .filter(b => !selectedClass || b.className === selectedClass)
        .sort((a, b) => EduScores.naturalCompare(a.className, b.className) || a.name.localeCompare(b.name, 'vi') ||
            EduScores.naturalCompare(a.subject, b.subject) || EduScores.naturalCompare(a.hinhThuc, b.hinhThuc));
}

function attemptsText(b) {
    let s = String(b.attempts);
    if (b.limit) s += ` / tối đa ${b.limit}`;
    if (b.ignored) s += ` (${b.ignored} lần vượt giới hạn không tính)`;
    return s;
}

function renderResultsTable() {
    const tbody = document.getElementById('tableResultsBody');
    if (!tbody) return;
    if (sheetRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color:var(--text-muted)">Chưa có dữ liệu, vui lòng cấu hình Google Sheets và chọn "Làm mới".</td></tr>';
        return;
    }
    const list = getResultsFiltered();
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color:var(--text-muted)">Không có kết quả nào.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map((b, i) => {
        const g = EduScores.gradeOf(b.score);
        return `<tr>
            <td style="text-align:center;">${i + 1}</td>
            <td style="font-weight:600;">${esc(b.name)}</td>
            <td>${esc(b.subject || '-')}</td>
            <td>${esc(b.hinhThuc)}</td>
            <td>${esc(b.className || '-')}</td>
            <td>${esc(b.dateText || '-')}</td>
            <td style="text-align:center;"><strong style="color:${g.color};">${b.score}</strong> <span style="font-size:11px; color:${g.color};">${esc(g.label)}</span></td>
            <td style="text-align:center;" title="Điểm các lần: ${esc(b.allScores.join(', '))}">${esc(attemptsText(b))}</td>
        </tr>`;
    }).join('');
}

// Ô CSV an toàn (chặn công thức khi mở bằng Excel)
function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}

function downloadResultsCsv() {
    if (sheetRows.length === 0) return alert("Chưa có dữ liệu để tải. Vui lòng làm mới.");
    const list = getResultsFiltered();
    if (list.length === 0) return alert("Không có dữ liệu phù hợp.");
    const selectedClass = document.getElementById('resultsClassSelect').value;
    const year = document.getElementById('resultsYearSelect').value;
    let csv = '﻿' + ['STT', 'HỌ TÊN', 'MÔN', 'HÌNH THỨC KT', 'LỚP', 'NỘP LÚC', 'ĐIỂM CAO NHẤT', 'XẾP LOẠI', 'SỐ LẦN LÀM', 'ĐIỂM CÁC LẦN'].join(',') + '\n';
    list.forEach((b, i) => {
        csv += [i + 1, b.name, b.subject, b.hinhThuc, b.className, b.dateText, b.score, EduScores.gradeOf(b.score).label, attemptsText(b), b.allScores.join(' ; ')].map(csvCell).join(',') + '\n';
    });
    const filename = `BangDiem_${year}_${selectedClass ? selectedClass.replace(/\s+/g, '_') : 'TatCa'}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ======= AI DỰ PHÒNG =======
function getFallbackKeys() {
    try { return Object.assign({ openrouter: '', groq: '' }, JSON.parse(lsGet('robotAiKeys', '{}'))); } catch (e) { return { openrouter: '', groq: '' }; }
}
function saveFallbackKeys() {
    lsSet('robotAiKeys', JSON.stringify({
        openrouter: document.getElementById('openRouterKeyInput').value.trim(),
        groq: document.getElementById('groqKeyInput').value.trim()
    }));
    const s = document.getElementById('fallbackKeyStatus');
    s.innerText = 'Đã lưu.';
    setTimeout(() => { s.innerText = ''; }, 3000);
}

// ======= 4. CHATBOT AI =======
function toggleChatbot() {
    const win = document.getElementById("chatbotWindow");
    win.classList.toggle("active");
}

async function sendChatMessage() {
    const inputEl = document.getElementById("chatInput");
    const msg = inputEl.value.trim();
    if (!msg) return;
    
    appendChatMessage(msg, "user");
    inputEl.value = "";
    
    chatHistory.push({"role": "user", "content": msg});
    
    const loadingId = appendChatMessage("...", "bot");
    
    try {
        const res = await callAI(chatHistory, true);
        const botMsg = res.choices[0].message.content;
        chatHistory.push({"role": "assistant", "content": botMsg});
        document.getElementById(loadingId).innerText = botMsg;
    } catch (e) {
        document.getElementById(loadingId).innerText = "Lỗi kết nối AI: " + e.message;
        document.getElementById(loadingId).style.color = "red";
    }
}

function handleChatEnter(e) {
    if (e.key === 'Enter') sendChatMessage();
}

function appendChatMessage(text, sender) {
    const body = document.getElementById("chatBody");
    const div = document.createElement("div");
    div.className = "chat-msg " + sender;
    div.id = "msg_" + Date.now();
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div.id;
}

// ======= 5. AI GENERATOR LOGIC =======
// countsOverride: {mcq, tf, fill, calc} — dùng khi cần tạo bù số câu còn thiếu
// avoidQuestions: danh sách câu hỏi đã có, để AI không tạo trùng
function buildPrompt(contextText, countsOverride = null, avoidQuestions = []) {
    const subject = document.getElementById('subject').value || "Không xác định";
    const grade = document.getElementById('grade').value || "Không xác định";
    const khoi = document.getElementById('khoi')?.value || '';
    const numQuestions = countsOverride
        ? Object.values(countsOverride).reduce((a, b) => a + b, 0)
        : document.getElementById('numQuestions').value;
    const topic = document.getElementById('topicInput').value || "";
    const descInput = document.getElementById('descInput') ? document.getElementById('descInput').value.trim() : "";
    const diffEasy = document.getElementById('diffEasy').value;
    const diffMed = document.getElementById('diffMedium').value;
    const diffHard = document.getElementById('diffHard').value;

    // Tính toán chính xác số câu hỏi cho từng mức độ khó
    const N = parseInt(numQuestions) || 0;
    const diffQuota = calculateDifficultyQuota(N);
    const numEasy = diffQuota['Dễ'];
    const numMed = diffQuota['Trung bình'];
    const numHard = diffQuota['Khó'];

    let typeCounts = [];
    if (countsOverride) {
        for (let t in countsOverride) if (countsOverride[t] > 0) typeCounts.push([t, countsOverride[t]]);
    } else {
        document.querySelectorAll('input[name="qType"]:checked').forEach(cb => {
            typeCounts.push([cb.value, parseInt(document.getElementById('numType_' + cb.value).value) || 0]);
        });
    }
    let qTypes = [];
    let explicitRanges = [];
    let currentIndex = 1;

    typeCounts.forEach(([type, num]) => {
        qTypes.push(type);
        let typeName = "";
        if (type === 'mcq') typeName = "Trắc nghiệm 4 lựa chọn";
        if (type === 'tf') typeName = "Đúng/Sai";
        if (type === 'fill') typeName = "Điền khuyết";
        if (type === 'calc') typeName = "Tính toán / Tự luận";

        if (num > 0) {
            let endIdx = currentIndex + num - 1;
            if (num === 1) {
                explicitRanges.push(`- CÂU SỐ ${currentIndex}: Tạo 1 câu dạng ${typeName} (Bắt buộc dùng "type": "${type}").`);
            } else {
                explicitRanges.push(`- TỪ CÂU SỐ ${currentIndex} ĐẾN CÂU SỐ ${endIdx}: Tạo ${num} câu dạng ${typeName} (Bắt buộc dùng "type": "${type}").`);
            }
            currentIndex = endIdx + 1;
        }
    });

    if (explicitRanges.length === 0) {
        qTypes = ["mcq"];
        explicitRanges = [`- TỪ CÂU SỐ 1 ĐẾN CÂU SỐ ${numQuestions}: Tạo ${numQuestions} câu dạng Trắc nghiệm (Bắt buộc dùng "type": "mcq").`];
    }

    let formatInstructions = `OUTPUT FORMAT: Trả về ONLY valid JSON array. Mỗi object PHẢI có thuộc tính "type" là 1 trong các loại sau:\n`;
    if (qTypes.includes("mcq")) formatInstructions += `- {"type": "mcq", "question": "...","options": ["A","B","C","D"],"correctAnswerIndex": 0,"difficulty": "Dễ","explanation": "..."}\n  (BẮT BUỘC có đúng 4 phương án, nếu tài liệu là dạng Đúng/Sai thì tự tạo thêm 2 phương án sai)\n`;
    if (qTypes.includes("tf")) formatInstructions += `- {"type": "tf", "question": "...","options": ["Đúng","Sai"],"correctAnswerIndex": 0,"difficulty": "Dễ","explanation": "..."}\n  (BẮT BUỘC chỉ có 2 phương án là "Đúng" và "Sai")\n`;
    if (qTypes.includes("fill")) formatInstructions += `- {"type": "fill", "question": "Đoạn văn có chỗ trống ___","options": ["gợi ý 1","gợi ý 2"],"correctAnswerText": "đáp án","difficulty": "Dễ","explanation": "..."}\n`;
    if (qTypes.includes("calc")) formatInstructions += `- {"type": "calc", "question": "Tính 1+1=","correctAnswerText": "2","difficulty": "Khó","explanation": "..."}\n  (VỚI DẠNG TÍNH TOÁN: "correctAnswerText" CHỈ ĐƯỢC ĐIỀN SỐ, TUYỆT ĐỐI KHÔNG KÈM CHỮ HAY ĐƠN VỊ)\n`;

    // Xây dựng hướng dẫn phân bổ mức độ khó chi tiết
    let difficultyInstructions = `\n\n=== QUY TẮC PHÂN BỔ MỨC ĐỘ KHÓ (CỰC KỲ QUAN TRỌNG) ===
Trong TỔNG SỐ ${N} câu, bạn PHẢI tạo CHÍNH XÁC:
- ${numEasy} câu mức "Dễ" (Nhận biết): Câu hỏi kiểm tra định nghĩa, khái niệm cơ bản, nhận biết thông tin trực tiếp từ bài học/tài liệu. Học sinh chỉ cần nhớ và nhận ra kiến thức.
- ${numMed} câu mức "Trung bình" (Thông hiểu): Câu hỏi yêu cầu giải thích, phân biệt, so sánh hoặc áp dụng lý thuyết/công thức đơn giản. Học sinh cần hiểu bản chất vấn đề.
- ${numHard} câu mức "Khó" (Vận dụng cao): Câu hỏi tư duy logic, tình huống thực tế phức tạp, phân tích đa chiều hoặc liên hệ thực tiễn cần suy luận nhiều bước. Câu hỏi phải thực sự thách thức.

Giá trị "difficulty" của mỗi câu hỏi BẮT BUỘC phải là MỘT TRONG 3 chuỗi: "Dễ", "Trung bình", "Khó". KHÔNG ĐƯỢC dùng giá trị khác.\n`;

    return `Bạn là Robot tạo đề kiểm tra chuyên nghiệp.
Nhiệm vụ: Tạo CHÍNH XÁC ĐÚNG SỐ LƯỢNG câu hỏi theo cấu trúc được giao. ĐÁNH SỐ THỨ TỰ CÂU HỎI RÕ RÀNG TRONG TÂM TRÍ BẠN ĐỂ KHÔNG TẠO THIẾU HAY THỪA.
TỔNG SỐ CÂU YÊU CẦU: ${numQuestions} câu.
CHI TIẾT:
${explicitRanges.join("\n")}

Môn học: ${subject}, Khối lớp: ${khoi ? khoi + ' (các lớp: ' + grade + ')' : grade}
Chủ đề ra đề: ${topic}
Mô tả chi tiết: ${descInput || "Không có"}
Phân bổ mức độ: CHÍNH XÁC ${numEasy} câu Dễ (${diffEasy}%), ${numMed} câu Trung bình (${diffMed}%), ${numHard} câu Khó (${diffHard}%).
Tài liệu tham khảo (nếu có): ${contextText.substring(0, 15000)}

LƯU Ý QUAN TRỌNG: 
1. Hãy đếm kỹ số lượng câu hỏi mỗi loại bạn tạo ra. Đảm bảo tổng số lượng từng loại khớp chính xác 100% với yêu cầu trên.
2. NẾU CÓ TÀI LIỆU THAM KHẢO, BẠN PHẢI ƯU TIÊN BÁM SÁT 100% NỘI DUNG TÀI LIỆU ĐỂ TẠO CÂU HỎI. CHỈ SỬ DỤNG KIẾN THỨC BÊN NGOÀI NẾU TÀI LIỆU KHÔNG ĐỦ THÔNG TIN.
3. Số lượng câu hỏi ở phần CHI TIẾT phía trên là bắt buộc, kể cả khi phần "Mô tả chi tiết" ghi số lượng khác.
4. Viết lời giải "explanation" ngắn gọn (1-2 câu) để không vượt quá độ dài cho phép.
${avoidQuestions.length > 0 ? `5. KHÔNG được tạo lại các câu hỏi đã có sau đây (phải tạo câu MỚI, nội dung khác):\n${avoidQuestions.map(q => "- " + String(q).substring(0, 150)).join("\n")}\n` : ""}${formatInstructions}${difficultyInstructions}`;
}

// Sửa các lỗi JSON phổ biến của AI: dấu \ không hợp lệ (LaTeX như \frac), dấu phẩy thừa
function sanitizeAIJson(str) {
    return str
        .replace(/\\(\\|["\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (m, valid) => valid ? m : '\\\\')
        .replace(/,\s*([\]}])/g, '$1');
}

// Các lệnh LaTeX trùng với escape hợp lệ của JSON (\f, \b, \n, \r, \t) — nếu không xử lý,
// "\frac" sẽ bị JSON.parse hiểu thành ký tự form-feed + "rac"
const LATEX_ESCAPE_CLASH = /\\\\|\\(?=(?:frac|forall|flat|beta|bar|binom|bot|bullet|bigg?|Bigg?|begin|boxed|because|neq|nu|nabla|neg|notin|not|newline|right|rho|rangle|rceil|rfloor|rm|times|theta|tau|tan|textbf|textit|text|tfrac|therefore|tilde|triangle)(?![a-zA-Z]))/g;

function protectLatex(str) {
    return str.replace(LATEX_ESCAPE_CLASH, m => m === '\\\\' ? m : '\\\\');
}

function tryParseJSON(str) {
    try { return JSON.parse(str); } catch (e) {}
    try { return JSON.parse(sanitizeAIJson(str)); } catch (e) {}
    return undefined;
}

// Parse mảng câu hỏi từ phản hồi AI, chịu được code fence, văn bản thừa và output bị cắt ngang
function parseAIQuestionsJSON(content) {
    if (!content || typeof content !== 'string') return null;
    let text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Bỏ code fence (kể cả khi fence chưa đóng do output bị cắt)
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (fence && fence[1].trim()) text = fence[1].trim();
    text = protectLatex(text);

    // 1. Thử parse toàn bộ
    let whole = tryParseJSON(text);
    if (whole !== undefined) {
        if (Array.isArray(whole)) return whole;
        if (whole && typeof whole === 'object') {
            for (let key in whole) if (Array.isArray(whole[key])) return whole[key];
            if (whole.question) return [whole];
        }
    }

    // 2. Quét từng object hoàn chỉnh ở cấp cao nhất (bỏ qua object cuối bị cắt dở)
    const start = text.indexOf('[');
    const from = start !== -1 ? start + 1 : 0;
    const items = [];
    let depth = 0, inStr = false, esc = false, objStart = -1;
    for (let i = from; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') { if (depth === 0) objStart = i; depth++; }
        else if (c === '}') {
            depth--;
            if (depth === 0 && objStart !== -1) {
                const obj = tryParseJSON(text.substring(objStart, i + 1));
                if (obj && typeof obj === 'object' && obj.question) items.push(obj);
                objStart = -1;
            }
            if (depth < 0) depth = 0;
        }
        else if (c === ']' && depth === 0 && start !== -1) break;
    }
    if (items.length > 0) console.log("[AI] Phục hồi JSON theo từng câu. Lấy được", items.length, "câu.");
    return items;
}

// Chuẩn hóa "type" do AI đặt (tiếng Việt, tiếng Anh, thiếu type) về mcq/tf/fill/calc
function normalizeQuestionType(q) {
    const t = typeof q.type === 'string' ? q.type.toLowerCase().trim() : '';
    if (['mcq', 'tf', 'fill', 'calc'].includes(t)) { q.type = t; return q; }
    if (t.includes('trắc') || t.includes('multiple') || t.includes('choice')) q.type = 'mcq';
    else if (t.includes('đúng') || t.includes('sai') || t.includes('true') || t.includes('false') || t === 'tf') q.type = 'tf';
    else if (t.includes('điền') || t.includes('khuyết') || t.includes('fill') || t.includes('blank')) q.type = 'fill';
    else if (t.includes('tính') || t.includes('luận') || t.includes('calc') || t.includes('essay')) q.type = 'calc';
    else {
        // Không có type hợp lệ: suy ra từ cấu trúc câu hỏi
        const opts = Array.isArray(q.options) ? q.options : [];
        if (opts.length === 2 && /đúng/i.test(opts[0]) && /sai/i.test(opts[1])) q.type = 'tf';
        else if (opts.length >= 3 && q.correctAnswerIndex !== undefined) q.type = 'mcq';
        else if (/_{2,}|\.{3,}/.test(q.question || '')) q.type = 'fill';
        else if (q.correctAnswerText !== undefined || q.answer !== undefined) q.type = 'calc';
    }
    return q;
}

function countQuestionsByType(questions) {
    const counts = { mcq: 0, tf: 0, fill: 0, calc: 0 };
    questions.forEach(q => { if (counts[q.type] !== undefined) counts[q.type]++; });
    return counts;
}

// Gọi AI với prompt tạo đề, trả về mảng câu hỏi đã chuẩn hóa type
async function requestAIQuestions(prompt) {
    const res = await callAI([{"role": "user", "content": prompt}], false);
    const content = res.choices[0].message.content;
    if (res.choices[0].finish_reason === 'length') {
        console.warn("[AI] Output bị cắt do vượt giới hạn token, sẽ phục hồi các câu hoàn chỉnh và tạo bù phần thiếu.");
    }
    const questions = parseAIQuestionsJSON(content) || [];
    if (questions.length === 0) console.error("[AI] Nội dung AI trả về không parse được:", content);
    return questions.filter(q => q && typeof q === 'object').map(normalizeQuestionType);
}

// Hàm gọi API chung cho cả Tạo Đề và Chatbot
async function callAI(messagesArr, isChat = false) {
    let systemMsg = isChat ? 
        "Bạn là Trợ lý AI giáo dục thông minh. Trả lời giáo viên bằng tiếng Việt thân thiện, súc tích, cung cấp thông tin hữu ích về giảng dạy." + 
        (aiKnowledgeText ? "\n\nDưới đây là tài liệu tham khảo người dùng vừa nạp, hãy ƯU TIÊN DÙNG thông tin này để trả lời nếu được hỏi:\n\n" + aiKnowledgeText.substring(0, 10000) : "") : 
        "You must output ONLY a valid JSON array.";
    
    let messages = [{"role": "system", "content": systemMsg}].concat(messagesArr);

    let errorLogs = [];
    
    // ===== PRIORITY 1: DeepSeek (trả phí, ưu tiên cao nhất) =====
    if (DEEPSEEK_CONNECTED && DEEPSEEK_API_KEY) {
        try {
            console.log('[AI] Đang gọi DeepSeek:', DEEPSEEK_MODEL);
            const response = await fetch("https://api.deepseek.com/chat/completions", {
                method: "POST", 
                headers: { 
                    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ 
                    "model": DEEPSEEK_MODEL, 
                    "messages": messages, 
                    "max_tokens": 8192 
                })
            });
            if (response.ok) {
                console.log('[AI] ✅ DeepSeek thành công!');
                return await response.json();
            }
            else errorLogs.push(`DeepSeek (${DEEPSEEK_MODEL}): ` + await response.text());
        } catch(e) { errorLogs.push(`DeepSeek Network Error: ` + e.message); }
    }

    // ===== PRIORITY 2: OpenRouter (miễn phí, fallback) =====
    const OPENROUTER_MODELS = [
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "qwen/qwen-2.5-7b-instruct:free",
        "mistralai/mistral-7b-instruct:free"
    ];

    const fallbackKeys = getFallbackKeys();
    for (let model of (fallbackKeys.openrouter ? OPENROUTER_MODELS : [])) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST", headers: { "Authorization": `Bearer ${fallbackKeys.openrouter}`, "Content-Type": "application/json" },
                body: JSON.stringify({ "model": model, "messages": messages, "max_tokens": 8000 })
            });
            if (response.ok) return await response.json();
            else errorLogs.push(`OpenRouter (${model}): ` + await response.text());
        } catch(e) { errorLogs.push(`OpenRouter Network Error (${model}): ` + e.message); }
    }
    
    // ===== PRIORITY 3: Groq (miễn phí, fallback cuối) =====
    if (fallbackKeys.groq) try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${fallbackKeys.groq}`, "Content-Type": "application/json" },
            body: JSON.stringify({ "model": "llama-3.1-8b-instant", "messages": messages, "max_tokens": 8000 })
        });
        if (response.ok) return await response.json();
        else errorLogs.push("Groq: " + await response.text());
    } catch(e) { errorLogs.push("Groq Network Error: " + e.message); }
    
    if (errorLogs.length === 0) {
        throw new Error("Chưa có AI nào được cấu hình: hãy kết nối DeepSeek ở trang chủ, hoặc nhập key OpenRouter/Groq ở trang \"Google Sheets\".");
    }
    throw new Error("Tất cả API thất bại.\n" + errorLogs.join("\n"));
}

async function startGeneration(isAutoMode = false) {
    const typeEl = document.getElementById('examType');
    if (typeEl && !typeEl.value) { alert('Vui lòng chọn Loại kiểm tra (Thường xuyên, Giữa kỳ, Cuối kỳ...) để phân biệt các bài cùng thời gian làm bài.'); typeEl.focus(); return; }
    const khoiEl = document.getElementById('khoi');
    if (khoiEl && !khoiEl.value) { alert('Vui lòng chọn Khối (6 – 12) cho đề để phân biệt đề của từng khối khi đăng lên GitHub.'); khoiEl.focus(); return; }
    if (khoiEl) {
        const bad = khoiMismatch(khoiEl.value, parseClasses(document.getElementById('grade').value));
        if (bad.length && !confirm(`Lớp ${bad.join(', ')} không thuộc Khối ${khoiEl.value}. Bạn vẫn muốn tạo đề cho các lớp này?`)) return;
    }
    let contextText = "";
    
    if (!isAutoMode) {
        contextText = document.getElementById('inputText').value.trim();
        if (!contextText && extractedFileText) contextText = extractedFileText;
        if (!contextText) return alert("Vui lòng dán văn bản hoặc tải file tài liệu lên!");
    } else {
        const topic = document.getElementById('topicInput').value.trim();
        if (!topic) return alert("Vui lòng nhập 'Chủ đề' để AI có thể tự động tạo đề!");
        if (aiKnowledgeText) contextText = aiKnowledgeText;
    }

    closeInputModal();
    
    document.getElementById('loadingOverlay').classList.add('active');
    const loadingSubtext = document.querySelector('#loadingOverlay .loading-subtext');
    if (loadingSubtext) loadingSubtext.innerText = "Đang thiết lập ma trận đề và xuất dữ liệu.";

    try {
        let data = null;
        const topic = document.getElementById('topicInput').value.trim();
        
        let requiredCounts = {
            'mcq': parseInt(document.getElementById('numType_mcq').value) || 0,
            'tf': parseInt(document.getElementById('numType_tf').value) || 0,
            'fill': parseInt(document.getElementById('numType_fill').value) || 0,
            'calc': parseInt(document.getElementById('numType_calc').value) || 0
        };
        
        if (!isAutoMode) {
            data = parseLocalExamText(contextText);
            if (!data || data.length === 0) {
                throw new Error("Không tìm thấy câu hỏi nào hợp lệ trong tài liệu. Vui lòng đảm bảo tài liệu đúng định dạng mẫu (Có 'Câu 1:', 'A.', 'B.', 'Đáp án đúng:').");
            }
            await new Promise(r => setTimeout(r, 1000));
        } else {
            data = await requestAIQuestions(buildPrompt(contextText));
            if (data.length === 0) {
                throw new Error("AI không trả về đúng định dạng JSON. Vui lòng thử lại.");
            }

            // Tạo bù nếu AI trả thiếu câu (do bị cắt ngang hoặc đếm sai), tối đa 3 lượt
            for (let attempt = 1; attempt <= 3; attempt++) {
                const have = countQuestionsByType(data);
                let missing = {}, totalMissing = 0;
                for (let t in requiredCounts) {
                    missing[t] = Math.max(0, requiredCounts[t] - have[t]);
                    totalMissing += missing[t];
                }
                if (totalMissing === 0) break;
                console.log(`[AI] Thiếu ${totalMissing} câu, tạo bù lượt ${attempt}:`, missing);
                if (loadingSubtext) loadingSubtext.innerText = `AI đang tạo bù ${totalMissing} câu còn thiếu (lượt ${attempt})...`;
                try {
                    const extra = await requestAIQuestions(buildPrompt(contextText, missing, data.map(q => q.question)));
                    if (extra.length === 0) continue;
                    data = data.concat(extra);
                } catch (e) {
                    console.warn("[AI] Tạo bù thất bại:", e.message);
                    break;
                }
            }
        }

        if (data && Array.isArray(data)) {
            let groupedData = { 'mcq': [], 'tf': [], 'fill': [], 'calc': [] };
            data.forEach(q => {
                normalizeQuestionType(q);

                // Chuẩn hóa correctAnswerText nếu AI dùng key khác
                if ((q.type === 'fill' || q.type === 'calc') && q.correctAnswerText === undefined) {
                    q.correctAnswerText = q.correctAnswer || q.answer || q.correct_answer || q.correct || "";
                }
                
                if (q.type === 'calc') {
                    // Nếu đáp án có chữ, cố gắng loại bỏ chữ chỉ giữ lại số (cho phép số âm, dấu thập phân)
                    if (typeof q.correctAnswerText === 'string') {
                        let numMatch = q.correctAnswerText.match(/-?\d+([.,]\d+)?/);
                        if (numMatch) {
                            q.correctAnswerText = numMatch[0];
                        }
                    } else if (typeof q.correctAnswerText === 'number') {
                        q.correctAnswerText = q.correctAnswerText.toString();
                    }
                }

                if (groupedData[q.type]) groupedData[q.type].push(q);
            });
            
            let finalData = [];
            for (let t in requiredCounts) {
                let req = requiredCounts[t];
                if (req > 0 && groupedData[t]) {
                    let available = groupedData[t];
                    if (!isAutoMode) {
                        for (let i = available.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [available[i], available[j]] = [available[j], available[i]];
                        }
                    }
                    finalData = finalData.concat(available.slice(0, req));
                }
            }

            // Bù câu hỏi nếu AI tạo thiếu loại này nhưng thừa loại khác
            let totalRequested = parseInt(document.getElementById('numQuestions').value) || 0;
            if (isAutoMode && finalData.length < totalRequested) {
                let missingCount = totalRequested - finalData.length;
                let unusedQuestions = [];
                for (let t in groupedData) {
                    let usedCount = Math.min(requiredCounts[t] || 0, groupedData[t].length);
                    if (groupedData[t].length > usedCount) {
                        unusedQuestions = unusedQuestions.concat(groupedData[t].slice(usedCount));
                    }
                }
                if (unusedQuestions.length > 0) {
                    finalData = finalData.concat(unusedQuestions.slice(0, missingCount));
                }
            }

            // ======= CÂN BẰNG MỨC ĐỘ KHÓ (Strict Difficulty Quota Balancing) =======
            const diffQuota = calculateDifficultyQuota(finalData.length);
            finalData = balanceDifficultyQuota(finalData, diffQuota);

            data = finalData;
            if (!data || data.length === 0) {
                throw new Error("Không thể tạo đúng cấu trúc câu hỏi theo yêu cầu (Có thể tài liệu quá ngắn hoặc API quá tải).");
            }
            if (isAutoMode && data.length < totalRequested) {
                alert(`Lưu ý: Yêu cầu ${totalRequested} câu nhưng AI chỉ tạo được ${data.length} câu hợp lệ (đã thử tạo bù 3 lần). Bạn có thể tạo lại hoặc bổ sung thủ công.`);
            }
        }

        if (Array.isArray(data) && data.length > 0) {
            currentExamData = data;
            const subject = document.getElementById('subject').value;
            const grade = document.getElementById('grade').value;
            const title = topic || `Đề ${subject} ${grade}`;
            
            saveExamToHistory(subject, grade, data.length, title, data, {
                minutes: parseInt(document.getElementById('examTime')?.value, 10) || 45,
                round: parseInt(document.getElementById('examRound')?.value, 10) || 1,
                limit: parseInt(document.getElementById('examLimit')?.value, 10) || 0,
                khoi: parseInt(document.getElementById('khoi')?.value, 10) || 0,
                type: document.getElementById('examType')?.value || ''
            });
            
            document.getElementById('loadingOverlay').classList.remove('active');
            
            // Hiển thị giao diện xem trước (Review)
            openReviewModal();
        } else {
            throw new Error("Dữ liệu trả về không phải là mảng hoặc bị rỗng.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi khi AI trả về dữ liệu (Có thể do quá tải hoặc văn bản quá dài). Chi tiết lỗi: " + err.message);
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function parseLocalExamText(text) {
    // Tiền xử lý: Tách các phần bị dính chữ (thường do copy từ PDF, ex: "văn bản?A. PaintB. Excel")
    // Bước 1: Tách Câu, Đáp án đúng, Gợi ý (không phân biệt hoa thường)
    text = text.replace(/([^\n"“])\s*(Câu\s*\d+[\s:.]|Đáp án đúng\s*:|Gợi ý\s*:)/gi, (match, p1, p2) => {
        return p1 + '\n' + p2;
    });
    // Bước 2: Tách các phương án A, B, C, D (phân biệt HOA thường để tránh dính chữ d. trong Word.)
    text = text.replace(/([^\n])\s*([A-D][.\-)])/g, (match, p1, p2, offset, str) => {
        let contextBefore = str.substring(Math.max(0, offset - 40), offset) + p1;
        if (/(Đáp án đúng|Gợi ý)[^\n]*$/i.test(contextBefore)) return match;
        return p1 + '\n' + p2;
    });

    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    const questions = [];
    let currentQ = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Dòng tiêu đề phần của file mẫu ("Phần 3: Điền khuyết ...") không thuộc câu nào
        if (/^phần\s*\d+\s*[:.]/i.test(line)) continue;

        if (/^Câu\s*\d+[\s:.]/i.test(line)) {
            if (currentQ) questions.push(currentQ);
            
            let qText = line.replace(/^Câu\s*\d+[\s:.]+\s*/i, '').trim();
            currentQ = {
                type: 'mcq',
                question: qText,
                options: [],
                correctAnswerIndex: 0,
                correctAnswerText: "",
                difficulty: "Trung bình",
                explanation: ""
            };
            continue;
        }

        if (!currentQ) continue;

        if (/^[A-D][.\-)]/i.test(line)) {
            currentQ.options.push(line.replace(/^[A-D][.\-)]\s*/i, '').trim());
            currentQ.type = 'mcq';
        }
        else if (/^Gợi ý\s*:/i.test(line)) {
            currentQ.type = 'fill';
            let hints = line.replace(/^Gợi ý\s*:\s*/i, '').split(',').map(s => s.trim());
            currentQ.options = hints;
        }
        else if (/^Đáp án đúng\s*:/i.test(line)) {
            let ans = line.replace(/^Đáp án đúng\s*:\s*/i, '').trim();
            if (/^đúng$|^sai$/i.test(ans)) {
                currentQ.type = 'tf';
                currentQ.options = ["Đúng", "Sai"];
                currentQ.correctAnswerIndex = ans.toLowerCase() === 'đúng' ? 0 : 1;
            } else if (currentQ.type === 'fill') {
                currentQ.correctAnswerText = ans;
            } else if (currentQ.options.length > 0) {
                currentQ.type = 'mcq';
                let ansChar = ans.charAt(0).toUpperCase();
                let idx = ['A', 'B', 'C', 'D'].indexOf(ansChar);
                if (idx !== -1) currentQ.correctAnswerIndex = idx;
            } else {
                currentQ.type = 'calc';
                let numMatch = ans.match(/-?\d+([.,]\d+)?/);
                currentQ.correctAnswerText = numMatch ? numMatch[0] : ans;
            }
        }
        else if (/^1\.|^2\.|^3\.|^4\.|^Dạng/i.test(line)) {
             // Bỏ qua dòng tiêu đề dạng
        } else {
            if (currentQ.options.length === 0 && !/^Đáp án đúng\s*:/i.test(line)) {
                currentQ.question += "\n" + line;
            }
        }
    }
    if (currentQ) questions.push(currentQ);
    return questions;
}

// Review Modal Functions
function openReviewModal() {
    const body = document.getElementById('reviewModalBody');
    body.innerHTML = '';
    
    if(!currentExamData || currentExamData.length === 0) {
        body.innerHTML = '<p>Không có dữ liệu đề thi.</p>';
    } else {
        // ======= THANH TÓM TẮT MA TRẬN ĐỘ KHÓ =======
        let diffStats = { 'Dễ': 0, 'Trung bình': 0, 'Khó': 0 };
        currentExamData.forEach(q => {
            let d = normalizeDifficulty(q.difficulty);
            if (diffStats[d] !== undefined) diffStats[d]++;
        });
        const totalQ = currentExamData.length;
        const pctE = totalQ > 0 ? Math.round(diffStats['Dễ'] / totalQ * 100) : 0;
        const pctM = totalQ > 0 ? Math.round(diffStats['Trung bình'] / totalQ * 100) : 0;
        const pctH = totalQ > 0 ? Math.round(diffStats['Khó'] / totalQ * 100) : 0;
        
        body.innerHTML += `
        <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; border: 1px solid #dee2e6;">
            <div style="font-weight: 700; color: #333; font-size: 14px;"><i class="fa-solid fa-chart-pie" style="color: var(--primary); margin-right: 5px;"></i> Ma trận đề: ${totalQ} câu</div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <span style="background: #00b894; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">🟢 Dễ: ${diffStats['Dễ']} (${pctE}%)</span>
                <span style="background: #fdcb6e; color: #333; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">🟡 TB: ${diffStats['Trung bình']} (${pctM}%)</span>
                <span style="background: #d63031; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">🔴 Khó: ${diffStats['Khó']} (${pctH}%)</span>
            </div>
        </div>`;

        currentExamData.forEach((q, idx) => {
            let optionsHtml = '';
            if (q.type === 'mcq' || q.type === 'tf' || (!q.type && q.options)) {
                if(q.options && Array.isArray(q.options)) {
                    q.options.forEach((opt, optIdx) => {
                        let isCorrect = (optIdx === q.correctAnswerIndex);
                        let prefix = (!q.type || q.type === 'mcq') ? String.fromCharCode(65 + optIdx) + '.' : '-';
                        optionsHtml += `<div style="margin-bottom: 5px; ${isCorrect ? 'color: var(--primary); font-weight: bold;' : ''}">
                            ${prefix} ${esc(opt)} ${isCorrect ? ' <i class="fa-solid fa-check"></i>' : ''}
                        </div>`;
                    });
                }
            } else if (q.type === 'fill') {
                if (q.options && Array.isArray(q.options)) {
                    optionsHtml += `<div style="margin-bottom: 8px; font-style: italic; color: #666;">Từ gợi ý: ${esc(q.options.join(" / "))}</div>`;
                }
                optionsHtml += `<div style="color: var(--primary); font-weight: bold;">Đáp án đúng: ${esc(q.correctAnswerText)} <i class="fa-solid fa-check"></i></div>`;
            } else if (q.type === 'calc') {
                optionsHtml += `<div style="color: var(--primary); font-weight: bold;">Đáp án đúng: ${esc(q.correctAnswerText)} <i class="fa-solid fa-check"></i></div>`;
            }
            
            // Badge màu sắc cho mức độ khó + dropdown chỉnh sửa nhanh
            let diffColor = q.difficulty === 'Dễ' ? '#00b894' : (q.difficulty === 'Khó' ? '#d63031' : '#fdcb6e');
            let diffTextColor = q.difficulty === 'Trung bình' ? '#333' : 'white';
            let diffBadgeHtml = `
                <select onchange="changeQuestionDifficulty(${idx}, this.value)" style="font-size:11px; padding:2px 6px; border-radius:4px; border:1px solid #ddd; background:${diffColor}; color:${diffTextColor}; font-weight:600; cursor:pointer; margin-left:5px; appearance:auto;">
                    <option value="Dễ" ${q.difficulty === 'Dễ' ? 'selected' : ''} style="background:white;color:#333;">🟢 Dễ</option>
                    <option value="Trung bình" ${q.difficulty === 'Trung bình' ? 'selected' : ''} style="background:white;color:#333;">🟡 Trung bình</option>
                    <option value="Khó" ${q.difficulty === 'Khó' ? 'selected' : ''} style="background:white;color:#333;">🔴 Khó</option>
                </select>`;
            
            body.innerHTML += `
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
                <div style="font-weight: 600; margin-bottom: 10px; color: #333;">Câu ${idx + 1} ${diffBadgeHtml}</div>
                <div style="margin-bottom: 10px; white-space: pre-wrap;">${esc(q.question)}</div>
                <div style="padding-left: 10px;">${optionsHtml}</div>
                <div style="margin-top: 10px; font-size: 13px; color: #666; background: #fdfdfd; padding: 10px; border-left: 3px solid var(--primary);">
                    <strong>Giải thích:</strong> ${esc(q.explanation || 'Không có giải thích')}
                </div>
            </div>
            `;
        });
    }
    
    loadExportOptions();
    document.getElementById("reviewModal").classList.add("active");
}

// Cho phép giáo viên thay đổi mức độ khó trực tiếp trên Review Modal
function changeQuestionDifficulty(idx, newDiff) {
    if (currentExamData[idx]) {
        currentExamData[idx].difficulty = newDiff;
        openReviewModal(); // Re-render để cập nhật stats bar
    }
}

function closeReviewModal() {
    document.getElementById("reviewModal").classList.remove("active");
}

// Modal & File Handlers
function openInputModal() { document.getElementById("inputModal").classList.add("active"); }
function closeInputModal() { document.getElementById("inputModal").classList.remove("active"); }

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const statusEl = document.getElementById('fileExtractedText');
    statusEl.innerText = "Đang trích xuất văn bản từ file...";
    try {
        if (ext === 'txt') extractedFileText = await file.text();
        else if (ext === 'doc' || ext === 'docx') {
            const arrayBuffer = await file.arrayBuffer();
            extractedFileText = (await mammoth.extractRawText({arrayBuffer})).value;
        } else if (ext === 'pdf') {
            const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                fullText += (await page.getTextContent()).items.map(item => item.str).join(' ') + "\n";
            }
            extractedFileText = fullText;
        }
        statusEl.innerText = `Trích xuất thành công (${extractedFileText.length} ký tự)`;
    } catch (e) { statusEl.innerText = "Lỗi khi đọc file!"; statusEl.style.color = "red"; }
}

async function handleAiKnowledgeSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const statusEl = document.getElementById('aiKnowledgeStatus');
    statusEl.innerText = "Đang trích xuất dữ liệu...";
    statusEl.style.color = "var(--primary)";
    try {
        if (ext === 'txt') aiKnowledgeText = await file.text();
        else if (ext === 'doc' || ext === 'docx') {
            const arrayBuffer = await file.arrayBuffer();
            aiKnowledgeText = (await mammoth.extractRawText({arrayBuffer})).value;
        } else if (ext === 'pdf') {
            const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                fullText += (await page.getTextContent()).items.map(item => item.str).join(' ') + "\n";
            }
            aiKnowledgeText = fullText;
        }
        statusEl.innerText = `Đã nạp kiến thức: ${file.name} (${aiKnowledgeText.length} ký tự)`;
        statusEl.style.color = "var(--c-green)";
    } catch (e) { statusEl.innerText = "Lỗi khi đọc file!"; statusEl.style.color = "red"; }
}

function changeNum(val) {
    let mcqInput = document.getElementById('numType_mcq');
    if (mcqInput && !mcqInput.disabled) {
        let mcqVal = parseInt(mcqInput.value) || 0;
        if (mcqVal + val >= 0) {
            mcqInput.value = mcqVal + val;
            updateTotalQuestions();
        }
    } else {
        const el = document.getElementById('numQuestions');
        el.value = Math.max(1, parseInt(el.value) + val);
    }
}

// ======= LỖI LOGIN & CONFIG =======
document.addEventListener("DOMContentLoaded", () => {
    let savedName = localStorage.getItem("robotTeacherName");
    if(savedName) {
        document.getElementById("headerUserName").innerText = savedName;
        document.getElementById("profileUserName").innerText = savedName;
    }
    
    initSheetSettings();
    initGithubSettings();
    const savedKhoi = lsGet('robotKhoi');
    if (savedKhoi && document.getElementById('khoi')) { document.getElementById('khoi').value = savedKhoi; onKhoiChange(); }
    const savedType = lsGet('robotExamType');
    if (savedType && document.getElementById('examType')) document.getElementById('examType').value = savedType;
    
    updateTotalQuestions();
    renderClassesOptions();
    renderClassesTable();
});

function openLoginModal() {
    document.getElementById("loginModal").classList.add("active");
    let currentName = localStorage.getItem("robotTeacherName") || "Trương Thái Hòa";
    document.getElementById("loginNameInput").value = currentName;
}

function closeLoginModal() {
    document.getElementById("loginModal").classList.remove("active");
}

function saveLoginName() {
    let newName = document.getElementById("loginNameInput").value.trim();
    if (newName) {
        localStorage.setItem("robotTeacherName", newName);
        document.getElementById("headerUserName").innerText = newName;
        document.getElementById("profileUserName").innerText = newName;
        closeLoginModal();
    }
}

function toggleQTypeInput(cb) {
    let input = document.getElementById('numType_' + cb.value);
    if(cb.checked) {
        input.disabled = false;
        if(input.value == 0) input.value = 5;
    } else {
        input.disabled = true;
        input.value = 0;
    }
    updateTotalQuestions();
}

function updateTotalQuestions() {
    let total = 0;
    document.querySelectorAll('input[name="qType"]:checked').forEach(cb => {
        let val = parseInt(document.getElementById('numType_' + cb.value).value) || 0;
        total += val;
    });
    document.getElementById('numQuestions').value = total;
    if (typeof updateChart === 'function') updateChart();
    if (typeof updateDifficultyQuotaDisplay === 'function') updateDifficultyQuotaDisplay();
}
// Tải file Word mẫu
function downloadWordTemplate() {
    let content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Đề mẫu</title></head>
    <body style="font-family: 'Times New Roman', serif; font-size: 14pt;">
        <h2 style="text-align: center;">ĐỀ MẪU KIỂM TRA TỪ ROBOT AI</h2>
        <p style="text-align: center;"><i>(Dành cho chức năng tạo đề từ tài liệu)</i></p>
        <p><b>Lưu ý quan trọng:</b> Bạn có thể copy định dạng dưới đây và sửa thành nội dung câu hỏi của mình. Vui lòng giữ nguyên các từ khóa định vị bắt buộc như: <b>"Câu X:"</b>, <b>"Đáp án đúng:"</b>, <b>"Gợi ý:"</b> để AI có thể đọc chính xác 100%.</p>
        <hr>
        
        <h3>Phần 1: Trắc nghiệm (Có 4 đáp án A, B, C, D)</h3>
        <p>Câu 1: Thủ đô của Việt Nam là gì?<br>
        A. TP. Hồ Chí Minh<br>
        B. Hà Nội<br>
        C. Đà Nẵng<br>
        D. Cần Thơ<br>
        Đáp án đúng: B</p>

        <h3>Phần 2: Đúng / Sai (Chỉ ghi Đúng hoặc Sai ở đáp án)</h3>
        <p>Câu 2: Năm 2024 có 366 ngày.<br>
        Đáp án đúng: Đúng</p>
        
        <p>Câu 3: Mặt trời mọc ở hướng Tây.<br>
        Đáp án đúng: Sai</p>

        <h3>Phần 3: Điền khuyết (Bắt buộc phải có "Gợi ý:" liệt kê các từ khóa)</h3>
        <p>Câu 4: Bác Hồ sinh ngày 19 tháng 5 năm ____.<br>
        Gợi ý: 1890, 1911, 1945, 1969<br>
        Đáp án đúng: 1890</p>

        <h3>Phần 4: Tính toán / Tự luận (Đáp án là 1 con số, công thức hoặc văn bản)</h3>
        <p>Câu 5: Tính diện tích hình chữ nhật có chiều dài 5cm và chiều rộng 3cm.<br>
        Đáp án đúng: 15 cm2</p>
    </body>
    </html>`;
    
    let blob = new Blob(['\ufeff', content], { type: "application/msword" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = "De_Mau_Robot_Tao_De.doc";
    a.click();
    URL.revokeObjectURL(url);
}

// Tải file CSV mẫu Google Sheets
function downloadCSVTemplate() {
    let content = "STT,HỌ TÊN,MÔN,HÌNH THỨC KT,LỚP,THỜI GIAN NỘP,ĐIỂM SỐ\n1,Nguyễn Văn A,Toán học,Giữa kì 1,10A1,10/10/2024 08:30:00,8.5\n2,Trần Thị B,Toán học,Giữa kì 1,10A1,10/10/2024 08:35:00,9.0";
    let blob = new Blob(['\uFEFF', content], { type: "text/csv;charset=utf-8" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = "Mau_Du_Lieu_Hoc_Sinh.csv";
    a.click();
    URL.revokeObjectURL(url);
}

// Xuất file HTML
// ======= XUẤT ĐỀ =======
function getExportOptions() {
    try { return Object.assign({ shuffle: false, studentList: true }, JSON.parse(lsGet('robotExportOptions', '{}'))); } catch (e) { return { shuffle: false, studentList: true }; }
}
function saveExportOptions() {
    lsSet('robotExportOptions', JSON.stringify({
        shuffle: document.getElementById('optShuffle').checked,
        studentList: document.getElementById('optStudentList').checked
    }));
    updateExportOptionNote();
}
function loadExportOptions() {
    const o = getExportOptions();
    const sh = document.getElementById('optShuffle'), sl = document.getElementById('optStudentList');
    if (sh) sh.checked = o.shuffle;
    if (sl) sl.checked = o.studentList;
    updateExportOptionNote();
}
function updateExportOptionNote() {
    const note = document.getElementById('exportOptionNote');
    if (!note) return;
    const classes = getExamClasses();
    const lists = getStudentListsFor(classes);
    const withList = Object.keys(lists).length;
    const r = document.getElementById('examRound')?.value || 1;
    const lim = +(document.getElementById('examLimit')?.value || 0);
    let text = `Lần ${r}${lim ? ` · tối đa ${lim} lần` : ''}`;
    if (document.getElementById('optStudentList')?.checked && classes.length) {
        text += ` · ${withList}/${classes.length} lớp có danh sách học sinh`;
    }
    note.innerText = text;
}

// Các lớp áp dụng (ô "Lớp áp dụng": 6A1, 6A2 hoặc 6A1; 6A2)
function getExamClasses() {
    const raw = document.getElementById('grade')?.value || '';
    return raw.split(/[,;\n]/).map(c => c.trim().replace(/^lớp\s+/i, '')).filter(Boolean);
}

// Thông tin đề đang xuất
// Khối lớp (6–12): rút ra từ tên lớp, ví dụ "6A1, 6A2" -> 6 (các lớp khác khối -> '' để giáo viên tự chọn)
function inferKhoi(classesText) {
    const set = new Set(parseClasses(classesText).map(c => (c.match(/^(\d{1,2})/) || [])[1]).filter(Boolean));
    return set.size === 1 && +[...set][0] >= 6 && +[...set][0] <= 12 ? [...set][0] : '';
}

// Các lớp không thuộc khối đã chọn (lớp bắt đầu bằng số khác khối), ví dụ khối 7 mà có lớp 6A1
function khoiMismatch(khoi, classes) {
    return (classes || []).filter(c => { const m = String(c).match(/^(\d{1,2})/); return m && m[1] !== String(khoi); });
}

// Đề đăng vào thư mục riêng theo khối trong kho môn học: khoi6/Ten_de.html (tránh trùng đề giữa các khối)
const ghExamPath = (c, khoi, file) => [c.folder.replace(/^\/+|\/+$/g, ''), khoi ? 'khoi' + khoi : '', file].filter(Boolean).join('/');
const KHOI_OPTIONS = [6, 7, 8, 9, 10, 11, 12];
// Loại kiểm tra (phân biệt bài cùng thời gian làm bài): danh sách dùng chung với bộ xử lý điểm
const typeOptionsHtml = (selected, blankLabel = '— chọn loại —') => `<option value="">${blankLabel}</option>` +
    EduScores.EXAM_TYPES.map(t => `<option value="${esc(t)}" ${t === selected ? 'selected' : ''}>${esc(t)}</option>`).join('');

// Apps Script cũ (dưới bản 4) bỏ qua "Loại kiểm tra" -> điểm các loại cùng thời gian vẫn bị gộp trong Sheet
async function confirmGasSupportsType(hasType) {
    const v = parseInt(lsGet('robotGasVersion', '0'), 10);
    if (!hasType || !v || v >= 4) return true;
    return confirm(`Google đang chạy Apps Script phiên bản ${v}, chưa lưu được "Loại kiểm tra" (Giữa kỳ, Thường xuyên...). Điểm các loại cùng thời gian làm bài sẽ vẫn bị gộp trong Google Sheets.\n\nNên cập nhật Apps Script lên bản 4 trước (trang "Google Sheets" › Bước 1: dán mã mới › Triển khai › Phiên bản mới).\n\nBấm OK để vẫn tiếp tục, Hủy để quay lại.`);
}
const khoiOptionsHtml = (selected, withBlank = true) => (withBlank ? `<option value="">— chọn khối —</option>` : '') +
    KHOI_OPTIONS.map(k => `<option value="${k}" ${String(selected) === String(k) ? 'selected' : ''}>Khối ${k}</option>`).join('');

// Khi đổi Khối: tự điền "Lớp áp dụng" bằng các lớp của khối đó (nếu ô còn trống hoặc đang là giá trị tự điền)
function onKhoiChange() {
    const khoi = document.getElementById('khoi').value;
    lsSet('robotKhoi', khoi);
    const grade = document.getElementById('grade');
    if (!khoi || !grade) return;
    if (grade.value.trim() === '' || grade.dataset.auto === '1') {
        const names = getClasses().filter(c => String(c.grade) === String(khoi)).map(c => c.name);
        if (names.length) { grade.value = names.join(', '); grade.dataset.auto = '1'; }
    }
}

function getExamMeta() {
    return {
        subject: (document.getElementById('subject').value || 'Chung').trim(),
        minutes: parseInt(document.getElementById('examTime')?.value, 10) || 45,
        round: parseInt(document.getElementById('examRound')?.value, 10) || 1,
        limit: parseInt(document.getElementById('examLimit')?.value, 10) || 0,
        classes: getExamClasses(),
        khoi: parseInt(document.getElementById('khoi')?.value, 10) || 0,
        type: document.getElementById('examType')?.value || ''
    };
}

// Tạo nội dung file đề (dùng cho tải file và đăng lên GitHub)
function buildExamHtml(meta, data = currentExamData) {
    function b64DecodeUnicode(str) { return decodeURIComponent(atob(str).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')); }
    if (typeof TEMPLATE_B64 === "undefined") throw new Error("Không tìm thấy template_data.js.");
    const opts = meta.options || getExportOptions();
    let t = b64DecodeUnicode(TEMPLATE_B64);
    // JSON.stringify: dấu " hoặc xuống dòng không làm hỏng JS; escape "<" để "</script>" không cắt ngang thẻ script;
    // dùng hàm thay thế để "$" trong nội dung không bị hiểu nhầm
    const js = v => JSON.stringify(v).split('<').join('\\x3c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
    const put = (placeholder, value) => {
        if (!t.includes(placeholder)) throw new Error('Mẫu đề thi thiếu: ' + placeholder);
        t = t.replace(placeholder, () => value);
    };
    put('const EXAM_DATA = []; // Template placeholder', `const EXAM_DATA = ${js(data)};`);
    put('const WEBHOOK_URL = ""; // Template placeholder', `const WEBHOOK_URL = ${js(lsGet('robotWebhookUrl').trim())};`);
    put('const EXAM_TIME = 45; // Template placeholder', `const EXAM_TIME = ${meta.minutes};`);
    put('const SUBJECT = "Chung"; // Template placeholder', `const SUBJECT = ${js(meta.subject)};`);
    put('const ALLOWED_CLASSES = ""; // Template placeholder', `const ALLOWED_CLASSES = ${js(meta.classes.join(','))};`);
    put('const EXAM_ROUND = 1; // Template placeholder', `const EXAM_ROUND = ${meta.round};`);
    put('const EXAM_LIMIT = 0; // Template placeholder', `const EXAM_LIMIT = ${meta.limit};`);
    put('const EXAM_TYPE = ""; // Template placeholder', `const EXAM_TYPE = ${js(meta.type || '')};`);
    put('const SHUFFLE = false; // Template placeholder', `const SHUFFLE = ${opts.shuffle ? 'true' : 'false'};`);
    put('const STUDENT_LISTS = {}; // Template placeholder', `const STUDENT_LISTS = ${js(opts.studentList ? getStudentListsFor(meta.classes) : {})};`);
    return t;
}

// Cảnh báo khi "môn + thời gian + lần kiểm tra" đã có bài nộp trong năm học (dễ gộp nhầm 2 bài khác nhau)
// Thông tin lần kiểm tra đã có bài nộp trong năm học (null = chưa dùng hoặc không kiểm tra được)
async function getRoundUsage(meta) {
    if (!lsGet('robotWebhookUrl').trim()) return null;
    if (!sheetRows.length) {
        try {
            const rows = await Promise.race([fetchSheetJson({ year: 'all' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
            if (Array.isArray(rows)) sheetRows = rows;
        } catch (e) {
            console.warn('[Xuất đề] Không kiểm tra được lần kiểm tra trùng:', e.message);
            return null; // Không chặn giáo viên khi Google chậm
        }
    }
    const year = EduScores.currentSchoolYear();
    const sameGrade = r => !meta.khoi || new RegExp('^' + meta.khoi + '(?!\\d)').test(String(r.className || '').trim());
    const same = r => EduScores.normKey(r.subject) === EduScores.normKey(meta.subject) && r.hinhThucBase === EduScores.hinhThucBase(meta.type, meta.minutes) && sameGrade(r);
    const all = EduScores.process(sheetRows, { year }).all.filter(r => !r.dup && same(r));
    const used = all.filter(r => r.round === meta.round);
    if (!used.length) return null;
    const usedRounds = new Set(all.map(r => r.round));
    let free = 1;
    while (usedRounds.has(free)) free++;
    const last = used.reduce((a, b) => (b.time > a.time ? b : a));
    return { year, used, free, last };
}

// Cảnh báo khi "môn + thời gian + lần kiểm tra" đã có bài nộp trong năm học (dễ gộp nhầm 2 bài khác nhau)
async function confirmExamRoundNotUsed(meta) {
    const u = await getRoundUsage(meta);
    if (!u) return true;
    return confirm(`Năm học ${u.year} đã có ${u.used.length} bài nộp cho "${meta.subject}${meta.khoi ? ' khối ' + meta.khoi : ''}${meta.type ? ' – ' + meta.type : ''} – ${meta.minutes} phút – Lần ${meta.round}" (lần nộp gần nhất: ${u.last.dateText}).\n\n` +
        `• Nếu đây là CÙNG bài kiểm tra (xuất lại, sửa đề...): bấm OK.\n` +
        `• Nếu đây là bài kiểm tra KHÁC: bấm Hủy rồi chọn "Lần kiểm tra" khác` + (u.free <= 6 ? ` (gợi ý: Lần ${u.free})` : '') + `, nếu không điểm 2 bài sẽ bị gộp và lấy điểm cao nhất.`);
}

function examFileBaseName(meta) {
    const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `${slug(meta.subject)}${meta.khoi ? '_K' + meta.khoi : ''}${meta.type ? '_' + slug(meta.type) : ''}_${meta.minutes}phut_Lan${meta.round}`;
}

async function exportHTML() {
    if (currentExamData.length === 0) return alert("Chưa có dữ liệu đề thi!");
    const meta = getExamMeta();
    if (!(await confirmExamRoundNotUsed(meta))) return;
    let templateContent;
    try { templateContent = buildExamHtml(meta); } catch (e) { return alert(e.message); }

    const suggestedName = examFileBaseName(meta) + '.html';
    let finalName = suggestedName;
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({ suggestedName: suggestedName, types: [{ description: 'HTML File', accept: {'text/html': ['.html']} }] });
            const writable = await handle.createWritable();
            await writable.write(templateContent);
            await writable.close();
            return;
        } catch (err) { if (err.name === 'AbortError') return; }
    } else {
        let userInput = prompt("Nhập tên file bạn muốn lưu:", suggestedName);
        if (!userInput) return;
        if (!userInput.endsWith('.html')) userInput += '.html';
        finalName = userInput;
        alert("Lưu ý: Nếu file tự động tải về mà không hỏi nơi lưu, hãy vào phần Cài đặt của Chrome/Edge, tìm từ khóa 'Ask where to save' và BẬT nó lên nhé.");
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([templateContent], { type: 'text/html;charset=utf-8' }));
    a.download = finalName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

window.onload = () => {
    updateStatsUI();
    initCharts();
    // Khởi tạo hiển thị phân bổ mức độ khó
    if (typeof updateDifficultyQuotaDisplay === 'function') updateDifficultyQuotaDisplay();
    // Tự tải dữ liệu từ Google Sheets nếu đã cấu hình URL
    if (lsGet('robotWebhookUrl').trim()) fetchChartData();
};

// ======= ĐĂNG ĐỀ LÊN GITHUB PAGES =======
// Token chỉ lưu trên máy (localStorage). Không dùng trên bản web *.github.io vì các trang
// GitHub Pages cùng tài khoản dùng chung bộ nhớ trình duyệt.
const isWebVersion = () => /\.github\.io$/i.test(location.hostname);

// Mỗi môn một kho đề riêng (đã tạo sẵn, bật GitHub Pages): chọn kho theo môn rồi chỉ cần đặt tên đề
const GH_SUBJECTS = ['Toán học', 'Ngữ Văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Tin học'];
const GH_DEFAULT_REPOS = {
    'Toán học': 'kttx-toan', 'Ngữ Văn': 'kttx-nguvan', 'Tiếng Anh': 'kttx-tienganh',
    'Vật lý': 'kttx-vatly', 'Hóa học': 'kttx-hoahoc', 'Sinh học': 'kttx-sinhhoc',
    'Lịch sử': 'kttx-lichsu', 'Địa lý': 'kttx-dialy', 'Tin học': 'kttx-tinhoc'
};
const GH_DEFAULT_OWNER = 'truongthaihoavt2010-arch';

function getGithubConfig() {
    let c = {};
    try { c = JSON.parse(lsGet('robotGithub', '{}')) || {}; } catch (e) {}
    return {
        owner: c.owner || GH_DEFAULT_OWNER,
        token: c.token || '',
        branch: 'main',
        folder: '',
        repos: Object.assign({}, GH_DEFAULT_REPOS, c.repos || {})
    };
}

function initGithubSettings() {
    const c = getGithubConfig();
    const owner = document.getElementById('ghOwner');
    const token = document.getElementById('ghToken');
    if (owner) owner.value = c.owner;
    if (token) token.value = c.token;
    const box = document.getElementById('ghRepoList');
    if (box) {
        box.innerHTML = GH_SUBJECTS.map(s => `<div class="gh-repo-row"><label>${esc(s)}</label>
            <input type="text" class="form-control" data-subject="${esc(s)}" value="${esc(c.repos[s] || '')}" autocomplete="off" spellcheck="false"></div>`).join('');
    }
    const warn = document.getElementById('ghWebWarning');
    if (warn) warn.style.display = isWebVersion() ? 'block' : 'none';
    renderPublishedList();
}

function readGithubForm() {
    const repos = {};
    document.querySelectorAll('#ghRepoList input[data-subject]').forEach(i => { repos[i.dataset.subject] = i.value.trim(); });
    return {
        owner: document.getElementById('ghOwner').value.trim(),
        token: document.getElementById('ghToken').value.trim(),
        repos
    };
}

function setGhStatus(text, color) {
    const el = document.getElementById('ghStatus');
    if (el) { el.innerText = text; el.style.color = color || 'var(--c-green)'; el.style.whiteSpace = 'pre-line'; }
}

async function githubApi(c, method, apiPath, body) {
    const res = await fetch(`https://api.github.com${apiPath}`, {
        method,
        headers: {
            'Authorization': `Bearer ${c.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
        const msg = data && data.message ? data.message : 'HTTP ' + res.status;
        const err = new Error(res.status === 401 ? 'Token không hợp lệ hoặc đã hết hạn.'
            : res.status === 403 ? 'Token không có quyền ghi (cần Contents: Read and write cho kho này). ' + msg
            : res.status === 404 ? 'Không tìm thấy kho (sai tên tài khoản/kho, hoặc token chưa được cấp quyền cho kho này).'
            : msg);
        err.status = res.status;
        throw err;
    }
    return data;
}

const ghRepoPath = c => `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
const ghFilePath = (c, name) => [c.folder.replace(/^\/+|\/+$/g, ''), name].filter(Boolean).join('/');
function ghPagesUrl(c, path) {
    const host = `${c.owner.toLowerCase()}.github.io`;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return c.repo.toLowerCase() === host ? `https://${host}/${encoded}` : `https://${host}/${encodeURIComponent(c.repo)}/${encoded}`;
}

// Token fine-grained không báo đúng quyền qua thông tin kho, nên thử ghi "rỗng": GitHub kiểm tra quyền
// TRƯỚC nội dung -> 422 (thiếu "content") = token có quyền ghi; 403/404 = token chưa được cấp quyền cho kho này.
async function githubCanWrite(cr) {
    try {
        await githubApi(cr, 'PUT', `${ghRepoPath(cr)}/contents/_kiem_tra_quyen.html`, { message: 'Kiểm tra quyền ghi' });
        return true;
    } catch (e) {
        if (e.status === 422) return true;
        if (e.status === 403 || e.status === 404) return false;
        throw e;
    }
}

const GH_FIX_HINT = 'Sửa token: GitHub › Settings › Developer settings › Fine-grained tokens › chọn token › Repository access: thêm kho này; Permissions › Contents: Read and write › Update.';

async function saveGithubConfig() {
    if (isWebVersion()) return setGhStatus('Không lưu token trên bản web. Hãy dùng phần mềm trên máy tính.', 'red');
    const f = readGithubForm();
    if (!f.owner || !f.token) return setGhStatus('Vui lòng nhập tài khoản GitHub và token.', 'red');
    lsSet('robotGithub', JSON.stringify(f));
    setGhStatus('Đang kiểm tra các kho...', 'var(--text-muted)');
    const c = getGithubConfig();
    const problems = [];
    let ok = 0;
    for (const subject of GH_SUBJECTS) {
        const repoName = c.repos[subject];
        if (!repoName) { problems.push(`• ${subject}: chưa nhập tên kho`); continue; }
        try {
            const cr = Object.assign({}, c, { repo: repoName });
            const repo = await githubApi(cr, 'GET', ghRepoPath(cr));
            if (repo.private) problems.push(`• ${subject} (${repoName}): kho đang Riêng tư — GitHub Pages miễn phí chỉ chạy với kho Công khai`);
            else if (!(await githubCanWrite(cr))) problems.push(`• ${subject} (${repoName}): token CHƯA có quyền ghi vào kho này`);
            else ok++;
        } catch (e) {
            if (e.status === 401) { setGhStatus('❌ ' + e.message, 'red'); return; }
            problems.push(`• ${subject} (${repoName}): ${e.status === 404 ? 'không tìm thấy kho hoặc token chưa được cấp quyền cho kho này' : e.message}`);
        }
    }
    if (!problems.length) setGhStatus(`✅ ${ok}/${GH_SUBJECTS.length} kho sẵn sàng. Có thể đăng đề cho mọi môn.`);
    else setGhStatus(`${ok}/${GH_SUBJECTS.length} kho sẵn sàng. Cần xử lý:\n${problems.join('\n')}` + (problems.some(x => x.includes('CHƯA có quyền ghi')) ? `\n${GH_FIX_HINT}` : ''), ok ? 'orange' : 'red');
}

function clearGithubToken() {
    const c = getGithubConfig();
    lsSet('robotGithub', JSON.stringify({ owner: c.owner, token: '', repos: c.repos }));
    document.getElementById('ghToken').value = '';
    setGhStatus('Đã xóa token khỏi máy này.', 'var(--text-muted)');
}

function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

function randomSuffix(n) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, b => chars[b % chars.length]).join('');
}

function getPublished() { try { return JSON.parse(lsGet('robotPublishedExams', '[]')) || []; } catch (e) { return []; } }
function setPublished(list) { lsSet('robotPublishedExams', JSON.stringify(list)); }

// Tên đề do giáo viên đặt -> tên file (không dấu, không ký tự lạ)
function slugFileName(name) {
    const base = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    return base || 'de_kiem_tra';
}

let pendingPublishMeta = null;

async function publishExam() {
    if (currentExamData.length === 0) return alert('Chưa có dữ liệu đề thi!');
    if (isWebVersion()) return alert('Đăng đề chỉ dùng được trên phần mềm chạy ở máy tính (mở bằng MO_TOOL_GIAO_DUC.bat).');
    const c = getGithubConfig();
    if (!c.owner || !c.token) {
        alert('Chưa nhập token GitHub. Vào trang "Google Sheets" › mục "Đăng đề lên GitHub" để cài đặt (chỉ làm một lần).');
        closeReviewModal();
        return switchPage('page-settings', document.querySelectorAll('.menu-item')[6]);
    }
    if (!lsGet('robotWebhookUrl').trim() && !confirm('Chưa cấu hình Google Sheets: học sinh làm bài sẽ KHÔNG lưu được điểm. Vẫn đăng đề?')) return;
    const meta = getExamMeta();
    if (!(await confirmExamRoundNotUsed(meta))) return;
    pendingPublishMeta = meta;

    const select = document.getElementById('pubRepo');
    select.innerHTML = GH_SUBJECTS.filter(s => c.repos[s]).map(s => `<option value="${esc(s)}">${esc(s)} — ${esc(c.repos[s])}</option>`).join('');
    select.value = GH_SUBJECTS.includes(meta.subject) && c.repos[meta.subject] ? meta.subject : (select.options[0] ? select.options[0].value : '');
    document.getElementById('pubKhoi').innerHTML = khoiOptionsHtml(meta.khoi || inferKhoi(meta.classes.join(',')));
    document.getElementById('pubType').innerHTML = typeOptionsHtml(meta.type, '— không ghi loại —');
    document.getElementById('pubName').dataset.auto = '1';
    document.getElementById('pubName').value = bpDefaultName(meta.subject, meta.khoi, meta.type, meta.minutes, meta.round);
    updatePublishPreview();
    document.getElementById('publishFormModal').classList.add('active');
    setTimeout(() => { const i = document.getElementById('pubName'); i.focus(); i.select(); }, 50);
}

// Đổi Khối / Loại ở hộp thoại đăng 1 đề: tên đề gợi ý tự cập nhật (nếu giáo viên chưa tự sửa tên)
function pubAutoName() {
    const nameEl = document.getElementById('pubName');
    const meta = pendingPublishMeta;
    if (meta && nameEl.dataset.auto === '1') {
        nameEl.value = bpDefaultName(meta.subject, document.getElementById('pubKhoi').value, document.getElementById('pubType').value, meta.minutes, meta.round);
    }
    updatePublishPreview();
}

function closePublishForm() { document.getElementById('publishFormModal').classList.remove('active'); }

function updatePublishPreview() {
    const c = getGithubConfig();
    const subject = document.getElementById('pubRepo').value;
    const repo = c.repos[subject];
    const el = document.getElementById('pubLinkPreview');
    if (!repo) { el.innerText = ''; return; }
    const file = slugFileName(document.getElementById('pubName').value) + '.html';
    el.innerText = 'Link sẽ là: ' + ghPagesUrl({ owner: c.owner, repo }, ghExamPath(c, document.getElementById('pubKhoi').value, file));
}

async function confirmPublish() {
    const c = getGithubConfig();
    const meta = pendingPublishMeta;
    const subject = document.getElementById('pubRepo').value;
    const repo = c.repos[subject];
    const rawName = document.getElementById('pubName').value.trim();
    if (!meta) return;
    if (!repo) return alert('Chưa chọn kho lưu trữ.');
    if (!rawName) return alert('Vui lòng đặt tên đề.');
    const khoi = document.getElementById('pubKhoi').value;
    if (!khoi) return alert('Vui lòng chọn Khối của đề (để đề của các khối không bị trùng nhau).');
    const bad = khoiMismatch(khoi, meta.classes);
    if (bad.length && !confirm(`Lớp ${bad.join(', ')} không thuộc Khối ${khoi}. Bạn vẫn muốn đăng?`)) return;
    meta.khoi = parseInt(khoi, 10);
    meta.type = document.getElementById('pubType').value;
    if (!(await confirmGasSupportsType(!!meta.type))) return;

    let html;
    try { html = buildExamHtml(meta); } catch (e) { return alert(e.message); }
    closePublishForm();

    const cr = Object.assign({}, c, { repo });
    const file = slugFileName(rawName) + '.html';
    const path = ghExamPath(c, khoi, file);
    const url = ghPagesUrl(cr, path);
    const apiPath = `${ghRepoPath(cr)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

    openPublishModal('⏳ Đang tải đề lên GitHub...', '', 'var(--text-muted)');
    try {
        let sha;
        try { sha = (await githubApi(cr, 'GET', `${apiPath}?ref=${encodeURIComponent(c.branch)}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
        if (sha && !confirm(`Kho "${repo}" đã có đề tên "${file}".\nBấm OK để thay bằng đề mới (link giữ nguyên), Hủy để đặt tên khác.`)) { closePublishModal(); return; }
        const res = await githubApi(cr, 'PUT', apiPath, {
            message: `Đăng đề ${rawName}`,
            content: utf8ToBase64(html),
            branch: c.branch,
            ...(sha ? { sha } : {})
        });
        const entry = { path, url, sha: res.content && res.content.sha, repo: `${c.owner}/${repo}`, branch: c.branch,
            title: `${rawName} (${meta.subject} · Khối ${khoi}${meta.type ? ' · ' + meta.type : ''} · ${meta.minutes} phút · Lần ${meta.round})`, classes: meta.classes.join(', '), time: Date.now() };
        setPublished([entry, ...getPublished().filter(p => !(p.repo === entry.repo && p.path === entry.path))]);
        renderPublishedList();
        await waitForPages(url);
    } catch (e) {
        openPublishModal('❌ ' + (e.status === 404 ? `Không tìm thấy kho "${repo}" hoặc token chưa được cấp quyền cho kho này. Kiểm tra ở trang "Google Sheets" › Đăng đề lên GitHub.`
            : e.status === 403 ? `Token chưa có quyền ghi vào kho "${repo}". ${GH_FIX_HINT} Sau đó vào trang "Google Sheets" › Đăng đề lên GitHub bấm "Lưu & kiểm tra" để xác nhận.`
            : e.message), '', 'red');
    }
}

// Chờ GitHub Pages cập nhật (thường 30 giây – 2 phút)
async function waitForPages(url) {
    openPublishModal('✅ Đã tải lên. ⏳ Đang chờ GitHub Pages cập nhật (thường 30 giây – 2 phút)...', url, 'var(--text-muted)');
    const started = Date.now();
    while (Date.now() - started < 4 * 60 * 1000) {
        if (!document.getElementById('publishModal').classList.contains('active')) return; // đã đóng
        try {
            const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
            if (r.ok) {
                openPublishModal('🎉 Link đã sẵn sàng! Gửi link hoặc mã QR cho học sinh.', url, 'var(--c-green)');
                return;
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 6000));
        const sec = Math.round((Date.now() - started) / 1000);
        openPublishModal(`✅ Đã tải lên. ⏳ Đang chờ GitHub Pages cập nhật... (${sec} giây)`, url, 'var(--text-muted)');
    }
    openPublishModal('⚠️ Đã tải lên nhưng link chưa mở được sau 4 phút. Kiểm tra kho đã bật GitHub Pages (Settings › Pages) chưa, rồi thử mở link sau ít phút.', url, 'orange');
}

let qrLibPromise = null;
function loadQrLib() {
    if (window.QRCode) return Promise.resolve();
    if (!qrLibPromise) qrLibPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        sc.onload = resolve;
        sc.onerror = () => { qrLibPromise = null; reject(new Error('Không tải được thư viện QR')); };
        document.head.appendChild(sc);
    });
    return qrLibPromise;
}

function openPublishModal(status, url, color) {
    const st = document.getElementById('publishStatus');
    st.innerText = status;
    st.style.color = color || '';
    const link = document.getElementById('publishLink');
    const qr = document.getElementById('publishQr');
    const open = document.getElementById('publishOpen');
    if (url && link.value !== url) {
        link.value = url;
        open.href = url;
        qr.innerHTML = '';
        loadQrLib().then(() => new QRCode(qr, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M })).catch(() => { qr.innerText = ''; });
    }
    link.parentElement.style.display = url ? 'flex' : 'none';
    open.parentElement.style.display = url ? 'block' : 'none';
    if (!url) qr.innerHTML = '';
    document.getElementById('publishModal').classList.add('active');
}
function closePublishModal() {
    document.getElementById('publishModal').classList.remove('active');
    document.getElementById('publishLink').value = '';
}
async function copyPublishLink() {
    const link = document.getElementById('publishLink');
    try { await navigator.clipboard.writeText(link.value); } catch (e) { link.select(); document.execCommand('copy'); }
    const st = document.getElementById('publishStatus');
    st.innerText = '📋 Đã sao chép link!';
    st.style.color = 'var(--c-green)';
}

function renderPublishedList() {
    const tbody = document.getElementById('publishedBody');
    if (!tbody) return;
    const list = getPublished();
    tbody.innerHTML = list.length ? list.map((p, i) => `<tr>
        <td><strong>${esc(p.title)}</strong><div style="font-size:12px; color:var(--text-muted);">${esc(p.classes || '')}</div></td>
        <td>${esc(new Date(p.time).toLocaleString('vi-VN'))}</td>
        <td><a href="${esc(p.url)}" target="_blank" rel="noopener" style="word-break: break-all;">${esc(p.path)}</a></td>
        <td style="white-space:nowrap;">
            <button class="btn-view" onclick="showPublished(${i})"><i class="fa-solid fa-qrcode"></i> Link</button>
            <button class="btn-view" style="color:var(--c-red); margin-left:5px;" onclick="unpublishExam(${i})"><i class="fa-solid fa-trash"></i> Gỡ đề</button>
        </td></tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 16px;">Chưa có đề nào được đăng.</td></tr>';
}

function showPublished(i) {
    const p = getPublished()[i];
    if (p) openPublishModal('Link bài kiểm tra:', p.url, 'var(--c-green)');
}

async function unpublishExam(i) {
    const list = getPublished();
    const p = list[i];
    if (!p) return;
    if (!confirm(`Gỡ đề "${p.title}" khỏi GitHub?\nHọc sinh sẽ không mở được link này nữa. (Điểm đã nộp trong Google Sheets vẫn giữ nguyên.)`)) return;
    const c = getGithubConfig();
    const [owner, repo] = p.repo.split('/');
    const cc = Object.assign({}, c, { owner, repo });
    try {
        const apiPath = `${ghRepoPath(cc)}/contents/${p.path.split('/').map(encodeURIComponent).join('/')}`;
        let sha = p.sha;
        try { sha = (await githubApi(cc, 'GET', `${apiPath}?ref=${encodeURIComponent(p.branch || 'main')}`)).sha; } catch (e) { if (e.status !== 404) throw e; sha = null; }
        if (sha) await githubApi(cc, 'DELETE', apiPath, { message: `Gỡ đề ${p.title}`, sha, branch: p.branch || 'main' });
        list.splice(i, 1);
        setPublished(list);
        renderPublishedList();
    } catch (e) {
        alert('Không gỡ được đề: ' + e.message);
    }
}


// ======= ĐĂNG MỘT HOẶC NHIỀU ĐỀ ĐÃ TẠO (trang "Đề của tôi") =======
function parseClasses(str) {
    return String(str || '').split(/[,;\n]/).map(c => c.trim().replace(/^lớp\s+/i, '')).filter(Boolean);
}

// Dấu "Đã đăng" cạnh tên đề (đề đã được đăng từ trang Đề của tôi)
function publishedBadge(examId) {
    const list = getPublished().filter(p => p.examId === examId);
    if (!list.length) return '';
    const p = list[0];
    return `<div style="font-size:12px; font-weight:500; margin-top:3px;"><span style="color:var(--c-green);">✅ Đã đăng</span> · <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.repo.split('/')[1])}</a>${list.length > 1 ? ` · ${list.length} lần` : ''}</div>`;
}

function publishSelectedExams() {
    const ids = Array.from(document.querySelectorAll('#tableExamsBody input.row-checkbox:checked')).map(x => Number(x.value));
    if (!ids.length) return alert('Vui lòng tick chọn ít nhất một đề để đăng.');
    openBatchPublish(ids);
}

function bpRepoOptions(c, selected) {
    return GH_SUBJECTS.filter(s => c.repos[s]).map(s => `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)} — ${esc(c.repos[s])}</option>`).join('');
}

function openBatchPublish(ids) {
    if (isWebVersion()) return alert('Đăng đề chỉ dùng được trên phần mềm chạy ở máy tính (mở bằng MO_TOOL_GIAO_DUC.bat).');
    const c = getGithubConfig();
    if (!c.owner || !c.token) {
        alert('Chưa nhập token GitHub. Vào trang "Google Sheets" › mục "Đăng đề lên GitHub" để cài đặt (chỉ làm một lần).');
        return switchPage('page-settings', document.querySelectorAll('.menu-item')[6]);
    }
    const stats = getStats();
    const exams = ids.map(id => stats.recentExams.find(e => e.id === id)).filter(e => e && Array.isArray(e.data) && e.data.length);
    if (!exams.length) return alert('Không tìm thấy nội dung của đề đã chọn (đề cũ có thể chưa lưu câu hỏi).');
    const skipped = ids.length - exams.length;

    const opts = getExportOptions();
    document.getElementById('bpShuffle').checked = opts.shuffle;
    document.getElementById('bpStudentList').checked = opts.studentList;
    document.getElementById('bpOverwrite').checked = false;
    document.getElementById('bpAllRepo').innerHTML = '<option value="">— giữ kho theo môn của từng đề —</option>' + bpRepoOptions(c, '');

    const minOpts = document.getElementById('examTime').innerHTML;
    const roundOpts = document.getElementById('examRound').innerHTML;
    const limitOpts = document.getElementById('examLimit').innerHTML;
    const fieldsPerRow = e => ({
        minutes: e.minutes || parseInt(document.getElementById('examTime').value, 10) || 45,
        round: e.round || 1,
        limit: e.limit || 0
    });
    document.getElementById('bpRows').innerHTML = exams.map((e, i) => {
        const f = fieldsPerRow(e);
        const subject = GH_SUBJECTS.includes(e.subject) && c.repos[e.subject] ? e.subject : '';
        const khoi = e.khoi || inferKhoi(e.grade);
        return `<div class="bp-row" data-exam="${e.id}" data-subject="${esc(e.subject || '')}">
            <div class="bp-title">${esc(e.title || 'Đề không tên')} <span class="bp-meta">${esc(e.subject || '')} · ${e.numQuestions || e.data.length} câu</span></div>
            <div class="bp-grid">
                <label class="bp-wide">Tên đề<input type="text" class="form-control bp-name" data-auto="1" value="${esc(bpDefaultName(e.subject, khoi, e.type, f.minutes, f.round))}" autocomplete="off"></label>
                <label class="bp-wide">Kho lưu trữ (môn)<select class="form-control bp-repo"><option value="">— chọn kho —</option>${bpRepoOptions(c, subject)}</select></label>
                <label>Khối<select class="form-control bp-khoi">${khoiOptionsHtml(khoi)}</select></label>
                <label>Loại kiểm tra<select class="form-control bp-type">${typeOptionsHtml(e.type || '', '— không ghi loại —')}</select></label>
                <label>Thời gian<select class="form-control bp-min" data-v="${f.minutes}">${minOpts}</select></label>
                <label>Lần kiểm tra<select class="form-control bp-round" data-v="${f.round}">${roundOpts}</select></label>
                <label>Số lần tối đa<select class="form-control bp-limit" data-v="${f.limit}">${limitOpts}</select></label>
                <label class="bp-span3">Lớp áp dụng<input type="text" class="form-control bp-classes" value="${esc(e.grade || '')}" autocomplete="off"></label>
            </div>
            <div class="bp-link"></div>
            <div class="bp-status"></div>
        </div>`;
    }).join('');
    document.querySelectorAll('#bpRows select[data-v]').forEach(sel => { sel.value = sel.dataset.v; });
    document.querySelectorAll('#bpRows .bp-row').forEach(row => {
        row.querySelector('.bp-name').addEventListener('input', ev => { ev.target.dataset.auto = ''; });
        row.addEventListener('input', () => bpUpdatePreview(row));
        row.addEventListener('change', ev => {
            const nameEl = row.querySelector('.bp-name');
            if (nameEl.dataset.auto === '1' && ev.target.matches('.bp-khoi, .bp-type, .bp-min, .bp-round')) {
                nameEl.value = bpDefaultName(row.dataset.subject, row.querySelector('.bp-khoi').value, row.querySelector('.bp-type').value, row.querySelector('.bp-min').value, row.querySelector('.bp-round').value);
            }
            bpUpdatePreview(row);
        });
    });
    document.querySelectorAll('#bpRows .bp-row').forEach(bpUpdatePreview);

    document.getElementById('bpTitle').innerText = exams.length === 1 ? 'Đăng 1 đề lên GitHub' : `Đăng ${exams.length} đề lên GitHub`;
    document.getElementById('bpSummary').innerText = skipped ? `Bỏ qua ${skipped} đề cũ chưa lưu nội dung câu hỏi.` : '';
    const btn = document.getElementById('bpRunBtn');
    btn.disabled = false;
    btn.onclick = bpRun;
    btn.innerHTML = `<i class="fa-brands fa-github"></i> Đăng ${exams.length === 1 ? 'đề' : exams.length + ' đề'} &amp; lấy link`;
    document.getElementById('batchPublishModal').classList.add('active');
}

function closeBatchPublish() {
    document.getElementById('batchPublishModal').classList.remove('active');
    renderExamsTable();
}

function bpDefaultName(subject, khoi, type, minutes, round) {
    return `${subject || 'Đề'}${khoi ? ' khối ' + khoi : ''}${type ? ' ' + type : ''} ${minutes} phút Lần ${round}`;
}

function bpSetAllRepo() {
    const v = document.getElementById('bpAllRepo').value;
    if (!v) return;
    document.querySelectorAll('#bpRows .bp-repo').forEach(sel => { sel.value = v; });
    document.querySelectorAll('#bpRows .bp-row').forEach(bpUpdatePreview);
}

function bpUpdatePreview(row) {
    const c = getGithubConfig();
    const repo = c.repos[row.querySelector('.bp-repo').value];
    const file = slugFileName(row.querySelector('.bp-name').value) + '.html';
    row.querySelector('.bp-link').innerText = repo ? 'Link sẽ là: ' + ghPagesUrl({ owner: c.owner, repo }, ghExamPath(c, row.querySelector('.bp-khoi').value, file)) : 'Chưa chọn kho lưu trữ.';
}

function bpSetStatus(row, html) { row.querySelector('.bp-status').innerHTML = html; }

function bpActions(url) {
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>
        <button class="btn-view" style="margin-left:6px;" data-url="${esc(url)}" onclick="bpCopy(this)"><i class="fa-regular fa-copy"></i> Sao chép</button>
        <button class="btn-view" style="margin-left:4px;" data-url="${esc(url)}" onclick="bpQr(this)"><i class="fa-solid fa-qrcode"></i> Mã QR</button>`;
}
async function bpCopy(btn) {
    try { await navigator.clipboard.writeText(btn.dataset.url); } catch (e) {}
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã chép';
}
function bpQr(btn) { openPublishModal('Link bài kiểm tra:', btn.dataset.url, 'var(--c-green)'); }

// Tải một file đề lên đúng kho; trả về thông tin file (exists = trùng tên và chưa cho ghi đè)
async function ghUploadExam(c, repo, rawName, html, overwrite, khoi) {
    const cr = Object.assign({}, c, { repo });
    const file = slugFileName(rawName) + '.html';
    const path = ghExamPath(c, khoi, file);
    const url = ghPagesUrl(cr, path);
    const apiPath = `${ghRepoPath(cr)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    let sha;
    try { sha = (await githubApi(cr, 'GET', `${apiPath}?ref=${encodeURIComponent(c.branch)}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    if (sha && !overwrite) return { exists: true, file, url };
    const res = await githubApi(cr, 'PUT', apiPath, {
        message: `Đăng đề ${rawName}`, content: utf8ToBase64(html), branch: c.branch, ...(sha ? { sha } : {})
    });
    return { file, path, url, replaced: !!sha, sha: res.content && res.content.sha };
}

async function bpRun() {
    const c = getGithubConfig();
    const rows = Array.from(document.querySelectorAll('#bpRows .bp-row'));
    const stats = getStats();
    const overwrite = document.getElementById('bpOverwrite').checked;
    const options = { shuffle: document.getElementById('bpShuffle').checked, studentList: document.getElementById('bpStudentList').checked };
    lsSet('robotExportOptions', JSON.stringify(options));

    // Thu thập + kiểm tra dữ liệu nhập
    const items = [];
    const seen = new Set();
    let invalid = false;
    for (const row of rows) {
        if (row.dataset.done) continue; // đề đã đăng thành công ở lần bấm trước
        const exam = stats.recentExams.find(e => e.id === Number(row.dataset.exam));
        const subjectKey = row.querySelector('.bp-repo').value;
        const name = row.querySelector('.bp-name').value.trim();
        bpSetStatus(row, '');
        const khoi = row.querySelector('.bp-khoi').value;
        const err = !subjectKey ? 'Chưa chọn kho lưu trữ.' : !khoi ? 'Chưa chọn Khối của đề.' : !name ? 'Chưa đặt tên đề.' : '';
        const key = c.repos[subjectKey] + '/' + khoi + '/' + slugFileName(name);
        if (!err && seen.has(key)) { bpSetStatus(row, '<span style="color:var(--c-red);">❌ Trùng tên với đề khác trong cùng kho. Hãy đặt tên khác.</span>'); invalid = true; continue; }
        if (err) { bpSetStatus(row, `<span style="color:var(--c-red);">❌ ${err}</span>`); invalid = true; continue; }
        seen.add(key);
        items.push({
            row, exam, name, repo: c.repos[subjectKey],
            meta: {
                subject: (exam.subject || subjectKey).trim(),
                khoi: parseInt(khoi, 10),
                type: row.querySelector('.bp-type').value,
                minutes: parseInt(row.querySelector('.bp-min').value, 10) || 45,
                round: parseInt(row.querySelector('.bp-round').value, 10) || 1,
                limit: parseInt(row.querySelector('.bp-limit').value, 10) || 0,
                classes: parseClasses(row.querySelector('.bp-classes').value),
                options
            }
        });
    }
    if (invalid) return;
    if (!items.length) return closeBatchPublish();

    if (!lsGet('robotWebhookUrl').trim() && !confirm('Chưa cấu hình Google Sheets: học sinh làm bài sẽ KHÔNG lưu được điểm. Vẫn đăng đề?')) return;

    const lech = items.map(it => ({ it, bad: khoiMismatch(it.meta.khoi, it.meta.classes) })).filter(x => x.bad.length);
    if (lech.length && !confirm('Lớp áp dụng không khớp Khối đã chọn:\n\n' + lech.map(x => `• ${x.it.name}: lớp ${x.bad.join(', ')} không thuộc Khối ${x.it.meta.khoi}`).join('\n') + '\n\nBấm OK để vẫn đăng, Hủy để quay lại sửa.')) return;

    if (!(await confirmGasSupportsType(items.some(it => it.meta.type)))) return;

    // Cảnh báo một lần cho các đề trùng lần kiểm tra đã có bài nộp
    const warns = [];
    for (const it of items) {
        const u = await getRoundUsage(it.meta);
        if (u) warns.push(`• ${it.name}: ${it.meta.subject}${it.meta.type ? ' ' + it.meta.type : ''} ${it.meta.minutes} phút Lần ${it.meta.round} đã có ${u.used.length} bài nộp` + (u.free <= 6 ? ` (gợi ý lần trống: Lần ${u.free})` : ''));
    }
    if (warns.length && !confirm(`Các đề sau trùng "môn + thời gian + lần kiểm tra" đã có bài nộp trong năm học, điểm sẽ bị gộp và lấy điểm cao nhất:\n\n${warns.join('\n')}\n\nBấm OK nếu là CÙNG bài kiểm tra; Hủy để quay lại đổi "Lần kiểm tra".`)) return;

    const btn = document.getElementById('bpRunBtn');
    btn.disabled = true;
    let ok = 0, fail = 0, skippedExists = 0;
    const done = [];
    for (const it of items) {
        bpSetStatus(it.row, '⏳ Đang tải lên...');
        try {
            const html = buildExamHtml(it.meta, it.exam.data);
            const r = await ghUploadExam(c, it.repo, it.name, html, overwrite, it.meta.khoi);
            if (r.exists) {
                skippedExists++;
                bpSetStatus(it.row, `<span style="color:#b45309;">⚠️ Kho <b>${esc(it.repo)}</b> đã có đề tên "${esc(r.file)}" — chưa đăng. Đặt tên khác, hoặc tick "Ghi đè nếu trùng tên".</span>`);
                continue;
            }
            const entry = { path: r.path, url: r.url, sha: r.sha, repo: `${c.owner}/${it.repo}`, branch: c.branch, examId: it.exam.id, khoi: it.meta.khoi,
                title: `${it.name} (${it.meta.subject} · Khối ${it.meta.khoi}${it.meta.type ? ' · ' + it.meta.type : ''} · ${it.meta.minutes} phút · Lần ${it.meta.round})`, classes: it.meta.classes.join(', '), time: Date.now() };
            setPublished([entry, ...getPublished().filter(p => !(p.repo === entry.repo && p.path === entry.path))]);
            ok++;
            it.row.dataset.done = '1';
            done.push({ it, url: r.url });
            bpSetStatus(it.row, `✅ Đã tải lên${r.replaced ? ' (thay đề cũ cùng tên)' : ''} vào <b>${esc(it.repo)}</b> · <span class="bp-live">⏳ đang chờ link hoạt động...</span><div style="margin-top:4px;">${bpActions(r.url)}</div>`);
        } catch (e) {
            fail++;
            bpSetStatus(it.row, `<span style="color:var(--c-red);">❌ ${esc(e.status === 404 ? `Không tìm thấy kho "${it.repo}" hoặc token chưa được cấp quyền cho kho này.`
                : e.status === 403 ? `Token chưa có quyền ghi vào kho "${it.repo}". ${GH_FIX_HINT}` : e.message)}</span>`);
        }
    }
    renderPublishedList();
    document.getElementById('bpSummary').innerText = `Đã đăng ${rows.filter(r => r.dataset.done).length}/${rows.length} đề` + (skippedExists ? ` · ${skippedExists} đề trùng tên chưa đăng` : '') + (fail ? ` · ${fail} đề lỗi` : '') +
        (ok ? '. Link thường hoạt động sau 30 giây – 2 phút.' : '');
    btn.disabled = false;
    btn.innerHTML = skippedExists || fail ? '<i class="fa-solid fa-rotate-right"></i> Đăng lại các đề chưa đăng' : '<i class="fa-solid fa-check"></i> Xong';
    if (!skippedExists && !fail) btn.onclick = closeBatchPublish; else btn.onclick = bpRun;
    renderExamsTable();

    // Chờ từng link hoạt động (không chặn giao diện)
    done.forEach(async ({ it, url }) => {
        const live = it.row.querySelector('.bp-live');
        const started = Date.now();
        while (Date.now() - started < 4 * 60 * 1000) {
            if (!document.getElementById('batchPublishModal').classList.contains('active')) return;
            try { if ((await fetch(url + '?t=' + Date.now(), { cache: 'no-store' })).ok) { live.innerHTML = '<span style="color:var(--c-green);">🟢 link đã hoạt động</span>'; return; } } catch (e) {}
            await new Promise(r => setTimeout(r, 6000));
        }
        live.innerHTML = '<span style="color:#b45309;">chưa mở được sau 4 phút — thử lại link sau ít phút</span>';
    });
}
