# CCCD → Hợp đồng thuê nhà (Gemini 2.0 Flash)

Ứng dụng web 2 cột: bên trái tải ảnh CCCD/Passport, bên phải xem trước **hợp đồng thuê nhà** đã được điền (và chèn ảnh chân dung).
Trích xuất thông tin dùng **Gemini 2.0 Flash**.

## Chạy nhanh (khuyến nghị – bảo mật API key)
1) Cài Python 3.10+ và tạo môi trường nếu muốn.
2) Cài thư viện:
```bash
pip install -r requirements.txt
```
3) Đặt API key (ví dụ trên Windows PowerShell):
```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_KEY_HERE"
```
- Trên CMD: `set GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE`
- Trên macOS/Linux: `export GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE`

> Lưu ý: đừng gõ `GEMINI_API_KEY=....` trực tiếp trong PowerShell như một lệnh — sẽ báo *CommandNotFoundException*. Hãy dùng cú pháp `$env:` như trên.

4) Chạy server:
```bash
python server.py
```
5) Mở trình duyệt vào: **http://127.0.0.1:5000**

## Thư mục
```
public/
  index.html
  style.css
  script.js
  config.js          # Tùy chọn: nhét key client-side (không khuyến nghị)
  assets/
    contract_template.png  # Mẫu hợp đồng (đã kèm sẵn)
server.py
requirements.txt
README.md
```

## Cách dùng
- Kéo ảnh CCCD/Passport vào khung bên trái.
- Nhấn **“Trích xuất bằng AI”** → phía phải sẽ điền các trường vào mẫu hợp đồng.
- Mặc định AI sẽ trả về bbox khuôn mặt; bạn có thể bật **“Bật vẽ khung cắt ảnh”** để tự khoanh vùng chân dung.
- Bấm **“Tải hợp đồng (PNG)”** để lưu ảnh hợp đồng đã điền.

## Thay đổi mẫu hợp đồng
- Thay ảnh tại `public/assets/contract_template.png` bằng mẫu của bạn (tỉ lệ A4 dọc). Tọa độ chèn chữ đã căn theo file mặc định; nếu bạn dùng mẫu khác và chữ lệch, có thể chỉnh tọa độ trong `script.js` trong hàm `drawContract()`.

## Gọi Gemini trực tiếp từ trình duyệt (không khuyến nghị)
- Mở `public/config.js`, bỏ comment và điền API key:
```js
// window.GEMINI_API_KEY = "PUT_YOUR_GEMINI_KEY_HERE";
```
- Sau đó có thể mở `index.html` bằng Live Server / http-server. Lưu ý có thể gặp CORS; dùng `server.py` vẫn là cách ổn định nhất.

## Ghi chú kỹ thuật
- Backend gọi endpoint REST: `models/gemini-2.0-flash:generateContent` với `inline_data` (ảnh base64).
- Trả về JSON sạch, được parse và hiển thị ra giao diện.
- Ảnh chân dung được chèn vào góc phải phía trên của hợp đồng (có khung placeholder).

Chúc bạn triển khai suôn sẻ! ✨
