import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'

export default function Login() {
  const { signIn, user } = useAuth()
  const location=useLocation()
  const requestedPath=location.state?.from
  const returnPath=typeof requestedPath==='string'&&requestedPath.startsWith('/')&&!requestedPath.startsWith('//')&&!requestedPath.startsWith('/login')?requestedPath:'/'
  const { t, lang, setLang } = useLanguage()
  const [form, setForm] = useState({ email:'', password:'' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={returnPath} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const {error}=await signIn(form.email.trim(),form.password)
      if(error)setError(error.message)
    } catch {setError(lang==='ar'?'تعذر الاتصال. حاول مجدداً.':'Connection failed. Please retry.')}
    finally {setBusy(false)}
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-head">
          <img src="/bafm-logo.png" alt="Basmat Alnawabigh" style={{width:80,height:80,objectFit:"contain",borderRadius:16}}/>
          <h1>{t('appName')}</h1>
          <p>{lang==='ar'?'إدارة الأصول والصيانة والتشغيل':'Assets, maintenance and operations'}</p>
        </div>
        <form onSubmit={submit} className="form-grid one">
          <label>{t('email')}<input type="email" autoComplete="username" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></label>
          <label>{t('password')}<input type="password" autoComplete="current-password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary" disabled={busy}>{busy ? t('signingIn') : t('signIn')}</button>
          <button type="button" className="btn secondary" onClick={()=>setLang(lang==='ar'?'en':'ar')}>{t('language')}</button>
        </form>
      </div>
    </div>
  )
}
