const THEMES={
  noir:'NOIR 404',cold:'COLD CASE',police:'POLICE ARCHIVE',cyber:'CYBER INVESTIGATION',archive:'CLASSIFIED',minimal:'MINIMAL DARK'
};
const DEFAULTS={theme:'noir',density:'comfortable',motion:'system',board:'dark'};
const KEY='case404.appearance.v1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function read(){try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...DEFAULTS}}}
function write(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}
function systemReduced(){return matchMedia?.('(prefers-reduced-motion: reduce)').matches}
function apply(prefs,save=true){
  const p={...DEFAULTS,...prefs};
  if(!THEMES[p.theme])p.theme='noir';
  document.documentElement.dataset.theme=p.theme;
  document.documentElement.dataset.density=p.density==='compact'?'compact':'comfortable';
  document.documentElement.dataset.motion=p.motion==='reduced'||(p.motion==='system'&&systemReduced())?'reduced':'full';
  document.documentElement.dataset.board=p.board||'dark';
  const meta=$('meta[name="theme-color"]'); if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--browser-theme').trim()||'#0b0b0c';
  const label=$('#activeThemeLabel'); if(label)label.textContent=THEMES[p.theme];
  $$('.theme-card').forEach(b=>{const active=b.dataset.themeChoice===p.theme;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',String(active))});
  const density=$('#uiDensity'); if(density)density.value=p.density;
  const motion=$('#uiMotion'); if(motion)motion.value=p.motion;
  const board=$('#boardSurface'); if(board)board.value=p.board;
  if(save)write(p);
  return p;
}
let prefs=apply(read(),false);

function bind(){
  $('#themeGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(!b)return;prefs=apply({...prefs,theme:b.dataset.themeChoice});});
  $('#uiDensity')?.addEventListener('change',e=>prefs=apply({...prefs,density:e.target.value}));
  $('#uiMotion')?.addEventListener('change',e=>prefs=apply({...prefs,motion:e.target.value}));
  $('#boardSurface')?.addEventListener('change',e=>prefs=apply({...prefs,board:e.target.value}));
  $('#resetAppearance')?.addEventListener('click',()=>{prefs=apply({...DEFAULTS});});
  matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{if(prefs.motion==='system')apply(prefs,false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply(prefs,false);bind()},{once:true});else{apply(prefs,false);bind()}
