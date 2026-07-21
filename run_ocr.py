from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import os
import io

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pdf_path = folder / "poems.pdf"
out_path = folder / "poems_ocr.txt"

if not pdf_path.exists():
    print("ERROR: file not found:", pdf_path)
    raise SystemExit(1)

# If tesseract not in PATH, set here (uncomment and adjust if needed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# Use local tessdata in project to avoid writing to Program Files
os.environ['TESSDATA_PREFIX'] = str(folder / 'tessdata')

print('Opening PDF:', pdf_path)
doc = fitz.open(str(pdf_path))
all_text = []
for i, page in enumerate(doc):
    print(f"Rendering page {i+1}/{len(doc)}...")
    pix = page.get_pixmap(dpi=300)
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data)).convert("RGB")
    print("Running tesseract OCR (Arabic) on page", i+1)
    try:
        text = pytesseract.image_to_string(img, lang="ara")
    except Exception as e:
        print("OCR failed on page", i+1, "error:", e)
        text = pytesseract.image_to_string(img)
    all_text.append(text)

print("Writing OCR output to", out_path)
out_path.write_text("\n\n".join(all_text), encoding="utf-8")
print("DONE")
