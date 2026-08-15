// Cấu hình API Keys
// LƯU Ý: Nhập API Key của bạn vào đây hoặc sử dụng DeepSeek config từ trang chủ
const OPENROUTER_API_KEY = ''; // Nhập OpenRouter API Key của bạn
const GROQ_API_KEY = ''; // Nhập Groq API Key của bạn

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
let globalGoogleSheetData = [];

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

function saveExamToHistory(subject, grade, numQuestions, title, questionsData) {
    const stats = getStats();
    stats.totalExams++;
    stats.totalQuestions += parseInt(numQuestions);
    
    // Lưu Đề
    stats.recentExams.unshift({
        id: Date.now(),
        title: title || `Đề kiểm tra ${subject} - ${grade}`,
        subject, grade, numQuestions,
        timestamp: new Date().getTime(),
        data: questionsData
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
                    <h4>${exam.title}</h4>
                    <p>${exam.subject} ${exam.grade} • ${exam.numQuestions} câu • Tạo lúc: ${dateStr}</p>
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
                <td style="font-weight:600; color:var(--primary)">${exam.title || 'Chưa đặt tên'}</td>
                <td>${exam.subject || '-'}</td>
                <td>${exam.grade || '-'}</td>
                <td>${exam.numQuestions || 0}</td>
                <td>${exam.timestamp ? new Date(exam.timestamp).toLocaleDateString("vi-VN") : '-'}</td>
                <td>
                    <button class="btn-view" onclick="downloadExam(${exam.id})"><i class="fa-solid fa-download"></i> Tải HTML</button>
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
                <td><span style="background:${color}; color:white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${q.difficulty}</span></td>
                <td>${q.question}</td>
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
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>Khối ${c.grade}</td>
                <td style="font-weight:600;">Lớp ${c.name}</td>
                <td>
                    <button class="btn-view" style="color:var(--c-red);" onclick="deleteClass(${c.id})"><i class="fa-solid fa-trash"></i> Xóa</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
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

async function fetchChartData() {
    const url = document.getElementById('webhookUrl').value.trim();
    if (!url) return alert('Vui lòng dán Web App URL vào ô Bước 2 để kết nối.');
    
    localStorage.setItem("robotWebhookUrl", url);
    document.getElementById('csvStatus').innerText = "Đang kết nối tải dữ liệu...";
    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("Lỗi kết nối Web App URL. Vui lòng kiểm tra lại đường link.");
        
        let dataJson;
        try {
            dataJson = await response.json();
        } catch (e) {
            throw new Error("Dữ liệu trả về không phải là JSON hợp lệ. Đảm bảo bạn copy đúng Web App URL.");
        }
        
        if (!Array.isArray(dataJson)) throw new Error("Dữ liệu không đúng định dạng mảng.");

        globalGoogleSheetData = dataJson;
        renderResultsClasses();

        let dateMap = {}; 
        let totalHocSinh = dataJson.length;
        
        dataJson.forEach(row => {
            let score = parseFloat(row.score) || 0;
            let dateStr = "Chưa rõ";
            if (row.date && typeof row.date === 'string') {
                let parts = row.date.split(" ");
                if (parts.length > 0) {
                    let dParts = parts[0].split("/");
                    if (dParts.length >= 2) dateStr = dParts[0] + "/" + dParts[1];
                }
            }
            if (!dateMap[dateStr]) dateMap[dateStr] = { totalScore: 0, count: 0 };
            dateMap[dateStr].totalScore += score;
            dateMap[dateStr].count += 1;
        });

        let labels = [];
        let data = [];
        let tongDiemTBToanBo = 0;

        for (let date in dateMap) {
            labels.push(date);
            let avg = dateMap[date].totalScore / dateMap[date].count;
            data.push(avg.toFixed(1));
            tongDiemTBToanBo += dateMap[date].totalScore;
        }
        
        if (labels.length > 0) {
            lineChartInstance.data.labels = labels;
            lineChartInstance.data.datasets[0].data = data;
            lineChartInstance.update();
            
            document.querySelectorAll('.stat-card h3')[2].innerText = totalHocSinh; 
            document.querySelectorAll('.stat-card h3')[3].innerText = totalHocSinh; 
            
            let diemTrungBinhCuaCacNgay = totalHocSinh > 0 ? (tongDiemTBToanBo / totalHocSinh).toFixed(1) : "0";
            document.querySelectorAll('.stat-card h3')[4].innerHTML = diemTrungBinhCuaCacNgay + '<span style="font-size:14px;color:var(--text-muted)">/10</span>';
            
            const highlightBoxes = document.querySelectorAll('.sh-box h2');
            if(highlightBoxes.length >= 3) highlightBoxes[2].innerText = totalHocSinh; 

            document.getElementById('csvStatus').innerText = "Cập nhật dữ liệu từ Google Sheets thành công!";
            document.getElementById('csvStatus').style.color = "var(--c-green)";
        } else {
            document.getElementById('csvStatus').innerText = "Google Sheets đang trống, chưa có dữ liệu nào.";
            document.getElementById('csvStatus').style.color = "orange";
        }
    } catch (e) {
        document.getElementById('csvStatus').innerText = "Lỗi tải dữ liệu: " + e.message;
        document.getElementById('csvStatus').style.color = "red";
    }
}

// ======= XEM KẾT QUẢ TỪ GOOGLE SHEETS =======
function renderResultsClasses() {
    const select = document.getElementById('resultsClassSelect');
    if (!select) return;
    
    let currentVal = select.value;
    select.innerHTML = '<option value="">-- Tất cả các lớp --</option>';
    
    let classes = new Set();
    globalGoogleSheetData.forEach(row => {
        if (row.className) classes.add(row.className.trim());
    });
    
    let sortedClasses = Array.from(classes).sort();
    sortedClasses.forEach(c => {
        let opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    
    if (sortedClasses.includes(currentVal)) {
        select.value = currentVal;
    }
    renderResultsTable();
}

function renderResultsTable() {
    const tbody = document.getElementById('tableResultsBody');
    if (!tbody) return;
    
    if (globalGoogleSheetData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color:var(--text-muted)">Chưa có dữ liệu, vui lòng cấu hình Google Sheets và chọn "Làm mới".</td></tr>';
        return;
    }
    
    const selectedClass = document.getElementById('resultsClassSelect').value;
    
    let filteredData = globalGoogleSheetData;
    if (selectedClass) {
        filteredData = globalGoogleSheetData.filter(row => row.className && row.className.trim() === selectedClass);
    }
    
    // Sắp xếp theo họ tên (Bảng chữ cái)
    filteredData.sort((a, b) => {
        let nameA = (a.name || "").toLowerCase();
        let nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB, 'vi');
    });
    
    tbody.innerHTML = '';
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color:var(--text-muted)">Không có học sinh nào trong lớp này.</td></tr>';
        return;
    }
    
    filteredData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">${index + 1}</td>
            <td style="font-weight:600;">${row.name || '-'}</td>
            <td>${row.subject || '-'}</td>
            <td>${row.examTime || '-'}</td>
            <td>${row.className || '-'}</td>
            <td>${row.date || '-'}</td>
            <td style="color:var(--c-red); font-weight:bold; text-align:center;">${row.score !== undefined ? row.score : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadResultsCsv() {
    if (globalGoogleSheetData.length === 0) return alert("Chưa có dữ liệu để tải. Vui lòng làm mới.");
    
    const selectedClass = document.getElementById('resultsClassSelect').value;
    let filteredData = globalGoogleSheetData;
    if (selectedClass) {
        filteredData = globalGoogleSheetData.filter(row => row.className && row.className.trim() === selectedClass);
    }
    
    filteredData.sort((a, b) => {
        let nameA = (a.name || "").toLowerCase();
        let nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB, 'vi');
    });
    
    if (filteredData.length === 0) return alert("Lớp này không có dữ liệu.");
    
    // Tạo BOM cho UTF-8 Excel
    let csvContent = "\uFEFFSTT,HỌ TÊN,MÔN,HÌNH THỨC KT,LỚP,THỜI GIAN NỘP,ĐIỂM SỐ\n";
    filteredData.forEach((row, index) => {
        let name = String(row.name || "").replace(/"/g, '""');
        let subject = String(row.subject || "").replace(/"/g, '""');
        let examTime = String(row.examTime || "").replace(/"/g, '""');
        let className = String(row.className || "").replace(/"/g, '""');
        let date = String(row.date || "").replace(/"/g, '""');
        let score = row.score !== undefined ? row.score : "";
        
        csvContent += `${index + 1},"${name}","${subject}","${examTime}","${className}","${date}","${score}"\n`;
    });
    
    let filename = selectedClass ? `BangDiem_${selectedClass.replace(/\s+/g, '_')}.csv` : "BangDiem_TatCa.csv";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
function buildPrompt(contextText) {
    const subject = document.getElementById('subject').value || "Không xác định";
    const grade = document.getElementById('grade').value || "Không xác định";
    const numQuestions = document.getElementById('numQuestions').value;
    const topic = document.getElementById('topicInput').value || "";
    const descInput = document.getElementById('descInput') ? document.getElementById('descInput').value.trim() : "";
    const diffEasy = document.getElementById('diffEasy').value;
    const diffMed = document.getElementById('diffMedium').value;
    const diffHard = document.getElementById('diffHard').value;

    const checkboxes = document.querySelectorAll('input[name="qType"]:checked');
    let qTypes = [];
    let explicitRanges = [];
    let currentIndex = 1;

    checkboxes.forEach(cb => {
        qTypes.push(cb.value);
        let num = parseInt(document.getElementById('numType_' + cb.value).value) || 0;
        let typeName = "";
        if (cb.value === 'mcq') typeName = "Trắc nghiệm 4 lựa chọn";
        if (cb.value === 'tf') typeName = "Đúng/Sai";
        if (cb.value === 'fill') typeName = "Điền khuyết";
        if (cb.value === 'calc') typeName = "Tính toán / Tự luận";
        
        if (num > 0) {
            let endIdx = currentIndex + num - 1;
            if (num === 1) {
                explicitRanges.push(`- CÂU SỐ ${currentIndex}: Tạo 1 câu dạng ${typeName} (Bắt buộc dùng "type": "${cb.value}").`);
            } else {
                explicitRanges.push(`- TỪ CÂU SỐ ${currentIndex} ĐẾN CÂU SỐ ${endIdx}: Tạo ${num} câu dạng ${typeName} (Bắt buộc dùng "type": "${cb.value}").`);
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

    return `Bạn là Robot tạo đề kiểm tra chuyên nghiệp.
Nhiệm vụ: Tạo CHÍNH XÁC ĐÚNG SỐ LƯỢNG câu hỏi theo cấu trúc được giao. ĐÁNH SỐ THỨ TỰ CÂU HỎI RÕ RÀNG TRONG TÂM TRÍ BẠN ĐỂ KHÔNG TẠO THIẾU HAY THỪA.
TỔNG SỐ CÂU YÊU CẦU: ${numQuestions} câu.
CHI TIẾT:
${explicitRanges.join("\n")}

Môn học: ${subject}, Khối lớp: ${grade}
Chủ đề ra đề: ${topic}
Mô tả chi tiết: ${descInput || "Không có"}
Mức độ phân bổ: ${diffEasy}% Dễ, ${diffMed}% Trung bình, ${diffHard}% Khó.
Tài liệu tham khảo (nếu có): ${contextText.substring(0, 15000)}

LƯU Ý QUAN TRỌNG: 
1. Hãy đếm kỹ số lượng câu hỏi mỗi loại bạn tạo ra. Đảm bảo tổng số lượng từng loại khớp chính xác 100% với yêu cầu trên.
2. NẾU CÓ TÀI LIỆU THAM KHẢO, BẠN PHẢI ƯU TIÊN BÁM SÁT 100% NỘI DUNG TÀI LIỆU ĐỂ TẠO CÂU HỎI. CHỈ SỬ DỤNG KIẾN THỨC BÊN NGOÀI NẾU TÀI LIỆU KHÔNG ĐỦ THÔNG TIN.
${formatInstructions}`;
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
                    "max_tokens": 4096 
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

    for (let model of OPENROUTER_MODELS) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST", headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ "model": model, "messages": messages, "max_tokens": 4000 })
            });
            if (response.ok) return await response.json();
            else errorLogs.push(`OpenRouter (${model}): ` + await response.text());
        } catch(e) { errorLogs.push(`OpenRouter Network Error (${model}): ` + e.message); }
    }
    
    // ===== PRIORITY 3: Groq (miễn phí, fallback cuối) =====
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ "model": "llama-3.1-8b-instant", "messages": messages, "max_tokens": 2000 })
        });
        if (response.ok) return await response.json();
        else errorLogs.push("Groq: " + await response.text());
    } catch(e) { errorLogs.push("Groq Network Error: " + e.message); }
    
    throw new Error("Tất cả API thất bại.\\n" + errorLogs.join("\\n"));
}

async function startGeneration(isAutoMode = false) {
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
            const prompt = buildPrompt(contextText);
            const res = await callAI([{"role": "user", "content": prompt}], false);
            const content = res.choices[0].message.content;
            
            let jsonStr = content;
            try {
                let match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                    jsonStr = match[1];
                } else {
                    let startArr = content.indexOf('[');
                    let endArr = content.lastIndexOf(']');
                    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
                        jsonStr = content.substring(startArr, endArr + 1);
                    }
                }
                data = JSON.parse(jsonStr);
                
                if (!Array.isArray(data) && typeof data === 'object') {
                    for (let key in data) {
                        if (Array.isArray(data[key])) {
                            data = data[key];
                            break;
                        }
                    }
                }
            } catch(e) {
                let lastGoodSplit = jsonStr.lastIndexOf('},{');
                if (lastGoodSplit !== -1) {
                    let recovered = jsonStr.substring(0, lastGoodSplit + 1) + ']';
                    try {
                        data = JSON.parse(recovered);
                        console.log("Đã phục hồi JSON bị đứt đoạn. Lấy được", data.length, "câu.");
                    } catch(err) { data = null; }
                }
                
                if (!data) {
                    throw new Error("AI không trả về đúng định dạng JSON. Vui lòng thử lại.");
                }
            }
        }

        if (data && Array.isArray(data)) {
            let groupedData = { 'mcq': [], 'tf': [], 'fill': [], 'calc': [] };
            data.forEach(q => {
                // Sửa lỗi AI tự đặt type linh tinh (nếu có)
                if (q.type && typeof q.type === 'string') {
                    let t = q.type.toLowerCase();
                    if (t.includes('trắc')) q.type = 'mcq';
                    else if (t.includes('đúng') || t.includes('sai')) q.type = 'tf';
                    else if (t.includes('điền') || t.includes('khuyết')) q.type = 'fill';
                    else if (t.includes('tính') || t.includes('luận')) q.type = 'calc';
                }
                
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

            data = finalData;
            if (!data || data.length === 0) {
                throw new Error("Không thể tạo đúng cấu trúc câu hỏi theo yêu cầu (Có thể tài liệu quá ngắn hoặc API quá tải).");
            }
        }

        if (Array.isArray(data) && data.length > 0) {
            currentExamData = data;
            const subject = document.getElementById('subject').value;
            const grade = document.getElementById('grade').value;
            const title = topic || `Đề ${subject} ${grade}`;
            
            saveExamToHistory(subject, grade, data.length, title, data);
            
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
    text = text.replace(/([^\n])\s*(Câu\s*\d+[\s:.]|Đáp án đúng\s*:|Gợi ý\s*:)/gi, (match, p1, p2) => {
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
        currentExamData.forEach((q, idx) => {
            let optionsHtml = '';
            if (q.type === 'mcq' || q.type === 'tf' || (!q.type && q.options)) {
                if(q.options && Array.isArray(q.options)) {
                    q.options.forEach((opt, optIdx) => {
                        let isCorrect = (optIdx === q.correctAnswerIndex);
                        let prefix = (!q.type || q.type === 'mcq') ? String.fromCharCode(65 + optIdx) + '.' : '-';
                        optionsHtml += `<div style="margin-bottom: 5px; ${isCorrect ? 'color: var(--primary); font-weight: bold;' : ''}">
                            ${prefix} ${opt} ${isCorrect ? ' <i class="fa-solid fa-check"></i>' : ''}
                        </div>`;
                    });
                }
            } else if (q.type === 'fill') {
                if (q.options && Array.isArray(q.options)) {
                    optionsHtml += `<div style="margin-bottom: 8px; font-style: italic; color: #666;">Từ gợi ý: ${q.options.join(" / ")}</div>`;
                }
                optionsHtml += `<div style="color: var(--primary); font-weight: bold;">Đáp án đúng: ${q.correctAnswerText} <i class="fa-solid fa-check"></i></div>`;
            } else if (q.type === 'calc') {
                optionsHtml += `<div style="color: var(--primary); font-weight: bold;">Đáp án đúng: ${q.correctAnswerText} <i class="fa-solid fa-check"></i></div>`;
            }
            
            body.innerHTML += `
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
                <div style="font-weight: 600; margin-bottom: 10px; color: #333;">Câu ${idx + 1} <span style="font-size:11px; background:#f0f0f0; padding:2px 6px; border-radius:4px; margin-left: 5px; font-weight:normal; color:#666;">${q.difficulty || ''}</span></div>
                <div style="margin-bottom: 10px;">${q.question}</div>
                <div style="padding-left: 10px;">${optionsHtml}</div>
                <div style="margin-top: 10px; font-size: 13px; color: #666; background: #fdfdfd; padding: 10px; border-left: 3px solid var(--primary);">
                    <strong>Giải thích:</strong> ${q.explanation || 'Không có giải thích'}
                </div>
            </div>
            `;
        });
    }
    
    document.getElementById("reviewModal").classList.add("active");
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
    
    let savedUrl = localStorage.getItem("robotWebhookUrl");
    if (savedUrl) {
        let urlInput = document.getElementById("webhookUrl");
        if (urlInput) urlInput.value = savedUrl;
    }
    
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
async function exportHTML() {
    if (currentExamData.length === 0) return alert("Chưa có dữ liệu đề thi!");
    const webhookUrl = document.getElementById('webhookUrl').value.trim();
    const examTime = document.getElementById('examTime') ? parseInt(document.getElementById('examTime').value) : 45;

    function b64DecodeUnicode(str) { return decodeURIComponent(atob(str).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')); }
    if (typeof TEMPLATE_B64 === "undefined") return alert("Không tìm thấy template_data.js.");

    let templateContent = b64DecodeUnicode(TEMPLATE_B64);
    templateContent = templateContent.replace('const EXAM_DATA = []; // Template placeholder', `const EXAM_DATA = ${JSON.stringify(currentExamData)};`);
    templateContent = templateContent.replace('const WEBHOOK_URL = ""; // Template placeholder', `const WEBHOOK_URL = "${webhookUrl}";`);
    templateContent = templateContent.replace('const EXAM_TIME = 45; // Template placeholder', `const EXAM_TIME = ${examTime};`);
    templateContent = templateContent.replace('const SUBJECT = "Chung"; // Template placeholder', `const SUBJECT = "${document.getElementById('subject').value || "Chung"}";`);
    templateContent = templateContent.replace('const ALLOWED_CLASSES = ""; // Template placeholder', `const ALLOWED_CLASSES = "${document.getElementById('grade').value || ""}";`);

    const suggestedName = `${document.getElementById('subject').value}_TracNghiem.html`.replace(/\s+/g, '_');
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
}

window.onload = () => {
    updateStatsUI();
    initCharts();
};
