import {useEffect} from 'react'
const hasArabic=s=>/[\u0600-\u06FF]/.test(s||'')
const hasLatin=s=>/[A-Za-z]/.test(s||'')
function fieldMode(el){
 const explicit=(el.getAttribute('data-lang')||el.getAttribute('lang')||'').toLowerCase()
 if(explicit==='ar'||explicit==='en')return explicit
 const key=((el.name||'')+' '+(el.id||'')+' '+(el.getAttribute('data-field')||'')).toLowerCase()
 if(/(^|[_\-\s])(ar|arabic)($|[_\-\s])/.test(key)||/(name_ar|title_ar|instructions_ar|description_ar)/.test(key))return'ar'
 if(/(^|[_\-\s])(en|english)($|[_\-\s])/.test(key)||/(name_en|title_en|instructions_en|description_en)/.test(key))return'en'
 const label=(el.closest('label')?.innerText||'').trim(),normalized=label.toLowerCase()
 if(label.includes('\u0627\u0644\u0639\u0631\u0628\u064a\u0629')||label.includes('\u0639\u0631\u0628\u064a')||label.includes('\u0639\u0631\u0628\u0649'))return'ar'
 if(normalized.includes('english')||normalized.includes('name en')||normalized.includes('title en')||normalized.includes('description en'))return'en'
 return null
}
export function applySmartLanguage(el){
 if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return null
 const mode=fieldMode(el);if(!mode)return null
 el.lang=mode;el.dir=mode==='ar'?'rtl':'ltr';el.dataset.smartLanguage=mode;el.setAttribute('inputmode','text')
 const test=()=>{const v=el.value||'';const mismatch=mode==='ar'?(hasLatin(v)&&!hasArabic(v)):(hasArabic(v)&&!hasLatin(v));el.classList.toggle('smart-language-warning',!!(v.trim()&&mismatch));el.setAttribute('aria-invalid',v.trim()&&mismatch?'true':'false');el.title=mismatch?(mode==='ar'?'\u0647\u0630\u0627 \u0627\u0644\u062d\u0642\u0644 \u0645\u062e\u0635\u0635 \u0644\u0644\u0639\u0631\u0628\u064a\u0629':'This field expects English'):''}
 test();if(!el.dataset.smartLanguageBound){el.dataset.smartLanguageBound='1';el.addEventListener('input',test)};return mode
}
export function focusNextField(current){
 const form=current?.closest('form');if(!form)return
 const items=[...form.querySelectorAll('input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),button[type=submit]:not([disabled])')]
 const i=items.indexOf(current),next=items.slice(i+1).find(x=>!x.readOnly&&x.offsetParent!==null)
 if(next)requestAnimationFrame(()=>{applySmartLanguage(next);next.focus()})
}
export function useSmartLanguageInputs(){
 useEffect(()=>{const applyTree=root=>{if(root instanceof HTMLInputElement||root instanceof HTMLTextAreaElement)applySmartLanguage(root);root?.querySelectorAll?.('input,textarea').forEach(applySmartLanguage)};applyTree(document);const focus=e=>applySmartLanguage(e.target);const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(applyTree)));observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',focus);return()=>{observer.disconnect();document.removeEventListener('focusin',focus)}},[])
}
