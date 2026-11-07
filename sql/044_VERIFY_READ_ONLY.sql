-- Read-only installation verification. No data changes.
select name,to_regclass('public.'||name) is not null as installed
from unnest(array['bf44_policies','bf44_workflows','bf44_review_links','bf44_certificates','bf44_statements','bf44_statement_lines','bf44_events']) name;
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('bf44_policies','bf44_workflows','bf44_review_links','bf44_certificates','bf44_statements','bf44_statement_lines','bf44_events');
select t.tgname as guard,t.tgenabled as enabled
from pg_trigger t where not t.tgisinternal and t.tgname like 'bf44_%' order by t.tgname;
select p.proname as function_name,has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'bf44_%';

-- Corrected installation has the new endpoint and does not require the old table.
select to_regprocedure('public.bf44_approval_action(text,uuid,jsonb)') is not null as integrated_approval_installed,
       to_regprocedure('public.bf44_reviewer_eligible(uuid,uuid,text)') is not null as modern_reviewer_check_installed;
