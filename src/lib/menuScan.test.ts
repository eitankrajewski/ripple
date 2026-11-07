import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/seed";
import { parseMenuText, wordsToLines } from "./menuScan";

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

  const priced = (d: ReturnType<typeof parseMenuText>) => Object.fromEntries(d.filter((x) => x.keep).map((x) => [x.name, x.price]));

  it("pairs all-caps names with a price on a later line and keeps the description", () => {
    const text = "Taqueria Sol\nCHICKEN TINGA TACOS\nThree corn tortillas, onion, cilantro\n$10.95\nCHIPS & GUACAMOLE\nMade fresh daily\n$6\n";
    const d = parseMenuText(text, DEFAULT_CONFIG.ingredients);
    expect(priced(d)).toEqual({ "Chicken Tinga Tacos": 10.95, "Chips & Guacamole": 6 });
    const tacos = d.find((x) => x.name === "Chicken Tinga Tacos")!;
    expect(tacos.description).toBe("Three corn tortillas, onion, cilantro");
    expect(tacos.ingredients).toMatchObject({ chicken: 1, tortilla: 1, onion: 1 });
  });

  it("handles numbered items, dashes, missing $ and common OCR slips", () => {
    const text = "Starters\n1. Buffalo Wings  $11.99\nPhilly Cheesesteak — 14\nOnion Rings ..... 5\nTomato Soup S6.50\nGarden Salad 8.5\n";
    expect(priced(parseMenuText(text, DEFAULT_CONFIG.ingredients))).toEqual({ "Buffalo Wings": 11.99, "Philly Cheesesteak": 14, "Onion Rings": 5, "Tomato Soup": 6.5, "Garden Salad": 8.5 });
  });

  it("ignores headings and noise", () => {
    const text = "LUNCH MENU\nSALADS & BOWLS\nPr A As H\n— 4 —\n";
    expect(parseMenuText(text, DEFAULT_CONFIG.ingredients).filter((x) => x.keep)).toEqual([]);
  });

  it("rebuilds a two-column menu from word positions, keeping each price with its own dish", () => {
    const w = (text: string, x0: number, y0: number) => ({ text, x0, x1: x0 + text.length * 14, y0, y1: y0 + 28, conf: 95 });
    const words = [
      w("THE", 430, 20), w("CORNER", 500, 20), w("GRILL", 640, 20),
      w("Classic", 100, 100), w("Cheeseburger", 210, 100), w("..........", 390, 102), w("13", 560, 100),
      w("Chicken", 700, 104), w("Caesar", 810, 104), w("Salad", 910, 104), w("12", 1100, 104),
      w("beef", 100, 140), w("patty,", 170, 140), w("cheddar", 260, 140),
      w("romaine,", 700, 144), w("parmesan", 820, 144),
      w("Greek", 700, 200), w("Salad", 790, 200), w("11", 1100, 200),
      w("Bacon", 100, 196), w("BBQ", 190, 196), w("Burger", 250, 196), w("15.5", 540, 196),
    ];
    const lines = wordsToLines(words).map((l) => l.text.replace(/\u2003/g, " | "));
    expect(lines).toContain("Classic Cheeseburger | 13");
    expect(lines).toContain("Chicken Caesar Salad | 12");
    const d = parseMenuText(lines.join("\n").replace(/ \| /g, "   "), DEFAULT_CONFIG.ingredients);
    expect(priced(d)).toEqual({ "Classic Cheeseburger": 13, "Bacon BBQ Burger": 15.5, "Chicken Caesar Salad": 12, "Greek Salad": 11 });
    expect(d.find((x) => x.name === "Classic Cheeseburger")!.description).toBe("beef patty, cheddar");
  });
});
