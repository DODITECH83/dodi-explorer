#!/usr/bin/env python3
"""
Generate DODI Explorer PWA icons
Run: python3 generate_icons.py
"""
import os

# SVG icon template
SVG_ICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" rx="{rx}" fill="#1a3a2a"/>
  <circle cx="{cx}" cy="{cy}" r="{r1}" stroke="#4ade80" stroke-width="{sw}" opacity="0.3" fill="none"/>
  <path d="M{cx} {top}C{lx} {top} {left} {mid} {left} {pin}c0 {spread} {cx_half} {spread2} {cx_half} {spread2}s{cx_half} -{spread3} {cx_half} -{spread2}c0-{mid2} {mr} -{top2} {mr} -{top2}z" fill="#4ade80" opacity="0.95"/>
  <circle cx="{cx}" cy="{pin}" r="{r2}" fill="#1a3a2a"/>
</svg>'''

def make_svg(size):
    cx = size // 2
    scale = size / 192
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <rect width="{size}" height="{size}" rx="{int(36*scale)}" fill="#1a3a2a"/>
  <path d="M{cx} {int(28*scale)}C{int(62*scale)} {int(28*scale)} {int(36*scale)} {int(54*scale)} {int(36*scale)} {int(84*scale)}c0 {int(52*scale)} {int(56*scale)} {int(100*scale)} {int(56*scale)} {int(100*scale)}s{int(56*scale)} -{int(48*scale)} {int(56*scale)} -{int(100*scale)}c0-{int(30*scale)} -{int(26*scale)} -{int(56*scale)} -{int(56*scale)} -{int(56*scale)}z" fill="#4ade80"/>
  <circle cx="{cx}" cy="{int(84*scale)}" r="{int(20*scale)}" fill="#1a3a2a"/>
</svg>'''

os.makedirs('icons', exist_ok=True)

for size in [72, 96, 128, 144, 152, 192, 384, 512]:
    svg = make_svg(size)
    with open(f'icons/icon-{size}.svg', 'w') as f:
        f.write(svg)
    print(f'Generated: icons/icon-{size}.svg')

# Also write the primary icons as simple SVG files that browsers can use
for size in [192, 512]:
    svg = make_svg(size)
    with open(f'icons/icon-{size}.svg', 'w') as f:
        f.write(svg)

print('\nIcons generated! For PNG conversion, use:')
print('  npx sharp-cli -i icons/icon-192.svg -o icons/icon-192.png')
print('  or use Inkscape/GIMP/any SVG-to-PNG tool')
print('\nFor quick testing, the SVG icons work in most browsers as PWA icons too.')
