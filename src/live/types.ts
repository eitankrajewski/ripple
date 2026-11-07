import type { NewIngredient, NewMenuItem, OrderItem, OrderSource, PlacedStation, StationId, StrategyId } from "../engine/types";

/** What a signed-in device is allowed to see and do in a kitchen. */
export type Role = "manager" | "prep" | "cook" | "expo" | "host" | "integration";

export type Permission =
  | "view_twin"
  | "add_order"
  | "check_off"
  | "pick_up"
  | "correct_stock"
  | "approve_plan"
  | "hold_orders"
  | "manage_team"
  | "move_orders"
  | "pack"
  | "update_pickup"
  | "manage_layout"
  | "manage_menu";

export interface RoleInfo {
  id: Role;
  label: string;
  description: string;
  /** The station whose work this role checks off, if any. */
  station?: StationId;
  permissions: Permission[];
}

export interface KitchenSpace {
  id: string;
  name: string;
  /** Six-character code other devices use to join. */
  joinCode: string;
  ownerId: string;
  createdAt: number;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  joinedAt: number;
}

export interface Actor {
  memberId: string;
  name: string;
  role: Role;
}

/** Every change to a live kitchen is one of these, appended to the kitchen's event log. */
export type LiveAction =
  | { type: "member_joined"; member: Member }
  | { type: "member_left"; memberId: string }
  | {
      type: "order_received";
      source: OrderSource;
      customer: string;
      items: OrderItem[];
      dasherName?: string;
      dasherEtaMinutes?: number;
      /** DoorDash order id; repeated deliveries of the same webhook are ignored. */
      externalId?: string;
    }
  | { type: "move_order"; orderId: string; to: StationId | "ready" }
  | { type: "pack_item"; orderId: string; menuItemId: string; checked: boolean }
  | { type: "dasher_update"; orderId?: string; externalId?: string; etaMinutes: number }
  | { type: "handoff_mismatch"; orderId: string }
  | { type: "task_done"; orderId: string; station: StationId }
  | { type: "item_done"; orderId: string; menuItemId: string; station: StationId }
  | { type: "station_added"; station: PlacedStation }
  | { type: "station_removed"; id: string }
  | { type: "station_moved"; id: string; x: number; z: number; rot: number }
  | { type: "staff_moved"; from: StationId; to: StationId }
  | { type: "hold_order"; orderId: string }
  | { type: "menu_item_added"; item: NewMenuItem }
  | { type: "ingredient_added"; ingredient: NewIngredient }
  | { type: "picked_up"; orderId: string }
  | { type: "stock_correction"; ingredientId: string; newStock: number }
  | {
      type: "approve_plan";
      plan: { id: StrategyId; label: string; heldOrderIds: string[]; deferredOrderIds: string[]; batch: boolean };
    }
  | { type: "release_order"; orderId: string }
  | { type: "cancel_order"; orderId: string };

export interface LiveEvent {
  /** Globally unique: `${deviceId}:${counter}`. */
  id: string;
  kitchenId: string;
  /** Seconds since the kitchen opened, on the sender's clock. */
  at: number;
  /** Wall-clock ms; tie-breaker for ordering. */
  ts: number;
  actor: Actor;
  action: LiveAction;
}

export interface LiveSession {
  kitchen: KitchenSpace;
  me: Member;
}
