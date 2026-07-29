import os, glob

backend_dir = r'd:\Interships\Vanshee Infotech\POS System\Project_flutter\new_user_backend'
api_files = glob.glob(os.path.join(backend_dir, '*API.js'))

for filepath in api_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Update getClientId
    old_get_client_id = """function getClientId(req) {
  const cid = req.headers['x-client-id'] || req.query.client_id;
  if (!cid || cid === 'null' || cid === 'undefined') return null;
  return parseInt(cid);
}"""

    new_get_client_id = """function getClientId(req) {
  let cid = req.headers['x-client-id'] || req.query.client_id;
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') {
    if (req.user && req.user.client_id !== undefined && req.user.client_id !== null) {
      cid = req.user.client_id;
    }
  }
  if (cid === undefined || cid === null || cid === 'null' || cid === 'undefined') return null;
  const parsed = parseInt(cid);
  return isNaN(parsed) ? null : parsed;
}"""

    code = code.replace(old_get_client_id, new_get_client_id)
    
    # 2. Update checkSuperAdmin
    old_check_sa = """function checkSuperAdmin(req) {
  return !req.user || req.user.client_id === null || req.user.client_id === undefined;
}"""

    new_check_sa = """function checkSuperAdmin(req) {
  return !req.user || req.user.role_id === 1 || req.user.client_id === 0 || req.user.client_id === null || req.user.client_id === undefined;
}"""

    code = code.replace(old_check_sa, new_check_sa)

    # 3. Update if (!clientId && !isSuperAdmin) to handle 0 as valid ID
    code = code.replace("if (!clientId && !isSuperAdmin)", "if (clientId === null && !isSuperAdmin)")
    code = code.replace("if (!clientId)", "if (clientId === null || clientId === undefined)")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

print("Updated all API files for client_id = 0 support!")
