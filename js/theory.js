import {$,uid,escapeHtml} from './utils.js';

const KIND_META={
  people:{label:'Personas',symbol:'●'},places:{label:'Lugares',symbol:'⌖'},evidence:{label:'Evidencias',symbol:'◆'},events:{label:'Eventos',symbol:'◷'},documents:{label:'Documentos',symbol:'▧'}
};
const STATUS_LABELS={active:'Activa',alternative:'Alternativa',weakened:'Debilitada',discarded:'Descartada'};
const titleOf=(kind,r)=>kind==='people'||kind==='places'?r?.name:r?.title;
const lines=v=>[...new Set(String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean))].slice(0,40);
const tags=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,16);
const weight=n=>Math.max(1,Math.min(3,Number(n)||1));

export class TheoryEngine{
  constructor({onChange,onToast,onOpenRecord}){
    this.onChange=onChange;this.onToast=onToast;this.onOpenRecord=onOpenRecord;
    this.theories=[];this.counter=0;this.registry={};this.query='';this.status='all';
    this.draftSupports=[];this.draftAgainst=[];
    this.grid=$('#theoryGrid');this.empty=$('#theoryEmpty');this.dialog=$('#theoryDialog');this.form=$('#theoryForm');
    this.bind();
  }
  bind(){
    $('#theorySearch').addEventListener('input',e=>{this.query=e.target.value.trim().toLowerCase();this.render();});
    $('#theoryStatusFilter').addEventListener('change',e=>{this.status=e.target.value;this.render();});
    $('#theoryAddBtn').addEventListener('click',()=>this.openEditor());
    this.grid.addEventListener('click',e=>this.handleGrid(e));
    $('#theoryCompareBody').addEventListener('click',e=>{const b=e.target.closest('[data-theory-open]');if(b)this.openById(b.dataset.theoryOpen);});
    this.form.addEventListener('submit',e=>this.saveEditor(e));
    $('#theoryDeleteBtn').addEventListener('click',()=>this.deleteFromDialog());
    $('#theoryAddSupport').addEventListener('click',()=>this.addDraftLink('support'));
    $('#theoryAddAgainst').addEventListener('click',()=>this.addDraftLink('against'));
    $('#theorySupportLinks').addEventListener('click',e=>this.handleLinkAction(e,'support'));
    $('#theoryAgainstLinks').addEventListener('click',e=>this.handleLinkAction(e,'against'));
    $('#theorySupportLinks').addEventListener('change',e=>this.handleLinkWeight(e,'support'));
    $('#theoryAgainstLinks').addEventListener('change',e=>this.handleLinkWeight(e,'against'));
  }
  load(modules={}){
    this.registry={};for(const kind of Object.keys(KIND_META))for(const r of (Array.isArray(modules[kind])?modules[kind]:[]))this.registry[`${kind}|${r.id}`]={kind,record:structuredClone(r)};
    this.theories=Array.isArray(modules.theories)?structuredClone(modules.theories):[];
    const max=this.theories.reduce((m,t)=>{const hit=String(t.ref||'').match(/(\d+)$/);return hit?Math.max(m,Number(hit[1])):m;},0);
    this.counter=Math.max(Number(modules.theoryCounter)||0,max);
    this.render();
  }
  snapshot(){return {theories:structuredClone(this.theories),theoryCounter:this.counter};}
  nextRef(){return `T-${String(this.counter+1).padStart(3,'0')}`;}
  reserveRef(){this.counter++;return `T-${String(this.counter).padStart(3,'0')}`;}
  relationKey(l){return `${l.kind}|${l.id}`;}
  recordFor(l){return this.registry[this.relationKey(l)]?.record||null;}
  linkLabel(l){const r=this.recordFor(l);return r?`${r.ref||'?'} · ${titleOf(l.kind,r)||'Sin título'}`:`Registro eliminado · ${l.kind}/${l.id}`;}
  metrics(t){
    const supports=Array.isArray(t.supports)?t.supports:[],against=Array.isArray(t.contradicts)?t.contradicts:[];
    const sw=supports.reduce((n,l)=>n+weight(l.weight),0),aw=against.reduce((n,l)=>n+weight(l.weight),0),total=sw+aw;
    const score=total?Math.round(sw/total*100):null,links=supports.length+against.length;
    const base=total>=12?'alta':total>=6?'media':total?'baja':'sin base';
    return {sw,aw,total,score,links,base,questions:(t.questions||[]).length,contradictions:(t.contradictions||[]).length,missing:[...supports,...against].filter(l=>!this.recordFor(l)).length};
  }
  filtered(){return this.theories.filter(t=>{if(this.status!=='all'&&(t.status||'active')!==this.status)return false;if(!this.query)return true;const refs=[...(t.supports||[]),...(t.contradicts||[])].map(l=>this.linkLabel(l)).join(' ');return [t.ref,t.title,t.statement,t.notes,(t.tags||[]).join(' '),(t.questions||[]).join(' '),(t.contradictions||[]).join(' '),refs].join(' ').toLowerCase().includes(this.query);});}
  render(){
    const rows=this.filtered();
    $('#theoryCount').textContent=this.theories.length;$('#theoryActiveCount').textContent=this.theories.filter(t=>(t.status||'active')==='active').length;
    const scored=this.theories.map(t=>this.metrics(t).score).filter(v=>v!==null);$('#theoryAvgSupport').textContent=scored.length?`${Math.round(scored.reduce((a,b)=>a+b,0)/scored.length)}%`:'—';
    $('#theoryQuestionCount').textContent=this.theories.reduce((n,t)=>n+(t.questions||[]).length,0);
    this.empty.classList.toggle('is-visible',rows.length===0);this.empty.querySelector('p').textContent=this.query||this.status!=='all'?'No hay teorías que coincidan con los filtros.':'Crea una hipótesis y clasifica los registros que la apoyan o contradicen.';
    this.grid.innerHTML=rows.map(t=>this.cardHtml(t)).join('');this.renderComparison();
  }
  cardHtml(t){
    const m=this.metrics(t),score=m.score===null?'—':`${m.score}%`,statement=t.statement||'Sin enunciado todavía.';
    return `<article class="theory-card status-${escapeHtml(t.status||'active')}" data-theory-id="${escapeHtml(t.id)}">
      <div class="theory-card-top"><span class="theory-ref">△ ${escapeHtml(t.ref||'T-???')}</span><span class="theory-status">${escapeHtml(STATUS_LABELS[t.status||'active']||t.status)}</span></div>
      <h3>${escapeHtml(t.title||'Hipótesis sin título')}</h3><p>${escapeHtml(statement)}</p>
      <div class="theory-score"><div class="theory-score-ring" style="--score:${m.score??0}"><strong>${score}</strong><span>soporte</span></div><div class="theory-score-meta"><span><b>${m.sw}</b> peso a favor</span><span><b>${m.aw}</b> peso en contra</span><span>Base <b>${m.base}</b> · ${m.links} vínculo(s)</span></div></div>
      <div class="theory-mini"><span>＋ ${m.questions} preguntas</span><span>⚠ ${m.contradictions} contradicciones</span>${m.missing?`<span class="is-warning">! ${m.missing} enlace(s) ausente(s)</span>`:''}</div>
      <div class="tags">${(t.tags||[]).slice(0,6).map(x=>`<span class="tag">#${escapeHtml(x)}</span>`).join('')}</div>
      <div class="theory-card-actions"><button data-theory-action="edit">Editar</button><button data-theory-action="inspect">Ver vínculos</button></div>
    </article>`;
  }
  renderComparison(){
    const body=$('#theoryCompareBody');if(!this.theories.length){body.innerHTML='<tr><td colspan="7" class="theory-compare-empty">Sin teorías para comparar.</td></tr>';return;}
    const rows=[...this.theories].sort((a,b)=>{const aa=this.metrics(a).score??-1,bb=this.metrics(b).score??-1;return bb-aa||String(a.ref).localeCompare(String(b.ref));});
    body.innerHTML=rows.map(t=>{const m=this.metrics(t);return `<tr><td><button class="theory-table-link" data-theory-open="${escapeHtml(t.id)}">${escapeHtml(t.ref)} · ${escapeHtml(t.title)}</button></td><td>${escapeHtml(STATUS_LABELS[t.status||'active']||t.status)}</td><td>${m.score===null?'—':m.score+'%'}</td><td>${m.sw}</td><td>${m.aw}</td><td>${m.questions}</td><td>${escapeHtml(m.base)}</td></tr>`;}).join('');
  }
  handleGrid(e){const card=e.target.closest('[data-theory-id]'),btn=e.target.closest('[data-theory-action]');if(!card||!btn)return;const t=this.theories.find(x=>x.id===card.dataset.theoryId);if(!t)return;if(btn.dataset.theoryAction==='edit')this.openEditor(t);if(btn.dataset.theoryAction==='inspect'){this.openEditor(t);setTimeout(()=>$('#theoryRelations')?.scrollIntoView({block:'center'}),60);}}
  openById(id){const t=this.theories.find(x=>x.id===id);if(t)this.openEditor(t);}
  openEditor(t=null){
    $('#theoryDialogMode').textContent=t?'EDIT THEORY':'NEW THEORY';$('#theoryDialogTitle').textContent=t?`${t.ref} · ${t.title}`:'Nueva hipótesis';$('#theoryRef').textContent=t?.ref||this.nextRef();$('#theoryId').value=t?.id||'';
    $('#theoryTitle').value=t?.title||'';$('#theoryStatus').value=t?.status||'active';$('#theoryStatement').value=t?.statement||'';$('#theoryNotes').value=t?.notes||'';$('#theoryTags').value=(t?.tags||[]).join(', ');$('#theoryQuestions').value=(t?.questions||[]).join('\n');$('#theoryContradictions').value=(t?.contradictions||[]).join('\n');
    this.draftSupports=structuredClone(t?.supports||[]);this.draftAgainst=structuredClone(t?.contradicts||[]);this.populatePickers();this.renderDraftLinks();$('#theoryDeleteBtn').hidden=!t;this.dialog.showModal();setTimeout(()=>$('#theoryTitle').focus(),20);
  }
  populatePickers(){
    const grouped=Object.keys(KIND_META).map(kind=>{const records=Object.values(this.registry).filter(x=>x.kind===kind).map(x=>x.record);if(!records.length)return '';return `<optgroup label="${KIND_META[kind].label}">${records.map(r=>`<option value="${escapeHtml(kind+'|'+r.id)}">${escapeHtml(r.ref||'?')} — ${escapeHtml(titleOf(kind,r)||'Sin título')}</option>`).join('')}</optgroup>`;}).join('');
    const html=`<option value="">Selecciona un registro…</option>${grouped}`;$('#theorySupportPicker').innerHTML=html;$('#theoryAgainstPicker').innerHTML=html;
  }
  addDraftLink(side){
    const picker=$(side==='support'?'#theorySupportPicker':'#theoryAgainstPicker'),raw=picker.value;if(!raw)return this.onToast?.('Selecciona un registro','error');const [kind,id]=raw.split('|');const target=side==='support'?this.draftSupports:this.draftAgainst,other=side==='support'?this.draftAgainst:this.draftSupports;if(target.some(l=>l.kind===kind&&l.id===id))return this.onToast?.('Ese registro ya está clasificado aquí','error');
    const oi=other.findIndex(l=>l.kind===kind&&l.id===id);if(oi>=0)other.splice(oi,1);target.push({kind,id,weight:1});picker.value='';this.renderDraftLinks();
  }
  renderDraftLinks(){this.renderDraftSide('support',this.draftSupports,$('#theorySupportLinks'));this.renderDraftSide('against',this.draftAgainst,$('#theoryAgainstLinks'));this.renderDraftScore();}
  renderDraftSide(side,arr,root){if(!arr.length){root.innerHTML=`<div class="theory-link-empty">Sin registros ${side==='support'?'a favor':'en contra'}.</div>`;return;}root.innerHTML=arr.map((l,i)=>{const r=this.recordFor(l);return `<div class="theory-link-row ${r?'':'is-missing'}" data-link-index="${i}"><span>${escapeHtml(this.linkLabel(l))}</span><label>Peso <select data-rel-weight><option value="1" ${weight(l.weight)===1?'selected':''}>1</option><option value="2" ${weight(l.weight)===2?'selected':''}>2</option><option value="3" ${weight(l.weight)===3?'selected':''}>3</option></select></label>${r?`<button type="button" data-rel-open title="Abrir ficha">↗</button>`:''}<button type="button" data-rel-remove title="Quitar">×</button></div>`;}).join('');}
  renderDraftScore(){const m=this.metrics({supports:this.draftSupports,contradicts:this.draftAgainst,questions:lines($('#theoryQuestions').value),contradictions:lines($('#theoryContradictions').value)});$('#theoryDraftScore').textContent=m.score===null?'—':`${m.score}%`;$('#theoryDraftBase').textContent=`Base ${m.base} · peso ${m.total} · ${m.links} vínculo(s)`;}
  handleLinkAction(e,side){const row=e.target.closest('[data-link-index]');if(!row)return;const arr=side==='support'?this.draftSupports:this.draftAgainst,idx=Number(row.dataset.linkIndex),link=arr[idx];if(!link)return;if(e.target.closest('[data-rel-remove]')){arr.splice(idx,1);this.renderDraftLinks();}if(e.target.closest('[data-rel-open]'))this.onOpenRecord?.(link.kind,link.id);}
  handleLinkWeight(e,side){if(!e.target.matches('[data-rel-weight]'))return;const row=e.target.closest('[data-link-index]'),arr=side==='support'?this.draftSupports:this.draftAgainst,idx=Number(row.dataset.linkIndex);if(arr[idx])arr[idx].weight=weight(e.target.value);this.renderDraftScore();}
  async saveEditor(e){
    e.preventDefault();const id=$('#theoryId').value,existing=id?this.theories.find(t=>t.id===id):null,title=$('#theoryTitle').value.trim();if(!title)return this.onToast?.('El título de la hipótesis es obligatorio','error');
    const now=new Date().toISOString(),t={...(existing||{}),id:existing?.id||uid(),ref:existing?.ref||this.reserveRef(),createdAt:existing?.createdAt||now,updatedAt:now,title,status:$('#theoryStatus').value,statement:$('#theoryStatement').value.trim(),notes:$('#theoryNotes').value.trim(),tags:tags($('#theoryTags').value),questions:lines($('#theoryQuestions').value),contradictions:lines($('#theoryContradictions').value),supports:structuredClone(this.draftSupports),contradicts:structuredClone(this.draftAgainst)};
    if(existing)Object.assign(existing,t);else this.theories.unshift(t);this.dialog.close();await this.onChange?.(this.snapshot(),{action:existing?'update':'create',theory:structuredClone(t)});this.render();this.onToast?.(existing?'Hipótesis actualizada':'Hipótesis creada');
  }
  async deleteFromDialog(){const id=$('#theoryId').value,t=this.theories.find(x=>x.id===id);if(!t)return;if(!confirm(`Eliminar ${t.ref} · ${t.title}?`))return;this.theories=this.theories.filter(x=>x.id!==id);this.dialog.close();await this.onChange?.(this.snapshot(),{action:'delete',theory:t});this.render();this.onToast?.('Hipótesis eliminada');}
  pruneReference(kind,id){let changed=false;for(const t of this.theories){const a=(t.supports||[]).length,b=(t.contradicts||[]).length;t.supports=(t.supports||[]).filter(l=>!(l.kind===kind&&l.id===id));t.contradicts=(t.contradicts||[]).filter(l=>!(l.kind===kind&&l.id===id));if(t.supports.length!==a||t.contradicts.length!==b){t.updatedAt=new Date().toISOString();changed=true;}}return changed;}
}
