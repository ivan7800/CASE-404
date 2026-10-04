/* CASE 404 v1.2.0 - simplified direct-link UX classic browser bundle for GitHub Pages and file:// */
window.CASE404=window.CASE404||{};

/* --- utils.js --- */
(()=>{
"use strict";

const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
function uid(){return crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function caseNumber(uuid){return `CASE-${uuid.replace(/-/g,'').slice(0,6).toUpperCase()}`;}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function safeImageDataUrl(v=''){const s=String(v||'');return /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)?s:'';}
function safePortableDataUrl(v=''){const s=String(v||'');return /^data:(?:application\/(?:pdf|json|octet-stream)|text\/(?:plain|markdown|csv)|image\/(?:png|jpe?g|webp));(?:charset=[^,;]+;)?base64,[a-z0-9+/=\s]+$/i.test(s)?s:'';}
function formatDate(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return v;}}
function downloadJson(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function slug(v){return String(v||'case-404').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'case-404';}

Object.assign(window.CASE404,{$,$$,uid,caseNumber,escapeHtml,safeImageDataUrl,safePortableDataUrl,formatDate,downloadJson,slug});
})();

/* --- db.js --- */
(()=>{
"use strict";
const DB_NAME = 'case404-db';
const DB_VERSION = 1;
const CASE_STORE = 'cases';
const FALLBACK_KEY = 'case404-fallback-cases-v1';
let idbFailed = false;
let memoryFallback = [];

function openDb(){
  if(idbFailed || typeof indexedDB==='undefined') return Promise.reject(new Error('IndexedDB no disponible'));
  return new Promise((resolve,reject)=>{
    let req;
    try{req=indexedDB.open(DB_NAME,DB_VERSION);}catch(err){idbFailed=true;reject(err);return;}
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(CASE_STORE)){
        const store=db.createObjectStore(CASE_STORE,{keyPath:'uuid'});
        store.createIndex('updatedAt','updatedAt');
        store.createIndex('title','title');
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>{idbFailed=true;reject(req.error||new Error('IndexedDB no disponible'));};
    req.onblocked=()=>{idbFailed=true;reject(new Error('IndexedDB bloqueado'));};
  });
}
function requestToPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function readFallback(){
  try{
    const raw=localStorage.getItem(FALLBACK_KEY);
    const rows=raw?JSON.parse(raw):memoryFallback;
    return Array.isArray(rows)?rows:[];
  }catch{return memoryFallback;}
}
function writeFallback(items){
  memoryFallback=Array.isArray(items)?items:[];
  try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(memoryFallback));}catch{}
}
function fallbackNotice(){
  if(!window.__CASE404_FALLBACK_WARNED__){
    window.__CASE404_FALLBACK_WARNED__=true;
    console.warn('CASE404: IndexedDB no disponible; usando almacenamiento local de compatibilidad.');
  }
}
async function tryIdb(work,fallback){
  if(idbFailed||typeof indexedDB==='undefined'){fallbackNotice();return fallback();}
  try{return await work();}catch(err){idbFailed=true;fallbackNotice();return fallback(err);}
}
async function listCases(){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readonly');return requestToPromise(tx.objectStore(CASE_STORE).getAll());},()=>readFallback());}
async function getCase(uuid){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readonly');return requestToPromise(tx.objectStore(CASE_STORE).get(uuid));},()=>readFallback().find(x=>x?.uuid===uuid));}
async function putCase(item){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');await requestToPromise(tx.objectStore(CASE_STORE).put(item));return item;},()=>{const items=readFallback();const i=items.findIndex(x=>x?.uuid===item.uuid);if(i>=0)items[i]=item;else items.push(item);writeFallback(items);return item;});}
async function deleteCase(uuid){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');return requestToPromise(tx.objectStore(CASE_STORE).delete(uuid));},()=>{writeFallback(readFallback().filter(x=>x?.uuid!==uuid));return true;});}
async function clearCases(){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');return requestToPromise(tx.objectStore(CASE_STORE).clear());},()=>{writeFallback([]);return true;});}
async function replaceAllCases(items){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');const store=tx.objectStore(CASE_STORE);store.clear();items.forEach(x=>store.put(x));return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});},()=>{writeFallback(items);return true;});}

Object.assign(window.CASE404,{listCases,getCase,putCase,deleteCase,clearCases,replaceAllCases});
})();

/* --- board.js --- */
(()=>{
"use strict";
const {$,uid,escapeHtml,safeImageDataUrl}=window.CASE404;


const TYPE_META={
  note:{label:'NOTE',symbol:'▤'},
  person:{label:'PERSON',symbol:'●'},
  place:{label:'PLACE',symbol:'⌖'},
  evidence:{label:'EVIDENCE',symbol:'◆'},
  photo:{label:'PHOTO',symbol:'▧'},
  event:{label:'EVENT',symbol:'◷'},
  document:{label:'DOCUMENT',symbol:'▧'}
};
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

class EvidenceBoard{
  constructor({root,onChange,onToast,onOpenLinked}){
    this.root=root;
    this.onChange=onChange;
    this.onToast=onToast;
    this.onOpenLinked=onOpenLinked;
    this.world=$('#boardWorld');
    this.nodesLayer=$('#boardNodes');
    this.edgesLayer=$('#boardEdges');
    this.empty=$('#boardEmpty');
    this.help=$('#boardHelp');
    this.zoomLabel=$('#zoomLabel');
    this.connectBtn=$('#connectTool');
    this.photoInput=$('#boardPhotoInput');
    this.nodeDialog=$('#nodeDialog');
    this.nodeForm=$('#nodeForm');
    this.data={nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}};
    this.selectedNodeId=null;
    this.selectedEdgeId=null;
    this.connectSourceId=null;
    this.mode='select';
    this.drag=null;
    this.saveTimer=null;
    this.previewPoint=null;
    this.connectDrag=null;
    this.hoverConnectTargetId=null;
    this.suppressClick=false;
    this.newEdgeId=null;
    this.newNodeId=null;
    this.zoomTimer=null;
    this.bind();
  }

  bind(){
    document.querySelectorAll('[data-board-action]').forEach(btn=>btn.addEventListener('click',()=>this.handleAction(btn.dataset.boardAction)));
    this.photoInput.addEventListener('change',()=>this.handlePhoto(this.photoInput.files?.[0]));
    this.root.addEventListener('pointerdown',e=>this.onPointerDown(e));
    window.addEventListener('pointermove',e=>this.onPointerMove(e));
    window.addEventListener('pointerup',e=>this.onPointerUp(e));
    this.root.addEventListener('wheel',e=>this.onWheel(e),{passive:false});
    this.root.addEventListener('dblclick',e=>{const node=e.target.closest('.board-node');if(node)this.editNode(node.dataset.id);});
    this.root.addEventListener('click',e=>this.onClick(e));
    this.root.addEventListener('keydown',e=>this.onKeyDown(e));
    this.nodeForm.addEventListener('submit',e=>this.saveNodeDialog(e));
    window.addEventListener('resize',()=>this.renderEdges());
  }

  ensureData(board){
    return {
      nodes:Array.isArray(board?.nodes)?board.nodes.filter(n=>n&&typeof n==='object'&&!Array.isArray(n)&&typeof n.id==='string'):[],
      edges:Array.isArray(board?.edges)?board.edges.filter(e=>e&&typeof e==='object'&&!Array.isArray(e)&&typeof e.id==='string'&&typeof e.from==='string'&&typeof e.to==='string'):[],
      viewport:{x:Number(board?.viewport?.x)||0,y:Number(board?.viewport?.y)||0,zoom:clamp(Number(board?.viewport?.zoom)||1,.25,2.5)}
    };
  }

  load(board){
    this.data=this.ensureData(structuredClone(board||{}));
    this.selectedNodeId=null;this.selectedEdgeId=null;this.cancelConnect(false);
    this.render();
  }

  snapshot(){return structuredClone(this.data);}

  isLinked(recordKind,recordId){return this.data.nodes.some(n=>n.linkedRecord?.kind===recordKind&&n.linkedRecord?.id===recordId);}

  linkedNodeData(kind,record){
    const type=kind==='people'?'person':kind==='places'?'place':kind==='evidence'?'evidence':kind==='events'?'event':'document';
    const title=kind==='people'||kind==='places'?record.name:record.title;
    const text=record.description||record.notes||record.alibi||record.source||'';
    return {type,title:title||record.ref||'Registro',text,meta:record.ref||'',linkedRecord:{kind,id:record.id}};
  }

  pinRecord(kind,record){
    const existing=this.data.nodes.find(n=>n.linkedRecord?.kind===kind&&n.linkedRecord?.id===record.id);
    if(existing){this.selectNode(existing.id);this.onToast?.('La ficha ya está en el tablero');return existing.id;}
    this.addNode(this.linkedNodeData(kind,record).type,{...this.linkedNodeData(kind,record),skipEditor:true});
    const node=this.data.nodes.at(-1);if(node){this.onToast?.(`${record.ref||'Ficha'} fijada al tablero`);return node.id;}
  }

  unpinRecord(kind,recordId,silent=false){
    const ids=this.data.nodes.filter(n=>n.linkedRecord?.kind===kind&&n.linkedRecord?.id===recordId).map(n=>n.id);if(!ids.length)return false;
    this.data.nodes=this.data.nodes.filter(n=>!ids.includes(n.id));this.data.edges=this.data.edges.filter(e=>!ids.includes(e.from)&&!ids.includes(e.to));
    if(ids.includes(this.selectedNodeId))this.selectedNodeId=null;this.render();this.scheduleSave();if(!silent)this.onToast?.('Ficha retirada del tablero');return true;
  }

  syncLinkedRecord(kind,record){
    const node=this.data.nodes.find(n=>n.linkedRecord?.kind===kind&&n.linkedRecord?.id===record.id);if(!node)return false;
    const next=this.linkedNodeData(kind,record);Object.assign(node,{type:next.type,title:next.title,text:next.text,meta:next.meta,updatedAt:new Date().toISOString()});this.render();this.scheduleSave();return true;
  }

  scheduleSave(){
    clearTimeout(this.saveTimer);
    this.saveTimer=setTimeout(()=>this.onChange?.(this.snapshot()),180);
  }

  handleAction(action){
    if(action?.startsWith('add-')&&action!=='add-photo') return this.addNode(action.replace('add-',''));
    if(action==='add-photo') return this.photoInput.click();
    if(action==='connect') return this.toggleConnect();
    if(action==='delete-selected') return this.deleteSelected();
    if(action==='zoom-in') return this.setZoom(this.data.viewport.zoom*1.18);
    if(action==='zoom-out') return this.setZoom(this.data.viewport.zoom/1.18);
    if(action==='reset-zoom'){this.animateViewport(()=>{this.data.viewport={x:0,y:0,zoom:1};this.applyViewport();});this.scheduleSave();return;}
    if(action==='fit') return this.fitNodes();
  }

  addNode(type='note',extra={}){
    if(!TYPE_META[type])type='note';
    const rect=this.root.getBoundingClientRect();
    const v=this.data.viewport;
    const idx=this.data.nodes.length;
    const col=idx%3,row=Math.floor(idx/3)%3,cycle=Math.floor(idx/9);
    const centerX=(rect.width/2-v.x)/v.zoom,centerY=(rect.height/2-v.y)/v.zoom;
    const worldX=centerX-370+col*280+cycle*28;
    const worldY=centerY-190+row*200+cycle*28;
    const defaults={
      note:['Nueva nota','Escribe una observación…'],person:['Persona','Nombre, alias o relación…'],place:['Lugar','Ubicación relevante…'],evidence:['Nueva evidencia','Describe la prueba o indicio…']
    };
    const [title,text]=defaults[type]||defaults.note;
    const node={id:uid(),type,title,text,meta:'',x:Math.round(worldX),y:Math.round(worldY),w:type==='photo'?260:230,h:type==='photo'?210:150,createdAt:new Date().toISOString(),...extra};
    this.data.nodes.push(node);this.newNodeId=node.id;this.selectNode(node.id);this.render();this.scheduleSave();
    const fresh=this.nodesLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    if(fresh)setTimeout(()=>fresh.classList.remove('is-new'),320);
    this.newNodeId=null;
    if(type!=='photo'&&!extra.skipEditor)this.editNode(node.id);
  }

  async handlePhoto(file){
    try{
      if(!file)return;
      if(!file.type.startsWith('image/'))throw new Error('El archivo no es una imagen');
      if(file.size>12*1024*1024)throw new Error('La imagen supera 12 MB');
      const src=await this.imageToDataUrl(file,1280,1280,.86);
      this.addNode('photo',{title:file.name.replace(/\.[^.]+$/,''),text:'',meta:'Fotografía',image:src});
      this.photoInput.value='';
    }catch(err){this.onToast?.(err.message,'error');this.photoInput.value='';}
  }

  imageToDataUrl(file,maxW,maxH,quality){
    return new Promise((resolve,reject)=>{
      const img=new Image();const url=URL.createObjectURL(file);
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width,maxH/img.height);const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo leer la imagen'));};img.src=url;
    });
  }

  editNode(id){
    const node=this.data.nodes.find(n=>n.id===id);if(!node)return;
    if(node.linkedRecord){this.onOpenLinked?.(node.linkedRecord.kind,node.linkedRecord.id);return;}
    $('#nodeId').value=node.id;$('#nodeTitle').value=node.title||'';$('#nodeText').value=node.text||'';$('#nodeMeta').value=node.meta||'';
    $('#nodeDialogType').textContent=`${TYPE_META[node.type]?.label||'NODE'} · ${node.id.slice(0,8).toUpperCase()}`;
    this.nodeDialog.showModal();setTimeout(()=>$('#nodeTitle').focus(),20);
  }

  saveNodeDialog(e){
    e.preventDefault();const id=$('#nodeId').value;const node=this.data.nodes.find(n=>n.id===id);if(!node)return;
    const title=$('#nodeTitle').value.trim();if(!title){$('#nodeTitle').focus();return;}
    node.title=title;node.text=$('#nodeText').value.trim();node.meta=$('#nodeMeta').value.trim();node.updatedAt=new Date().toISOString();
    this.nodeDialog.close();this.render();this.scheduleSave();this.onToast?.('Tarjeta actualizada');
  }

  onClick(e){
    if(this.suppressClick){this.suppressClick=false;return;}
    if(e.target.closest('.node-connector'))return;
    const nodeEl=e.target.closest('.board-node');
    const edgeEl=e.target.closest('.edge-hit');
    if(this.mode==='connect'&&nodeEl){this.connectNode(nodeEl.dataset.id);return;}
    if(nodeEl){this.selectNode(nodeEl.dataset.id);return;}
    if(edgeEl){this.selectEdge(edgeEl.dataset.id);return;}
    if(e.target===this.root||e.target.id==='boardGrid'||e.target.closest('.board-world'))this.clearSelection();
  }

  selectNode(id){this.selectedNodeId=id;this.selectedEdgeId=null;this.updateSelection();}
  selectEdge(id){this.selectedEdgeId=id;this.selectedNodeId=null;this.updateSelection();}
  clearSelection(){this.selectedNodeId=null;this.selectedEdgeId=null;this.updateSelection();}
  updateSelection(){
    this.nodesLayer.querySelectorAll('.board-node').forEach(el=>{
      const isSelected=el.dataset.id===this.selectedNodeId;
      const isSource=this.mode==='connect'&&el.dataset.id===this.connectSourceId;
      const isDirectSource=this.connectDrag?.sourceId===el.dataset.id;
      const isDirectTarget=this.hoverConnectTargetId===el.dataset.id;
      el.classList.toggle('is-selected',isSelected);
      el.classList.toggle('is-connect-source',isSource||isDirectSource);
      el.classList.toggle('is-connect-target',(this.mode==='connect'&&!!this.connectSourceId&&!isSource)||isDirectTarget);
      el.classList.toggle('is-direct-target',isDirectTarget);
    });
    this.edgesLayer.querySelectorAll('.edge-line').forEach(el=>el.classList.toggle('is-selected',el.dataset.id===this.selectedEdgeId));
  }

  toggleConnect(){
    if(this.mode==='connect')this.cancelConnect();
    else{this.mode='connect';this.connectSourceId=null;this.previewPoint=null;this.connectBtn.classList.add('is-active');this.root.classList.add('is-connecting');this.help.textContent='Modo conexión: selecciona el nodo de origen y después el nodo de destino. ESC cancela.';this.updateSelection();}
  }

  cancelConnect(show=true,redraw=true){this.mode='select';this.connectSourceId=null;this.previewPoint=null;this.connectBtn?.classList.remove('is-active');this.root?.classList.remove('is-connecting','has-connect-source');if(show)this.help.textContent='Arrastra las tarjetas. Arrastra el fondo para desplazarte. Rueda del ratón para zoom. Doble clic para editar.';if(redraw)this.renderEdges();this.updateSelection();}

  connectNode(id){
    if(!this.connectSourceId){this.connectSourceId=id;this.selectNode(id);this.root.classList.add('has-connect-source');this.help.textContent='Ahora selecciona el nodo de destino. Mueve el cursor para previsualizar el vínculo.';this.updateSelection();return;}
    if(this.connectSourceId===id){this.onToast?.('Selecciona un nodo distinto','error');return;}
    const from=this.connectSourceId;this.root.classList.remove('has-connect-source');this.cancelConnect(true,false);this.createEdge(from,id);
  }

  deleteSelected(){
    if(this.selectedNodeId){
      const id=this.selectedNodeId;const el=this.nodesLayer.querySelector(`[data-id="${CSS.escape(id)}"]`);
      const finish=()=>{this.data.nodes=this.data.nodes.filter(n=>n.id!==id);this.data.edges=this.data.edges.filter(e=>e.from!==id&&e.to!==id);this.selectedNodeId=null;this.render();this.scheduleSave();this.onToast?.('Nodo eliminado');};
      if(el&&!matchMedia?.('(prefers-reduced-motion: reduce)').matches){el.classList.add('is-removing');setTimeout(finish,150);}else finish();return;
    }
    if(this.selectedEdgeId){
      const id=this.selectedEdgeId;const group=this.edgesLayer.querySelector(`g[data-id="${CSS.escape(id)}"]`);
      const finish=()=>{this.data.edges=this.data.edges.filter(e=>e.id!==id);this.selectedEdgeId=null;this.renderEdges();this.updateCounts();this.scheduleSave();this.onToast?.('Conexión eliminada');};
      if(group&&!matchMedia?.('(prefers-reduced-motion: reduce)').matches){group.classList.add('is-removing');setTimeout(finish,140);}else finish();return;
    }
    this.onToast?.('Selecciona un nodo o conexión','error');
  }

  onKeyDown(e){
    if(e.key==='Escape'&&this.connectDrag){this.finishDirectConnect(this.connectDrag.sourceId,null);return;}
    if(e.key==='Escape'&&this.mode==='connect'){this.cancelConnect();return;}
    if((e.key==='Delete'||e.key==='Backspace')&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();this.deleteSelected();}
    if(e.key==='Enter'&&this.selectedNodeId&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();this.editNode(this.selectedNodeId);}
  }

  onPointerDown(e){
    if(e.button!==0)return;
    const connector=e.target.closest('.node-connector');
    if(connector){
      const nodeEl=connector.closest('.board-node');
      const node=this.data.nodes.find(n=>n.id===nodeEl?.dataset.id);if(!node)return;
      this.cancelConnect(false,false);
      this.selectNode(node.id);
      this.connectDrag={sourceId:node.id,side:connector.dataset.connectSide||'right',pointerId:e.pointerId};
      this.hoverConnectTargetId=null;
      this.root.classList.add('is-direct-connecting','has-connect-source');
      this.help.textContent='Suelta el hilo encima de otra tarjeta para conectarlas. ESC cancela.';
      this.previewPoint=this.getNodeAnchor(node,this.connectDrag.side);
      this.renderEdges();this.updateSelection();
      connector.setPointerCapture?.(e.pointerId);
      e.preventDefault();e.stopPropagation();return;
    }
    const nodeEl=e.target.closest('.board-node');
    if(nodeEl){
      if(this.mode==='connect')return;
      const node=this.data.nodes.find(n=>n.id===nodeEl.dataset.id);if(!node)return;
      this.selectNode(node.id);nodeEl.setPointerCapture?.(e.pointerId);nodeEl.classList.add('is-dragging');
      this.drag={kind:'node',id:node.id,startX:e.clientX,startY:e.clientY,origX:node.x,origY:node.y,moved:false,el:nodeEl};
      e.preventDefault();return;
    }
    if(e.target.closest('.board-toolbar'))return;
    this.drag={kind:'pan',startX:e.clientX,startY:e.clientY,origX:this.data.viewport.x,origY:this.data.viewport.y,moved:false};
    this.root.classList.add('is-panning');e.preventDefault();
  }

  onPointerMove(e){
    if(this.connectDrag){
      this.updateDirectConnectionPreview(e);
      return;
    }
    if(this.mode==='connect'&&this.connectSourceId)this.updateConnectionPreview(e);
    if(!this.drag)return;const dx=e.clientX-this.drag.startX,dy=e.clientY-this.drag.startY;if(Math.abs(dx)+Math.abs(dy)>3)this.drag.moved=true;
    if(this.drag.kind==='node'){
      const node=this.data.nodes.find(n=>n.id===this.drag.id);if(!node)return;const z=this.data.viewport.zoom;
      node.x=Math.round(this.drag.origX+dx/z);node.y=Math.round(this.drag.origY+dy/z);this.positionNode(node);this.renderEdges();
    }else{
      this.data.viewport.x=this.drag.origX+dx;this.data.viewport.y=this.drag.origY+dy;this.applyViewport();
    }
  }

  onPointerUp(e){
    if(this.connectDrag){
      const sourceId=this.connectDrag.sourceId;
      const sourceSide=this.connectDrag.side;
      const under=document.elementFromPoint(e.clientX,e.clientY);
      const targetId=under?.closest?.('.board-node')?.dataset?.id||this.hoverConnectTargetId;
      this.finishDirectConnect(sourceId,targetId,sourceSide);
      this.suppressClick=true;
      return;
    }
    if(!this.drag)return;const moved=this.drag.moved;this.drag.el?.classList.remove('is-dragging');this.drag=null;this.root.classList.remove('is-panning');if(moved)this.scheduleSave();
  }

  getNodeAnchor(node,side='center'){
    const w=Number(node?.w)||230,h=Number(node?.h)||150;
    if(side==='top')return{x:node.x+w*.25,y:node.y};
    if(side==='right')return{x:node.x+w,y:node.y+h*.5};
    if(side==='bottom')return{x:node.x+w*.75,y:node.y+h};
    if(side==='left')return{x:node.x,y:node.y+h*.5};
    return{x:node.x+w*.5,y:node.y+h*.5};
  }

  edgeSides(a,b){
    const ac=this.getNodeAnchor(a),bc=this.getNodeAnchor(b),dx=bc.x-ac.x,dy=bc.y-ac.y;
    if(Math.abs(dx)>=Math.abs(dy))return dx>=0?['right','left']:['left','right'];
    return dy>=0?['bottom','top']:['top','bottom'];
  }

  edgeEndpoints(a,b){
    const [fromSide,toSide]=this.edgeSides(a,b);
    return [this.getNodeAnchor(a,fromSide),this.getNodeAnchor(b,toSide)];
  }

  updateDirectConnectionPreview(e){
    const source=this.data.nodes.find(n=>n.id===this.connectDrag?.sourceId);if(!source)return;
    const rect=this.root.getBoundingClientRect(),v=this.data.viewport;
    let point={x:(e.clientX-rect.left-v.x)/v.zoom,y:(e.clientY-rect.top-v.y)/v.zoom};
    const under=document.elementFromPoint(e.clientX,e.clientY);
    const targetId=under?.closest?.('.board-node')?.dataset?.id;
    const validTarget=targetId&&targetId!==source.id?targetId:null;
    if(validTarget){const target=this.data.nodes.find(n=>n.id===validTarget);if(target){const [,end]=this.edgeEndpoints(source,target);point=end;}}
    if(this.hoverConnectTargetId!==validTarget){this.hoverConnectTargetId=validTarget;this.updateSelection();}
    this.previewPoint=point;
    let line=this.edgesLayer.querySelector('.edge-preview');
    if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('class','edge-preview');line.setAttribute('pathLength','1');this.edgesLayer.append(line);}
    const start=this.getNodeAnchor(source,this.connectDrag.side);
    line.setAttribute('x1',start.x);line.setAttribute('y1',start.y);line.setAttribute('x2',point.x);line.setAttribute('y2',point.y);
  }

  finishDirectConnect(sourceId,targetId,sourceSide='right'){
    this.connectDrag=null;this.previewPoint=null;this.hoverConnectTargetId=null;
    this.root.classList.remove('is-direct-connecting','has-connect-source');
    this.help.textContent='Arrastra una tarjeta para moverla. Arrastra un punto rojo hasta otra tarjeta para unirlas. Clic en un hilo + Supr para eliminar.';
    if(!targetId||targetId===sourceId){this.renderEdges();this.updateSelection();return;}
    const source=this.data.nodes.find(n=>n.id===sourceId),target=this.data.nodes.find(n=>n.id===targetId);
    let targetSide='left';
    if(source&&target){const [autoFrom,autoTo]=this.edgeSides(source,target);targetSide=autoTo;}
    this.createEdge(sourceId,targetId,{fromSide:sourceSide,toSide:targetSide});
  }

  createEdge(from,to,anchors={}){
    if(!from||!to||from===to)return false;
    const exists=this.data.edges.some(e=>(e.from===from&&e.to===to)||(e.from===to&&e.to===from));
    if(exists){this.onToast?.('Esas tarjetas ya están conectadas','error');this.renderEdges();this.updateSelection();return false;}
    const edgeId=uid();this.data.edges.push({id:edgeId,from,to,label:'',fromSide:anchors.fromSide||'',toSide:anchors.toSide||'',createdAt:new Date().toISOString()});
    this.newEdgeId=edgeId;this.selectedEdgeId=edgeId;this.selectedNodeId=null;this.renderEdges();this.updateCounts();this.scheduleSave();this.onToast?.('Conexión creada');
    const edgeEl=this.edgesLayer.querySelector(`.edge-line[data-id="${CSS.escape(edgeId)}"]`);if(edgeEl)setTimeout(()=>edgeEl.classList.remove('is-new'),420);
    this.newEdgeId=null;return true;
  }

  onWheel(e){
    e.preventDefault();const rect=this.root.getBoundingClientRect();const old=this.data.viewport.zoom;const next=clamp(old*(e.deltaY<0?1.1:.9),.25,2.5);if(next===old)return;
    const px=e.clientX-rect.left,py=e.clientY-rect.top;const wx=(px-this.data.viewport.x)/old,wy=(py-this.data.viewport.y)/old;
    this.data.viewport.zoom=next;this.data.viewport.x=px-wx*next;this.data.viewport.y=py-wy*next;this.applyViewport();this.scheduleSave();
  }

  setZoom(next){
    const rect=this.root.getBoundingClientRect();const old=this.data.viewport.zoom;next=clamp(next,.25,2.5);const px=rect.width/2,py=rect.height/2;const wx=(px-this.data.viewport.x)/old,wy=(py-this.data.viewport.y)/old;
    this.animateViewport(()=>{this.data.viewport.zoom=next;this.data.viewport.x=px-wx*next;this.data.viewport.y=py-wy*next;this.applyViewport();});this.scheduleSave();
  }

  fitNodes(){
    if(!this.data.nodes.length){this.data.viewport={x:0,y:0,zoom:1};this.applyViewport();this.scheduleSave();return;}
    const rect=this.root.getBoundingClientRect();const pad=80;
    const minX=Math.min(...this.data.nodes.map(n=>n.x)),minY=Math.min(...this.data.nodes.map(n=>n.y));
    const maxX=Math.max(...this.data.nodes.map(n=>n.x+(n.w||230))),maxY=Math.max(...this.data.nodes.map(n=>n.y+(n.h||150)));
    const contentW=Math.max(1,maxX-minX),contentH=Math.max(1,maxY-minY);const zoom=clamp(Math.min((rect.width-pad*2)/contentW,(rect.height-pad*2)/contentH,1.35),.25,2.5);
    this.animateViewport(()=>{this.data.viewport.zoom=zoom;this.data.viewport.x=(rect.width-contentW*zoom)/2-minX*zoom;this.data.viewport.y=(rect.height-contentH*zoom)/2-minY*zoom;this.applyViewport();});this.scheduleSave();
  }

  animateViewport(fn){
    clearTimeout(this.zoomTimer);this.root.classList.add('is-zooming');fn();this.zoomTimer=setTimeout(()=>this.root.classList.remove('is-zooming'),190);
  }

  updateConnectionPreview(e){
    const rect=this.root.getBoundingClientRect(),v=this.data.viewport;
    this.previewPoint={x:(e.clientX-rect.left-v.x)/v.zoom,y:(e.clientY-rect.top-v.y)/v.zoom};
    const source=this.data.nodes.find(n=>n.id===this.connectSourceId);if(!source)return;
    let line=this.edgesLayer.querySelector('.edge-preview');
    if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('class','edge-preview');line.setAttribute('pathLength','1');this.edgesLayer.append(line);}
    line.setAttribute('x1',source.x+(source.w||230)/2);line.setAttribute('y1',source.y+(source.h||150)/2);
    line.setAttribute('x2',this.previewPoint.x);line.setAttribute('y2',this.previewPoint.y);
  }

  render(){
    this.nodesLayer.innerHTML=this.data.nodes.map(n=>this.nodeHtml(n)).join('');
    this.data.nodes.forEach(n=>this.positionNode(n));
    this.applyViewport();this.renderEdges();this.updateCounts();this.updateSelection();this.empty.classList.toggle('is-visible',this.data.nodes.length===0);
  }

  nodeHtml(n){
    const meta=TYPE_META[n.type]||TYPE_META.note;
    const imageSrc=safeImageDataUrl(n.image);const image=imageSrc?`<div class="node-photo"><img src="${escapeHtml(imageSrc)}" alt=""></div>`:'';
    return `<article class="board-node type-${escapeHtml(n.type)}${n.linkedRecord?' is-linked':''}${n.id===this.newNodeId?' is-new':''}" data-id="${escapeHtml(n.id)}" style="width:${Number(n.w)||230}px;min-height:${Number(n.h)||150}px" tabindex="0">
      <div class="node-pin" aria-hidden="true"></div>
      <span class="node-connector connector-top" data-connect-side="top" title="Arrastra para conectar" aria-hidden="true"></span>
      <span class="node-connector connector-right" data-connect-side="right" title="Arrastra para conectar" aria-hidden="true"></span>
      <span class="node-connector connector-bottom" data-connect-side="bottom" title="Arrastra para conectar" aria-hidden="true"></span>
      <span class="node-connector connector-left" data-connect-side="left" title="Arrastra para conectar" aria-hidden="true"></span>
      <header><span class="node-type">${meta.symbol} ${meta.label}</span><span class="node-ref">${n.linkedRecord?'<span class="node-link">↗</span> ':''}${escapeHtml(n.meta||'')}</span></header>
      ${image}<h3>${escapeHtml(n.title||'Sin título')}</h3>${n.text?`<p>${escapeHtml(n.text)}</p>`:''}
      <footer>${escapeHtml(String(n.id||'').slice(0,8).toUpperCase())}</footer>
    </article>`;
  }

  positionNode(node){const el=this.nodesLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`);if(el){el.style.transform=`translate(${node.x}px,${node.y}px)`;}}

  applyViewport(){
    const {x,y,zoom}=this.data.viewport;this.world.style.transform=`translate(${x}px,${y}px) scale(${zoom})`;this.zoomLabel.textContent=`${Math.round(zoom*100)}%`;
    const grid=this.root.querySelector('#boardGrid');if(grid){grid.style.backgroundPosition=`${x}px ${y}px`;grid.style.backgroundSize=`${32*zoom}px ${32*zoom}px`;}
  }

  renderEdges(){
    const nodeMap=new Map(this.data.nodes.map(n=>[n.id,n]));
    const lines=[];
    for(const edge of this.data.edges){
      const a=nodeMap.get(edge.from),b=nodeMap.get(edge.to);if(!a||!b)continue;
      const [p1,p2]=edge.fromSide&&edge.toSide?[this.getNodeAnchor(a,edge.fromSide),this.getNodeAnchor(b,edge.toSide)]:this.edgeEndpoints(a,b),x1=p1.x,y1=p1.y,x2=p2.x,y2=p2.y;
      lines.push(`<g data-id="${escapeHtml(edge.id)}"><line pathLength="1" class="edge-line${edge.id===this.newEdgeId?' is-new':''}" data-id="${escapeHtml(edge.id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="edge-hit" data-id="${escapeHtml(edge.id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`);
    }
    if(this.connectDrag&&this.previewPoint){const a=nodeMap.get(this.connectDrag.sourceId);if(a){const p=this.getNodeAnchor(a,this.connectDrag.side);lines.push(`<line pathLength="1" class="edge-preview" x1="${p.x}" y1="${p.y}" x2="${this.previewPoint.x}" y2="${this.previewPoint.y}"/>`);}}
    if(this.mode==='connect'&&this.connectSourceId&&this.previewPoint){const a=nodeMap.get(this.connectSourceId);if(a){const x1=a.x+(a.w||230)/2,y1=a.y+(a.h||150)/2;lines.push(`<line pathLength="1" class="edge-preview" x1="${x1}" y1="${y1}" x2="${this.previewPoint.x}" y2="${this.previewPoint.y}"/>`);}}
    this.edgesLayer.innerHTML=lines.join('');this.updateSelection();
  }

  updateCounts(){
    $('#boardNodeCount').textContent=this.data.nodes.length;$('#boardEdgeCount').textContent=this.data.edges.length;
  }
}


Object.assign(window.CASE404,{EvidenceBoard});
})();

/* --- investigation.js --- */
(()=>{
"use strict";
const {$,uid,escapeHtml,safePortableDataUrl}=window.CASE404;
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

class InvestigationDB{
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

Object.assign(window.CASE404,{InvestigationDB});
})();

/* --- timeline.js --- */
(()=>{
"use strict";
const {$,escapeHtml}=window.CASE404;
const CERTAINTY_LABELS={confirmed:'Confirmado',probable:'Probable',claimed:'Declarado',unknown:'Desconocido'};
const HOUR=3600000, DAY=24*HOUR;
const toMs=v=>{if(!v)return NaN;const n=new Date(v).getTime();return Number.isFinite(n)?n:NaN;};
const fmtDateTime=v=>{const n=toMs(v);if(!Number.isFinite(n))return 'Sin fecha';return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(n));};
const fmtTick=ms=>new Intl.DateTimeFormat('es-ES',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const fmtDuration=ms=>{if(ms<=0)return 'instante';const m=Math.round(ms/60000);if(m<60)return `${m} min`;const h=m/60;if(h<24)return `${h<10?h.toFixed(1):Math.round(h)} h`;const d=h/24;return `${d<10?d.toFixed(1):Math.round(d)} d`;};
const subjectsOf=r=>[...new Set(String(r.subjects||'').split(/[,;\n]+/).map(s=>s.trim().toLowerCase()).filter(Boolean))];
const shared=(a,b)=>{const sb=new Set(subjectsOf(b));return subjectsOf(a).filter(x=>sb.has(x));};
const certaintyRank={confirmed:0,probable:1,claimed:2,unknown:3};

class Timeline404{
  constructor({onEditEvent,onToast}){
    this.onEditEvent=onEditEvent;this.onToast=onToast;this.events=[];this.zoom=1;this.query='';this.certainty='all';this.gapHours=1;
    this.canvas=$('#timelineCanvas');this.scroll=$('#timelineScroll');this.empty=$('#timelineEmpty');this.alerts=$('#timelineAlerts');
    this.bind();
  }
  bind(){
    $('#timelineSearch').addEventListener('input',e=>{this.query=e.target.value.trim().toLowerCase();this.render();});
    $('#timelineCertainty').addEventListener('change',e=>{this.certainty=e.target.value;this.render();});
    $('#timelineGap').addEventListener('change',e=>{this.gapHours=Number(e.target.value)||1;this.render();});
    $('#timelineZoomOut').addEventListener('click',()=>this.setZoom(this.zoom-.25));
    $('#timelineZoomIn').addEventListener('click',()=>this.setZoom(this.zoom+.25));
    $('#timelineZoomReset').addEventListener('click',()=>this.setZoom(1));
    $('#timelineFit').addEventListener('click',()=>{this.setZoom(.75);this.scroll.scrollLeft=0;});
    $('#timelineAddEvent').addEventListener('click',()=>this.onEditEvent?.(null));
    this.canvas.addEventListener('click',e=>{const card=e.target.closest('[data-timeline-event]');if(card)this.onEditEvent?.(card.dataset.timelineEvent);});
    this.alerts.addEventListener('click',e=>{const b=e.target.closest('[data-alert-event]');if(b)this.onEditEvent?.(b.dataset.alertEvent);});
    window.addEventListener('resize',()=>this.render());
  }
  setZoom(v){this.zoom=Math.min(2.5,Math.max(.5,Math.round(v*4)/4));$('#timelineZoomReset').textContent=`${Math.round(this.zoom*100)}%`;this.render();}
  load(modules={}){this.events=Array.isArray(modules.events)?structuredClone(modules.events):[];this.render();}
  filtered(){
    const q=this.query;return this.events.filter(r=>{
      if(this.certainty!=='all'&&(r.certainty||'unknown')!==this.certainty)return false;
      if(!q)return true;return [r.ref,r.title,r.place,r.subjects,r.source,r.description,(r.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>(toMs(a.startAt)||Infinity)-(toMs(b.startAt)||Infinity)||((certaintyRank[a.certainty]??9)-(certaintyRank[b.certainty]??9)));
  }
  analyse(rows){
    const dated=rows.filter(r=>Number.isFinite(toMs(r.startAt)));
    const alerts=[];let concurrent=0;
    for(const r of dated){const s=toMs(r.startAt),e=Number.isFinite(toMs(r.endAt))?toMs(r.endAt):s;if(e<s)alerts.push({level:'critical',eventId:r.id,title:`${r.ref} termina antes de empezar`,detail:`${fmtDateTime(r.startAt)} → ${fmtDateTime(r.endAt)}`});}
    for(let i=0;i<dated.length;i++)for(let j=i+1;j<dated.length;j++){
      const a=dated[i],b=dated[j],as=toMs(a.startAt),ae=Math.max(as,Number.isFinite(toMs(a.endAt))?toMs(a.endAt):as),bs=toMs(b.startAt),be=Math.max(bs,Number.isFinite(toMs(b.endAt))?toMs(b.endAt):bs);
      if(bs>ae&&be>ae)break;
      if(Math.max(as,bs)<=Math.min(ae,be)){
        concurrent++;
        const common=shared(a,b),pa=String(a.place||'').trim().toLowerCase(),pb=String(b.place||'').trim().toLowerCase();
        if(common.length&&pa&&pb&&pa!==pb)alerts.push({level:'warn',eventId:a.id,title:'Posible conflicto espacio-temporal',detail:`${common.join(', ')} figura en ${a.ref} (${a.place}) y ${b.ref} (${b.place}) durante intervalos solapados.`});
      }
    }
    const intervals=dated.map(r=>{const s=toMs(r.startAt),raw=toMs(r.endAt);return {s,e:Number.isFinite(raw)?Math.max(s,raw):s};}).sort((a,b)=>a.s-b.s);
    const gaps=[];if(intervals.length){let end=intervals[0].e;for(let i=1;i<intervals.length;i++){const x=intervals[i];if(x.s>end){const gap=x.s-end;if(gap>=this.gapHours*HOUR)gaps.push({start:end,end:x.s,duration:gap});end=Math.max(end,x.e);}else end=Math.max(end,x.e);}}
    return {dated,alerts,gaps,concurrent};
  }
  render(){
    const rows=this.filtered(),analysis=this.analyse(rows);$('#timelineEventCount').textContent=rows.length;$('#timelineDatedCount').textContent=analysis.dated.length;$('#timelineGapCount').textContent=analysis.gaps.length;$('#timelineAlertCount').textContent=analysis.alerts.length;
    this.renderAlerts(analysis.alerts);this.empty.classList.toggle('is-visible',analysis.dated.length===0);
    if(!analysis.dated.length){this.canvas.innerHTML='';return;}
    const starts=analysis.dated.map(r=>toMs(r.startAt)),ends=analysis.dated.map(r=>Math.max(toMs(r.startAt),Number.isFinite(toMs(r.endAt))?toMs(r.endAt):toMs(r.startAt)));
    let min=Math.min(...starts),max=Math.max(...ends);if(max<=min)max=min+HOUR;
    const span=max-min;const pad=Math.max(span*.04,15*60000);min-=pad;max+=pad;const domain=max-min;
    const spanHours=domain/HOUR;let pxPerHour=spanHours<=24?95:spanHours<=168?34:spanHours<=720?12:Math.max(.8,4500/spanHours);pxPerHour*=this.zoom;
    const width=Math.min(7200,Math.max(1050,spanHours*pxPerHour+180)),usable=width-100;
    const mapped=analysis.dated.map(r=>{const s=toMs(r.startAt),raw=toMs(r.endAt),e=Number.isFinite(raw)?Math.max(s,raw):s;return {r,s,e,left:50+((s-min)/domain)*usable,right:50+((e-min)/domain)*usable};});
    const lanes=[];for(const item of mapped){const visualEnd=Math.max(item.right,item.left+210);let lane=lanes.findIndex(end=>item.left>end+18);if(lane<0){lane=lanes.length;lanes.push(visualEnd);}else lanes[lane]=visualEnd;item.lane=lane;item.cardWidth=Math.max(190,Math.min(360,Math.max(item.right-item.left,190)));}
    const h=120+Math.max(1,lanes.length)*132;
    const ticks=10,tickHtml=Array.from({length:ticks+1},(_,i)=>{const p=i/ticks,ms=min+p*domain,x=50+p*usable;return `<div class="tl-tick" style="left:${x}px"><span>${escapeHtml(fmtTick(ms))}</span></div>`;}).join('');
    const gapHtml=analysis.gaps.map(g=>{const l=50+((g.start-min)/domain)*usable,r=50+((g.end-min)/domain)*usable,w=Math.max(3,r-l);return `<div class="tl-gap" style="left:${l}px;width:${w}px"><span>${w>80?`HUECO · ${fmtDuration(g.duration)}`:''}</span></div>`;}).join('');
    const eventHtml=mapped.map(({r,s,e,left,lane,cardWidth})=>{const dur=e-s,subjects=String(r.subjects||'').trim(),rawCertainty=String(r.certainty||'unknown'),certainty=Object.hasOwn(CERTAINTY_LABELS,rawCertainty)?rawCertainty:'unknown';return `<button class="tl-event certainty-${certainty}" data-timeline-event="${escapeHtml(r.id)}" style="left:${left}px;top:${76+lane*132}px;width:${cardWidth}px" title="Editar ${escapeHtml(r.ref)}"><span class="tl-event-ref">${escapeHtml(r.ref||'EV')}</span><strong>${escapeHtml(r.title||'Evento')}</strong><span class="tl-event-time">${escapeHtml(fmtDateTime(r.startAt))}${dur>0?` · ${escapeHtml(fmtDuration(dur))}`:''}</span>${r.place?`<span>⌖ ${escapeHtml(r.place)}</span>`:''}${subjects?`<span>● ${escapeHtml(subjects)}</span>`:''}<i>${escapeHtml(CERTAINTY_LABELS[certainty]||certainty)}</i></button>`;}).join('');
    this.canvas.style.width=`${width}px`;this.canvas.style.height=`${h}px`;this.canvas.innerHTML=`<div class="tl-axis"></div>${tickHtml}<div class="tl-gap-layer">${gapHtml}</div><div class="tl-event-layer">${eventHtml}</div>`;
  }
  renderAlerts(alerts){
    if(!alerts.length){this.alerts.innerHTML='<div class="tl-alert-empty">✓ Sin conflictos temporales detectados con los datos actuales.</div>';return;}
    this.alerts.innerHTML=alerts.slice(0,20).map(a=>`<button class="tl-alert ${a.level==='critical'?'is-critical':''}" data-alert-event="${escapeHtml(a.eventId)}"><span>${a.level==='critical'?'!':'⚠'}</span><div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.detail)}</small></div></button>`).join('')+(alerts.length>20?`<div class="tl-alert-more">+ ${alerts.length-20} alertas adicionales</div>`:'');
  }
}

Object.assign(window.CASE404,{Timeline404});
})();

/* --- theory.js --- */
(()=>{
"use strict";
const {$,uid,escapeHtml}=window.CASE404;
const KIND_META={
  people:{label:'Personas',symbol:'●'},places:{label:'Lugares',symbol:'⌖'},evidence:{label:'Evidencias',symbol:'◆'},events:{label:'Eventos',symbol:'◷'},documents:{label:'Documentos',symbol:'▧'}
};
const STATUS_LABELS={active:'Activa',alternative:'Alternativa',weakened:'Debilitada',discarded:'Descartada'};
const titleOf=(kind,r)=>kind==='people'||kind==='places'?r?.name:r?.title;
const lines=v=>[...new Set(String(v||'').split(/\n+/).map(x=>x.trim()).filter(Boolean))].slice(0,40);
const tags=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,16);
const weight=n=>Math.max(1,Math.min(3,Number(n)||1));

class TheoryEngine{
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

Object.assign(window.CASE404,{TheoryEngine});
})();

/* --- graph.js --- */
(()=>{
"use strict";
const {$,escapeHtml}=window.CASE404;
const GRAPH_KIND_META={
  people:{label:'Personas',symbol:'●'},places:{label:'Lugares',symbol:'⌖'},evidence:{label:'Evidencias',symbol:'◆'},events:{label:'Eventos',symbol:'◷'},documents:{label:'Documentos',symbol:'▧'},theories:{label:'Teorías',symbol:'△'}
};
const EDGE_META={
  board:{label:'Tablero',symbol:'⌁'},theory_support:{label:'Apoya',symbol:'＋'},theory_against:{label:'Contradice',symbol:'−'},event_subject:{label:'Participa',symbol:'●'},event_place:{label:'Ocurre en',symbol:'⌖'},reference:{label:'Referencia',symbol:'↗'},tag:{label:'Etiqueta común',symbol:'#'}
};
const kinds=Object.keys(GRAPH_KIND_META);
const key=(kind,id)=>`${kind}|${id}`;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const titleOf=(kind,r)=>kind==='people'||kind==='places'?r.name:(r.title||r.ref||'Sin título');
const truncate=(v,n=23)=>String(v||'').length>n?`${String(v).slice(0,n-1)}…`:String(v||'');
const escRegExp=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function safeText(value){
  if(value==null)return '';
  if(typeof value==='string'||typeof value==='number')return String(value);
  if(Array.isArray(value))return value.map(safeText).join(' ');
  if(typeof value==='object')return Object.entries(value).filter(([k])=>!['attachment','data','createdAt','updatedAt','id'].includes(k)).map(([,v])=>safeText(v)).join(' ');
  return '';
}
function addEdge(edges,seen,from,to,type,label='',meta={}){
  if(!from||!to||from===to)return;
  const undirected=['board','tag'].includes(type);
  const pair=undirected?[from,to].sort().join('~'):`${from}>${to}`;
  const sig=`${type}|${pair}|${label}`;
  if(seen.has(sig))return;
  seen.add(sig);edges.push({id:`g-${edges.length+1}`,from,to,type,label:label||EDGE_META[type]?.label||type,...meta});
}
function buildIndexes(nodes){
  const byKey=new Map(nodes.map(n=>[n.key,n]));
  const byRef=new Map();const peopleNames=new Map();const placeNames=new Map();
  for(const n of nodes){
    if(n.ref)byRef.set(String(n.ref).toUpperCase(),n.key);
    if(n.kind==='people'){
      const names=[n.record.name,...String(n.record.aliases||'').split(',')].map(norm).filter(Boolean);for(const name of names)if(!peopleNames.has(name))peopleNames.set(name,n.key);
    }
    if(n.kind==='places'){
      const names=[n.record.name,n.record.location].map(norm).filter(Boolean);for(const name of names)if(!placeNames.has(name))placeNames.set(name,n.key);
    }
  }
  return {byKey,byRef,peopleNames,placeNames};
}
function matchNamed(map,value){
  const n=norm(value);if(!n)return null;if(map.has(n))return map.get(n);
  for(const [name,k] of map){if(name.length>=4&&(n.startsWith(name+',')||n.startsWith(name+' - ')||n===name))return k;}
  return null;
}

function buildGraph(modules={},options={}){
  const includeTags=!!options.includeTags;
  const nodes=[];
  for(const kind of kinds){
    const list=kind==='theories'?(modules.theories||[]):(modules[kind]||[]);
    for(const r of list){if(!r?.id)continue;nodes.push({key:key(kind,r.id),kind,id:r.id,ref:r.ref||'',title:titleOf(kind,r),tags:Array.isArray(r.tags)?r.tags:[],record:r});}
  }
  const indexes=buildIndexes(nodes),edges=[],seen=new Set();

  // Manual Evidence Board links between structured records.
  const boardNodes=new Map((modules.board?.nodes||[]).filter(n=>n.linkedRecord?.kind&&n.linkedRecord?.id).map(n=>[n.id,key(n.linkedRecord.kind,n.linkedRecord.id)]));
  for(const e of modules.board?.edges||[]){const a=boardNodes.get(e.from),b=boardNodes.get(e.to);if(indexes.byKey.has(a)&&indexes.byKey.has(b))addEdge(edges,seen,a,b,'board',e.label||'Tablero');}

  // Theory classification links.
  for(const t of modules.theories||[]){const from=key('theories',t.id);for(const l of t.supports||[]){const to=key(l.kind,l.id);if(indexes.byKey.has(to))addEdge(edges,seen,from,to,'theory_support','Apoya',{weight:Number(l.weight)||1});}for(const l of t.contradicts||[]){const to=key(l.kind,l.id);if(indexes.byKey.has(to))addEdge(edges,seen,from,to,'theory_against','Contradice',{weight:Number(l.weight)||1});}}

  // Event subjects and places, matched against structured names/aliases.
  for(const ev of modules.events||[]){const from=key('events',ev.id);const subjects=String(ev.subjects||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);for(const subject of subjects){const to=matchNamed(indexes.peopleNames,subject);if(to)addEdge(edges,seen,from,to,'event_subject','Participa');}const place=matchNamed(indexes.placeNames,ev.place);if(place)addEdge(edges,seen,from,place,'event_place','Ocurre en');}

  // Explicit CASE references typed into record fields (P-001, E-004, T-002...).
  const refs=[...indexes.byRef.keys()].sort((a,b)=>b.length-a.length);
  if(refs.length){const pattern=new RegExp(`(^|[^A-Z0-9])(${refs.map(escRegExp).join('|')})(?=$|[^A-Z0-9])`,'gi');for(const n of nodes){const text=safeText(n.record);pattern.lastIndex=0;let m;while((m=pattern.exec(text))){const to=indexes.byRef.get(String(m[2]).toUpperCase());if(to&&to!==n.key)addEdge(edges,seen,n.key,to,'reference',`Ref. ${String(m[2]).toUpperCase()}`);if(pattern.lastIndex===m.index)pattern.lastIndex++;}}}

  // Optional weak inference: shared user tags.
  if(includeTags){const tagMap=new Map();for(const n of nodes){for(const raw of n.tags){const t=norm(raw);if(t.length<3)continue;if(!tagMap.has(t))tagMap.set(t,[]);tagMap.get(t).push(n.key);}}for(const [tag,keys] of tagMap){const unique=[...new Set(keys)].slice(0,20);for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++)addEdge(edges,seen,unique[i],unique[j],'tag',`#${tag}`);}}

  return {nodes,edges,indexes};
}

function shortestPath(graph,from,to,allowedEdges=null,allowedNodes=null){
  if(!from||!to||from===to)return null;
  const nodeSet=allowedNodes?new Set(allowedNodes):new Set(graph.nodes.map(n=>n.key));if(!nodeSet.has(from)||!nodeSet.has(to))return null;
  const edgeSet=allowedEdges?new Set(allowedEdges):null,adj=new Map([...nodeSet].map(k=>[k,[]]));
  for(const e of graph.edges){if(edgeSet&&!edgeSet.has(e.id))continue;if(!nodeSet.has(e.from)||!nodeSet.has(e.to))continue;adj.get(e.from).push({to:e.to,edge:e});adj.get(e.to).push({to:e.from,edge:e});}
  const q=[from],prev=new Map([[from,null]]),via=new Map();
  while(q.length){const cur=q.shift();if(cur===to)break;for(const step of adj.get(cur)||[]){if(prev.has(step.to))continue;prev.set(step.to,cur);via.set(step.to,step.edge);q.push(step.to);}}
  if(!prev.has(to))return null;const nodes=[];const edges=[];let cur=to;while(cur){nodes.push(cur);const e=via.get(cur);if(e)edges.push(e.id);cur=prev.get(cur);}return {nodes:nodes.reverse(),edges:edges.reverse(),hops:edges.length};
}

function suggestIndirectPath(graph,allowedEdges=null,allowedNodes=null){
  const nodes=allowedNodes||graph.nodes.map(n=>n.key);const edgeSet=allowedEdges?new Set(allowedEdges):null;const direct=new Set();
  for(const e of graph.edges){if(edgeSet&&!edgeSet.has(e.id))continue;direct.add([e.from,e.to].sort().join('~'));}
  let best=null;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    if(direct.has([nodes[i],nodes[j]].sort().join('~')))continue;const p=shortestPath(graph,nodes[i],nodes[j],allowedEdges,nodes);if(!p||p.hops<2||p.hops>4)continue;if(!best||p.hops<best.hops)best=p;if(best?.hops===2)return best;
  }
  return best;
}

function positionsFor(nodes){
  const anchors={people:[180,150],places:[600,120],evidence:[1020,150],events:[190,560],documents:[600,600],theories:[1010,560]},out=new Map();
  for(const kind of kinds){const group=nodes.filter(n=>n.kind===kind),[ax,ay]=anchors[kind];const cols=Math.max(1,Math.ceil(Math.sqrt(group.length)));group.forEach((n,i)=>{const col=i%cols,row=Math.floor(i/cols),dx=(col-(Math.min(cols,group.length)-1)/2)*170,dy=(row-(Math.ceil(group.length/cols)-1)/2)*88;out.set(n.key,{x:ax+dx,y:ay+dy});});}
  return out;
}

class ConnectionGraph{
  constructor({root,onToast,onOpenRecord,onOpenTheory}){
    this.root=root;this.onToast=onToast;this.onOpenRecord=onOpenRecord;this.onOpenTheory=onOpenTheory;this.modules={};this.graph={nodes:[],edges:[]};this.includeTags=false;this.query='';this.kindFilter=new Set(kinds);this.edgeType='all';this.view={x:0,y:0,zoom:1};this.path=null;this.selected=null;this.pan=null;
    this.svg=$('#graphSvg');this.world=$('#graphWorld');this.edgeLayer=$('#graphEdges');this.nodeLayer=$('#graphNodes');this.pathBox=$('#graphPathResult');this.bind();
  }
  bind(){
    $('#graphSearch').addEventListener('input',e=>{this.query=e.target.value.trim().toLowerCase();this.render();});
    $('#graphRelationFilter').addEventListener('change',e=>{this.edgeType=e.target.value;this.path=null;this.render();});
    $('#graphTagLinks').addEventListener('change',e=>{this.includeTags=e.target.checked;this.rebuild();});
    $('#graphKindFilters').addEventListener('change',e=>{const cb=e.target.closest('input[data-graph-kind]');if(!cb)return;cb.checked?this.kindFilter.add(cb.dataset.graphKind):this.kindFilter.delete(cb.dataset.graphKind);this.path=null;this.render();});
    $('#graphZoomIn').addEventListener('click',()=>this.setZoom(this.view.zoom*1.18));$('#graphZoomOut').addEventListener('click',()=>this.setZoom(this.view.zoom/1.18));$('#graphZoomReset').addEventListener('click',()=>{this.view={x:0,y:0,zoom:1};this.applyView();});$('#graphFit').addEventListener('click',()=>this.fit());
    $('#graphFindPath').addEventListener('click',()=>this.findPath());$('#graphSuggestPath').addEventListener('click',()=>this.suggestPath());$('#graphClearPath').addEventListener('click',()=>{this.path=null;this.render();});
    this.svg.addEventListener('click',e=>this.handleClick(e));this.pathBox.addEventListener('click',e=>this.handleClick(e));this.svg.addEventListener('dblclick',e=>this.handleDoubleClick(e));this.svg.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.view.zoom*(e.deltaY<0?1.1:.9));},{passive:false});
    this.svg.addEventListener('pointerdown',e=>{if(e.target.closest?.('.graph-node'))return;this.pan={x:e.clientX,y:e.clientY,ox:this.view.x,oy:this.view.y};this.svg.setPointerCapture?.(e.pointerId);});
    this.svg.addEventListener('pointermove',e=>{if(!this.pan)return;this.view.x=this.pan.ox+(e.clientX-this.pan.x);this.view.y=this.pan.oy+(e.clientY-this.pan.y);this.applyView();});
    this.svg.addEventListener('pointerup',()=>this.pan=null);this.svg.addEventListener('pointercancel',()=>this.pan=null);
  }
  load(modules={}){this.modules=structuredClone(modules);this.path=null;this.selected=null;this.rebuild();}
  rebuild(){this.graph=buildGraph(this.modules,{includeTags:this.includeTags});this.populateSelectors();this.render();}
  visibleNodes(){return this.graph.nodes.filter(n=>this.kindFilter.has(n.kind)&&(!this.query||[n.ref,n.title,n.kind,(n.tags||[]).join(' ')].join(' ').toLowerCase().includes(this.query)));}
  visibleData(){const nodes=this.visibleNodes(),set=new Set(nodes.map(n=>n.key));const edges=this.graph.edges.filter(e=>set.has(e.from)&&set.has(e.to)&&(this.edgeType==='all'||e.type===this.edgeType));return {nodes,edges,set};}
  populateSelectors(){const options=this.graph.nodes.map(n=>`<option value="${escapeHtml(n.key)}">${escapeHtml(n.ref||GRAPH_KIND_META[n.kind].symbol)} — ${escapeHtml(n.title)}</option>`).join('');const keepA=$('#graphPathFrom').value,keepB=$('#graphPathTo').value;$('#graphPathFrom').innerHTML=`<option value="">Origen…</option>${options}`;$('#graphPathTo').innerHTML=`<option value="">Destino…</option>${options}`;if(this.graph.nodes.some(n=>n.key===keepA))$('#graphPathFrom').value=keepA;if(this.graph.nodes.some(n=>n.key===keepB))$('#graphPathTo').value=keepB;}
  render(){
    const {nodes,edges,set}=this.visibleData(),pos=positionsFor(nodes),pathNodes=new Set(this.path?.nodes||[]),pathEdges=new Set(this.path?.edges||[]);
    $('#graphNodeCount').textContent=nodes.length;$('#graphEdgeCount').textContent=edges.length;$('#graphComponentCount').textContent=this.componentCount(nodes,edges);$('#graphIndirectCount').textContent=this.countIndirectCandidates(nodes,edges);
    this.edgeLayer.innerHTML=edges.map(e=>{const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)return '';const cls=pathEdges.has(e.id)?' is-path':'';return `<g class="graph-edge type-${escapeHtml(e.type)}${cls}" data-edge-id="${escapeHtml(e.id)}"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><title>${escapeHtml(EDGE_META[e.type]?.label||e.type)} · ${escapeHtml(e.label||'')}</title></g>`;}).join('');
    this.nodeLayer.innerHTML=nodes.map(n=>{const p=pos.get(n.key),active=this.selected===n.key?' is-selected':'',inPath=pathNodes.has(n.key)?' is-path':'';return `<g class="graph-node kind-${n.kind}${active}${inPath}" data-node-key="${escapeHtml(n.key)}" transform="translate(${p.x-75} ${p.y-28})" tabindex="0"><rect width="150" height="56" rx="10"/><text class="graph-node-ref" x="12" y="18">${escapeHtml(n.ref||GRAPH_KIND_META[n.kind].label.toUpperCase())}</text><text class="graph-node-title" x="12" y="38">${escapeHtml(truncate(n.title))}</text><title>${escapeHtml(GRAPH_KIND_META[n.kind].label)} · ${escapeHtml(n.ref)} · ${escapeHtml(n.title)}</title></g>`;}).join('');
    $('#graphEmpty').classList.toggle('is-visible',nodes.length===0);this.renderPath();this.applyView();
  }
  renderPath(){
    if(!this.path){this.pathBox.innerHTML='<span>Selecciona dos nodos o pide una sugerencia para buscar la ruta más corta.</span>';return;}
    const byKey=new Map(this.graph.nodes.map(n=>[n.key,n]));const byId=new Map(this.graph.edges.map(e=>[e.id,e]));const parts=[];for(let i=0;i<this.path.nodes.length;i++){const n=byKey.get(this.path.nodes[i]);if(!n)continue;parts.push(`<button data-path-node="${escapeHtml(n.key)}"><b>${escapeHtml(n.ref||GRAPH_KIND_META[n.kind].symbol)}</b> ${escapeHtml(n.title)}</button>`);if(i<this.path.edges.length){const e=byId.get(this.path.edges[i]);parts.push(`<i>→ ${escapeHtml(EDGE_META[e?.type]?.label||e?.label||'relación')} →</i>`);}}
    this.pathBox.innerHTML=`<div class="graph-path-chain">${parts.join('')}</div><small>${this.path.hops===1?'Conexión directa':`Ruta indirecta de ${this.path.hops} saltos`} · se usan solo nodos y relaciones visibles.</small>`;
  }
  componentCount(nodes,edges){const set=new Set(nodes.map(n=>n.key)),adj=new Map(nodes.map(n=>[n.key,[]]));for(const e of edges){adj.get(e.from)?.push(e.to);adj.get(e.to)?.push(e.from);}let count=0;while(set.size){count++;const start=set.values().next().value,q=[start];set.delete(start);while(q.length){for(const x of adj.get(q.shift())||[])if(set.delete(x))q.push(x);}}return count;}
  countIndirectCandidates(nodes,edges){if(nodes.length>120)return '120+';const direct=new Set(edges.map(e=>[e.from,e.to].sort().join('~'))),adj=new Map(nodes.map(n=>[n.key,new Set()])),pairs=new Set();for(const e of edges){adj.get(e.from)?.add(e.to);adj.get(e.to)?.add(e.from);}for(const n of nodes){for(const mid of adj.get(n.key)||[])for(const end of adj.get(mid)||[]){if(end===n.key)continue;const pair=[n.key,end].sort().join('~');if(!direct.has(pair))pairs.add(pair);}}return pairs.size;}
  findPath(){const a=$('#graphPathFrom').value,b=$('#graphPathTo').value;if(!a||!b)return this.onToast?.('Selecciona origen y destino','error');const v=this.visibleData();this.path=shortestPath(this.graph,a,b,v.edges.map(e=>e.id),[...v.set]);if(!this.path)return this.onToast?.('No hay una ruta con los filtros actuales','error');this.render();}
  suggestPath(){const v=this.visibleData();const p=suggestIndirectPath(this.graph,v.edges.map(e=>e.id),[...v.set]);if(!p)return this.onToast?.('No se encontró una cadena indirecta con los filtros actuales','error');this.path=p;$('#graphPathFrom').value=p.nodes[0];$('#graphPathTo').value=p.nodes.at(-1);this.render();}
  handleClick(e){const pathBtn=e.target.closest?.('[data-path-node]');if(pathBtn){this.selected=pathBtn.dataset.pathNode;this.updateSelection();return;}const node=e.target.closest?.('.graph-node');if(!node)return;this.selected=node.dataset.nodeKey;this.updateSelection();}
  updateSelection(){this.nodeLayer.querySelectorAll('.graph-node').forEach(el=>el.classList.toggle('is-selected',el.dataset.nodeKey===this.selected));}
  handleDoubleClick(e){const node=e.target.closest?.('.graph-node');if(!node)return;const n=this.graph.nodes.find(x=>x.key===node.dataset.nodeKey);if(!n)return;if(n.kind==='theories')this.onOpenTheory?.(n.id);else this.onOpenRecord?.(n.kind,n.id);}
  setZoom(v){this.view.zoom=Math.max(.45,Math.min(2.5,v));this.applyView();}
  applyView(){this.world.setAttribute('transform',`translate(${this.view.x} ${this.view.y}) scale(${this.view.zoom})`);$('#graphZoomReset').textContent=`${Math.round(this.view.zoom*100)}%`;}
  fit(){this.view={x:0,y:0,zoom:1};this.applyView();}
}

Object.assign(window.CASE404,{ConnectionGraph,buildGraph,shortestPath,suggestIndirectPath,GRAPH_KIND_META,EDGE_META});
})();

/* --- writer.js --- */
(()=>{
"use strict";
const {$,uid,escapeHtml}=window.CASE404;
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

function normalizeWriter(raw={}){
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

function analyzeContinuity(writerInput={},modules={}){
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

class WriterMode{
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

Object.assign(window.CASE404,{WriterMode,normalizeWriter,analyzeContinuity});
})();

/* --- reports.js --- */
(()=>{
"use strict";
const {$,escapeHtml,caseNumber,slug,buildGraph,EDGE_META,analyzeContinuity,normalizeWriter}=window.CASE404;
const arr=v=>Array.isArray(v)?v:[];
const text=v=>String(v??'').trim();
const safe=v=>escapeHtml(text(v)||'—');
const titleOf=(kind,r)=>kind==='people'?r.name:kind==='places'?r.name:r.title;
const fmt=v=>{if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return text(v);return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:String(v).includes('T')?'short':undefined}).format(d);};
const list=v=>arr(v).filter(Boolean);
const label=v=>text(v).replaceAll('_',' ').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
const weights=links=>list(links).reduce((n,x)=>n+Math.max(1,Math.min(3,Number(x.weight)||1)),0);

const KINDS={
  people:{label:'Personas',symbol:'●'},places:{label:'Lugares',symbol:'⌖'},evidence:{label:'Evidencias',symbol:'◆'},events:{label:'Eventos',symbol:'◷'},documents:{label:'Documentos',symbol:'▧'}
};
const SECTIONS=['summary','timeline','people','places','evidence','documents','theories','relations','writer','continuity'];

function registry(modules){const map=new Map();for(const kind of Object.keys(KINDS))for(const r of arr(modules[kind]))map.set(`${kind}:${r.id}`,{kind,record:r});return map;}
function linkName(reg,l){const hit=reg.get(`${l.kind}:${l.id}`);return hit?`${hit.record.ref||'?'} · ${titleOf(l.kind,hit.record)||'Sin título'}`:`${l.kind}:${l.id} [ausente]`;}
function theoryScore(t){const a=weights(t.supports),b=weights(t.contradicts),total=a+b;return {a,b,total,score:total?Math.round(a/total*100):null};}
function sectionHeading(k,title,sub=''){return `<header class="report-section-head"><span>${safe(k)}</span><div><h2>${safe(title)}</h2>${sub?`<p>${safe(sub)}</p>`:''}</div></header>`;}
function tagsHtml(tags){return list(tags).length?`<div class="report-tags">${list(tags).map(t=>`<span>#${safe(t)}</span>`).join('')}</div>`:'';}
function facts(rows){return `<dl class="report-facts">${rows.filter(x=>x[1]!==undefined&&x[1]!==null&&text(x[1])!=='').map(([k,v])=>`<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join('')}</dl>`;}
function prose(v){return text(v)?`<p class="report-prose">${safe(v)}</p>`:'';}

function makeReportModel(caseItem={},preset='full'){
  const modules=caseItem.modules||{},w=normalizeWriter(modules.writer||{}),graph=buildGraph(modules,{includeTags:false}),issues=analyzeContinuity(w,modules),reg=registry(modules);
  const events=[...arr(modules.events)].sort((a,b)=>String(a.startAt||'9999').localeCompare(String(b.startAt||'9999')));
  const theories=arr(modules.theories).map(t=>({...t,_m:theoryScore(t)})).sort((a,b)=>(b._m.score??-1)-(a._m.score??-1));
  return {caseItem,modules,w,graph,issues,reg,events,theories,preset,generatedAt:new Date().toISOString()};
}

function renderReport(caseItem={},options={}){
  const preset=options.preset||'full',model=makeReportModel(caseItem,preset),{modules,w,graph,issues,reg,events,theories}=model;
  const enabled=new Set(options.sections||SECTIONS);
  const out=[];
  out.push(`<article class="case-report" data-report-preset="${safe(preset)}">`);
  out.push(`<header class="report-cover"><div class="report-classification">CASE 404 · INVESTIGATION REPORT</div><p class="report-case-ref">${safe(caseNumber(caseItem.uuid||'case404'))}</p><h1>${safe(caseItem.title||'Caso sin título')}</h1><p class="report-summary-lead">${safe(caseItem.summary||'Sin resumen ejecutivo.')}</p><div class="report-cover-meta"><span>Estado <b>${safe(label(caseItem.status||'active'))}</b></span><span>Prioridad <b>${safe(label(caseItem.priority||'normal'))}</b></span><span>Generado <b>${safe(fmt(model.generatedAt))}</b></span></div>${tagsHtml(caseItem.tags)}</header>`);

  if(enabled.has('summary')){
    const counts={people:arr(modules.people).length,places:arr(modules.places).length,evidence:arr(modules.evidence).length,events:arr(modules.events).length,documents:arr(modules.documents).length,theories:arr(modules.theories).length};
    out.push(`<section class="report-section">${sectionHeading('01','Resumen ejecutivo','Estado actual y volumen del expediente')}<div class="report-kpis"><div><b>${counts.people}</b><span>personas</span></div><div><b>${counts.evidence}</b><span>evidencias</span></div><div><b>${counts.events}</b><span>eventos</span></div><div><b>${counts.theories}</b><span>teorías</span></div><div><b>${graph.edges.length}</b><span>relaciones</span></div><div><b>${issues.length}</b><span>alertas narrativas</span></div></div>${facts([['ID',caseNumber(caseItem.uuid||'case404')],['Creado',fmt(caseItem.createdAt)],['Última actualización',fmt(caseItem.updatedAt)],['Estado',label(caseItem.status||'active')],['Prioridad',label(caseItem.priority||'normal')]])}</section>`);
  }

  if(enabled.has('timeline')){
    out.push(`<section class="report-section page-break">${sectionHeading('02','Cronología',`${events.length} eventos registrados`)}${events.length?`<div class="report-timeline">${events.map(e=>`<article><time>${safe(fmt(e.startAt))}${e.endAt?` → ${safe(fmt(e.endAt))}`:''}</time><div><h3>${safe(e.ref)} · ${safe(e.title)}</h3>${facts([['Lugar',e.place],['Sujetos',e.subjects],['Certeza',label(e.certainty||'unknown')],['Fuente',e.source]])}${prose(e.description)}${tagsHtml(e.tags)}</div></article>`).join('')}</div>`:'<p class="report-empty">No hay eventos fechados.</p>'}</section>`);
  }

  const recordSection=(kind,num)=>{if(!enabled.has(kind))return;const rows=arr(modules[kind]);out.push(`<section class="report-section page-break">${sectionHeading(num,KINDS[kind].label,`${rows.length} registros`)}${rows.length?`<div class="report-records">${rows.map(r=>`<article class="report-record"><div class="report-record-head"><span>${safe(KINDS[kind].symbol)} ${safe(r.ref||'—')}</span><h3>${safe(titleOf(kind,r)||'Sin título')}</h3></div>${facts(kind==='people'?[['Estado',label(r.status)],['Alias',r.aliases],['Edad',r.age],['Profesión / rol',r.occupation],['Contacto',r.contact],['Índice interno',r.risk?`${r.risk}%`:null]]:kind==='places'?[['Tipo',label(r.type)],['Ubicación',r.location],['Coordenadas / referencia',r.coordinates],['Acceso',r.access]]:kind==='evidence'?[['Tipo',label(r.type)],['Estado',label(r.status)],['Fecha / hora',fmt(r.collectedAt)],['Procedencia',r.source],['Custodia',r.custody]]:[['Tipo',label(r.type)],['Fecha',fmt(r.date)],['Origen / autor',r.source],['Referencia externa',r.reference],['Adjunto',r.attachment?.name]])}${prose(r.description||r.notes||r.alibi)}${tagsHtml(r.tags)}</article>`).join('')}</div>`:'<p class="report-empty">Sin registros.</p>'}</section>`);};
  recordSection('people','03');recordSection('places','04');recordSection('evidence','05');recordSection('documents','06');

  if(enabled.has('theories')){
    out.push(`<section class="report-section page-break">${sectionHeading('07','Theory Engine',`${theories.length} hipótesis`)}${theories.length?`<div class="report-theories">${theories.map(t=>`<article class="report-theory"><div class="report-theory-head"><span>${safe(t.ref)}</span><h3>${safe(t.title)}</h3><b>${t._m.score===null?'—':t._m.score+'%'}</b></div>${prose(t.statement)}${facts([['Estado',label(t.status||'active')],['Peso a favor',t._m.a],['Peso en contra',t._m.b],['Base total',t._m.total]])}<div class="report-columns"><div><h4>A favor</h4>${list(t.supports).length?`<ul>${list(t.supports).map(l=>`<li><b>${safe(linkName(reg,l))}</b> · peso ${Math.max(1,Math.min(3,Number(l.weight)||1))}</li>`).join('')}</ul>`:'<p>Sin vínculos.</p>'}</div><div><h4>En contra</h4>${list(t.contradicts).length?`<ul>${list(t.contradicts).map(l=>`<li><b>${safe(linkName(reg,l))}</b> · peso ${Math.max(1,Math.min(3,Number(l.weight)||1))}</li>`).join('')}</ul>`:'<p>Sin vínculos.</p>'}</div></div>${list(t.questions).length?`<h4>Preguntas abiertas</h4><ul>${list(t.questions).map(x=>`<li>${safe(x)}</li>`).join('')}</ul>`:''}${list(t.contradictions).length?`<h4>Contradicciones / debilidades</h4><ul>${list(t.contradictions).map(x=>`<li>${safe(x)}</li>`).join('')}</ul>`:''}</article>`).join('')}</div>`:'<p class="report-empty">No hay teorías.</p>'}</section>`);
  }

  if(enabled.has('relations')){
    const nodeByKey=new Map(graph.nodes.map(n=>[n.key,n]));out.push(`<section class="report-section page-break">${sectionHeading('08','Mapa de relaciones',`${graph.nodes.length} nodos · ${graph.edges.length} relaciones fuertes`)}${graph.edges.length?`<table class="report-table"><thead><tr><th>Origen</th><th>Relación</th><th>Destino</th></tr></thead><tbody>${graph.edges.map(e=>{const a=nodeByKey.get(e.from),b=nodeByKey.get(e.to);return `<tr><td>${safe(a?.ref||'')} · ${safe(a?.title||e.from)}</td><td>${safe(EDGE_META[e.type]?.label||e.label||e.type)}</td><td>${safe(b?.ref||'')} · ${safe(b?.title||e.to)}</td></tr>`;}).join('')}</tbody></table>`:'<p class="report-empty">No hay relaciones fuertes.</p>'}</section>`);
  }

  if(enabled.has('writer')){
    out.push(`<section class="report-section page-break">${sectionHeading('09','Writer Mode',`${w.chapters.length} capítulos · ${w.scenes.length} escenas · ${w.clues.length} pistas · ${w.secrets.length} secretos`)}<h3>Capítulos</h3>${w.chapters.length?`<div class="report-chapters">${[...w.chapters].sort((a,b)=>a.order-b.order).map(c=>`<article><span>${safe(c.ref)} · ${safe(c.order)}</span><h4>${safe(c.title)}</h4>${facts([['POV',c.pov],['Tiempo / lugar',c.timePlace]])}${prose(c.summary)}${tagsHtml(c.tags)}</article>`).join('')}</div>`:'<p class="report-empty">Sin capítulos.</p>'}<h3>Escenas</h3>${w.scenes.length?`<table class="report-table"><thead><tr><th>Ref.</th><th>Escena</th><th>Capítulo</th><th>POV</th></tr></thead><tbody>${w.scenes.map(s=>{const c=w.chapters.find(x=>x.id===s.chapterId);return `<tr><td>${safe(s.ref)}</td><td>${safe(s.title)}</td><td>${safe(c?.ref||'—')}</td><td>${safe(s.pov)}</td></tr>`;}).join('')}</tbody></table>`:'<p class="report-empty">Sin escenas.</p>'}<h3>Pistas</h3>${w.clues.length?`<table class="report-table"><thead><tr><th>Ref.</th><th>Pista</th><th>Introducción</th><th>Revelación</th><th>Resolución</th></tr></thead><tbody>${w.clues.map(c=>{const ref=id=>w.chapters.find(x=>x.id===id)?.ref||'—';return `<tr><td>${safe(c.ref)}</td><td>${safe(c.title)}</td><td>${safe(ref(c.introducedChapterId))}</td><td>${safe(ref(c.revealedChapterId))}</td><td>${safe(ref(c.resolvedChapterId))}</td></tr>`;}).join('')}</tbody></table>`:'<p class="report-empty">Sin pistas.</p>'}</section>`);
  }

  if(enabled.has('continuity')){
    out.push(`<section class="report-section page-break">${sectionHeading('10','Continuidad',`${issues.length} alertas mecánicas`)}${issues.length?`<div class="report-issues">${issues.map(i=>`<article class="severity-${safe(i.severity)}"><span>${safe(label(i.severity))} · ${safe(i.code)}</span><h3>${safe(i.title)}</h3><p>${safe(i.detail)}</p></article>`).join('')}</div>`:'<div class="report-clean">✓ No se detectaron alertas de continuidad.</div>'}</section>`);
  }
  out.push(`<footer class="report-footer"><span>CASE 404 · Investigation Studio</span><span>Informe generado localmente · ${safe(fmt(model.generatedAt))}</span></footer></article>`);
  return out.join('');
}

function reportMarkdown(caseItem={},options={}){
  const m=makeReportModel(caseItem,options.preset||'full'),{modules,w,graph,issues,events,theories,reg}=m,lines=[];
  const enabled=new Set(options.sections||SECTIONS);
  lines.push(`# ${caseItem.title||'Caso sin título'}`,``,`${caseNumber(caseItem.uuid||'case404')} · ${label(caseItem.status||'active')} · Prioridad ${label(caseItem.priority||'normal')}`,``,caseItem.summary||'Sin resumen.',``);
  if(enabled.has('summary'))lines.push(`## Resumen`,`- Personas: ${arr(modules.people).length}`,`- Lugares: ${arr(modules.places).length}`,`- Evidencias: ${arr(modules.evidence).length}`,`- Eventos: ${events.length}`,`- Documentos: ${arr(modules.documents).length}`,`- Teorías: ${theories.length}`,`- Relaciones: ${graph.edges.length}`,`- Alertas de continuidad: ${issues.length}`,``);
  if(enabled.has('timeline')){lines.push('## Cronología','');for(const e of events)lines.push(`- **${e.ref||'EV'} · ${e.title||'Evento'}** — ${fmt(e.startAt)}${e.endAt?` → ${fmt(e.endAt)}`:''}${e.place?` · ${e.place}`:''}`);lines.push('');}
  for(const kind of ['people','places','evidence','documents'])if(enabled.has(kind)){lines.push(`## ${KINDS[kind].label}`,'');for(const r of arr(modules[kind]))lines.push(`- **${r.ref||'—'} · ${titleOf(kind,r)||'Sin título'}**${r.description||r.notes||r.alibi?` — ${r.description||r.notes||r.alibi}`:''}`);lines.push('');}
  if(enabled.has('theories')){lines.push('## Teorías','');for(const t of theories){lines.push(`### ${t.ref} · ${t.title}`,`Soporte interno: ${t._m.score===null?'—':t._m.score+'%'} (a favor ${t._m.a}, en contra ${t._m.b})`,t.statement||'',``);for(const l of list(t.supports))lines.push(`- + ${linkName(reg,l)} · peso ${l.weight||1}`);for(const l of list(t.contradicts))lines.push(`- − ${linkName(reg,l)} · peso ${l.weight||1}`);lines.push('');}}
  if(enabled.has('relations')){const by=new Map(graph.nodes.map(n=>[n.key,n]));lines.push('## Relaciones','');for(const e of graph.edges){const a=by.get(e.from),b=by.get(e.to);lines.push(`- ${a?.ref||'?'} · ${a?.title||e.from} — **${EDGE_META[e.type]?.label||e.label||e.type}** → ${b?.ref||'?'} · ${b?.title||e.to}`);}lines.push('');}
  if(enabled.has('writer'))lines.push('## Writer Mode','',`Capítulos: ${w.chapters.length} · Escenas: ${w.scenes.length} · Pistas: ${w.clues.length} · Secretos: ${w.secrets.length}`,'');
  if(enabled.has('continuity')){lines.push('## Continuidad','');if(!issues.length)lines.push('- Sin alertas.');else for(const i of issues)lines.push(`- **${label(i.severity)} · ${i.title}** — ${i.detail}`);}
  return lines.join('\n');
}

class ReportsEngine{
  constructor({onToast}){this.onToast=onToast;this.caseItem=null;this.preset='full';this.bind();}
  bind(){
    $('#reportPreset').addEventListener('change',e=>{this.preset=e.target.value;this.applyPreset();this.render();});
    $('#reportSections').addEventListener('change',()=>this.render());
    $('#reportRefresh').addEventListener('click',()=>this.render());
    $('#reportPrint').addEventListener('click',()=>{if(!this.caseItem)return;document.body.classList.add('print-report');window.print();setTimeout(()=>document.body.classList.remove('print-report'),200);});
    $('#reportExportHtml').addEventListener('click',()=>this.exportHtml());
    $('#reportExportMd').addEventListener('click',()=>this.exportMarkdown());
  }
  load(caseItem){this.caseItem=caseItem?structuredClone(caseItem):null;this.render();}
  selectedSections(){return [...document.querySelectorAll('#reportSections input[data-report-section]:checked')].map(x=>x.dataset.reportSection);}
  applyPreset(){const sets={executive:new Set(['summary','timeline','evidence','theories','relations']),full:new Set(SECTIONS),narrative:new Set(['summary','timeline','people','writer','continuity'])};const wanted=sets[this.preset]||sets.full;document.querySelectorAll('#reportSections input[data-report-section]').forEach(x=>x.checked=wanted.has(x.dataset.reportSection));}
  render(){const root=$('#reportPreview');if(!root)return;if(!this.caseItem){root.innerHTML='<div class="report-placeholder">Abre un caso para generar su informe.</div>';return;}const sections=this.selectedSections();root.innerHTML=renderReport(this.caseItem,{preset:this.preset,sections});$('#reportSectionCount').textContent=sections.length;$('#reportPageHint').textContent=this.estimatePages(root.textContent);}
  estimatePages(txt){const n=Math.max(1,Math.ceil(String(txt||'').length/4800));return `~${n} pág.`;}
  exportHtml(){if(!this.caseItem)return;const html=renderReport(this.caseItem,{preset:this.preset,sections:this.selectedSections()}),css=$('#reportExportStyles')?.content?.textContent||'';const doc=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(this.caseItem.title)} — CASE 404</title><style>${css}</style></head><body>${html}</body></html>`;this.download(new Blob([doc],{type:'text/html;charset=utf-8'}),`${slug(this.caseItem.title)}-report.html`);this.onToast?.('Informe HTML exportado');}
  exportMarkdown(){if(!this.caseItem)return;const md=reportMarkdown(this.caseItem,{preset:this.preset,sections:this.selectedSections()});this.download(new Blob([md],{type:'text/markdown;charset=utf-8'}),`${slug(this.caseItem.title)}-report.md`);this.onToast?.('Informe Markdown exportado');}
  download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
}

Object.assign(window.CASE404,{ReportsEngine,makeReportModel,renderReport,reportMarkdown});
})();

/* --- app.js --- */
(()=>{
"use strict";
const {listCases,getCase,putCase,deleteCase,clearCases,$,$$,uid,caseNumber,escapeHtml,formatDate,downloadJson,slug,EvidenceBoard,InvestigationDB,Timeline404,TheoryEngine,ConnectionGraph,WriterMode,ReportsEngine}=window.CASE404;
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

})();

/* --- theme.js --- */
(()=>{
"use strict";
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

})();
