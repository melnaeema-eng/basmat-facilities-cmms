// One catalog controls navigation and route permissions. Legacy URLs stay valid.
export const moduleGroups = [
 ['overview','Workspace','مساحة العمل'],['setup','Project setup','إعداد المشروع'],
 ['assets','Assets & library','الأصول والمكتبة'],['operations','Maintenance & execution','الصيانة والتنفيذ'],
 ['supply','Stores & commercial','المخزون والتجاري'],['assurance','Quality & approvals','الجودة والاعتمادات'],
 ['insights','Reports & performance','التقارير والأداء'],['administration','Administration','الإدارة']
]
export const modules = [
  {
    "path": "/",
    "page": "Dashboard",
    "permission": null,
    "en": "Overview",
    "ar": "نظرة عامة",
    "icon": "home",
    "group": "overview",
    "nav": true
  },
  {
    "path": "/work-orders",
    "page": "WorkOrdersHub",
    "permission": [
      "corrective.view",
      "ppm.view"
    ],
    "en": "Maintenance center",
    "ar": "مركز الصيانة",
    "icon": "work",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/organizations",
    "page": "OrganizationOnboarding",
    "permission": "organizations.view",
    "en": "Organizations",
    "ar": "المنظمات",
    "icon": "org",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/soft-fm",
    "page": "SoftFmOperations",
    "permission": "soft-fm.view",
    "en": "Soft FM",
    "ar": "الخدمات المساندة",
    "icon": "services",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/governance",
    "page": "GovernanceMatrix",
    "permission": "governance.view",
    "en": "Governance matrix",
    "ar": "مصفوفة الحوكمة",
    "icon": "work",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/access-review",
    "page": "AccessReview",
    "permission": "access-review.view",
    "en": "Access review",
    "ar": "مراجعة الوصول",
    "icon": "work",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/owners",
    "page": "Clients",
    "permission": "clients.view",
    "en": "Owners",
    "ar": "الملاك",
    "icon": "client",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/contracts",
    "page": "Contracts",
    "permission": "contracts.view",
    "en": "Contracts",
    "ar": "العقود",
    "icon": "contract",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/sites",
    "page": "Sites",
    "permission": "sites.view",
    "en": "Facilities / Sites",
    "ar": "المرافق والمواقع",
    "icon": "building",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/locations",
    "page": "LocationManagement",
    "permission": "locations.view",
    "en": "Locations",
    "ar": "المواقع",
    "icon": "pin",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/asset-categories",
    "page": "AssetCategories",
    "permission": "assets.view",
    "en": "Asset Categories",
    "ar": "تصنيفات الأصول",
    "icon": "grid",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/asset-library",
    "page": "MasterAssetLibrary",
    "permission": "assets.view",
    "en": "Asset Library",
    "ar": "مكتبة الأصول والصيانة",
    "icon": "grid",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/assets",
    "page": "AssetRegister",
    "permission": "assets.view",
    "en": "Assets",
    "ar": "الأصول",
    "icon": "asset",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/assets/:id",
    "page": "AssetDetails",
    "permission": "assets.view",
    "en": "AssetDetails",
    "ar": "AssetDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/asset-passport",
    "page": "AssetPassport",
    "permission": "assets.view",
    "en": "AssetPassport",
    "ar": "AssetPassport",
    "icon": "work",
    "group": "assets",
    "nav": false
  },
  {
    "path": "/asset-passport/:id",
    "page": "AssetPassport",
    "permission": "assets.view",
    "en": "AssetPassport",
    "ar": "AssetPassport",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/corrective",
    "page": "Corrective",
    "permission": "corrective.view",
    "en": "Work Orders",
    "ar": "أوامر العمل",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/corrective/:kind/:id",
    "page": "CorrectiveDetails",
    "permission": "corrective.view",
    "en": "CorrectiveDetails",
    "ar": "CorrectiveDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/ppm",
    "page": "PPM",
    "permission": "ppm.view",
    "en": "Preventive Maintenance",
    "ar": "الصيانة الوقائية",
    "icon": "calendar",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/ppm/:kind/:id",
    "page": "PPMDetails",
    "permission": "ppm.view",
    "en": "PPMDetails",
    "ar": "PPMDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/inventory",
    "page": "Inventory",
    "permission": "inventory.view",
    "en": "Inventory",
    "ar": "المخزون",
    "icon": "box",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/inventory/request/:id",
    "page": "InventoryDetails",
    "permission": "inventory.view",
    "en": "InventoryDetails",
    "ar": "InventoryDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/procurement",
    "page": "Procurement",
    "permission": "procurement.view",
    "en": "Procurement",
    "ar": "المشتريات",
    "icon": "cart",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/procurement/:kind/:id",
    "page": "ProcurementDetails",
    "permission": "procurement.view",
    "en": "ProcurementDetails",
    "ar": "ProcurementDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/advanced-stock",
    "page": "AdvancedStock",
    "permission": "inventory.view",
    "en": "Advanced Stock",
    "ar": "المخزون المتقدم",
    "icon": "stack",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/advanced-stock/:id",
    "page": "AdvancedStockDetails",
    "permission": "inventory.view",
    "en": "AdvancedStockDetails",
    "ar": "AdvancedStockDetails",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/reports",
    "page": "ReportsHub",
    "permission": "reports.view",
    "en": "Reports",
    "ar": "التقارير",
    "icon": "report",
    "group": "insights",
    "nav": true
  },
  {
    "path": "/kpi",
    "page": "KpiDashboard",
    "permission": "kpi.view",
    "en": "KPIs",
    "ar": "مؤشرات الأداء",
    "icon": "chart",
    "group": "insights",
    "nav": true
  },
  {
    "path": "/audit",
    "page": "AuditCenter",
    "permission": "audit.view",
    "en": "Audit Log",
    "ar": "سجل التدقيق",
    "icon": "audit",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/planning",
    "page": "PlanningCalendar",
    "permission": "planning.view",
    "en": "Operations Calendar",
    "ar": "التقويم التشغيلي",
    "icon": "calendar",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/supplier-performance",
    "page": "SupplierPerformance",
    "permission": "supplier-performance.view",
    "en": "Vendors",
    "ar": "الموردون",
    "icon": "truck",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/workforce",
    "page": "WorkforceDispatch",
    "permission": "workforce.view",
    "en": "Workforce",
    "ar": "القوى العاملة",
    "icon": "users",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/backlog",
    "page": "BacklogPriority",
    "permission": "backlog.view",
    "en": "Backlog",
    "ar": "الأعمال المتراكمة",
    "icon": "list",
    "group": "insights",
    "nav": true
  },
  {
    "path": "/reliability",
    "page": "ReliabilityDashboard",
    "permission": "reliability.view",
    "en": "Reliability",
    "ar": "الاعتمادية",
    "icon": "pulse",
    "group": "insights",
    "nav": true
  },
  {
    "path": "/compliance",
    "page": "ComplianceRegister",
    "permission": "compliance.view",
    "en": "Compliance",
    "ar": "الامتثال",
    "icon": "check",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/permits",
    "page": "PermitToWork",
    "permission": "permit.view",
    "en": "Permits",
    "ar": "التصاريح",
    "icon": "permit",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/utilities",
    "page": "UtilitiesDashboard",
    "permission": "utilities.view",
    "en": "Utilities",
    "ar": "المرافق الخدمية",
    "icon": "bolt",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/hse",
    "page": "HseIncidents",
    "permission": "hse.view",
    "en": "HSE",
    "ar": "السلامة والصحة المهنية",
    "icon": "shield",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/contract-renewal",
    "page": "ContractRenewalDashboard",
    "permission": "contract-renewal.view",
    "en": "Contract Renewal",
    "ar": "تجديد العقود",
    "icon": "renew",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/executive",
    "page": "ExecutiveDashboard",
    "permission": "executive.view",
    "en": "Executive Dashboard",
    "ar": "اللوحة التنفيذية",
    "icon": "dashboard",
    "group": "insights",
    "nav": true
  },
  {
    "path": "/document-control",
    "page": "DocumentControl",
    "permission": "document-control.view",
    "en": "Document Control",
    "ar": "ضبط المستندات",
    "icon": "folder",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/field-mobile",
    "page": "MobileField",
    "permission": "mobile-field.view",
    "en": "Mobile Field",
    "ar": "العمل الميداني",
    "icon": "mobile",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/qr-scan",
    "page": "QrAssetScanner",
    "permission": "mobile-field.view",
    "en": "Scan Asset QR",
    "ar": "مسح QR للأصل",
    "icon": "mobile",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/security-readiness",
    "page": "SecurityReadiness",
    "permission": "security.view",
    "en": "Security",
    "ar": "الأمن",
    "icon": "lock",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/release-readiness",
    "page": "ReleaseReadiness",
    "permission": "release.view",
    "en": "System Readiness",
    "ar": "جاهزية النظام",
    "icon": "check",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/enterprise-access",
    "page": "EnterpriseAccess",
    "permission": "enterprise-access.view",
    "en": "Project access",
    "ar": "صلاحيات المشاريع",
    "icon": "work",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/enterprise-structure",
    "page": "EnterpriseStructure",
    "permission": "enterprise-structure.view",
    "en": "Structure",
    "ar": "الهيكل التشغيلي",
    "icon": "tree",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/facility-reference-library",
    "page": "FacilitiesReferenceLibrary",
    "permission": "enterprise-structure.view",
    "en": "Facilities reference library",
    "ar": "المكتبة المرجعية للمرافق",
    "icon": "building",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/roles-permissions",
    "page": "RolesPermissions",
    "permission": "roles.view",
    "en": "Roles & Permissions",
    "ar": "الأدوار والصلاحيات",
    "icon": "lock",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/library-deployment",
    "page": "LibraryDeployment",
    "permission": "assets.view",
    "en": "Library → Project → PPM",
    "ar": "المكتبة → المشروع → PPM",
    "icon": "calendar",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/technician-execution",
    "page": "TechnicianExecution",
    "permission": "maintenance.execute",
    "en": "Technician execution",
    "ar": "تنفيذ الفني",
    "icon": "work",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/approvals",
    "page": "ApprovalPortal",
    "permission": "approvals.view",
    "en": "Approvals",
    "ar": "الاعتمادات",
    "icon": "work",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/notifications",
    "page": "Notifications",
    "permission": "notifications.view",
    "en": "Notifications",
    "ar": "الإشعارات",
    "icon": "work",
    "group": "administration",
    "nav": false
  },
  {
    "path": "/documents",
    "page": "Documents",
    "permission": "documents.view",
    "en": "Documents",
    "ar": "المستندات",
    "icon": "work",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/asset-lifecycle",
    "page": "AssetLifecycle",
    "permission": "lifecycle.view",
    "en": "Asset lifecycle",
    "ar": "دورة حياة الأصل",
    "icon": "work",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/maintenance-costing",
    "page": "MaintenanceCosting",
    "permission": "costing.view",
    "en": "Maintenance costs",
    "ar": "تكاليف الصيانة",
    "icon": "work",
    "group": "supply",
    "nav": true
  },
  {
    "path": "/owner-portal",
    "page": "OwnerPortal",
    "permission": "clients.view",
    "en": "Owner portal",
    "ar": "بوابة المالك",
    "icon": "work",
    "group": "assurance",
    "nav": true
  },
  {
    "path": "/project-setup",
    "page": "ProjectSetupWizard",
    "permission": "organizations.view",
    "en": "Project setup",
    "ar": "إعداد المشروع",
    "icon": "work",
    "group": "setup",
    "nav": true
  },
  {
    "path": "/users",
    "page": "UsersRoles",
    "permission": "users.view",
    "en": "Users & access",
    "ar": "المستخدمون والصلاحيات",
    "icon": "users",
    "group": "administration",
    "nav": true
  }
]

export function permitted(module, can) {
 return !module.permission || (Array.isArray(module.permission)
  ? module.permission.some(key => can(key)) : can(module.permission))
}
export function moduleForPath(path) {
 const candidates = modules.filter(m => path === m.path || (m.path !== '/' && !m.path.includes(':') && path.startsWith(m.path + '/')))
 return candidates.sort((a,b) => b.path.length-a.path.length)[0] || modules[0]
}
export const moduleLabel = (module, lang) => module[lang === 'ar' ? 'ar' : 'en']
