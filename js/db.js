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
export async function listCases(){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readonly');return requestToPromise(tx.objectStore(CASE_STORE).getAll());},()=>readFallback());}
export async function getCase(uuid){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readonly');return requestToPromise(tx.objectStore(CASE_STORE).get(uuid));},()=>readFallback().find(x=>x?.uuid===uuid));}
export async function putCase(item){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');await requestToPromise(tx.objectStore(CASE_STORE).put(item));return item;},()=>{const items=readFallback();const i=items.findIndex(x=>x?.uuid===item.uuid);if(i>=0)items[i]=item;else items.push(item);writeFallback(items);return item;});}
export async function deleteCase(uuid){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');return requestToPromise(tx.objectStore(CASE_STORE).delete(uuid));},()=>{writeFallback(readFallback().filter(x=>x?.uuid!==uuid));return true;});}
export async function clearCases(){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');return requestToPromise(tx.objectStore(CASE_STORE).clear());},()=>{writeFallback([]);return true;});}
export async function replaceAllCases(items){return tryIdb(async()=>{const db=await openDb();const tx=db.transaction(CASE_STORE,'readwrite');const store=tx.objectStore(CASE_STORE);store.clear();items.forEach(x=>store.put(x));return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});},()=>{writeFallback(items);return true;});}
