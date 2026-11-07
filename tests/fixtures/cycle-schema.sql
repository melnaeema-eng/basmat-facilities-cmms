-- Isolated compatibility fixture, NOT a production migration.
create role anon;create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create table bf_profiles(id uuid primary key,full_name text,email text,status text,is_super_admin boolean default false);
create table bf_organizations(id uuid primary key,name text);
create table bf_clients(id uuid primary key,organization_id uuid,name text);
create table bf_contracts(id uuid primary key,organization_id uuid,client_id uuid,contract_number text);
create table bf_sites(id uuid primary key,organization_id uuid,client_id uuid,name text);
create table bf_buildings(id uuid primary key,name text);
create table bf_floors(id uuid primary key,name text);
create table bf_zones(id uuid primary key,name text);
create table bf_rooms(id uuid primary key,name text);
create table bf_assets(id uuid primary key,organization_id uuid,client_id uuid,site_id uuid,building_id uuid,floor_id uuid,zone_id uuid,room_id uuid,name_ar text,name_en text,asset_tag text,serial_number text,manufacturer text,model text,status text default 'active');
create table bf35_projects(id uuid primary key,organization_id uuid,client_id uuid,contract_id uuid,name text,status text default 'active');
create table bf35_project_sites(project_id uuid,site_id uuid,organization_id uuid,client_id uuid);
create table bf_roles(id uuid primary key,organization_id uuid);
create table bf_user_roles(user_id uuid,organization_id uuid,role_id uuid);
create table bf_permissions(id uuid primary key default gen_random_uuid(),code text unique);
create table bf_role_permissions(role_id uuid,permission_id uuid);
create table bf34_access_scopes(user_id uuid,organization_id uuid,role_id uuid,is_active boolean,valid_from date,valid_until date,client_id uuid,contract_id uuid,site_id uuid,discipline_code text);
create table bf_client_access(user_id uuid,organization_id uuid,client_id uuid);
create table bf_service_requests(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,contract_id uuid,site_id uuid,asset_id uuid,request_number text,status text default 'submitted',title text,reported_at timestamptz default now());
create table bf_work_orders(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,site_id uuid,contract_id uuid,asset_id uuid,request_id uuid,work_order_number text,title text,description text,priority text default 'P3',status text default 'draft',approval_status text default 'not_submitted',diagnosis text,root_cause text,work_performed text,tests_performed text,recommendations text,created_at timestamptz default now(),started_at timestamptz,completed_at timestamptz,closed_at timestamptz,updated_at timestamptz default now());
create table bf_work_order_assignments(work_order_id uuid,user_id uuid,assigned_at timestamptz default now());
create table bf_corrective_events(work_order_id uuid,actor_id uuid,action text,created_at timestamptz default now());
create table bf_ppm_plans(id uuid primary key,contract_id uuid);
create table bf_ppm_procedures(id uuid primary key,version integer,status text);
create table bf_ppm_jobs(id uuid primary key,assigned_to uuid,procedure_id uuid,plan_id uuid,organization_id uuid,client_id uuid,site_id uuid,asset_id uuid,work_order_id uuid,job_number text,due_date date,status text,procedure_snapshot jsonb,started_at timestamptz,completed_at timestamptz,closed_at timestamptz);
create table bf_ppm_events(job_id uuid,actor_id uuid,action text,created_at timestamptz default now());
create table bf_ppm_results(job_id uuid,step_id uuid,result text,reading numeric,comment text,updated_by uuid);
create table bf11_approvals(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,site_id uuid,entity_type text,entity_id uuid,reviewer_type text,status text default 'pending',round integer,subject text,request_comment text default '',requested_by uuid,decided_by uuid,decided_at timestamptz,decision_comment text);
create table bf13_documents(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,site_id uuid,document_number text,document_type text,entity_type text,entity_id uuid,title text,status text default 'final',snapshot jsonb,snapshot_hash text,generated_by uuid,generated_at timestamptz default now());
create sequence bf13_document_seq;
create table bf_inv_requests(id uuid,work_order_id uuid,request_number text,part_id uuid,owner_client_id uuid,quantity numeric,status text);
create table bf8_material_requests(id uuid primary key,work_order_id uuid,number text,status text);
create table bf_inv_parts(id uuid primary key,name_ar text,name_en text,sku text);
create table bf8_material_lines(id uuid primary key,request_id uuid,part_id uuid,owner_client_id uuid,quantity numeric,reserved_qty numeric default 0,issued_qty numeric default 0,received_qty numeric default 0,consumed_qty numeric default 0,returned_received_qty numeric default 0,returned_unreceived_qty numeric default 0);
create table bf9_evidence(id uuid,work_order_id uuid,file_name text,caption text,verified_at timestamptz,status text);
create table bf9_visits(id uuid,work_order_id uuid,technician_id uuid,visit_number text,started_at timestamptz,finished_at timestamptz,status text,work_performed text,tests_performed text);
create table bf9_labor(visit_id uuid,minutes integer);
create function bf4_user_can(p_user uuid,p_org uuid,p_permission text) returns boolean language sql as $$select true$$;
create function bf4_action(p_kind text,p_id uuid,p_action text,p_data jsonb) returns uuid language plpgsql as $$declare rid uuid;begin
 if p_kind='request' and p_action='convert' then
 insert into public.bf_work_orders(organization_id,client_id,contract_id,site_id,asset_id,request_id,title,work_order_number)
 select organization_id,client_id,contract_id,site_id,asset_id,id,title,'WO-CONVERTED' from public.bf_service_requests where id=p_id returning id into rid;return rid;
 elsif p_kind='request' and p_action='create' then
 insert into public.bf_service_requests(organization_id,client_id,contract_id,site_id,asset_id,title,request_number) values((p_data->>'organization_id')::uuid,(p_data->>'client_id')::uuid,(p_data->>'contract_id')::uuid,(p_data->>'site_id')::uuid,(p_data->>'asset_id')::uuid,p_data->>'title','SR-TEST') returning id into rid;return rid;
 end if;raise exception 'Fixture does not implement legacy action';end$$;
create function bf5_assign_job_work_order(p_job uuid,p_user uuid) returns uuid language sql as $$select p_job$$;
create function bf11_action(p_action text,p_id uuid,p_data jsonb) returns uuid language plpgsql as $$declare rid uuid;begin
 if p_action='create' then
 insert into public.bf11_approvals(organization_id,client_id,site_id,entity_type,entity_id,reviewer_type,round,subject,requested_by) values((p_data->>'organization_id')::uuid,(p_data->>'client_id')::uuid,(p_data->>'site_id')::uuid,p_data->>'entity_type',(p_data->>'entity_id')::uuid,p_data->>'reviewer_type',coalesce((select max(round)+1 from public.bf11_approvals where entity_id=(p_data->>'entity_id')::uuid and reviewer_type=p_data->>'reviewer_type'),1),p_data->>'subject',auth.uid()) returning id into rid;return rid;
 end if;update public.bf11_approvals set status=case when p_action='approve' then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now(),decision_comment=p_data->>'comment' where id=p_id;return p_id;
end$$;

-- Deployed modern ACL columns, reproduced without the missing legacy consultant table.
create table bf_acl_user_organizations(user_id uuid,organization_id uuid,is_active boolean default true);
create table bf_acl_user_projects(id uuid default gen_random_uuid(),user_id uuid,organization_id uuid,project_id uuid,module_code text,site_id uuid,discipline_code text,is_active boolean default true,valid_from date,valid_until date);
create table bf_acl_project_organizations(id uuid default gen_random_uuid(),project_id uuid,owner_organization_id uuid,organization_id uuid,relationship_type text,module_code text,site_id uuid,discipline_code text,is_active boolean default true,valid_from date,valid_until date);
create table bf_acl_user_roles(user_id uuid,organization_id uuid,role_id uuid,is_active boolean default true,valid_from date,valid_until date);
create table bf_acl_roles(id uuid primary key,organization_id uuid,role_code text,module_code text,is_active boolean default true);
create table bf_acl_role_permissions(role_id uuid,permission_key text,is_allowed boolean default true);
create table bf_acl_permissions(permission_key text primary key,module_code text,is_active boolean default true);
create table bf_acl_organization_permissions(organization_id uuid,permission_key text,is_allowed boolean default true);
create table bf_acl_organization_modules(organization_id uuid,module_code text,is_enabled boolean default true,valid_from date,valid_until date);
create table bf11_events(id bigint generated always as identity primary key,organization_id uuid,approval_id uuid,actor_id uuid,action text,details jsonb,created_at timestamptz default now());
CREATE OR REPLACE FUNCTION public.bf_acl_user_can_client(p_user uuid, p_org uuid, p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists (
      select 1
      from public.bf_profiles pr
      where pr.id=p_user
        and pr.status='active'
    )
    and exists (
      select 1
      from public.bf_acl_user_organizations uo
      where uo.user_id=p_user
        and uo.organization_id=p_org
        and uo.is_active=true
    )
    and exists (
      select 1
      from public.bf_acl_user_projects up
      join public.bf35_projects p
        on p.id=up.project_id
       and p.organization_id=up.organization_id
      where up.user_id=p_user
        and up.organization_id=p_org
        and up.is_active=true
        and (up.valid_from is null or up.valid_from<=current_date)
        and (up.valid_until is null or up.valid_until>=current_date)
        and p.client_id=p_client
        and p.status<>'archived'
    );
$function$;
CREATE OR REPLACE FUNCTION public.bf_acl_user_is_owner(p_user uuid, p_org uuid, p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    public.bf_acl_user_can_client(p_user,p_org,p_client)
    and exists (
      select 1
      from public.bf_acl_user_roles ur
      join public.bf_acl_roles r
        on r.id=ur.role_id
      where ur.user_id=p_user
        and ur.organization_id=p_org
        and ur.is_active=true
        and (ur.valid_from is null or ur.valid_from<=current_date)
        and (ur.valid_until is null or ur.valid_until>=current_date)
        and r.is_active=true
        and r.role_code='owner_rep'
    );
$function$;
CREATE OR REPLACE FUNCTION public.bf11_owner(p_org uuid, p_client uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.bf_acl_user_is_owner(
    auth.uid(),
    p_org,
    p_client
  );
$function$;
CREATE OR REPLACE FUNCTION public.bf11_consultant(p_org uuid, p_client uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_allowed boolean := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF to_regclass('public.bf11_consultant_access') IS NULL THEN
        RETURN false;
    END IF;

    IF NOT public.bf61_user_represents(auth.uid(), p_org) THEN
        RETURN false;
    END IF;

    EXECUTE '
        SELECT EXISTS (
            SELECT 1
            FROM public.bf_profiles p
            JOIN public.bf11_consultant_access a
              ON a.user_id = p.id
            WHERE p.id = $1
              AND p.status = ''active''
              AND a.organization_id = $2
              AND a.client_id = $3
        )'
    INTO v_allowed
    USING auth.uid(), p_org, p_client;

    RETURN COALESCE(v_allowed, false);
END;
$function$;
