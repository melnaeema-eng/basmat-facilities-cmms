import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom'
import {AuthProvider} from './context/AuthContext'
import {LanguageProvider} from './i18n/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Organizations from './pages/Organizations'
import Clients from './pages/Clients'
import Contracts from './pages/Contracts'
import Sites from './pages/Sites'
import UsersRoles from './pages/UsersRoles'
import LocationManagement from './pages/LocationManagement'
import AssetCategories from './pages/AssetCategories'
import AssetRegister from './pages/AssetRegister'
import Corrective from './pages/Corrective'
import CorrectiveDetails from './pages/CorrectiveDetails'
import AssetDetails from './pages/AssetDetails'
export default function App(){
 const guard=(permission,element)=><PermissionRoute permission={permission}>{element}</PermissionRoute>
 return <LanguageProvider><AuthProvider><BrowserRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}>
   <Route index element={<Dashboard/>}/>
   <Route path="/organizations" element={guard('organizations.view',<Organizations/>)}/>
   <Route path="/clients" element={guard('clients.view',<Clients/>)}/>
   <Route path="/contracts" element={guard('contracts.view',<Contracts/>)}/>
   <Route path="/sites" element={guard('sites.view',<Sites/>)}/>
   <Route path="/locations" element={guard('locations.view',<LocationManagement/>)}/>
   <Route path="/asset-categories" element={guard('assets.view',<AssetCategories/>)}/>
   <Route path="/assets" element={guard('assets.view',<AssetRegister/>)}/>
   <Route path="/assets/:id" element={guard('assets.view',<AssetDetails/>)}/>
   <Route path="/corrective" element={guard('corrective.view',<Corrective/>)}/>
   <Route path="/corrective/:kind/:id" element={guard('corrective.view',<CorrectiveDetails/>)}/>
   <Route path="/users"  element={guard('users.view',<UsersRoles/>)}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route>
 </Routes></BrowserRouter></AuthProvider></LanguageProvider>
}
