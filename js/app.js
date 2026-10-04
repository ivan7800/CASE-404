import {listCases,getCase,putCase,deleteCase,clearCases} from './db.js';
import {$,$$,uid,caseNumber,escapeHtml,formatDate,downloadJson,slug} from './utils.js';
import {EvidenceBoard} from './board.js';
import {InvestigationDB} from './investigation.js';
import {Timeline404} from './timeline.js';
import {TheoryEngine} from './theory.js';
import {ConnectionGraph} from './graph.js';
import {WriterMode} from './writer.js';
import {ReportsEngine} from './reports.js';

const state={cases:[],activeCase:null,view:'cases'};
const els={grid:$('#caseGrid'),empty:$('#emptyState'),count:$('#caseCount'),search:$('#caseSearch'),sort:$('#caseSort'),dialog:$('#caseDialog'),form:$('#caseForm'),importInput:$('#importInput'),toast:$('#toast')};
let investigation;
let timeline;
let theory;
let graph;
let writer;
let reports;

// Bind core Case Files actions before advanced modules initialize.
// A failure in Board/Timeline/Graph/etc. must not disable New Case or Import.
bind();

const board=new EvidenceBoard({
  root:$('#evidenceBoard'),
  onChange:async boardData=>{
    if(!state.activeCase)return;
    const fresh=await getCase(state.activeCase.uuid);if(!fresh)return;
    fresh.modules=normalizeModules(fresh.modules);fresh.modules.board=boardData;fresh.updatedAt=new Date().toISOString();
    await putCase(fresh);state.activeCase=fresh;replaceCached(fresh);investigation?.renderGrid();timeline?.load(fresh.modules);theory?.load(fresh.modules);graph?.load(fresh.modules);writer?.load(fresh.modules);reports?.load(fresh);
  },
  onToast:toast,
  onOpenLinked:(kind,id)=>investigation?.openByLink(kind,id)
});

investigation=new InvestigationDB({
  onChange:async (dbModules,event)=>{
    if(!state.activeCase)return;
    const fresh=await getCase(state.activeCase.uuid);if(!fresh)return;
    fresh.modules=normalizeModules(fresh.modules);
    for(const [k,v] of Object.entries(dbModules))fresh.modules[k]=v;
    if(event?.action==='delete'&&theory?.pruneReference(event.kind,event.record.id)){const theoryData=theory.snapshot();fresh.modules.theories=theoryData.theories;fresh.modules.theoryCounter=theoryData.theoryCounter;}
    if(event?.action==='delete'&&event.kind==='people'&&writer?.prunePerson(event.record.id)){fresh.modules.writer=writer.snapshot();}
    fresh.updatedAt=new Date().toISOString();await putCase(fresh);state.activeCase=fresh;replaceCached(fresh);
    if(event?.action==='update')board.syncLinkedRecord(event.kind,event.record);
    timeline?.load(fresh.modules);theory?.load(fresh.modules);graph?.load(fresh.modules);writer?.load(fresh.modules);reports?.load(fresh);
  },
  onToast:toast,
  onPin:(kind,record)=>board.pinRecord(kind,record),
  onUnpin:(kind,id,silent)=>board.unpinRecord(kind,id,silent),
  isPinned:(kind,id)=>board.isLinked(kind,id)
});

timeline=new Timeline404({
  onEditEvent:id=>id?investigation.openByLink('events',id):investigation.openEditor('events'),
  onToast:toast
});

theory=new TheoryEngine({
  onChange:async theoryModules=>{
    if(!state.activeCase)return;
    const fresh=await getCase(state.activeCase.uuid);if(!fresh)return;
    fresh.modules=normalizeModules(fresh.modules);fresh.modules.theories=theoryModules.theories;fresh.modules.theoryCounter=theoryModules.theoryCounter;fresh.updatedAt=new Date().toISOString();
    await putCase(fresh);state.activeCase=fresh;replaceCached(fresh);graph?.load(fresh.modules);reports?.load(fresh);
  },
  onToast:toast,
  onOpenRecord:(kind,id)=>investigation.openByLink(kind,id)
});

graph=new ConnectionGraph({
  root:$('#graphSvg'),
  onToast:toast,
  onOpenRecord:(kind,id)=>investigation.openByLink(kind,id),
  onOpenTheory:id=>theory.openById(id)
});

writer=new WriterMode({
  onChange:async writerData=>{
    if(!state.activeCase)return;
    const fresh=await getCase(state.activeCase.uuid);if(!fresh)return;
    fresh.modules=normalizeModules(fresh.modules);fresh.modules.writer=writerData;fresh.updatedAt=new Date().toISOString();
    await putCase(fresh);state.activeCase=fresh;replaceCached(fresh);reports?.load(fresh);
  },
  onToast:toast,
  onOpenPerson:id=>investigation.openByLink('people',id)
});

function replaceCached(item){const idx=state.cases.findIndex(c=>c.uuid===item.uuid);if(idx>=0)state.cases[idx]=item;}

reports=new ReportsEngine({onToast:toast});

function toast(message,type='ok'){els.toast.textContent=message;els.toast.className=`toast show ${type==='error'?'error':''}`;clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove('show'),2600);}
function setView(view){state.view=view;$$('.view').forEach(v=>v.classList.toggle('is-visible',v.id===`view-${view}`));$$('.nav-btn').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));$('#viewTitle').textContent=view==='cases'?'Case Files':view==='workspace'?'Investigation Workspace':'Ajustes';}
function normalizeTags(v){return [...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12);}
const objectRows=v=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)):[];
const safeTags=v=>Array.isArray(v)?[...new Set(v.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,12):normalizeTags(v);
const safeLines=v=>Array.isArray(v)?[...new Set(v.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,40):[...new Set(String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean))].slice(0,40);
const validRow=r=>typeof r?.id==='string'&&r.id.trim();
const normalizeRegistryRows=v=>objectRows(v).filter(validRow).map(r=>({...r,id:r.id.trim(),ref:typeof r.ref==='string'?r.ref:'',tags:safeTags(r.tags)}));
const normalizeTheoryLinks=v=>objectRows(v).filter(l=>typeof l.kind==='string'&&typeof l.id==='string'&&l.kind.trim()&&l.id.trim()).map(l=>({kind:l.kind.trim(),id:l.id.trim(),weight:Math.max(1,Math.min(3,Number(l.weight)||1))}));
const normalizeTheories=v=>objectRows(v).filter(validRow).map(t=>({...t,id:t.id.trim(),ref:typeof t.ref==='string'?t.ref:'',title:typeof t.title==='string'?t.title:'Hipótesis sin título',status:['active','alternative','weakened','discarded'].includes(t.status)?t.status:'active',tags:safeTags(t.tags),questions:safeLines(t.questions),contradictions:safeLines(t.contradictions),supports:normalizeTheoryLinks(t.supports),contradicts:normalizeTheoryLinks(t.contradicts)}));
function statusLabel(s){return ({active:'ACTIVE',cold:'COLD CASE',closed:'CLOSED',archived:'ARCHIVED'})[s]||String(s).toUpperCase();}
function normalizeModules(modules={}){modules=modules&&typeof modules==='object'&&!Array.isArray(modules)?modules:{};return {...modules,board:{nodes:objectRows(modules?.board?.nodes),edges:objectRows(modules?.board?.edges),viewport:modules?.board?.viewport&&typeof modules.board.viewport==='object'?modules.board.viewport:{x:0,y:0,zoom:1}},people:normalizeRegistryRows(modules.people),places:normalizeRegistryRows(modules.places),evidence:normalizeRegistryRows(modules.evidence),events:normalizeRegistryRows(modules.events),documents:normalizeRegistryRows(modules.documents),registryCounters:modules.registryCounters&&typeof modules.registryCounters==='object'&&!Array.isArray(modules.registryCounters)?modules.registryCounters:{},theories:normalizeTheories(modules.theories),theoryCounter:Number(modules.theoryCounter)||0,writer:modules.writer&&typeof modules.writer==='object'&&!Array.isArray(modules.writer)?modules.writer:{}};}
function normalizeCase(raw){raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const now=new Date().toISOString();return {...raw,schema:'case404.case.v1',uuid:typeof raw.uuid==='string'&&raw.uuid.trim()?raw.uuid.trim():uid(),title:typeof raw.title==='string'&&raw.title.trim()?raw.title:'Caso sin título',summary:typeof raw.summary==='string'?raw.summary:'',status:typeof raw.status==='string'?raw.status:'active',priority:typeof raw.priority==='string'?raw.priority:'normal',tags:safeTags(raw.tags),createdAt:typeof raw.createdAt==='string'&&raw.createdAt?raw.createdAt:now,updatedAt:typeof raw.updatedAt==='string'&&raw.updatedAt?raw.updatedAt:now,modules:normalizeModules(raw.modules)};}
function render(){const q=els.search.value.trim().toLowerCase();let data=state.cases.filter(c=>[c.title,c.summary,c.uuid,(c.tags||[]).join(' ')].join(' ').toLowerCase().includes(q));const sort=els.sort.value;data.sort((a,b)=>sort==='title-asc'?a.title.localeCompare(b.title):sort==='created-desc'?b.createdAt.localeCompare(a.createdAt):b.updatedAt.localeCompare(a.updatedAt));els.count.textContent=state.cases.length;els.empty.classList.toggle('is-visible',data.length===0);els.grid.innerHTML=data.map(c=>`<article class="case-card" data-uuid="${escapeHtml(c.uuid)}"><div class="case-card-top"><span class="case-id">${caseNumber(c.uuid)}</span><span class="badge">${escapeHtml(statusLabel(c.status))}</span></div><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.summary||'Sin resumen.')}</p><div class="tags">${(c.tags||[]).slice(0,5).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div><div class="card-foot"><span>${formatDate(c.updatedAt)}</span><button class="card-open" data-action="open" data-uuid="${escapeHtml(c.uuid)}">ABRIR →</button></div></article>`).join('');}
async function refresh(){state.cases=(await listCases()).map(normalizeCase);render();}
function openDialog(item=null){$('#dialogMode').textContent=item?'EDIT CASE':'NEW CASE';$('#caseUuid').value=item?.uuid||'';$('#caseTitle').value=item?.title||'';$('#caseSummary').value=item?.summary||'';$('#caseStatus').value=item?.status||'active';$('#casePriority').value=item?.priority||'normal';$('#caseTags').value=(item?.tags||[]).join(', ');els.dialog.showModal();setTimeout(()=>$('#caseTitle').focus(),20);}
async function saveFromDialog(e){e.preventDefault();const title=$('#caseTitle').value.trim();if(!title){$('#caseTitle').focus();return;}const now=new Date().toISOString(),uuid=$('#caseUuid').value||uid(),existing=state.cases.find(c=>c.uuid===uuid);const item=normalizeCase({uuid,title,summary:$('#caseSummary').value.trim(),status:$('#caseStatus').value,priority:$('#casePriority').value,tags:normalizeTags($('#caseTags').value),createdAt:existing?.createdAt||now,updatedAt:now,modules:existing?.modules});await putCase(item);els.dialog.close();await refresh();if(state.activeCase?.uuid===item.uuid){state.activeCase=item;populateWorkspace(item);board.load(item.modules.board);investigation.load(item.modules);timeline.load(item.modules);theory.load(item.modules);graph.load(item.modules);writer.load(item.modules);reports?.load(item);}toast(existing?'Caso actualizado':'Caso creado');}
function populateWorkspace(item){$('#activeCaseId').textContent=caseNumber(item.uuid);$('#activeCaseTitle').textContent=item.title;$('#activeCaseSummary').textContent=item.summary||'Sin resumen.';}
async function openCase(uuid){const raw=await getCase(uuid);if(!raw)return toast('No se encontró el caso','error');const item=normalizeCase(raw);state.activeCase=item;$('.nav-btn[data-view="workspace"]').disabled=false;populateWorkspace(item);board.load(item.modules.board);investigation.load(item.modules);timeline.load(item.modules);theory.load(item.modules);graph.load(item.modules);writer.load(item.modules);reports?.load(item);setView('workspace');}
async function editActive(){if(state.activeCase)openDialog(normalizeCase(await getCase(state.activeCase.uuid)));}
async function removeActive(){if(!state.activeCase)return;const label=state.activeCase.title;if(!confirm(`Eliminar “${label}” de este navegador? Esta acción no se puede deshacer salvo que tengas una exportación.`))return;await deleteCase(state.activeCase.uuid);state.activeCase=null;$('.nav-btn[data-view="workspace"]').disabled=true;setView('cases');await refresh();toast('Caso eliminado');}
function packageCase(item){return {format:'CASE404',version:10,exportedAt:new Date().toISOString(),case:item};}
async function exportActive(){if(!state.activeCase)return;const fresh=normalizeCase(await getCase(state.activeCase.uuid));downloadJson(packageCase(fresh),`${slug(fresh.title)}.case404`);toast('Caso exportado');}
async function importFile(file){try{if(file.size>64*1024*1024)throw new Error('El archivo supera 64 MB');const data=JSON.parse(await file.text());if((data?.format==='CASE404'||data?.format==='CASE404-BACKUP')&&Number(data.version)>10)throw new Error(`El paquete CASE404 v${data.version} requiere una versión más reciente de la aplicación`);let items=[];if(data?.format==='CASE404'&&data.case)items=[data.case];else if(data?.format==='CASE404-BACKUP'&&Array.isArray(data.cases))items=data.cases;else if(data?.schema==='case404.case.v1')items=[data];else throw new Error('Formato no reconocido');if(items.length>250)throw new Error('El paquete contiene demasiados casos (máximo 250)');if(items.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw new Error('El paquete contiene registros de caso no válidos');let collisions=0;for(const raw of items){let item=normalizeCase(raw);if(!item.uuid||!item.title)throw new Error('Caso incompleto');if(await getCase(item.uuid)){collisions++;item={...item,uuid:uid(),title:`${item.title} (importado)`,updatedAt:new Date().toISOString()};}await putCase(item);}await refresh();toast(`${items.length} caso(s) importado(s)${collisions?` · ${collisions} conflicto(s) guardado(s) como copia`:''}`);}catch(err){console.warn('CASE404 import:',err);toast(`Importación fallida: ${err.message}`,'error');}finally{els.importInput.value='';}}
async function exportAll(){const cases=(await listCases()).map(normalizeCase);downloadJson({format:'CASE404-BACKUP',version:10,exportedAt:new Date().toISOString(),cases},`case404-backup-${new Date().toISOString().slice(0,10)}.json`);toast('Backup exportado');}
async function resetDb(){if(!confirm('¿Borrar TODOS los casos locales? Exporta un backup antes si quieres conservarlos.'))return;await clearCases();state.activeCase=null;$('.nav-btn[data-view="workspace"]').disabled=true;setView('cases');await refresh();toast('Base local vaciada');}
function bind(){$('#newCaseBtn').addEventListener('click',()=>openDialog());document.addEventListener('click',e=>{const close=e.target.closest('[data-dialog-close]');if(close){close.closest('dialog')?.close();return;}if(e.target.closest('[data-action="new-case"]'))openDialog();const b=e.target.closest('[data-action="open"]');if(b)openCase(b.dataset.uuid);});els.form.addEventListener('submit',saveFromDialog);els.search.addEventListener('input',render);els.sort.addEventListener('change',render);$('#importBtn').addEventListener('click',()=>els.importInput.click());els.importInput.addEventListener('change',()=>els.importInput.files[0]&&importFile(els.importInput.files[0]));$('#exportCaseBtn').addEventListener('click',exportActive);$('#editCaseBtn').addEventListener('click',editActive);$('#deleteCaseBtn').addEventListener('click',removeActive);$('#exportAllBtn').addEventListener('click',exportAll);$('#resetDbBtn').addEventListener('click',resetDb);$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>{if(!b.disabled)setView(b.dataset.view);}));}
async function boot(){await refresh();if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));}}
boot().catch(err=>{console.error(err);toast('No se pudo iniciar CASE 404','error');});
