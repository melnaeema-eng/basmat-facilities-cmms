import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import SimplePage from './pages/SimplePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/organizations" element={<SimplePage title="Organizations" description="Maintenance organizations / tenants." />} />
          <Route path="/clients" element={<SimplePage title="Clients" description="Facility owners and customer organizations." />} />
          <Route path="/contracts" element={<SimplePage title="Contracts" description="Maintenance contracts and operational scope." />} />
          <Route path="/sites" element={<SimplePage title="Sites" description="Sites, buildings and operational locations." />} />
          <Route path="/users" element={<SimplePage title="Users & Roles" description="Users, roles and permissions foundation." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
