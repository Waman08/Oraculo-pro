import os

keywords = ['TODO', 'mock', 'hardcode', 'Coming Soon']
for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or '__pycache__' in root or '.next' in root:
        continue
    for file in files:
        if not file.endswith(('.ts', '.tsx', '.py')):
            continue
        path = os.path.join(root, file)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    for k in keywords:
                        if k.lower() in line.lower():
                            print(f"{path}:{i+1} - {line.strip()}")
        except Exception:
            pass
