import {$,escapeHtml} from './utils.js';

const CERTAINTY_LABELS={confirmed:'Confirmado',probable:'Probable',claimed:'Declarado',unknown:'Desconocido'};
const HOUR=3600000, DAY=24*HOUR;
const toMs=v=>{if(!v)return NaN;const n=new Date(v).getTime();return Number.isFinite(n)?n:NaN;};
const fmtDateTime=v=>{const n=toMs(v);if(!Number.isFinite(n))return 'Sin fecha';return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(n));};
const fmtTick=ms=>new Intl.DateTimeFormat('es-ES',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const fmtDuration=ms=>{if(ms<=0)return 'instante';const m=Math.round(ms/60000);if(m<60)return `${m} min`;const h=m/60;if(h<24)return `${h<10?h.toFixed(1):Math.round(h)} h`;const d=h/24;return `${d<10?d.toFixed(1):Math.round(d)} d`;};
const subjectsOf=r=>[...new Set(String(r.subjects||'').split(/[,;\n]+/).map(s=>s.trim().toLowerCase()).filter(Boolean))];
const shared=(a,b)=>{const sb=new Set(subjectsOf(b));return subjectsOf(a).filter(x=>sb.has(x));};
const certaintyRank={confirmed:0,probable:1,claimed:2,unknown:3};

export class Timeline404{
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
