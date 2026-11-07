import type { OrderItem, OrderSource, StationId, StrategyId } from "../engine/types";

/** What a signed-in device is allowed to see and do in a kitchen. */
export type Role = "manager" | "prep" | "cook" | "expo" | "host";

export type Permission =
  | "view_twin"
  | "add_order"
  | "check_off"
  | "pick_up"
  | "correct_stock"
  | "approve_plan"
  | "hold_orders"
  | "manage_team";

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
  | { type: "order_received"; source: OrderSource; customer: string; items: OrderItem[] }
  | { type: "task_done"; orderId: string; station: StationId }
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
