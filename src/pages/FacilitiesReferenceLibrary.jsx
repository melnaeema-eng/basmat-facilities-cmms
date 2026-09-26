import {useEffect,useMemo,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {supabase} from '../lib/supabaseClient'
import {useLanguage} from '../i18n/LanguageContext'
import {useAuth} from '../context/AuthContext'

const label=(x,lang)=>lang==='ar'?(x?.name_ar||x?.name_en||x?.name||x?.code):(x?.name_en||x?.name_ar||x?.name||x?.code)
const active=x=>x?.status==='active'

export default function FacilitiesReferenceLibrary(){
 const {lang}=useLanguage()
 const {can,access}=useAuth()
 const navigate=useNavigate()
 const [owners,setOwners]=useState([]),[companies,setCompanies]=useState([]),[types,setTypes]=useState([])
 const [projects,setProjects]=useState([]),[orgs,setOrgs]=useState([]),[clients,setClients]=useState([])
 const [tab,setTab]=useState('owners'),[q,setQ]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [selected,setSelected]=useState(null),[busy,setBusy]=useState(false)
 const [projectId,setProjectId]=useState('')
 const [siteForm,setSiteForm]=useState({organization_id:'',client_id:'',name:'',city:''})

 const ar=lang==='ar'
 const load=async()=>{
  setError('')
  try{
   const [a,b,c,o,cl]=await Promise.all([
    supabase.from('bf_ref_facility_owners').select('*').eq('status','active').order('name_ar'),
    supabase.from('bf_ref_maintenance_companies').select('*').eq('status','active').order('name_ar'),
    supabase.from('bf_ref_facility_types').select('*').eq('status','active').order('name_ar'),
    supabase.from('bf_organizations').select('id,name,code,status').order('name'),
    supabase.from('bf_clients').select('id,organization_id,name,code,status').order('name')
   ])
   for(const r of [a,b,c,o,cl])if(r.error)throw r.error
   setOwners(a.data||[]);setCompanies(b.data||[]);setTypes(c.data||[])
   const activeOrgs=(o.data||[]).filter(active)
   setOrgs(activeOrgs);setClients((cl.data||[]).filter(active))

   const projectBatches=await Promise.all(activeOrgs.map(async org=>{
    const {data,error}=await supabase.rpc('bf35_structure',{p_org:org.id})
    if(error)return []
    return (data?.projects||[]).map(p=>({...p,organization_id:p.organization_id||org.id}))
   }))
   setProjects(projectBatches.flat())
  }catch(e){setError(e.message)}
 }

 useEffect(()=>{load()},[])

 const match=x=>!q||Object.values(x).flat().join(' ').toLowerCase().includes(q.toLowerCase())
 const rows=useMemo(
  ()=>tab==='owners'?owners.filter(match):tab==='companies'?companies.filter(match):types.filter(match),
  [tab,q,owners,companies,types]
 )
 const chosenClients=clients.filter(x=>!siteForm.organization_id||x.organization_id===siteForm.organization_id)

 const open=x=>{
  setSelected(x);setSuccess('');setError('');setProjectId('')
  if(tab==='types'){
   setSiteForm({organization_id:'',client_id:'',name:label(x,lang),city:''})
  }
 }

 const adoptOwner=async x=>{
  if(!(access?.super_admin||can('organizations.manage'))){
   setError(ar?'لا توجد صلاحية لإنشاء منظمة.':'You do not have permission to create an organization.');return
  }
  try{
   setBusy(true);setError('');setSuccess('')
   const name=(x.name_ar||x.name_en||x.code||'').trim()
   const {data:existing,error:readError}=await supabase.from('bf_organizations').select('id,name').limit(1000)
   if(readError)throw readError
   const found=(existing||[]).find(r=>String(r.name||'').trim().toLowerCase()===name.toLowerCase())
   if(found){
    setSuccess(ar?'الجهة موجودة مسبقاً وتم فتح قائمة المنظمات.':'Organization already exists. Opening organizations.')
    setTimeout(()=>navigate('/organizations'),350);return
   }
   const {error}=await supabase.from('bf_organizations').insert({name,status:'active'})
   if(error)throw error
   setSuccess(ar?'تم اعتماد الجهة كمنظمة تشغيلية.':'Owner adopted as an operational organization.')
   setTimeout(()=>navigate('/organizations'),450)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const linkCompany=async x=>{
  if(!projectId){setError(ar?'اختر المشروع أولاً.':'Select a project first.');return}
  const project=projects.find(p=>p.id===projectId)
  if(!project){setError(ar?'المشروع غير موجود.':'Project not found.');return}
  if(!(access?.super_admin||can('enterprise-structure.manage',project.organization_id)||can('contracts.manage',project.organization_id))){
   setError(ar?'لا توجد صلاحية لربط شركة بالمشروع.':'You do not have permission to link a company to this project.');return
  }
  try{
   setBusy(true);setError('');setSuccess('')
   const {error}=await supabase.from('bf_project_contractors').upsert({
    project_id:projectId,
    contractor_ref_id:x.id,
    relationship_role:'primary_fm_contractor',
    contract_reference:null,
    notes:'Selected from Facilities Reference Library'
   },{onConflict:'project_id,contractor_ref_id,relationship_role'})
   if(error)throw error
   setSuccess(ar?'تم ربط شركة الصيانة بالمشروع.':'FM company linked to the project.')
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const createSiteFromType=async x=>{
  const {organization_id,client_id,name,city}=siteForm
  if(!organization_id||!client_id||!name.trim()){
   setError(ar?'المنظمة والعميل واسم الموقع مطلوبة.':'Organization, client and site name are required.');return
  }
  if(!(access?.super_admin||can('sites.manage',organization_id))){
   setError(ar?'لا توجد صلاحية لإنشاء موقع لهذه المنظمة.':'You do not have permission to create a site for this organization.');return
  }
  try{
   setBusy(true);setError('');setSuccess('')
   const {error}=await supabase.from('bf_sites').insert({
    organization_id,client_id,name:name.trim(),city:city.trim()||null,
    status:'active',facility_type_ref_id:x.id
   })
   if(error)throw error
   setSuccess(ar?'تم إنشاء الموقع وربطه بنوع المرفق.':'Site created and linked to the facility type.')
   setTimeout(()=>navigate('/sites'),450)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 return <section className="facility-module">
  <style>{`
   .ref-card{cursor:pointer;transition:.16s ease;border:1px solid var(--border,#dfe7ef)}
   .ref-card:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(15,45,75,.08)}
   .ref-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
   .ref-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px}
   .ref-detail{margin:12px 0}
   .ref-detail h3{margin-top:0}
  `}</style>

  <div className="page-head">
   <div>
    <h1>{ar?'مكتبة ملاك المرافق وشركات إدارة وصيانة المرافق':'Facility Owners & FM Companies Library'}</h1>
    <p>{ar?'دليل تشغيلي لملاك المرافق وأنواع المنشآت وشركات إدارة وتشغيل وصيانة المرافق.':'Operational directory for facility owners, facility types and O&M/FM companies.'}</p>
   </div>
   <button className="btn secondary" onClick={()=>history.back()}>{ar?'رجوع':'Back'}</button>
  </div>

  {error&&<div className="alert error">{error}</div>}
  {success&&<div className="alert success">{success}</div>}

  <div className="facility-panel">
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
    <button className={'btn '+(tab==='owners'?'primary':'secondary')} onClick={()=>{setTab('owners');setSelected(null)}}>{ar?`الوزارات والجهات (${owners.length})`:`Owners (${owners.length})`}</button>
    <button className={'btn '+(tab==='companies'?'primary':'secondary')} onClick={()=>{setTab('companies');setSelected(null)}}>{ar?`شركات إدارة وصيانة المرافق (${companies.length})`:`FM Companies (${companies.length})`}</button>
    <button className={'btn '+(tab==='types'?'primary':'secondary')} onClick={()=>{setTab('types');setSelected(null)}}>{ar?`أنواع المرافق (${types.length})`:`Facility Types (${types.length})`}</button>
   </div>
   <input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?'بحث بالاسم أو القطاع أو الخدمة...':'Search name, sector or service...'} style={{width:'100%'}}/>
  </div>

  {selected&&<div className="facility-panel ref-detail">
   <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
    <div>
     <small>{selected.code}</small>
     <h3>{label(selected,lang)}</h3>
     {selected.sector&&<p>{selected.sector}</p>}
    </div>
    <button className="btn xs secondary" onClick={()=>setSelected(null)}>{ar?'إغلاق':'Close'}</button>
   </div>

   {Array.isArray(selected.capabilities)&&selected.capabilities.length>0&&
    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
     {selected.capabilities.map(c=><span className="security-pill pass" key={c}>{c.replaceAll('_',' ')}</span>)}
    </div>}

   {selected.website&&<div className="ref-actions">
    <a className="btn secondary" href={selected.website} target="_blank" rel="noreferrer">{ar?'الموقع الإلكتروني':'Website'}</a>
   </div>}

   {tab==='owners'&&<div className="ref-actions">
    <button className="btn primary" disabled={busy} onClick={()=>adoptOwner(selected)}>{ar?'اعتماد كمنظمة تشغيلية':'Use as Organization'}</button>
   </div>}

   {tab==='companies'&&<div className="ref-detail-grid">
    <label>{ar?'المشروع':'Project'}
     <select value={projectId} onChange={e=>setProjectId(e.target.value)}>
      <option value="">{ar?'اختر المشروع':'Select project'}</option>
      {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <div style={{alignSelf:'end'}}>
     <button className="btn primary" disabled={busy||!projectId} onClick={()=>linkCompany(selected)}>{ar?'ربط بالمشروع':'Link to Project'}</button>
    </div>
   </div>}

   {tab==='types'&&<div className="ref-detail-grid">
    <label>{ar?'المنظمة':'Organization'}
     <select value={siteForm.organization_id} onChange={e=>setSiteForm(f=>({...f,organization_id:e.target.value,client_id:''}))}>
      <option value="">{ar?'اختر':'Select'}</option>
      {orgs.map(o=><option key={o.id} value={o.id}>{o.name||o.code}</option>)}
     </select>
    </label>
    <label>{ar?'العميل':'Client'}
     <select value={siteForm.client_id} onChange={e=>setSiteForm(f=>({...f,client_id:e.target.value}))}>
      <option value="">{ar?'اختر':'Select'}</option>
      {chosenClients.map(c=><option key={c.id} value={c.id}>{c.name||c.code}</option>)}
     </select>
    </label>
    <label>{ar?'اسم الموقع':'Site name'}<input value={siteForm.name} onChange={e=>setSiteForm(f=>({...f,name:e.target.value}))}/></label>
    <label>{ar?'المدينة':'City'}<input value={siteForm.city} onChange={e=>setSiteForm(f=>({...f,city:e.target.value}))}/></label>
    <div style={{alignSelf:'end'}}>
     <button className="btn primary" disabled={busy} onClick={()=>createSiteFromType(selected)}>{ar?'إنشاء موقع بهذا النوع':'Create Site from Type'}</button>
    </div>
   </div>}
  </div>}

  <div className="security-check-list">
   {rows.map(x=><article className="security-check-card ref-card" key={`${tab}-${x.id}`} onClick={()=>open(x)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')open(x)}}>
    <div>
     <strong>{label(x,lang)}</strong>
     <p>{x.code}{x.sector?` · ${x.sector}`:''}</p>
     {Array.isArray(x.capabilities)&&x.capabilities.length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{x.capabilities.map(c=><span className="security-pill pass" key={c}>{c.replaceAll('_',' ')}</span>)}</div>}
     <small style={{display:'block',marginTop:8}}>{ar?'اضغط لعرض التفاصيل والإجراءات':'Click for details and actions'}</small>
    </div>
   </article>)}
  </div>
 </section>
}
