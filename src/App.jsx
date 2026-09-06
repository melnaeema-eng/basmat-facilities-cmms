import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Organizations from './pages/Organizations'
import Clients from './pages/Clients'
import Contracts from './pages/Contracts'
import Sites from './pages/Sites'
import UsersRoles from './pages/UsersRoles'

export default function App(){
 return <LanguageProvider><AuthProvider><BrowserRouter><Routes>
   <Route path="/login" element={<Login/>}/>
   <Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}>
     <Route path="/" element={<Dashboard/>}/>
     <Route path="/organizations" element={<Organizations/>}/>
     <Route path="/clients" element={<Clients/>}/>
     <Route path="/contracts" element={<Contracts/>}/>
     <Route path="/sites" element={<Sites/>}/>
     <Route path="/users" element={<UsersRoles/>}/>
   </Route>
 </Routes></BrowserRouter></AuthProvider></LanguageProvider>
}
