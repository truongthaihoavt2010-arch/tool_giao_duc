"""
Build Robot Tạo Đề — chạy sau khi sửa template_test.html hoặc google_apps_script.js:
    python build.py
1. Mã hóa template_test.html (giao diện làm bài của học sinh) -> template_data.js
2. Chép google_apps_script.js vào ô mã Apps Script ở trang "Google Sheets" của index.html
"""
import base64
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def path(name):
    return os.path.join(HERE, name)


# 1. Template đề thi
with open(path("template_test.html"), "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")
with open(path("template_data.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write(f'const TEMPLATE_B64 = "{b64}";\n')
print("OK: template_data.js")

# 2. Mã Apps Script trong trang Cài đặt
with open(path("google_apps_script.js"), encoding="utf-8") as f:
    gas = f.read().rstrip("\n")
with open(path("index.html"), encoding="utf-8") as f:
    page = f.read()
pattern = re.compile(r'(<textarea[^>]*id="gasCode"[^>]*>)(.*?)(</textarea>)', re.S)
if not pattern.search(page):
    raise SystemExit('Không tìm thấy <textarea id="gasCode"> trong index.html')
page = pattern.sub(lambda m: m.group(1) + html.escape(gas, quote=False) + m.group(3), page, count=1)
with open(path("index.html"), "w", encoding="utf-8", newline="\n") as f:
    f.write(page)
print("OK: index.html (ma Apps Script)")
