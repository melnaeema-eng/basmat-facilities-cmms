import {lazy,Suspense} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
const Corrective=lazy(()=>import('./Corrective'))
const PPM=lazy(()=>import('./PPM'))
export default function WorkOrdersHub(){
 const {can}=useAuth(),{lang}=useLanguage(),ar=lang==='ar'
 const [params,setParams]=useSearchParams()
 const tabs=[['corrective',ar?'البلاغات والصيانة التصحيحية':'Requests & corrective maintenance','corrective.view'],['ppm',ar?'الخطط والصيانة الوقائية':'Plans & preventive maintenance','ppm.view']].filter(([, ,permission])=>can(permission))
 const tab=tabs.find(([id])=>id===params.get('type'))?.[0]||tabs[0]?.[0]
 return <section className="facility-module"><div className="workspace-page-heading"><span className="workspace-eyebrow">{ar?'التشغيل والتنفيذ':'OPERATIONS & EXECUTION'}</span><h1>{ar?'مركز الصيانة':'Maintenance center'}</h1><p>{ar?'البلاغ أو الخطة ← أمر العمل ← الإسناد ← التنفيذ والإثبات ← المراجعة ← الإغلاق والتقرير.':'Request or plan → work order → assignment → execution & evidence → review → closeout & report.'}</p></div>
  <div className="workspace-maintenance-toolbar"><div className="workspace-tab-list" role="tablist" aria-label={ar?'نوع الصيانة':'Maintenance type'}>{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="maintenance-content" id={'maintenance-tab-'+id} onClick={()=>setParams({type:id})}>{label}</button>)}</div><div className="row-actions">{can('mobile-field.view')&&<Link className="btn secondary" to="/field-mobile">{ar?'التنفيذ الميداني':'Field execution'}</Link>}{can('approvals.view')&&<Link className="btn secondary" to="/approvals">{ar?'الاعتمادات':'Approvals'}</Link>}</div></div>
  <div role="tabpanel" id="maintenance-content" aria-labelledby={'maintenance-tab-'+tab}><Suspense fallback={<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>}>{tab==='corrective'?<Corrective/>:tab==='ppm'?<PPM/>:null}</Suspense></div>
 </section>
}
