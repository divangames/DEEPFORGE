import json, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
project=Path(__file__).resolve().parents[2]
root=Path(os.environ.get('DF_UI_FIXTURES', str(project/'.ui-fixtures')))
root.mkdir(parents=True,exist_ok=True)
def compile_source(relative):
 code="const fs=require('fs');const ts=require(process.env.DF_TYPESCRIPT||require.resolve('typescript',{paths:['./client','.']}));process.stdout.write(ts.transpileModule(fs.readFileSync(process.argv[1],'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)"
 return subprocess.check_output(['node','-e',code,str(project/relative)],cwd=project,text=True,encoding='utf-8')
controller=compile_source('client/src/ui/platform/dialogController.ts')
viewport=compile_source('client/src/ui/platform/viewport.ts')
results=[]
with sync_playwright() as p:
 options={'headless':True}
 if os.environ.get('DF_CHROMIUM'): options['executable_path']=os.environ['DF_CHROMIUM']
 b=p.chromium.launch(**options)
 page=b.new_page(viewport={'width':430,'height':932})
 page.set_content('''<!doctype html><html><body><button id="trigger">Открыть</button><button id="behind">Снаружи</button><dialog id="d"><button data-dialog-initial id="close">Закрыть</button><div role="tablist" id="tabs"><button role="tab" id="t1" tabindex="0">Один</button><button role="tab" id="t2" tabindex="-1">Два</button><button role="tab" id="t3" tabindex="-1">Три</button></div><input id="input"></dialog></body></html>''')
 page.add_script_tag(content='window.ui=(()=>{let exports={};'+controller+';return exports})()')
 page.add_script_tag(content='window.viewportModule=(()=>{let exports={};'+viewport+';return exports})()')
 page.evaluate('''()=>{
  window.disposeViewport=viewportModule.installViewportSync();
  document.querySelector('#trigger').onclick=()=>window.unmount=ui.mountDialog(document.querySelector('#d'));
  document.querySelector('#close').onclick=()=>unmount();
  document.querySelector('#d').oncancel=e=>{e.preventDefault();unmount()};
  document.querySelector('#tabs').onkeydown=e=>ui.handleTabKey(e,document.querySelector('#tabs'));
  document.querySelectorAll('[role=tab]').forEach(b=>b.onclick=()=>document.querySelectorAll('[role=tab]').forEach(x=>{x.tabIndex=x===b?0:-1;x.setAttribute('aria-selected',String(x===b));}));
 }''')
 def check(name,expr):
  val=page.evaluate(expr);results.append({'test':name,'passed':bool(val)});assert val,name
 page.click('#trigger');check('native dialog open + initial close focus',"document.querySelector('#d').open && document.activeElement.id==='close'")
 page.keyboard.press('Shift+Tab');check('focus stays in native modal',"document.activeElement.closest('#d')!==null")
 page.focus('#t1');page.keyboard.press('ArrowRight');check('right arrow selects and focuses next tab',"document.activeElement.id==='t2' && document.querySelector('#t2').getAttribute('aria-selected')==='true'")
 page.keyboard.press('End');check('End selects last',"document.activeElement.id==='t3'")
 page.keyboard.press('ArrowRight');check('arrow wraps to first',"document.activeElement.id==='t1'")
 page.keyboard.press('Escape');page.wait_for_timeout(10);check('Escape closes and restores trigger',"!document.querySelector('#d').open && document.activeElement.id==='trigger'")
 check('viewport sync initial',"document.documentElement.style.getPropertyValue('--visible-height')==='932px'")
 page.set_viewport_size({'width':430,'height':500});page.wait_for_timeout(80);check('viewport resize follows visible height',"document.documentElement.style.getPropertyValue('--visible-height')==='500px'")
 page.evaluate('''()=>{Object.defineProperty(window.visualViewport,'scale',{get:()=>2,configurable:true});Object.defineProperty(window.visualViewport,'height',{get:()=>250,configurable:true});window.visualViewport.dispatchEvent(new Event('resize'))}''')
 page.wait_for_timeout(50);check('zoom guard does not shrink app to zoomed viewport',"document.documentElement.style.getPropertyValue('--visible-height')==='500px'")
 page.evaluate('disposeViewport()');check('viewport cleanup removes custom height',"document.documentElement.style.getPropertyValue('--visible-height')===''")
 # Переход одного окна в другое не отдаёт фокус фоновой шахте.
 page.click('#trigger');page.evaluate('''()=>{let n=document.createElement('dialog');n.id='next';n.innerHTML='<button data-dialog-initial id="next-close">Закрыть следующее</button>';document.body.append(n);unmount();window.unmountNext=ui.mountDialog(n);}''')
 page.wait_for_timeout(10);check('dialog transition keeps focus in next',"document.activeElement.id==='next-close'")
 page.evaluate('unmountNext()');page.wait_for_timeout(10);check('dialog transition eventually restores navigation',"document.activeElement.id==='trigger'")
 b.close()
(root/'platform-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(json.dumps(results,ensure_ascii=False,indent=2))
