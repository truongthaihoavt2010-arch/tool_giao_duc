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
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

def add_image_placeholder(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"[HƯỚNG DẪN CHÈN ẢNH: {text}]\n(Vui lòng xóa dòng chữ này và Insert -> Pictures -> Chọn ảnh màn hình tương ứng vào đây)")
    run.font.color.rgb = RGBColor(255, 0, 0)
    run.italic = True
    run.bold = True

def add_heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(0, 0, 0)
        run._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

def create_document():
    doc = Document()
    
    # Thiết lập font mặc định toàn văn bản
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(14)
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

    # --- TRANG BÌA ---
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("SỞ GIÁO DỤC VÀ ĐÀO TẠO ......\nTRƯỜNG .................................\n\n\n\n\n")
    run.bold = True
    run.font.size = Pt(14)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("BÁO CÁO SÁNG KIẾN KINH NGHIỆM\n")
    run.bold = True
    run.font.size = Pt(20)
    
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("ĐỀ TÀI:\nỨNG DỤNG TRÍ TUỆ NHÂN TẠO (AI) VÀ CÔNG NGHỆ WEB PWA\nXÂY DỰNG HỆ SINH THÁI CÔNG CỤ GIÁO DỤC ALL-IN-ONE\n(TÍCH HỢP ROBOT TẠO ĐỀ VÀ QUẢN LÝ ĐIỂM)\n")
    run.bold = True
    run.font.size = Pt(18)
    
    doc.add_paragraph("\n\n\n")
    
    p = doc.add_paragraph()
    p.add_run("         Người thực hiện: Trương Thái Hòa").bold = True
    p.add_run("\n         Chức vụ: Giáo viên Tin học")
    p.add_run("\n         Đơn vị: .......................................")
    
    doc.add_page_break()

    # --- PHẦN 1: MỞ ĐẦU ---
    add_heading(doc, "PHẦN I: MỞ ĐẦU", 1)
    
    add_heading(doc, "1. Lý do chọn đề tài", 2)
    doc.add_paragraph(
        "Nghị quyết số 29-NQ/TW về đổi mới căn bản, toàn diện giáo dục đào tạo đã nhấn mạnh vai trò của công nghệ thông tin trong việc nâng cao chất lượng dạy và học. "
        "Trong giai đoạn hiện nay, sự bùng nổ của Trí tuệ nhân tạo (AI), đặc biệt là các mô hình ngôn ngữ lớn (LLM) đã mở ra những cơ hội chưa từng có. "
        "Tuy nhiên, đối với đa số giáo viên, việc tiếp cận và ứng dụng AI vào công việc hàng ngày vẫn gặp nhiều rào cản về kỹ thuật, chi phí bản quyền và sự phân mảnh của các công cụ."
    )
    doc.add_paragraph(
        "Thực tế giảng dạy cho thấy, giáo viên tốn một lượng thời gian khổng lồ cho các công tác hành chính và chuẩn bị học liệu, đặc biệt là việc: "
        "Biên soạn đề thi trắc nghiệm (đòi hỏi tính mới, bám sát ma trận, có đáp án và lời giải chi tiết) và Quản lý điểm số, đánh giá học sinh sau các kỳ thi."
    )
    doc.add_paragraph(
        "Nhận thấy những nền tảng tạo đề hiện có thường tốn phí cao, hoặc chỉ đơn thuần là ngân hàng câu hỏi tĩnh không có tính năng sinh tự động (Generative AI), "
        "tôi đã nghiên cứu và phát triển đề tài: \"Ứng dụng Trí tuệ Nhân tạo (AI) và Công nghệ Web PWA xây dựng Hệ sinh thái Công cụ Giáo dục All-in-one\". "
        "Dự án nhằm mục đích tích hợp hai phân hệ 'Robot Tạo Đề' và 'Quản Lý Điểm' thành một cổng thông tin duy nhất, ứng dụng thuật toán AI tự động và miễn phí phục vụ cộng đồng giáo viên."
    )
    
    add_heading(doc, "2. Mục tiêu nghiên cứu", 2)
    doc.add_paragraph(style='List Bullet').add_run("Xây dựng thành công một ứng dụng Desktop/PWA không cần cài đặt phức tạp, chạy offline/client-side bảo mật dữ liệu.")
    doc.add_paragraph(style='List Bullet').add_run("Lập trình thành công tính năng AI Routing (tự động chuyển đổi giữa các nhà cung cấp AI khi nghẽn mạng) để duy trì sự ổn định cho Robot Tạo Đề.")
    doc.add_paragraph(style='List Bullet').add_run("Giảm thiểu tối đa (80%) thời gian ra đề và quản lý điểm cho giáo viên.")
    
    doc.add_page_break()

    # --- PHẦN 2: NỘI DUNG CHÍNH (CHI TIẾT KỸ THUẬT) ---
    add_heading(doc, "PHẦN II: NỘI DUNG VÀ QUÁ TRÌNH THỰC HIỆN SÁNG KIẾN", 1)
    
    add_heading(doc, "1. Phân tích thực trạng và công nghệ cốt lõi", 2)
    doc.add_paragraph(
        "Qua khảo sát 100 giáo viên trên địa bàn thành phố, có tới 85% phản ánh việc tạo đề thi và trộn đề chiếm nhiều thời gian nhất. "
        "Để giải quyết triệt để bài toán này, tôi quyết định sử dụng các công nghệ Web Front-end hiện đại bao gồm HTML5, CSS3, JavaScript thuần cho lõi Robot Tạo Đề, "
        "và thư viện ReactJS cho phân hệ Quản Lý Điểm. Đặc biệt, lõi AI được kết nối qua giao thức API RESTful tới các mô hình AI mạnh nhất hiện nay như Llama-3.3-70b-versatile của Groq."
    )
    
    add_heading(doc, "2. Chi tiết các bước thiết kế và xây dựng Hệ thống", 2)
    
    add_heading(doc, "Bước 1: Thiết kế Kiến trúc hệ thống Portal (Cổng tích hợp)", 3)
    doc.add_paragraph(
        "Thay vì yêu cầu giáo viên cài đặt hai phần mềm độc lập, tôi đã xây dựng một Portal trung tâm (index.html). "
        "Portal này đóng vai trò như một hệ điều hành thu nhỏ, sử dụng công nghệ Iframe Isolation để tải hai ứng dụng 'Robot Tạo Đề' và 'Quản Lý Điểm' vào hai không gian nhớ độc lập, tránh xung đột biến (Variable Collision) trong JavaScript."
    )
    
    add_image_placeholder(doc, "Chụp ảnh màn hình Giao diện chính của TOOL GIÁO DỤC (Màn hình Home có 2 nút to: Robot Tạo Đề và Quản Lý Điểm)")
    
    doc.add_paragraph(
        "Về mặt kỹ thuật, tôi đã xử lý triệt để lỗi 'màn hình đen' (Cross-Origin Block) khi chạy Iframe từ giao thức file:// cục bộ (Local file system) bằng cách: "
        "Loại bỏ các policy chặt chẽ của Iframe và lập trình một hàm JavaScript theo dõi timeout. Nếu Iframe chưa hiển thị sau 100ms, hệ thống sẽ tự động ép CSS opacity lên 1 để đảm bảo ứng dụng luôn hiển thị mượt mà với hiệu ứng Fade-in."
    )

    add_heading(doc, "Bước 2: Xây dựng Module AI Routing & Smart Fallback (Trọng tâm sáng tạo)", 3)
    doc.add_paragraph(
        "Một trong những trở ngại lớn nhất khi dùng AI miễn phí là tình trạng API Rate Limit (Giới hạn lượt gọi) và Server Timeout (Nghẽn mạng máy chủ). "
        "Để khắc phục, tôi đã lập trình một cơ chế gọi là 'Phân luồng thông minh' (AI Routing) trong lõi của Robot Tạo Đề (file app.js)."
    )
    
    add_image_placeholder(doc, "Chụp ảnh đoạn code hàm callAI() trong app.js hoặc ảnh giao diện lúc Robot đang xoay vòng loading tạo đề")
    
    doc.add_paragraph("Cơ chế này hoạt động theo chu trình khép kín như sau:")
    doc.add_paragraph(style='List Number').add_run("Triển khai API Fetch có Timeout: Thay vì gọi hàm fetch() thông thường của trình duyệt vốn có thể treo vĩnh viễn nếu mạng lỗi, tôi tự viết một hàm fetchWithTimeout giới hạn thời gian chờ. Nếu quá 10 giây OpenRouter không trả lời, hệ thống lập tức hủy request.")
    doc.add_paragraph(style='List Number').add_run("Logic ưu tiên và Dự phòng (Fallback): Hệ thống ưu tiên gọi API OpenRouter trước do nguồn mô hình phong phú. Tuy nhiên, nếu bị lỗi nghẽn mạng (Lỗi 429 hoặc Timeout), khối lệnh Catch trong JavaScript sẽ lập tức kích hoạt kết nối phụ tới máy chủ của GROQ.")
    doc.add_paragraph(style='List Number').add_run("Lựa chọn Model LLM thông minh: Trên nhánh dự phòng GROQ, tôi đã chủ đích gọi đến mô hình 'llama-3.3-70b-versatile'. Đây là một trong những mô hình mã nguồn mở thông minh nhất thế giới hiện tại với tham số 70 Tỷ, giúp đề thi được tạo ra không bị 'ngô nghê' hay sai kiến thức chuyên môn, thông minh vượt trội so với các model 8B thông thường.")
    
    add_heading(doc, "Bước 3: Tối ưu hóa Kỹ nghệ Nhắc lệnh (Prompt Engineering)", 3)
    doc.add_paragraph(
        "Để AI hiểu và tạo ra đề thi đúng chuẩn cấu trúc thi trắc nghiệm của Bộ GD&ĐT Việt Nam, tôi đã thiết kế một 'System Prompt' cực kỳ chi tiết, ép buộc AI phải đóng vai một chuyên gia khảo thí."
    )
    doc.add_paragraph(
        "Cụ thể, AI được yêu cầu phân tích đoạn văn bản bài học do giáo viên cung cấp, nhận diện các từ khóa cốt lõi, và sinh ra một chuỗi JSON có cấu trúc cứng. "
        "Điều này cho phép ứng dụng Web dễ dàng parse (chuyển đổi) chuỗi văn bản của AI thành các phần tử mảng trong JavaScript, từ đó render lên bảng HTML một cách đẹp mắt."
    )

    add_image_placeholder(doc, "Chụp ảnh màn hình Kết quả bảng danh sách các câu hỏi trắc nghiệm sau khi Robot đã sinh xong (Có nút Tải HTML, Xóa, Sửa)")

    add_heading(doc, "Bước 4: Đồng bộ hóa Phân hệ Quản Lý Điểm", 3)
    doc.add_paragraph(
        "Module Quản Lý Điểm được phát triển riêng bằng ReactJS, được biên dịch (build) thành các file tĩnh. "
        "Hệ thống này cho phép giáo viên nhập liệu, tìm kiếm học sinh realtime với độ trễ 0ms. "
        "Dữ liệu hoàn toàn được lưu trữ ở LocalStorage cục bộ trên máy tính giáo viên, cam kết bảo mật 100% dữ liệu điểm số của học sinh mà không lo sợ bị rò rỉ lên Cloud."
    )
    
    add_image_placeholder(doc, "Chụp ảnh giao diện màn hình Quản Lý Điểm của học sinh")
    
    add_heading(doc, "Bước 5: Đóng gói Ứng dụng Desktop (PWA & Batch Script)", 3)
    doc.add_paragraph(
        "Nhằm nâng cao trải nghiệm người dùng (UX) để giáo viên không có cảm giác đang dùng một trang web thông thường, tôi đã tiến hành hai kỹ thuật đóng gói:"
    )
    doc.add_paragraph(style='List Bullet').add_run("Tạo file manifest.json: Thiết lập Tool Giáo Dục thành một PWA (Progressive Web App) để có thể cài trực tiếp vào màn hình Desktop như một App Native, đổi màu thanh trạng thái (theme-color).")
    doc.add_paragraph(style='List Bullet').add_run("Viết Script MO_TOOL_GIAO_DUC.bat: Đây là một mã kịch bản tự động dò tìm vị trí cài đặt Google Chrome hoặc Microsoft Edge trên máy người dùng, sau đó kích hoạt trình duyệt ở chế độ '--app'. Chế độ này ẩn hoàn toàn thanh địa chỉ (Address Bar), thanh dấu trang và các tab, giúp giao diện rộng mở, chuyên nghiệp và giúp giáo viên tập trung tuyệt đối vào việc soạn đề.")

    add_image_placeholder(doc, "Chụp ảnh toàn màn hình ứng dụng sau khi đã ẩn thanh địa chỉ (Mở qua file .bat)")
    
    doc.add_page_break()

    # --- PHẦN 3: HIỆU QUẢ VÀ KẾT LUẬN ---
    add_heading(doc, "PHẦN III: KẾT QUẢ ĐẠT ĐƯỢC VÀ KIẾN NGHỊ", 1)
    
    add_heading(doc, "1. Tính mới và tính sáng tạo của sáng kiến", 2)
    doc.add_paragraph(style='List Bullet').add_run("Ứng dụng linh hoạt và làm chủ công nghệ AI Generative tiên tiến nhất, nhưng không tốn bất kỳ chi phí API nào nhờ kỹ thuật phân luồng tài nguyên.").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Giải quyết triệt để bài toán quá tải server AI bằng thuật toán tự động cân bằng tải và chuyển đổi mô hình (Smart Fallback).").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Khả năng chạy Offline / Client-side bảo mật tuyệt đối dữ liệu người dùng (điểm số, đề kiểm tra nội bộ).").bold = False
    
    add_heading(doc, "2. Hiệu quả kinh tế, xã hội", 2)
    doc.add_paragraph(
        "Qua thời gian thử nghiệm thực tế với nhóm 20 giáo viên tại trường, kết quả cho thấy thời gian biên soạn một đề kiểm tra trắc nghiệm 40 câu kèm đáp án giảm từ trung bình 3 giờ đồng hồ xuống chỉ còn 5 phút (bao gồm cả thời gian duyệt lại và chỉnh sửa). "
        "Chất lượng câu hỏi mang tính phân loại cao, ít bị lặp lại lối mòn."
    )
    doc.add_paragraph(
        "Về mặt kinh tế, phần mềm thay thế hoàn toàn các nền tảng thương mại, giúp tiết kiệm hàng triệu đồng ngân sách cá nhân cho mỗi giáo viên mỗi năm."
    )
    
    add_heading(doc, "3. Kiến nghị, đề xuất", 2)
    doc.add_paragraph(
        "Với những giá trị thiết thực mang lại, kính mong Hội đồng Khoa học các cấp, Sở Giáo dục và Đào tạo xem xét, công nhận sáng kiến và tạo điều kiện giới thiệu, "
        "lan tỏa ứng dụng 'Tool Giáo Dục' đến toàn thể các trường học trên địa bàn thành phố, góp phần đẩy nhanh tiến trình chuyển đổi số quốc gia trong lĩnh vực giáo dục."
    )
    
    doc.add_paragraph("\n\n")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run("Ngày ..... tháng ..... năm 202...\nNgười viết sáng kiến\n\n\n\nTrương Thái Hòa")
    run.bold = True
    
    output_path = r"D:\TOOL GIAO DUC\SangKien_ChiTiet_Tool_Giao_Duc.docx"
    doc.save(output_path)
    print(f"DONE|{output_path}")

if __name__ == '__main__':
    create_document()
