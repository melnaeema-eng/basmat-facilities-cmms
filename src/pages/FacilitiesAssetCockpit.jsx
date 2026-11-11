import {useEffect,useMemo,useState} from 'react'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {useLanguage} from '../i18n/LanguageContext'
import {useAuth} from '../context/AuthContext'
import {supabase} from '../lib/supabaseClient'
import {loadAll,locationLabel} from '../lib/facility'
import {assetsInProject,normalized,recordName} from '../lib/facilitiesProduct'
import AssetEditor from '../components/AssetEditor'
import '../facilities-product.css'
export default function FacilitiesAssetCockpit(){
 const {lang}=useLanguage(),ar=lang==='ar',{can,access}=useAuth(),nav=useNavigate(),location=useLocation()
 const pick=location.state?.registration||null
 const [data,setData]=useState(null),[projects,setProjects]=useState([]),[links,setLinks]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false)
 const [org,setOrg]=useState(()=>localStorage.getItem('basmat.active.organization')||access?.home_organization_id||''),[project,setProject]=useState(''),[site,setSite]=useState(''),[query,setQuery]=useState(location.state?.query||''),[registration,setRegistration]=useState(!!pick),[editing,setEditing]=useState(null),[limit,setLimit]=useState(40)
 async function load(){
  setLoading(true);setError('')
  try{
   const d=await loadAll();setData(d)
   const {data:map,error:mapError}=await supabase.from('bf35_project_sites').select('project_id,organization_id,site_id,client_id').eq('organization_id',org||'00000000-0000-0000-0000-000000000000')
   if(mapError)throw mapError
   setLinks(map||[])
   if(org){const {data:s,error}=await supabase.rpc('bf35_structure',{p_org:org});if(error)throw error;setProjects((s?.projects||[]).map(p=>({...p,organization_id:org})).filter(p=>p.status!=='closed'))}else setProjects([])
  }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{load()},[org])
 const selected=projects.find(p=>p.id===project)
 const sites=new Set(links.filter(l=>l.project_id===project).map(l=>l.site_id))
 const siteRows=(data?.sites||[]).filter(s=>s.organization_id===org&&s.status==='active'&&sites.has(s.id))
 const chosenSite=siteRows.find(s=>s.id===site)||(siteRows.length===1?siteRows[0]:null)
 const rows=useMemo(()=>{
  const words=normalized(query).split(' ').filter(Boolean)
  return assetsInProject(data?.assets,org,project,links).filter(a=>{
   const text=normalized([a.asset_tag,a.name_ar,a.name_en,a.serial_number,a.manufacturer,a.model,locationLabel(a,data||{},lang)].join(' '))
   return words.every(w=>text.includes(w))
  })
 },[data,org,project,links,query,lang])
 const scopedData=data&&selected&&chosenSite?{...data,organizations:data.organizations.filter(o=>o.id===org),clients:data.clients.filter(c=>c.id===selected.client_id),sites:[chosenSite]}:null
 const initial=useMemo(()=>({organization_id:org,client_id:selected?.client_id||'',site_id:chosenSite?.id||'',name_ar:pick?.type?.name_ar||'',name_en:pick?.type?.name_en||'',manufacturer:pick?.manufacturer?.name||'',model:pick?.option?.model_family||'',criticality:pick?.type?.default_criticality||'medium'}),[org,selected?.client_id,chosenSite?.id,pick])
 return <section className="facility-module facilities-product">
  <div className="page-head"><div><h1>{ar?'تشغيل أصول المرافق':'Facilities Assets & Maintenance'}</h1><p>{ar?'ملف أصل موحد من الوقائية والبلاغ حتى التنفيذ والاعتماد وشهادة الإنجاز.':'One asset record from PPM and faults through execution, approval and completion certification.'}</p></div><div className="row-actions"><Link className="btn" to="/ppm">{ar?'مركز الصيانة الوقائية':'Preventive maintenance'}</Link><Link className="btn secondary" to="/asset-library">{ar?'مكتبة الأصول':'Asset library'}</Link></div></div>
  {error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="alert success" role="status">{notice}</div>}
  <div className="facility-panel product-search"><label>{ar?'شركة الصيانة':'Maintenance company'}<select value={org} onChange={e=>{setOrg(e.target.value);setProject('');setSite('');setEditing(null)}}><option value="">{ar?'اختر الشركة':'Select company'}</option>{(data?.organizations||[]).filter(o=>o.status==='active').map(o=><option key={o.id} value={o.id}>{recordName(o,lang)}</option>)}</select></label><label>{ar?'المشروع':'Project'}<select value={project} disabled={!org||loading} onChange={e=>{setProject(e.target.value);setSite('');setEditing(null)}}><option value="">{ar?'كل المشاريع المتاحة':'All available projects'}</option>{projects.map(p=><option key={p.id} value={p.id}>{recordName(p,lang)}</option>)}</select></label><button className="btn secondary" disabled={loading} onClick={load}>{loading?(ar?'جارٍ التحديث…':'Refreshing…'):(ar?'تحديث المشاريع والمواقع':'Refresh projects & sites')}</button></div>
  <form className="facility-panel product-search" onSubmit={e=>{e.preventDefault();setLimit(40)}}><label>{ar?'البحث عن الأصل':'Find an asset'}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(40)}} placeholder={ar?'التاق / السيريال / الاسم / البراند / الموديل / الموقع':'Tag / serial / name / brand / model / location'}/></label><button className="btn primary">{ar?'بحث':'Search'}</button><button type="button" className="btn secondary" onClick={()=>nav('/asset-library')}>{ar?'البحث في المكتبة':'Search the library'}</button></form>
  <details className="facility-panel" open={registration} onToggle={e=>setRegistration(e.currentTarget.open)}><summary>{ar?'إضافة أصل جديد من المكتبة إلى المشروع':'Register a catalog asset to a project'}</summary><div style={{paddingTop:16}}>{!selected?<p>{ar?'اختر الشركة والمشروع أعلاه، ثم اختر الموقع.':'Select the company and project above, then the site.'} <Link to="/project-setup">{ar?'إضافة / إعداد مشروع':'Add / set up project'}</Link></p>:<><label>{ar?'المنشأة / الموقع':'Facility / site'}<select value={chosenSite?.id||''} onChange={e=>setSite(e.target.value)}><option value="">{ar?'اختر الموقع':'Select site'}</option>{siteRows.map(s=><option key={s.id} value={s.id}>{recordName(s,lang)}</option>)}</select></label>{!siteRows.length&&<p>{ar?'اربط موقعًا نشطًا بهذا المشروع من إعداد المشروع أولًا.':'Link an active site to this project in Project Setup first.'}</p>}{scopedData&&can('assets.manage',org)&&<AssetEditor key={[project,chosenSite.id,pick?.option?.id||pick?.type?.id||''].join(':')} data={scopedData} initial={initial} librarySelection={pick} onCancel={()=>setRegistration(false)} onSaved={async()=>{setNotice(ar?'تم تسجيل الأصل؛ التاق أُنشئ آليًا.':'Asset registered; its tag was generated automatically.');setRegistration(false);await load()}}/>}{scopedData&&!can('assets.manage',org)&&<p>{ar?'تسجيل الأصل يحتاج صلاحية إدارة الأصول في الشركة المختارة.':'Asset registration requires asset management permission in the selected company.'}</p>}</>}</div></details>
  <div className="page-head"><h2>{ar?'الأصول المسجلة':'Registered assets'} ({rows.length})</h2><Link className="btn secondary" to="/work-orders">{ar?'متابعة دورة الصيانة':'Track maintenance cycle'}</Link></div>
  {loading&&<p role="status">{ar?'جارٍ التحميل…':'Loading…'}</p>}
  {!loading&&!rows.length&&<div className="facility-panel">{ar?'لا توجد أصول مطابقة ضمن النطاق الحالي.':'No matching assets in this scope.'}</div>}
  {rows.slice(0,limit).map(a=><article className="facility-panel product-asset" key={a.id}><div><small>{ar?'رقم الأصل':'Asset tag'}</small><strong>{a.asset_tag}</strong><h3>{recordName(a,lang)}</h3><small>{locationLabel(a,data,lang)||'—'}</small></div><div><small>{ar?'البراند / الموديل':'Brand / model'}</small><strong>{a.manufacturer||'—'}</strong><span>{a.model||'—'}</span></div><div><small>{ar?'الرقم التسلسلي':'Serial number'}</small><strong>{a.serial_number||'—'}</strong></div><div className="row-actions"><Link className="btn primary" to={'/assets/'+a.id}>{ar?'فتح الأصل والصيانة':'Open asset & maintenance'}</Link><Link className="btn" to={'/asset-passport/'+a.id}>{ar?'جواز الأصل':'Asset passport'}</Link><Link className="btn" to={'/asset-passport/'+a.id+'?view=tag'}>{ar?'طباعة التاق':'Print tag'}</Link><button className="btn secondary" onClick={()=>{setEditing(editing===a.id?null:a.id)}}>{ar?'مسار العمل':'Work journey'}</button></div>{editing===a.id&&<div className="product-journey"><Link to={'/assets/'+a.id}>{ar?'بيانات الأصل وسجل الصيانة':'Asset record & history'}</Link><Link to="/ppm">{ar?'الوقائية والجدولة':'PPM & scheduling'}</Link><Link to="/corrective">{ar?'البلاغ والإسناد والتنفيذ':'Fault, assignment & execution'}</Link><Link to="/work-orders">{ar?'قطع الغيار والمراجعة والاعتماد والشهادة':'Spares, review, acceptance & certificate'}</Link><Link to="/documents">{ar?'التقارير والشهادات':'Reports & certificates'}</Link></div>}</article>)}
  {rows.length>limit&&<button className="btn" onClick={()=>setLimit(n=>n+40)}>{ar?'عرض المزيد':'Show more'}</button>}
 </section>
}
