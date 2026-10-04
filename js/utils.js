
export const $=(s,root=document)=>root.querySelector(s);
export const $$=(s,root=document)=>[...root.querySelectorAll(s)];
export function uid(){return crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
export function caseNumber(uuid){return `CASE-${uuid.replace(/-/g,'').slice(0,6).toUpperCase()}`;}
export function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function safeImageDataUrl(v=''){const s=String(v||'');return /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)?s:'';}
export function safePortableDataUrl(v=''){const s=String(v||'');return /^data:(?:application\/(?:pdf|json|octet-stream)|text\/(?:plain|markdown|csv)|image\/(?:png|jpe?g|webp));(?:charset=[^,;]+;)?base64,[a-z0-9+/=\s]+$/i.test(s)?s:'';}
export function formatDate(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return v;}}
export function downloadJson(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function slug(v){return String(v||'case-404').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'case-404';}
