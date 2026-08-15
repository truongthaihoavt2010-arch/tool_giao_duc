@echo off
:: Mở TOOL GIÁO DỤC dạng App (không có thanh địa chỉ)
:: Sử dụng đường dẫn tương đối - hoạt động ở bất kỳ thư mục nào

:: Lấy thư mục hiện tại của file .bat
set "SCRIPT_DIR=%~dp0"
set "INDEX_FILE=%SCRIPT_DIR%index.html"

:: Thử Chrome trước
set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME86="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if exist %CHROME% (
    start "" %CHROME% --app="%INDEX_FILE%" --window-size=1440,900 --no-default-browser-check
    goto :end
)

if exist %CHROME86% (
    start "" %CHROME86% --app="%INDEX_FILE%" --window-size=1440,900 --no-default-browser-check
    goto :end
)

if exist %EDGE% (
    start "" %EDGE% --app="%INDEX_FILE%" --window-size=1440,900
    goto :end
)

:: Fallback: mở trình duyệt mặc định
start "" "%INDEX_FILE%"

:end
