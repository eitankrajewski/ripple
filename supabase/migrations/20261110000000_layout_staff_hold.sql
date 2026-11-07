-- Managers can move/rotate stations, move staff between stations and hold orders.
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
    when 'manager' then array['view_twin','add_order','check_off','pick_up','correct_stock','approve_plan','hold_orders','manage_team','move_orders','pack','update_pickup','manage_layout','manage_menu']
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
    when 'item_done' then 'check_off'
    when 'picked_up' then 'pick_up'
    when 'stock_correction' then 'correct_stock'
    when 'approve_plan' then 'approve_plan'
    when 'release_order' then 'hold_orders'
    when 'cancel_order' then 'hold_orders'
    when 'move_order' then 'move_orders'
    when 'pack_item' then 'pack'
    when 'dasher_update' then 'update_pickup'
    when 'handoff_mismatch' then 'pick_up'
    when 'station_added' then 'manage_layout'
    when 'station_removed' then 'manage_layout'
    when 'menu_item_added' then 'manage_menu'
    when 'ingredient_added' then 'manage_menu'
    when 'station_moved' then 'manage_layout'
    when 'staff_moved' then 'manage_team'
    when 'hold_order' then 'hold_orders'
    else 'unknown'
  end;
  if need is not null and not (need = any (perms)) then return false; end if;
  if t in ('task_done', 'item_done') and role <> 'manager' then
    return (role = 'prep' and station = 'prep') or (role = 'cook' and station = 'cook') or (role = 'expo' and station = 'pack');
  end if;
  return true;
end;
$$;
