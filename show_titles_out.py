import json
p = r'C:\Users\Test2\Downloads\zamzami\poems.json'
out = r'C:\Users\Test2\Downloads\zamzami\titles_preview.txt'
with open(p, encoding='utf-8') as f:
    j = json.load(f)
with open(out, 'w', encoding='utf-8') as f:
    f.write('COUNT: ' + str(len(j)) + '\n')
    for i, item in enumerate(j[:30], start=1):
        title = item.get('title') or ''
        f.write(f"{i}. {title}\n")
print('WROTE', out)
