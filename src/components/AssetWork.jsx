import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'

const DONE = ['completed', 'approved', 'closed', 'cancelled']
const T = {
  ar: { title: 'حالة المعدة', cm: 'الصيانة التصحيحية', pm: 'الصيانة الوقائية', open: 'أوامر مفتوحة', late: 'متأخرة',
    next: 'أقرب صيانة وقائية', warranty: 'نهاية الضمان', none: 'لا يوجد', noCm: 'لا توجد أوامر عمل لهذه المعدة.',
    noPm: 'لا توجد مهام وقائية لهذه المعدة.', all: 'كل أوامر العمل', allPm: 'كل المهام الوقائية', err: 'تعذر تحميل بيانات الصيانة' },
  en: { title: 'Equipment status', cm: 'Corrective maintenance', pm: 'Preventive maintenance', open: 'Open orders', late: 'Overdue',
    next: 'Next preventive visit', warranty: 'Warranty ends', none: 'None', noCm: 'No work orders for this equipment.',
    noPm: 'No preventive jobs for this equipment.', all: 'All work orders', allPm: 'All preventive jobs', err: 'Could not load maintenance data' },
}

export default function AssetWork({ asset }) {
  const { lang } = useLanguage()
  const c = T[lang === 'ar' ? 'ar' : 'en']
  const [wo, setWo] = useState([]), [pm, setPm] = useState([]), [err, setErr] = useState('')
  const fmt = v => v ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium' }).format(new Date(v)) : '—'

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [a, b] = await Promise.all([
        supabase.from('bf_work_orders').select('id,work_order_number,title,priority,status,sla_status,completion_due_at,created_at').eq('asset_id', asset.id).order('created_at', { ascending: false }).limit(8),
        supabase.from('bf_ppm_jobs').select('id,job_number,due_date,status').eq('asset_id', asset.id).order('due_date', { ascending: false }).limit(8),
      ])
      if (!alive) return
      if (a.error || b.error) setErr((a.error || b.error).message)
      setWo(a.data || []); setPm(b.data || [])
    })()
    return () => { alive = false }
  }, [asset.id])

  const open = wo.filter(x => !DONE.includes(x.status)).length
  const late = wo.filter(x => x.sla_status === 'breached').length + pm.filter(x => x.status === 'scheduled' && x.due_date < new Date().toISOString().slice(0, 10)).length
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = pm.filter(x => x.status === 'scheduled' && x.due_date >= today).map(x => x.due_date).sort()[0]

  return (
    <div className="aw">
      <h3>{c.title}</h3>
      {err && <div className="alert error">{c.err}: {err}</div>}
      <div className="aw-kpis">
        <div><b>{open}</b><small>{c.open}</small></div>
        <div className={late ? 'aw-bad' : ''}><b>{late}</b><small>{c.late}</small></div>
        <div><b>{fmt(upcoming)}</b><small>{c.next}</small></div>
        <div><b>{fmt(asset.warranty_end)}</b><small>{c.warranty}</small></div>
      </div>
      <div className="aw-cols">
        <div className="facility-panel">
          <div className="aw-h"><h3>{c.cm}</h3><Link to="/corrective">{c.all}</Link></div>
          {wo.length === 0 ? <p className="muted">{c.noCm}</p> : wo.map(x => (
            <Link key={x.id} className="aw-row" to={'/corrective/work_order/' + x.id}>
              <span><b>{x.work_order_number}</b> {x.title}</span><i>{x.status}</i>
            </Link>))}
        </div>
        <div className="facility-panel">
          <div className="aw-h"><h3>{c.pm}</h3><Link to="/ppm">{c.allPm}</Link></div>
          {pm.length === 0 ? <p className="muted">{c.noPm}</p> : pm.map(x => (
            <Link key={x.id} className="aw-row" to={'/ppm/job/' + x.id}>
              <span><b>{x.job_number}</b> {fmt(x.due_date)}</span><i>{x.status}</i>
            </Link>))}
        </div>
      </div>
    </div>
  )
}
