import json, re
from pathlib import Path
path = Path(r'C:\Users\Test2\Downloads\zamzami\poems.json')
with path.open(encoding='utf-8') as f:
    data = json.load(f)

def is_noise(p):
    title = (p.get('title') or '').lower()
    body = (p.get('body') or '').lower()
    full = title + ' ' + body
    noise_patterns = [
        'الممسوحة ضوئيا', 'المسح', 'scan', 'شرح ديوان', 'المقالة', 'صفحات', 'دار الكتب', 'بيروت',
        'المجموعة الشعرية الكاملة', 'مطبعة', 'المجلد', 'تاريخ', 'ص ', 'ص. ', 'م. ',
        'الصفحة', 'ملف', 'pdf', 'تحتوي', 'المسح الضوئي', 'العنوان', 'الهاتف'
    ]
    if any(pat in full for pat in noise_patterns):
        return True
    b = (p.get('body') or '').strip()
    if len(b) < 40:
        return True
    letters = len(re.sub(r'[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFC3F\uFDF0-\uFDFF]+', '', b))
    if letters < max(10, len(b) * 0.35):
        return True
    return False

count = len(data)
noise = sum(1 for p in data if is_noise(p))
keep = [p for p in data if not is_noise(p)]
print('total', count, 'noise', noise, 'keep', len(keep))
for i, p in enumerate(keep[:20], start=1):
    print(i, p.get('title'))
