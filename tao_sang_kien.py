import os
import subprocess
import sys

def install_and_import(package):
    try:
        import docx
    except ImportError:
        print(f"Installing {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        import docx

install_and_import('python-docx')
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

def create_document():
    doc = Document()
    
    # Thiết lập font mặc định
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(14)
    
    # Cấu hình để Word nhận đúng font Times New Roman
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

    # Tiêu đề Quốc hiệu
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc")
    run.bold = True
    run.font.size = Pt(13)
    
    doc.add_paragraph("\n")
    
    # Tên sáng kiến
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("BÁO CÁO KẾT QUẢ\nNGHIÊN CỨU, ỨNG DỤNG SÁNG KIẾN")
    run.bold = True
    run.font.size = Pt(16)
    
    doc.add_paragraph("\n")
    
    # Thông tin chung
    p = doc.add_paragraph()
    p.add_run("1. Tên sáng kiến: ").bold = True
    p.add_run("Xây dựng Hệ sinh thái Công cụ Giáo dục AI (Tool Giáo Dục) tích hợp Robot Tạo Đề và Quản Lý Điểm hỗ trợ giáo viên chuyển đổi số.")
    
    p = doc.add_paragraph()
    p.add_run("2. Tác giả: ").bold = True
    p.add_run("Trương Thái Hòa - Giáo viên Tin học")
    
    p = doc.add_paragraph()
    p.add_run("3. Lĩnh vực áp dụng: ").bold = True
    p.add_run("Công nghệ thông tin, Ứng dụng AI trong quản lý và giảng dạy.")
    
    p = doc.add_paragraph()
    p.add_run("4. Mô tả bản chất của sáng kiến:")
    p.runs[0].bold = True
    
    # 4.1. Đặt vấn đề
    p = doc.add_paragraph()
    p.add_run("4.1. Đặt vấn đề (Thực trạng):")
    p.runs[0].bold = True
    p.runs[0].italic = True
    
    doc.add_paragraph(
        "Trong bối cảnh chuyển đổi số giáo dục đang diễn ra mạnh mẽ, việc ứng dụng công nghệ thông tin vào giảng dạy và quản lý là yêu cầu tất yếu. "
        "Tuy nhiên, hiện nay nhiều giáo viên vẫn đang mất rất nhiều thời gian cho các công đoạn thủ công như: biên soạn đề thi trắc nghiệm (cần đảm bảo đa dạng, chuẩn ma trận, có đáp án và lời giải) và quản lý điểm số của học sinh.\n"
        "Các công cụ hỗ trợ hiện có trên thị trường thường có những hạn chế như: rời rạc, yêu cầu trả phí cao, giao diện phức tạp khó sử dụng với số đông giáo viên, hoặc phụ thuộc hoàn toàn vào kết nối mạng ổn định với server nhà cung cấp.\n"
        "Từ thực tiễn đó, nhu cầu về một công cụ tích hợp (All-in-one), ứng dụng Trí tuệ Nhân tạo (AI) để tự động hóa các thao tác, giao diện thân thiện và quan trọng nhất là hoàn toàn MIỄN PHÍ cho cộng đồng giáo viên là rất cấp thiết."
    )
    
    # 4.2. Giải pháp thực hiện
    p = doc.add_paragraph()
    p.add_run("4.2. Giải pháp và nội dung thực hiện:")
    p.runs[0].bold = True
    p.runs[0].italic = True
    
    doc.add_paragraph(
        "Dự án \"TOOL GIÁO DỤC\" được xây dựng dưới dạng một nền tảng tích hợp hợp nhất hai phân hệ chính:"
    )
    
    # Phân hệ 1
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Robot Tạo Đề bằng AI: ").bold = True
    p.add_run(
        "Ứng dụng công nghệ AI tạo sinh tiên tiến (sử dụng API của OpenRouter và Groq với các mô hình ngôn ngữ lớn LLM như Llama 3.3 70B Versatile). "
        "Hệ thống tự động sinh ra các đề thi trắc nghiệm dựa trên nội dung bài giảng và ma trận kiến thức giáo viên cung cấp. "
        "Đặc biệt, ứng dụng được thiết kế thuật toán 'Phân luồng gọi model ưu tiên' (AI Routing & Fallback): Tự động chuyển đổi giữa các nhà cung cấp AI khi có hiện tượng nghẽn mạng để đảm bảo quá trình ra đề không bị gián đoạn, tối ưu hóa tốc độ và độ thông minh của đề bài."
    )
    
    # Phân hệ 2
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Quản Lý Điểm: ").bold = True
    p.add_run(
        "Hệ thống sổ điểm điện tử tinh gọn, giúp giáo viên lưu trữ, tính toán và xuất báo cáo điểm số nhanh chóng."
    )
    
    # Công nghệ
    p = doc.add_paragraph(style='List Bullet')
    p.add_run("Tích hợp All-in-one & Công nghệ PWA: ").bold = True
    p.add_run(
        "Hai công cụ trên được gộp thành một Cổng thông tin (Portal) duy nhất. "
        "Giao diện được thiết kế hiện đại (Dark mode, tối ưu UX/UI), loại bỏ các thành phần dư thừa (như thanh địa chỉ trình duyệt) thông qua script tự động hoặc cài đặt dạng ứng dụng độc lập (Progressive Web App). "
        "Hệ thống chạy mượt mà ngay trên máy tính cá nhân (Client-side) mà không đòi hỏi thiết lập máy chủ phức tạp."
    )
    
    # 4.3. Tính mới, tính sáng tạo
    p = doc.add_paragraph()
    p.add_run("4.3. Tính mới, tính sáng tạo:")
    p.runs[0].bold = True
    p.runs[0].italic = True
    
    doc.add_paragraph(style='List Bullet').add_run("Ứng dụng linh hoạt và làm chủ công nghệ AI Generative miễn phí vào việc ra đề.").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Giải quyết triệt để bài toán quá tải server AI bằng thuật toán tự động cân bằng tải và chuyển đổi mô hình (Smart Fallback & Timeout).").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Đóng gói thành một ứng dụng duy nhất, dễ dàng cài đặt chỉ bằng 1 cú click chuột (file .bat), phù hợp với mọi trình độ tin học của giáo viên.").bold = False
    
    # 5. Hiệu quả
    p = doc.add_paragraph()
    p.add_run("5. Hiệu quả mang lại:")
    p.runs[0].bold = True
    
    doc.add_paragraph(style='List Bullet').add_run("Tiết kiệm đến 80% thời gian cho khâu chuẩn bị đề thi và làm hồ sơ điểm số.").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Nâng cao chất lượng câu hỏi trắc nghiệm, tạo sự đa dạng trong đánh giá năng lực học sinh nhờ sức mạnh của AI.").bold = False
    doc.add_paragraph(style='List Bullet').add_run("Dự án được xây dựng với mục tiêu phục vụ cộng đồng (Miễn phí 100%), dễ dàng chia sẻ, nhân rộng cho toàn thể giáo viên trong trường và trên địa bàn thành phố.").bold = False
    
    # 6. Kiến nghị
    p = doc.add_paragraph()
    p.add_run("6. Kết luận và kiến nghị:")
    p.runs[0].bold = True
    
    doc.add_paragraph(
        "Sáng kiến \"Tool Giáo Dục\" là một bước tiến nhỏ nhưng mang tính thực tiễn cao trong công cuộc chuyển đổi số ngành giáo dục. "
        "Kính đề nghị Hội đồng Khoa học các cấp xem xét, nghiệm thu và hỗ trợ lan tỏa ứng dụng này đến các trường học, giúp giáo viên giảm bớt áp lực hồ sơ sổ sách, có thêm thời gian đầu tư cho chuyên môn và đổi mới phương pháp giảng dạy."
    )
    
    doc.add_paragraph("\n")
    
    # Chữ ký
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run("Ngày ..... tháng ..... năm 202...\nNgười báo cáo\n\n\n\nTrương Thái Hòa")
    run.bold = True
    run.font.size = Pt(14)
    
    output_path = r"D:\TOOL GIAO DUC\HoSo_SangKien_Tool_Giao_Duc.docx"
    doc.save(output_path)
    print(f"Đã tạo file thành công tại: {output_path}")

if __name__ == '__main__':
    create_document()
