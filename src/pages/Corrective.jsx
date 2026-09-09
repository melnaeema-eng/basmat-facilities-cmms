import {useEffect,useMemo,useState} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {useAuth} from '../context/AuthContext'
import {useLanguage} from '../i18n/LanguageContext'
import {loadCorrective,action,priorities} from '../lib/corrective'
import {Field,Select,Dialog,Notice,Status,FormActions} from '../components/FacilityFields'
import DataTable from '../components/DataTable'
const blank={organization_id:'',client_id:'',site_id:'',contract_id:'',asset_id:'',title:'',description:'',priority:'P3'}
export default function Corrective(){
 const {can}=useAuth(),{t,lang}=useLanguage(),navigate=useNavigate()
 const [data,setData]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false)
 const [tab,setTab]=useState('request'),[form,setForm]=useState(blank),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('')
 const load=async()=>{setError('');try{setData(await loadCorrective())}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[])
 const rows=useMemo(()=>((tab==='request'?data?.requests:data?.workOrders)||[]).filter(x=>(!filter||x.status===filter)&&(!query||[x.title,x.request_number,x.work_order_number,x.description].join(' ').toLowerCase().includes(query.toLowerCase()))),[data,tab,filter,query])
 const change=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='organization_id'?{client_id:'',site_id:'',contract_id:'',asset_id:''}:key==='client_id'?{site_id:'',contract_id:'',asset_id:''}:key==='site_id'?{asset_id:''}:{})}))
 const opts=(key,rows,label)=>[{value:'',label:t('select')},...(rows||[]).map(x=>({value:x.id,label:label(x)}))]
 const name=x=>lang==='ar'?x.name_ar||x.name_en||x.name:x.name_en||x.name_ar||x.name
 const options=(key)=>{
  if(key==='organization_id')return opts(key,data?.organizations,name)
  if(key==='client_id')return opts(key,data?.clients.filter(x=>x.organization_id===form.organization_id),name)
  if(key==='site_id')return opts(key,data?.sites.filter(x=>x.organization_id===form.organization_id&&x.client_id===form.client_id),name)
  if(key==='contract_id')return opts(key,data?.contracts.filter(x=>x.organization_id===form.organization_id&&x.client_id===form.client_id),x=>x.contract_number)
  return opts(key,data?.assets.filter(x=>x.site_id===form.site_id),x=>x.asset_tag+' · '+name(x))
 }
 const submit=async e=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('')
  try{
   const id=await action(tab,null,'create',form)
   setOpen(false);setForm(blank);await load();setSuccess(t('saved'));navigate('/corrective/'+tab+'/'+id)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const run=async(row,command)=>{
  if(!confirm(t('confirmAction')))return
  setBusy(true);setError('')
  try{const id=await action(tab,row.id,command);await load();if(command==='convert')navigate('/corrective/work_order/'+id);else setSuccess(t('saved'))}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const newAllowed=tab==='request'?can('corrective.request'):can('corrective.manage')
 const cols=[
  {key:'number',label:t(tab==='request'?'requestNumber':'workOrderNumber'),render:x=><Link to={'/corrective/'+tab+'/'+x.id}>{x.request_number||x.work_order_number}</Link>},
  {key:'title',label:t('title')},{key:'priority',label:t('priority'),render:x=>t(x.priority)},
  {key:'site',label:t('site'),render:x=>data?.sites.find(s=>s.id===x.site_id)?.name||'—'},
  {key:'status',label:t('status'),render:x=><Status value={x.status}/>},
  {key:'created_at',label:t('createdAt'),render:x=>new Date(x.reported_at||x.created_at).toLocaleString(lang)},
  {key:'actions',label:t('actions'),render:x=><div className="row-actions">
   <Link className="btn xs secondary" to={'/corrective/'+tab+'/'+x.id}>{t('details')}</Link>
   {tab==='request'&&can('corrective.manage',x.organization_id)&&['submitted','triaged','converted'].includes(x.status)&&<button disabled={busy} className="btn xs primary" onClick={()=>run(x,'convert')}>{t('convert')}</button>}
  </div>}
 ]
 return <section className="facility-module">
  <div className="page-head"><h1>{t('corrective')}</h1><div className="row-actions"><button className="btn secondary" onClick={load}>{t('refresh')}</button>{newAllowed&&<button className="btn primary" onClick={()=>{setForm(blank);setOpen(true)}}>{t(tab==='request'?'newRequest':'newWO')}</button>}</div></div>
  <Notice error={error} success={success}/>
  <div className="row-actions"><button className={'btn '+(tab==='request'?'primary':'secondary')} onClick={()=>{setTab('request');setFilter('')}}>{t('serviceRequests')} ({data?.requests.length||0})</button><button className={'btn '+(tab==='work_order'?'primary':'secondary')} onClick={()=>{setTab('work_order');setFilter('')}}>{t('workOrders')} ({data?.workOrders.length||0})</button></div>
  <div className="facility-panel filter-grid"><Field label={t('search')}><input value={query} onChange={e=>setQuery(e.target.value)}/></Field><Field label={t('status')}><Select value={filter} onChange={setFilter} options={[{value:'',label:t('all')},...(tab==='request'?['submitted','triaged','converted','rejected','cancelled']:['draft','assigned','accepted','in_progress','on_hold','completed','approved','closed','cancelled']).map(x=>({value:x,label:t(x)}))]}/></Field></div>
  {!data?<p>{t('loading')}</p>:<DataTable rows={rows} columns={cols} emptyText={t('noData')}/>}
  <Dialog open={open} title={t(tab==='request'?'newRequest':'newWO')} onClose={()=>!busy&&setOpen(false)}>
   <form onSubmit={submit} className="facility-form">
    <div className="form-grid">
     {['organization_id','client_id','site_id','contract_id','asset_id'].map((key,i)=><Field key={key} label={t(({organization_id:'organization',client_id:'client',site_id:'site',contract_id:'contractNumber',asset_id:'asset'})[key])} required={i<3}><Select required={i<3} value={form[key]} onChange={v=>change(key,v)} options={options(key)} disabled={i>0&&!form[({client_id:'organization_id',site_id:'client_id',contract_id:'client_id',asset_id:'site_id'})[key]]}/></Field>)}
     <Field label={t('title')} required><input required minLength={3} maxLength={250} value={form.title} onChange={e=>change('title',e.target.value)}/></Field>
     <Field label={t('priority')}><Select value={form.priority} onChange={v=>change('priority',v)} options={priorities.map(x=>({value:x,label:t(x)}))}/></Field>
     <Field label={t('description')} wide><textarea value={form.description} onChange={e=>change('description',e.target.value)}/></Field>
    </div>
    <FormActions busy={busy} onCancel={()=>setOpen(false)}/>
   </form>
  </Dialog>
 </section>
}
