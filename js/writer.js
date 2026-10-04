import {$,uid,escapeHtml} from './utils.js';

const META={
  chapters:{label:'CAPÍTULOS',singular:'Capítulo',prefix:'CH',symbol:'▤'},
  scenes:{label:'ESCENAS',singular:'Escena',prefix:'SC',symbol:'◫'},
  clues:{label:'PISTAS',singular:'Pista',prefix:'CL',symbol:'◇'},
  secrets:{label:'SECRETOS',singular:'Secreto',prefix:'S',symbol:'◆'}
};
const TABS=['chapters','scenes','clues','secrets','continuity'];
const arr=v=>Array.isArray(v)?v:[];
const records=v=>arr(v).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
const tags=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,16);
const lines=v=>String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,40);
const chapterOrder=(writer,id)=>{const ch=writer.chapters.find(x=>x.id===id);return ch?Number(ch.order)||0:null;};
const chapterRef=(writer,id)=>writer.chapters.find(x=>x.id===id)?.ref||'—';
const titleOf=(writer,id)=>writer.chapters.find(x=>x.id===id)?.title||'Capítulo ausente';
const personTitle=(modules,id)=>modules.people?.find(x=>x.id===id)?.name||'Persona ausente';
const normalizeCounter=(items,prefix,current)=>Math.max(Number(current)||0,...items.map(r=>Number(String(r.ref||'').match(/(\d+)$/)?.[1])||0));

export function normalizeWriter(raw={}){
  const chapters=records(raw.chapters).map((x,i)=>({...x,order:Number(x.order)||i+1,tags:arr(x.tags)}));
  const scenes=records(raw.scenes).map(x=>({...x,order:Number(x.order)||1,participants:arr(x.participants),secretUses:arr(x.secretUses),tags:arr(x.tags)}));
  const clues=records(raw.clues).map(x=>({...x,foreshadowChapterIds:arr(x.foreshadowChapterIds),callbackChapterIds:arr(x.callbackChapterIds),tags:arr(x.tags)}));
  const secrets=records(raw.secrets).map(x=>({...x,discoveries:arr(x.discoveries),tags:arr(x.tags)}));
  return {
    chapters,scenes,clues,secrets,
    chapterCounter:normalizeCounter(chapters,'CH',raw.chapterCounter),
    sceneCounter:normalizeCounter(scenes,'SC',raw.sceneCounter),
    clueCounter:normalizeCounter(clues,'CL',raw.clueCounter),
    secretCounter:normalizeCounter(secrets,'S',raw.secretCounter)
  };
}

export function analyzeContinuity(writerInput={},modules={}){
  const w=normalizeWriter(writerInput),issues=[];
  const chById=new Map(w.chapters.map(c=>[c.id,c]));
  const personIds=new Set(arr(modules.people).map(p=>p.id));
  const secretById=new Map(w.secrets.map(s=>[s.id,s]));
  const add=(severity,code,title,detail,kind,id)=>issues.push({severity,code,title,detail,kind,id});
  const order=id=>chById.get(id)?Number(chById.get(id).order)||0:null;
  const chapterName=id=>{const c=chById.get(id);return c?`${c.ref} · ${c.title}`:'capítulo ausente';};

  const orderMap=new Map();
  for(const c of w.chapters){
    const n=Number(c.order)||0;
    if(orderMap.has(n))add('warning','duplicate_chapter_order','Orden de capítulo duplicado',`${c.ref} comparte el orden ${n} con ${orderMap.get(n).ref}.`,'chapters',c.id);else orderMap.set(n,c);
  }

  for(const s of w.scenes){
    if(!chById.has(s.chapterId))add('error','scene_missing_chapter','Escena sin capítulo válido',`${s.ref} · ${s.title} apunta a un capítulo inexistente.`,'scenes',s.id);
    for(const pid of s.participants||[])if(pid&&!personIds.has(pid))add('warning','scene_missing_person','Personaje ausente',`${s.ref} conserva un participante que ya no existe en Investigation DB.`,'scenes',s.id);
    for(const use of s.secretUses||[]){
      const secret=secretById.get(use.secretId);if(!secret){add('error','scene_missing_secret','Secreto ausente',`${s.ref} usa un secreto que ya no existe.`,'scenes',s.id);continue;}
      if(!personIds.has(use.personId)){add('error','knowledge_missing_person','Uso de conocimiento sin personaje',`${s.ref} registra un uso de ${secret.ref} por una persona inexistente.`,'scenes',s.id);continue;}
      const sceneOrder=order(s.chapterId);const discovery=(secret.discoveries||[]).find(d=>d.personId===use.personId);
      if(!discovery){add('error','knowledge_never_learned','Conocimiento sin aprendizaje',`${personTitle(modules,use.personId)} usa ${secret.ref} en ${chapterName(s.chapterId)}, pero no consta cuándo lo descubre.`,'scenes',s.id);continue;}
      const learnedOrder=order(discovery.chapterId);
      if(learnedOrder==null)add('error','knowledge_discovery_missing_chapter','Aprendizaje en capítulo ausente',`${personTitle(modules,use.personId)} tiene el descubrimiento de ${secret.ref} ligado a un capítulo inexistente.`,'secrets',secret.id);
      else if(sceneOrder!=null&&sceneOrder<learnedOrder)add('error','knowledge_too_early','Personaje sabe algo demasiado pronto',`${personTitle(modules,use.personId)} usa ${secret.ref} en ${chapterName(s.chapterId)} antes de descubrirlo en ${chapterName(discovery.chapterId)}.`,'scenes',s.id);
    }
  }

  for(const c of w.clues){
    const intro=order(c.introducedChapterId),reveal=order(c.revealedChapterId),resolved=order(c.resolvedChapterId);
    if(!c.introducedChapterId||intro==null)add('warning','clue_no_intro','Pista sin introducción',`${c.ref} · ${c.title} no tiene capítulo de introducción válido.`,'clues',c.id);
    if(reveal!=null&&intro!=null&&reveal<intro)add('error','clue_reveal_before_intro','Revelación antes de introducir la pista',`${c.ref} se revela en ${chapterName(c.revealedChapterId)} antes de aparecer en ${chapterName(c.introducedChapterId)}.`,'clues',c.id);
    if(resolved!=null&&intro!=null&&resolved<intro)add('error','clue_resolve_before_intro','Resolución antes de introducir la pista',`${c.ref} se resuelve antes de su introducción.`,'clues',c.id);
    if(resolved!=null&&reveal!=null&&resolved<reveal)add('warning','clue_resolve_before_reveal','Resolución anterior a la revelación',`${c.ref} figura resuelta en ${chapterName(c.resolvedChapterId)} antes de revelarse en ${chapterName(c.revealedChapterId)}.`,'clues',c.id);
    if((c.status||'open')==='open'&&!c.resolvedChapterId)add('warning','clue_unresolved','Pista abierta sin resolver',`${c.ref} · ${c.title} está introducida pero no tiene capítulo de resolución.`,'clues',c.id);
    for(const id of [...(c.foreshadowChapterIds||[]),...(c.callbackChapterIds||[])])if(id&&!chById.has(id))add('warning','clue_missing_chapter_ref','Referencia de pista huérfana',`${c.ref} contiene una referencia a un capítulo que ya no existe.`,'clues',c.id);
  }

  for(const s of w.secrets){
    const intro=order(s.introducedChapterId),reveal=order(s.audienceRevealChapterId),resolved=order(s.resolvedChapterId);
    if(reveal!=null&&intro!=null&&reveal<intro)add('error','secret_reveal_before_intro','Secreto revelado antes de plantearse',`${s.ref} se revela a la audiencia antes de su primera insinuación.`,'secrets',s.id);
    if(resolved!=null&&reveal!=null&&resolved<reveal)add('warning','secret_resolve_before_reveal','Secreto resuelto antes de revelarse',`${s.ref} figura resuelto antes de la revelación a la audiencia.`,'secrets',s.id);
    for(const d of s.discoveries||[]){
      if(!personIds.has(d.personId))add('warning','secret_missing_person','Descubrimiento con personaje ausente',`${s.ref} conserva un descubrimiento de una persona eliminada.`,'secrets',s.id);
      if(!chById.has(d.chapterId))add('error','secret_missing_discovery_chapter','Descubrimiento en capítulo ausente',`${s.ref} tiene un descubrimiento ligado a un capítulo inexistente.`,'secrets',s.id);
      const dOrder=order(d.chapterId);if(intro!=null&&dOrder!=null&&dOrder<intro)add('warning','secret_known_before_intro','Secreto conocido antes de insinuarse',`${personTitle(modules,d.personId)} descubre ${s.ref} antes de la primera insinuación narrativa.`,'secrets',s.id);
    }
  }

  const rank={error:0,warning:1,info:2};issues.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.code.localeCompare(b.code));
  return issues;
}

export class WriterMode{
  constructor({onChange,onToast,onOpenPerson}){
    this.onChange=onChange;this.onToast=onToast;this.onOpenPerson=onOpenPerson;this.modules={people:[]};this.writer=normalizeWriter();this.tab='chapters';this.query='';this.dialog=$('#writerDialog');this.form=$('#writerForm');this.grid=$('#writerGrid');this.empty=$('#writerEmpty');this.bind();
  }
  bind(){
    $('#writerTabs').addEventListener('click',e=>{const b=e.target.closest('[data-writer-tab]');if(!b)return;this.tab=b.dataset.writerTab;this.render();});
    $('#writerSearch').addEventListener('input',e=>{this.query=e.target.value.trim().toLowerCase();this.renderGrid();});
    $('#writerAddBtn').addEventListener('click',()=>{if(META[this.tab])this.openEditor(this.tab);});
    this.grid.addEventListener('click',e=>{const card=e.target.closest('[data-writer-id]'),btn=e.target.closest('[data-writer-action]');if(!card||!btn)return;const kind=card.dataset.writerKind,id=card.dataset.writerId,record=this.writer[kind]?.find(x=>x.id===id);if(record&&btn.dataset.writerAction==='edit')this.openEditor(kind,record);});
    $('#writerContinuity').addEventListener('click',e=>{const b=e.target.closest('[data-writer-open]');if(!b)return;const [kind,id]=b.dataset.writerOpen.split('|');const rec=this.writer[kind]?.find(x=>x.id===id);if(rec)this.openEditor(kind,rec);});
    this.form.addEventListener('submit',e=>this.saveEditor(e));
    $('#writerDeleteBtn').addEventListener('click',()=>this.deleteFromDialog());
    $('#writerFields').addEventListener('click',e=>this.handleDynamicClick(e));
  }
  load(modules={}){this.modules=structuredClone(modules);this.writer=normalizeWriter(modules.writer||{});this.render();}
  snapshot(){return structuredClone(this.writer);}
  counterName(kind){return ({chapters:'chapterCounter',scenes:'sceneCounter',clues:'clueCounter',secrets:'secretCounter'})[kind];}
  nextRef(kind){return `${META[kind].prefix}-${String((this.writer[this.counterName(kind)]||0)+1).padStart(3,'0')}`;}
  reserveRef(kind){const k=this.counterName(kind);this.writer[k]=(this.writer[k]||0)+1;return `${META[kind].prefix}-${String(this.writer[k]).padStart(3,'0')}`;}
  chapterOptions(selected='',blank='Selecciona capítulo…'){return `<option value="">${blank}</option>${[...this.writer.chapters].sort((a,b)=>(a.order||0)-(b.order||0)).map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===selected?'selected':''}>${escapeHtml(c.ref)} · ${escapeHtml(c.title)}</option>`).join('')}`;}
  personOptions(selected='',blank='Selecciona personaje…'){return `<option value="">${blank}</option>${arr(this.modules.people).map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===selected?'selected':''}>${escapeHtml(p.ref||'P-???')} · ${escapeHtml(p.name||'Sin nombre')}</option>`).join('')}`;}
  secretOptions(selected='',blank='Selecciona secreto…'){return `<option value="">${blank}</option>${this.writer.secrets.map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===selected?'selected':''}>${escapeHtml(s.ref)} · ${escapeHtml(s.title)}</option>`).join('')}`;}
  render(){
    $('#writerTabs').querySelectorAll('[data-writer-tab]').forEach(b=>{b.classList.toggle('is-active',b.dataset.writerTab===this.tab);const badge=b.querySelector('b');if(badge&&this.writer[b.dataset.writerTab])badge.textContent=this.writer[b.dataset.writerTab].length;});
    const issues=analyzeContinuity(this.writer,this.modules);$('#writerChapterCount').textContent=this.writer.chapters.length;$('#writerSceneCount').textContent=this.writer.scenes.length;$('#writerClueCount').textContent=this.writer.clues.length;$('#writerIssueCount').textContent=issues.length;
    $('#writerSearch').disabled=this.tab==='continuity';$('#writerAddBtn').hidden=this.tab==='continuity';if(META[this.tab])$('#writerAddBtn').textContent=`＋ ${META[this.tab].singular}`;
    $('#writerRegistryLabel').textContent=this.tab==='continuity'?'CONTINUIDAD':META[this.tab]?.label||'';this.renderGrid();
  }
  filtered(kind){const q=this.query;if(!META[kind])return[];return this.writer[kind].filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));}
  renderGrid(){
    const continuity=$('#writerContinuity');
    if(this.tab==='continuity'){this.grid.hidden=true;this.empty.hidden=true;continuity.hidden=false;this.renderContinuity();return;}
    this.grid.hidden=false;this.empty.hidden=false;continuity.hidden=true;const rows=this.filtered(this.tab);this.empty.classList.toggle('is-visible',rows.length===0);this.empty.querySelector('p').textContent=this.query?'No hay coincidencias.':`No hay ${META[this.tab].label.toLowerCase()} todavía.`;this.grid.innerHTML=rows.map(r=>this.cardHtml(this.tab,r)).join('');
  }
  cardHtml(kind,r){
    if(kind==='chapters')return `<article class="writer-card" data-writer-kind="chapters" data-writer-id="${escapeHtml(r.id)}"><div class="writer-card-top"><span>${escapeHtml(r.ref)}</span><span>ORD ${Number(r.order)||0}</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.summary||'Sin resumen.')}</p><div class="writer-facts"><span>POV ${escapeHtml(r.pov||'—')}</span><span>${this.writer.scenes.filter(s=>s.chapterId===r.id).length} escenas</span></div>${this.tagHtml(r.tags)}<button data-writer-action="edit">Editar</button></article>`;
    if(kind==='scenes')return `<article class="writer-card" data-writer-kind="scenes" data-writer-id="${escapeHtml(r.id)}"><div class="writer-card-top"><span>${escapeHtml(r.ref)}</span><span>${escapeHtml(chapterRef(this.writer,r.chapterId))}</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.summary||'Sin resumen.')}</p><div class="writer-facts"><span>POV ${escapeHtml(r.pov||'—')}</span><span>${(r.secretUses||[]).length} usos de secreto</span></div>${this.tagHtml(r.tags)}<button data-writer-action="edit">Editar</button></article>`;
    if(kind==='clues'){const status=({open:'ABIERTA',resolved:'RESUELTA',red_herring:'RED HERRING'})[r.status||'open']||String(r.status||'').toUpperCase();return `<article class="writer-card" data-writer-kind="clues" data-writer-id="${escapeHtml(r.id)}"><div class="writer-card-top"><span>${escapeHtml(r.ref)}</span><span>${escapeHtml(status)}</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.description||'Sin descripción.')}</p><div class="writer-facts"><span>Intro ${escapeHtml(chapterRef(this.writer,r.introducedChapterId))}</span><span>Res. ${escapeHtml(chapterRef(this.writer,r.resolvedChapterId))}</span></div>${this.tagHtml(r.tags)}<button data-writer-action="edit">Editar</button></article>`;}
    return `<article class="writer-card" data-writer-kind="secrets" data-writer-id="${escapeHtml(r.id)}"><div class="writer-card-top"><span>${escapeHtml(r.ref)}</span><span>${(r.discoveries||[]).length} conocedores</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.description||'Sin descripción.')}</p><div class="writer-facts"><span>Insinúa ${escapeHtml(chapterRef(this.writer,r.introducedChapterId))}</span><span>Revela ${escapeHtml(chapterRef(this.writer,r.audienceRevealChapterId))}</span></div>${this.tagHtml(r.tags)}<button data-writer-action="edit">Editar</button></article>`;
  }
  tagHtml(v){return `<div class="tags">${arr(v).slice(0,5).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>`;}
  renderContinuity(){
    const issues=analyzeContinuity(this.writer,this.modules),root=$('#writerContinuity');const errors=issues.filter(i=>i.severity==='error').length,warnings=issues.filter(i=>i.severity==='warning').length;
    root.innerHTML=`<div class="continuity-summary"><div><strong>${errors}</strong><span>errores</span></div><div><strong>${warnings}</strong><span>avisos</span></div><div><strong>${issues.length}</strong><span>total</span></div></div>${issues.length?`<div class="continuity-list">${issues.map(i=>`<article class="continuity-issue is-${i.severity}"><div><span>${i.severity==='error'?'⛔':'⚠'} ${escapeHtml(i.title)}</span><small>${escapeHtml(i.code)}</small></div><p>${escapeHtml(i.detail)}</p><button data-writer-open="${escapeHtml(i.kind+'|'+i.id)}">Abrir registro</button></article>`).join('')}</div>`:'<div class="continuity-clean"><strong>✓ Continuidad limpia</strong><span>No se detectan conflictos mecánicos con los datos narrativos actuales.</span></div>'}`;
  }
  openEditor(kind,r=null){
    $('#writerKind').value=kind;$('#writerId').value=r?.id||'';$('#writerDialogMode').textContent=r?'EDIT WRITER RECORD':'NEW WRITER RECORD';$('#writerDialogTitle').textContent=r?`${r.ref} · ${r.title}`:`Nuevo ${META[kind].singular.toLowerCase()}`;$('#writerRef').textContent=r?.ref||this.nextRef(kind);$('#writerDeleteBtn').hidden=!r;$('#writerFields').innerHTML=this.fieldsHtml(kind,r||{});this.dialog.showModal();setTimeout(()=>$('#writerFields input, #writerFields textarea, #writerFields select')?.focus(),30);
  }
  fieldsHtml(kind,r){
    if(kind==='chapters')return `<div class="writer-form-grid"><label>Título<input id="wfTitle" required maxlength="120" value="${escapeHtml(r.title||'')}"></label><label>Orden<input id="wfOrder" type="number" min="1" max="999" value="${Number(r.order)||this.writer.chapters.length+1}"></label><label>POV<input id="wfPov" maxlength="100" value="${escapeHtml(r.pov||'')}" placeholder="Ej. Bruna"></label><label>Fecha / rótulo<input id="wfDateLabel" maxlength="120" value="${escapeHtml(r.dateLabel||'')}" placeholder="Barcelona · 12 octubre · 23:10"></label><label class="field-span">Resumen<textarea id="wfSummary" rows="5" maxlength="2200">${escapeHtml(r.summary||'')}</textarea></label><label class="field-span">Etiquetas<input id="wfTags" maxlength="220" value="${escapeHtml(arr(r.tags).join(', '))}"></label></div>`;
    if(kind==='scenes')return `<div class="writer-form-grid"><label>Título<input id="wfTitle" required maxlength="120" value="${escapeHtml(r.title||'')}"></label><label>Capítulo<select id="wfChapter" required>${this.chapterOptions(r.chapterId)}</select></label><label>Orden en capítulo<input id="wfOrder" type="number" min="1" max="999" value="${Number(r.order)||1}"></label><label>POV<input id="wfPov" maxlength="100" value="${escapeHtml(r.pov||'')}"></label><label>Lugar<input id="wfLocation" maxlength="140" value="${escapeHtml(r.location||'')}"></label><label>Personajes<select id="wfParticipants" multiple size="4">${arr(this.modules.people).map(p=>`<option value="${escapeHtml(p.id)}" ${arr(r.participants).includes(p.id)?'selected':''}>${escapeHtml(p.ref||'P-???')} · ${escapeHtml(p.name||'Sin nombre')}</option>`).join('')}</select></label><label class="field-span">Resumen / acción<textarea id="wfSummary" rows="5" maxlength="2200">${escapeHtml(r.summary||'')}</textarea></label><label class="field-span">Etiquetas<input id="wfTags" maxlength="220" value="${escapeHtml(arr(r.tags).join(', '))}"></label></div><section class="writer-rel-box"><div class="writer-rel-head"><div><p class="eyebrow">KNOWLEDGE USE</p><h3>Secretos usados en la escena</h3></div><button type="button" class="btn ghost" data-writer-dynamic="add-use">＋ Uso</button></div><div id="wfSecretUses" class="writer-rel-list">${this.secretUsesHtml(arr(r.secretUses))}</div></section>`;
    if(kind==='clues')return `<div class="writer-form-grid"><label>Título<input id="wfTitle" required maxlength="120" value="${escapeHtml(r.title||'')}"></label><label>Estado<select id="wfStatus"><option value="open" ${r.status!=='resolved'&&r.status!=='red_herring'?'selected':''}>Abierta</option><option value="resolved" ${r.status==='resolved'?'selected':''}>Resuelta</option><option value="red_herring" ${r.status==='red_herring'?'selected':''}>Red herring</option></select></label><label>Introducida<select id="wfIntroduced">${this.chapterOptions(r.introducedChapterId)}</select></label><label>Revelada<select id="wfRevealed">${this.chapterOptions(r.revealedChapterId,'Sin revelación')}</select></label><label>Resuelta<select id="wfResolved">${this.chapterOptions(r.resolvedChapterId,'Sin resolución')}</select></label><label>Foreshadowing<select id="wfForeshadow" multiple size="5">${this.multiChapterOptions(r.foreshadowChapterIds)}</select></label><label class="field-span">Callbacks<select id="wfCallbacks" multiple size="5">${this.multiChapterOptions(r.callbackChapterIds)}</select></label><label class="field-span">Descripción<textarea id="wfDescription" rows="5" maxlength="2200">${escapeHtml(r.description||'')}</textarea></label><label class="field-span">Etiquetas<input id="wfTags" maxlength="220" value="${escapeHtml(arr(r.tags).join(', '))}"></label></div>`;
    return `<div class="writer-form-grid"><label>Título<input id="wfTitle" required maxlength="120" value="${escapeHtml(r.title||'')}"></label><label>Primera insinuación<select id="wfIntroduced">${this.chapterOptions(r.introducedChapterId)}</select></label><label>Revelación a audiencia<select id="wfAudienceReveal">${this.chapterOptions(r.audienceRevealChapterId,'Sin revelar')}</select></label><label>Resolución<select id="wfResolved">${this.chapterOptions(r.resolvedChapterId,'Sin resolver')}</select></label><label class="field-span">Descripción<textarea id="wfDescription" rows="5" maxlength="2200">${escapeHtml(r.description||'')}</textarea></label><label class="field-span">Etiquetas<input id="wfTags" maxlength="220" value="${escapeHtml(arr(r.tags).join(', '))}"></label></div><section class="writer-rel-box"><div class="writer-rel-head"><div><p class="eyebrow">CHARACTER KNOWLEDGE</p><h3>Quién descubre el secreto y cuándo</h3></div><button type="button" class="btn ghost" data-writer-dynamic="add-discovery">＋ Descubrimiento</button></div><div id="wfDiscoveries" class="writer-rel-list">${this.discoveriesHtml(arr(r.discoveries))}</div></section>`;
  }
  multiChapterOptions(selected=[]){const set=new Set(arr(selected));return [...this.writer.chapters].sort((a,b)=>(a.order||0)-(b.order||0)).map(c=>`<option value="${escapeHtml(c.id)}" ${set.has(c.id)?'selected':''}>${escapeHtml(c.ref)} · ${escapeHtml(c.title)}</option>`).join('');}
  secretUsesHtml(uses){return uses.length?uses.map((u,i)=>`<div class="writer-rel-row" data-use-row="${i}"><select data-use-secret>${this.secretOptions(u.secretId)}</select><select data-use-person>${this.personOptions(u.personId)}</select><button type="button" data-remove-row="use">×</button></div>`).join(''):'<div class="writer-rel-empty">Sin usos de secretos registrados.</div>';}
  discoveriesHtml(discoveries){return discoveries.length?discoveries.map((d,i)=>`<div class="writer-rel-row" data-discovery-row="${i}"><select data-discovery-person>${this.personOptions(d.personId)}</select><select data-discovery-chapter>${this.chapterOptions(d.chapterId)}</select><button type="button" data-remove-row="discovery">×</button></div>`).join(''):'<div class="writer-rel-empty">Sin descubrimientos registrados.</div>';}
  handleDynamicClick(e){
    const action=e.target.closest('[data-writer-dynamic]')?.dataset.writerDynamic;if(action==='add-use'){const root=$('#wfSecretUses');if(root.querySelector('.writer-rel-empty'))root.innerHTML='';root.insertAdjacentHTML('beforeend',`<div class="writer-rel-row"><select data-use-secret>${this.secretOptions()}</select><select data-use-person>${this.personOptions()}</select><button type="button" data-remove-row="use">×</button></div>`);}if(action==='add-discovery'){const root=$('#wfDiscoveries');if(root.querySelector('.writer-rel-empty'))root.innerHTML='';root.insertAdjacentHTML('beforeend',`<div class="writer-rel-row"><select data-discovery-person>${this.personOptions()}</select><select data-discovery-chapter>${this.chapterOptions()}</select><button type="button" data-remove-row="discovery">×</button></div>`);}const remove=e.target.closest('[data-remove-row]');if(remove){const row=remove.closest('.writer-rel-row'),root=row.parentElement;row.remove();if(!root.querySelector('.writer-rel-row'))root.innerHTML='<div class="writer-rel-empty">Sin registros.</div>';}
  }
  selectedValues(sel){return sel?[...sel.selectedOptions].map(o=>o.value).filter(Boolean):[];}
  collectDynamic(kind){
    if(kind==='scenes')return {secretUses:[...document.querySelectorAll('#wfSecretUses .writer-rel-row')].map(row=>({secretId:row.querySelector('[data-use-secret]')?.value||'',personId:row.querySelector('[data-use-person]')?.value||''})).filter(x=>x.secretId&&x.personId)};
    if(kind==='secrets')return {discoveries:[...document.querySelectorAll('#wfDiscoveries .writer-rel-row')].map(row=>({personId:row.querySelector('[data-discovery-person]')?.value||'',chapterId:row.querySelector('[data-discovery-chapter]')?.value||''})).filter(x=>x.personId&&x.chapterId)};
    return {};
  }
  async saveEditor(e){
    e.preventDefault();const kind=$('#writerKind').value,id=$('#writerId').value,existing=id?this.writer[kind].find(x=>x.id===id):null,title=$('#wfTitle')?.value.trim();if(!title)return this.onToast?.('El título es obligatorio','error');const now=new Date().toISOString();let data={...(existing||{}),id:existing?.id||uid(),ref:existing?.ref||this.reserveRef(kind),title,createdAt:existing?.createdAt||now,updatedAt:now};
    if(kind==='chapters')data={...data,order:Number($('#wfOrder').value)||1,pov:$('#wfPov').value.trim(),dateLabel:$('#wfDateLabel').value.trim(),summary:$('#wfSummary').value.trim(),tags:tags($('#wfTags').value)};
    if(kind==='scenes')data={...data,chapterId:$('#wfChapter').value,order:Number($('#wfOrder').value)||1,pov:$('#wfPov').value.trim(),location:$('#wfLocation').value.trim(),participants:this.selectedValues($('#wfParticipants')),summary:$('#wfSummary').value.trim(),tags:tags($('#wfTags').value),...this.collectDynamic(kind)};
    if(kind==='clues')data={...data,status:$('#wfStatus').value,introducedChapterId:$('#wfIntroduced').value,revealedChapterId:$('#wfRevealed').value,resolvedChapterId:$('#wfResolved').value,foreshadowChapterIds:this.selectedValues($('#wfForeshadow')),callbackChapterIds:this.selectedValues($('#wfCallbacks')),description:$('#wfDescription').value.trim(),tags:tags($('#wfTags').value)};
    if(kind==='secrets')data={...data,introducedChapterId:$('#wfIntroduced').value,audienceRevealChapterId:$('#wfAudienceReveal').value,resolvedChapterId:$('#wfResolved').value,description:$('#wfDescription').value.trim(),tags:tags($('#wfTags').value),...this.collectDynamic(kind)};
    if(existing)Object.assign(existing,data);else this.writer[kind].push(data);if(kind==='chapters')this.writer.chapters.sort((a,b)=>(a.order||0)-(b.order||0));this.dialog.close();await this.onChange?.(this.snapshot(),{action:existing?'update':'create',kind,record:structuredClone(data)});this.render();this.onToast?.(existing?'Registro narrativo actualizado':'Registro narrativo creado');
  }
  async deleteFromDialog(){const kind=$('#writerKind').value,id=$('#writerId').value,record=this.writer[kind]?.find(x=>x.id===id);if(!record)return;if(!confirm(`Eliminar ${record.ref} · ${record.title}?`))return;this.writer[kind]=this.writer[kind].filter(x=>x.id!==id);this.prune(kind,id);this.dialog.close();await this.onChange?.(this.snapshot(),{action:'delete',kind,record});this.render();this.onToast?.('Registro narrativo eliminado');}
  prune(kind,id){
    if(kind==='chapters'){for(const s of this.writer.scenes)if(s.chapterId===id)s.chapterId='';for(const c of this.writer.clues){if(c.introducedChapterId===id)c.introducedChapterId='';if(c.revealedChapterId===id)c.revealedChapterId='';if(c.resolvedChapterId===id)c.resolvedChapterId='';c.foreshadowChapterIds=arr(c.foreshadowChapterIds).filter(x=>x!==id);c.callbackChapterIds=arr(c.callbackChapterIds).filter(x=>x!==id);}for(const s of this.writer.secrets){if(s.introducedChapterId===id)s.introducedChapterId='';if(s.audienceRevealChapterId===id)s.audienceRevealChapterId='';if(s.resolvedChapterId===id)s.resolvedChapterId='';s.discoveries=arr(s.discoveries).filter(d=>d.chapterId!==id);}}
    if(kind==='secrets')for(const s of this.writer.scenes)s.secretUses=arr(s.secretUses).filter(u=>u.secretId!==id);
  }
  prunePerson(id){let changed=false;for(const s of this.writer.scenes){const a=s.participants?.length||0,b=s.secretUses?.length||0;s.participants=arr(s.participants).filter(x=>x!==id);s.secretUses=arr(s.secretUses).filter(x=>x.personId!==id);if(a!==s.participants.length||b!==s.secretUses.length)changed=true;}for(const s of this.writer.secrets){const a=s.discoveries?.length||0;s.discoveries=arr(s.discoveries).filter(x=>x.personId!==id);if(a!==s.discoveries.length)changed=true;}return changed;}
}
