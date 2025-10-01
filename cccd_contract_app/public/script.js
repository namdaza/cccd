// ===== Config detection =====
const API_KEY = (window.GEMINI_API_KEY && window.GEMINI_API_KEY.trim() !== "") ? window.GEMINI_API_KEY : null;
const USE_DIRECT = !!API_KEY; // if key present in config.js, try direct call; otherwise use backend /extract

// ===== Elements =====
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const cccdPreview = document.getElementById('cccdPreview');
const cccdCanvas = document.getElementById('cccdCanvas');
const dzContent = document.getElementById('dzContent');
const drawHint = document.getElementById('drawHint');
const toggleDraw = document.getElementById('toggleDraw');
const btnPick = document.getElementById('btnPick');
const btnExtract = document.getElementById('btnExtract');
const btnUseAICrop = document.getElementById('btnUseAICrop');
const btnClearCrop = document.getElementById('btnClearCrop');
const contractCanvas = document.getElementById('contractCanvas');
const ctxContract = contractCanvas.getContext('2d');

// Display fields
const f = (id) => document.getElementById(id);
const fieldsEls = {
  id_type: f('fld_id_type'),
  id_number: f('fld_id_number'),
  full_name: f('fld_full_name'),
  dob: f('fld_dob'),
  sex: f('fld_sex'),
  address: f('fld_address'),
  issue_date: f('fld_issue_date')
};

let sourceImage = null;
let sourceImageBitmap = null;
let aiCrop = null;         // {x,y,w,h} predicted by AI
let userCrop = null;       // user drawn crop rectangle
let drawing = false;
let startX = 0, startY = 0;

let extracted = {};        // fields returned from AI
let templateImg = new Image();
templateImg.src = 'assets/contract_template.png';
templateImg.onload = () => { drawContract(); };

// Canvas sizes
contractCanvas.width = 1240;  // A4-ish preview
contractCanvas.height = 1754;

// --- Helpers
function dataURLFromFile(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = e => resolve(e.target.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function setPreview(dataURL){
  sourceImage = new Image();
  sourceImage.onload = async () => {
    cccdPreview.classList.add('hidden');
    dzContent.classList.add('hidden');
    cccdCanvas.classList.remove('hidden');
    if (toggleDraw.checked) drawHint.classList.remove('hidden');
    const ctx = cccdCanvas.getContext('2d');
    const maxW = dropzone.clientWidth - 20;
    const scale = Math.min(maxW / sourceImage.width, 900 / sourceImage.height, 1);
    cccdCanvas.width = sourceImage.width * scale;
    cccdCanvas.height = sourceImage.height * scale;
    ctx.drawImage(sourceImage, 0, 0, cccdCanvas.width, cccdCanvas.height);

    if ('createImageBitmap' in window){
      sourceImageBitmap = await createImageBitmap(sourceImage);
    } else {
      sourceImageBitmap = null;
    }
  };
  sourceImage.src = dataURL;
}

function drawCropRect(){
  if (!sourceImage) return;
  const ctx = cccdCanvas.getContext('2d');
  ctx.clearRect(0,0,cccdCanvas.width, cccdCanvas.height);
  ctx.drawImage(sourceImage, 0, 0, cccdCanvas.width, cccdCanvas.height);
  const rect = userCrop || aiCrop;
  if (rect){
    const scaleX = cccdCanvas.width / sourceImage.width;
    const scaleY = cccdCanvas.height / sourceImage.height;
    ctx.save();
    ctx.strokeStyle = '#7b5cff';
    ctx.fillStyle = 'rgba(123,92,255,.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(rect.x*scaleX, rect.y*scaleY, rect.w*scaleX, rect.h*scaleY);
    ctx.fillRect(rect.x*scaleX, rect.y*scaleY, rect.w*scaleX, rect.h*scaleY);
    ctx.restore();
  }
}

function getActiveCrop(){
  return userCrop || aiCrop;
}

function drawContract(){
  const w = contractCanvas.width, h = contractCanvas.height;
  const ctx = ctxContract;
  ctx.clearRect(0,0,w,h);

  if (templateImg && templateImg.complete){
    ctx.drawImage(templateImg, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 28px Inter, Arial';
    ctx.fillText('HỢP ĐỒNG THUÊ NHÀ', 430, 90);
  }

  const d = new Date();
  ctx.fillStyle = '#111';
  ctx.font = '16px Inter, Arial';
  const day = String(d.getDate()).padStart(2,'0');
  const month = String(d.getMonth()+1).padStart(2,'0');
  const year = d.getFullYear();
  ctx.fillText(`...                ${day}                   ${month}              ${year}`, w - 420, 300);

  const PORTRAIT = getActiveCrop();
  const portraitTarget = {x: 90, y: 80, w: 220, h: 280};
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.strokeRect(portraitTarget.x, portraitTarget.y, portraitTarget.w, portraitTarget.h);
  ctx.setLineDash([]);
  ctx.font = '12px Inter, Arial'; ctx.fillStyle='#555';
  ctx.fillText('Ảnh CCCD', portraitTarget.x+60, portraitTarget.y+portraitTarget.h+16);

  if (PORTRAIT && sourceImage){
    const sx = PORTRAIT.x, sy = PORTRAIT.y, sw = PORTRAIT.w, sh = PORTRAIT.h;
    try {
      ctx.drawImage(sourceImage, sx, sy, sw, sh, portraitTarget.x, portraitTarget.y, portraitTarget.w, portraitTarget.h);
    } catch (e) {
      // ignore draw errors
    }
  }

  ctx.fillStyle = '#000';
  ctx.font = '18px Inter, Arial';
  const name = extracted.full_name || '................................';
  const idno = extracted.id_number || '................';
  const dob = extracted.date_of_birth || extracted.dob || '..............';
  const sex = extracted.sex || '......';
  const issue_date = extracted.date_of_issue || extracted.issue_date || '..............';
  const address = extracted.place_of_residence || extracted.address || extracted.place_of_origin || '';

  ctx.fillText(name, 240, 900);        // Ông/Bà: ...
  ctx.fillText(idno, 300, 955);        // CMND/CCCD: ...
  ctx.fillText(issue_date, 1020, 955);  // Ngày cấp
  ctx.fillText(address, 310, 1010);     // Nơi ĐKTT

  //ctx.font = '16px Inter, Arial';
  //ctx.fillText('BÊN THUÊ (Bên B) ký và ghi rõ họ tên:', w-420, h-140);
  //ctx.font = 'italic 18px Inter, Arial';
  //ctx.fillText(name, w-420, h-80);
}

// Upload handlers
btnPick.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const dataURL = await dataURLFromFile(file);
  setPreview(dataURL);
});

dropzone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', ()=> dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', async (e)=>{
  e.preventDefault();
  dropzone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dataURL = await dataURLFromFile(file);
  setPreview(dataURL);
});

toggleDraw.addEventListener('change', ()=>{
  if (toggleDraw.checked){
    drawHint.classList.remove('hidden');
  } else {
    drawHint.classList.add('hidden');
  }
});

let rectStart = null;
cccdCanvas.addEventListener('mousedown', (e)=>{
  if (!toggleDraw.checked) return;
  const r = cccdCanvas.getBoundingClientRect();
  rectStart = {x: e.clientX - r.left, y: e.clientY - r.top};
});
cccdCanvas.addEventListener('mousemove', (e)=>{
  if (!toggleDraw.checked || !rectStart) return;
  const r = cccdCanvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const w = x - rectStart.x;
  const h = y - rectStart.y;
  const scaleX = sourceImage.width / cccdCanvas.width;
  const scaleY = sourceImage.height / cccdCanvas.height;
  userCrop = {
    x: Math.round((w>=0?rectStart.x:x) * scaleX),
    y: Math.round((h>=0?rectStart.y:y) * scaleY),
    w: Math.round(Math.abs(w) * scaleX),
    h: Math.round(Math.abs(h) * scaleY),
  };
  drawCropRect();
});
cccdCanvas.addEventListener('mouseup', ()=>{ rectStart = null; });

btnClearCrop.addEventListener('click', ()=>{ userCrop = null; drawCropRect(); drawContract(); });
btnUseAICrop.addEventListener('click', ()=>{ userCrop = null; drawCropRect(); drawContract(); });

async function callGemini(base64DataURL){
  const inlineData = base64DataURL.split(',')[1];
  const prompt = `Bạn là hệ thống trích xuất thông tin từ ảnh căn cước công dân Việt Nam (CCCD), CMND hoặc Passport. 
Trả về JSON THUẦN (không markdown) theo schema:
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
Lưu ý bbox theo pixel, toạ độ gốc (0,0) ở góc trái trên ảnh gốc. Nếu không chắc, vẫn dự đoán bbox khuôn mặt.`;

  if (USE_DIRECT){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const body = {
      contents: [{
        role: "user",
        parts: [
          {text: prompt},
          {inline_data: {mime_type: "image/jpeg", data: inlineData}}
        ]
      }],
      generationConfig: {temperature: 0.2}
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (!res.ok){
      const t = await res.text();
      throw new Error(`Gemini error ${res.status}: ${t}`);
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseJSONfromText(raw);
  } else {
    const res = await fetch('/extract', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ image_data_url: base64DataURL })
    });
    if (!res.ok){
      const t = await res.text();
      throw new Error(`Server error ${res.status}: ${t}`);
    }
    const data = await res.json();
    return data.fields || {};
  }
}

function parseJSONfromText(text){
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch(e){ console.warn('JSON parse fail', e, text); return {}; }
}

btnExtract.addEventListener('click', async ()=>{
  try{
    if (!sourceImage){
      alert('Hãy chọn ảnh CCCD/Passport trước.');
      return;
    }
    btnExtract.disabled = true; btnExtract.textContent = 'Đang trích xuất...';
    const dataURL = cccdCanvas.classList.contains('hidden') ? cccdPreview.src : cccdCanvas.toDataURL('image/jpeg', 0.95);
    const out = await callGemini(dataURL);
    extracted = out || {};
    fieldsEls.id_type.textContent = out.id_type || '—';
    fieldsEls.id_number.textContent = out.id_number || '—';
    fieldsEls.full_name.textContent = out.full_name || '—';
    fieldsEls.dob.textContent = out.date_of_birth || '—';
    fieldsEls.sex.textContent = out.sex || '—';
    fieldsEls.issue_date.textContent = out.date_of_issue || '—';
    fieldsEls.address.textContent = out.place_of_residence || out.place_of_origin || '—';
    if (out.portrait_bbox && typeof out.portrait_bbox.x === 'number'){
      aiCrop = out.portrait_bbox;
    }
    drawCropRect();
    drawContract();
    btnExtract.textContent = 'Trích xuất xong ✓';
    setTimeout(()=>{ btnExtract.textContent = 'Trích xuất bằng AI'; btnExtract.disabled = false; }, 1200);
  }catch(err){
    console.error(err);
    alert('Có lỗi khi gọi AI: ' + err.message);
    btnExtract.disabled = false; btnExtract.textContent = 'Trích xuất bằng AI';
  }
});

document.getElementById('btnDownload').addEventListener('click', ()=>{
  const url = contractCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = 'hop_dong_da_dien.png';
  a.click();
});
