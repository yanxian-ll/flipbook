// Offline reference inspection only. Never load the remote application's runtime.
import fs from 'node:fs';
import vm from 'node:vm';
import * as parser from '@babel/parser';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const input = path.resolve('scripts/reference-templates.txt');
const source = fs.readFileSync(input, 'utf8');
const ast = parser.parseExpression(source);
const allowedCalls = new Set(['_renderText','_img','_fmtNum','_tplNumWithBrackets','_ttAttrs','_ttSize','_ttText','_tplNumNoBrackets','_ttHiddenStyle']);
function audit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && !allowedCalls.has(node.callee.name)) throw Error('Unexpected call');
  if (node.type === 'NewExpression' || node.type === 'ImportExpression') throw Error('Unexpected executable dependency');
  for (const child of Object.values(node)) {if(Array.isArray(child))child.forEach(audit);else audit(child);}
}
audit(ast);
const helpers = `
const _renderText=()=>'',_fmtNum=n=>String(n).padStart(2,'0');
const _img=n=>'<img data-photo="'+n+'" src="/reference/flipin-here-toast.jpg" style="width:100%;height:100%;object-fit:cover;display:block">';
const _tplNumWithBrackets=(p,i,n)=>'['+String(n).padStart(2,'0')+']';
const _tplNumNoBrackets=(p,i,n)=>String(n).padStart(2,'0');
const _ttAttrs=(key)=>'data-text-key="'+key+'"';
const _ttText=(p,key,text)=>String(text??'').replace(/\\n/g,'<br>');
const _ttSize=(p,key,size)=>size,_ttHiddenStyle=()=>'';
const templates=${source};
JSON.stringify(Object.entries(templates).filter(([key,t])=>!t.isCutout).map(([id,t])=>({id,name:t.name,count:t.minImages,bookTpl:t.bookTpl,html:t.render({images:Array.from({length:t.minImages},(_,i)=>String(i)),_imageNum:1})})))`;
const catalog = JSON.parse(vm.runInNewContext(helpers, Object.create(null), {timeout: 1000, contextCodeGeneration: {strings: false, wasm: false}}));
const references = [...new Set(catalog.flatMap(t=>[...t.html.matchAll(/images\/templates\/[a-z0-9_]+\.png\?v=[a-z0-9]+/g)].map(m=>m[0])))];
fs.mkdirSync('public/reference/templates', {recursive: true});
for (const ref of references) {
  const name=ref.split('/').pop().split('?')[0], output='public/reference/templates/'+name;
  if(!fs.existsSync(output)) execFileSync('curl.exe',['--fail','-sS','-L','--max-time','25','https://flipin.pages.dev/'+ref,'-o',output],{stdio:'inherit'});
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:'Mendl Sans Dusk';src:url('/reference/MendlSans_Dusk_Rg.otf')}@font-face{font-family:'Mendl Sans Dusk Medium';src:url('/reference/MendlSans_Dusk_Md.otf');font-weight:500}@font-face{font-family:FZLanTingHei;src:url('/reference/FZLanTingHei-subset.woff2');font-weight:100 900}@font-face{font-family:Domine;src:url('/reference/Domine-Regular.ttf')}*{box-sizing:border-box}body{margin:0;background:#ddd;font-family:Arial}.catalog{display:grid;grid-template-columns:repeat(4,320px);gap:25px}.reference-page{position:relative;width:320px;height:452px;overflow:hidden}.label{font:12px Arial;padding:5px}</style></head><body><div class="catalog">`+catalog.map(t=>`<section><div class="label">${t.id} · ${t.name} · ${t.count} 图</div><div class="reference-page" data-id="${t.id}" data-name="${t.name}" data-count="${t.count}" data-family="${t.bookTpl??''}">${t.html.replaceAll(/images\/templates\/([a-z0-9_]+\.png)\?v=[a-z0-9]+/g,'/reference/templates/$1')}</div></section>`).join('')+'</div></body></html>';
fs.writeFileSync('public/reference-catalog.html', html);
console.log(JSON.stringify({templates:catalog.length,overlayAssets:references.length}));
