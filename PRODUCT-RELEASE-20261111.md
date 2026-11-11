# Basmat Facilities CMMS — Unified product release

The Facilities product now uses the Medical product's main navigation and visual system, adapted to facilities assets. Existing Facilities routes, organization records, authorization functions and maintenance workflow remain in place.

## Delivered
- Work / Setup / Support navigation: dashboard; assets and maintenance; corrective orders; preventive schedule; approvals; certificates; notifications; setup; library; contracts; users; roles; inventory; procurement; reports.
- Additional Facilities tools remain available under More, including Soft FM, permits, utilities, statements, the integrated maintenance cycle and reference libraries.
- Facilities-only catalog uses bf_master_* tables, with stable pagination, brand/model search and matching maintenance references/steps. Catalog entries are not declared manufacturer-approved merely because they exist.
- Catalog selection prefills the existing validated asset editor; registration is restricted to the selected company, project owner and linked site.
- Asset passports include detailed location, owner/provider branding and a QR label with 90 × 60 mm print layout.
- Shared owner-logo and add-owner flows, clear owner terminology, simplified project setup, readable report names, and weekly/monthly/annual owner reports.
- Report branding retains server RLS. The UI explains missing active company membership before attempting restricted persistence.

## Data and access
No production data was reset, deleted, copied between tenants or generated for this release. No role grants, global templates or Supabase environment variables were changed. Medical catalog tables and Medical deployment were not modified.

## Validation
- Production build passes.
- 75 tests pass, including PostgreSQL maintenance-cycle tests for corrective/PPM work, evidence, stock reconciliation, review, owner acceptance, completion certificates, statement approval, final closure, RLS and revoked access.
- New tests cover catalog search, archived entries, brand/model template matching, exact project/company/site asset scope and retained routes.
- Interactive authenticated browser verification requires a signed-in session. The browser currently reaches the Facilities sign-in screen; this release does not claim a newly executed live production maintenance cycle.
