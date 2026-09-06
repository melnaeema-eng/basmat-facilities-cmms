import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

export default function UsersRoles(){
 const {t}=useLanguage(); const [rows,setRows]=useState([]),[orgs,setOrgs]=useState([]),[roles,setRoles]=useState([]),[open,setOpen]=useState(false),[form,setForm]=useState({user_id:'',organization_id:'',role_id:''})
 const load=async()=>{const [a,b,c]=await Promise.all([supabase.from('bf_profiles').select('id,full_name,email,status,is_super_admin').order('created_at',{ascending:false}),supabase.from('bf_organizations').select('id,name').neq('status','archived').order('name'),supabase.from('bf_roles').select('id,name,code,organization_id').order('name')]);setRows(a.data||[]);setOrgs(b.data||[]);setRoles(c.data||[])}
 useEffect(()=>{load()},[])
 const assign=async e=>{e.preventDefault();const {error}=await supabase.from('bf_user_roles').upsert(form,{onConflict:'user_id,organization_id,role_id'});if(error)return alert(error.message);setOpen(false)}
 const cols=[{key:'full_name',label:t('fullName'),render:r=>r.full_name||'-'},{key:'email',label:t('email')},{key:'status',label:t('status'),render:r=>t(r.status)},{key:'is_super_admin',label:t('superAdmin'),render:r=>r.is_super_admin?'✓':'-'},{key:'actions',label:t('actions'),render:r=><button className="btn xs secondary" onClick={()=>{setForm({user_id:r.id,organization_id:orgs[0]?.id||'',role_id:''});setOpen(true)}}>{t('assignRole')}</button>}]
 const availableRoles=roles.filter(r=>!r.organization_id||r.organization_id===form.organization_id)
 return <><div className="page-head"><div><h1>{t('usersRoles')}</h1><p>{t('createAuthUserNote')}</p></div></div><DataTable columns={cols} rows={rows} emptyText={t('noData')}/>
 <Modal open={open} title={t('membership')} onClose={()=>setOpen(false)}><form onSubmit={assign} className="form-grid one">
 <label>{t('organization')}<select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value,role_id:''})}><option value=""></option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>{t('role')}<select required value={form.role_id} onChange={e=>setForm({...form,role_id:e.target.value})}><option value=""></option>{availableRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
 <div className="form-actions"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div></form></Modal></>
}
