import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/seed";
import { parseMenuText } from "./menuScan";

describe("menu scan parsing", () => {
  it("turns priced menu lines into items with guessed ingredients", () => {
    const text = "BURGERS\nSpicy Chicken Sandwich ........ $11.50\nDouble Cheeseburger 13.00\nGarden Veggie Wrap $10\nFresh, local and made to order\nCaesar Salad $9.25\n";
    const d = parseMenuText(text, DEFAULT_CONFIG.ingredients, ["caesar_salad"]);
    const byName = Object.fromEntries(d.map((x) => [x.name, x]));
    expect(Object.keys(byName)).toEqual(["Spicy Chicken Sandwich", "Double Cheeseburger", "Garden Veggie Wrap", "Caesar Salad"]);
    expect(byName["Spicy Chicken Sandwich"].ingredients).toEqual({ chicken: 1, bun: 1 });
    expect(byName["Double Cheeseburger"].ingredients).toMatchObject({ beef: 1, cheese: 1, bun: 1 });
    expect(byName["Double Cheeseburger"].price).toBe(13);
    expect(byName["Garden Veggie Wrap"].ingredients).toEqual({ veggie: 1, tortilla: 1 });
    expect(byName["Caesar Salad"].id).toBe("caesar_salad_2");
  });
});
