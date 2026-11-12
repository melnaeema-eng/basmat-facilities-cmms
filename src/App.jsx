import {lazy, Suspense} from 'react'
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import {AuthProvider} from './context/AuthContext'
import {LanguageProvider, useLanguage} from './i18n/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import WorkspaceErrorBoundary from './components/WorkspaceErrorBoundary'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import {modules} from './config/modules'
import './basmat-print-signature.css'
const pages = {
 FacilitiesAssetCockpit:lazy(()=>import('./pages/FacilitiesAssetCockpit.jsx')),
 FacilitiesLibrary:lazy(()=>import('./pages/FacilitiesLibrary.jsx')),
 MaintenanceDossier:lazy(()=>import('./pages/MaintenanceDossier.jsx')),
 MaintenanceStatements:lazy(()=>import('./pages/MaintenanceStatements.jsx')),
 MaintenanceStatementDetails:lazy(()=>import('./pages/MaintenanceStatementDetails.jsx')),
 AccessReview:lazy(()=>import('./pages/AccessReview.jsx')),
 AdvancedStock:lazy(()=>import('./pages/AdvancedStock.jsx')),
 AdvancedStockDetails:lazy(()=>import('./pages/AdvancedStockDetails.jsx')),
 ApprovalPortal:lazy(()=>import('./pages/ApprovalPortal.jsx')),
 AssetCategories:lazy(()=>import('./pages/AssetCategories.jsx')),
 AssetDetails:lazy(()=>import('./pages/AssetDetails.jsx')),
 AssetLifecycle:lazy(()=>import('./pages/AssetLifecycle.jsx')),
 AssetPassport:lazy(()=>import('./pages/AssetPassport.jsx')),
 AssetRegister:lazy(()=>import('./pages/AssetRegister.jsx')),
 AuditCenter:lazy(()=>import('./pages/AuditCenter.jsx')),
 BacklogPriority:lazy(()=>import('./pages/BacklogPriority.jsx')),
 Clients:lazy(()=>import('./pages/Clients.jsx')),
 ComplianceRegister:lazy(()=>import('./pages/ComplianceRegister.jsx')),
 ContractRenewalDashboard:lazy(()=>import('./pages/ContractRenewalDashboard.jsx')),
 Contracts:lazy(()=>import('./pages/Contracts.jsx')),
 Corrective:lazy(()=>import('./pages/Corrective.jsx')),
 CorrectiveDetails:lazy(()=>import('./pages/CorrectiveDetails.jsx')),
 Dashboard:lazy(()=>import('./pages/Dashboard.jsx')),
 DocumentControl:lazy(()=>import('./pages/DocumentControl.jsx')),
 Documents:lazy(()=>import('./pages/Documents.jsx')),
 EnterpriseAccess:lazy(()=>import('./pages/EnterpriseAccess.jsx')),
 EnterpriseStructure:lazy(()=>import('./pages/EnterpriseStructure.jsx')),
 ExecutiveDashboard:lazy(()=>import('./pages/ExecutiveDashboard.jsx')),
 FacilitiesReferenceLibrary:lazy(()=>import('./pages/FacilitiesReferenceLibrary.jsx')),
 GovernanceMatrix:lazy(()=>import('./pages/GovernanceMatrix.jsx')),
 HseIncidents:lazy(()=>import('./pages/HseIncidents.jsx')),
 Inventory:lazy(()=>import('./pages/Inventory.jsx')),
 InventoryDetails:lazy(()=>import('./pages/InventoryDetails.jsx')),
 KpiDashboard:lazy(()=>import('./pages/KpiDashboard.jsx')),
 LibraryDeployment:lazy(()=>import('./pages/LibraryDeployment.jsx')),
 LocationManagement:lazy(()=>import('./pages/LocationManagement.jsx')),
 MaintenanceCosting:lazy(()=>import('./pages/MaintenanceCosting.jsx')),
 MasterAssetLibrary:lazy(()=>import('./pages/MasterAssetLibrary.jsx')),
 MobileField:lazy(()=>import('./pages/MobileField.jsx')),
 Notifications:lazy(()=>import('./pages/Notifications.jsx')),
 MaintenanceCompanies:lazy(()=>import('./pages/MaintenanceCompanies.jsx')),
 OrganizationOnboarding:lazy(()=>import('./pages/OrganizationOnboarding.jsx')),
 OwnerPortal:lazy(()=>import('./pages/OwnerPortal.jsx')),
 PPM:lazy(()=>import('./pages/PPM.jsx')),
 PPMDetails:lazy(()=>import('./pages/PPMDetails.jsx')),
 PermitToWork:lazy(()=>import('./pages/PermitToWork.jsx')),
 PlanningCalendar:lazy(()=>import('./pages/PlanningCalendar.jsx')),
 Procurement:lazy(()=>import('./pages/Procurement.jsx')),
 ProcurementDetails:lazy(()=>import('./pages/ProcurementDetails.jsx')),
 ProjectSetupWizard:lazy(()=>import('./pages/ProjectSetupWizard.jsx')),
 QrAssetScanner:lazy(()=>import('./pages/QrAssetScanner.jsx')),
 ReleaseReadiness:lazy(()=>import('./pages/ReleaseReadiness.jsx')),
 ReliabilityDashboard:lazy(()=>import('./pages/ReliabilityDashboard.jsx')),
 ReportsHub:lazy(()=>import('./pages/ReportsHub.jsx')),
 RolesPermissions:lazy(()=>import('./pages/RolesPermissions.jsx')),
 SecurityReadiness:lazy(()=>import('./pages/SecurityReadiness.jsx')),
 Sites:lazy(()=>import('./pages/Sites.jsx')),
 SoftFmOperations:lazy(()=>import('./pages/SoftFmOperations.jsx')),
 SupplierPerformance:lazy(()=>import('./pages/SupplierPerformance.jsx')),
 TechnicianExecution:lazy(()=>import('./pages/TechnicianExecution.jsx')),
 UsersRoles:lazy(()=>import('./pages/UsersRoles.jsx')),
 UtilitiesDashboard:lazy(()=>import('./pages/UtilitiesDashboard.jsx')),
 WorkOrdersHub:lazy(()=>import('./pages/WorkOrdersHub.jsx')),
 WorkforceDispatch:lazy(()=>import('./pages/WorkforceDispatch.jsx'))
}
function Loading(){const {lang}=useLanguage();return <div className="workspace-loading" role="status">{lang==='ar'?'جارٍ تحميل الوحدة…':'Loading workspace…'}</div>}
export default function App(){
 return <LanguageProvider><AuthProvider><BrowserRouter><Routes>
  <Route path="/login" element={<Login/>}/>
  <Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}>
   {modules.map(m=>{const Page=pages[m.page];return <Route key={m.path} path={m.path} element={
    <PermissionRoute permission={m.permission}><WorkspaceErrorBoundary key={m.path}><Suspense fallback={<Loading/>}><Page/></Suspense></WorkspaceErrorBoundary></PermissionRoute>
   }/>})}
   <Route path="/clients" element={<Navigate to="/owners" replace/>}/>
   <Route path="/medical" element={<Navigate to="/work-orders" replace/>}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route>
 </Routes></BrowserRouter></AuthProvider></LanguageProvider>
}
