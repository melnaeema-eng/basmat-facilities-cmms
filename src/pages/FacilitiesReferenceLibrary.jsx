import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabaseClient'
import {useLanguage} from '../i18n/LanguageContext'

export default function FacilitiesReferenceLibrary(){
 const {lang}=useLanguage()
 const [owners,setOwners]=useState([]),[companies,setCompanies]=useState([]),[types,setTypes]=useState([])
 const [tab,setTab]=useState('owners'),[q,setQ]=useState(''),[error,setError]=useState('')
 useEffect(()=>{(async()=>{
  try{
   const [a,b,c]=await Promise.all([
    supabase.from('bf_ref_facility_owners').select('*').eq('status','active').order('name_ar'),
    supabase.from('bf_ref_maintenance_companies').select('*').eq('status','active').order('name_ar'),
    supabase.from('bf_ref_facility_types').select('*').eq('status','active').order('name_ar')
   ])
   for(const r of [a,b,c])if(r.error)throw r.error
   setOwners(a.data||[]);setCompanies(b.data||[]);setTypes(c.data||[])
  }catch(e){setError(e.message)}
 })()},[])
 const match=x=>!q||Object.values(x).flat().join(' ').toLowerCase().includes(q.toLowerCase())
 const rows=useMemo(()=>tab==='owners'?owners.filter(match):tab==='companies'?companies.filter(match):types.filter(match),[tab,q,owners,companies,types])
 return <section className="facility-module">
  <div className="page-head">
   <div><h1>{lang==='ar'?'مكتبة ملاك المرافق وشركات الصيانة':'Facility Owners & FM Companies Library'}</h1>
   <p>{lang==='ar'?'مرجع مركزي للجهات المالكة وأنواع المرافق وشركات التشغيل والصيانة.':'Central reference for facility owners, facility types and O&M/FM companies.'}</p></div>
   <button className="btn secondary" onClick={()=>history.back()}>{lang==='ar'?'رجوع':'Back'}</button>
  </div>
  {error&&<div className="alert error">{error}</div>}
  <div className="facility-panel">
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
    <button className={'btn '+(tab==='owners'?'primary':'secondary')} onClick={()=>setTab('owners')}>{lang==='ar'?`الوزارات والجهات (${owners.length})`:`Owners (${owners.length})`}</button>
    <button className={'btn '+(tab==='companies'?'primary':'secondary')} onClick={()=>setTab('companies')}>{lang==='ar'?`شركات الصيانة (${companies.length})`:`FM Companies (${companies.length})`}</button>
    <button className={'btn '+(tab==='types'?'primary':'secondary')} onClick={()=>setTab('types')}>{lang==='ar'?`أنواع المرافق (${types.length})`:`Facility Types (${types.length})`}</button>
   </div>
   <input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==='ar'?'بحث بالاسم أو القطاع أو الخدمة...':'Search name, sector or service...'} style={{width:'100%'}}/>
  </div>
  <div className="security-check-list">
   {rows.map(x=><article className="security-check-card" key={`${tab}-${x.id}`}>
    <div>
     <strong>{lang==='ar'?x.name_ar:(x.name_en||x.name_ar)}</strong>
     <p>{x.code}{x.sector?` · ${x.sector}`:''}</p>
     {Array.isArray(x.capabilities)&&x.capabilities.length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{x.capabilities.map(c=><span className="security-pill pass" key={c}>{c.replaceAll('_',' ')}</span>)}</div>}
    </div>
   </article>)}
  </div>
 </section>
}
