from pathlib import Path
import fitz
from PIL import Image, ImageOps
import pytesseract
import io
import json
import os
import time

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pdf_path = folder / "poems.pdf"
out_path = folder / "pages.json"
if not pdf_path.exists():
    print("ERROR: file not found:", pdf_path)
    raise SystemExit(1)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
os.environ['TESSDATA_PREFIX'] = str(folder / 'tessdata')

NOISE_SUBSTRINGS = [
    'الممسوحة ضوئيا', 'المسح', 'scan', 'المسح الضوئي', 'المسح ضوئيا', 'مسح ضوئي',
    'pdf', 'المجموعة الشعرية', 'الشمرية', 'الكامله', 'الهاتف', 'camscanner',
    '080050800281', '0630050830021', '0830050830021', '0630050890021', '03005080021',
]

def clean_page_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = []
    for line in lines:
        lower = line.lower()
        if any(noise in lower for noise in NOISE_SUBSTRINGS):
            continue
        if lower.startswith('الصفحة') and len(line) < 30:
            continue
        if line.startswith('(') and ')' in line and len(line) < 80:
            continue
        cleaned.append(line)
    return '\n'.join(cleaned)

print('Opening PDF:', pdf_path)
doc = fitz.open(str(pdf_path))
pages = []
t_start = time.time()
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=400)
    img = Image.open(io.BytesIO(pix.tobytes('png'))).convert('L')
    img = ImageOps.autocontrast(img, cutoff=1)
    text = pytesseract.image_to_string(
        img, lang='ara_best', config='--psm 6 -c preserve_interword_spaces=1'
    )
    text = clean_page_text(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0] if lines else f'الصفحة {i+1}'
    pages.append({
        'page': i + 1,
        'title': title,
        'body': text
    })
    if (i + 1) % 10 == 0 or (i + 1) == len(doc):
        elapsed = time.time() - t_start
        print(f'Processed {i+1}/{len(doc)} pages ({elapsed:.1f}s elapsed)', flush=True)

print('Writing JSON to', out_path)
out_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
print('DONE')
