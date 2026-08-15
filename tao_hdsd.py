import os
import subprocess
import sys

def install_and_import(package):
    try:
        import docx
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        import docx

install_and_import('python-docx')
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

def add_heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(0, 0, 0)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

def add_image_placeholder(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"[HƯỚNG DẪN CHÈN ẢNH: {text}]\n(Xóa dòng này và chèn ảnh minh họa vào đây)")
    run.font.color.rgb = RGBColor(255, 0, 0)
    run.italic = True
    run.bold = True

def create_document():
    doc = Document()
    
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(14)
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

    # --- TITLE ---
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("TÀI LIỆU HƯỚNG DẪN SỬ DỤNG VÀ CHỨC NĂNG\nHỆ THỐNG AI AGENT: TOOL GIÁO DỤC TÍCH HỢP\n")
    run.bold = True
    run.font.size = Pt(18)
    
    doc.add_paragraph("\n")

    # --- PHẦN 1: TỔNG QUAN ---
    add_heading(doc, "PHẦN I. CÔNG DỤNG CHI TIẾT TỪNG THÀNH PHẦN (MODULES)", 1)
    
    doc.add_paragraph(
        "Hệ thống 'Tool Giáo Dục' không chỉ là một trang web đơn thuần mà là một hệ sinh thái AI Agent hoạt động hoàn toàn trên máy trạm của người dùng (Client-side). "
        "Hệ thống bao gồm 4 thành phần cốt lõi tương tác chặt chẽ với nhau:"
    )

    add_heading(doc, "1. Thành phần Cổng giao tiếp trung tâm (Portal / index.html)", 2)
    doc.add_paragraph(style='List Bullet').add_run("Công dụng: ").bold = True
    doc.add_paragraph("Đóng vai trò như một hệ điều hành thu nhỏ (Dashboard). Nó gộp 2 phần mềm độc lập (Robot Tạo Đề và Quản Lý Điểm) vào chung một khung nhìn. Sử dụng công nghệ Iframe Isolation giúp 2 app chạy song song mà không bị xung đột dữ liệu (Memory Leak hay Variable Collision).")
    doc.add_paragraph(style='List Bullet').add_run("Cơ chế hoạt động: ").bold = True
    doc.add_paragraph("Có thanh điều hướng (Navigation Bar) dùng để chuyển đổi nhanh giữa 2 phần mềm chỉ trong 0.1 giây mà không cần tải lại trang.")

    add_heading(doc, "2. Thành phần AI Agent cốt lõi (Robot Tạo Đề - app.js)", 2)
    doc.add_paragraph("Đây là trái tim của hệ thống, được thiết kế như một AI Agent chuyên biệt cho việc khảo thí:")
    doc.add_paragraph(style='List Bullet').add_run("Động cơ LLM (Large Language Model): ").bold = True
    doc.add_paragraph("Sử dụng kỹ thuật Prompt Engineering để 'nhốt' AI vào vai trò của một Giáo sư ra đề. AI sẽ tự động phân tích ngữ nghĩa văn bản giáo viên nhập vào, trích xuất từ khóa và sinh ra câu hỏi trắc nghiệm kèm 4 đáp án (trong đó có 1 đáp án đúng và 3 đáp án nhiễu có tính logic cao).")
    doc.add_paragraph(style='List Bullet').add_run("Module Cân bằng tải & Dự phòng thông minh (AI Routing): ").bold = True
    doc.add_paragraph("Tính năng đắt giá nhất của Agent. Khi hệ thống gọi đến OpenRouter mà bị quá tải mạng (Timeout 10 giây) hoặc hết giới hạn (Rate Limit), Agent không báo lỗi văng ra ngoài. Thay vào đó, nó tự động kích hoạt 'Kế hoạch B' - Kết nối sang máy chủ Groq và gọi mô hình Llama-3.3-70B-Versatile (mô hình 70 tỷ tham số siêu thông minh) để tiếp tục tạo đề thi mà người dùng hầu như không nhận ra sự cố ngắt quãng.")
    
    add_heading(doc, "3. Thành phần Lưu trữ & Quản Lý Điểm (React App)", 2)
    doc.add_paragraph(style='List Bullet').add_run("Công dụng: ").bold = True
    doc.add_paragraph("Là sổ điểm điện tử cá nhân của giáo viên, giúp lưu lại lịch sử làm bài, điểm số định kỳ của học sinh.")
    doc.add_paragraph(style='List Bullet').add_run("Bảo mật & Tốc độ: ").bold = True
    doc.add_paragraph("Hoạt động 100% dựa trên LocalStorage (Bộ nhớ trình duyệt). Do không lưu trên Cloud, tốc độ truy xuất, tìm kiếm, lọc tên học sinh là tức thời (Real-time). Dữ liệu điểm số học sinh được bảo mật tuyệt đối trên ổ cứng máy tính cá nhân.")

    add_heading(doc, "4. Thành phần Đóng gói Desktop App (PWA & File Batch)", 2)
    doc.add_paragraph(style='List Bullet').add_run("Công dụng: ").bold = True
    doc.add_paragraph("Loại bỏ cảm giác 'đang dùng một trang web'. File MO_TOOL_GIAO_DUC.bat tự động kích hoạt trình duyệt (Chrome/Edge) ở chế độ App-mode (không có thanh địa chỉ, tab hay dấu trang). Giao diện hiển thị y hệt phần mềm cài đặt chuẩn trên Windows (Native App), tối đa hóa diện tích làm việc.")

    doc.add_page_break()

    # --- PHẦN 2: HƯỚNG DẪN SỬ DỤNG ---
    add_heading(doc, "PHẦN II. HƯỚNG DẪN SỬ DỤNG TỪNG BƯỚC (STEP-BY-STEP)", 1)
    
    add_heading(doc, "Bước 1: Khởi động Ứng dụng (App Mode)", 2)
    doc.add_paragraph(style='List Number').add_run("Mở thư mục D:\TOOL GIAO DUC trên máy tính.")
    doc.add_paragraph(style='List Number').add_run("Click đúp chuột vào file MO_TOOL_GIAO_DUC.bat (Bạn có thể click chuột phải -> Send to Desktop để tạo Shortcut mở nhanh cho những lần sau).")
    doc.add_paragraph(style='List Number').add_run("Ứng dụng sẽ mở lên dưới dạng cửa sổ độc lập, gọn gàng, không có thanh địa chỉ trình duyệt.")
    add_image_placeholder(doc, "Giao diện màn hình lúc vừa khởi động file BAT, ứng dụng mở full màn hình không có tab trình duyệt")

    add_heading(doc, "Bước 2: Thao tác trên Cổng điều hướng (Portal)", 2)
    doc.add_paragraph(style='List Number').add_run("Tại màn hình chính, bạn sẽ thấy 2 nút thẻ lớn: Robot Tạo Đề (Màu tím) và Quản Lý Điểm (Màu xanh).")
    doc.add_paragraph(style='List Number').add_run("Click vào 'Robot Tạo Đề' để bắt đầu quá trình sinh câu hỏi bằng AI.")
    
    add_heading(doc, "Bước 3: Sử dụng AI Agent - Robot Tạo Đề", 2)
    doc.add_paragraph(style='List Number').add_run("Tại giao diện Robot Tạo Đề, chuẩn bị dữ liệu: Copy một đoạn văn bản bài học, tài liệu môn học (Ví dụ: Lịch sử, Địa lý, GDCD, Tin học...) hoặc bài đọc hiểu tiếng Anh.")
    doc.add_paragraph(style='List Number').add_run("Dán đoạn văn bản đó vào khung 'Nội dung đầu vào'.")
    doc.add_paragraph(style='List Number').add_run("Chọn cấu hình (Nếu có): Số lượng câu hỏi muốn sinh ra, độ khó (Dễ, Trung bình, Khó).")
    doc.add_paragraph(style='List Number').add_run("Bấm nút 'Tạo Đề Bằng AI'.")
    
    doc.add_paragraph().add_run("Lưu ý trong quá trình AI xử lý:").bold = True
    doc.add_paragraph(
        "- Trên màn hình sẽ xuất hiện thanh trạng thái báo 'Đang kết nối OpenRouter...' hoặc vòng xoay Loading.\n"
        "- Đột phá công nghệ (AI Routing): Nếu mạng của OpenRouter quá tải và sau 10 giây chưa trả lời, ứng dụng sẽ TỰ ĐỘNG hiển thị thông báo chuyển qua Groq AI (Llama 70B). "
        "Bạn KHÔNG CẦN F5 hay làm gì cả, AI Agent sẽ tự động chuyển kênh và sinh tiếp đề cho bạn. Đây là ưu điểm tuyệt đối giúp ứng dụng không bao giờ bị 'treo'."
    )
    add_image_placeholder(doc, "Giao diện hiển thị nút 'Tạo đề' và thanh loading khi AI đang xử lý (Hiển thị luồng đang chạy)")

    add_heading(doc, "Bước 4: Duyệt kết quả, Chỉnh sửa và Xuất bản (Export)", 2)
    doc.add_paragraph(style='List Number').add_run("Sau khoảng 5-15 giây, danh sách các câu hỏi trắc nghiệm sinh ra sẽ được hiển thị trên giao diện dạng bảng.")
    doc.add_paragraph(style='List Number').add_run("Giáo viên có thể đọc lại, nếu câu nào chưa ưng ý có thể bấm nút Xóa hoặc Sửa trực tiếp trên bảng.")
    doc.add_paragraph(style='List Number').add_run("Bấm nút 'Tải HTML' hoặc 'Xuất Đề' để lưu bộ đề về máy tính dưới dạng file xem được trên mọi trình duyệt, hỗ trợ định dạng in ấn ra giấy A4 cực đẹp.")
    add_image_placeholder(doc, "Kết quả bộ đề trắc nghiệm hoàn chỉnh, bôi đậm nút 'Tải HTML'")

    add_heading(doc, "Bước 5: Thao tác trên phân hệ Quản Lý Điểm", 2)
    doc.add_paragraph(style='List Number').add_run("Nhấn nút quay lại 'Trang Chủ' ở góc trên bên trái, hoặc nhấn nút 'Quản Lý Điểm' trên thanh điều hướng.")
    doc.add_paragraph(style='List Number').add_run("Giao diện Sổ Điểm hiện ra. Tại đây, bạn nhập Tên Lớp, Tên Học Sinh và Điểm các bài kiểm tra (Miệng, 15 phút, 1 tiết).")
    doc.add_paragraph(style='List Number').add_run("Hệ thống sẽ tự động tính điểm trung bình môn theo hệ số chuẩn hiện hành.")
    doc.add_paragraph(style='List Number').add_run("Gõ tên học sinh vào ô Tìm kiếm để lọc ngay lập tức toàn bộ thông tin của học sinh đó. Tính năng tìm kiếm này được tối ưu cực nhanh do dữ liệu lưu Offline.")
    add_image_placeholder(doc, "Giao diện Quản Lý Điểm với các dòng tên học sinh và bảng điểm")

    doc.add_paragraph("\n")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("--- HẾT ---")
    run.bold = True
    
    output_path = r"D:\TOOL GIAO DUC\HuongDanSuDung_Tool_Giao_Duc.docx"
    doc.save(output_path)
    print(f"DONE|{output_path}")

if __name__ == '__main__':
    create_document()
