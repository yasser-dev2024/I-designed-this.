from pathlib import Path
import fitz
from PIL import Image
import pytesseract
import io
import json
import os

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pdf_path = folder / "poems.pdf"
out_path = folder / "pages.json"
if not pdf_path.exists():
    print("ERROR: file not found:", pdf_path)
    raise SystemExit(1)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
os.environ['TESSDATA_PREFIX'] = str(folder / 'tessdata')

def clean_page_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = []
    for line in lines:
        lower = line.lower()
        if any(noise in lower for noise in [
            'الممسوحة ضوئيا', 'المسح', 'scan', 'المسح الضوئي', 'المسح ضوئيا', 'مسح ضوئي',
            'scan', 'pdf', 'المجموعة الشعرية', 'الشمرية', 'الكامله', 'الهاتف', '080050800281',
            '0630050830021', '0830050830021', '0630050890021', '03005080021'
        ]):
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
for i, page in enumerate(doc):
    print(f'Rendering page {i+1}/{len(doc)}...')
    pix = page.get_pixmap(dpi=300)
    img_data = pix.tobytes('png')
    img = Image.open(io.BytesIO(img_data)).convert('RGB')
    text = pytesseract.image_to_string(img, lang='ara')
    text = clean_page_text(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0] if lines else f'الصفحة {i+1}'
    pages.append({
        'page': i + 1,
        'title': title,
        'body': text
    })

print('Writing JSON to', out_path)
out_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding='utf-8')
print('DONE')
