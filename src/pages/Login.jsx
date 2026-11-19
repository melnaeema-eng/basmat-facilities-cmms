import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import '../landing.css'

export default function Login() {
  const { signIn, user } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const [form, setForm] = useState({ email:'', password:'' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ar = lang === 'ar'

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await signIn(form.email, form.password)
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="lg">
      <aside className="lg-side">
        <div>
          <img src="/bafm-logo.png" alt="" />
          <h2>{ar ? 'بصمة النوابغ لإدارة صيانة المرافق' : 'Basmat Alnawabigh Facility Maintenance'}</h2>
          <p>{ar ? 'أوامر العمل، الصيانة الوقائية، المخزون والتقارير في نظام واحد.' : 'Work orders, preventive maintenance, stores and reports in one system.'}</p>
        </div>
        <small>© 2026 BAFM</small>
      </aside>
      <main className="lg-main">
        <div className="lg-box">
          <Link className="back" to="/welcome">{ar ? 'العودة للصفحة الرئيسية' : 'Back to home'}</Link>
          <h1>{t('signIn')}</h1>
          <p>{ar ? 'أدخل بيانات حسابك للمتابعة.' : 'Enter your account details to continue.'}</p>
          <form onSubmit={submit} className="form-grid one">
            <label>{t('email')}<input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
            <label>{t('password')}<input type="password" required autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></label>
            {error && <div className="alert error">{error}</div>}
            <button className="btn primary" disabled={busy}>{busy ? t('signingIn') : t('signIn')}</button>
            <button type="button" className="btn secondary" onClick={()=>setLang(ar?'en':'ar')}>{t('language')}</button>
          </form>
        </div>
      </main>
    </div>
  )
}
