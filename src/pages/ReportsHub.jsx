import {useState} from 'react'
import {useLanguage} from '../i18n/LanguageContext'
import ManagementReports from './ManagementReports'
import OwnerReports from './OwnerReports'

export default function ReportsHub(){
 const {lang}=useLanguage()
 const ar=lang==='ar'
 const [tab,setTab]=useState('management')

 return <section className="facility-module">
  <style>{`
   .reports-hub-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
   .reports-hub-tabs button{border:1px solid #d7e0ea;background:#fff;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}
   .reports-hub-tabs button.active{background:#0b2b4b;color:#fff;border-color:#0b2b4b}
   .reports-hub-head{margin-bottom:14px}
   .reports-hub-head h1{margin:0;color:#0b2b4b}
   .reports-hub-head p{margin:5px 0 0;color:#64748b}
   @media print{.reports-hub-tabs,.reports-hub-head{display:none!important}}
  `}</style>

  <div className="reports-hub-head">
   <h1>{ar?'مركز التقارير':'Reports Center'}</h1>
   <p>{ar?'التقارير التشغيلية وتقارير المالك في مديول واحد.':'Operational and owner reporting in one module.'}</p>
  </div>

  <div className="reports-hub-tabs no-print">
   <button className={tab==='management'?'active':''} onClick={()=>setTab('management')}>
    {ar?'التقارير التشغيلية والإدارية':'Management & Operational Reports'}
   </button>
   <button className={tab==='owner'?'active':''} onClick={()=>setTab('owner')}>
    {ar?'تقارير المالك':'Owner Reports'}
   </button>
  </div>

  {tab==='management'?<ManagementReports/>:<OwnerReports/>}
 </section>
}
