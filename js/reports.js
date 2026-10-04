import {$,escapeHtml,caseNumber,slug} from './utils.js';
import {buildGraph,EDGE_META} from './graph.js';
import {analyzeContinuity,normalizeWriter} from './writer.js';

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

export function makeReportModel(caseItem={},preset='full'){
  const modules=caseItem.modules||{},w=normalizeWriter(modules.writer||{}),graph=buildGraph(modules,{includeTags:false}),issues=analyzeContinuity(w,modules),reg=registry(modules);
  const events=[...arr(modules.events)].sort((a,b)=>String(a.startAt||'9999').localeCompare(String(b.startAt||'9999')));
  const theories=arr(modules.theories).map(t=>({...t,_m:theoryScore(t)})).sort((a,b)=>(b._m.score??-1)-(a._m.score??-1));
  return {caseItem,modules,w,graph,issues,reg,events,theories,preset,generatedAt:new Date().toISOString()};
}

export function renderReport(caseItem={},options={}){
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

export function reportMarkdown(caseItem={},options={}){
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

export class ReportsEngine{
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
