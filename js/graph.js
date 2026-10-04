import {$,escapeHtml} from './utils.js';

export const GRAPH_KIND_META={
  people:{label:'Personas',symbol:'●'},places:{label:'Lugares',symbol:'⌖'},evidence:{label:'Evidencias',symbol:'◆'},events:{label:'Eventos',symbol:'◷'},documents:{label:'Documentos',symbol:'▧'},theories:{label:'Teorías',symbol:'△'}
};
export const EDGE_META={
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

export function buildGraph(modules={},options={}){
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

export function shortestPath(graph,from,to,allowedEdges=null,allowedNodes=null){
  if(!from||!to||from===to)return null;
  const nodeSet=allowedNodes?new Set(allowedNodes):new Set(graph.nodes.map(n=>n.key));if(!nodeSet.has(from)||!nodeSet.has(to))return null;
  const edgeSet=allowedEdges?new Set(allowedEdges):null,adj=new Map([...nodeSet].map(k=>[k,[]]));
  for(const e of graph.edges){if(edgeSet&&!edgeSet.has(e.id))continue;if(!nodeSet.has(e.from)||!nodeSet.has(e.to))continue;adj.get(e.from).push({to:e.to,edge:e});adj.get(e.to).push({to:e.from,edge:e});}
  const q=[from],prev=new Map([[from,null]]),via=new Map();
  while(q.length){const cur=q.shift();if(cur===to)break;for(const step of adj.get(cur)||[]){if(prev.has(step.to))continue;prev.set(step.to,cur);via.set(step.to,step.edge);q.push(step.to);}}
  if(!prev.has(to))return null;const nodes=[];const edges=[];let cur=to;while(cur){nodes.push(cur);const e=via.get(cur);if(e)edges.push(e.id);cur=prev.get(cur);}return {nodes:nodes.reverse(),edges:edges.reverse(),hops:edges.length};
}

export function suggestIndirectPath(graph,allowedEdges=null,allowedNodes=null){
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

export class ConnectionGraph{
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
