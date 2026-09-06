import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'

export default function Dashboard() {
  const { t } = useLanguage()
  const [counts, setCounts] = useState({ organizations:0, clients:0, contracts:0, sites:0 })

  useEffect(() => {
    const load = async () => {
      const [o,c,k,s] = await Promise.all([
        supabase.from('bf_organizations').select('*', { count:'exact', head:true }).neq('status','archived'),
        supabase.from('bf_clients').select('*', { count:'exact', head:true }).neq('status','archived'),
        supabase.from('bf_contracts').select('*', { count:'exact', head:true }).eq('status','active'),
        supabase.from('bf_sites').select('*', { count:'exact', head:true }).neq('status','archived'),
      ])
      setCounts({
        organizations:o.count || 0,
        clients:c.count || 0,
        contracts:k.count || 0,
        sites:s.count || 0,
      })
    }
    load()
  }, [])

  const cards = [
    ['activeOrganizations', counts.organizations],
    ['activeClients', counts.clients],
    ['activeContracts', counts.contracts],
    ['activeSites', counts.sites],
  ]

  return (
    <>
      <div className="page-head">
        <div><h1>{t('dashboard')}</h1><p>{t('welcome')}</p></div>
      </div>
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{t(label)}</span><strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  )
}
