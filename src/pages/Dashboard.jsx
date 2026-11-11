import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {loadWorkspaceDashboard} from '../lib/workspaceDashboard'
const labels={
 en:{kicker:'OPERATIONS OVERVIEW',title:'Every facility. One clear workflow.',intro:'Follow maintenance from asset registration to execution, review and closeout.',refresh:'Refresh',loading:'Loading live records…',error:'Some records could not be loaded. Retry to refresh the affected sections.',active:'Active work orders',assets:'Active assets',review:'Awaiting review',overdue:'SLA breached',workflow:'Maintenance workflow',workflowNote:'Corrective work orders grouped by their recorded status.',execution:'In progress',assignment:'Assignment',execution:'Execution',closeout:'Closeout',closed:'Closed',recent:'Recent work orders',all:'Open maintenance center',number:'Work order',asset:'Asset',priority:'Priority',status:'Status',due:'Due date',empty:'No work orders in your authorized scope.',ppm:'Preventive maintenance',month:'Current month',done:'Executed',scheduled:'Scheduled',ppmNote:'Executed includes completed, approved and closed jobs.',quick:'Start your next action',setup:'Set up a project',register:'Register an asset',library:'Open asset & PPM library',work:'Manage maintenance',approve:'Review approvals',reports:'Open reports',noAccess:'Your account has no operational modules assigned. Contact your access administrator.',unavailable:'Unavailable',scope:'Counts follow the records available to your account.'},
 ar:{kicker:'نظرة على التشغيل',title:'كل مرفق، ودورة عمل واضحة.',intro:'تابع الصيانة من تسجيل الأصل إلى التنفيذ والمراجعة والإغلاق.',refresh:'تحديث',loading:'جارٍ تحميل البيانات…',error:'تعذر تحميل بعض البيانات. أعد المحاولة لتحديث الأقسام المتأثرة.',active:'أوامر العمل النشطة',assets:'الأصول النشطة',review:'بانتظار المراجعة',overdue:'تجاوز مستوى الخدمة',workflow:'دورة الصيانة',workflowNote:'أوامر العمل التصحيحية حسب الحالة المسجلة.',execution:'قيد التنفيذ',assignment:'الإسناد',execution:'التنفيذ',closeout:'استكمال الإغلاق',closed:'مغلق',recent:'أحدث أوامر العمل',all:'فتح مركز الصيانة',number:'أمر العمل',asset:'الأصل',priority:'الأولوية',status:'الحالة',due:'تاريخ الاستحقاق',empty:'لا توجد أوامر عمل ضمن نطاق صلاحياتك.',ppm:'الصيانة الوقائية',month:'الشهر الحالي',done:'تم التنفيذ',scheduled:'مجدول',ppmNote:'يشمل المنفذ الحالات المكتملة والمعتمدة والمغلقة.',quick:'ابدأ الإجراء التالي',setup:'إعداد مشروع',register:'تسجيل أصل',library:'مكتبة الأصول والصيانة',work:'إدارة الصيانة',approve:'مراجعة الاعتمادات',reports:'فتح التقارير',noAccess:'لا توجد وحدات تشغيلية مسندة لحسابك. تواصل مع مسؤول الصلاحيات.',unavailable:'غير متاح',scope:'الأعداد حسب السجلات المتاحة لحسابك.'}
}
export default function Dashboard(){
 const {can,profile}=useAuth(),{lang,t}=useLanguage(),ar=lang==='ar',s=labels[lang]||labels.en
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let alive=true;setLoading(true)
  loadWorkspaceDashboard(can,localStorage.getItem('basmat.active.organization')||null).then(result=>{if(alive)setData(result)}).catch(()=>{if(alive)setData({counts:{},errors:['load'],rows:[],assets:{}})}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}
 },[can,revision])
 const c=data?.counts||{}
 const value=key=>loading?'…':c[key]===null||c[key]===undefined?'—':new Intl.NumberFormat(lang).format(c[key])
 const cards=[['active','corrective.view','blue'],['closed','corrective.view','green'],['execution','corrective.view','orange'],['overdue','corrective.view','red'],['assets','assets.view','blue'],['review','corrective.view','orange']].filter(([,p])=>can(p))
 const quick=[['/project-setup','setup','organizations.view'],['/facility-asset-cockpit','register','assets.view'],['/asset-library','library','assets.view'],['/work-orders','work',['corrective.view','ppm.view']],['/approvals','approve','approvals.view'],['/reports','reports','reports.view']].filter(([, ,p])=>Array.isArray(p)?p.some(x=>can(x)):can(p))
 const ratio=c.ppmTotal>0&&c.ppmDone!=null?Math.round(c.ppmDone/c.ppmTotal*100):null
 return <section className="workspace-dashboard">
  <div className="workspace-hero"><div><span className="workspace-eyebrow">{s.kicker}</span><h1>{s.title}</h1><p>{s.intro}</p><small>{profile?.full_name}</small></div><div className="workspace-hero-symbol" aria-hidden="true"><span/><span/><span/></div></div>
  <div className="workspace-section-head"><p>{s.scope}</p><button className="btn secondary" onClick={()=>setRevision(x=>x+1)} disabled={loading}>{s.refresh}</button></div>
  {!!data?.errors.length&&<div className="alert error" role="alert">{s.error}</div>}
  {loading&&<p className="workspace-sr" role="status">{s.loading}</p>}
  <div className="workspace-metrics">{cards.map(([key,,tone])=><article key={key} className={'workspace-metric '+tone}><span>{s[key]}</span><strong>{value(key)}</strong>{!loading&&c[key]===null&&<small>{s.unavailable}</small>}</article>)}</div>
  <div className="workspace-dashboard-grid">
   {can('corrective.view')&&<article className="workspace-panel"><div className="workspace-section-head"><h2>{s.workflow}</h2><Link to="/work-orders">{s.all} ↗</Link></div><p className="workspace-muted">{s.workflowNote}</p><div className="workspace-pipeline">{['assignment','execution','review','closeout','closed'].map((key,i)=><div key={key}><span className="workspace-step-number">{i+1}</span><strong>{value(key)}</strong><span>{s[key]}</span></div>)}</div></article>}
   {can('ppm.view')&&<article className="workspace-panel"><div className="workspace-section-head"><h2>{s.ppm}</h2><span className="workspace-pill">{s.month}</span></div><div className="workspace-ppm-score"><strong>{loading?'…':ratio===null?'—':ratio+'%'}</strong><span>{s.done}</span></div><div className="workspace-meter"><i style={{width:(ratio||0)+'%'}}/></div><div className="workspace-section-head"><span>{s.done}: {value('ppmDone')}</span><span>{s.scheduled}: {value('ppmTotal')}</span></div><small className="workspace-muted">{s.ppmNote}</small></article>}
  </div>
  {can('corrective.view')&&<article className="workspace-panel"><div className="workspace-section-head"><h2>{s.recent}</h2><Link to="/work-orders">{s.all} ↗</Link></div><div className="workspace-table"><table><thead><tr>{['number','asset','priority','status','due'].map(k=><th key={k}>{s[k]}</th>)}</tr></thead><tbody>{!loading&&data?.rows.map(row=>{
   const a=data.assets[row.asset_id]
   return <tr key={row.id}><td><Link to={'/corrective/work_order/'+row.id}><strong>{row.work_order_number}</strong></Link><small>{row.title}</small></td><td>{a?(ar?a.name_ar||a.name_en:a.name_en||a.name_ar)||a.asset_tag:'—'}<small>{a?.serial_number||a?.asset_tag}</small></td><td><span className={'workspace-priority '+(row.priority==='P1'?'urgent':'')}>{t(row.priority)}</span></td><td>{t(row.status)}</td><td>{row.completion_due_at?new Date(row.completion_due_at).toLocaleDateString(lang,{timeZone:'Asia/Riyadh'}):'—'}</td></tr>
  })}{!loading&&!data?.rows.length&&<tr><td colSpan={5} className="empty">{data?.errors.includes('recent')?s.unavailable:s.empty}</td></tr>}{loading&&<tr><td colSpan={5} className="empty">{s.loading}</td></tr>}</tbody></table></div></article>}
  {!!quick.length&&<article className="workspace-panel"><h2>{s.quick}</h2><div className="workspace-quick-grid">{quick.map(([to,key])=><Link key={key} to={to}><span>{s[key]}</span><b aria-hidden="true">↗</b></Link>)}</div></article>}
  {!cards.length&&!quick.length&&!can('ppm.view')&&<div className="facility-panel">{s.noAccess}</div>}
 </section>
}
