from pathlib import Path
import fitz
folder = Path(r"C:\Users\Test2\Downloads\zamzami")
pdf = folder / 'poems.pdf'
out = folder / 'poems_extracted_fitz.txt'
if not pdf.exists():
    print('PDF_NOT_FOUND')
    raise SystemExit(1)

doc = fitz.open(str(pdf))
parts = []
for i,page in enumerate(doc):
    t = page.get_text('text')
    parts.append(t)
    print(f'PAGE {i+1} len={len(t)}')

out.write_text('\n\n'.join(parts), encoding='utf-8')
print('WROTE', out)
