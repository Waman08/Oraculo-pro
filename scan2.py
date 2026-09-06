import os
for root, dirs, files in os.walk('src'):
    if 'node_modules' in root or '.git' in root or '.next' in root: continue
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    if 'coming soon' in line.lower() or 'proximamente' in line.lower():
                        print(f"{path}:{i+1} - {line.strip()}")
