import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
project=Path(__file__).resolve().parents[2]
root=Path(os.environ.get('DF_UI_FIXTURES', str(project/'.ui-fixtures')));screens=json.loads((root/'manifest.json').read_text())
# Размеры сценариев, а не заявление о физическом тестировании моделей устройств.
views=[(320,568),(360,640),(375,667),(375,812),(390,844),(393,852),(402,874),(414,896),(428,926),(430,932),(430,774),(440,956),(768,1024),(1024,768),(1366,768),(1920,1080)]
css=(root/'styles.css').read_text();rift=(root/'rift.css').read_text()
with sync_playwright() as p:
 options={'headless':True}
 if os.environ.get('DF_CHROMIUM'): options['executable_path']=os.environ['DF_CHROMIUM']
 b=p.chromium.launch(**options)
 page=b.new_page(device_scale_factor=1)
 results=[]
 for w,h in views:
  page.set_viewport_size({'width':w,'height':h})
  for name in screens:
   text=(root/(name+'.html')).read_text().replace('<link rel="stylesheet" href="/styles.css">','<style>'+css+'</style>').replace('<link rel="stylesheet" href="/rift.css">','<style>'+rift+'</style>')
   page.set_content(text,wait_until='load')
   # Worst-case inset fixture on portrait phones; actual Safari supplies env() itself.
   if w<600: page.add_style_tag(content=':root{--safe-top:59px;--safe-bottom:34px;}')
   r=page.evaluate('''() => {
     const dialogs=document.querySelectorAll('dialog[open]');
     const scope=dialogs[0]||document.querySelector('.app-shell');
     const overflow=[...scope.querySelectorAll('.panel-scroll,.world-map-layout,.dock-scroll,.world-map-info')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>[e.className,e.clientWidth,e.scrollWidth]);
     if(scope.scrollWidth>scope.clientWidth+2)overflow.push(['scope',scope.clientWidth,scope.scrollWidth]);
     const small=[...scope.querySelectorAll('button,select,input')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().width<43.8||e.getBoundingClientRect().height<43.8)).map(e=>[e.textContent.slice(0,40),e.className,e.getBoundingClientRect().width,e.getBoundingClientRect().height]);
     const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
     const game=document.querySelector('.game-stage').getBoundingClientRect();
     let unreachable=[];
     if(dialogs[0]){
       const buttons=[...scope.querySelectorAll('button')].filter(e=>e.getClientRects().length);
       const last=buttons.at(-1);
       if(last){last.scrollIntoView({block:'end',inline:'nearest'});const r=last.getBoundingClientRect();if(r.bottom>innerHeight+1||r.top<0)unreachable.push(['last-button',r.top,r.bottom]);}
     }
     const points=[...scope.querySelectorAll('.world-node')];
     const hitOverlaps=points.flatMap((el,i)=>points.slice(i+1).map(other=>{
       const a=el.getBoundingClientRect(),b=other.getBoundingClientRect();
       return [el.getAttribute('aria-label'),other.getAttribute('aria-label'),Math.min(a.right,b.right)-Math.max(a.left,b.left),Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)];
     }).filter(x=>x[2]>0.1&&x[3]>0.1));
     return {overflow,small,unreachable,hitOverlaps,dialogs:dialogs.length,navBottom:nav.bottom,gameHeight:game.height};
   }''')
   r.update(name=name,viewport=f'{w}x{h}');results.append(r)
  print(w,h,'done',flush=True)
 (root/'matrix.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
 fails=[r for r in results if r['overflow'] or r['small'] or r['unreachable'] or r['hitOverlaps'] or (r['dialogs']==0 and r['navBottom']>int(r['viewport'].split('x')[1])+1)]
 print('CASES',len(results),'FAIL',len(fails));print(json.dumps(fails,ensure_ascii=False,indent=2))
 b.close()

if fails: raise SystemExit(1)
