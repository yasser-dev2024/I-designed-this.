from pathlib import Path
import json

folder = Path(r"C:\Users\Test2\Downloads\zamzami")
text_path = folder / "poems_ocr.txt"
out_path = folder / "poems.json"

if not text_path.exists():
    print('poems_ocr.txt not found in', folder)
    raise SystemExit(1)

raw = text_path.read_text(encoding='utf-8')
blocks = [b.strip() for b in raw.split('\n\n') if b.strip()]
poems = []
for b in blocks:
    lines = [l.strip() for l in b.split('\n') if l.strip()]
    if not lines: continue
    if len(lines)>1 and len(lines[0])<80:
        title = lines[0]
        body = '\n'.join(lines[1:])
    else:
        title = f"قصيدة {len(poems)+1}"
        body = '\n'.join(lines)
    poems.append({'title':title, 'body':body})

out_path.write_text(json.dumps(poems, ensure_ascii=False, indent=2), encoding='utf-8')
print('WROTE', out_path, 'with', len(poems), 'poems')
