const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = process.env.RSVP_DATA_FILE || path.join(ROOT, 'data', 'rsvps.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
};
function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store'});
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readResponses() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function writeResponses(rows) {
  fs.mkdirSync(path.dirname(DATA_FILE), {recursive:true});
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
function escapeCsv(value) { return '"' + String(value ?? '').replace(/"/g, '""') + '"'; }

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return send(res, 400, {error:'Bad URL'}); }

  if (req.method === 'POST' && pathname === '/api/rsvp') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        if (!['yes','no'].includes(body.attendance)) return send(res, 400, {error:'Invalid attendance'});
        const guests = body.attendance === 'yes' && Array.isArray(body.guests) ? body.guests.map(x => String(x).trim()).filter(Boolean).slice(0,2) : [];
        if (body.attendance === 'yes' && (guests.length < 1 || guests.length !== Number(body.guestCount))) return send(res, 400, {error:'Укажите имя каждого гостя.'});
        if (guests.some(name => name.length > 100)) return send(res, 400, {error:'Имя слишком длинное.'});
        let rows;
        try { rows = readResponses(); } catch (err) { console.error('Could not read RSVP data:', err); return send(res, 500, {error:'Storage error'}); }
        rows.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8), createdAt:new Date().toISOString(), attendance:body.attendance, guestCount:guests.length, guests});
        try { writeResponses(rows); } catch (err) { console.error('Could not save RSVP:', err); return send(res, 500, {error:'Storage error'}); }
        return send(res, 201, {ok:true});
      } catch { return send(res, 400, {error:'Invalid request'}); }
    });
    return;
  }

  if (pathname === '/api/admin/rsvps' || pathname === '/api/admin/rsvps.csv') {
    const adminKey = process.env.RSVP_ADMIN_KEY;
    if (!adminKey) return send(res, 503, {error:'RSVP_ADMIN_KEY is not configured'});
    if (!parsed.query.key || parsed.query.key !== adminKey) return send(res, 401, {error:'Unauthorized'});
    let rows;
    try { rows = readResponses(); } catch (err) { return send(res, 500, {error:'Could not read responses'}); }
    if (pathname.endsWith('.csv')) {
      const csv = ['Дата и время,Ответ,Количество гостей,Имена', ...rows.map(r => [r.createdAt, r.attendance === 'yes' ? 'Келемін' : 'Келе алмаймын', r.guestCount, r.guests.join('; ')].map(escapeCsv).join(','))].join('\r\n');
      res.writeHead(200, {'Content-Type':MIME_TYPES['.csv'], 'Content-Disposition':'attachment; filename="toi-rsvp.csv"', 'Cache-Control':'no-store'}); return res.end('\uFEFF'+csv);
    }
    return send(res, 200, {count:rows.length, attending:rows.filter(r=>r.attendance==='yes').reduce((n,r)=>n+r.guestCount,0), responses:rows});
  }

  if (pathname === '/admin') pathname = '/admin.html';
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {'Content-Type':MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control':ext === '.mp3' ? 'public, max-age=31536000' : 'public, max-age=3600'});
      fs.createReadStream(filePath).pipe(res); return;
    }
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Not found');
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Wedding invitation running on port ${PORT}`));
