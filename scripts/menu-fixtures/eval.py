"""Runs the in-browser menu scanner on the fixtures through the Vite dev server and scores it.
Usage: npm run dev, then python3 scripts/menu-fixtures/eval.py [--old]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
HERE = os.path.dirname(__file__)
EXPECTED = json.load(open(os.path.join(HERE, "expected.json")))
JS = """async ([file, old]) => {
  const m = await import('/src/lib/menuScan.ts');
  const { DEFAULT_CONFIG } = await import('/src/engine/seed.ts');
  const blob = await (await fetch('/scripts/menu-fixtures/' + file)).blob();
  const t0 = performance.now();
  if (old) { const text = await m.ocrImage(blob); return { ms: performance.now() - t0, text, drafts: m.parseMenuText(text, DEFAULT_CONFIG.ingredients, []) }; }
  const r = await m.scanMenu(blob, DEFAULT_CONFIG.ingredients, []);
  return { ms: performance.now() - t0, text: r.text, drafts: r.drafts, pass: r.pass };
}"""
async def main():
    old = "--old" in sys.argv
    async with async_playwright() as pw:
        b = await pw.chromium.connect_over_cdp("http://localhost:29229")
        ctx = await b.new_context(); p = await ctx.new_page()
        await p.goto("http://localhost:5173/"); await p.wait_for_timeout(1500)
        total = hit = extra = 0
        for f, exp in EXPECTED.items():
            r = await p.evaluate(JS, [f, old])
            kept = {d["name"].lower(): d.get("price") for d in r["drafts"] if d["keep"]}
            ok = [n for n, pr in exp.items() if kept.get(n.lower()) == pr]
            miss = [n for n in exp if n not in ok]
            ex = [n for n in kept if n not in {k.lower() for k in exp}]
            total += len(exp); hit += len(ok); extra += len(ex)
            print(f"\n== {f}: {len(ok)}/{len(exp)} correct, {len(ex)} extra, {r['ms']/1000:.1f}s {r.get('pass','')}")
            if miss: print("  missed:", miss)
            if ex: print("  extra:", ex)
            print("  got:", [(d["name"], d.get("price"), d["keep"]) for d in r["drafts"]][:14])
            if "-v" in sys.argv: print(r["text"])
        print(f"\nTOTAL {hit}/{total} correct, {extra} extra")
        await ctx.close()
asyncio.run(main())
