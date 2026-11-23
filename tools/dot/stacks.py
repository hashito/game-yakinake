#!/usr/bin/env python3
"""The sprite stacks of 夜勤明けの街, taken from the game-kit sprite-stack library (kit main with the yakinake-* parts of helper YK,
tools/sprite-stacks/design/fam_yk_city.py). Where the library has no fitting part, a part is designed in the kit, never a
voxelized game mesh (game-kit docs/sprite-stacks.md).

    python tools/dot/stacks.py --kit <game-kit checkout>

Writes assets/stacks/<k>.png (one strip per part: rows y, columns z x w + x) and assets/stacks/index.json { k: { w, d, n, mpp, src } }.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'assets', 'stacks')

PARTS = {
    # the plan's furniture kinds (data/plan.json furniture[].kind; js/dot/index.js FURN)
    'bench': 'env-props-bench-waiting', 'locker': 'props-locker', 'desk': 'hikage-office-desk', 'steel-desk': 'hikage-meas-desk',
    'counter': 'props-counter', 'shelf': 'hikage-supply-shelf', 'shop-shelf': 'kuromado-shop-shelf', 'bed': 'game-bed',
    'drum': 'atmos-k3-drum-rust', 'crate': 'env-props-crate-slat', 'pallet': 'env-props-pallet', 'body-cabinets': 'minase-body-cabinets',
    'vending': 'env-props-vending-machine', 'fridge': 'props-fridge', 'table': 'kuromado-dining-table', 'generator': 'game-generator',
    'server': 'arakawa-server-rack', 'sofa': 'arakawa-sofa',
    # the night streets (helper YK) and the boxes the weapons come out of
    'car-doors-open': 'yakinake-car-doors-open', 'car-stalled': 'yakinake-car-stalled', 'car-stalled-red': 'yakinake-car-stalled-red',
    'car-burnt': 'yakinake-car-burnt', 'police-car': 'yakinake-police-car', 'ambulance': 'yakinake-ambulance', 'bus-side': 'yakinake-bus-side',
    'helicopter': 'yakinake-helicopter', 'crash-cart': 'yakinake-crash-cart', 'toolbox': 'yakinake-toolbox',
    'gun-rack-full': 'yakinake-gun-rack-full', 'gun-rack-half': 'yakinake-gun-rack-half', 'gun-rack-empty': 'yakinake-gun-rack-empty',
    'rifle-case': 'yakinake-rifle-case',
    # the stations' own things and the mood props
    'safe': 'kushi-q1-safe', 'switchboard': 'kuromado-switchboard', 'radio': 'atmos-k5-radio-tube', 'breaker': 'minase-m2-breaker',
    'tape-deck': 'game-yukishiro-tapeDeck', 'barricade': 'arakawa-barricade', 'sandbags': 'atmos-k3-sandbags', 'cone': 'env-props-traffic-cone',
    'street-lamp': 'env-props-street-lamp', 'pole': 'arakawa-utility-pole', 'iv-fallen': 'atmos-k2-iv-fallen',
    # 1.5.0 (play test 2026-11-23 「道を塞ぐボードみたいなもの…車やもので塞いでください」): heaps of real things instead of the board barricade
    'junk-pile': 'atmos-k3-furniture-pile', 'tire-pile': 'atmos-k3-tire-pile', 'rope-fence': 'atmos-k4-rope-fence', 'bins': 'env-props-wheelie-bin',
    # 1.5.1 (the same item: 「車やもので塞いでください」): the wreckage walls where a street goes on (js/dot/index.js WRECKS)
    'truck': 'miru-delivery-truck', 'van': 'env-props-car-van', 'kei': 'env-props-car-kei', 'rubble': 'atmos-k3-brick-rubble',
    'crate-stack': 'tidegate-crate-stack', 'pallet-stack': 'turnback-pallet-stack',
    'wheelchair': 'atmos-k2-wheelchair-overturned', 'gurney': 'atmos-k2-gurney-slipped', 'collapsed-shelf': 'atmos-k3-collapsed-shelf',
    # 1.6.0 (play test 2 #1 「机が小さすぎる」 and D-7 / D-12): chairs at the desks and tables, the barrel fire, the street barriers
    'office-chair': 'props-office-chair', 'pipe-chair': 'props-pipe-chair', 'chair-toppled': 'atmos-k2-office-chair-toppled',
    'barrel': 'glb-barrel', 'tiger-fence': 'atmos-k4-tiger-fence', 'barrier-arm': 'miru-delivery-barrier-arm',
    # the things lying in the world (loot)
    'pistol': 'game-arakawa-pistol', 'shotgun': 'game-arakawa-shotgun', 'medkit': 'game-arakawa-medkit', 'ammo-9mm': 'game-arakawa-ammo-9mm',
    'ammo-12g': 'game-arakawa-ammo-12g',
    # 1.2.0 (play test #4: things on shelves and desks, each recognisable): the rest of the case's things lying in the world
    'water': 'glb-water-bottle', 'bandage': 'game-arakawa-bandage', 'nails': 'kushi-q5-nail-box', 'powder': 'kagamiya-g2-powder-tin',
    'disinfect': 'game-bottle', 'canned': 'ketsuban-candy-tin', 'casing': 'kagamiya-g2-film-tin', 'ammo-rifle': 'arakawa-pickup-ammo',
}


def load(kit, lib_id):
    if not hasattr(load, 'cat'):
        with open(os.path.join(kit, 'assets', 'sprite-stacks', 'catalog.json'), encoding='utf-8') as f:
            load.cat = {a['id']: a for a in json.load(f)['assets']}
    e = load.cat[lib_id]
    w, d = e['sliceSize']
    n = e['sliceCount']
    strip = Image.open(os.path.join(kit, 'assets', 'sprite-stacks', e['files']['slices']['file'])).convert('RGBA')
    a = np.asarray(strip).reshape(d, n, w, 4).transpose(2, 0, 1, 3).copy()
    a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    return a, e


def save(vol, out_id, meta, index):
    solid = vol[..., 3] > 0
    xs, ys, zs = np.where(solid)
    vol = vol[xs.min():xs.max() + 1, ys.min():ys.max() + 1, :zs.max() + 1]
    w, d, n = vol.shape[:3]
    strip = vol.transpose(1, 2, 0, 3).reshape(d, n * w, 4)
    Image.fromarray(strip.astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{out_id}.png'), optimize=True)
    index[out_id] = {'w': int(w), 'd': int(d), 'n': int(n), **meta}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kit', required=True)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for k, lib in PARTS.items():
        try:
            vol, e = load(a.kit, lib)
        except KeyError:
            print('missing in the library:', lib)
            continue
        save(vol, k, {'src': lib, 'mpp': e.get('metersPerPixel')}, index)
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(index)} stacks -> {OUT}')


if __name__ == '__main__':
    main()
