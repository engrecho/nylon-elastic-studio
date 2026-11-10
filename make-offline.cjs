const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'dist');
let lib=fs.readFileSync(path.join(dir,'vendor/three.module.js'),'utf8');
const match=lib.match(/export\s*\{([^}]+)\};?\s*$/);
if(!match)throw Error('Three export list missing');
const entries=match[1].split(',').map(s=>{const a=s.trim().split(/\s+as\s+/);return a.length===2?a[1]+':'+a[0]:a[0]}).join(',');
lib=lib.slice(0,match.index);
const handData='data:image/webp;base64,'+fs.readFileSync(path.join(dir,'hand.webp')).toString('base64');
const hand=fs.readFileSync(path.join(dir,'hand.js'),'utf8').replace('export function','function').replace("'hand.webp'",JSON.stringify(handData));
const modules=['model-loader.js','cloth-physics.js'].map(n=>fs.readFileSync(path.join(dir,n),'utf8').replace(/^\uFEFF?import[^\n]+\n/gm,'').replace(/^export /gm,'')).join('\n');
let app=hand+'\n'+modules+'\n'+fs.readFileSync(path.join(dir,'app.js'),'utf8').replace(/^\uFEFF?import[^\n]+\n/gm,'');
let css=fs.readFileSync(path.join(dir,'style.css'),'utf8').replace(/@import[^;]+;/,'');
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
const assets={};for(const name of ['preview.bin.gz','cloth.bin.gz','texture_pbr_20250901.png','texture_pbr_20250901_roughness.png']){const type=name.endsWith('.png')?'image/png':'application/octet-stream';assets['model/'+name]='data:'+type+';base64,'+fs.readFileSync(path.join(dir,'model',name)).toString('base64')}
const script='globalThis.NYLON_ASSETS='+JSON.stringify(assets)+';\nconst THREE=(()=>{'+lib+';return {'+entries+'}})();\n'+app;
html=html.replace('<script type="module" src="app.js"></script>',()=>'<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
const out=path.join(__dirname,'outputs');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'NYLON-offline.html'),html);
fs.writeFileSync(path.join(out,'offline-check.js'),script);
console.log('Created standalone offline HTML');

