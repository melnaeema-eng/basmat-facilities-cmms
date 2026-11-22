import CompanyField from '../components/CompanyField'

import {useEffect,useMemo,useRef,useState} from 'react'
import {Link,useLocation,useNavigate,useOutletContext} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {loadPPM,ppmAction,frequencies,findMedicalPpmAsset,facilityOemTemplates,importFacilityOemTemplate} from '../lib/ppm'
import {Field,Select,Dialog,Notice,Status,FormActions} from '../components/FacilityFields'
import DataTable from '../components/DataTable'
import {focusNextField} from '../lib/smartLanguage'
import {procedurePlanMismatch} from '../lib/ppmCore'
import PreventiveAssetDesk from '../components/PreventiveAssetDesk'
import GuidedDevicePPM from '../components/GuidedDevicePPM'
import MedicalOemProcedure from '../components/MedicalOemProcedure'
const blankProcedure={organization_id:'',name_ar:'',name_en:'',category_id:'',manufacturer:'',model:'',frequency:'monthly',reference:'',estimated_minutes:60}
const blankPlan={organization_id:'',asset_id:'',procedure_id:'',contract_id:'',start_date:'',interval_count:1}
const workflowSteps=[
 ['ppmGuideProcedure','ppmGuideProcedureHelp'],
 ['ppmGuideApprove','ppmGuideApproveHelp','procedures','ppmProcedures'],
 ['ppmGuidePlan','ppmGuidePlanHelp','plans','ppmPlans'],
 ['ppmGuideSchedule','ppmGuideScheduleHelp','jobs','ppmSchedule']
]
export default function PPM(){
 const {can}=useAuth(),{t,lang}=useLanguage(),navigate=useNavigate()
 const workspaceId=useOutletContext()
 const location=useLocation()
 const deskAsset=new URLSearchParams(location.search).get('asset')||''
 const saving=useRef(false)
 const [deskForm,setDeskForm]=useState(!!location.state?.pendingDeskForm)
 const openDeskAsset=(id,{replace=false}={})=>{
  const params=new URLSearchParams()
  if(id)params.set('asset',id)
  navigate({pathname:'/ppm',search:params.toString()},{replace})
  setTab('desk')
 }
 const L=(ar,en)=>lang==='ar'?ar:en
 const requestedPlan=location.state?.resumePlan
 const resumePlan=requestedPlan&&(!workspaceId||requestedPlan.organization_id===workspaceId)&&(can('ppm.manage',requestedPlan.organization_id)||can('facilities.ppm.manage',requestedPlan.organization_id)||can('medical.ppm.manage',requestedPlan.organization_id))?requestedPlan:null
 const requestedProcedure=location.state?.planProcedure
 const planProcedure=requestedProcedure&&(!workspaceId||requestedProcedure.organization_id===workspaceId)
  &&(can('ppm.manage',requestedProcedure.organization_id)||can('facilities.ppm.manage',requestedProcedure.organization_id)
   ||can('medical.ppm.manage',requestedProcedure.organization_id))?requestedProcedure:null
 const [preferredProcedureId,setPreferredProcedureId]=useState(planProcedure?.id||'')
 const [showProcedurePicker,setShowProcedurePicker]=useState(!!planProcedure)
 const [procedureQuery,setProcedureQuery]=useState(planProcedure?.code||'')
 const [pendingPlan,setPendingPlan]=useState(null)
 const [medicalEntry,setMedicalEntry]=useState(null)
 const [showOem,setShowOem]=useState(false)
 const [templatePicker,setTemplatePicker]=useState(null)
 const [templateId,setTemplateId]=useState('')
 const [data,setData]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false)
 const [year,setYear]=useState(new Date().getFullYear()),[month,setMonth]=useState(0)
 const [tab,setTab]=useState(resumePlan||planProcedure?'plans':'desk'),[form,setForm]=useState(resumePlan||(planProcedure?{
  ...blankPlan,organization_id:planProcedure.organization_id,start_date:new Date().toISOString().slice(0,10)
 }:blankProcedure)),[open,setOpen]=useState(!!(resumePlan||planProcedure)),[query,setQuery]=useState(''),[filter,setFilter]=useState('')
 useEffect(()=>{
  if(new URLSearchParams(location.search).get('tab')!=='plans')return
  setTab('plans');setQuery('');setFilter('')
 },[location.key,location.search])
 const load=async()=>{setError('');try{setData(await loadPPM())}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[])
 const name=x=>lang==='ar'?x?.name_ar||x?.name_en||x?.name:x?.name_en||x?.name_ar||x?.name
 const options=(rows,label)=>[{value:'',label:t('select')},...(rows||[]).map(x=>({value:x.id,label:label(x)}))]
 const procedures=data?.procedures||[],plans=data?.plans||[],jobs=data?.jobs||[]
 const matchRank=(p,a,org)=>{
  if(procedurePlanMismatch(p,a,org))return -1
  if(p.model)return 40
  if(p.manufacturer)return 30
  if(p.category_id)return 20
  return 10
 }
 const matchingProcedures=(assetId=form.asset_id,org=form.organization_id)=>{
  const a=data?.assets.find(x=>x.id===assetId)
  if(!a||a.status!=='active'||a.organization_id!==org)return[]
  return procedures.map(p=>({p,rank:matchRank(p,a,org)})).filter(x=>x.rank>=0).sort((a,b)=>Number(b.p.status==='approved')-Number(a.p.status==='approved')||b.rank-a.rank||(Number(b.p.version||1)-Number(a.p.version||1))).map(x=>x.p)
 }
 const selectedAsset=data?.assets.find(a=>a.id===form.asset_id)
 const suggestedProcedures=matchingProcedures()
 const canManageFacilityPlan=org=>can('ppm.manage',org)||can('facilities.ppm.manage',org)
 const canCreateForAsset=selectedAsset?.status==='active'&&selectedAsset.organization_id===form.organization_id&&canManageFacilityPlan(form.organization_id)
 const inspectedAsset=open&&tab==='plans'?selectedAsset:null
 const inspectedAssetId=inspectedAsset?.id
 const inspectedCompanyId=inspectedAsset?.organization_id
 const medicalAssetId=medicalEntry?.assetId===inspectedAssetId?medicalEntry?.medicalAssetId:null
 const canManageMedicalAsset=!!medicalAssetId&&can('medical.ppm.manage',inspectedCompanyId)
 // The plan API accepts either product's management permission. Approval and activation still enforce OEM requirements.
 const applicableProcedures=canCreateForAsset||can('medical.ppm.manage',form.organization_id)?suggestedProcedures:[]
 const lookup=procedureQuery.trim().toLowerCase()
 const libraryResults=lookup?procedures.filter(p=>p.organization_id===form.organization_id&&
  [p.code,p.name_ar,p.name_en].some(value=>value?.toLowerCase().includes(lookup))).slice(0,20):applicableProcedures.slice(0,20)
 const canSubmitPlan=applicableProcedures.some(p=>p.id===form.procedure_id)
 const assetTemplates=templatePicker?.assetId===inspectedAssetId?templatePicker:null
 useEffect(()=>{
  if(!inspectedAssetId||!inspectedCompanyId)return
  let active=true
  findMedicalPpmAsset(inspectedAssetId,inspectedCompanyId).then(
   id=>{if(active)setMedicalEntry({assetId:inspectedAssetId,medicalAssetId:id})},
   ()=>{if(active)setMedicalEntry({assetId:inspectedAssetId,medicalAssetId:null})}
  )
  return()=>{active=false}
 },[inspectedAssetId,inspectedCompanyId])
 useEffect(()=>{
  if(!inspectedAssetId||!canCreateForAsset)return
  let active=true
  facilityOemTemplates(inspectedAssetId).then(
   templates=>{if(active){setTemplatePicker({assetId:inspectedAssetId,templates});setTemplateId('')}},
   ()=>{if(active)setTemplatePicker({assetId:inspectedAssetId,failed:true,templates:[]})}
  )
  return()=>{active=false}
 },[inspectedAssetId,canCreateForAsset])
 const importTemplate=async()=>{
  if(busy||!assetTemplates?.templates.some(row=>row.id===templateId))return
  setBusy(true);setError('')
  try{
   const id=await importFacilityOemTemplate(inspectedAssetId,templateId)
   navigate('/ppm/procedure/'+id,{state:{pendingPlan:form,ppmDeskAsset:deskForm?form.asset_id:null}})
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const change=(key,value)=>setForm(f=>{
  if(key==='organization_id')return {...f,organization_id:value,asset_id:'',procedure_id:'',contract_id:'',category_id:''}
  if(key==='asset_id'){
   const matches=matchingProcedures(value,f.organization_id)
   const selected=preferredProcedureId?matches.find(p=>p.id===preferredProcedureId):matches.find(p=>p.status==='approved')
   return {...f,asset_id:value,procedure_id:selected?.id||'',contract_id:''}
  }
  return {...f,[key]:value}
 })
 const rows=useMemo(()=>{
  if(['desk','asset'].includes(tab))return []
  const source=tab==='procedures'?procedures:tab==='plans'?plans:jobs
  return source.filter(x=>(tab!=='jobs'||(x.due_date?.startsWith(String(year))&&(!month||Number(x.due_date.slice(5,7))===month)))&&(!filter||x.status===filter)&&(!query||Object.values(x).some(v=>typeof v==='string'&&v.toLowerCase().includes(query.toLowerCase()))))
 },[data,tab,query,filter,year,month])
 const startDeskPlan=(asset,procedureId,values={})=>{
  setDeskForm(true)
  setPreferredProcedureId('');setProcedureQuery('');setShowProcedurePicker(false)
  setShowOem(false)
  setError('')
  setSuccess('')
  setTab('plans')
  const siteContract=data.sites.find(site=>site.id===asset.site_id)?.contract_id
  const contract=data.contracts.find(row=>row.id===siteContract&&row.status==='active'&&
   row.organization_id===asset.organization_id&&row.client_id===asset.client_id)
  setForm({...blankPlan,start_date:new Date().toISOString().slice(0,10),contract_id:contract?.id||'',...values,
   organization_id:asset.organization_id,asset_id:asset.id,procedure_id:procedureId||''})
  setOpen(true)
 }
 const start=()=>{setDeskForm(false);setPendingPlan(null);setPreferredProcedureId('');setProcedureQuery('');setShowProcedurePicker(false);setForm(tab==='procedures'?blankProcedure:{...blankPlan,start_date:new Date().toISOString().slice(0,10)});setOpen(true);setError('')}
 const startProcedureForAsset=()=>{
  if(!canCreateForAsset)return
  setPendingPlan(form)
  const category=data.categories.find(row=>row.id===selectedAsset.category_id&&row.organization_id===form.organization_id)
  setForm({...blankProcedure,organization_id:form.organization_id,category_id:category?.id||'',
   manufacturer:selectedAsset.manufacturer||'',model:selectedAsset.model||''})
  setTab('procedures');setError('')
 }
 const closeForm=()=>{
  if(busy)return
  setError('')
  if(pendingPlan){setTab('plans');setForm(pendingPlan);setPendingPlan(null)}
  else{setOpen(false);if(deskForm)setTab('desk')}
 }
 const submit=async e=>{
  e.preventDefault()
  const kind=tab==='procedures'?'procedure':'plan'
  if(saving.current||busy||(kind==='plan'?!canSubmitPlan:!can('ppm.manage',form.organization_id)))return
  saving.current=true
  setBusy(true);setError('');setSuccess('')
  try{
   const procedure=suggestedProcedures.find(p=>p.id===form.procedure_id)
   const payload=kind==='plan'&&procedure?.status==='draft'?{...form,allow_draft_procedure:true}:form
   const id=await ppmAction(kind,null,'create',payload)
   setOpen(false)
   if(kind==='plan'){
    setDeskForm(false)
    openDeskAsset(form.asset_id,{replace:true})
    setSuccess(L('تم حفظ الخطة لهذه المعدة.','Plan saved for this asset.'))
    await load()
    return
   }
   navigate('/ppm/procedure/'+id,{state:pendingPlan?{pendingPlan,ppmDeskAsset:deskForm?pendingPlan.asset_id:null}:null})
  }catch(e){setError(e.message)}finally{saving.current=false;setBusy(false)}
 }
 const run=async(kind,id,command,payload={})=>{
  if(!confirm(t('confirmAction')))return
  setBusy(true);setError('')
  try{await ppmAction(kind,id,command,payload);await load();setSuccess(t('saved'))}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const selectTab=next=>{setTab(next);setFilter('');setQuery('')}
 const canManage=tab==='plans'?(canManageFacilityPlan(workspaceId)||can('medical.ppm.manage',workspaceId)):can('ppm.manage')
 const columns=[
  {key:'code',label:t(tab==='jobs'?'jobNumber':tab==='plans'?'planCode':'procedureCode'),render:x=><Link to={'/ppm/'+(tab==='procedures'?'procedure':tab==='plans'?'plan':'job')+'/'+x.id}>{x.code||x.job_number}</Link>},
  {key:'name',label:t(tab==='procedures'?'procedure':tab==='plans'?'asset':'plan'),render:x=>tab==='procedures'?name(x):tab==='plans'?(data?.assets.find(a=>a.id===x.asset_id)?.asset_tag||'—'):(data?.plans.find(p=>p.id===x.plan_id)?.code||'—')},
  {key:'frequency',label:t(tab==='jobs'?'dueDate':'frequency'),render:x=>tab==='jobs'?x.due_date:t(x.frequency)},
  {key:'status',label:t('status'),render:x=><Status value={x.status}/>},
  {key:'actions',label:t('actions'),render:x=><div className="row-actions"><Link className="btn xs secondary" to={'/ppm/'+(tab==='procedures'?'procedure':tab==='plans'?'plan':'job')+'/'+x.id}>{t('details')}</Link>
   {tab==='plans'&&can('ppm.manage',x.organization_id)&&x.status==='draft'&&procedures.some(p=>p.id===x.procedure_id&&p.status==='approved')&&<button className="btn xs primary" disabled={busy} onClick={()=>run('plan',x.id,'activate')}>{t('activate')}</button>}
   </div>}
 ]
 const annual=jobs.filter(j=>j.due_date?.startsWith(String(year)))
 return <section className="facility-module">
  <div className="page-head"><h1>{t('ppm')}</h1><div className="row-actions"><button className="btn secondary" onClick={load}>{t('refresh')}</button>{canManage&&['procedures','plans'].includes(tab)&&<button className="btn primary" onClick={start}>{t(tab==='procedures'?'newProcedure':'newPlan')}</button>}</div></div>
  <Notice error={open?'':error} success={success}/>
  <details className="facility-panel">
   <summary><strong>{t('ppmGuideTitle')}</strong></summary>
   <ol className="form-grid" style={{paddingInlineStart:24,marginBlockEnd:0}}>
    {workflowSteps.map(([title,help,key,label])=><li key={title}>
     <strong>{t(title)}</strong>
     <p className="muted">{t(help)}</p>
     {title==='ppmGuideProcedure'&&can('assets.view')&&<Link className="btn xs secondary" to="/library-deployment">{t('ppmGuideLibrary')}</Link>}
     {key&&tab!==key&&<button type="button" className="btn xs secondary" onClick={()=>selectTab(key)}>{t(label)}</button>}
    </li>)}
   </ol>
  </details>
  <div className="row-actions module-tabs" role="group" aria-label={t('ppm')}>
   {[['desk',L('حسب المعدة','By asset')],['jobs',t('ppmSchedule')],['procedures',t('ppmProcedures')],['plans',t('ppmPlans')],['asset',L('تنفيذ المهام','Task execution')]].map(([key,label])=>
    <button type="button" key={key} className={'btn '+(tab===key?'primary':'secondary')} aria-pressed={tab===key} onClick={()=>selectTab(key)}>{label}</button>)}
  </div>
  {tab==='desk'&&(data?<PreventiveAssetDesk data={data} companyId={workspaceId} assetId={deskAsset}
   onAsset={openDeskAsset} canPlan={asset=>canManageFacilityPlan(asset.organization_id)||can('medical.ppm.manage',asset.organization_id)} matchingProcedures={matchingProcedures} onCreatePlan={startDeskPlan}/>:!error&&<p role="status">{t('loading')}</p>)}
   {tab==='asset'&&data&&<GuidedDevicePPM data={data} onRefresh={load}/>}
  {!['desk','asset'].includes(tab)&&<>
  {tab==='jobs'&&<div className="facility-panel"><div className="filter-grid"><Field label={t('year')}><Select value={String(year)} onChange={v=>{setYear(Number(v));setMonth(0)}} options={[year-1,year,year+1].map(v=>({value:String(v),label:String(v)}))}/></Field><Field label={t('month')}><Select value={String(month)} onChange={v=>setMonth(Number(v))} options={[{value:'0',label:t('all')},...Array.from({length:12},(_,i)=>({value:String(i+1),label:new Date(2026,i,1).toLocaleString(lang,{month:'long'})}))]}/></Field></div><div className="stats-grid facility-stats">{Array.from({length:12},(_,i)=><button type="button" key={i} className={'stat-card '+(month===i+1?'active':'')} onClick={()=>setMonth(month===i+1?0:i+1)}><span>{new Date(2026,i,1).toLocaleString(lang,{month:'short'})}</span><strong>{annual.filter(j=>Number(j.due_date.slice(5,7))===i+1).length}</strong></button>)}</div></div>}
  {tab==='jobs'&&<div className="stats-grid facility-stats">{[['ppmJobs',annual.length],['scheduled',annual.filter(x=>x.status==='scheduled').length],['completed',annual.filter(x=>['completed','approved','closed'].includes(x.status)).length],['closed',annual.filter(x=>x.status==='closed').length]].map(([key,value])=><div className="stat-card" key={key}><span>{t(key)}</span><strong>{value}</strong></div>)}</div>}
  <div className="facility-panel filter-grid"><Field label={t('search')}><input value={query} onChange={e=>setQuery(e.target.value)}/></Field><Field label={t('status')}><Select value={filter} onChange={setFilter} options={[{value:'',label:t('all')},...(tab==='procedures'?['draft','approved','archived']:tab==='plans'?['draft','active','paused','archived']:['scheduled','assigned','in_progress','completed','approved','closed','cancelled']).map(v=>({value:v,label:t(v)}))]}/></Field></div>
  {!data?<p>{t('loading')}</p>:<DataTable rows={rows} columns={columns} emptyText={t('noData')}/>}
  {tab==='jobs'&&data&&<div className="facility-panel"><h3>{t('ppmSchedule')}</h3><div className="form-grid"><Field label={t('frequency')}><p>{t('scheduleNotice')}</p></Field><Field label={t('dueDate')}><p>{annual.length} {t('ppmJobs')}</p></Field></div></div>}
  </>}
  {tab==='asset'&&!data&&!error&&<p role="status">{t('loading')}</p>}
  <Dialog open={open} title={showOem?(lang==='ar'?'إضافة إجراء من دليل المصنع':'Add a manufacturer procedure'):t(tab==='procedures'?'newProcedure':'newPlan')} onClose={showOem?()=>!busy&&setShowOem(false):closeForm}>
   {showOem?<MedicalOemProcedure organizationId={form.organization_id} asset={selectedAsset} busy={busy} setBusy={setBusy}
    onCancel={()=>setShowOem(false)} onSave={id=>navigate('/ppm/procedure/'+id,{state:{pendingPlan:form,ppmDeskAsset:deskForm?form.asset_id:null}})}/>:<>
   <form className="facility-form" onSubmit={submit}>
    <Notice error={error}/>
    {tab==='plans'&&preferredProcedureId&&!selectedAsset&&<p className="muted">{t('ppmChooseAssetForProcedure')} · {procedureQuery}</p>}
    <div className="form-grid">
    {!deskForm&&!pendingPlan&&<CompanyField label={t('organization')} required><Select required value={form.organization_id} onChange={v=>change('organization_id',v)} options={options(data?.organizations.filter(x=>x.status==='active'&&(can('ppm.manage',x.id)||(tab==='plans'&&(canManageFacilityPlan(x.id)||can('medical.ppm.manage',x.id))))),name)}/></CompanyField>}
    {pendingPlan&&<p className="muted span-2">{t('asset')} · {data?.assets.find(a=>a.id===pendingPlan.asset_id)?.asset_tag}</p>}
    {tab==='procedures'?<>
     {['name_ar','name_en'].map(key=><Field key={key} label={t(key==='name_ar'?'nameAr':'nameEn')} required><input name={key} required value={form[key]} onChange={e=>change(key,e.target.value)} onBlur={e=>e.target.value&&focusNextField(e.target)}/></Field>)}
     <Field label={t('category')}><Select value={form.category_id} onChange={v=>change('category_id',v)} options={options(data?.categories.filter(x=>x.organization_id===form.organization_id),name)}/></Field>
     {['manufacturer','model','reference'].map(key=><Field key={key} label={t(key)}><input value={form[key]} onChange={e=>change(key,e.target.value)}/></Field>)}
     <Field label={t('frequency')}><Select value={form.frequency} onChange={v=>change('frequency',v)} options={frequencies.map(v=>({value:v,label:t(v)}))}/></Field>
     <Field label={t('estimatedMinutes')}><input required type="number" min="1" value={form.estimated_minutes} onChange={e=>change('estimated_minutes',e.target.value)}/></Field>
     <p className="muted span-2">{t('ppmManualReferenceHelp')}</p>
     <p className="muted span-2">{t('procedureNotice')}</p>
    </>:<>
     {deskForm&&selectedAsset?<p className="span-2"><strong>{name(selectedAsset)} · <bdi>{selectedAsset.asset_tag}</bdi></strong></p>:
     <Field label={t('asset')} required><Select required value={form.asset_id} onChange={v=>change('asset_id',v)} options={options(data?.assets.filter(x=>x.organization_id===form.organization_id&&x.status==='active'),x=>x.asset_tag+' · '+name(x))}/></Field>}
     <Field label={t('procedure')} required><Select required disabled={!applicableProcedures.length} value={form.procedure_id} onChange={v=>change('procedure_id',v)} options={applicableProcedures.map(x=>({value:x.id,label:x.code+' · '+name(x)+' · '+t(x.frequency)+' · '+t(x.status)}))}/></Field>
     {suggestedProcedures.some(p=>p.id===form.procedure_id&&p.status==='draft')&&<p className="muted span-2">{t('ppmPlanApprovalWait')}</p>}
     {selectedAsset&&<div className="span-2">
      <button type="button" className="btn secondary" aria-expanded={showProcedurePicker}
       onClick={()=>setShowProcedurePicker(value=>!value)}>{t('ppmPickFromLibrary')}</button>
      {showProcedurePicker&&<div className="facility-panel">
       <Field label={t('ppmSearchProcedure')}><input value={procedureQuery} onChange={e=>setProcedureQuery(e.target.value)}/></Field>
       <p className="muted">{t('ppmPickerHelp')}</p>
       <div aria-live="polite">
        {!libraryResults.length&&<p>{t('noData')}</p>}
        {libraryResults.map(row=>{
         const mismatch=procedurePlanMismatch(row,selectedAsset,form.organization_id)
         const allowed=applicableProcedures.some(p=>p.id===row.id)
         return <div className="row-actions" key={row.id}>
          <span>{row.code} · {name(row)} · {t(row.frequency)} · {t(row.status)}</span>
          {allowed?<button type="button" className="btn xs primary" disabled={busy||form.procedure_id===row.id}
           onClick={()=>{change('procedure_id',row.id);setShowProcedurePicker(false);setPreferredProcedureId(row.id)}}>{t(form.procedure_id===row.id?'ppmSelectedForPlan':'ppmSelectForPlan')}</button>
           :<span className="muted">{t(mismatch||'ppmProcedurePermission')}</span>}
         </div>
        })}
       </div>
      </div>}
     </div>}
     {selectedAsset&&!applicableProcedures.length&&<div className="span-2">
      <p className="muted">{t('ppmProcedureMissing')}</p>
      <div className="row-actions">
      {canCreateForAsset&&<button type="button" className="btn secondary" onClick={startProcedureForAsset}>{lang==='ar'?'إنشاء إجراء لهذه المعدة':'Create procedure for this asset'}</button>}
       {can('assets.view',form.organization_id)&&<Link className="btn secondary" to="/asset-library" target="_blank" rel="noopener noreferrer">{t('ppmGuideLibrary')}</Link>}
      </div>
     </div>}
     {!applicableProcedures.length&&canCreateForAsset&&selectedAsset&&assetTemplates&&<div className="span-2">
      {assetTemplates.templates.length>0?<div className="row-actions">
       <Field label={lang==='ar'?'قالب المصنع المطابق':'Matching manufacturer template'}>
        <Select value={templateId} onChange={setTemplateId} options={assetTemplates.templates.map(x=>({value:x.id,label:(lang==='ar'?x.title_ar:x.title_en)+' · '+t(x.frequency)+' · '+x.source_revision}))}/>
       </Field>
       <button type="button" className="btn secondary" disabled={busy||!templateId} onClick={importTemplate}>{lang==='ar'?'استيراد قالب المصنع':'Import manufacturer template'}</button>
      </div>:!medicalAssetId&&<p className="muted">{assetTemplates.failed
       ?(lang==='ar'?'تعذّر تحميل قوالب المصنع.':'Manufacturer templates could not be loaded.')
       :(lang==='ar'?'لا يوجد قالب مصنع موثّق مطابق لبيانات المعدة.':'No verified manufacturer template matches the asset details.')}</p>}
     </div>}
     {!applicableProcedures.length&&medicalAssetId&&canManageMedicalAsset&&<div className="span-2">
       {(!selectedAsset.manufacturer||!selectedAsset.model)&&<p className="muted">{lang==='ar'?'سجّل المصنع والموديل الفعليين في بيانات المعدة حتى يطابقها إجراء المصنع.':'Record the manufacturer and model on the asset so its manufacturer procedure can be matched.'}</p>}
       <button type="button" className="btn secondary" disabled={busy} onClick={()=>setShowOem(true)}>{lang==='ar'?'إضافة إجراء من دليل المصنع':'Add a manufacturer procedure'}</button>
     </div>}
     {selectedAsset&&!canCreateForAsset&&!can('medical.ppm.manage',form.organization_id)&&<p className="muted span-2">{lang==='ar'?'إعداد خطة لهذه المعدة يتطلب صلاحية إدارة الصيانة الوقائية للشركة.':'Setting up a plan for this asset requires preventive maintenance permission for its company.'}</p>}
     <Field label={t('startDate')} required><input type="date" required value={form.start_date} onChange={e=>change('start_date',e.target.value)}/></Field>
     <details className="span-2 ppm-plan-options">
      <summary>{L('العقد وخيارات التكرار','Contract and interval options')}{form.contract_id&&' · '+(data?.contracts.find(row=>row.id===form.contract_id)?.contract_number||'')}</summary>
      <div className="form-grid">
       <Field label={t('contractNumber')}><Select value={form.contract_id} onChange={v=>change('contract_id',v)}
        options={options(data?.contracts.filter(x=>x.organization_id===form.organization_id&&x.client_id===selectedAsset?.client_id),x=>x.contract_number)}/></Field>
       <Field label={t('intervalCount')}><input type="number" min="1" max="100" value={form.interval_count} onChange={e=>change('interval_count',e.target.value)}/></Field>
      </div>
     </details>
    </>}
   </div><FormActions busy={busy} disabled={tab==='plans'&&!canSubmitPlan} onCancel={closeForm}/></form>
  </>}
  </Dialog>
 </section>
}

