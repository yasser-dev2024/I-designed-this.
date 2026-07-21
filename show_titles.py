import json
p = r'C:\Users\Test2\Downloads\zamzami\poems.json'
with open(p, encoding='utf-8') as f:
    j = json.load(f)
print('COUNT:', len(j))
for i, item in enumerate(j[:30], start=1):
    title = item.get('title') or ''
    print(f"{i}. {title}")
