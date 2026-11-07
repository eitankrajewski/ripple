"""Generates hard, photo-like menu images to evaluate the menu scanner (python3 gen.py)."""
import json, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont
random.seed(7)
F = "/usr/share/fonts/truetype/"
def font(name, size):
    import glob
    return ImageFont.truetype(glob.glob(f"/usr/share/fonts/**/{name}", recursive=True)[0], size)

def photo(im, angle=3.5, shadow=True, blur=1.2, out_w=1600, q=70, persp=True):
    im = im.convert("RGB")
    w, h = im.size
    canvas = Image.new("RGB", (int(w * 1.15), int(h * 1.15)), (92, 78, 66))
    canvas.paste(im, (int(w * 0.075), int(h * 0.075)))
    canvas = canvas.rotate(angle, resample=Image.BICUBIC, fillcolor=(92, 78, 66))
    if persp:
        W, H = canvas.size
        d = 0.04
        canvas = canvas.transform((W, H), Image.QUAD, (W * d, 0, 0, H, W, H, W * (1 - d), 0), Image.BICUBIC)
    if shadow:
        W, H = canvas.size
        g = Image.linear_gradient("L").resize((W, H)).rotate(35, expand=False)
        dark = Image.new("RGB", (W, H), (0, 0, 0))
        mask = g.point(lambda v: int(v * 0.55))
        canvas = Image.composite(dark, canvas, mask)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    r = out_w / canvas.size[0]
    canvas = canvas.resize((out_w, int(canvas.size[1] * r)), Image.LANCZOS)
    px = canvas.load()
    for _ in range(canvas.size[0] * canvas.size[1] // 25):
        x, y = random.randrange(canvas.size[0]), random.randrange(canvas.size[1])
        c = px[x, y]; n = random.randint(-18, 18)
        px[x, y] = tuple(max(0, min(255, v + n)) for v in c)
    return canvas

fixtures = {}

# A: two-column, dot leaders, descriptions, prices without $
im = Image.new("RGB", (1700, 2200), (250, 244, 230)); d = ImageDraw.Draw(im)
d.text((850, 90), "THE CORNER GRILL", font=font("LiberationSerif-Bold.ttf", 86), fill=(40, 30, 20), anchor="mt")
cols = [
    ("BURGERS", [("Classic Cheeseburger", "13", "beef patty, cheddar, lettuce, tomato"), ("Bacon BBQ Burger", "15.5", "smoked bacon, onion rings, bbq sauce"), ("Mushroom Swiss Burger", "14", "sauteed mushrooms, swiss cheese")]),
    ("SALADS & BOWLS", [("Chicken Caesar Salad", "12", "romaine, parmesan, croutons"), ("Greek Salad", "11", "tomato, cucumber, feta, olives"), ("Teriyaki Chicken Bowl", "13.75", "rice, broccoli, sesame")]),
]
for ci, (head, items) in enumerate(cols):
    x0 = 110 + ci * 800; y = 300
    d.text((x0, y), head, font=font("LiberationSans-Bold.ttf", 52), fill=(170, 60, 20)); y += 110
    for n, p, desc in items:
        fn = font("LiberationSerif-Bold.ttf", 46)
        d.text((x0, y), n, font=fn, fill=(30, 25, 20))
        nw = d.textlength(n, font=fn)
        d.text((x0 + 680, y), p, font=fn, fill=(30, 25, 20), anchor="ra")
        dots = "." * int((680 - nw - 70) / 13)
        d.text((x0 + nw + 12, y), dots, font=fn, fill=(120, 110, 100))
        d.text((x0, y + 62), desc, font=font("LiberationSerif-Italic.ttf", 34), fill=(90, 80, 70))
        y += 190
photo(im).save("two-column.jpg", quality=70)
fixtures["two-column.jpg"] = {"Classic Cheeseburger": 13, "Bacon BBQ Burger": 15.5, "Mushroom Swiss Burger": 14, "Chicken Caesar Salad": 12, "Greek Salad": 11, "Teriyaki Chicken Bowl": 13.75}

# B: all-caps names, price on the line below, dark shadow, small photo
im = Image.new("RGB", (1200, 1800), (255, 255, 255)); d = ImageDraw.Draw(im)
d.text((600, 70), "Taqueria Sol", font=font("DejaVuSerif-Bold.ttf", 70), fill="black", anchor="mt")
y = 230
for n, p, desc in [("CHICKEN TINGA TACOS", "$10.95", "Three corn tortillas, onion, cilantro"), ("CARNE ASADA BURRITO", "$12.50", "Steak, rice, beans, cheese, salsa"), ("VEGGIE QUESADILLA", "$9.25", "Peppers, onion, jack cheese"), ("CHIPS & GUACAMOLE", "$6", "Made fresh daily")]:
    d.text((90, y), n, font=font("DejaVuSans-Bold.ttf", 50), fill="black"); y += 70
    d.text((90, y), desc, font=font("DejaVuSans.ttf", 34), fill=(70, 70, 70)); y += 55
    d.text((90, y), p, font=font("DejaVuSans-Bold.ttf", 44), fill=(180, 30, 30)); y += 150
photo(im, angle=-4, blur=1.4, out_w=1100, q=60).save("caps-price-below.jpg", quality=60)
fixtures["caps-price-below.jpg"] = {"Chicken Tinga Tacos": 10.95, "Carne Asada Burrito": 12.5, "Veggie Quesadilla": 9.25, "Chips & Guacamole": 6}

# C: big phone photo, prices far right with no leaders, sans font, mild tilt
im = Image.new("RGB", (2400, 2600), (246, 246, 240)); d = ImageDraw.Draw(im)
d.text((1200, 120), "Lunch Menu", font=font("LiberationSans-Bold.ttf", 120), fill=(20, 20, 20), anchor="mt")
y = 420
for n, p in [("Grilled Chicken Sandwich", "11.00"), ("Spicy Chicken Wrap", "10.50"), ("Double Smash Burger", "14.00"), ("Black Bean Veggie Burger", "12.00"), ("Tomato Soup", "6.50"), ("Seasoned Fries", "4.25")]:
    d.text((200, y), n, font=font("LiberationSans-Regular.ttf", 84), fill=(25, 25, 25))
    d.text((2200, y), p, font=font("LiberationSans-Regular.ttf", 84), fill=(25, 25, 25), anchor="ra")
    y += 330
photo(im, angle=2, blur=2.2, out_w=3000, persp=False).save("wide-prices.jpg", quality=72)
fixtures["wide-prices.jpg"] = {"Grilled Chicken Sandwich": 11, "Spicy Chicken Wrap": 10.5, "Double Smash Burger": 14, "Black Bean Veggie Burger": 12, "Tomato Soup": 6.5, "Seasoned Fries": 4.25}

json.dump(fixtures, open("expected.json", "w"), indent=1)

# Held-out styles (not used while tuning the parser)
# D: chalkboard, light text on dark, centered, em-dash prices
im = Image.new("RGB", (1500, 1700), (38, 44, 40)); d = ImageDraw.Draw(im)
d.text((750, 80), "Today's Board", font=font("DejaVuSerif-Bold.ttf", 80), fill=(235, 235, 225), anchor="mt")
y = 260
for n, p in [("Fried Chicken Sliders", "9"), ("Philly Cheesesteak", "14"), ("Garden Salad", "8"), ("Onion Rings", "5")]:
    d.text((750, y), f"{n} — {p}", font=font("DejaVuSans.ttf", 62), fill=(240, 240, 230), anchor="mt"); y += 260
photo(im, angle=-2.5, blur=1.3, out_w=1300).save("chalkboard.jpg", quality=65)
fixtures["chalkboard.jpg"] = {"Fried Chicken Sliders": 9, "Philly Cheesesteak": 14, "Garden Salad": 8, "Onion Rings": 5}

# E: mixed-case section headers, numbered items, price right after the name
im = Image.new("RGB", (1400, 1900), (255, 252, 245)); d = ImageDraw.Draw(im)
y = 90
for head, items in [("Starters", [("1. Buffalo Wings", "$11.99"), ("2. Loaded Nachos", "$10.49")]), ("Sandwiches", [("3. Turkey Club", "$12.99"), ("4. Chicken Parm Sub", "$13.49"), ("5. Veggie Melt", "$11.49")])]:
    d.text((100, y), head, font=font("LiberationSerif-BoldItalic.ttf", 64), fill=(120, 40, 30)); y += 120
    for n, p in items:
        d.text((130, y), f"{n}  {p}", font=font("LiberationSans-Regular.ttf", 50), fill=(20, 20, 20)); y += 110
    y += 60
photo(im, angle=5, blur=1.6, out_w=1400).save("numbered.jpg", quality=60)
fixtures["numbered.jpg"] = {"Buffalo Wings": 11.99, "Loaded Nachos": 10.49, "Turkey Club": 12.99, "Chicken Parm Sub": 13.49, "Veggie Melt": 11.49}
json.dump(fixtures, open("expected.json", "w"), indent=1)
