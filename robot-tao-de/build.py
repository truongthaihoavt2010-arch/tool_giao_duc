import base64
with open("template_test.html", "rb") as f:
    data = f.read()
b64 = base64.b64encode(data).decode("utf-8")
with open("template_data.js", "w", encoding="utf-8") as f:
    f.write(f'const TEMPLATE_B64 = "{b64}";\n')
