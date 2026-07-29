import os, glob

backend_dir = r'd:\Interships\Vanshee Infotech\POS System\Project_flutter\new_user_backend'
api_files = glob.glob(os.path.join(backend_dir, '*API.js'))

for filepath in api_files:
    fname = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()
    has_dup = 'SELECT' in code and ('already exists' in code or 'already added' in code or 'Duplicate' in code or 'LOWER(' in code)
    print(f"{fname}: {'HAS DUP CHECK' if has_dup else 'NO DUP CHECK'}")
