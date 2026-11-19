alter table public.bf44_statements add column statement_kind text not null default 'period'
  check (statement_kind in ('period','monthly'));
alter table public.bf44_statements add column pricing_contract_id uuid references public.bf_contracts(id);
alter table public.bf44_statements add constraint bf44_monthly_whole_month
  check (statement_kind<>'monthly' or (pricing_contract_id is not null and extract(day from period_start)=1 and period_end=(period_start+interval '1 month - 1 day')::date));
create unique index bf44_one_monthly_statement on public.bf44_statements(project_id,period_start) where statement_kind='monthly';

create table public.bf44_contract_price_items (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.bf_contracts(id),
 item_code text not null check(length(item_code) between 1 and 80),
 description text not null check(length(description) between 3 and 300),
 category text not null check(category in ('labor','parts','cleaning','plant','other')),
 unit text not null check(length(unit) between 1 and 50),
 pricing text not null check(pricing in ('unit','monthly','included')),
 unit_rate numeric(16,4) not null check(unit_rate>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(contract_id,currency,item_code)
);
create table public.bf44_statement_measurements (
 id uuid primary key default gen_random_uuid(),
 statement_id uuid not null references public.bf44_statements(id),
 certificate_id uuid not null references public.bf44_certificates(id),
 price_item_id uuid not null references public.bf44_contract_price_items(id),
 period_start date not null,
 item_code text not null,
 description text not null,
 category text not null,
 unit text not null,
 pricing text not null,
 unit_rate numeric(16,4) not null,
 quantity numeric(14,3) not null check(quantity>0),
 location text,
 basis text not null check(length(basis) between 5 and 1000),
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now(),
 work_value numeric(18,2) generated always as (round(quantity*unit_rate,2)) stored,
 claim_value numeric(18,2) generated always as (case when pricing='included' then 0 else round(quantity*unit_rate,2) end) stored,
 unique(statement_id,certificate_id,price_item_id),
 check(pricing<>'monthly' or quantity=1)
);
create unique index bf44_monthly_rate_once on public.bf44_statement_measurements(price_item_id,period_start) where pricing='monthly';
alter table public.bf44_contract_price_items enable row level security;
alter table public.bf44_statement_measurements enable row level security;
revoke all on public.bf44_contract_price_items,public.bf44_statement_measurements from public,anon,authenticated;

create function private.bf44_measure_totals(p_statement uuid,p_certificate uuid)
returns table (items bigint,coverage text,labor numeric,parts numeric,plant numeric,other numeric,basis text)
language sql stable set search_path='' as $$
 select count(*),case when coalesce(sum(m.claim_value),0)>0 then 'billable' else 'included' end,
   coalesce(sum(m.claim_value) filter(where m.category='labor'),0),
   coalesce(sum(m.claim_value) filter(where m.category='parts'),0),
   coalesce(sum(m.claim_value) filter(where m.category='plant'),0),
   coalesce(sum(m.claim_value) filter(where m.category in ('cleaning','other')),0),
   left(string_agg(m.item_code||': '||m.basis, ' / ' order by m.item_code),2000)
 from public.bf44_statement_measurements m
 where m.statement_id=p_statement and m.certificate_id=p_certificate
$$;
revoke all on function private.bf44_measure_totals(uuid,uuid) from public,anon,authenticated;

create function private.bf44_monthly_line_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare totals record;
begin
 if not exists(select 1 from public.bf44_statements s
   where s.id=case when tg_op='DELETE' then old.statement_id else new.statement_id end and s.statement_kind='monthly')
 then if tg_op='DELETE' then return old; end if; return new; end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.bf44_statement_measurements m
    where m.statement_id=old.statement_id and m.certificate_id=old.certificate_id)
  then raise exception 'Remove the work measurements before deleting their statement line'; end if;
  return old;
 end if;
 select * into totals from private.bf44_measure_totals(new.statement_id,new.certificate_id);
 if totals.items=0 or row(new.coverage,new.labor,new.parts,new.plant,new.other)
   is distinct from row(totals.coverage,totals.labor,totals.parts,totals.plant,totals.other)
 then raise exception 'Monthly statement requires calculated work measurements'; end if;
 return new;
end
$$;
revoke all on function private.bf44_monthly_line_guard() from public,anon,authenticated;
create trigger bf44_monthly_line_guard before insert or update or delete on public.bf44_statement_lines
 for each row execute function private.bf44_monthly_line_guard();

create function private.bf44_monthly_approval_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.statement_kind='monthly' and new.status='approved' and old.status is distinct from new.status then
  new.approved_snapshot:=coalesce(new.approved_snapshot,'{}'::jsonb)||jsonb_build_object(
   'statement_kind','monthly','work_measurements',coalesce((
    select jsonb_agg(to_jsonb(m) order by m.certificate_id,m.item_code)
    from public.bf44_statement_measurements m where m.statement_id=new.id),'[]'::jsonb));
 end if;
 return new;
end
$$;
revoke all on function private.bf44_monthly_approval_snapshot() from public,anon,authenticated;
create trigger bf44_monthly_approval_snapshot before update on public.bf44_statements
 for each row execute function private.bf44_monthly_approval_snapshot();

create function public.bf44_create_monthly_statement(p_project uuid,p_month date)
returns uuid language plpgsql security definer set search_path='' as $$
declare k uuid; contract uuid;
begin
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 then
   raise exception 'Select a calendar month'; end if;
 if auth.uid() is null or not exists(select 1 from public.bf_profiles p where p.id=auth.uid() and p.status='active')
  or not public.bf44_staff(p_project,'costing.manage') then
   raise exception 'Project finance permission required' using errcode='42501'; end if;
 if exists(select 1 from public.bf44_policies p where p.project_id=p_project and auth.uid() in (p.owner_reviewer,p.consultant_reviewer))
 then raise exception 'Statement preparation must be independent of approval' using errcode='42501'; end if;
 select pr.contract_id into contract from public.bf35_projects pr where pr.id=p_project for share;
 if contract is null then raise exception 'Link an active contract to the project before creating a monthly statement'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_month::text,61));
 select s.id into k from public.bf44_statements s
 where s.project_id=p_project and s.period_start=p_month and s.statement_kind='monthly';
 if found then return k; end if;
 k:=public.bf44_statement_action('create',null,jsonb_build_object(
   'project_id',p_project,'period_start',p_month,'period_end',(p_month+interval '1 month - 1 day')::date));
 update public.bf44_statements set statement_kind='monthly',pricing_contract_id=contract where id=k;
 return k;
end
$$;
revoke all on function public.bf44_create_monthly_statement(uuid,date) from public,anon;
grant execute on function public.bf44_create_monthly_statement(uuid,date) to authenticated;

create function public.bf44_statement_measure(p_statement uuid,p_action text,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 st public.bf44_statements;
 pr public.bf35_projects;
 po public.bf44_policies;
 rate public.bf44_contract_price_items;
 item public.bf44_statement_measurements;
 cert public.bf44_certificates;
 wo public.bf_work_orders;
 v uuid;
 q numeric;
 price numeric;
 loc text;
 totals record;
 training boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.bf_profiles p where p.id=auth.uid() and p.status='active')
 then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>8192 then raise exception 'Invalid payload'; end if;
 select * into st from public.bf44_statements where id=p_statement for update;
 if st.id is null or st.statement_kind<>'monthly' or st.status not in ('draft','rejected')
   or not public.bf44_staff(st.project_id,'costing.manage')
 then raise exception 'Editable monthly statement permission required' using errcode='42501'; end if;
 select * into strict pr from public.bf35_projects where id=st.project_id for share;
 if pr.contract_id is distinct from st.pricing_contract_id then
  raise exception 'The project contract changed. Review this monthly statement before changing measurements'; end if;
 select * into strict po from public.bf44_policies where project_id=st.project_id;
 if auth.uid() in (po.owner_reviewer,po.consultant_reviewer) then raise exception 'Statement preparation must be independent of approval' using errcode='42501'; end if;
 training:=exists(select 1 from private.bf48_test_cycle_access g where g.project_id=st.project_id and 'finance.manage'=any(g.permission_keys));

 if p_action='add_rate' then
  price:=(p_data->>'unit_rate')::numeric;
  if price is null or price::text in ('NaN','Infinity','-Infinity') or price<0 or price>=1000000000000 or scale(price)>4 then raise exception 'Enter a valid contract unit price'; end if;
  if training and (p_data->>'pricing' is distinct from 'included' or price<>0) then raise exception 'Training rates must be included and zero'; end if;
  insert into public.bf44_contract_price_items(contract_id,item_code,description,category,unit,pricing,unit_rate,currency,created_by)
  values(pr.contract_id,btrim(upper(p_data->>'item_code')),btrim(p_data->>'description'),p_data->>'category',
    btrim(p_data->>'unit'),p_data->>'pricing',price,po.currency,auth.uid()) returning id into v;
  return v;
 end if;

 if p_action='remove' then
  delete from public.bf44_statement_measurements m where m.statement_id=st.id and m.id=(p_data->>'measurement_id')::uuid returning * into item;
  if not found then raise exception 'Measurement does not belong to this statement'; end if;
  cert.id:=item.certificate_id;
  v:=item.id;
 elsif p_action='save' then
  q:=(p_data->>'quantity')::numeric;
  if q is null or q::text in ('NaN','Infinity','-Infinity') or q<=0 or q>=100000000000 or scale(q)>3
  then raise exception 'Enter a positive measured quantity'; end if;
  select c.* into cert from public.bf44_certificates c join public.bf44_workflows f on f.work_order_id=c.work_order_id
    where c.id=(p_data->>'certificate_id')::uuid and f.project_id=st.project_id
      and (c.issued_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end for update of c;
  if not found then raise exception 'Certificate must belong to this project and month'; end if;
  select * into rate from public.bf44_contract_price_items i where i.id=(p_data->>'price_item_id')::uuid
    and i.contract_id=pr.contract_id and i.currency=po.currency;
  if not found then raise exception 'Select a price item from the project contract'; end if;
  if training and (rate.pricing<>'included' or rate.unit_rate<>0) then raise exception 'Training rates must be included and zero'; end if;
  select * into strict wo from public.bf_work_orders w where w.id=cert.work_order_id;
  select s.name into loc from public.bf_sites s where s.id=wo.site_id;
  insert into public.bf44_statement_measurements(statement_id,certificate_id,price_item_id,period_start,
    item_code,description,category,unit,pricing,unit_rate,quantity,location,basis,recorded_by)
  values(st.id,cert.id,rate.id,st.period_start,rate.item_code,rate.description,rate.category,rate.unit,rate.pricing,
    rate.unit_rate,q,loc,btrim(p_data->>'basis'),auth.uid())
  on conflict(statement_id,certificate_id,price_item_id) do update set quantity=excluded.quantity,basis=excluded.basis,
    recorded_by=excluded.recorded_by,recorded_at=now()
  returning id into v;
 else
  raise exception 'Invalid measurement action';
 end if;

 select * into totals from private.bf44_measure_totals(st.id,cert.id);
 if totals.items=0 then
  delete from public.bf44_statement_lines l where l.statement_id=st.id and l.certificate_id=cert.id;
 else
  perform public.bf44_statement_action('add_line',st.id,jsonb_build_object(
   'certificate_id',cert.id,'coverage',totals.coverage,'labor',totals.labor,'parts',totals.parts,
   'plant',totals.plant,'other',totals.other,'basis',totals.basis));
 end if;
 return v;
end
$$;
revoke all on function public.bf44_statement_measure(uuid,text,jsonb) from public,anon;
grant execute on function public.bf44_statement_measure(uuid,text,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.bf44_statement_read(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare st public.bf44_statements;po public.bf44_policies;
begin
 select * into st from public.bf44_statements where id=p_id;
 if st.id is null or not(public.bf44_staff(st.project_id,'costing.manage') or public.bf44_reviewer(st.project_id,'owner') or public.bf44_reviewer(st.project_id,'consultant')) then raise exception 'Statement access required' using errcode='42501';end if;
 select * into po from public.bf44_policies where project_id=st.project_id;
 return jsonb_build_object('statement',to_jsonb(st),'zero_value_training',exists(
   select 1 from private.bf48_test_cycle_access g where g.project_id=st.project_id and 'finance.manage'=any(g.permission_keys)),'currency',po.currency,'total',(select coalesce(sum(net_amount),0)::text from public.bf44_statement_lines where statement_id=st.id),
 'reviewers',jsonb_build_object('owner',(select p.full_name from public.bf_profiles p where p.id=po.owner_reviewer),
    'consultant',(select p.full_name from public.bf_profiles p where p.id=po.consultant_reviewer)),
 'cycle_closed',st.status='approved' and exists(select 1 from public.bf44_statement_lines l where l.statement_id=st.id)
    and not exists(select 1 from public.bf44_statement_lines l
        join public.bf44_certificates c on c.id=l.certificate_id
        join public.bf_work_orders wo on wo.id=c.work_order_id
        where l.statement_id=st.id and wo.status is distinct from 'closed'),
 'work_measurements',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('certificate_number',c.certificate_number,
    'work_order_number',w.work_order_number) order by w.work_order_number,m.item_code)
    from public.bf44_statement_measurements m join public.bf44_certificates c on c.id=m.certificate_id
    join public.bf_work_orders w on w.id=c.work_order_id where m.statement_id=st.id),'[]'::jsonb),
 'rate_items',case when st.statement_kind='monthly' and st.status in ('draft','rejected')
   and public.bf44_staff(st.project_id,'costing.manage')
   and auth.uid() is distinct from po.owner_reviewer and auth.uid() is distinct from po.consultant_reviewer
   then coalesce((select jsonb_agg(to_jsonb(i)-array['created_by','created_at','contract_id'] order by i.item_code)
      from public.bf44_contract_price_items i where i.contract_id=st.pricing_contract_id and i.currency=po.currency),'[]'::jsonb)
   else '[]'::jsonb end,
 'project',(select jsonb_build_object('name',p.name,'owner',c.name,'provider',o.name,'contract',co.contract_number) from public.bf35_projects p join public.bf_clients c on c.id=p.client_id join public.bf_organizations o on o.id=p.organization_id join public.bf_contracts co on co.id=coalesce(st.pricing_contract_id,p.contract_id) where p.id=st.project_id),
 'lines',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('labor',l.labor::text,'parts',l.parts::text,'plant',l.plant::text,'other',l.other::text,'net_amount',l.net_amount::text,'certificate_number',c.certificate_number,'work_order_number',w.work_order_number,'asset',coalesce(a.name_en,a.name_ar),'serial_number',a.serial_number)) from public.bf44_statement_lines l join public.bf44_certificates c on c.id=l.certificate_id join public.bf_work_orders w on w.id=c.work_order_id join public.bf_assets a on a.id=w.asset_id where l.statement_id=st.id),'[]'::jsonb),
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.certificate_number,'work_order_number',w.work_order_number)) from public.bf44_certificates c join public.bf44_workflows f on f.work_order_id=c.work_order_id join public.bf_work_orders w on w.id=c.work_order_id where f.project_id=st.project_id and not exists(select 1 from public.bf44_statement_lines l where l.certificate_id=c.id) and (c.issued_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end),'[]'::jsonb),
 'can_edit',public.bf44_staff(st.project_id,'costing.manage'),'can_review',public.bf44_reviewer(st.project_id,case when st.status='consultant_review' then 'consultant' else 'owner' end));
end $function$;

CREATE OR REPLACE FUNCTION public.bf44_statement_center(p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET join_collapse_limit TO '1'
 SET from_collapse_limit TO '1'
 SET jit TO 'off'
AS $function$
declare result jsonb; actor uuid:=auth.uid(); registry boolean:=false;
begin
 if actor is null or not exists(select 1 from public.bf_profiles u where u.id=actor and u.status='active') then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 if p_org is not null then registry:=coalesce(public.bf35_can_view(p_org),false);end if;
 with scoped as materialized (
  select pr.*,c.name owner,o.name provider,co.contract_number contract,to_jsonb(po) policy,
   case when po.owner_reviewer=actor then public.bf44_reviewer(pr.id,'owner') else false end owner_reviewer,
   case when po.consultant_reviewer=actor then public.bf44_reviewer(pr.id,'consultant') else false end consultant_reviewer
  from public.bf35_projects pr
  join public.bf_clients c on c.id=pr.client_id and c.organization_id=pr.organization_id
  join public.bf_organizations o on o.id=pr.organization_id
  left join public.bf_contracts co on co.id=pr.contract_id
  left join public.bf44_policies po on po.project_id=pr.id
  where p_org is null or pr.organization_id=p_org
 ), capabilities as materialized (
  select s.*,case when s.owner_reviewer or s.consultant_reviewer then false
   else public.bf44_staff(s.id,'costing.manage') end can_finance
  from scoped s
 ), visible as materialized (
  select s.* from capabilities s where s.can_finance or s.owner_reviewer or s.consultant_reviewer
   or registry or public.bf44_view(s.id)
   or exists(select 1 from public.bf35_project_sites ps where ps.project_id=s.id and public.bf44_view(s.id,ps.site_id))
 ), projects as materialized (
  select v.id,v.name,v.owner,v.provider,v.contract,v.policy,v.can_finance,
   v.owner_reviewer can_activate,
   case when v.can_finance and v.policy->>'status' is distinct from 'active' then public.bf44_staff(v.id,'contracts.manage') else false end can_manage,
   v.consultant_reviewer
  from visible v
 )
 select jsonb_build_object('version',1,
  'projects',coalesce((select jsonb_agg(to_jsonb(p)-'consultant_reviewer' order by p.owner,p.name,p.id) from projects p),'[]'::jsonb),
  'statements',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from (
   select st.id,st.project_id,st.statement_number,st.period_start,st.period_end,st.status,st.statement_kind,st.created_at
   from public.bf44_statements st join projects p on p.id=st.project_id
   where p.can_finance or p.can_activate or p.consultant_reviewer
   order by st.created_at desc,st.id limit 200
  )x),'[]'::jsonb)) into result;
 return result;
end $function$;
