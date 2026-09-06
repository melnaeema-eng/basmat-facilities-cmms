import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

const empty = { name:'', code:'', status:'active' }

export default function Organizations() {
  const { t } = useLanguage()
  const [rows,setRows] = useState([])
  const [form,setForm] = useState(empty)
  const [open,setOpen] = useState(false)
  const [editing,setEditing] = useState(null)
  const [loading,setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('bf_organizations').select('*').order('created_at',{ascending:false})
    setRows(data || [])
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  const edit = (row) => { setEditing(row.id); setForm({name:row.name,code:row.code||'',status:row.status}); setOpen(true) }
  const save = async (e) => {
    e.preventDefault()
    const payload = { name:form.name.trim(), code:form.code.trim() || null, status:form.status }
    const result = editing
      ? await supabase.from('bf_organizations').update(payload).eq('id',editing)
      : await supabase.from('bf_organizations').insert(payload)
    if (result.error) return alert(result.error.message)
    setOpen(false); setEditing(null); setForm(empty); load()
  }
  const archive = async (row) => {
    if (!confirm(t('confirmArchive'))) return
    const { error } = await supabase.from('bf_organizations').update({status:'archived'}).eq('id',row.id)
    if (error) alert(error.message); else load()
  }

  const columns = [
    {key:'name',label:t('name')},{key:'code',label:t('code')},
    {key:'status',label:t('status'),render:r=>t(r.status)},
    {key:'actions',label:t('actions'),render:r=><div className="row-actions"><button className="btn xs secondary" onClick={()=>edit(r)}>{t('edit')}</button>{r.status!=='archived'&&<button className="btn xs danger-soft" onClick={()=>archive(r)}>{t('delete')}</button>}</div>}
  ]
  return <>
    <div className="page-head"><h1>{t('organizations')}</h1><button className="btn primary" onClick={()=>{setEditing(null);setForm(empty);setOpen(true)}}>{t('add')}</button></div>
    {loading?<p>{t('loading')}</p>:<DataTable columns={columns} rows={rows} emptyText={t('noData')} />}
    <Modal open={open} title={editing?t('edit'):t('add')} onClose={()=>setOpen(false)}>
      <form onSubmit={save} className="form-grid">
        <label>{t('name')}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>{t('code')}<input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label>
        <label>{t('status')}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="archived">{t('archived')}</option></select></label>
        <div className="form-actions"><button className="btn secondary" type="button" onClick={()=>setOpen(false)}>{t('cancel')}</button><button className="btn primary">{t('save')}</button></div>
      </form>
    </Modal>
  </>
}
