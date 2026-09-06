import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

const blank={organization_id:'',client_id:'',contract_id:'',name:'',code:'',city:'',address:'',status:'active'}
export default function Sites(){
 const {t}=useLanguage(); const [rows,setRows]=useState([]),[orgs,setOrgs]=useState([]),[clients,setClients]=useState([]),[contracts,setContracts]=useState([]),[form,setForm]=useState(blank),[open,setOpen]=useState(false),[editing,setEditing]=useState(null)
 const load=async()=>{const [a,b,c,d]=await Promise.all([supabase.from('bf_sites').select('*, bf_organizations(name), bf_clients(name), bf_contracts(contract_number)').order('created_at',{ascending:false}),supabase.from('bf_organizations').select('id,name').neq('status','archived').order('name'),supabase.from('bf_clients').select('id,name,organization_id').neq('status','archived').order('name'),supabase.from('bf_contracts').select('id,contract_number,organization_id,client_id').neq('status','archived').order('contract_number')]);setRows(a.data||[]);setOrgs(b.data||[]);setClients(c.data||[]);setContracts(d.data||[])}
 useEffect(()=>{load()},[])
 const save=async e=>{e.preventDefault();const p={...form,contract_id:form.contract_id||null,code:form.code||null,city:form.city||null,address:form.address||null};const q=editing?await supabase.from('bf_sites').update(p).eq('id',editing):await supabase.from('bf_sites').insert(p);if(q.error)return alert(q.error.message);setOpen(false);setEditing(null);setForm(blank);load()}
 const edit=r=>{setEditing(r.id);setForm({organization_id:r.organization_id,client_id:r.client_id||'',contract_id:r.contract_id||'',name:r.name,code:r.code||'',city:r.city||'',address:r.address||'',status:r.status});setOpen(true)}
 const archive=async r=>{if(!confirm(t('confirmArchive')))return;const {error}=await supabase.from('bf_sites').update({status:'archived'}).eq('id',r.id);if(error)alert(error.message);else load()}
 const c1=clients.filter(c=>!form.organization_id||c.organization_id===form.organization_id); const c2=contracts.filter(c=>(!form.organization_id||c.organization_id===form.organization_id)&&(!form.client_id||c.client_id===form.client_id))
 const cols=[{key:'name',label:t('siteName')},{key:'client',label:t('client'),render:r=>r.bf_clients?.name||'-'},{key:'city',label:t('city')},{key:'status',label:t('status'),render:r=>t(r.status)},{key:'actions',label:t('actions'),render:r=><div className="row-actions"><button className="btn xs secondary" onClick={()=>edit(r)}>{t('edit')}</button>{r.status!=='archived'&&<button className="btn xs danger-soft" onClick={()=>archive(r)}>{t('delete')}</button>}</div>}]
 return <><div className="page-head"><h1>{t('sites')}</h1><button className="btn primary" onClick={()=>{setEditing(null);setForm({...blank,organization_id:orgs[0]?.id||''});setOpen(true)}}>{t('add')}</button></div><DataTable columns={cols} rows={rows} emptyText={t('noData')}/>
 <Modal open={open} title={editing?t('edit'):t('add')} onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid">
 <label>{t('organization')}<select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value,client_id:'',contract_id:''})}><option value=""></option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>{t('client')}<select required value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value,contract_id:''})}><option value=""></option>{c1.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>{t('contractNumber')}<select value={form.contract_id} onChange={e=>setForm({...form,contract_id:e.target.value})}><option value=""></option>{c2.map(c=><option key={c.id} value={c.id}>{c.contract_number}</option>)}</select></label>
 <label>{t('siteName')}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{t('code')}<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>{t('city')}<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label className="span-2">{t('address')}<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
 <label>{t('status')}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="archived">{t('archived')}</option></select></label>
 <div className="form-actions"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div></form></Modal></>
}
