// Kerangka HTML bersama untuk template offline.
export const page = (title, color, body, script = '') => `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Roboto,sans-serif;background:#f6f7fb;color:#1f2330}
header{background:${color};color:#fff;padding:20px 16px}header h1{margin:0;font-size:20px}main{padding:16px;max-width:640px;margin:auto}
.card{background:#fff;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
button,.btn{background:${color};color:#fff;border:0;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:600;width:100%;display:block;text-align:center;text-decoration:none}
input,textarea,select{width:100%;padding:12px;border:1px solid #dde;border-radius:10px;font-size:15px;margin:6px 0 12px}
.row{display:flex;gap:8px}.row>*{flex:1}.muted{color:#778}</style></head><body>${body}<script>${script}</script></body></html>`;

