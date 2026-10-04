import {$,uid,escapeHtml,safePortableDataUrl} from './utils.js';

const KIND_META={
  people:{singular:'Persona',label:'PERSONAS',symbol:'●',prefix:'P',boardType:'person',empty:'No hay personas registradas.'},
  places:{singular:'Lugar',label:'LUGARES',symbol:'⌖',prefix:'L',boardType:'place',empty:'No hay lugares registrados.'},
  evidence:{singular:'Evidencia',label:'EVIDENCIAS',symbol:'◆',prefix:'E',boardType:'evidence',empty:'No hay evidencias registradas.'},
  events:{singular:'Evento',label:'EVENTOS',symbol:'◷',prefix:'EV',boardType:'note',empty:'No hay eventos registrados.'},
  documents:{singular:'Documento',label:'DOCUMENTOS',symbol:'▧',prefix:'D',boardType:'note',empty:'No hay documentos registrados.'}
};

const FIELDS={
  people:[
    ['name','Nombre','text',true,'Nombre completo o identificador'],['status','Estado','select',false,'',[['poi','Person of interest'],['witness','Testigo'],['victim','Víctima'],['cleared','Descartado/a'],['unknown','Sin clasificar']]],
    ['aliases','Alias','text',false,'Alias separados por comas'],['age','Edad','number',false,''],['occupation','Profesión / rol','text',false,''],['contact','Contacto','text',false,''],
    ['alibi','Coartada','textarea',false,'Qué afirma que hacía y cuándo'],['description','Descripción / notas','textarea',false,'Observaciones, conducta, contexto…'],['risk','Índice interno','range',false,''],['tags','Etiquetas','text',false,'testigo, hotel, prioridad']
  ],
  places:[
    ['name','Nombre del lugar','text',true,'Hotel, calle, habitación…'],['type','Tipo','select',false,'',[['scene','Escena'],['residence','Residencia'],['business','Negocio'],['route','Ruta'],['digital','Ubicación digital'],['other','Otro']]],
    ['location','Dirección / ubicación','text',false,''],['coordinates','Coordenadas / referencia','text',false,''],['access','Acceso / horario','text',false,''],['description','Descripción / notas','textarea',false,''],['tags','Etiquetas','text',false,'cámara, acceso, costa']
  ],
  evidence:[
    ['title','Título','text',true,'Ej. Cámara C14'],['type','Tipo de evidencia','select',false,'',[['physical','Física'],['digital','Digital'],['photo','Fotografía'],['statement','Declaración'],['trace','Indicio'],['record','Registro'],['other','Otra']]],
    ['status','Estado','select',false,'',[['collected','Recogida'],['analysed','Analizada'],['confirmed','Confirmada'],['discarded','Descartada'],['pending','Pendiente']]],
    ['collectedAt','Fecha / hora','datetime-local',false,''],['source','Procedencia / fuente','text',false,''],['custody','Custodia / ubicación','text',false,''],['description','Descripción / hallazgos','textarea',false,''],['tags','Etiquetas','text',false,'digital, cámara, ADN']
  ],
  events:[
    ['title','Evento','text',true,'Qué ocurrió'],['startAt','Inicio','datetime-local',false,''],['endAt','Fin','datetime-local',false,''],['place','Lugar relacionado','text',false,''],['subjects','Personas / sujetos','text',false,'Marc Vidal, Laura Serra'],['certainty','Certeza','select',false,'',[['confirmed','Confirmado'],['probable','Probable'],['claimed','Declarado'],['unknown','Desconocido']]],
    ['source','Fuente','text',false,'Testimonio, registro, cámara…'],['description','Descripción / notas','textarea',false,''],['tags','Etiquetas','text',false,'llamada, cámara, hueco temporal']
  ],
  documents:[
    ['title','Título','text',true,'Informe, declaración, recorte…'],['type','Tipo','select',false,'',[['report','Informe'],['statement','Declaración'],['message','Mensaje / correo'],['record','Registro'],['article','Artículo'],['other','Otro']]],
    ['date','Fecha','date',false,''],['source','Origen / autor','text',false,''],['reference','Referencia externa','text',false,''],['notes','Extracto / notas','textarea',false,'Texto relevante del documento…'],['attachment','Adjunto portable','file',false,''],['tags','Etiquetas','text',false,'informe, declaración, correo']
  ]
};

const pickTitle=(kind,r)=>kind==='people'?r.name:kind==='places'?r.name:r.title;
const normalTags=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,16);
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:v.includes?.('T')?'short':undefined}).format(d);};
const humanSize=n=>{if(!n)return '';if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;};

export class InvestigationDB{
  constructor({onChange,onToast,onPin,onUnpin,isPinned,onOpenBoard}){
    this.onChange=onChange;this.onToast=onToast;this.onPin=onPin;this.onUnpin=onUnpin;this.isPinned=isPinned;this.onOpenBoard=onOpenBoard;
    this.kind='people';this.modules={people:[],places:[],evidence:[],events:[],documents:[]};this.counters={people:0,places:0,evidence:0,events:0,documents:0};this.query='';
    this.tabs=$('#dbTabs');this.grid=$('#dbGrid');this.empty=$('#dbEmpty');this.search=$('#dbSearch');this.count=$('#dbCount');this.dialog=$('#recordDialog');this.form=$('#recordForm');
    this.bind();
  }
  bind(){
    this.tabs.addEventListener('click',e=>{const b=e.target.closest('[data-db-kind]');if(!b)return;this.kind=b.dataset.dbKind;this.render();});
    this.search.addEventListener('input',()=>{this.query=this.search.value.trim().toLowerCase();this.renderGrid();});
    $('#dbAddBtn').addEventListener('click',()=>this.openEditor(this.kind));
    this.grid.addEventListener('click',e=>this.handleGridClick(e));
    this.form.addEventListener('submit',e=>this.saveEditor(e));
    $('#recordFields').addEventListener('input',e=>{if(e.target.type==='range'){const o=e.target.parentElement.querySelector('output');if(o)o.value=`${e.target.value}%`;}});
    $('#recordDeleteBtn').addEventListener('click',()=>this.deleteFromDialog());
  }
  load(modules={}){
    for(const k of Object.keys(KIND_META)){this.modules[k]=Array.isArray(modules[k])?structuredClone(modules[k]):[];const existingMax=this.modules[k].reduce((m,r)=>{const hit=String(r.ref||'').match(/(\d+)$/);return hit?Math.max(m,Number(hit[1])):m;},0);this.counters[k]=Math.max(Number(modules.registryCounters?.[k])||0,existingMax);}
    this.render();
  }
  snapshot(){const out={registryCounters:structuredClone(this.counters)};for(const k of Object.keys(KIND_META))out[k]=structuredClone(this.modules[k]);return out;}
  allCount(){return Object.keys(KIND_META).reduce((n,k)=>n+this.modules[k].length,0);}
  nextRef(kind){const prefix=KIND_META[kind].prefix;return `${prefix}-${String((this.counters[kind]||0)+1).padStart(3,'0')}`;}
  reserveRef(kind){this.counters[kind]=(this.counters[kind]||0)+1;return `${KIND_META[kind].prefix}-${String(this.counters[kind]).padStart(3,'0')}`;}
  findRecord(kind,id){return this.modules[kind]?.find(r=>r.id===id)||null;}
  openByLink(kind,id){if(!KIND_META[kind])return;this.kind=kind;this.render();const rec=this.findRecord(kind,id);if(rec)this.openEditor(kind,rec);}
  render(){
    this.tabs.querySelectorAll('[data-db-kind]').forEach(b=>{const k=b.dataset.dbKind;b.classList.toggle('is-active',k===this.kind);b.querySelector('b').textContent=this.modules[k].length;});
    $('#dbKindLabel').textContent=KIND_META[this.kind].label;$('#dbAddBtn').textContent=`＋ ${KIND_META[this.kind].singular}`;this.count.textContent=this.allCount();this.renderGrid();
  }
  renderGrid(){
    const q=this.query;const rows=this.modules[this.kind].filter(r=>{if(!q)return true;const safe={...r,attachment:r.attachment?{name:r.attachment.name,type:r.attachment.type,size:r.attachment.size}:null};return JSON.stringify(safe).toLowerCase().includes(q);});
    this.empty.classList.toggle('is-visible',rows.length===0);this.empty.querySelector('p').textContent=q?'No hay coincidencias.':KIND_META[this.kind].empty;
    this.grid.innerHTML=rows.map(r=>this.cardHtml(this.kind,r)).join('');
  }
  cardHtml(kind,r){
    const meta=KIND_META[kind],title=pickTitle(kind,r)||'Sin título',pinned=this.isPinned?.(kind,r.id);
    let facts='';
    if(kind==='people')facts=`${this.escapeLabel(r.status||'unknown')} · ${r.occupation||'Rol sin indicar'}`;
    if(kind==='places')facts=`${this.escapeLabel(r.type||'other')} · ${r.location||'Ubicación sin indicar'}`;
    if(kind==='evidence')facts=`${this.escapeLabel(r.type||'other')} · ${this.escapeLabel(r.status||'pending')}`;
    if(kind==='events')facts=`${fmtDate(r.startAt)} · ${this.escapeLabel(r.certainty||'unknown')}`;
    if(kind==='documents')facts=`${this.escapeLabel(r.type||'other')} · ${fmtDate(r.date)}`;
    const description=r.description||r.notes||r.alibi||r.source||'';
    return `<article class="db-card" data-kind="${kind}" data-id="${escapeHtml(r.id)}">
      <div class="db-card-top"><span class="db-ref">${meta.symbol} ${escapeHtml(r.ref)}</span><span class="db-state">${escapeHtml(facts)}</span></div>
      <h3>${escapeHtml(title)}</h3><p>${escapeHtml(description||'Sin notas adicionales.')}</p>
      <div class="tags">${(r.tags||[]).slice(0,6).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
      ${r.attachment?`<div class="attachment-chip">▧ ${escapeHtml(r.attachment.name)} · ${humanSize(r.attachment.size)}</div>`:''}
      <div class="db-card-actions"><button data-record-action="edit">Editar</button><button data-record-action="${pinned?'unpin':'pin'}" class="${pinned?'is-pinned':''}">${pinned?'✓ En tablero':'⌁ Al tablero'}</button>${r.attachment?'<button data-record-action="download">Descargar</button>':''}</div>
    </article>`;
  }
  escapeLabel(v){return String(v).replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());}
  handleGridClick(e){
    const card=e.target.closest('.db-card'),btn=e.target.closest('[data-record-action]');if(!card||!btn)return;
    const {kind,id}=card.dataset,record=this.findRecord(kind,id);if(!record)return;
    const a=btn.dataset.recordAction;
    if(a==='edit')this.openEditor(kind,record);
    if(a==='pin'){this.onPin?.(kind,record);this.renderGrid();}
    if(a==='unpin'){this.onUnpin?.(kind,record.id);this.renderGrid();}
    if(a==='download'&&record.attachment)this.downloadAttachment(record.attachment);
  }
  openEditor(kind,record=null){
    this.kind=kind;this.render();$('#recordDialogMode').textContent=record?`EDIT ${KIND_META[kind].label}`:`NEW ${KIND_META[kind].singular.toUpperCase()}`;
    $('#recordDialogTitle').textContent=record?`${record.ref} · ${pickTitle(kind,record)||'Ficha'}`:`Nueva ${KIND_META[kind].singular.toLowerCase()}`;
    $('#recordKind').value=kind;$('#recordId').value=record?.id||'';$('#recordRef').textContent=record?.ref||this.nextRef(kind);
    $('#recordFields').innerHTML=this.fieldsHtml(kind,record||{});$('#recordDeleteBtn').hidden=!record;this.dialog.showModal();setTimeout(()=>this.form.querySelector('input:not([type=hidden]),textarea,select')?.focus(),20);
  }
  fieldsHtml(kind,r){
    return FIELDS[kind].map(([name,label,type,required,placeholder,opts])=>{
      const value=name==='tags'?(r.tags||[]).join(', '):(r[name]??'');
      if(type==='textarea')return `<label class="field-span">${label}<textarea name="${name}" rows="4" ${required?'required':''} maxlength="1600" placeholder="${escapeHtml(placeholder||'')}">${escapeHtml(value)}</textarea></label>`;
      if(type==='select')return `<label>${label}<select name="${name}">${opts.map(([v,l])=>`<option value="${v}" ${String(value)===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
      if(type==='range')return `<label>${label}<div class="range-field"><input name="${name}" type="range" min="0" max="100" value="${Number(value)||0}"><output>${Number(value)||0}%</output></div></label>`;
      if(type==='file')return `<label class="field-span">${label}<input name="${name}" type="file" accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,application/pdf,text/*,image/*"><small>${r.attachment?`Actual: ${escapeHtml(r.attachment.name)} · ${humanSize(r.attachment.size)}`:'Opcional · máximo 4 MB para mantener el expediente portable.'}</small></label>`;
      return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required?'required':''} ${type==='number'?'min="0" max="130"':''} maxlength="220" placeholder="${escapeHtml(placeholder||'')}"></label>`;
    }).join('');
  }
  async saveEditor(e){
    e.preventDefault();const kind=$('#recordKind').value,id=$('#recordId').value;const existing=id?this.findRecord(kind,id):null;const fd=new FormData(this.form),now=new Date().toISOString();
    const r={...(existing||{}),id:existing?.id||uid(),ref:existing?.ref||this.reserveRef(kind),createdAt:existing?.createdAt||now,updatedAt:now};
    for(const [name,,type] of FIELDS[kind]){
      if(type==='file')continue;let v=fd.get(name);if(type==='number'||type==='range')v=Number(v)||0;if(name==='tags')v=normalTags(v);r[name]=typeof v==='string'?v.trim():v;
    }
    if(kind==='documents'){
      const f=fd.get('attachment');if(f instanceof File&&f.size){try{r.attachment=await this.fileToPortable(f);}catch(err){this.onToast?.(err.message,'error');return;}}
    }
    const title=pickTitle(kind,r);if(!title){this.onToast?.('El título o nombre es obligatorio','error');return;}
    if(existing){Object.assign(existing,r);}else this.modules[kind].unshift(r);
    this.dialog.close();await this.onChange?.(this.snapshot(),{action:existing?'update':'create',kind,record:structuredClone(r)});this.render();this.onToast?.(existing?'Ficha actualizada':'Ficha creada');
  }
  async deleteFromDialog(){
    const kind=$('#recordKind').value,id=$('#recordId').value,record=this.findRecord(kind,id);if(!record)return;
    if(!confirm(`Eliminar ${record.ref} · ${pickTitle(kind,record)}? También se retirará su tarjeta enlazada del tablero.`))return;
    this.modules[kind]=this.modules[kind].filter(r=>r.id!==id);this.onUnpin?.(kind,id,true);this.dialog.close();await this.onChange?.(this.snapshot(),{action:'delete',kind,record});this.render();this.onToast?.('Ficha eliminada');
  }
  async fileToPortable(file){
    if(file.size>4*1024*1024)throw new Error('El adjunto supera 4 MB');
    const data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(new Error('No se pudo leer el adjunto'));fr.readAsDataURL(file);});
    return {name:file.name,type:file.type||'application/octet-stream',size:file.size,data};
  }
  downloadAttachment(a){const href=safePortableDataUrl(a?.data);if(!href){this.onToast?.('Adjunto bloqueado: formato de datos no válido','error');return;}const link=document.createElement('a');link.href=href;link.download=String(a?.name||'adjunto');document.body.appendChild(link);link.click();link.remove();}
}
