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
    "en": "Dashboard",
    "ar": "الرئيسية",
    "icon": "home",
    "group": "overview",
    "nav": true
  },
  {
    "path": "/work-orders",
    "page": "WorkOrdersHub",
    "permission": [
      "corrective.view",
      "ppm.view",
      "clients.view",
      "contracts.view",
      "costing.view"
    ],
    "en": "Closeout, certificates & statements",
    "ar": "الإغلاق والشهادات والمستخلصات",
    "icon": "work",
    "group": "operations",
    "nav": false
  },
  {"path":"/maintenance-companies","page":"MaintenanceCompanies","permission":"organizations.view","en":"Maintenance companies","ar":"شركات الصيانة","icon":"org","group":"setup","nav":true},
  {
    "path": "/organizations",
    "page": "OrganizationOnboarding",
    "permission": "organizations.view",
    "en": "Organizations",
    "ar": "المنظمات",
    "icon": "org",
    "group": "setup",
    "nav": false
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
    "nav": false
  },
  {
    "path": "/access-review",
    "page": "AccessReview",
    "permission": "access-review.view",
    "en": "Access review",
    "ar": "مراجعة الوصول",
    "icon": "work",
    "group": "administration",
    "nav": false
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
    "en": "Facilities / sites",
    "ar": "المنشآت والمواقع",
    "icon": "building",
    "group": "setup",
    "nav": false
  },
  {
    "path": "/locations",
    "page": "LocationManagement",
    "permission": "locations.view",
    "en": "Buildings, floors & rooms",
    "ar": "المباني والطوابق والغرف",
    "icon": "pin",
    "group": "setup",
    "nav": false
  },
  {
    "path": "/asset-categories",
    "page": "AssetCategories",
    "permission": "assets.view",
    "en": "Company asset categories",
    "ar": "تصنيفات أصول الشركة",
    "icon": "grid",
    "group": "assets",
    "nav": false
  },
  {
    "path": "/asset-library",
    "page": "FacilitiesLibrary",
    "permission": "assets.view",
    "en": "Asset Library",
    "ar": "مكتبة الأصول",
    "icon": "grid",
    "group": "assets",
    "nav": true
  },
  {
    "path": "/assets",
    "page": "AssetRegister",
    "permission": "assets.view",
    "en": "Detailed asset register",
    "ar": "سجل الأصول التفصيلي",
    "icon": "asset",
    "group": "assets",
    "nav": false
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
    "en": "Asset passports & QR tags",
    "ar": "جوازات الأصول وتاق QR",
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
    "nav": true
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
    "en": "Preventive Schedule",
    "ar": "جدول الصيانة الوقائية",
    "icon": "calendar",
    "group": "operations",
    "nav": true
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
    "en": "Spare-parts requests & reservations",
    "ar": "طلبات قطع الغيار والحجز",
    "icon": "stack",
    "group": "supply",
    "nav": false
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
    "en": "Management Reports",
    "ar": "تقارير الإدارة",
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
    "nav": false
  },
  {
    "path": "/audit",
    "page": "AuditCenter",
    "permission": "audit.view",
    "en": "Audit Log",
    "ar": "سجل التدقيق",
    "icon": "audit",
    "group": "administration",
    "nav": false
  },
  {
    "path": "/planning",
    "page": "PlanningCalendar",
    "permission": "planning.view",
    "en": "Operations Calendar",
    "ar": "التقويم التشغيلي",
    "icon": "calendar",
    "group": "operations",
    "nav": false
  },
  {"path":"/suppliers","page":"Suppliers","permission":"procurement.view","en":"Suppliers","ar":"الموردون","icon":"truck","group":"supply","nav":true},
  {
    "path": "/supplier-performance",
    "page": "SupplierPerformance",
    "permission": "supplier-performance.view",
    "en": "Supplier performance",
    "ar": "تقييم الموردين",
    "icon": "truck",
    "group": "supply",
    "nav": false
  },
  {
    "path": "/workforce",
    "page": "WorkforceDispatch",
    "permission": "workforce.view",
    "en": "Workforce",
    "ar": "القوى العاملة",
    "icon": "users",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/backlog",
    "page": "BacklogPriority",
    "permission": "backlog.view",
    "en": "Backlog",
    "ar": "الأعمال المتراكمة",
    "icon": "list",
    "group": "insights",
    "nav": false
  },
  {
    "path": "/reliability",
    "page": "ReliabilityDashboard",
    "permission": "reliability.view",
    "en": "Reliability",
    "ar": "الاعتمادية",
    "icon": "pulse",
    "group": "insights",
    "nav": false
  },
  {
    "path": "/compliance",
    "page": "ComplianceRegister",
    "permission": "compliance.view",
    "en": "Compliance",
    "ar": "الامتثال",
    "icon": "check",
    "group": "assurance",
    "nav": false
  },
  {
    "path": "/permits",
    "page": "PermitToWork",
    "permission": "permit.view",
    "en": "Permits",
    "ar": "التصاريح",
    "icon": "permit",
    "group": "assurance",
    "nav": false
  },
  {
    "path": "/utilities",
    "page": "UtilitiesDashboard",
    "permission": "utilities.view",
    "en": "Utilities",
    "ar": "المرافق الخدمية",
    "icon": "bolt",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/hse",
    "page": "HseIncidents",
    "permission": "hse.view",
    "en": "HSE",
    "ar": "السلامة والصحة المهنية",
    "icon": "shield",
    "group": "assurance",
    "nav": false
  },
  {
    "path": "/contract-renewal",
    "page": "ContractRenewalDashboard",
    "permission": "contract-renewal.view",
    "en": "Contract Renewal",
    "ar": "تجديد العقود",
    "icon": "renew",
    "group": "supply",
    "nav": false
  },
  {
    "path": "/executive",
    "page": "ExecutiveDashboard",
    "permission": "executive.view",
    "en": "Executive Dashboard",
    "ar": "اللوحة التنفيذية",
    "icon": "dashboard",
    "group": "insights",
    "nav": false
  },
  {
    "path": "/document-control",
    "page": "DocumentControl",
    "permission": "document-control.view",
    "en": "Document Control",
    "ar": "ضبط المستندات",
    "icon": "folder",
    "group": "assurance",
    "nav": false
  },
  {
    "path": "/field-mobile",
    "page": "MobileField",
    "permission": "mobile-field.view",
    "en": "Mobile Field",
    "ar": "العمل الميداني",
    "icon": "mobile",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/qr-scan",
    "page": "QrAssetScanner",
    "permission": "mobile-field.view",
    "en": "Scan Asset QR",
    "ar": "مسح QR للأصل",
    "icon": "mobile",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/security-readiness",
    "page": "SecurityReadiness",
    "permission": "security.view",
    "en": "Security",
    "ar": "الأمن",
    "icon": "lock",
    "group": "administration",
    "nav": false
  },
  {
    "path": "/release-readiness",
    "page": "ReleaseReadiness",
    "permission": "release.view",
    "en": "System Readiness",
    "ar": "جاهزية النظام",
    "icon": "check",
    "group": "administration",
    "nav": false
  },
  {
    "path": "/enterprise-access",
    "page": "EnterpriseAccess",
    "permission": "enterprise-access.view",
    "en": "Project & site access scope",
    "ar": "نطاق الوصول للمشروع والموقع",
    "icon": "work",
    "group": "administration",
    "nav": false
  },
  {
    "path": "/enterprise-structure",
    "page": "EnterpriseStructure",
    "permission": "enterprise-structure.view",
    "en": "Project links & operating teams",
    "ar": "ربط المشاريع وفرق التشغيل",
    "icon": "tree",
    "group": "setup",
    "nav": false
  },
  {
    "path": "/facility-reference-library",
    "page": "FacilitiesReferenceLibrary",
    "permission": "enterprise-structure.view",
    "en": "Owner & service-company directory",
    "ar": "دليل الملاك وشركات الصيانة",
    "icon": "building",
    "group": "assets",
    "nav": false
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
    "en": "Adopt library procedures & schedule PPM",
    "ar": "اعتماد إجراءات المكتبة وجدولة الوقائية",
    "icon": "calendar",
    "group": "assets",
    "nav": false
  },
  {
    "path": "/technician-execution",
    "page": "TechnicianExecution",
    "permission": "maintenance.execute",
    "en": "Technician execution",
    "ar": "تنفيذ الفني",
    "icon": "work",
    "group": "operations",
    "nav": false
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
    "nav": true
  },
  {
    "path": "/documents",
    "page": "Documents",
    "permission": "documents.view",
    "en": "Reports & Certificates",
    "ar": "التقارير والشهادات",
    "icon": "doc",
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
    "nav": false
  },
  {
    "path": "/maintenance-costing",
    "page": "MaintenanceCosting",
    "permission": "costing.view",
    "en": "Maintenance costs",
    "ar": "تكاليف الصيانة",
    "icon": "work",
    "group": "supply",
    "nav": false
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
    "en": "Users & Access",
    "ar": "المستخدمون والصلاحيات",
    "icon": "users",
    "group": "administration",
    "nav": true
  },
  {
    "path": "/maintenance-cycle/:id",
    "page": "MaintenanceDossier",
    "permission": [
      "corrective.view",
      "ppm.view",
      "clients.view",
      "contracts.view",
      "costing.view"
    ],
    "en": "Maintenance dossier",
    "ar": "ملف دورة الصيانة",
    "group": "operations",
    "nav": false
  },
  {
    "path": "/statements",
    "page": "MaintenanceStatements",
    "permission": [
      "costing.view",
      "clients.view",
      "contracts.view"
    ],
    "en": "Maintenance statements",
    "ar": "مستخلصات الصيانة",
    "group": "supply",
    "nav": false
  },
  {
    "path": "/statements/:id",
    "page": "MaintenanceStatementDetails",
    "permission": [
      "costing.view",
      "clients.view",
      "contracts.view"
    ],
    "en": "Maintenance statement",
    "ar": "مستخلص الصيانة",
    "group": "supply",
    "nav": false
  },
  {
    "path": "/facility-asset-cockpit",
    "page": "FacilitiesAssetCockpit",
    "permission": "assets.view",
    "en": "Assets & Maintenance",
    "ar": "الأصول والصيانة",
    "icon": "asset",
    "group": "operations",
    "nav": true
  },
  {
    "path": "/library-admin",
    "page": "MasterAssetLibrary",
    "permission": "assets.view",
    "en": "Manage catalog types & templates",
    "ar": "إدارة أنواع وقوالب المكتبة",
    "icon": "grid",
    "group": "assets",
    "nav": false
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
