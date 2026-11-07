# Facilities workspace rebuild — 2026-11-07

Repository: melnaeema-eng/basmat-facilities-cmms. Based on main at 33ba787.
Existing installation: C:\projects\basmat-facilities-cmms, Vite port 5173.

## Delivered

- Rebuilt responsive workspace, orange/light green Basmat branding, separate
  Arabic/English navigation, module search, mobile drawer and keyboard access.
- One module catalog drives navigation and route permission checks. All existing
  operational page URLs are retained; /clients redirects to /owners.
- Maintenance center at /work-orders combines entry to corrective and preventive
  workflows without copying records or replacing their existing execution RPCs.
- Rebuilt dashboard with exact server counts, Saudi calendar month boundaries,
  status stages, partial error states, latest work orders and readable asset names.
  Completed work awaits review; approved work awaits closeout; closed is separate.
- Operational routes, including technician execution, now use the authenticated
  application shell. Documents, approvals, lifecycle, costing, notifications and
  project setup now have explicit module permission checks. Backend RLS and ACL
  logic are retained; this is not a server permission policy migration.
- Medical center is no longer exposed as a Facilities module. Its former URL
  redirects to maintenance. No separate Medical repository was modified.
- Pages load on demand, with module error boundaries. Missing connection settings
  show a bilingual setup screen instead of a blank application.
- Login returns to the requested page and handles connection failures.
- Owner terminology overrides UI labels while retaining existing bf_clients data,
  foreign keys, permissions and RPC parameter names.

## SQL

No new SQL is required by this change. No SQL, migration, database write, credential
change, data reset or automatic database deployment was performed. The existing
sql/ directory is retained unchanged. Any future SQL must be reviewed and executed
manually by the project owner.

## Validation and limits

Run:

    npm ci
    node --test tests/*.test.mjs
    npm run build

The initial baseline build and 7 existing tests passed. The rebuilt code passes
12 tests including route access/catalog regression and Saudi month boundaries.
Browser inspection verified the missing-configuration screen in both languages.
The production build passes; existing reports contain a large lazy-loaded chunk.

A valid Supabase URL/public key and authorized test account were not present in
this workspace. Live login, record creation, technician execution, attachments,
owner acceptance, report generation, per-company RLS and all existing specialist
modules still require acceptance against the user's configured environment.
Existing module forms, backend workflows and historical SQL were retained, not
individually rewritten or certified in this delivery. Offline queues and signed
immutable reports are not newly implemented by this workspace rebuild.

## Update the existing installation

Pull main into the existing folder, retaining its .env.local, then install with
npm ci and run npm run dev. The server uses strict port 5173. Do not paste a service
role key into a VITE_ variable. There is no new folder or database initialization.

For rollback, revert the rebuild commit on GitHub and pull main. No database
rollback is needed because this change has no database migration.
