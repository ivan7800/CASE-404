import {$,uid,escapeHtml,safeImageDataUrl} from './utils.js';

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

export class EvidenceBoard{
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
