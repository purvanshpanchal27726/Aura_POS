import os, glob

backend_dir = r'd:\Interships\Vanshee Infotech\POS System\Project_flutter\new_user_backend'
api_files = glob.glob(os.path.join(backend_dir, '*API.js'))

for filepath in api_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    # Replace falsy clientId checks with strict non-null/non-undefined checks
    code = code.replace('if (clientId)', 'if (clientId !== null && clientId !== undefined)')
    code = code.replace('if (!clientId &&', 'if ((clientId === null || clientId === undefined) &&')
    code = code.replace('if (!clientId)', 'if (clientId === null || clientId === undefined)')
    code = code.replace('if (cid)', 'if (cid !== null && cid !== undefined)')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

print("Updated all API files to treat client_id = 0 as valid non-falsy integer!")
