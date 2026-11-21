import CompanyField from '../components/CompanyField'
import {useEffect,useMemo,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {loadCorrective,action,priorities,correctiveCreationStatus} from '../lib/corrective'
import {Field,Select,Dialog,Notice,Status,FormActions} from '../components/FacilityFields'
import DataTable from '../components/DataTable'

const blank={organization_id:'',client_id:'',site_id:'',contract_id:'',asset_id:'',title:'',description:'',priority:'P3'}
const closedRequest=new Set(['converted','rejected','cancelled'])
const closedWork=new Set(['closed','cancelled'])
const creationMessages={
 project_access:['حسابك يحتاج إلى صلاحية إنشاء أوامر العمل لهذا المشروع والموقع.','Your account needs work order creation access for this project and site.'],
 organization_access:['حسابك يحتاج إلى صلاحية إنشاء أوامر العمل لهذه الشركة.','Your account needs work order creation access for this company.'],
 invalid_site:['اختر موقعًا نشطًا تابعًا للمالك المحدد.','Select an active site for the selected owner.'],
 invalid_contract:['اختر عقدًا تابعًا للشركة والمالك المحددين.','Select a contract for the selected company and owner.'],
 ambiguous_project:['هذا العقد والموقع مرتبطان بأكثر من مشروع. أنشئ الأمر من المشروع المحدد.','More than one project matches this contract and site. Create the order from the specific project.'],
 verification_failed:['تعذّر التحقق من صلاحية الإنشاء. اضغط إعادة التحقق.','Creation access could not be verified. Select Retry check.']
}

export default function Corrective(){
 const {can,user}=useAuth(),{t,lang}=useLanguage(),navigate=useNavigate()
 const [data,setData]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false)
 const [tab,setTab]=useState('work_order'),[form,setForm]=useState(blank),[open,setOpen]=useState(false)
 const [check,setCheck]=useState(null),[checkRevision,retryCheck]=useState(0)
 const [query,setQuery]=useState(''),[filter,setFilter]=useState(''),[scope,setScope]=useState('attention')

 const load=async()=>{setError('');try{setData(await loadCorrective())}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[])
 const {organization_id,client_id,site_id,contract_id}=form
 const createScope=open&&tab==='work_order'&&organization_id&&client_id&&site_id
 const scopeKey=createScope?[organization_id,client_id,site_id,contract_id,checkRevision].join(':'):''
 useEffect(()=>{
  if(!scopeKey)return
  let active=true
  correctiveCreationStatus({organization_id,client_id,site_id,contract_id})
   .then(status=>{if(active)setCheck({key:scopeKey,status})})
   .catch(()=>{if(active)setCheck({key:scopeKey,status:'verification_failed'})})
  return()=>{active=false}
 },[scopeKey,organization_id,client_id,site_id,contract_id])
 const creationStatus=scopeKey&&check?.key===scopeKey?check.status:null
 const needsAsset=creationStatus==='asset_required'
 const canSave=tab==='request'||creationStatus==='allowed'||(needsAsset&&!!form.asset_id)
 const creationMessage=creationMessages[creationStatus]?.[lang==='ar'?0:1]

 const myWorkIds=useMemo(()=>new Set((data?.assignments||[]).filter(x=>x.user_id===user?.id).map(x=>x.work_order_id)),[data,user?.id])
 const now=Date.now()

 const workStats=useMemo(()=>{
  const rows=data?.workOrders||[]
  return {
   active:rows.filter(x=>!closedWork.has(x.status)).length,
   critical:rows.filter(x=>!closedWork.has(x.status)&&x.priority==='P1').length,
   breached:rows.filter(x=>!closedWork.has(x.status)&&x.sla_status==='breached').length,
   due:rows.filter(x=>!closedWork.has(x.status)&&x.completion_due_at&&new Date(x.completion_due_at).getTime()<now).length,
   qa:rows.filter(x=>x.status==='completed').length,
   mine:rows.filter(x=>!closedWork.has(x.status)&&myWorkIds.has(x.id)).length
  }
 },[data,myWorkIds])

 const requestStats=useMemo(()=>{
  const rows=data?.requests||[]
  return {
   active:rows.filter(x=>!closedRequest.has(x.status)).length,
   critical:rows.filter(x=>!closedRequest.has(x.status)&&x.priority==='P1').length,
   submitted:rows.filter(x=>x.status==='submitted').length,
   triaged:rows.filter(x=>x.status==='triaged').length
  }
 },[data])

 const rows=useMemo(()=>{
  const source=(tab==='request'?data?.requests:data?.workOrders)||[]
  return source.filter(x=>{
   if(filter&&x.status!==filter)return false
   if(query&&![x.title,x.request_number,x.work_order_number,x.description].join(' ').toLowerCase().includes(query.toLowerCase()))return false
   if(scope==='all')return true
   if(tab==='request'){
    if(scope==='critical')return x.priority==='P1'&&!closedRequest.has(x.status)
    return !closedRequest.has(x.status)
   }
   if(scope==='mine')return myWorkIds.has(x.id)&&!closedWork.has(x.status)
   if(scope==='critical')return x.priority==='P1'&&!closedWork.has(x.status)
   if(scope==='breached')return x.sla_status==='breached'&&!closedWork.has(x.status)
   if(scope==='qa')return x.status==='completed'
   return !closedWork.has(x.status)
  })
 },[data,tab,filter,query,scope,myWorkIds])

 const change=(key,value)=>{
  setError('')
  if(['organization_id','client_id','site_id','contract_id'].includes(key)&&form[key]!==value)setCheck(null)
  setForm(f=>({...f,[key]:value,...(key==='organization_id'?{client_id:'',site_id:'',contract_id:'',asset_id:''}:key==='client_id'?{site_id:'',contract_id:'',asset_id:''}:key==='site_id'?{asset_id:''}:{})}))
 }
 const opts=(rows,label)=>[{value:'',label:t('select')},...(rows||[]).map(x=>({value:x.id,label:label(x)}))]
 const name=x=>lang==='ar'?x.name_ar||x.name_en||x.name:x.name_en||x.name_ar||x.name
 const options=(key)=>{
  if(key==='organization_id')return opts(data?.organizations,name)
  if(key==='client_id')return opts(data?.clients.filter(x=>x.organization_id===form.organization_id),name)
  if(key==='site_id')return opts(data?.sites.filter(x=>x.organization_id===form.organization_id&&x.client_id===form.client_id),name)
  if(key==='contract_id')return opts(data?.contracts.filter(x=>x.organization_id===form.organization_id&&x.client_id===form.client_id),x=>x.contract_number)
  return opts(data?.assets.filter(x=>x.site_id===form.site_id),x=>x.asset_tag+' · '+name(x))
 }

 const submit=async e=>{
  e.preventDefault();if(busy||!canSave)return;setBusy(true);setError('')
  try{
   const id=await action(tab,null,'create',form)
   setOpen(false);setForm(blank);await load();setSuccess(t('saved'));navigate('/corrective/'+tab+'/'+id)
  }catch(e){
   setError(e.message==='Project work order creation permission required'?creationMessages.project_access[lang==='ar'?0:1]:e.message)
  }finally{setBusy(false)}
 }

 const run=async(row,command)=>{
  if(!confirm(t('confirmAction')))return
  setBusy(true);setError('')
  try{
   const id=await action(tab,row.id,command);await load()
   if(command==='convert')navigate('/corrective/work_order/'+id);else setSuccess(t('saved'))
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const newAllowed=tab==='request'?can('corrective.request'):can('corrective.manage')
 const cols=[
  {key:'number',label:t(tab==='request'?'requestNumber':'workOrderNumber'),render:x=><Link to={'/corrective/'+tab+'/'+x.id}>{x.request_number||x.work_order_number}</Link>},
  {key:'title',label:t('title')},
  {key:'priority',label:t('priority'),render:x=><span className={'priority-badge priority-'+x.priority.toLowerCase()}>{t(x.priority)}</span>},
  {key:'site',label:t('site'),render:x=>data?.sites.find(s=>s.id===x.site_id)?.name||'—'},
  {key:'status',label:t('status'),render:x=><Status value={x.status}/>},
  ...(tab==='work_order'?[{key:'sla',label:t('slaStatus'),render:x=><span className={x.sla_status==='breached'?'sla-breached':''}>{t(x.sla_status||'not_configured')}</span>}]:[]),
  {key:'created_at',label:t('createdAt'),render:x=>new Date(x.reported_at||x.created_at).toLocaleString(lang)},
  {key:'actions',label:t('actions'),render:x=><div className="row-actions">
   <Link className="btn xs secondary" to={'/corrective/'+tab+'/'+x.id}>{t('details')}</Link>
   {tab==='request'&&can('corrective.manage',x.organization_id)&&['submitted','triaged'].includes(x.status)&&<button disabled={busy} className="btn xs primary" onClick={()=>run(x,'convert')}>{t('convert')}</button>}
  </div>}
 ]

 const summary=tab==='request'?[
  ['activeRequests',requestStats.active,'attention'],
  ['criticalItems',requestStats.critical,'critical'],
  ['awaitingTriage',requestStats.submitted,'attention'],
  ['triagedItems',requestStats.triaged,'all']
 ]:[
  ['activeWorkOrders',workStats.active,'attention'],
  ['myActiveWork',workStats.mine,'mine'],
  ['criticalItems',workStats.critical,'critical'],
  ['slaBreached',workStats.breached,'breached'],
  ['awaitingQa',workStats.qa,'qa']
 ]

 return <section className="facility-module">
  <div className="page-head">
   <div><h1>{t('workControlCenter')}</h1><p className="muted">{t('workControlHelp')}</p></div>
   <div className="row-actions">
    <button className="btn secondary" onClick={load}>{t('refresh')}</button>
    {newAllowed&&<button className="btn primary" onClick={()=>{setForm(blank);setError('');setCheck(null);setOpen(true)}}>{t(tab==='request'?'newRequest':'newWO')}</button>}
   </div>
  </div>

  <Notice error={open?'':error} success={success}/>

  <div className="row-actions module-tabs">
   <button className={'btn '+(tab==='work_order'?'primary':'secondary')} onClick={()=>{setTab('work_order');setFilter('');setScope('attention')}}>{t('workOrders')} ({data?.workOrders.length||0})</button>
   <button className={'btn '+(tab==='request'?'primary':'secondary')} onClick={()=>{setTab('request');setFilter('');setScope('attention')}}>{t('serviceRequests')} ({data?.requests.length||0})</button>
  </div>

  <div className="ops-summary-grid">
   {summary.map(([label,value,target])=><button key={label} className={'ops-summary-card '+(scope===target?'selected':'')} onClick={()=>setScope(target)}>
    <span>{t(label)}</span><strong>{value}</strong>
   </button>)}
  </div>

  <div className="facility-panel filter-grid">
   <Field label={t('search')}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('searchWorkPlaceholder')}/></Field>
   <Field label={t('status')}><Select value={filter} onChange={setFilter} options={[{value:'',label:t('all')},...(tab==='request'?['submitted','triaged','converted','rejected','cancelled']:['draft','assigned','accepted','in_progress','on_hold','completed','approved','closed','cancelled']).map(x=>({value:x,label:t(x)}))]}/></Field>
   <Field label={t('view')}><Select value={scope} onChange={setScope} options={(tab==='request'?[
    ['attention','openOnly'],['critical','criticalItems'],['all','allRecords']
   ]:[
    ['attention','openOnly'],['mine','myActiveWork'],['critical','criticalItems'],['breached','slaBreached'],['qa','awaitingQa'],['all','allRecords']
   ]).map(([value,label])=>({value,label:t(label)}))}/></Field>
  </div>

  {!data?<p>{t('loading')}</p>:<DataTable rows={rows} columns={cols} emptyText={t('noData')}/>}

  <Dialog open={open} title={t(tab==='request'?'newRequest':'newWO')} onClose={()=>!busy&&setOpen(false)}>
   <form onSubmit={submit} className="facility-form">
    <Notice error={error||creationMessage}/>
    {scopeKey&&!creationStatus&&<p role="status">{lang==='ar'?'جارٍ التحقق من صلاحية الإنشاء…':'Checking work order creation access…'}</p>}
    {creationStatus==='verification_failed'&&<button type="button" className="btn secondary" onClick={()=>retryCheck(n=>n+1)}>{lang==='ar'?'إعادة التحقق':'Retry check'}</button>}
    <div className="form-grid">
     {['organization_id','client_id','site_id','contract_id','asset_id'].map((key,i)=><CompanyField company={key==='organization_id'} key={key} label={t(({organization_id:'organization',client_id:'client',site_id:'site',contract_id:'contractNumber',asset_id:'asset'})[key])} required={i<3||(key==='asset_id'&&needsAsset)}><Select required={i<3||(key==='asset_id'&&needsAsset)} value={form[key]} onChange={v=>change(key,v)} options={options(key)} disabled={i>0&&!form[({client_id:'organization_id',site_id:'client_id',contract_id:'client_id',asset_id:'site_id'})[key]]}/></CompanyField>)}
     <Field label={t('title')} required><input required minLength={3} maxLength={250} value={form.title} onChange={e=>change('title',e.target.value)}/></Field>
     <Field label={t('priority')}><Select value={form.priority} onChange={v=>change('priority',v)} options={priorities.map(x=>({value:x,label:t(x)}))}/></Field>
     <Field label={t('description')} wide><textarea value={form.description} onChange={e=>change('description',e.target.value)}/></Field>
    </div>
    <FormActions busy={busy} disabled={!canSave} onCancel={()=>setOpen(false)}/>
   </form>
  </Dialog>
 </section>
}

