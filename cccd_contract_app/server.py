import os, re, json
from flask import Flask, request, send_from_directory, jsonify
from flask_cors import CORS
import requests

APP_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(APP_DIR, "public")

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")
CORS(app)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

GEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

PROMPT = '''Bạn là hệ thống trích xuất thông tin từ ảnh căn cước công dân Việt Nam (CCCD), CMND hoặc Passport.
Hãy trả về JSON THUẦN (không markdown, không giải thích) theo schema sau:
{
  "id_type": "CCCD|CMND|PASS",
  "id_number": "string",
  "full_name": "string",
  "date_of_birth": "YYYY-MM-DD",
  "sex": "Nam|Nữ|Male|Female|Khác",
  "nationality": "string",
  "place_of_residence": "string",
  "place_of_origin": "string",
  "date_of_issue": "YYYY-MM-DD",
  "portrait_bbox": {"x": int, "y": int, "w": int, "h": int},
  "confidence": 0-1
}
Ràng buộc:
- Luôn trả JSON hợp lệ (bắt đầu bằng '{' kết thúc bằng '}'), không bọc ```json.
- portrait_bbox theo pixel ở ảnh gốc, gốc (0,0) là góc trái trên.
- Nếu thiếu trường nào, đặt chuỗi rỗng.
'''

def parse_first_json_block(text: str):
    import re, json
    m = re.search(r"\{[\s\S]*\}", text or "")
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}

@app.route("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")

@app.route("/extract", methods=["POST"])
def extract():
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY chưa được thiết lập trong biến môi trường"}), 400
    
    js = request.get_json(force=True, silent=True) or {}
    data_url = js.get("image_data_url")
    if not data_url or not data_url.startswith("data:image/"):
        return jsonify({"error":"Thiếu image_data_url dạng data URL"}), 400
    
    try:
        header, b64 = data_url.split(",", 1)
    except ValueError:
        return jsonify({"error":"Sai định dạng data URL"}), 400
    
    mime = "image/jpeg"
    if ";base64" in header:
        if "png" in header: mime = "image/png"
        elif "jpg" in header or "jpeg" in header: mime = "image/jpeg"
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": PROMPT},
                {"inline_data": {"mime_type": mime, "data": b64}}
            ]
        }],
        "generationConfig": {"temperature": 0.2}
    }
    try:
        resp = requests.post(
            GEN_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=60
        )
    except Exception as e:
        return jsonify({"error": f"Lỗi gọi Gemini: {e}"}), 500
    
    if resp.status_code != 200:
        return jsonify({"error": f"Gemini trả {resp.status_code}: {resp.text[:400]}"}), 500
    
    data = resp.json()
    text = ""
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        pass
    fields = parse_first_json_block(text) if text else {}
    return jsonify({"fields": fields, "raw": text})

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(PUBLIC_DIR, path)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"Serving at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
