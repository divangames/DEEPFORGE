/* Статические снимки НАСТОЯЩЕГО JSX. Это не React E2E: effects, Canvas и сеть не выполняются. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const ts = require(process.env.DF_TYPESCRIPT || require.resolve('typescript', { paths: [path.join(root, 'client'), root] }));
const out = process.env.DF_UI_FIXTURES || path.join(root, '.ui-fixtures'); fs.mkdirSync(out, {recursive:true});
let overrides = {}, stack = [], store = {};
const react = {
  useState(initial) { const frame = stack.at(-1); const index = frame.index++; const values = overrides[frame.name] || {}; return [Object.hasOwn(values,index)?values[index]:typeof initial==='function'?initial():initial,()=>{}]; },
  useRef: value=>({current:value}), useEffect: ()=>{}, useCallback: fn=>fn, useMemo: fn=>fn(), memo: fn=>fn,
};
const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment: Symbol.for('fragment')};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (file.endsWith('.css')) return {};
  if (!fs.existsSync(file)) file = file.replace(/\.js$/,'.ts');
  if (!/\.(ts|tsx|js)$/.test(file)) file += fs.existsSync(file+'.ts')?'.ts':'.tsx';
  if(file.endsWith('/ui/GameCanvas.tsx')) return {GameCanvas:()=>jsx.jsx('div',{className:'game-canvas',children:jsx.jsx('div',{className:'fixture-canvas',children:'Область игровой сцены'})})};
  if(file.includes('/services/')) return new Proxy({}, {get:(_t,k)=>k==='loadRiftIdentity'?()=>null:k==='hasRiftBackend'?()=>false:()=>{}});
  if(file.endsWith('/state/gameStore.ts')) return {useGameStore:fn=>fn(store)};
  if(file.endsWith('/game/runtime/gameRuntime.ts')) return {sendGameCommand:()=>{}};
  if(cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file,'utf8');
  if(file.endsWith('/ui/App.tsx')) source += '\nexport {WorldMap,ResearchPanel,SpecialistRoster,AcademyPanel,ProgressionPanel,ContractPanel,SeasonPanel,SocialPanel};\n';
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},fileName:file}).outputText;
  const mod = {exports:{}};cache.set(file,mod);
  const req = id=>id==='react'?react:id==='react/jsx-runtime'?jsx:id.startsWith('.')?load(path.resolve(path.dirname(file),id)):require(id);
  new Function('require','module','exports','__filename','__dirname',result)(req,mod,mod.exports,file,path.dirname(file));return mod.exports;
}
function esc(s) {return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
const unitless=new Set(['opacity','zIndex','fontWeight','lineHeight','flex','flexGrow','flexShrink','order','scale']);
function html(node) {
  if(node==null||typeof node==='boolean')return '';
  if(Array.isArray(node))return node.map(html).join('');
  if(typeof node!=='object')return esc(node);
  if(typeof node.type==='function'){stack.push({name:node.type.name,index:0});let n=node.type(node.props);const rendered=html(n);stack.pop();return rendered;}
  if(typeof node.type==='symbol')return html(node.props.children);
  const {children,...props}=node.props||{};
  let attrs='';for(let [k,v] of Object.entries(props)) {
    if(v==null||k==='ref'||k==='key'||k.startsWith('on'))continue;
    if(k==='className')k='class'; if(k==='htmlFor')k='for'; if(k==='tabIndex')k='tabindex';
    if(k==='style'){v=Object.entries(v).map(([x,y])=>`${x.startsWith('--')?x:x.replace(/[A-Z]/g,l=>'-'+l.toLowerCase())}:${y}${typeof y==='number'&&y!==0&&!unitless.has(x)&&!x.startsWith('--')?'px':''}`).join(';');}
    if(v===false&&!k.startsWith('aria-'))continue;
    attrs+=v===true&&!k.startsWith('aria-')?' '+k:` ${k}="${esc(v)}"`;
  }
  if(['input','img','hr','br','meta','link'].includes(node.type))return `<${node.type}${attrs}>`;
  return `<${node.type}${attrs}>${html(children)}</${node.type}>`;
}
const core = name=>load(root+'/client/src/game/core/'+name+'.ts');
const {MineSimulation}=core('MineSimulation'), sim=new MineSimulation(); sim.setCash(12500);
const manager=sim.getManagerView('shaft-1');
const world=core('worldConfig'), research=core('research'), eq=core('equipment'),co=core('collection'),re=core('relics'),ac=core('academy'),sp=core('specialists'),wc=core('weeklyContract'),sc=core('seasonalCampaign'),so=core('social');
const now=Date.UTC(2026,8,30,12);
const academyState=ac.sanitizeAcademyState({...ac.DEFAULT_ACADEMY_STATE,resources:{recruitData:250,trainingModules:250,promotionBadges:40}});
const academy=ac.buildAcademyView(academyState,now,4);
const specialists=sp.buildSpecialistSystemView(sp.sanitizeSpecialistSystem(sp.DEFAULT_SPECIALIST_SYSTEM),'rust-01',4,academy.resources);
const mines=world.WORLD_MINES.map((d,i)=>({...d,unlocked:i===0,active:i===0,canUnlock:i===1,accent:d.theme.accent,accentSoft:d.theme.accentSoft,cash:12500,currencyCode:world.getSectorDefinition(d.sectorId).currencyCode,totalCashEarned:25000,previousMineEarned:25000,unlockedDecks:i===0?3:0,incomePerSecond:i===0?10:0,rebuildMultiplier:1,rebuildLevel:0,previousMineName:'Scrapline Quarry'}));
const sectors=world.WORLD_SECTORS.map((d,i)=>({...d,unlocked:i===0,active:i===0,canUnlock:false,unlockedMines:i===0?1:0,totalMines:5,wallet:i===0?12500:0,totalCashEarned:i===0?25000:0,incomePerSecond:i===0?10:0,previousSectorEarned:0}));
store={quality:'MEDIUM',apiOnline:false,simulation:sim.getSnapshot(),selectedFacility:'shaft-1',activeMineId:'rust-01',activeSectorId:'rust',worldMines:mines,worldSectors:sectors,
 selectedStats:sim.getFacilityStats('shaft-1'),selectedManager:manager,managerRoster:sim.getManagerRoster(),selectedBulkQuotes:sim.getBulkUpgradeQuotes('shaft-1'),bottleneck:sim.getBottleneckView(),barrier:sim.getCurrentBarrierView(),rebuild:sim.getRebuildView(),research:{cores:3,spentCores:0,purchasedCount:0,totalNodes:18,respecFee:0,respecRefund:0,nodes:research.RESEARCH_NODES.map(n=>({...n,purchased:false,available:n.tier===1,lockedBy:n.requires}))},
 specialists,academy,equipment:eq.buildEquipmentView(eq.DEFAULT_EQUIPMENT_STATE),collection:co.buildCollectionView(co.DEFAULT_COLLECTION_STATE),relics:re.buildRelicView(re.DEFAULT_RELIC_STATE),weeklyContract:wc.buildWeeklyContractView(wc.createWeeklyContractState(now),now,'local'),seasonalCampaign:sc.buildSeasonalCampaignView({...sc.createSeasonalCampaignState(now),xp:1910},now,'local'),social:so.buildSocialView(so.createSocialState(now,'DF-TEST-0001'),now,'local'),setApiOnline:()=>{},setOfflineReport:()=>{}};
const {App}=load(root+'/client/src/ui/App.tsx');
const manifest=[];
const scenes=[['mine',null,false,'managers'],['dock',null,true,'managers'],['info','system'],['events','events'],['map','map'],['rebuild','rebuild'],['research','research'],['weekly','weekly'],['season','season'],['blitz-offline','blitz'],['rift-offline','rift'],['managers','team',false,'managers'],['specialists','team',false,'specialists'],['academy','team',false,'academy'],['equipment','team',false,'progression'],['collection','team',false,'progression'],['relics','team',false,'progression'],['crew','team',false,'crew']];
const staticStyles = '<style>.fixture-canvas { height:100%; display:grid;place-items:center; background:repeating-linear-gradient(0deg,#141a21 0px,#141a21 108px,#28323e 110px,#28323e 112px);color:#8090a0;font:12px system-ui; } .fixture-badge{position:fixed;bottom:0;right:0;font:9px system-ui;color:#aab;background:#0009;padding:2px;pointer-events:none;z-index:99999} </style>';
for(const [name,panel,expanded=false,team='managers'] of scenes){
 overrides={App:{0:panel,1:expanded,3:team},ProgressionPanel:{0:name==='collection'?'collection':name==='relics'?'relics':'equipment'}};
 const markup=html(jsx.jsx(App,{}));
 const page=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/rift.css">${staticStyles}</head><body><div id="root">${markup}</div><script>for(const d of document.querySelectorAll('dialog')){d.showModal();d.querySelector('[data-dialog-initial]')?.focus({preventScroll:true});}</script></body></html>`;
 fs.writeFileSync(path.join(out,name+'.html'),page);manifest.push(name);
}
fs.copyFileSync(root+'/client/src/ui/styles.css',out+'/styles.css');fs.copyFileSync(root+'/client/src/ui/rift.css',out+'/rift.css');
fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest));
console.log('Rendered actual JSX snapshots (not a running React app):',manifest.join(', '));
// Дополнительные состояния: серверный Rift строит свои view штатным ядром, без HTTP.
(async()=>{
 const {MemoryRiftRepository}=load(root+'/server/src/rift/repository.ts');
 const {RiftService}=load(root+'/server/src/rift/service.ts');
 const {eventAt}=load(root+'/server/src/rift/engine.ts');
 const service = new RiftService(new MemoryRiftRepository(),()=>now);
 const guest=await service.register('Контрольный игрок');
 await service.start(guest.playerId,eventAt(now).id);
 const status=await service.status(guest.playerId);
 const extras=[['rift-run','run'],['rift-tree','tree'],['rift-rewards','rewards'],['rift-board','board']];
 function save(name) {
  const markup=html(jsx.jsx(App,{}));
  fs.writeFileSync(out+'/'+name+'.html',`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/rift.css">${staticStyles}</head><body><div id="root">${markup}</div><script>document.querySelectorAll('dialog').forEach(d=>{d.showModal();d.querySelector('[data-dialog-initial]')?.focus({preventScroll:true})})</script></body></html>`);manifest.push(name);
 }
 for(const [name,tab] of extras) { overrides={App:{0:'rift',1:false,3:'managers'},RiftPanel:{0:status,1:tab,8:now}};save(name); }
 overrides={App:{0:'map'},WorldMap:{0:'sector'}};save('map-sector');
 overrides={App:{0:null}};
 store.offlineReport={rawSeconds:28800,creditedSeconds:28800,rewardCash:543210,processedOre:12000,fullChainAutomated:true,capped:true,operatingMines:5,unlockedMines:5,unlockedSectors:2,sectorRewards:{rust:342500,glacier:9850}};
 save('offline'); store.offlineReport=null;
 fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest));console.log('Extended snapshots:',manifest.length);
})().catch(e=>{console.error(e);process.exitCode=1});
