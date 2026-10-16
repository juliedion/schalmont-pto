import os, sys
from PIL import Image, ImageDraw
SRC = sys.argv[1]; OUT = sys.argv[2]
D = os.path.join(SRC, 'Schalmont-Designs-Individual-PNGs')
BL = os.path.join(SRC, 'Product Image Blanks', 'Gildan_Product_Images')
for sub in ('designs', 'designs/thumbs', 'blanks', 'logos'):
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)

def fit(im, size):
    im = im.copy(); im.thumbnail((size, size), Image.LANCZOS); return im

# Designs: transparent PNGs only, trimmed to their content.
skip = {'054'}
n = 0
for folder, prefix in (('01-General-Designs', 'gd'), ('02-Simple-Sabres', 'ss')):
    for f in sorted(os.listdir(os.path.join(D, folder))):
        if not f.lower().endswith('.png') or f[:3] in skip: continue
        im = Image.open(os.path.join(D, folder, f)).convert('RGBA')
        bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox: im = im.crop(bbox)
        key = f'{prefix}-{f[:3]}'
        fit(im, 900).save(os.path.join(OUT, 'designs', key + '.webp'), 'WEBP', quality=82, method=6)
        fit(im, 240).save(os.path.join(OUT, 'designs/thumbs', key + '.webp'), 'WEBP', quality=80, method=6)
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

# Front logo previews cropped from the order form; outside white made transparent.
form = Image.open(os.path.join(SRC, 'Order Form', 'fnl-orderform.png')).convert('RGBA')
for key, box in (('shield', (54, 786, 194, 903)), ('sabres', (240, 812, 450, 884))):
    im = form.crop(box)
    w, h = im.size
    for pt in ((0,0), (w-1,0), (0,h-1), (w-1,h-1)):
        ImageDraw.floodfill(im, pt, (255,255,255,0), thresh=60)
    bbox = im.getchannel('A').getbbox()
    im.crop(bbox).save(os.path.join(OUT, 'logos', key + '.png'))
print('logos done')

# Gift card artwork shown in the shop's Gift Cards tab.
gc = Image.open(os.path.join(SRC, 'Giftcards', 'Schalmont Spiritwear Gift Card.png')).convert('RGBA')
fit(gc, 1000).save(os.path.join(OUT, 'giftcard.webp'), 'WEBP', quality=85, method=6)
print('gift card done')
