import {useEffect,useMemo,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {supabase} from '../lib/supabaseClient'
import {useLanguage} from '../i18n/LanguageContext'
import {useAuth} from '../context/AuthContext'

const label=(x,lang)=>lang==='ar'?(x?.name_ar||x?.name_en||x?.name||x?.code):(x?.name_en||x?.name_ar||x?.name||x?.code)
const active=x=>x?.status==='active'

const blank={
 id:null,code:'',name_ar:'',name_en:'',
 category:'government_entity',sector:'',country_code:'SA',
 source_url:'',source_note:'',
 capabilities:'',website:''
}

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
 const [editorOpen,setEditorOpen]=useState(false),[form,setForm]=useState(blank)
 const [showArchived,setShowArchived]=useState(false)

 const ar=lang==='ar'
 const canEdit=!!access?.super_admin

 const kind=tab==='owners'?'owner':tab==='companies'?'company':'type'

 const load=async()=>{
  setError('')
  try{
   const [a,b,c,o,cl]=await Promise.all([
    supabase.from('bf_ref_facility_owners').select('*').order('name_ar'),
    supabase.from('bf_ref_maintenance_companies').select('*').order('name_ar'),
    supabase.from('bf_ref_facility_types').select('*').order('name_ar'),
    supabase.from('bf_organizations').select('id,name,code,status').order('name'),
    supabase.from('bf_clients').select('id,organization_id,name,code,status').order('name')
   ])
   for(const r of [a,b,c,o,cl])if(r.error)throw r.error
   setOwners(a.data||[]);setCompanies(b.data||[]);setTypes(c.data||[])
   const activeOrgs=(o.data||[]).filter(active)
   setOrgs(activeOrgs);setClients((cl.data||[]).filter(active))
   const projectBatches=await Promise.all(activeOrgs.map(async org=>{
    const {data,error}=await supabase.rpc('bf35_structure',{p_org:org.id})
    if(error)return[]
    return (data?.projects||[]).map(p=>({...p,organization_id:p.organization_id||org.id}))
   }))
   setProjects(projectBatches.flat())
  }catch(e){setError(e.message)}
 }

 useEffect(()=>{load()},[])

 const match=x=>!q||Object.values(x).flat().join(' ').toLowerCase().includes(q.toLowerCase())
 const source=tab==='owners'?owners:tab==='companies'?companies:types
 const rows=useMemo(
  ()=>source.filter(x=>(showArchived||x.status!=='archived')&&match(x)),
  [source,q,showArchived]
 )
 const chosenClients=clients.filter(x=>!siteForm.organization_id||x.organization_id===siteForm.organization_id)

 const open=x=>{
  setSelected(x);setSuccess('');setError('');setProjectId('')
  if(tab==='types')setSiteForm({organization_id:'',client_id:'',name:label(x,lang),city:''})
 }

 const startAdd=()=>{
  setForm(blank);setEditorOpen(true);setSelected(null);setError('');setSuccess('')
 }

 const startEdit=x=>{
  setForm({
   ...blank,...x,
   capabilities:Array.isArray(x.capabilities)?x.capabilities.join(', '):(x.capabilities||'')
  })
  setEditorOpen(true);setError('');setSuccess('')
 }

 const saveReference=async e=>{
  e?.preventDefault()
  try{
   setBusy(true);setError('');setSuccess('')
   const payload={
    code:form.code,
    name_ar:form.name_ar,
    name_en:form.name_en,
    category:form.category,
    sector:form.sector,
    country_code:form.country_code,
    source_url:form.source_url,
    source_note:form.source_note,
    website:form.website,
    capabilities:String(form.capabilities||'').split(',').map(x=>x.trim()).filter(Boolean)
   }
   const {error}=await supabase.rpc('bf_ref_library_save',{
    p_kind:kind,p_id:form.id||null,p_payload:payload
   })
   if(error)throw error
   setSuccess(ar?'تم حفظ السجل في المكتبة.':'Reference saved.')
   setEditorOpen(false);setForm(blank)
   await load()
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const setStatus=async x=>{
  const next=x.status==='archived'?'active':'archived'
  try{
   setBusy(true);setError('');setSuccess('')
   const {error}=await supabase.rpc('bf_ref_library_set_status',{
    p_kind:kind,p_id:x.id,p_status:next
   })
   if(error)throw error
   setSelected(null)
   setSuccess(next==='archived'?(ar?'تمت الأرشفة.':'Archived.'):(ar?'تمت إعادة التفعيل.':'Reactivated.'))
   await load()
  }catch(e){setError(e.message)}finally{setBusy(false)}
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
  const project=projects.find(p=>(p.id||p.project_id)===projectId)
  if(!project){setError(ar?'المشروع غير موجود.':'Project not found.');return}
  if(!(access?.super_admin||can('enterprise-structure.manage',project.organization_id)||can('contracts.manage',project.organization_id))){
   setError(ar?'لا توجد صلاحية لربط شركة بالمشروع.':'You do not have permission to link a company to this project.');return
  }
  try{
   setBusy(true);setError('');setSuccess('')
   const {error}=await supabase.rpc('bf_link_project_contractor',{
    p_project:projectId,p_contractor:x.id
   })
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

 const addLabel=tab==='owners'?(ar?'إضافة مالك / جهة':'Add Owner'):
                tab==='companies'?(ar?'إضافة شركة صيانة':'Add FM Company'):
                (ar?'إضافة نوع مرفق':'Add Facility Type')

 return <section className="facility-module">
  <style>{`
   .ref-card{cursor:pointer;transition:.16s ease;border:1px solid var(--border,#dfe7ef)}
   .ref-card:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(15,45,75,.08)}
   .ref-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
   .ref-detail-grid,.ref-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px}
   .ref-detail{margin:12px 0}.ref-detail h3{margin-top:0}
   .ref-edit-grid label{display:flex;flex-direction:column;gap:5px}
  `}</style>

  <div className="page-head">
   <div>
    <h1>{ar?'مكتبة ملاك المرافق وشركات إدارة وصيانة المرافق':'Facility Owners & FM Companies Library'}</h1>
    <p>{ar?'إضافة وإدارة ملاك المرافق وأنواع المنشآت وشركات إدارة وتشغيل وصيانة المرافق.':'Manage facility owners, facility types and O&M/FM companies.'}</p>
   </div>
   <div className="row-actions">
    {canEdit&&<button className="btn primary" onClick={startAdd}>+ {addLabel}</button>}
    <button className="btn secondary" onClick={()=>history.back()}>{ar?'رجوع':'Back'}</button>
   </div>
  </div>

  {error&&<div className="alert error">{error}</div>}
  {success&&<div className="alert success">{success}</div>}

  <div className="facility-panel">
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
    <button className={'btn '+(tab==='owners'?'primary':'secondary')} onClick={()=>{setTab('owners');setSelected(null);setEditorOpen(false)}}>{ar?`الملاك والجهات (${owners.filter(active).length})`:`Owners (${owners.filter(active).length})`}</button>
    <button className={'btn '+(tab==='companies'?'primary':'secondary')} onClick={()=>{setTab('companies');setSelected(null);setEditorOpen(false)}}>{ar?`شركات الصيانة (${companies.filter(active).length})`:`FM Companies (${companies.filter(active).length})`}</button>
    <button className={'btn '+(tab==='types'?'primary':'secondary')} onClick={()=>{setTab('types');setSelected(null);setEditorOpen(false)}}>{ar?`أنواع المرافق (${types.filter(active).length})`:`Facility Types (${types.filter(active).length})`}</button>
    {canEdit&&<button className="btn primary" onClick={startAdd}>+ {addLabel}</button>}
    <label style={{display:'flex',alignItems:'center',gap:6,marginInlineStart:'auto'}}>
     <input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>
     {ar?'إظهار المؤرشف':'Show archived'}
    </label>
   </div>
   <input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?'بحث بالاسم أو الكود أو القطاع أو الخدمة...':'Search name, code, sector or service...'} style={{width:'100%'}}/>
  </div>

  {editorOpen&&canEdit&&<form className="facility-panel ref-detail" onSubmit={saveReference}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
    <h2>{form.id?(ar?'تعديل السجل':'Edit Reference'):addLabel}</h2>
    <button type="button" className="btn secondary" onClick={()=>setEditorOpen(false)}>{ar?'إغلاق':'Close'}</button>
   </div>
   <div className="ref-edit-grid">
    <label>{ar?'الكود':'Code'}<input required value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))}/></label>
    <label>{ar?'الاسم العربي':'Arabic name'}<input required value={form.name_ar} onChange={e=>setForm(f=>({...f,name_ar:e.target.value}))}/></label>
    <label>{ar?'الاسم الإنجليزي':'English name'}<input value={form.name_en||''} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))}/></label>

    {tab==='owners'&&<>
     <label>{ar?'التصنيف':'Category'}<input value={form.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></label>
     <label>{ar?'القطاع':'Sector'}<input value={form.sector||''} onChange={e=>setForm(f=>({...f,sector:e.target.value}))}/></label>
     <label>{ar?'رمز الدولة':'Country code'}<input value={form.country_code||'SA'} onChange={e=>setForm(f=>({...f,country_code:e.target.value}))}/></label>
     <label>{ar?'الموقع/المصدر':'Source URL'}<input value={form.source_url||''} onChange={e=>setForm(f=>({...f,source_url:e.target.value}))}/></label>
    </>}

    {tab==='companies'&&<>
     <label>{ar?'الموقع الإلكتروني':'Website'}<input value={form.website||''} onChange={e=>setForm(f=>({...f,website:e.target.value}))}/></label>
     <label style={{gridColumn:'1/-1'}}>{ar?'الخدمات والتخصصات - افصل بفاصلة':'Capabilities - comma separated'}
      <input value={form.capabilities||''} onChange={e=>setForm(f=>({...f,capabilities:e.target.value}))}
       placeholder="facility_management, HVAC, MEP, fire_fighting, cleaning"/>
     </label>
    </>}

    {tab!=='types'&&<label style={{gridColumn:'1/-1'}}>{ar?'ملاحظات المصدر':'Source notes'}
     <textarea value={form.source_note||''} onChange={e=>setForm(f=>({...f,source_note:e.target.value}))}/>
    </label>}
   </div>
   <div className="row-actions" style={{marginTop:14}}>
    <button type="submit" className="btn primary" disabled={busy}>{ar?'حفظ':'Save'}</button>
    <button type="button" className="btn secondary" onClick={()=>setForm(blank)}>{ar?'جديد':'New'}</button>
   </div>
  </form>}

  {selected&&<div className="facility-panel ref-detail">
   <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
    <div>
     <small>{selected.code}</small>
     <h3>{label(selected,lang)}</h3>
     {selected.sector&&<p>{selected.sector}</p>}
     {selected.status==='archived'&&<span className="status-badge">{ar?'مؤرشف':'Archived'}</span>}
    </div>
    <div className="row-actions">
     {canEdit&&<button className="btn primary" onClick={()=>startEdit(selected)}>{ar?'تعديل':'Edit'}</button>}
     {canEdit&&<button className="btn secondary" disabled={busy} onClick={()=>setStatus(selected)}>
      {selected.status==='archived'?(ar?'إعادة تفعيل':'Reactivate'):(ar?'أرشفة':'Archive')}
     </button>}
     <button className="btn xs secondary" onClick={()=>setSelected(null)}>{ar?'إغلاق':'Close'}</button>
    </div>
   </div>

   {Array.isArray(selected.capabilities)&&selected.capabilities.length>0&&
    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
     {selected.capabilities.map(c=><span className="security-pill pass" key={c}>{c.replaceAll('_',' ')}</span>)}
    </div>}

   {selected.website&&<div className="ref-actions">
    <a className="btn secondary" href={selected.website} target="_blank" rel="noreferrer">{ar?'الموقع الإلكتروني':'Website'}</a>
   </div>}

   {tab==='owners'&&selected.status!=='archived'&&<div className="ref-actions">
    <button className="btn primary" disabled={busy} onClick={()=>adoptOwner(selected)}>{ar?'اعتماد كمنظمة تشغيلية':'Use as Organization'}</button>
   </div>}

   {tab==='companies'&&selected.status!=='archived'&&<div className="ref-detail-grid">
    <label>{ar?'المشروع':'Project'}
     <select value={projectId} onChange={e=>setProjectId(e.target.value)}>
      <option value="">{ar?'اختر المشروع':'Select project'}</option>
      {projects.map(p=>{
       const id=p.id||p.project_id
       return <option key={id} value={id}>{p.name||p.project_name||p.project_code}</option>
      })}
     </select>
    </label>
    <div style={{alignSelf:'end'}}>
     <button className="btn primary" disabled={busy||!projectId} onClick={()=>linkCompany(selected)}>{ar?'ربط بالمشروع':'Link to Project'}</button>
    </div>
   </div>}

   {tab==='types'&&selected.status!=='archived'&&<div className="ref-detail-grid">
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
     <small style={{display:'block',marginTop:8}}>{x.status==='archived'?(ar?'مؤرشف':'Archived'):(ar?'اضغط لعرض التفاصيل والإجراءات':'Click for details and actions')}</small>
    </div>
   </article>)}
  </div>
 </section>
}
