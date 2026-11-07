-- RIPPLE live kitchens: kitchens, members (devices) and an append-only event log.
-- Devices sign in anonymously (Auth > Providers > Anonymous sign-ins must be enabled);
-- the manager's join code is what grants access to a kitchen.

create extension if not exists pgcrypto;

create table if not exists public.kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  role text not null check (role in ('manager', 'prep', 'cook', 'expo', 'host')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists members_kitchen_idx on public.members (kitchen_id);
create index if not exists members_user_idx on public.members (user_id);

create table if not exists public.events (
  id text primary key,
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  at integer not null check (at >= 0),
  ts bigint not null,
  actor jsonb not null,
  action jsonb not null,
  inserted_at timestamptz not null default now()
);
create index if not exists events_kitchen_idx on public.events (kitchen_id, at, ts);

alter table public.kitchens enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;

-- Helpers (security definer so policies don't recurse through RLS).
create or replace function public.ripple_is_member(k uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where kitchen_id = k and user_id = auth.uid() and left_at is null);
$$;

create or replace function public.ripple_member_role(k uuid, m text)
returns text language sql stable security definer set search_path = public as $$
  select role from members where id::text = m and kitchen_id = k and user_id = auth.uid() and left_at is null;
$$;

-- Mirrors allowed() in src/live/roles.ts.
create or replace function public.ripple_allowed(role text, action jsonb)
returns boolean language plpgsql immutable as $$
declare
  t text := action ->> 'type';
  station text := action ->> 'station';
  perms text[];
  need text;
begin
  perms := case role
    when 'manager' then array['view_twin','add_order','check_off','pick_up','correct_stock','approve_plan','hold_orders','manage_team','move_orders','pack','update_pickup']
    when 'prep' then array['view_twin','check_off','correct_stock']
    when 'cook' then array['view_twin','check_off']
    when 'expo' then array['view_twin','check_off','pick_up','pack']
    when 'host' then array['view_twin','add_order','pick_up','update_pickup']
    when 'integration' then array['add_order','update_pickup']
    else array[]::text[]
  end;
  need := case t
    when 'member_joined' then null
    when 'member_left' then null
    when 'order_received' then 'add_order'
    when 'task_done' then 'check_off'
    when 'picked_up' then 'pick_up'
    when 'stock_correction' then 'correct_stock'
    when 'approve_plan' then 'approve_plan'
    when 'release_order' then 'hold_orders'
    when 'cancel_order' then 'hold_orders'
    when 'move_order' then 'move_orders'
    when 'pack_item' then 'pack'
    when 'dasher_update' then 'update_pickup'
    when 'handoff_mismatch' then 'pick_up'
    else 'unknown'
  end;
  if need is not null and not (need = any (perms)) then return false; end if;
  if t = 'task_done' and role <> 'manager' then
    return (role = 'prep' and station = 'prep') or (role = 'cook' and station = 'cook') or (role = 'expo' and station = 'pack');
  end if;
  return true;
end;
$$;

-- Policies
drop policy if exists "members read their kitchen" on public.kitchens;
create policy "members read their kitchen" on public.kitchens for select using (public.ripple_is_member(id));

drop policy if exists "members read teammates" on public.members;
create policy "members read teammates" on public.members for select using (public.ripple_is_member(kitchen_id));

drop policy if exists "members read events" on public.events;
create policy "members read events" on public.events for select using (public.ripple_is_member(kitchen_id));

drop policy if exists "members append allowed events" on public.events;
create policy "members append allowed events" on public.events for insert with check (
  public.ripple_is_member(kitchen_id)
  and (
    -- as yourself, with your real role
    (
      public.ripple_member_role(kitchen_id, actor ->> 'memberId') = actor ->> 'role'
      and public.ripple_allowed(actor ->> 'role', action)
    )
    or
    -- managers and hosts may relay DoorDash orders (test orders / manual entry)
    (
      actor ->> 'role' = 'integration'
      and exists (
        select 1 from public.members m
        where m.kitchen_id = events.kitchen_id and m.user_id = auth.uid() and m.left_at is null and m.role in ('manager', 'host')
      )
      and public.ripple_allowed('integration', action)
    )
  )
);

-- Opening and joining go through functions so the join code is the only way in.
create or replace function public.create_kitchen(p_name text, p_manager_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k kitchens;
  m members;
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from kitchens where join_code = code);
  end loop;
  insert into kitchens (name, join_code, owner_id) values (trim(p_name), code, auth.uid()) returning * into k;
  insert into members (kitchen_id, user_id, name, role) values (k.id, auth.uid(), trim(p_manager_name), 'manager') returning * into m;
  return jsonb_build_object('kitchen', to_jsonb(k), 'member', to_jsonb(m));
end;
$$;

create or replace function public.join_kitchen(p_code text, p_name text, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k kitchens;
  m members;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into k from kitchens where join_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if not found then raise exception 'No kitchen uses that code. Check it with your manager.'; end if;
  insert into members (kitchen_id, user_id, name, role) values (k.id, auth.uid(), trim(p_name), p_role) returning * into m;
  return jsonb_build_object('kitchen', to_jsonb(k), 'member', to_jsonb(m));
end;
$$;

create or replace function public.leave_kitchen(p_member uuid)
returns void language sql security definer set search_path = public as $$
  update members set left_at = now() where id = p_member and user_id = auth.uid();
$$;

revoke all on function public.create_kitchen(text, text) from public, anon;
revoke all on function public.join_kitchen(text, text, text) from public, anon;
revoke all on function public.leave_kitchen(uuid) from public, anon;
grant execute on function public.create_kitchen(text, text) to authenticated;
grant execute on function public.join_kitchen(text, text, text) to authenticated;
grant execute on function public.leave_kitchen(uuid) to authenticated;

-- Realtime for the event log.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
