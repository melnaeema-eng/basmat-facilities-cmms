import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

const blank={organization_id:'',name:'',code:'',email:'',phone:'',status:'active'}

export default function Clients(){
 const {t}=useLanguage(); const [rows,setRows]=useState([]); const [orgs,setOrgs]=useState([]); const [form,setForm]=useState(blank); const [open,setOpen]=useState(false); const [editing,setEditing]=useState(null)
 const load=async()=>{const [a,b]=await Promise.all([supabase.from('bf_clients').select('*, bf_organizations(name)').order('created_at',{ascending:false}),supabase.from('bf_organizations').select('id,name').neq('status','archived').order('name')]);setRows(a.data||[]);setOrgs(b.data||[])}
 useEffect(()=>{load()},[])
 const edit=r=>{setEditing(r.id);setForm({organization_id:r.organization_id,name:r.name,code:r.code||'',email:r.email||'',phone:r.phone||'',status:r.status});setOpen(true)}
 const save=async e=>{e.preventDefault();const p={...form,code:form.code||null,email:form.email||null,phone:form.phone||null};const q=editing?await supabase.from('bf_clients').update(p).eq('id',editing):await supabase.from('bf_clients').insert(p);if(q.error)return alert(q.error.message);setOpen(false);setEditing(null);setForm(blank);load()}
 const archive=async r=>{if(!confirm(t('confirmArchive')))return;const {error}=await supabase.from('bf_clients').update({status:'archived'}).eq('id',r.id);if(error)alert(error.message);else load()}
 const cols=[{key:'name',label:t('name')},{key:'organization',label:t('organization'),render:r=>r.bf_organizations?.name||'-'},{key:'email',label:t('email')},{key:'phone',label:t('phone')},{key:'status',label:t('status'),render:r=>t(r.status)},{key:'actions',label:t('actions'),render:r=><div className="row-actions"><button className="btn xs secondary" onClick={()=>edit(r)}>{t('edit')}</button>{r.status!=='archived'&&<button className="btn xs danger-soft" onClick={()=>archive(r)}>{t('delete')}</button>}</div>}]
 return <><div className="page-head"><h1>{t('clients')}</h1><button className="btn primary" onClick={()=>{setEditing(null);setForm({...blank,organization_id:orgs[0]?.id||''});setOpen(true)}}>{t('add')}</button></div><DataTable columns={cols} rows={rows} emptyText={t('noData')}/>
 <Modal open={open} title={editing?t('edit'):t('add')} onClose={()=>setOpen(false)}><form onSubmit={save} className="form-grid">
 <label>{t('organization')}<select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value})}><option value=""></option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>{t('name')}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{t('code')}<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>{t('email')}<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>{t('phone')}<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>{t('status')}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="archived">{t('archived')}</option></select></label>
 <div className="form-actions"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div></form></Modal></>
}
