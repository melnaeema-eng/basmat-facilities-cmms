import AssetLifecycle from './pages/AssetLifecycle'
import Documents from './pages/Documents'
import Notifications from './pages/Notifications'
import ApprovalPortal from './pages/ApprovalPortal'
import ManagementReports from './pages/ManagementReports'
import AdvancedStock from './pages/AdvancedStock'
import AdvancedStockDetails from './pages/AdvancedStockDetails'
import Procurement from './pages/Procurement'
import ProcurementDetails from './pages/ProcurementDetails'
import Inventory from './pages/Inventory'
import InventoryDetails from './pages/InventoryDetails'
import PPM from './pages/PPM'
import PPMDetails from './pages/PPMDetails'
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
   <Route path="/ppm" element={guard('ppm.view',<PPM/>)}/>
   <Route path="/ppm/:kind/:id" element={guard('ppm.view',<PPMDetails/>)}/>
   <Route path="/inventory" element={guard('inventory.view',<Inventory/>)}/>
   <Route path="/inventory/request/:id" element={guard('inventory.view',<InventoryDetails/>)}/>
   <Route path="/procurement" element={guard('procurement.view',<Procurement/>)}/>
   <Route path="/procurement/:kind/:id" element={guard('procurement.view',<ProcurementDetails/>)}/>
   <Route path="/advanced-stock" element={guard('inventory.view',<AdvancedStock/>)}/>
   <Route path="/advanced-stock/:id" element={guard('inventory.view',<AdvancedStockDetails/>)}/>
   <Route path="/reports" element={guard('reports.view',<ManagementReports/>)}/>
   <Route path="/approvals" element={<ApprovalPortal/>}/>
   <Route path="/notifications" element={<Notifications/>}/>
   <Route path="/documents" element={<Documents/>}/>
   <Route path="/asset-lifecycle" element={<AssetLifecycle/>}/>
   <Route path="/users"       element={guard('users.view',<UsersRoles/>)}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route>
 </Routes></BrowserRouter></AuthProvider></LanguageProvider>
}
