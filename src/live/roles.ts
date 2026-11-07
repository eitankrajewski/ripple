import type { LiveAction, Permission, Role, RoleInfo } from "./types";

export const ROLES: Record<Role, RoleInfo> = {
  manager: {
    id: "manager",
    label: "Manager",
    description: "Owns the kitchen. Sees the full twin, approves plans and manages the team.",
    permissions: ["view_twin", "add_order", "check_off", "pick_up", "correct_stock", "approve_plan", "hold_orders", "manage_team", "move_orders", "pack", "update_pickup", "manage_layout", "manage_menu"],
  },
  prep: {
    id: "prep",
    label: "Prep",
    description: "Prep station. Checks off prep for each order and recounts pantry stock.",
    station: "prep",
    permissions: ["view_twin", "check_off", "correct_stock"],
  },
  cook: {
    id: "cook",
    label: "Line cook",
    description: "Cook station. Checks off cooking for each order.",
    station: "cook",
    permissions: ["view_twin", "check_off"],
  },
  expo: {
    id: "expo",
    label: "Expo / Pack",
    description: "Pack station. Checks off packing and hands orders to customers and drivers.",
    station: "pack",
    permissions: ["view_twin", "check_off", "pick_up", "pack"],
  },
  host: {
    id: "host",
    label: "Host",
    description: "Front counter. Enters walk-in and phone orders and hands off pickups.",
    permissions: ["view_twin", "add_order", "pick_up", "update_pickup"],
  },
  integration: {
    id: "integration",
    label: "DoorDash",
    description: "Orders and courier updates sent in by the DoorDash integration.",
    permissions: ["add_order", "update_pickup"],
  },
};

export const JOINABLE_ROLES: Role[] = ["prep", "cook", "expo", "host", "manager"];

export function can(role: Role, permission: Permission) {
  return ROLES[role].permissions.includes(permission);
}

const ACTION_PERMISSION: Record<LiveAction["type"], Permission | null> = {
  member_joined: null,
  member_left: null,
  order_received: "add_order",
  task_done: "check_off",
  item_done: "check_off",
  station_added: "manage_layout",
  station_removed: "manage_layout",
  station_moved: "manage_layout",
  staff_moved: "manage_team",
  hold_order: "hold_orders",
  menu_item_added: "manage_menu",
  ingredient_added: "manage_menu",
  picked_up: "pick_up",
  stock_correction: "correct_stock",
  approve_plan: "approve_plan",
  release_order: "hold_orders",
  cancel_order: "hold_orders",
  move_order: "move_orders",
  pack_item: "pack",
  dasher_update: "update_pickup",
  handoff_mismatch: "pick_up",
};

/** Server-side rule: is this role allowed to append this action? Station roles may only check off their own station. */
export function allowed(role: Role, action: LiveAction) {
  const perm = ACTION_PERMISSION[action.type];
  if (perm && !can(role, perm)) return false;
  if ((action.type === "task_done" || action.type === "item_done") && role !== "manager" && ROLES[role].station !== action.station) return false;
  return true;
}
