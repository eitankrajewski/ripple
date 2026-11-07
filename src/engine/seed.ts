import type { OrderItem, OrderSource, StationId } from "./types";

export interface StationConfig {
  id: StationId;
  name: string;
  staff: number;
}

export interface MenuItemConfig {
  id: string;
  name: string;
  short: string;
  emoji: string;
  ingredients: Record<string, number>;
  minutes: Record<StationId, number>;
}

export interface IngredientConfig {
  id: string;
  name: string;
  unit: string;
  stock: number;
  freshnessMinutes: number;
  allergens: string[];
  preppable: boolean;
}

export interface ServicePromise {
  source: OrderSource;
  label: string;
  pickupMinutes: number;
}

export interface SeedOrder {
  customer: string;
  source: OrderSource;
  items: OrderItem[];
  pickupDeadlineMinutes: number;
}

export interface KitchenConfig {
  scenarioId: string;
  seed: number;
  simMinutesPerSecond: number;
  windowMinutes: number;
  setupMinutesPerPrepAction: number;
  lateGraceMinutes: number;
  warningUtilization: number;
  criticalUtilization: number;
  feedIntervalSeconds: [number, number];
  rushAtSeconds: number;
  readyLingerMinutes: number;
  stations: StationConfig[];
  menu: MenuItemConfig[];
  ingredients: IngredientConfig[];
  promises: ServicePromise[];
  initialOrders: SeedOrder[];
  rush: SeedOrder;
  stockCorrection: { ingredientId: string; delta: number };
  customers: string[];
}

export const DEFAULT_CONFIG: KitchenConfig = {
  scenarioId: "friday-dinner-rush",
  seed: 20260214,
  simMinutesPerSecond: 0.2,
  windowMinutes: 10,
  setupMinutesPerPrepAction: 0.4,
  lateGraceMinutes: 0,
  warningUtilization: 0.85,
  criticalUtilization: 1.0,
  feedIntervalSeconds: [5, 8],
  rushAtSeconds: 40,
  readyLingerMinutes: 2,
  stations: [
    { id: "prep", name: "Prep", staff: 2 },
    { id: "cook", name: "Cook", staff: 3 },
    { id: "pack", name: "Pack", staff: 2 },
  ],
  menu: [
    {
      id: "chicken_burger",
      name: "Chicken Burger",
      short: "Chx Burger",
      emoji: "🍔",
      ingredients: { chicken: 1, bun: 1, lettuce: 1, tomato: 1 },
      minutes: { prep: 1.4, cook: 2.0, pack: 0.4 },
    },
    {
      id: "beef_burger",
      name: "Beef Burger",
      short: "Beef Burger",
      emoji: "🍔",
      ingredients: { beef: 1, bun: 1, cheese: 1, onion: 1, lettuce: 1 },
      minutes: { prep: 0.9, cook: 2.2, pack: 0.4 },
    },
    {
      id: "chicken_wrap",
      name: "Chicken Wrap",
      short: "Chx Wrap",
      emoji: "🌯",
      ingredients: { chicken: 1, tortilla: 1, lettuce: 1, tomato: 1 },
      minutes: { prep: 1.5, cook: 1.5, pack: 0.4 },
    },
    {
      id: "veggie_burger",
      name: "Veggie Burger",
      short: "Veggie",
      emoji: "🥬",
      ingredients: { veggie: 1, bun: 1, lettuce: 1, tomato: 1, cheese: 1 },
      minutes: { prep: 0.8, cook: 1.6, pack: 0.4 },
    },
    {
      id: "chicken_sandwich",
      name: "Chicken Sandwich",
      short: "Chx Sandwich",
      emoji: "🥪",
      ingredients: { chicken: 1, bun: 1, lettuce: 1, cheese: 1 },
      minutes: { prep: 1.3, cook: 1.8, pack: 0.4 },
    },
  ],
  ingredients: [
    { id: "chicken", name: "Chicken", unit: "portions", stock: 13, freshnessMinutes: 240, allergens: [], preppable: true },
    { id: "beef", name: "Beef patties", unit: "patties", stock: 24, freshnessMinutes: 300, allergens: [], preppable: false },
    { id: "veggie", name: "Veggie patties", unit: "patties", stock: 12, freshnessMinutes: 480, allergens: ["soy"], preppable: false },
    { id: "lettuce", name: "Lettuce", unit: "leaves", stock: 60, freshnessMinutes: 90, allergens: [], preppable: true },
    { id: "tomato", name: "Tomato", unit: "slices", stock: 50, freshnessMinutes: 60, allergens: [], preppable: true },
    { id: "onion", name: "Onion", unit: "slices", stock: 40, freshnessMinutes: 120, allergens: [], preppable: true },
    { id: "cheese", name: "Cheese", unit: "slices", stock: 40, freshnessMinutes: 600, allergens: ["dairy"], preppable: false },
    { id: "bun", name: "Buns", unit: "buns", stock: 45, freshnessMinutes: 720, allergens: ["gluten"], preppable: false },
    { id: "tortilla", name: "Tortillas", unit: "wraps", stock: 18, freshnessMinutes: 720, allergens: ["gluten"], preppable: false },
  ],
  promises: [
    { source: "doordash", label: "Delivery app", pickupMinutes: 14 },
    { source: "walk_in", label: "Walk-in", pickupMinutes: 10 },
    { source: "phone", label: "Phone", pickupMinutes: 18 },
  ],
  initialOrders: [
    { customer: "Maya R.", source: "doordash", items: [{ menuItemId: "chicken_burger", qty: 1 }, { menuItemId: "beef_burger", qty: 1 }], pickupDeadlineMinutes: 12 },
    { customer: "Table 4", source: "walk_in", items: [{ menuItemId: "beef_burger", qty: 2 }], pickupDeadlineMinutes: 9 },
    { customer: "Jonah K.", source: "doordash", items: [{ menuItemId: "chicken_wrap", qty: 1 }, { menuItemId: "veggie_burger", qty: 1 }], pickupDeadlineMinutes: 14 },
    { customer: "Priya S.", source: "phone", items: [{ menuItemId: "chicken_sandwich", qty: 1 }, { menuItemId: "beef_burger", qty: 1 }], pickupDeadlineMinutes: 16 },
    { customer: "Leo M.", source: "doordash", items: [{ menuItemId: "veggie_burger", qty: 1 }], pickupDeadlineMinutes: 15 },
  ],
  rush: {
    customer: "Office lunch (group)",
    source: "doordash",
    items: [
      { menuItemId: "chicken_burger", qty: 4 },
      { menuItemId: "chicken_wrap", qty: 2 },
      { menuItemId: "chicken_sandwich", qty: 2 },
    ],
    pickupDeadlineMinutes: 10,
  },
  stockCorrection: { ingredientId: "chicken", delta: -4 },
  customers: [
    "Ava T.", "Noah P.", "Zoe L.", "Ethan W.", "Isla N.", "Omar H.", "Chloe B.", "Mateo G.",
    "Ruby F.", "Kai D.", "Nora V.", "Felix J.", "Hana Y.", "Theo C.", "Lena Q.", "Sam O.",
  ],
};
