const cards = [
  ['Organizations', 'Multi-tenant maintenance companies'],
  ['Clients', 'Owners and customer organizations'],
  ['Contracts', 'FM and maintenance agreements'],
  ['Sites', 'Operational facilities and buildings'],
]

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <p>Basmat Facilities CMMS foundation is connected and ready for the next modules.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginTop:24}}>
        {cards.map(([title,desc]) => (
          <div key={title} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:18}}>
            <h3>{title}</h3>
            <p style={{color:'#6b7280'}}>{desc}</p>
          </div>
        ))}
      </div>
    </>
  )
}
