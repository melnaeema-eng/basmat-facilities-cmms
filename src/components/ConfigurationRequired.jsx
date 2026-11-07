import {useState} from 'react'
export default function ConfigurationRequired(){
 const [ar,setAr]=useState(()=>localStorage.getItem('bf_lang')==='ar')
 return <div className="login-page" dir={ar?'rtl':'ltr'}><section className="login-card"><div className="brand-mark large">ب</div><h1>{ar?'بصمة النوابغ لإدارة المرافق':'Basmat Facilities'}</h1><h2>{ar?'إعداد الاتصال مطلوب':'Connection setup required'}</h2><p>{ar?'أضف عنوان مشروع Supabase ومفتاحه العام في ملف .env.local ثم أعد تشغيل التطبيق.':'Add your Supabase project URL and public key to .env.local, then restart the application.'}</p><pre style={{direction:'ltr',fontSize:11,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>VITE_SUPABASE_URL{ '\n' }VITE_SUPABASE_ANON_KEY</pre><button className="btn secondary" onClick={()=>setAr(!ar)}>{ar?'English':'العربية'}</button></section></div>
}
