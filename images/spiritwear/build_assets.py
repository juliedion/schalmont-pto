import os, sys
from PIL import Image, ImageDraw
SRC = sys.argv[1]; OUT = sys.argv[2]
D = os.path.join(SRC, 'Schalmont-Designs-Individual-PNGs')
BL = os.path.join(SRC, 'Product Image Blanks', 'Gildan_Product_Images')
for sub in ('designs', 'designs/thumbs', 'blanks', 'logos'):
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)

def fit(im, size):
    im = im.copy(); im.thumbnail((size, size), Image.LANCZOS); return im

# Designs: transparent PNGs only, trimmed to their content. Each one is saved twice --
# designs/dark/ (for dark fabrics) is the plain art with its greens brightened, and designs/light/ (for light
# fabrics) gets a thin near-black outline so the art stands out on pale shirts.
# (The dark versions used to get a white outline too; it was taken off.)
from PIL import ImageFilter
OUTLINES = {'dark': None, 'light': (17, 17, 17)}   # None = no outline
for tone in OUTLINES:
    os.makedirs(os.path.join(OUT, 'designs', tone), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'designs/thumbs', tone), exist_ok=True)

def outlined(im, color):
    w = max(6, round(max(im.size) * 0.012))           # outline thickness, ~1.2% of the art
    pad = w + 2
    canvas = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    mask = canvas.getchannel('A').point(lambda a: 255 if a > 40 else 0)
    for _ in range(w // 2):
        mask = mask.filter(ImageFilter.MaxFilter(5))
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    out = Image.new('RGBA', canvas.size, color + (0,))
    out.putalpha(mask)
    out.alpha_composite(canvas)
    return out

import numpy as np
from PIL import ImageDraw
def clear_outer_white(im, lo_min=246):
    """Make opaque near-white areas that touch the art's transparent outside transparent too."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    lo = rgb.min(axis=2)
    open_px = (alpha < 16) | ((lo >= lo_min) & (alpha >= 16))
    h, w = alpha.shape
    pad = np.full((h + 2, w + 2), 255, np.uint8); pad[1:-1, 1:-1] = np.where(open_px, 255, 0)   # 1px open border so the outside is connected
    marker = Image.fromarray(pad).copy()
    ImageDraw.floodfill(marker, (0, 0), 128, thresh=0)
    reach = (np.asarray(marker) == 128)[1:-1, 1:-1]
    gone = reach & (alpha >= 16)
    # soften the new edge: pixels next to removed white that are still light fade out
    near = np.asarray(Image.fromarray((gone * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    band = near & ~gone & (alpha >= 16)
    new_a = alpha.copy()
    new_a[gone] = 0
    new_a[band] = np.minimum(alpha[band], np.clip((255 - lo[band]) * 3.0, 0, 255))
    out = np.dstack([rgb, new_a]).astype(np.uint8)
    return Image.fromarray(out)

def brighten_greens(im, gain=1.7, lift=0.14):
    """Brighten green areas (for dark fabrics) without touching whites, silvers or blacks' hue."""
    rgba = im.convert('RGBA')
    hsv = np.asarray(rgba.convert('RGB').convert('HSV')).astype(np.float32) / 255.0
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    # how "green" each pixel is: hue between ~75° and ~175°, with real color in it
    hue_w = np.clip(1 - np.abs(h - 125) / 50, 0, 1)
    sat_w = np.clip((s - 0.15) / 0.25, 0, 1)
    wgt = hue_w * sat_w
    v2 = np.clip(v * (1 + (gain - 1) * wgt) + lift * wgt * (1 - v), 0, 1)
    s2 = np.clip(s * (1 + 0.08 * wgt), 0, 1)
    out = np.dstack([hsv[..., 0], s2, v2]) * 255
    rgb = Image.fromarray(out.astype(np.uint8), 'HSV').convert('RGB')
    rgb.putalpha(rgba.getchannel('A'))
    return rgb

def white_ink(im):
    """Flat dark-ink art -> white ink for dark shirts: darker pixels become solid white,
    light/white areas inside the art become see-through (the shirt shows through)."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    lum = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    ink = np.clip((215 - lum) / 120, 0, 1) * a[..., 3]
    out = np.dstack([np.full(lum.shape, 255, np.float32)] * 3 + [ink]).astype(np.uint8)
    return Image.fromarray(out)

# Designs with opaque white baked in around/under the art; it's made transparent first.
CLEAR_WHITE = {'gd-009', 'gd-039'}

# Designs taken out of the shop. Their numbers stay retired (sg- numbers come from list order below).
REMOVED = {'gd-039', 'sg-030'}

# Designs that get "SCHALMONT SABRES" in small letters underneath.
TAGLINE = {f'gd-{n:03d}' for n in (3, 4, 5, 8, 10, 13, 16, 17, 19, 26, 29, 30, 32, 34, 35, 36, 49)} | \
          {f'sg-{n:03d}' for n in (3, 4, 10, 11, 12, 15, 16, 17, 36)}
TAGLINE_FONT = '/Library/Fonts/BebasNeue Bold.otf'
from PIL import ImageFont

def add_tagline(im, fill=(255, 255, 255), stroke=(12, 52, 28)):
    """Small spaced-out SCHALMONT SABRES centered under the art (white letters, dark green edge)."""
    text, spacing = 'SCHALMONT SABRES', 0.12          # letter spacing, as a share of the letter height
    target_w = im.width * 0.5
    def measure(size):
        f = ImageFont.truetype(TAGLINE_FONT, size)
        widths = [f.getlength(c) for c in text]
        return f, widths, sum(widths) + spacing * size * (len(text) - 1)
    size = 40
    f, widths, w = measure(size)
    size = max(12, round(size * target_w / w))
    f, widths, w = measure(size)
    sw = max(2, round(size * 0.07))
    gap = round(im.height * 0.03)
    asc, desc = f.getmetrics()
    th = asc + 2 * sw
    out = Image.new('RGBA', (im.width, im.height + gap + th + sw), (0, 0, 0, 0))
    out.paste(im, (0, 0), im)
    d = ImageDraw.Draw(out)
    x, y = (im.width - w) / 2, im.height + gap + sw
    for c, cw in zip(text, widths):
        d.text((x, y), c, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
        x += cw + spacing * size
    bbox = out.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out

skip = {'054'}
# Designs whose light-fabric version is the plain art, no dark outline (e.g. the distressed
# flag, where an outline traces every rough edge in black).
PLAIN_ON_LIGHT = {'gd-041', 'gd-039'}
n = 0
for folder, prefix in (('01-General-Designs', 'gd'), ('02-Simple-Sabres', 'ss')):
    for f in sorted(os.listdir(os.path.join(D, folder))):
        if not f.lower().endswith('.png') or f[:3] in skip: continue
        key = f'{prefix}-{f[:3]}'
        if key in REMOVED: continue
        im = Image.open(os.path.join(D, folder, f)).convert('RGBA')
        if key in CLEAR_WHITE: im = clear_outer_white(im)
        bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox: im = im.crop(bbox)
        im = fit(im, 900)
        if key in TAGLINE: im = fit(add_tagline(im), 900)
        for tone, color in OUTLINES.items():
            o = im if color is None or (tone == 'light' and key in PLAIN_ON_LIGHT) else outlined(im, color)
            if tone == 'dark': o = brighten_greens(o)   # greens pop more on dark shirts
            fit(o, 900).save(os.path.join(OUT, 'designs', tone, key + '.webp'), 'WEBP', quality=82, method=6)
            fit(o, 240).save(os.path.join(OUT, 'designs/thumbs', tone, key + '.webp'), 'WEBP', quality=80, method=6)
        n += 1
print('designs', n)

# Blank shirts (adult photos used for the preview).
prods = {
  'tee':    ('Adult_Short_Sleeve_5000', 'Gildan_5000_Adult_{c}_{s}.png'),
  'long':   ('Adult_Long_Sleeve_5400',  'Gildan_5400_Adult_{c}_{s}.png'),
  'hoodie': ('Adult_Hoodie_18500',      'Gildan_18500_Adult_{c}_{s}.png'),
  'crew':   ('Adult_Crewneck_18000',    'Gildan_18000_Adult_{c}_{s}.png'),
  'perf':   ('Paragon_220_Performance_Shirt_Images', None),
}
colors = {'black': 'Black', 'white': 'White', 'green': 'Forest_Green'}
for pid, (folder, pat) in prods.items():
    for cid, cname in colors.items():
        for side in ('Front', 'Back'):
            if pat: fn = pat.format(c=cname, s=side)
            elif cid == 'green': fn = f'Paragon_220_Dark_Green_{side}_Recolored_Mockup.png'
            else: fn = f'Paragon_220_{cname}_{side}.png'
            im = Image.open(os.path.join(BL, folder, fn)).convert('RGBA')
            fit(im, 900).save(os.path.join(OUT, 'blanks', f'{pid}-{cid}-{side.lower()}.webp'), 'WEBP', quality=82, method=6)
print('blanks done')

# Front logos. Ink colors match "logoColors" in js/spiritwear-catalog.json.
LOGO_COLORS = {'white': (255, 255, 255), 'darkgreen': (24, 92, 50), 'black': (17, 17, 17), 'brightgreen': (40, 190, 80)}

# SABRES: cropped from the order form, outside white made transparent, printed in one ink.
# Only its black letters are kept (its white bevel and the white left inside the B and R drop out).
form = Image.open(os.path.join(SRC, 'Order Form', 'fnl-orderform.png')).convert('RGBA')
im = form.crop((240, 812, 450, 884))
w, h = im.size
for pt in ((0,0), (w-1,0), (0,h-1), (w-1,h-1)):
    ImageDraw.floodfill(im, pt, (255,255,255,0), thresh=60)
im = im.crop(im.getchannel('A').getbbox())
im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)   # smoother edges once recolored
a = np.asarray(im).astype(np.float32)
lum = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
ink = Image.fromarray((np.clip((170 - lum) / 90, 0, 1) * a[..., 3]).astype(np.uint8))
for cid, rgb in LOGO_COLORS.items():
    out = Image.new('RGBA', im.size, rgb + (0,))
    out.putalpha(ink)
    out.crop(ink.point(lambda v: 255 if v > 8 else 0).getbbox()).save(os.path.join(OUT, 'logos', f'sabres-{cid}.png'), optimize=True)

# Shield: the school's artwork, kept whole -- white S, white swords, white inner border and
# white outline around the outside always stay white; only the green is swapped.
# Bright Green is the artwork's own green. No white version (the white parts would vanish).
SHIELD_GREEN = np.array([2, 148, 71], np.float32)
SHIELD_COLORS = {'brightgreen': None, 'darkgreen': LOGO_COLORS['darkgreen'], 'black': LOGO_COLORS['black']}
im = Image.open(os.path.join(SRC, 'Current Designs', 'Front Pocket Logos', 'Dark Fabric', 'SCH_logo_shield_whiteback.png')).convert('RGBA')
im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
a = np.asarray(im).astype(np.float32)
d = 255 - SHIELD_GREEN
t = np.clip(((255 - a[..., :3]) @ d) / (d @ d), 0, 1)[..., None]   # 0 = white, 1 = full green (keeps soft edges)
for cid, rgb in SHIELD_COLORS.items():
    color = a[..., :3] if rgb is None else 255 - t * (255 - np.array(rgb, np.float32))
    out = Image.fromarray(np.dstack([color, a[..., 3]]).astype(np.uint8))
    fit(out, 400).save(os.path.join(OUT, 'logos', f'shield-{cid}.png'), optimize=True)
print('logos done')

# Gift card artwork shown in the shop's Gift Cards tab.
gc = Image.open(os.path.join(SRC, 'Giftcards', 'Schalmont Spiritwear Gift Card.png')).convert('RGBA')
fit(gc, 1000).save(os.path.join(OUT, 'giftcard.webp'), 'WEBP', quality=85, method=6)
print('gift card done')

# Colors with no Gildan photo: tint the white photos (multiply keeps the folds and shading).
# Heather gray gets a fine speckle so it reads as heathered cotton.
import random
from PIL import ImageChops
TINTS = {'brightgreen': ((34, 177, 76), False), 'heather': ((178, 178, 176), True)}
# Extra colors only the adult Paragon 220 performance hoodie comes in.
PERF_TINTS = {'mediumgray': ((128, 130, 133), False), 'olive': ((96, 104, 62), False)}
for pid in prods:
    for side in ('front', 'back'):
        white = Image.open(os.path.join(OUT, 'blanks', f'{pid}-white-{side}.webp')).convert('RGBA')
        rgb, alpha = white.convert('RGB'), white.getchannel('A')
        for cid, (tint, speckle) in {**TINTS, **(PERF_TINTS if pid == 'perf' else {})}.items():
            out = ImageChops.multiply(rgb, Image.new('RGB', rgb.size, tint))
            if speckle:
                rnd = random.Random(7)
                noise = Image.frombytes('L', rgb.size, bytes(rnd.randint(214, 255) for _ in range(rgb.size[0] * rgb.size[1])))
                out = ImageChops.multiply(out, Image.merge('RGB', (noise, noise, noise)))
            out.putalpha(alpha)
            out.save(os.path.join(OUT, 'blanks', f'{pid}-{cid}-{side}.webp'), 'WEBP', quality=82, method=6)
print('tinted colors done')

# Youth Performance Hoodie (Team 365 TT41Y). Until real TT41Y photos are added to
# Product Image Blanks/Team365_TT41Y_Youth/ as TT41Y_<Color>_<Front|Back>.png (Color =
# White, Black, Sport_Forest, Sport_Graphite, Sport_Silver), stand in with the Paragon
# performance hoodie photos, tinting the white ones for the Sport colors.
TT = os.path.join(SRC, 'Product Image Blanks', 'Team365_TT41Y_Youth')
SPORT = {'white': 'White', 'black': 'Black', 'sportforest': 'Sport_Forest', 'sportgraphite': 'Sport_Graphite', 'sportsilver': 'Sport_Silver'}
SPORT_TINT = {'sportforest': (40, 78, 56), 'sportgraphite': (82, 86, 92), 'sportsilver': (190, 193, 197)}
for cid, cname in SPORT.items():
    for side in ('front', 'back'):
        real = os.path.join(TT, f'TT41Y_{cname}_{side.title()}.png')
        if os.path.exists(real):
            im = fit(Image.open(real).convert('RGBA'), 900)
        elif cid in ('white', 'black'):
            im = Image.open(os.path.join(OUT, 'blanks', f'perf-{cid}-{side}.webp')).convert('RGBA')
        else:
            white = Image.open(os.path.join(OUT, 'blanks', f'perf-white-{side}.webp')).convert('RGBA')
            im = ImageChops.multiply(white.convert('RGB'), Image.new('RGB', white.size, SPORT_TINT[cid]))
            im.putalpha(white.getchannel('A'))
        im.save(os.path.join(OUT, 'blanks', f'perfyouth-{cid}-{side}.webp'), 'WEBP', quality=82, method=6)
print('youth performance hoodie done')

# More designs from Designs/Schalmont Generic (JPGs on white). Only the ones not already
# on the site from the PNG folders above; ids sg-001.. follow this list's order.
# The outer white is removed (white inside the art stays), then dark/light versions are made.
import numpy as np
GENERIC = os.path.join(SRC, 'Designs', 'Schalmont Generic')
GENERIC_NEW = [
    'Claim_Your_Territory', 'Green_And_White_Forever_Heart', 'Green_Blooded', 'Green_Runs_Deep_Forest',
    'Heavy_On_The_Sabre_Pride', 'Heavy_On_The_Sabre_Pride_Classic', 'Home_Of_The_Sabres_Roundel',
    'Homegrown_Sabre', 'House_Built_On_Pride', 'House_Of_Green', 'In_My_Middle_School_Era',
    'Keep_Shining_Positive', 'Our_House_Our_Rules', 'Own_This_Town', 'Power_Of_The_Paw',
    'Pride_Lives_Here', 'Roar_Together_Tiger', 'Roots_Run_Green', 'Run_With_The_Sabres',
    'Sabre_Nation_SMS', 'Schalmont_Middle_School_Smiley', 'Schalmont_Pride_Runs_In_The_Family',
    'Schalmont_Sabres_Arch', 'Schalmont_Sabres_Block', 'Schalmont_Sabres_Bow_Monogram',
    'Schalmont_Sabres_Classic', 'Schalmont_Sabres_Collegiate', 'Schalmont_Sabres_High_School',
    'Schalmont_Sabres_Modern', 'Schalmont_Sabres_Retro', 'Schalmont_Sabres_Rotterdam_NY',
    'Schalmont_Sabres_Speed', 'Schalmont_Sabres_Swords', 'Schalmont_Sabres_Varsity',
    'The_Sabre_Way', 'Unleash_The_Pride',
]

# Flat dark-ink designs with thin lettering were drawn for light shirts already; a dark
# outline would fill in the gaps between their letters, so their light version has none.
# On dark shirts they'd disappear, so their dark version is printed in white ink instead.
NO_LIGHT_OUTLINE = {
    'In_My_Middle_School_Era', 'Sabre_Nation_SMS', 'Schalmont_Middle_School_Smiley',
    'Schalmont_Sabres_Bow_Monogram', 'Schalmont_Sabres_Modern', 'Schalmont_Sabres_Rotterdam_NY',
    'Schalmont_Sabres_Swords', 'Schalmont_Sabres_Varsity', 'Heavy_On_The_Sabre_Pride_Classic',
}

def remove_white_background(im):
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w = rgb.shape[:2]
    lo = rgb.min(axis=2)
    # Background = near-white pixels connected to the image edge.
    # (.copy(): an image made straight from a numpy array silently ignores floodfill)
    marker = Image.fromarray(np.where(lo > 232, 255, 0).astype(np.uint8)).copy()
    for x in range(0, w, 4):
        for y in (0, h - 1):
            if marker.getpixel((x, y)) == 255: ImageDraw.floodfill(marker, (x, y), 128, thresh=0)
    for y in range(0, h, 4):
        for x in (0, w - 1):
            if marker.getpixel((x, y)) == 255: ImageDraw.floodfill(marker, (x, y), 128, thresh=0)
    bg = np.asarray(marker) == 128
    near = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    alpha = np.full((h, w), 255.0, np.float32)
    band = near & ~bg
    alpha[band] = np.clip((255 - lo[band]) * 2.2, 0, 255)   # soft anti-aliased edge
    alpha[bg] = 0
    a = np.maximum(alpha / 255, 1e-3)[..., None]
    color = np.clip((rgb - (1 - a) * 255) / a, 0, 255)       # undo the blend with white
    out = Image.fromarray(np.dstack([color, alpha]).astype(np.uint8))
    bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out

for n, name in enumerate(GENERIC_NEW, 1):
    key = f'sg-{n:03d}'
    if key in REMOVED: continue
    im = fit(remove_white_background(Image.open(os.path.join(GENERIC, name + '.jpg'))), 900)
    if key in TAGLINE:
        # Flat dark-ink art gets its letters in the same dark ink (it's turned to white ink on dark shirts).
        im = fit(add_tagline(im, fill=(18, 82, 48), stroke=(18, 82, 48)) if name in NO_LIGHT_OUTLINE else add_tagline(im), 900)
    for tone, color in OUTLINES.items():
        if tone == 'dark' and name in NO_LIGHT_OUTLINE:
            o = white_ink(im)
        else:
            o = im if color is None or (tone == 'light' and name in NO_LIGHT_OUTLINE) else outlined(im, color)
            if tone == 'dark': o = brighten_greens(o)
        fit(o, 900).save(os.path.join(OUT, 'designs', tone, key + '.webp'), 'WEBP', quality=82, method=6)
        fit(o, 240).save(os.path.join(OUT, 'designs/thumbs', tone, key + '.webp'), 'WEBP', quality=80, method=6)
print('generic designs', len(GENERIC_NEW))

# Color-neutral "generic" pictures for step 1 (pick your shirt), before a color is chosen.
from PIL import ImageChops
for pid in ['tee', 'long', 'hoodie', 'crew', 'perf', 'perfyouth']:
    white = Image.open(os.path.join(OUT, 'blanks', f'{pid}-white-front.webp')).convert('RGBA')
    g = ImageChops.multiply(white.convert('RGB'), Image.new('RGB', white.size, (214, 217, 220)))
    g.putalpha(white.getchannel('A'))
    g.save(os.path.join(OUT, 'blanks', f'{pid}-generic-front.webp'), 'WEBP', quality=82, method=6)
print('generic shirt pictures done')
