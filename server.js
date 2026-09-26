import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {seedResources} from './data.js';
import {categories, cleanProfile, localExtract, matchResources, ruleBasedPlan, validatePlan} from './lib.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(dataDir, {recursive:true});
const db = new DatabaseSync(path.join(dataDir, 'benefitbridge.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plans (token TEXT PRIMARY KEY, created_at TEXT NOT NULL, zip TEXT NOT NULL, needs TEXT NOT NULL, profile TEXT NOT NULL, matched_ids TEXT NOT NULL, action_plan TEXT NOT NULL, checklist_state TEXT NOT NULL, selected_ids TEXT NOT NULL, done_ids TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_token TEXT NOT NULL, resource_id TEXT, rating TEXT NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL);`);
if (!db.prepare('SELECT 1 FROM resources LIMIT 1').get()) {
  const insert = db.prepare('INSERT INTO resources (id,data) VALUES (?,?)');
  for (const r of seedResources) insert.run(r.id, JSON.stringify(r));
}
function expireOldRecords(){
  db.prepare("DELETE FROM plans WHERE julianday(created_at) < julianday('now','-90 days')").run();
  db.prepare("DELETE FROM feedback WHERE julianday(created_at) < julianday('now','-90 days')").run();
}
expireOldRecords();
const expirationTimer=setInterval(expireOldRecords,24*60*60*1000);
expirationTimer.unref();
const resources = () => db.prepare('SELECT data FROM resources').all().map(x => JSON.parse(x.data));
const getPlan = token => db.prepare("SELECT * FROM plans WHERE token=? AND julianday(created_at) >= julianday('now','-90 days')").get(token);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const aiKey = process.env.OPENAI_API_KEY || '';
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function json(res, status, body) {
  const content = JSON.stringify(body);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(content)});
  res.end(content);
}
function error(res, status, message) { json(res, status, {error:message}); }
function readBody(req) {
  return new Promise((resolve,reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 65536) {reject(new Error('Request too large')); req.destroy();} });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch {reject(new Error('Invalid JSON'));} });
    req.on('error', reject);
  });
}
function admin(req) {
  if (ADMIN_TOKEN.length < 24) return false;
  const received=(req.headers.authorization||'').replace(/^Bearer /,'');
  const hash=value=>crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(hash(received),hash(ADMIN_TOKEN));
}
function safeResource(value) {
  const id = String(value.id || '').trim().slice(0,80);
  if (!/^[a-z0-9_-]+$/.test(id) || !String(value.name || '').trim()) throw new Error('Resource needs a valid ID and name');
  const r = { ...value, id, name:String(value.name).slice(0,140), organization:String(value.organization || '').slice(0,140),
    categories:Array.isArray(value.categories)?value.categories.filter(c=>categories.includes(c)):[],
    description_en:String(value.description_en||'').slice(0,1000), description_es:String(value.description_es||'').slice(0,1000),
    eligibility_summary_en:String(value.eligibility_summary_en||'').slice(0,1000), eligibility_summary_es:String(value.eligibility_summary_es||'').slice(0,1000),
    documents_needed:Array.isArray(value.documents_needed)?value.documents_needed.map(x=>String(x).slice(0,100)).slice(0,20):[],
    eligibility_rules:typeof value.eligibility_rules==='object' && value.eligibility_rules?value.eligibility_rules:{},
    coverage_zip_codes:Array.isArray(value.coverage_zip_codes)?value.coverage_zip_codes.filter(x=>/^\d{5}$/.test(x)).slice(0,1000):[],
    coverage_type:['national','state','county','city','zip_list'].includes(value.coverage_type)?value.coverage_type:'national',
    coverage_state:String(value.coverage_state||'').slice(0,2).toUpperCase(), is_active:!!value.is_active,
    priority_weight:Math.max(-30,Math.min(10,Number(value.priority_weight)||0)),
    last_verified_date:/^\d{4}-\d{2}-\d{2}$/.test(value.last_verified_date)?value.last_verified_date:null};
  for (const key of ['apply_url','source_url']) {const u=String(value[key]||'');r[key]=/^https:\/\//.test(u)?u.slice(0,500):'';}
  for (const key of ['phone','address','hours','how_to_apply']) r[key]=String(value[key]||'').slice(0,500);
  return r;
}
async function askAI(system, payload) {
  if (!aiKey) throw new Error('AI unavailable');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST', headers:{authorization:`Bearer ${aiKey}`,'content-type':'application/json'},
    body:JSON.stringify({model, input:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}], text:{format:{type:'json_object'}}, store:false, max_output_tokens:1800}),
    signal:AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const data = await response.json();
  const out = data.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('') || data.output_text || '';
  return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g,''));
}
function presentation(row, language) {
  if (!row) return null;
  const profile=JSON.parse(row.profile), all=resources(), scored=matchResources(all,profile);
  const matched=JSON.parse(row.matched_ids).map(id=>scored.matches.find(r=>r.id===id) || all.find(r=>r.id===id)).filter(Boolean);
  const action=language && language!==profile.language ? ruleBasedPlan({...profile,language},matched,scored.fallback) : JSON.parse(row.action_plan);
  return {id:row.token, created_at:row.created_at, profile,
    matched_resources:matched,
    action_plan:action, checklist_state:JSON.parse(row.checklist_state),
    selected_ids:JSON.parse(row.selected_ids), done_ids:JSON.parse(row.done_ids),
    fallback:all.find(r=>r.id==='211'), out_of_coverage:!scored.state};
}
async function enrichPlan(token, profile, matched, fallback) {
  if (!aiKey) return;
  const supplied = matched.slice(0,12).concat(fallback ? [fallback] : []);
  const allowed = new Set(supplied.map(r=>r.id));
  const system = `Write a short, kind action plan in ${profile.language==='es'?'Spanish':'English'} at a sixth-grade reading level. Return ONLY JSON with today [{action,resource_id,why}], bring [string], this_week [{action,resource_id,why}], fallbacks [{if,then,resource_id}], encouragement. Use ONLY the supplied resources. Never invent programs, phone numbers, URLs, addresses, eligibility limits, or promises of qualification. Use null for a fallback resource only when needed. Do not add personal information.`;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const plan=await askAI(system,{profile,resources:supplied});
      if (!validatePlan(plan,allowed)) throw new Error('Invalid AI plan');
      const source=JSON.stringify(supplied);
      const prose=[...plan.today.flatMap(x=>[x.action,x.why]),...plan.this_week.flatMap(x=>[x.action,x.why]),...plan.fallbacks.flatMap(x=>[x.if,x.then]),...plan.bring,plan.encouragement].join(' ');
      const factualTokens=prose.match(/https?:\/\/\S+|\$\s?\d[\d,]*|\+?\d[\d\s()-]{6,}\d/g)||[];
      if (factualTokens.some(token=>!source.includes(token.replace(/[.,;!?]$/,'')))) throw new Error('AI plan contains an unsupported contact or amount');
      db.prepare('UPDATE plans SET action_plan=? WHERE token=?').run(JSON.stringify(plan),token);
      return;
    } catch (e) { if (attempt===1) console.warn('AI plan fallback:',e.message); }
  }
}
async function handleAPI(req,res,pathname) {
  if (pathname==='/api/health' && req.method==='GET') return json(res,200,{ok:true,ai_enabled:!!aiKey});
  if (pathname==='/api/extract' && req.method==='POST') {
    const body=await readBody(req), raw=String(body.text||'').slice(0,3000), fallback=localExtract(raw);
    if (!raw.trim()) return error(res,400,'Please describe your situation.');
    if (!aiKey) return json(res,200,{...fallback,mode:'local'});
    try {
      const prompt='Extract only stated or clearly implied facts. Return ONLY a JSON object with zip, household_size, children_count, child_under_5, income_range, situations, needs, urgency, detected_language, crisis_flag. Use null when unsure. Category keys: '+categories.join(', ')+'. Situation keys: lost_job, single_parent, pregnant, veteran, senior, disability, student, unhoused, uninsured. Income keys: $0, under_1000, 1000_2000, 2000_3000, 3000_4500, 4500_plus, prefer_not. Urgency: today, week, month. Language: en or es. Flag self-harm, abuse, violence, or immediate danger. Never invent ZIP or income.';
      const out=await askAI(prompt,{text:raw});
      const p=cleanProfile(out);
      return json(res,200,{...p,zip:p.zip||null,detected_language:out.detected_language==='es'?'es':'en',crisis_flag:!!out.crisis_flag||fallback.crisis_flag,mode:'ai'});
    } catch {return json(res,200,{...fallback,mode:'local',warning:'AI could not respond. Please check the filled answers.'});}
  }
  if (pathname==='/api/plans' && req.method==='POST') {
    const body=await readBody(req), profile=cleanProfile(body);
    if (!profile.zip) return error(res,400,'Enter a five-digit ZIP code.');
    if (!profile.needs.length) return error(res,400,'Choose at least one need.');
    const all=resources(), matched=matchResources(all,profile), ids=matched.matches.map(r=>r.id);
    const token=crypto.randomBytes(24).toString('base64url');
    const action=ruleBasedPlan(profile,matched.matches,matched.fallback);
    const defaultSelected=[...new Set([...action.today,...action.this_week].map(x=>x.resource_id).filter(id=>ids.includes(id)))];
    db.prepare('INSERT INTO plans VALUES (?,?,?,?,?,?,?,?,?,?)').run(token,new Date().toISOString(),profile.zip,JSON.stringify(profile.needs),JSON.stringify(profile),JSON.stringify(ids),JSON.stringify(action),'{}',JSON.stringify(defaultSelected),'[]');
    enrichPlan(token,profile,matched.matches,matched.fallback).catch(e=>console.warn(e.message));
    return json(res,201,{...presentation(getPlan(token)),fallback:matched.fallback,out_of_coverage:matched.out_of_coverage,ai_pending:!!aiKey});
  }
  const planMatch=pathname.match(/^\/api\/plans\/([A-Za-z0-9_-]{32,})$/);
  if (planMatch) {
    const row=getPlan(planMatch[1]); if (!row) return error(res,404,'Plan not found or expired.');
    if (req.method==='GET') return json(res,200,presentation(row,new URL(req.url,'http://localhost').searchParams.get('lang')));
    if (req.method==='PATCH') {
      const body=await readBody(req), matched=JSON.parse(row.matched_ids), action=JSON.parse(row.action_plan);
      const validDocs=new Set(action.bring);
      const selected=Array.isArray(body.selected_ids)?body.selected_ids.filter(x=>matched.includes(x)):JSON.parse(row.selected_ids);
      const done=Array.isArray(body.done_ids)?body.done_ids.filter(x=>matched.includes(x)):JSON.parse(row.done_ids);
      const checks=body.checklist_state && typeof body.checklist_state==='object' ? Object.fromEntries(Object.entries(body.checklist_state).filter(([k,v])=>validDocs.has(k)&&typeof v==='boolean')):JSON.parse(row.checklist_state);
      db.prepare('UPDATE plans SET checklist_state=?, selected_ids=?, done_ids=? WHERE token=?').run(JSON.stringify(checks),JSON.stringify(selected),JSON.stringify(done),row.token);
      return json(res,200,presentation(getPlan(row.token)));
    }
  }
  if (pathname==='/api/explain' && req.method==='POST') {
    const body=await readBody(req), r=resources().find(x=>x.id===body.resource_id);
    if (!r) return error(res,404,'Resource not found.');
    const es=body.language==='es';
    const simple=es?[r.description_es,r.eligibility_summary_es,'Confirme los detalles directamente con el programa.']:[r.description_en,r.eligibility_summary_en,'Check details with the program before applying.'];
    if (!aiKey) return json(res,200,{bullets:simple});
    try {
      const output=await askAI(`Rewrite this program description and eligibility as exactly three short plain-language bullets in ${es?'Spanish':'English'}. Return ONLY JSON {"bullets":["...","...","..."]}. Do not add facts that are not in the provided text.`,{description:es?r.description_es:r.description_en,eligibility:es?r.eligibility_summary_es:r.eligibility_summary_en});
      return json(res,200,{bullets:Array.isArray(output.bullets)&&output.bullets.length===3?output.bullets:simple});
    } catch {return json(res,200,{bullets:simple});}
  }
  if (pathname==='/api/feedback' && req.method==='POST') {
    const body=await readBody(req);
    if (!getPlan(String(body.plan_id||'')) || !['helpful','not_helpful'].includes(body.rating)) return error(res,400,'Invalid feedback.');
    const rid=body.resource_id && resources().some(r=>r.id===body.resource_id)?body.resource_id:null;
    db.prepare('INSERT INTO feedback (plan_token,resource_id,rating,comment,created_at) VALUES (?,?,?,?,?)').run(body.plan_id,rid,body.rating,String(body.comment||'').slice(0,500),new Date().toISOString());
    return json(res,201,{ok:true});
  }
  if (pathname.startsWith('/api/admin/')) {
    if (!admin(req)) return error(res,401,'Admin access required.');
    if (pathname==='/api/admin/resources' && req.method==='GET') return json(res,200,{resources:resources()});
    if (pathname==='/api/admin/resources' && req.method==='POST') {
      const r=safeResource(await readBody(req));
      if (db.prepare('SELECT 1 FROM resources WHERE id=?').get(r.id)) return error(res,409,'Resource ID already exists.');
      db.prepare('INSERT INTO resources VALUES (?,?)').run(r.id,JSON.stringify(r)); return json(res,201,r);
    }
    const rm=pathname.match(/^\/api\/admin\/resources\/([a-z0-9_-]+)$/);
    if (rm && req.method==='PUT') {
      if (!db.prepare('SELECT 1 FROM resources WHERE id=?').get(rm[1])) return error(res,404,'Resource not found.');
      const r=safeResource({...await readBody(req),id:rm[1]});
      db.prepare('UPDATE resources SET data=? WHERE id=?').run(JSON.stringify(r),r.id); return json(res,200,r);
    }
    if (pathname==='/api/admin/analytics' && req.method==='GET') {
      const perDay=db.prepare('SELECT substr(created_at,1,10) day, count(*) count FROM plans GROUP BY day ORDER BY day DESC LIMIT 30').all();
      const zip=db.prepare('SELECT zip, count(*) count FROM plans GROUP BY zip ORDER BY count DESC LIMIT 10').all();
      const needCounts={}; for(const r of db.prepare('SELECT needs FROM plans').all()) for(const n of JSON.parse(r.needs)) needCounts[n]=(needCounts[n]||0)+1;
      const unhelpful=db.prepare("SELECT resource_id, count(*) count FROM feedback WHERE rating='not_helpful' AND resource_id IS NOT NULL GROUP BY resource_id ORDER BY count DESC LIMIT 10").all();
      return json(res,200,{per_day:perDay,top_zips:zip,top_needs:Object.entries(needCounts).sort((a,b)=>b[1]-a[1]),not_helpful:unhelpful});
    }
    if (pathname==='/api/admin/export' && req.method==='GET') {
      const fields=['id','name','organization','categories','description_en','description_es','eligibility_summary_en','eligibility_summary_es','eligibility_rules','documents_needed','how_to_apply','apply_url','phone','address','hours','coverage_type','coverage_state','coverage_zip_codes','is_active','last_verified_date','source_url','priority_weight'];
      const cell=x=>'"'+String(typeof x==='object'?JSON.stringify(x):x??'').replaceAll('"','""')+'"';
      const csv=[fields.join(','),...resources().map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');
      res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="benefitbridge-resources.csv"'}); return res.end(csv);
    }
    if (pathname==='/api/admin/import' && req.method==='POST') {
      const body=await readBody(req);
      if (!Array.isArray(body.resources) || body.resources.length>500) return error(res,400,'Provide a resources array of at most 500 records.');
      const rows=body.resources.map(safeResource);
      db.exec('BEGIN');
      try {for(const r of rows) db.prepare('INSERT OR REPLACE INTO resources VALUES (?,?)').run(r.id,JSON.stringify(r)); db.exec('COMMIT');}
      catch(e){db.exec('ROLLBACK'); throw e;}
      return json(res,200,{imported:rows.length});
    }
  }
  return error(res,404,'Not found.');
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const server=http.createServer(async (req,res)=>{
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('referrer-policy','strict-origin-when-cross-origin');
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  const pathname=new URL(req.url,'http://localhost').pathname;
  try {
    if (pathname.startsWith('/api/')) return await handleAPI(req,res,pathname);
    if (!['GET','HEAD'].includes(req.method)) return error(res,405,'Method not allowed.');
    const rel=pathname==='/' || pathname.startsWith('/plan/') || ['/about','/privacy','/admin'].includes(pathname)?'/index.html':pathname;
    const file=path.resolve(root,'public','.'+decodeURIComponent(rel));
    if (!file.startsWith(path.resolve(root,'public')+path.sep)) return error(res,403,'Forbidden.');
    const stat=fs.existsSync(file)?fs.statSync(file):null;
    if (!stat?.isFile()) return error(res,404,'Not found.');
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':rel==='/index.html'?'no-cache':'public, max-age=3600'});
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch(e){console.error(e); if(!res.headersSent) error(res,e.message==='Invalid JSON'||e.message==='Request too large'?400:500,e.message==='Invalid JSON'||e.message==='Request too large'?e.message:'Something went wrong.');}
});
const port=Number(process.env.PORT)||3000;
if (process.env.NODE_ENV!=='test') server.listen(port,()=>console.log(`BenefitBridge listening on http://localhost:${port}`));
export {server,db};
