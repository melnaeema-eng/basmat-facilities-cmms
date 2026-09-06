import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

const blank={organization_id:'',client_id:'',contract_number:'',contract_type:'comprehensive',start_date:'',end_date:'',contract_value:'',status:'draft'}
export default function Contracts(){
 const {t}=useLanguage(); const [rows,setRows]=useState([]),[orgs,setOrgs]=useState([]),[clients,setClients]=useState([]),[form,setForm]=useState(blank),[open,setOpen]=useState(false),[editing,setEditing]=useState(null)
 const load=async()=>{const [a,b,c]=await Promise.all([supabase.from('bf_contracts').select('*, bf_organizations(name), bf_clients(name)').order('created_at',{ascending:false}),supabase.from('bf_organizations').select('id,name').neq('status','archived').order('name'),supabase.from('bf_clients').select('id,name,organization_id').neq('status','archived').order('name')]);setRows(a.data||[]);setOrgs(b.data||[]);setClients(c.data||[])}
 useEffect(()=>{load()},[])
 const save=async e=>{e.preventDefault();const p={...form,contract_value:form.contract_value?Number(form.contract_value):null,start_date:form.start_date||null,end_date:form.end_date||null};const q=editing?await supabase.from('bf_contracts').update(p).eq('id',editing):await supabase.from('bf_contracts').insert(p);if(q.error)return alert(q.error.message);setOpen(false);setEditing(null);setForm(blank);load()}
 const edit=r=>{setEditing(r.id);setForm({organization_id:r.organization_id,client_id:r.client_id,contract_number:r.contract_number,contract_type:r.contract_type||'comprehensive',start_date:r.start_date||'',end_date:r.end_date||'',contract_value:r.contract_value||'',status:r.status});setOpen(true)}
 const archive=async r=>{if(!confirm(t('confirmArchive')))return;const {error}=await supabase.from('bf_contracts').update({status:'archived'}).eq('id',r.id);if(error)alert(error.message);else load()}
 const filteredClients=clients.filter(c=>!form.organization_id||c.organization_id===form.organization_id)
 const cols=[{key:'contract_number',label:t('contractNumber')},{key:'client',label:t('client'),render:r=>r.bf_clients?.name||'-'},{key:'contract_type',label:t('contractType'),render:r=>t(r.contract_type)},{key:'start_date',label:t('startDate')},{key:'end_date',label:t('endDate')},{key:'status',label:t('status'),render:r=>t(r.status)},{key:'actions',label:t('actions'),render:r=><div className="row-actions"><button className="btn xs secondary" onClick={()=>edit(r)}>{t('edit')}</button>{r.status!=='archived'&&<button className="btn xs danger-soft" onClick={()=>archive(r)}>{t('delete')}</button>}</div>}]
 return <><div className="page-head"><h1>{t('contracts')}</h1><button className="btn primary" onClick={()=>{setEditing(null);setForm({...blank,organization_id:orgs[0]?.id||''});setOpen(true)}}>{t('add')}</button></div><DataTable columns={cols} rows={rows} emptyText={t('noData')}/>
 <Modal open={open} title={editing?t('edit'):t('add')} onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid">
 <label>{t('organization')}<select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value,client_id:''})}><option value=""></option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>{t('client')}<select required value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}><option value=""></option>{filteredClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>{t('contractNumber')}<input required value={form.contract_number} onChange={e=>setForm({...form,contract_number:e.target.value})}/></label>
 <label>{t('contractType')}<select value={form.contract_type} onChange={e=>setForm({...form,contract_type:e.target.value})}>{['comprehensive','nonComprehensive','ppm','corrective','manpower','mixed'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label>
 <label>{t('startDate')}<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>{t('endDate')}<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label>
 <label>{t('contractValue')}<input type="number" step="0.01" value={form.contract_value} onChange={e=>setForm({...form,contract_value:e.target.value})}/></label>
 <label>{t('status')}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['draft','active','suspended','expired','closed','archived'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label>
 <div className="form-actions"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div></form></Modal></>
}
