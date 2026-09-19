#!/usr/bin/env python3
"""D3.1 üretici: characters.json, lineup.svg, body-sheet.svg ve MD tablo parçaları tek veri kaynağından."""
import json, math, os, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- çerçeve
SEAT_TOP_WORLD_Y = -0.305      # sandalye grubu y -0,74 + minder üstü 0,435
HEAD_C = (0.0, 0.79, -0.01)    # baş merkezi (karakter uzayı)
HEAD_R = (0.20, 0.21, 0.19)
EYE_Y = HEAD_C[1] - 0.016      # 0,774
S = 0.215; E = (0.245, 0.40, -0.17); W = (0.220, 0.34, -0.324)

def ell(id, c, r, k, region, color=None):
    d = {"id": id, "type": "ellipsoid", "c": list(c), "r": list(r), "k": k, "region": region}
    if color: d["color"] = color
    return d
def cap(id, a, b, r0, r1, k, region, color=None):
    d = {"id": id, "type": "capsule", "a": list(a), "b": list(b), "r0": r0, "r1": r1, "k": k, "region": region}
    if color: d["color"] = color
    return d
def sph(id, c, r, k, region, color=None):
    d = {"id": id, "type": "sphere", "c": list(c), "r": r, "k": k, "region": region}
    if color: d["color"] = color
    return d
def rbox(id, c, half, corner, k, region, rot=None, color=None):
    d = {"id": id, "type": "roundedBox", "c": list(c), "half": list(half), "corner": corner, "k": k, "region": region}
    if rot: d["rot"] = list(rot)
    if color: d["color"] = color
    return d
def tor(id, c, axis, R, r, k, region, rot=None, color=None):
    d = {"id": id, "type": "torus", "c": list(c), "axis": axis, "R": R, "r": r, "k": k, "region": region}
    if rot: d["rot"] = list(rot)
    if color: d["color"] = color
    return d
def mirror(prims):
    out = []
    for p in prims:
        out.append(p)
        q = json.loads(json.dumps(p)); q["id"] = p["id"].replace(".L", ".R")
        for key in ("c", "a", "b"):
            if key in q: q[key][0] = -q[key][0]
        if "rot" in q: q["rot"] = [q["rot"][0], -q["rot"][1], -q["rot"][2]]
        out.append(q)
    return out

# ---------------------------------------------------------------- taban gövde (24 ilkel)
BASE = [
    ell("hip", (0, 0.13, 0.02), (0.21, 0.15, 0.17), 0.0, "torso"),
    ell("rump", (0, 0.16, 0.10), (0.20, 0.14, 0.12), 0.05, "torso"),
    ell("belly", (0, 0.30, 0.01), (0.20, 0.17, 0.16), 0.06, "torso"),
    ell("chest", (0, 0.44, 0.00), (0.21, 0.13, 0.15), 0.06, "torso"),
    ell("upperChest", (0, 0.50, -0.02), (0.19, 0.08, 0.13), 0.05, "torso"),
    cap("shoulders", (-0.19, 0.535, 0), (0.19, 0.535, 0), 0.075, 0.075, 0.05, "torso"),
    cap("neck", (0, 0.53, -0.01), (0, 0.64, -0.01), 0.065, 0.065, 0.03, "neck"),
    ell("head", HEAD_C, HEAD_R, 0.025, "head"),
    ell("nose", (0, 0.765, -0.205), (0.026, 0.020, 0.024), 0.010, "nose"),
] + mirror([
    sph("deltoid.L", (-S, 0.545, 0.0), 0.080, 0.040, "torso"),
    sph("cheek.L", (-0.10, 0.72, -0.13), 0.060, 0.030, "head"),
    sph("ear.L", (-0.205, 0.78, 0.00), 0.036, 0.012, "ear"),
    cap("upperArm.L", (-S, 0.545, 0.0), (-E[0], E[1], E[2]), 0.062, 0.055, 0.035, "upperArm"),
    cap("forearm.L", (-E[0], E[1], E[2]), (-W[0], W[1], W[2]), 0.055, 0.036, 0.025, "forearm"),
    cap("cuff.L", (-0.221, 0.34, -0.275), (-0.221, 0.34, -0.318), 0.040, 0.040, 0.006, "cuff"),
    cap("thigh.L", (-0.11, 0.08, -0.02), (-0.12, 0.09, -0.20), 0.070, 0.065, 0.040, "leg"),
])
BOX = {"min": [-0.34, -0.03, -0.36], "max": [0.34, 1.18, 0.25]}
BASE_BOX = {"min": [-0.31, -0.03, -0.36], "max": [0.31, 1.02, 0.23]}

# ---------------------------------------------------------------- kemikler (8)
BONES = [
    {"name": "hips", "parent": None, "head": [0, 0.10, 0.0], "tail": [0, 0.30, 0.0], "limits": {"x": [-0.05, 0.05], "y": [-0.05, 0.05], "z": [-0.03, 0.03]}, "note": "kök; boşta salınım isteğe bağlı"},
    {"name": "spine", "parent": "hips", "head": [0, 0.30, 0.0], "tail": [0, 0.545, 0.0], "limits": {"x": [-0.15, 0.15], "y": [-0.20, 0.20], "z": [-0.10, 0.10]}, "note": "öne eğilme / dönme; ilk sürümde sabit"},
    {"name": "neck", "parent": "spine", "head": [0, 0.545, -0.01], "tail": [0, 0.62, -0.01], "limits": {"x": [-0.10, 0.10], "y": [-0.26, 0.26], "z": [-0.05, 0.05]}, "headChannel": 0.40},
    {"name": "head", "parent": "neck", "head": [0, 0.62, -0.01], "tail": [0, 1.00, -0.01], "limits": {"x": [-0.15, 0.15], "y": [-0.39, 0.39], "z": [-0.08, 0.08]}, "headChannel": 0.60},
    {"name": "shoulder.L", "parent": "spine", "head": [-S, 0.545, 0.0], "tail": [-E[0], E[1], E[2]], "limits": {"x": [-0.60, 0.60], "y": [-0.30, 0.30], "z": [-0.30, 0.30]}},
    {"name": "shoulder.R", "parent": "spine", "head": [S, 0.545, 0.0], "tail": [E[0], E[1], E[2]], "limits": {"x": [-0.60, 0.60], "y": [-0.30, 0.30], "z": [-0.30, 0.30]}},
    {"name": "elbow.L", "parent": "shoulder.L", "head": [-E[0], E[1], E[2]], "tail": [-W[0], W[1], W[2]], "limits": {"x": [0.0, 1.20], "y": [-0.10, 0.10], "z": [0, 0]}, "note": "PublicArms kaldırma: rotation.x = 0,46·lift"},
    {"name": "elbow.R", "parent": "shoulder.R", "head": [E[0], E[1], E[2]], "tail": [W[0], W[1], W[2]], "limits": {"x": [0.0, 1.20], "y": [-0.10, 0.10], "z": [0, 0]}, "note": "PublicArms kaldırma: rotation.x = 0,46·lift"},
]

# ---------------------------------------------------------------- aksesuarlar
HC = HEAD_C
def hy(dy): return round(HC[1] + dy, 4)
ACC = {}
def acc(id, name, prims, color, tier="low", labelLift=0.0, mouthOffset=0.0, clip=None, subtract=None, note=None, colors=None):
    d = {"id": id, "name": name, "color": color, "tier": tier, "labelLift": labelLift, "mouthOffset": mouthOffset, "primitives": prims}
    if clip: d["clip"] = clip
    if subtract: d["subtract"] = subtract
    if colors: d["colors"] = colors
    if note: d["note"] = note
    ACC[id] = d

acc("hair-side", "Kel + yan saç", mirror([ell("hairSide.L", (-0.19, hy(0.01), 0.03), (0.05, 0.075, 0.075), 0.010, "hair")]) + [
    cap("hairBack.1", (-0.17, hy(0.0), 0.05), (-0.08, hy(0.0), 0.15), 0.035, 0.035, 0.012, "hair"),
    cap("hairBack.2", (-0.08, hy(0.0), 0.15), (0.08, hy(0.0), 0.15), 0.035, 0.035, 0.012, "hair"),
    cap("hairBack.3", (0.08, hy(0.0), 0.15), (0.17, hy(0.0), 0.05), 0.035, 0.035, 0.012, "hair"),
], "#b9b1a3", note="tepe çıplak (ten); yan tutamlar kulak arkasında (z +0,03)")

acc("hair-side-curls", "Yan bukleler (beyaz)", mirror([
    sph("curl.L1", (-0.184, hy(0.044), 0.03), 0.046, 0.020, "hair"),
    sph("curl.L2", (-0.204, hy(-0.024), 0.03), 0.046, 0.020, "hair"),
    sph("curl.L3", (-0.180, hy(-0.084), 0.03), 0.046, 0.020, "hair"),
]), "#d9d2c6", note="kulak arkasında; bere/beret ile birlikte")

acc("hair-flat", "Düz saç", [
    ell("hairCap", (0, hy(0.04), 0.00), (0.215, 0.20, 0.205), 0.010, "hair"),
] + mirror([cap("sideburn.L", (-0.195, hy(0.02), -0.02), (-0.20, hy(-0.05), -0.025), 0.018, 0.016, 0.008, "hair")]) + [
    ell("fringe.1", (-0.09, hy(0.075), -0.16), (0.05, 0.03, 0.045), 0.012, "hair"),
    ell("fringe.2", (0.0, hy(0.07), -0.17), (0.05, 0.03, 0.045), 0.012, "hair"),
    ell("fringe.3", (0.09, hy(0.075), -0.16), (0.05, 0.03, 0.045), 0.012, "hair"),
], "#3a2419", clip={"point": [0, hy(0.06), -0.19], "normal": [0, 1, 0.42], "k": 0.010},
    note="kesme düzlemi: y > 0,85 − 0,42·(z + 0,19) olan kısım kalır (önde alın açık, arkada ense örtülü)")

acc("hair-bun", "Topuz", [
    ell("bunCap", (0, hy(0.04), 0.00), (0.213, 0.20, 0.205), 0.010, "hair"),
    sph("bun", (0, hy(0.14), 0.17), 0.065, 0.015, "hair"),
    tor("bunTie", (0, hy(0.14), 0.13), "z", 0.040, 0.008, 0.004, "hair"),
] + mirror([cap("sideburn.L", (-0.195, hy(0.02), -0.02), (-0.20, hy(-0.03), -0.025), 0.016, 0.014, 0.008, "hair")]),
    "#2b2220", clip={"point": [0, hy(0.07), -0.19], "normal": [0, 1, 0.42], "k": 0.010},
    note="arkaya toplanmış, perçemsiz; topuz arkada üstte (z +0,17), bağ halkası accent")

acc("hair-curly", "Kabarık kıvırcık", [
    ell("curlyCap", (0, hy(0.07), 0.02), (0.25, 0.22, 0.24), 0.030, "hair"),
] + [sph("curly.%d" % i, (0.235 * math.cos(a), hy(0.11 + 0.06 * math.sin(a)), 0.02 + 0.225 * math.sin(a)), 0.06, 0.030, "hair")
     for i, a in enumerate([math.radians(d) for d in (20, 60, 100, 140, 180, 220, 260, 300, 340)])], "#2a1d18",
    labelLift=0.08, clip={"point": [0, hy(0.01), -0.19], "normal": [0, 1, 0.30], "k": 0.020},
    note="9 küre hâle; tepe 1,08; ön kesme y > 0,80 − 0,30·(z + 0,19)")

acc("hair-sideburns", "Favori", mirror([cap("sideburn.L", (-0.19, hy(0.02), -0.02), (-0.20, hy(-0.055), -0.025), 0.016, 0.014, 0.008, "hair")]), "#2b2220", note="fötr altında yalnız favoriler")

acc("hair-tufts", "Kep altı tutam", mirror([
    sph("tuft.L1", (-0.175, hy(0.07), 0.0), 0.030, 0.012, "hair"),
    sph("tuft.L2", (-0.196, hy(0.036), 0.0), 0.028, 0.012, "hair"),
]), "#241c19", note="kep/bere kenarı altından taşan tutamlar")

acc("beret", "Bere (fransız)", [
    ell("beretTop", (-0.012, hy(0.168), 0.0), (0.225, 0.080, 0.215), 0.015, "hat", ),
    ell("beretRim", (0.0, hy(0.125), 0.0), (0.205, 0.035, 0.20), 0.015, "hat"),
    sph("beretStalk", (-0.02, hy(0.255), 0.0), 0.014, 0.006, "hat"),
], "#a84f74", labelLift=0.06, colors={"beretRim": "#8a3f5f"}, note="rotZ −0,12 rad (sola yatık); tepe 1,045")
ACC["beret"]["primitives"][0]["rot"] = [0, 0, -0.12]

acc("beanie", "Örgü bere", [
    ell("beanieDome", (0, hy(0.10), -0.005), (0.215, 0.185, 0.205), 0.012, "hat"),
    tor("beanieBand", (0, hy(0.025), -0.005), "y", 0.205, 0.030, 0.010, "hat"),
    sph("pompom", (0, hy(0.30), -0.005), 0.040, 0.010, "hat"),
], "#d97b2f", labelLift=0.09, colors={"pompom": "#eee1c7"}, clip={"point": [0, hy(0.01), 0], "normal": [0, 1, 0], "k": 0.008},
    note="kubbe y > 0,80; bant torus; ponpon krem; tepe 1,13")

acc("cap", "Kep (siperlik)", [
    ell("capDome", (0, hy(0.05), -0.01), (0.212, 0.19, 0.20), 0.012, "hat"),
    tor("capBand", (0, hy(0.075), -0.01), "y", 0.20, 0.020, 0.008, "hat"),
    ell("visor", (0, hy(0.06), -0.30), (0.20, 0.014, 0.13), 0.010, "hat"),
    sph("capButton", (0, hy(0.235), -0.01), 0.014, 0.006, "hat"),
], "#eee1c7", labelLift=0.02, colors={"capBand": "#6ea9c6", "visor": "#8ec5df", "capButton": "#8ec5df"},
    clip={"point": [0, hy(0.07), 0], "normal": [0, 1, 0], "k": 0.008}, note="kubbe y > 0,86; siperlik rotX −0,15 (ön kenar aşağı); tepe 1,03")
ACC["cap"]["primitives"][2]["rot"] = [-0.15, 0, 0]

acc("fedora", "Fötr", [
    rbox("crown", (0, hy(0.225), -0.01), (0.17, 0.10, 0.16), 0.06, 0.015, "hat"),
    rbox("hatBand", (0, hy(0.155), -0.01), (0.176, 0.024, 0.166), 0.02, 0.006, "hat"),
    ell("brim", (0, hy(0.125), -0.01), (0.275, 0.015, 0.245), 0.010, "hat"),
], "#25355a", labelLift=0.12, colors={"hatBand": "#b49359"},
    subtract={"id": "crownDent", "type": "ellipsoid", "c": [0, hy(0.36), -0.01], "r": [0.09, 0.05, 0.14], "k": 0.02, "target": "crown"},
    note="brim rotX +0,06 (ön kenar hafif aşağı); tepe 1,115 (çukur 1,08); taç başı sarar (baş tepesi 1,00 taç içinde)")
ACC["fedora"]["primitives"][2]["rot"] = [0.06, 0, 0]

acc("glasses", "Yuvarlak gözlük", mirror([
    tor("lens.L", (-0.080, hy(-0.016), -0.183), "z", 0.056, 0.008, 0.004, "acc", rot=[0, 0.22, 0]),
    cap("temple.L", (-0.134, hy(-0.014), -0.175), (-0.205, hy(-0.008), -0.02), 0.006, 0.006, 0.004, "acc"),
]) + [cap("bridge", (-0.026, hy(-0.008), -0.19), (0.026, hy(-0.008), -0.19), 0.007, 0.007, 0.004, "acc")],
    "#b49359", note="halka torus (kapsül halkası 12 parça yedek); yüz dokusunda cam parlaması son katman")

acc("glasses-chain", "Gözlük zinciri", mirror([
    cap("chain.L1", (-0.14, hy(-0.03), -0.175), (-0.215, hy(-0.07), -0.05), 0.007, 0.007, 0.004, "acc"),
    cap("chain.L2", (-0.215, hy(-0.07), -0.05), (-0.19, hy(-0.13), 0.06), 0.007, 0.007, 0.004, "acc"),
]), "#e3be73", tier="standard", note="low kademede yok")

acc("mustache-thick", "Kalın bıyık", mirror([
    cap("must.L", (0.0, hy(-0.105), -0.190), (-0.078, hy(-0.090), -0.168), 0.020, 0.018, 0.006, "facial"),
    sph("mustEnd.L", (-0.085, hy(-0.085), -0.163), 0.022, 0.006, "facial"),
]), "#5a5049", mouthOffset=-0.020, note="ağız dokusu 20 mm aşağı kayar")

acc("mustache-thin", "İnce bıyık", mirror([
    cap("must.L", (-0.004, hy(-0.100), -0.192), (-0.062, hy(-0.090), -0.170), 0.007, 0.007, 0.004, "facial"),
]), "#2b2220", mouthOffset=-0.008)

acc("beard-full", "Dolgun sakal", [
    ell("beardChin", (0, hy(-0.17), -0.10), (0.16, 0.10, 0.12), 0.030, "facial"),
] + mirror([
    ell("beardCheek.L", (-0.13, hy(-0.10), -0.10), (0.07, 0.10, 0.09), 0.030, "facial"),
    cap("must.L", (0.0, hy(-0.105), -0.190), (-0.078, hy(-0.090), -0.168), 0.020, 0.018, 0.010, "facial"),
]), "#4a3a30", mouthOffset=-0.010,
    subtract={"id": "mouthPocket", "type": "ellipsoid", "c": [0, hy(-0.145), -0.20], "r": [0.055, 0.030, 0.05], "k": 0.012, "target": "beard-full"},
    note="sakal alanı önce kendi içinde birleşir, ağız cebi çıkarılır, sonra gövdeye eklenir; alt sınır 0,52 boynu örter")

acc("bowtie", "Papyon", mirror([ell("bow.L", (-0.045, 0.545, -0.150), (0.045, 0.028, 0.020), 0.004, "acc")]) + [
    sph("bowKnot", (0, 0.545, -0.155), 0.018, 0.004, "acc")], "#b49359")

acc("scarf", "Fular", [
    tor("scarfRing", (0, 0.575, -0.01), "y", 0.085, 0.030, 0.010, "acc"),
    cap("scarfTail", (0.04, 0.56, -0.14), (0.07, 0.42, -0.17), 0.028, 0.022, 0.010, "acc"),
], "#7a4f9e")

acc("earrings", "Küpe", mirror([sph("earring.L", (-0.207, hy(-0.055), 0.0), 0.012, 0.003, "acc")]), "#e3be73", tier="standard")

acc("collar", "Gömlek yakası", mirror([cap("collar.L", (-0.03, 0.585, -0.09), (-0.10, 0.52, -0.14), 0.014, 0.012, 0.006, "acc")]), "#eee1c7")

acc("buttons-brass", "Pirinç düğmeler", [sph("button.%d" % i, (0, y, -0.158), 0.012, 0.003, "acc") for i, y in enumerate((0.28, 0.34, 0.40))], "#b49359", tier="standard")
acc("buttons-cream", "Krem düğmeler (hırka, tek taraf)", [sph("button.%d" % i, (0.045, y, -0.158), 0.012, 0.003, "acc") for i, y in enumerate((0.24, 0.32, 0.40))], "#e4d6b8", tier="standard")

# ---------------------------------------------------------------- giysi kuralları
OUTFITS = {
    "vest": {"name": "Yelek", "torso": "outfit", "shoulders": "shirt", "upperArm": "shirt", "forearm": "shirt", "cuff": "shirt", "neckRing": None,
             "front": [{"shape": "V", "color": "shirt", "y": [0.38, 0.56], "halfWidthAt": [0.0, 0.11], "note": "|x| < 0,11·(y−0,38)/0,18, z < −0,05"}],
             "shirt": "#eee1c7", "buttons": "buttons-brass"},
    "sweater": {"name": "Kazak", "torso": "outfit", "shoulders": "outfit", "upperArm": "outfit", "forearm": "outfit", "cuff": "outfitDark", "neckRing": 0.575,
                "front": [], "shirt": None, "buttons": None},
    "jacket": {"name": "Ceket", "torso": "outfit", "shoulders": "outfit", "upperArm": "outfit", "forearm": "outfit", "cuff": "shirt", "neckRing": None,
               "front": [{"shape": "V", "color": "shirt", "y": [0.36, 0.56], "halfWidthAt": [0.0, 0.12], "note": "|x| < 0,12·(y−0,36)/0,20, z < −0,05"},
                         {"shape": "Vband", "color": "outfitDark", "y": [0.36, 0.56], "halfWidthAt": [0.0, 0.12], "band": 0.035, "note": "V kenarında 35 mm yaka bandı, −12 % L"}],
               "shirt": "#eee1c7", "buttons": None},
    "cardigan": {"name": "Hırka", "torso": "outfit", "shoulders": "outfit", "upperArm": "outfit", "forearm": "outfit", "cuff": "outfit", "neckRing": None,
                 "front": [{"shape": "strip", "color": "shirt", "y": [0.20, 0.56], "halfWidth": 0.05, "note": "|x| < 0,05, z < −0,05 (iç bluz)"},
                           {"shape": "V", "color": "shirt", "y": [0.40, 0.56], "halfWidthAt": [0.05, 0.15], "note": "|x| < 0,05 + 0,10·(y−0,40)/0,16"}],
                 "shirt": "#eee1c7", "buttons": "buttons-cream"},
    "tshirt": {"name": "Tişört", "torso": "outfit", "shoulders": "outfit", "upperArm": "outfit", "forearm": "skin", "cuff": None, "neckRing": 0.575,
               "front": [], "shirt": None, "buttons": None, "note": "cuff ilkeli çıkarılır (kısa kol); önkol ten; bilek r 0,036 ten"},
}
LEG_COLOR = "#3b3833"
SKINS = [{"id": "acik", "base": "#f1c9a3", "shadow": "#d8a074"}, {"id": "orta", "base": "#c98f62", "shadow": "#a56f46"}, {"id": "koyu", "base": "#7d4b30", "shadow": "#5c3521"}]

# ---------------------------------------------------------------- karakterler
def ch(id, name, accs, outfit, accent, belly, shoulders, face, outfitColor=None, tagline=""):
    return {"id": id, "name": name, "accessories": accs, "bodyScale": {"belly": belly, "shoulders": shoulders, "head": 1.0},
            "accent": accent, "outfit": outfit, "outfitColor": outfitColor or accent, "skins": [s["base"] for s in SKINS], "face": face, "tagline": tagline}
FACE_DEF = {"brows": {"color": "#2b2220", "weight": 1.0, "asym": 0.0}, "cheeks": {"color": "#e07c7c", "alphaScale": 1.0}, "freckles": False, "mouthStyle": "default", "defaultExpression": "smile"}
def face(**kw):
    f = json.loads(json.dumps(FACE_DEF))
    for k, v in kw.items():
        if isinstance(v, dict): f[k].update(v)
        else: f[k] = v
    return f
CHARS = [
    ch("biyikli-amca", "Bıyıklı Amca", [{"id": "hair-side"}, {"id": "mustache-thick"}, {"id": "collar"}, {"id": "buttons-brass"}], "vest", "#7a2a3a", 1.15, 1.05,
       face(brows={"color": "#8f877c", "weight": 1.4}), tagline="BORDO YELEK · KEL · KALIN BIYIK"),
    ch("gozluklu", "Gözlüklü", [{"id": "hair-flat", "color": "#3a2419"}, {"id": "glasses"}], "sweater", "#c9973a", 1.0, 1.0,
       face(brows={"color": "#3a2419"}), tagline="HARDAL KAZAK · YUVARLAK GÖZLÜK · DÜZ SAÇ"),
    ch("topuzlu", "Topuzlu", [{"id": "hair-bun", "color": "#2b2220", "colors": {"bunTie": "#2e7a5a"}}, {"id": "earrings"}, {"id": "collar"}], "jacket", "#2e7a5a", 0.95, 0.95,
       face(brows={"weight": 0.9}), tagline="ZÜMRÜT CEKET · TOPUZ · KÜPE"),
    ch("fotr", "Fötr", [{"id": "fedora", "color": "#25355a"}, {"id": "hair-sideburns"}, {"id": "mustache-thin"}, {"id": "bowtie"}, {"id": "collar"}], "jacket", "#25355a", 1.0, 1.0,
       face(brows={"asym": 0.012}), tagline="LACİVERT · FÖTR · PAPYON · İNCE BIYIK"),
    ch("sakalli", "Sakallı", [{"id": "beanie", "color": "#d97b2f"}, {"id": "beard-full", "color": "#4a3a30"}], "sweater", "#d97b2f", 1.10, 1.08,
       face(brows={"color": "#4a3a30", "weight": 1.3}), outfitColor="#4f5a3c", tagline="TURUNCU BERE · DOLGUN SAKAL · ZEYTİN KAZAK"),
    ch("kivircik", "Kıvırcık", [{"id": "hair-curly", "color": "#2a1d18"}, {"id": "scarf", "color": "#7a4f9e"}], "sweater", "#7a4f9e", 0.97, 0.97,
       face(brows={"color": "#2a1d18"}), outfitColor="#c9b9a0", tagline="MOR FULAR · KABARIK KIVIRCIK · BEJ KAZAK"),
    ch("bereli-teyze", "Bereli Teyze", [{"id": "beret"}, {"id": "hair-side-curls"}, {"id": "glasses"}, {"id": "glasses-chain"}, {"id": "buttons-cream"}], "cardigan", "#e6a0b8", 1.05, 0.95,
       face(brows={"color": "#9c948a"}), tagline="PEMBE HIRKA · BERE · GÖZLÜK ZİNCİRİ"),
    ch("kepli-cocuk", "Kepli Çocuk Kalpli", [{"id": "cap"}, {"id": "hair-tufts"}], "tshirt", "#8ec5df", 0.95, 0.90,
       face(brows={"color": "#241c19", "weight": 0.9}, cheeks={"color": "#ff9a8a", "alphaScale": 1.6}, freckles=True, mouthStyle="grin"), tagline="AÇIK MAVİ TİŞÖRT · KEP · ÇİLLER"),
]

# ---------------------------------------------------------------- yüz
FACES = {
    "canvas": {"w": 512, "h": 256},
    "window": {"x": [-0.20, 0.20], "y": [0.62, 0.94], "note": "planar Z projeksiyonu; u=(x+0,20)/0,40, v=(y−0,62)/0,32; px/mm: x 1,28 · y 0,80; baş merkezi tuvalde (256, 120)"},
    "membership": {"regions": ["head"], "normalZmax": -0.25, "note": "üçgenin 3 köşesi de üyeyse yüz grubuna (material index 1)"},
    "layers": ["skin", "cheeks", "freckles", "eyeWhites", "pupils+highlights", "blinkLid", "brows", "mouth(+teeth/tongue/lip)", "lensHighlight"],
    "features_mm": {
        "eye": {"c": [80, -16], "rx": 42, "ry": 50, "pupil": {"dy": -6, "r": 24}, "highlight": {"d": [-10, 6], "r": 9}, "highlight2": {"d": [8, -14], "r": 4}, "white": "#fbf7ee", "ink": "#252b2c"},
        "browWidth": 16, "browColorDefault": "#2b2220",
        "cheek": {"c": [128, -92], "r": 30, "rxScale": 0.9},
        "mouthWidth": 12,
        "freckles": [[-140, -80], [-116, -104], [-96, -88], [-124, -124], [140, -80], [116, -104], [96, -88], [124, -124], [-28, -60], [32, -64]],
        "freckle": {"r": 6, "color": "#3e2214", "alpha": 0.75},
        "teeth": {"rect": [-56, -122, 112, 22], "gap": [-8, -122, 10, 22], "color": "#fbf7ee"},
        "lensHighlight": {"r": 50, "color": "#ffffff", "alpha": 0.08},
    },
    "expressions": {
        "neutral": {"brow": [[44, 68], [80, 74], [116, 72]], "eyeScale": 1.0, "pupilDy": 0, "lid": 0.0, "cheekAlpha": 0.14, "cheekR": 30,
                    "mouth": {"type": "arc", "p": [[-36, -132], [0, -144], [36, -132]]}},
        "smile": {"brow": [[44, 60], [80, 80], [116, 76]], "eyeScale": 1.0, "pupilDy": 0, "lid": 0.0, "cheekAlpha": 0.34, "cheekR": 34,
                  "mouth": {"type": "arc", "p": [[-56, -120], [0, -172], [56, -120]]}},
        "surprised": {"brow": [[44, 104], [80, 122], [116, 100]], "eyeScale": 1.18, "pupilDy": 0, "pupilR": 20, "lid": 0.0, "cheekAlpha": 0.12, "cheekR": 30,
                      "mouth": {"type": "o", "c": [0, -148], "rx": 26, "ry": 32, "tongue": {"c": [0, -158], "r": 14, "color": "#b0524f"}}},
        "grumpy": {"brow": [[44, 56], [80, 70], [116, 84]], "eyeScale": 1.0, "pupilDy": -8, "lid": 0.35, "cheekAlpha": 0.20, "cheekR": 30,
                   "mouth": {"type": "arc", "p": [[-48, -152], [0, -116], [48, -152]], "lowerLip": {"c": [0, -168], "rx": 20, "ry": 10, "alpha": 0.7}}},
    },
    "grinMouth": {"type": "grin", "p": [[-68, -116], [0, -200], [68, -116]], "note": "kepli çocuk: dolu yay + dişler + diş boşluğu"},
    "blink": {"downMs": 120, "upMs": 100, "intervalS": [3, 6], "frames": ["open", "half", "closed", "half", "open"], "reducedMotion": "kapalı"},
}

# ---------------------------------------------------------------- bütçe / kamera / etiket
BUDGET = {
    "tiers": {
        "standard": {"voxel": 0.006, "triangles": 6000, "rawTrianglesEstimate": 70000, "castShadow": True, "faceCanvas": [512, 256]},
        "low": {"voxel": 0.009, "triangles": 2500, "rawTrianglesEstimate": 31000, "castShadow": False, "faceCanvas": [256, 128]},
    },
    "drawCallsPerPlayer": {"body": 1, "face": 1, "hands": "PublicArms InstancedMesh (tüm oyuncular 1)"},
    "generationMs": 120, "cacheKey": "karakter:ten (geometri karakter:kademe, renk özniteliği ten başına)",
}
CAMERA = {"eyeLocalY": round(EYE_Y, 3), "eyeWorldY": round(EYE_Y + SEAT_TOP_WORLD_Y, 3),
          "seatPrivate": {"was": 0.56, "now": 0.47}, "seatFree": {"was": 0.60, "now": 0.51}, "overviewTarget": "değişmez"}
LABEL = {"headTopLocal": 1.00, "headTopWorld": round(1.00 + SEAT_TOP_WORLD_Y, 3), "gap": 0.05, "baseWorldY": round(1.05 + SEAT_TOP_WORLD_Y, 3), "was": 0.48,
         "perCharacter": {c["id"]: round(1.05 + SEAT_TOP_WORLD_Y + max([ACC[a["id"]]["labelLift"] for a in c["accessories"]] + [0]), 3) for c in CHARS}}

DATA = {
    "version": "D3.1 · 2026-09-11", "units": "m / rad",
    "frame": {"origin": "sandalye minderi üstü, koltuk ekseni", "facing": "-Z (masa merkezi)", "seatTopWorldY": SEAT_TOP_WORLD_Y,
              "seatGroupOffset": [0, SEAT_TOP_WORLD_Y, 0], "tableSurfaceLocalY": 0.305, "note": "koltuk grubu (TableScene) masa yüksekliğinde; karakter grubu y −0,305"},
    "sittingHeight": 1.00, "head": {"c": list(HEAD_C), "r": list(HEAD_R), "eyeY": round(EYE_Y, 3)},
    "wrist": {"L": [-W[0], W[1], W[2]], "R": list(W), "publicArmsHandX": 0.18, "handScale": 1.15, "wristRadius": 0.036},
    "base": {"box": BASE_BOX, "boxWithAccessories": BOX, "voxel": {"standard": 0.006, "low": 0.009}, "iso": 0.0, "primitives": BASE},
    "bodyScaleRule": {"belly": "hip/rump/belly r.x,r.z × s; chest r.x,r.z × (1+(s−1)·0,5)", "shoulders": "shoulders uçları, deltoid, S/E/W x × t; PublicArms el x = 0,18·t", "head": "sabit 1,0"},
    "bones": BONES,
    "skin": {"nearest": 2, "sigma": 0.012, "overrides": {"head+ear+nose+cheek+hair+hat+facial+glasses": "head 1,0 (y < 0,66 bandında neck ile σ karışımı)",
             "cuff+forearm": "elbow 1,0", "acc(bowtie,scarf,collar,buttons)": "spine 1,0 (scarfTail: spine)", "leg": "hips 1,0"},
             "headChannel": {"neck": 0.40, "head": 0.60, "yawMax": 0.65, "pitchMax": 0.25}},
    "accessories": ACC, "outfits": OUTFITS, "legColor": LEG_COLOR, "skins": SKINS,
    "characters": CHARS, "faces": FACES, "budget": BUDGET, "camera": CAMERA, "label": LABEL,
}
with open(os.path.join(OUT, "characters.json"), "w") as f:
    json.dump(DATA, f, ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- MD tabloları
def fm(v):
    return ("%.3f" % v).replace(".", ",").rstrip("0").rstrip(",") if isinstance(v, float) else str(v)
def v3(v): return "(%s, %s, %s)" % tuple(fm(float(x)) for x in v)
def prim_desc(p):
    t = p["type"]
    if t == "ellipsoid": return "elipsoid m %s, r %s" % (v3(p["c"]), v3(p["r"]))
    if t == "sphere": return "küre m %s, r %s" % (v3(p["c"]), fm(p["r"]))
    if t == "capsule": return "kapsül %s → %s, r %s→%s" % (v3(p["a"]), v3(p["b"]), fm(p["r0"]), fm(p["r1"]))
    if t == "roundedBox": return "yuvarlatılmış kutu m %s, yarı %s, köşe %s" % (v3(p["c"]), v3(p["half"]), fm(p["corner"]))
    if t == "torus": return "torus m %s, eksen %s, R %s, r %s" % (v3(p["c"]), p["axis"], fm(p["R"]), fm(p["r"]))
md = []
md.append("<!-- base -->\n| # | İlkel | Parametre (m) | k | Bölge |\n| --- | --- | --- | --- | --- |")
for i, p in enumerate(BASE, 1):
    md.append("| %d | `%s` | %s | %s | %s |" % (i, p["id"], prim_desc(p), fm(p["k"]) if p["k"] else "—", p["region"]))
md.append("\n<!-- bones -->\n| Kemik | Ebeveyn | Orijin | Uç | Sınır x / y / z (rad) | Not |\n| --- | --- | --- | --- | --- | --- |")
for b in BONES:
    L = b["limits"]; lim = " / ".join("±%s" % fm(float(L[a][1])) if -L[a][0] == L[a][1] else "%s..%s" % (fm(float(L[a][0])), fm(float(L[a][1]))) for a in "xyz")
    note = b.get("note", "") + (" baş kanalı %d %%" % round(b["headChannel"] * 100) if "headChannel" in b else "")
    md.append("| `%s` | %s | %s | %s | %s | %s |" % (b["name"], b["parent"] or "— (kök)", v3(b["head"]), v3(b["tail"]), lim, note.strip()))
md.append("\n<!-- acc -->")
for a in ACC.values():
    extra = []
    if a["labelLift"]: extra.append("etiket +%s" % fm(a["labelLift"]))
    if a["mouthOffset"]: extra.append("ağız %s" % fm(a["mouthOffset"]))
    if a["tier"] == "standard": extra.append("yalnız standard")
    md.append("\n**`%s` — %s** · renk `%s`%s%s" % (a["id"], a["name"], a["color"], (" · " + " · ".join(extra)) if extra else "", (" · " + a["note"]) if a.get("note") else ""))
    md.append("\n| İlkel | Parametre (m) | k |\n| --- | --- | --- |")
    for p in a["primitives"]:
        col = (" `%s`" % a["colors"][p["id"]]) if a.get("colors") and p["id"] in a["colors"] else ""
        rot = (" rot %s" % v3(p["rot"])) if "rot" in p else ""
        md.append("| `%s`%s | %s%s | %s |" % (p["id"], col, prim_desc(p), rot, fm(p["k"])))
    if a.get("clip"): md.append("| *kesme düzlemi* | nokta %s, normal %s → dot ≥ 0 kalır | %s |" % (v3(a["clip"]["point"]), v3(a["clip"]["normal"]), fm(a["clip"]["k"])))
    if a.get("subtract"):
        s = a["subtract"]; md.append("| *çıkarma* `%s` | %s (hedef `%s`) | %s |" % (s["id"], prim_desc(s), s["target"], fm(s["k"])))
md.append("\n<!-- chars -->\n| # | id | Ad | Aksesuarlar | Giysi | Giysi rengi | Vurgu | Göbek × | Omuz × | Yüz notu |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
for i, c in enumerate(CHARS, 1):
    f = c["face"]; fn = []
    if f["brows"]["weight"] != 1: fn.append("kaş ×%s" % fm(f["brows"]["weight"]))
    if f["brows"]["asym"]: fn.append("sol kaş +%d mm" % round(f["brows"]["asym"] * 1000))
    if f["freckles"]: fn.append("çil")
    if f["mouthStyle"] != "default": fn.append("ağız `%s`" % f["mouthStyle"])
    fn.append("kaş `%s`" % f["brows"]["color"])
    md.append("| %d | `%s` | %s | %s | `%s` | `%s` | `%s` | %s | %s | %s |" % (i, c["id"], c["name"], ", ".join("`%s`" % a["id"] for a in c["accessories"]), c["outfit"], c["outfitColor"], c["accent"], fm(c["bodyScale"]["belly"]), fm(c["bodyScale"]["shoulders"]), ", ".join(fn)))
md.append("\n<!-- label -->\n| Karakter | Şapka/saç yükseltmesi | Etiket alt kenarı (dünya y) |\n| --- | --- | --- |")
for c in CHARS:
    lift = max([ACC[a["id"]]["labelLift"] for a in c["accessories"]] + [0])
    md.append("| %s | %s | **%s** |" % (c["name"], ("+" + fm(lift)) if lift else "0", fm(LABEL["perCharacter"][c["id"]])))
md.append("\n<!-- faces -->\n| İfade | Kaş (mm; başlangıç → kontrol → uç, sağ taraf aynalı) | Göz | Yanak α / r | Ağız |\n| --- | --- | --- | --- | --- |")
for k, e in FACES["expressions"].items():
    eye = "×%s" % fm(e["eyeScale"]) + (", bebek dy %d" % e["pupilDy"] if e["pupilDy"] else "") + (", kapak %d %%" % round(e["lid"] * 100) if e["lid"] else "")
    m = e["mouth"]
    mouth = ("yay %s" % " → ".join("(%d, %d)" % tuple(p) for p in m["p"])) if m["type"] == "arc" else ("dolu elips (%d, %d) rx %d ry %d + dil" % (m["c"][0], m["c"][1], m["rx"], m["ry"]))
    if m.get("lowerLip"): mouth += " + alt dudak (0, −168) 20×10"
    md.append("| `%s` | %s | %s | %s / %d | %s |" % (k, " → ".join("(%d, %d)" % tuple(p) for p in e["brow"]), eye, fm(e["cheekAlpha"]), e["cheekR"], mouth))
with open(os.path.join(OUT, "tables.md"), "w") as f:
    f.write("\n".join(md) + "\n")

# ---------------------------------------------------------------- SVG yardımcıları
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")
def darker(hexs, f=0.78):
    h = hexs.lstrip("#"); r, g, b = int(h[:2], 16), int(h[2:4], 16), int(h[4:], 16)
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))

# ---------------------------------------------------------------- lineup.svg (konsept stili, 1 birim = 2 mm, baş merkezi orijin, y aşağı)
def U(m): return m / 0.002
def ly(y_local): return -U(y_local - HEAD_C[1])
def draw_char(c, skin):
    s = skin; sh = [k for k in SKINS if k["base"] == s][0]["shadow"]
    o = OUTFITS[c["outfit"]]; oc = c["outfitColor"]; shirt = o["shirt"] or oc
    ids = [a["id"] for a in c["accessories"]]; col = {a["id"]: a.get("color", ACC[a["id"]]["color"]) for a in c["accessories"]}
    bs = c["bodyScale"]["belly"]; ss = c["bodyScale"]["shoulders"]
    p = []; cid = c["id"]
    # sandalye arkalığı
    p.append('<rect x="-150" y="30" width="300" height="265" rx="44" fill="#583b2b"/><rect x="-128" y="54" width="256" height="241" rx="30" fill="#6b4a35"/>')
    # arka saç
    if "hair-side" in ids:
        p.append('<ellipse cx="-96" cy="%.0f" rx="26" ry="38" fill="%s"/><ellipse cx="96" cy="%.0f" rx="26" ry="38" fill="%s"/>' % (ly(hy(0.01)), col["hair-side"], ly(hy(0.01)), col["hair-side"]))
    if "hair-side-curls" in ids:
        for (x, dy) in ((-0.184, 0.044), (-0.204, -0.024), (-0.180, -0.084)):
            for sx in (-1, 1): p.append('<circle cx="%.0f" cy="%.0f" r="23" fill="%s"/>' % (sx * U(-x), ly(hy(dy)), col["hair-side-curls"]))
    if "hair-bun" in ids:
        p.append('<circle cx="0" cy="%.0f" r="34" fill="%s"/><circle cx="0" cy="%.0f" r="22" fill="none" stroke="%s" stroke-width="5"/>' % (ly(hy(0.14)), col["hair-bun"], ly(hy(0.14)), c["accessories"][0].get("colors", {}).get("bunTie", "#2e7a5a")))
    if "hair-curly" in ids:
        p.append('<ellipse cx="0" cy="%.0f" rx="125" ry="112" fill="%s"/>' % (ly(hy(0.07)), col["hair-curly"]))
        for d in range(20, 360, 40):
            a = math.radians(d); p.append('<circle cx="%.0f" cy="%.0f" r="30" fill="%s"/>' % (117 * math.cos(a), ly(hy(0.11 + 0.06 * math.sin(a))), col["hair-curly"]))
    # boyun
    p.append('<rect x="-32" y="%.0f" width="64" height="70" rx="24" fill="%s"/>' % (ly(0.64), sh))
    # gövde (masa yüzeyine kadar: yerel 0,305)
    top = ly(0.60); bot = ly(0.305); hw = 125 * ss; bw = 128 * bs
    body = "M %.0f %.0f L %.0f %.0f Q %.0f %.0f %.0f %.0f L %.0f %.0f Q %.0f %.0f %.0f %.0f L %.0f %.0f Z" % (-bw, bot, -bw, top + 60, -hw, top, -hw + 55, top, hw - 55, top, hw, top, bw, top + 60, bw, bot)
    p.append('<path d="%s" fill="%s"/>' % (body, oc if o["torso"] == "outfit" else shirt))
    if c["outfit"] == "vest":
        p.append('<path d="%s" fill="%s"/>' % (body, shirt))
        vx = 125 * ss; p.append('<path d="M %.0f %.0f L %.0f %.0f L -50 %.0f L 0 %.0f L 50 %.0f L %.0f %.0f L %.0f %.0f Z" fill="%s"/>' % (-vx * 0.95, bot, -vx * 0.95, top + 40, top + 22, ly(0.38), top + 22, vx * 0.95, top + 40, vx * 0.95, bot, oc))
        p.append('<path d="M -50 %.0f L 0 %.0f L 50 %.0f L 38 %.0f L 0 %.0f L -38 %.0f Z" fill="%s"/>' % (top + 22, ly(0.38), top + 22, top + 12, ly(0.41), top + 12, shirt))
    if c["outfit"] in ("jacket", "cardigan"):
        w0 = 60 if c["outfit"] == "jacket" else 25; w1 = 30 if c["outfit"] == "jacket" else 25
        p.append('<path d="M %.0f %.0f L 0 %.0f L %.0f %.0f L %.0f %.0f L %.0f %.0f Z" fill="%s"/>' % (-w0, top + 20, ly(0.36 if c["outfit"] == "jacket" else 0.40), w0, top + 20, w1, bot if c["outfit"] == "cardigan" else ly(0.36), -w1, bot if c["outfit"] == "cardigan" else ly(0.36), shirt))
        if c["outfit"] == "jacket":
            p.append('<path d="M %.0f %.0f L 0 %.0f L -18 %.0f L -78 %.0f Z" fill="%s"/><path d="M %.0f %.0f L 0 %.0f L 18 %.0f L 78 %.0f Z" fill="%s"/>' % (-60, top + 20, ly(0.36), ly(0.36), top + 26, darker(oc), 60, top + 20, ly(0.36), ly(0.36), top + 26, darker(oc)))
    if o["neckRing"]:
        p.append('<path d="M -52 %.0f Q 0 %.0f 52 %.0f Q 0 %.0f -52 %.0f Z" fill="%s"/>' % (top + 2, top + 40, top + 2, top + 58, top + 2, darker(oc, 0.86)))
    # düğmeler
    if o["buttons"]:
        bx = 22 if o["buttons"] == "buttons-cream" else 0; bc = ACC[o["buttons"]]["color"]
        for y in (0.28, 0.34, 0.40) if bx == 0 else (0.32, 0.40): p.append('<circle cx="%d" cy="%.0f" r="6" fill="%s"/>' % (bx, ly(y), bc))
    # kollar: omuz S → dirsek E → bilek W (ön görünüm x,y)
    ac = shirt if o["upperArm"] == "shirt" else oc
    sx = U(S) * ss; ex = U(E[0]) * ss; wx = U(W[0]) * ss
    for sg in (-1, 1):
        p.append('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" stroke="%s" stroke-width="58" fill="none" stroke-linecap="round"/>' % (sg * sx, ly(0.545), sg * ex, ly(E[1]), sg * wx, ly(W[1]) - 8, ac))
        if o["forearm"] == "skin":
            p.append('<path d="M %.0f %.0f L %.0f %.0f" stroke="%s" stroke-width="44" fill="none" stroke-linecap="round"/>' % (sg * ex, ly(E[1]), sg * wx, ly(W[1]) - 8, s))
        elif o["cuff"]:
            cc = shirt if o["cuff"] == "shirt" else darker(oc, 0.86) if o["cuff"] == "outfitDark" else oc
            p.append('<circle cx="%.0f" cy="%.0f" r="24" fill="%s"/>' % (sg * wx, ly(W[1]) - 6, cc))
    # yaka, papyon, fular
    if "collar" in ids:
        p.append('<path d="M -14 %.0f L -50 %.0f L -8 %.0f Z M 14 %.0f L 50 %.0f L 8 %.0f Z" fill="#eee1c7"/>' % (ly(0.59), ly(0.52), ly(0.55), ly(0.59), ly(0.52), ly(0.55)))
    if "bowtie" in ids:
        p.append('<path d="M -46 %.0f L -6 %.0f L -6 %.0f L -46 %.0f Z M 46 %.0f L 6 %.0f L 6 %.0f L 46 %.0f Z" fill="%s"/><circle cx="0" cy="%.0f" r="9" fill="%s"/>' % (ly(0.573), ly(0.556), ly(0.534), ly(0.517), ly(0.573), ly(0.556), ly(0.534), ly(0.517), col["bowtie"], ly(0.545), darker(col["bowtie"])))
    if "scarf" in ids:
        p.append('<ellipse cx="0" cy="%.0f" rx="60" ry="24" fill="%s"/><path d="M 14 %.0f Q 40 %.0f 34 %.0f" stroke="%s" stroke-width="28" fill="none" stroke-linecap="round"/>' % (ly(0.575), col["scarf"], ly(0.56), ly(0.50), ly(0.42), col["scarf"]))
    # kulaklar
    for sg in (-1, 1):
        p.append('<circle cx="%.0f" cy="%.0f" r="18" fill="%s"/><circle cx="%.0f" cy="%.0f" r="8" fill="%s" opacity=".6"/>' % (sg * 103, ly(0.78), s, sg * 101, ly(0.775), sh))
    if "earrings" in ids:
        for sg in (-1, 1): p.append('<circle cx="%.0f" cy="%.0f" r="6" fill="%s"/>' % (sg * 104, ly(hy(-0.055)), col["earrings"]))
    # baş
    p.append('<clipPath id="%s-hc"><circle r="100"/></clipPath><circle r="100" fill="%s"/><circle cx="-14" cy="-16" r="100" fill="%s" clip-path="url(#%s-hc)"/>' % (cid, sh, s, cid))
    if "hair-side" in ids: p.append('<ellipse cx="-34" cy="-62" rx="22" ry="10" fill="#fff" opacity=".28" transform="rotate(-25 -34 -62)"/>')
    # ön saç
    if "hair-flat" in ids:
        p.append('<path d="M -100 -8 A 100 100 0 0 1 100 -8 L 100 -30 Q 60 -34 45 -46 Q 0 -30 -45 -46 Q -60 -34 -100 -30 Z" fill="%s"/>' % col["hair-flat"])
        for sg in (-1, 1): p.append('<rect x="%.0f" y="-40" width="14" height="46" rx="7" fill="%s"/>' % (sg * 97 - 7, col["hair-flat"]))
    if "hair-bun" in ids:
        p.append('<path d="M -100 -8 A 100 100 0 0 1 100 -8 L 100 -36 Q 0 -58 -100 -36 Z" fill="%s"/>' % col["hair-bun"])
    if "hair-curly" in ids:
        p.append('<path d="M -104 -4 A 104 104 0 0 1 104 -4 L 104 -40 Q 0 -70 -104 -40 Z" fill="%s"/>' % col["hair-curly"])
    if "hair-sideburns" in ids:
        for sg in (-1, 1): p.append('<rect x="%.0f" y="-40" width="16" height="50" rx="8" fill="%s"/>' % (sg * 92 - 8, col["hair-sideburns"]))
    if "hair-tufts" in ids:
        for sg in (-1, 1): p.append('<circle cx="%.0f" cy="%.0f" r="15" fill="%s"/><circle cx="%.0f" cy="%.0f" r="14" fill="%s"/>' % (sg * 87, ly(hy(0.07)), col["hair-tufts"], sg * 98, ly(hy(0.036)), col["hair-tufts"]))
    # yüz (smile varsayılan)
    f = c["face"]; e = FACES["expressions"]["smile"]; bw = 8 * f["brows"]["weight"]; bc = f["brows"]["color"]
    for sg in (-1, 1):
        asym = -U(f["brows"]["asym"]) if sg == -1 else 0
        b = e["brow"]; p.append('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" stroke="%s" stroke-width="%.1f" fill="none" stroke-linecap="round"/>' % (sg * b[0][0] / 2, -b[0][1] / 2 + asym, sg * b[1][0] / 2, -b[1][1] / 2 + asym, sg * b[2][0] / 2, -b[2][1] / 2 + asym, bc, bw))
        ex_ = sg * 40; p.append('<ellipse cx="%d" cy="8" rx="21" ry="25" fill="#fbf7ee"/><circle cx="%d" cy="11" r="12" fill="#252b2c"/><circle cx="%d" cy="5" r="4.5" fill="#fff"/><circle cx="%d" cy="15" r="2" fill="#fff"/>' % (ex_, ex_, ex_ - 5, ex_ + 4))
        p.append('<circle cx="%d" cy="46" r="17" fill="%s" opacity="%.2f"/>' % (sg * 64, f["cheeks"]["color"], min(0.5, 0.34 * f["cheeks"]["alphaScale"])))
    if f["freckles"]:
        for (x, y) in FACES["features_mm"]["freckles"]: p.append('<circle cx="%.0f" cy="%.0f" r="3" fill="#3e2214" opacity=".75"/>' % (x / 2, -y / 2))
    p.append('<ellipse cx="0" cy="40" rx="13" ry="10" fill="%s"/>' % sh)
    mo = -U(sum(ACC[i]["mouthOffset"] for i in ids))
    if f["mouthStyle"] == "grin":
        p.append('<path d="M -34 58 Q 0 100 34 58 Z" fill="#252b2c"/><path d="M -28 61 L 28 61 L 24 72 L -24 72 Z" fill="#fbf7ee"/><rect x="-4" y="61" width="9" height="11" fill="#252b2c"/>')
    else:
        p.append('<path d="M -28 %.0f Q 0 %.0f 28 %.0f" stroke="#252b2c" stroke-width="6" fill="none" stroke-linecap="round"/>' % (60 + mo, 86 + mo, 60 + mo))
    if "beard-full" in ids:
        bc_ = col["beard-full"]
        p.append('<path d="M -92 30 Q -100 110 0 128 Q 100 110 92 30 Q 70 60 40 62 L 40 52 Q 0 70 -40 52 L -40 62 Q -70 60 -92 30 Z" fill="%s"/>' % bc_)
        p.append('<ellipse cx="0" cy="%.0f" rx="27" ry="15" fill="%s"/><path d="M -22 %.0f Q 0 %.0f 22 %.0f" stroke="#252b2c" stroke-width="6" fill="none" stroke-linecap="round"/>' % (72, s, 66, 86, 66))
        p.append('<path d="M 0 54 C -12 44 -30 41 -46 48 C -56 53 -54 68 -42 70 C -28 72 -12 68 0 60 C 12 68 28 72 42 70 C 54 68 56 53 46 48 C 30 41 12 44 0 54 Z" fill="%s"/>' % bc_)
    if "mustache-thick" in ids:
        p.append('<path d="M 0 54 C -12 44 -30 41 -46 48 C -56 53 -54 68 -42 70 C -28 72 -12 68 0 60 C 12 68 28 72 42 70 C 54 68 56 53 46 48 C 30 41 12 44 0 54 Z" fill="%s"/>' % col["mustache-thick"])
    if "mustache-thin" in ids:
        p.append('<g fill="none" stroke="%s" stroke-width="3.5" stroke-linecap="round"><path d="M -3 52 Q -18 44 -38 50"/><path d="M 3 52 Q 18 44 38 50"/></g>' % col["mustache-thin"])
    if "glasses" in ids:
        p.append('<g fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"><circle cx="-40" cy="8" r="28"/><circle cx="40" cy="8" r="28"/><path d="M -12 6 Q 0 -2 12 6"/><path d="M -68 4 L -98 -2"/><path d="M 68 4 L 98 -2"/></g>' % col["glasses"])
    if "glasses-chain" in ids:
        p.append('<g fill="none" stroke="%s" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 6"><path d="M -98 -2 C -134 30 -128 96 -84 126"/><path d="M 98 -2 C 134 30 128 96 84 126"/></g>' % col["glasses-chain"])
    # şapkalar
    if "beret" in ids:
        rim = ACC["beret"]["colors"]["beretRim"]
        p.append('<g transform="rotate(-7)"><ellipse cx="-6" cy="%.0f" rx="112" ry="40" fill="%s"/><ellipse cx="-12" cy="%.0f" rx="100" ry="34" fill="%s"/><circle cx="-10" cy="%.0f" r="7" fill="%s"/></g>' % (ly(hy(0.125)), rim, ly(hy(0.168)), col["beret"], ly(hy(0.255)), rim))
    if "beanie" in ids:
        p.append('<path d="M -104 %.0f Q -104 %.0f 0 %.0f Q 104 %.0f 104 %.0f Z" fill="%s"/><rect x="-106" y="%.0f" width="212" height="30" rx="14" fill="%s"/><circle cx="0" cy="%.0f" r="20" fill="%s"/>' % (ly(hy(0.02)), ly(hy(0.29)), ly(hy(0.29)), ly(hy(0.29)), ly(hy(0.02)), col["beanie"], ly(hy(0.04)), darker(col["beanie"], 0.85), ly(hy(0.30)), ACC["beanie"]["colors"]["pompom"]))
    if "cap" in ids:
        cc = ACC["cap"]["colors"]
        p.append('<path d="M -96 %.0f Q -96 %.0f 0 %.0f Q 96 %.0f 96 %.0f Z" fill="%s"/><path d="M 0 %.0f L 0 %.0f" stroke="#e4d6b8" stroke-width="3"/><circle cx="0" cy="%.0f" r="7" fill="%s"/><ellipse cx="0" cy="%.0f" rx="100" ry="20" fill="%s"/><ellipse cx="0" cy="%.0f" rx="96" ry="13" fill="%s"/>' % (ly(hy(0.07)), ly(hy(0.24)), ly(hy(0.24)), ly(hy(0.24)), ly(hy(0.07)), col["cap"], ly(hy(0.24)), ly(hy(0.07)), ly(hy(0.235)), cc["capButton"], ly(hy(0.07)), cc["visor"], ly(hy(0.075)), cc["capBand"]))
    if "fedora" in ids:
        band = ACC["fedora"]["colors"]["hatBand"]
        p.append('<path d="M -88 %.0f L -84 %.0f Q -60 %.0f -40 %.0f Q 0 %.0f 40 %.0f Q 60 %.0f 84 %.0f L 88 %.0f Z" fill="%s"/><rect x="-88" y="%.0f" width="176" height="22" fill="%s"/><ellipse cx="0" cy="%.0f" rx="138" ry="18" fill="%s"/><ellipse cx="0" cy="%.0f" rx="130" ry="11" fill="%s"/>' % (ly(hy(0.125)), ly(hy(0.31)), ly(hy(0.335)), ly(hy(0.30)), ly(hy(0.27)), ly(hy(0.30)), ly(hy(0.335)), ly(hy(0.31)), ly(hy(0.125)), col["fedora"], ly(hy(0.18)), band, ly(hy(0.125)), col["fedora"], ly(hy(0.13)), darker(col["fedora"], 0.7)))
    # eller (D1 ×1,15 yaklaşık siluet)
    for sg in (-1, 1):
        hx = sg * wx; hy_ = ly(W[1]) + 4
        p.append('<g transform="translate(%.0f %.0f)"><ellipse cx="0" cy="16" rx="46" ry="16" fill="#000" opacity=".22"/><ellipse rx="36" ry="25" fill="%s"/><ellipse cy="-5" rx="35" ry="22" fill="%s"/>' % (hx, hy_, sh, s))
        for (fx, fy) in ((-24, 14), (-9, 20), (7, 20), (22, 14)): p.append('<circle cx="%d" cy="%d" r="11" fill="%s"/>' % (fx, fy, s))
        p.append('<circle cx="%d" cy="2" r="10" fill="%s"/></g>' % (sg * 36, s))
    return "\n".join(p)

W_, H_ = 2400, 1040
svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="\'Helvetica Neue\', Helvetica, Arial, sans-serif">' % (W_, H_, W_, H_)]
svg.append('<rect width="%d" height="%d" fill="#141d1c"/><rect width="%d" height="620" fill="#233631"/><rect x="0" y="136" width="%d" height="2" fill="#b49359" opacity=".55"/>' % (W_, H_, W_, W_))
svg.append('<text x="60" y="70" font-size="34" fill="#eee1c7" font-weight="700">D3.1 · Karakter dizilimi — 8 karakter</text>')
svg.append('<text x="60" y="104" font-size="17" fill="#88968b">Önden, oturmuş, eller masada · şartname ölçüleri (1 birim = 2 mm; baş r 0,20 m, oturmuş boy 1,00 m, masa yüzeyi baş merkezinin 0,485 m altında) · varsayılan ifade: gülümseme · ten: karakter başına 3 seçenek</text>')
svg.append('<text x="%d" y="70" font-size="15" fill="#88968b" text-anchor="end" letter-spacing="2">ŞARTNAME · 2026-09-11</text>' % (W_ - 60))
slot = 296; x0 = 60 + slot / 2; head_y = 300; sc = 0.62
table_y = head_y + ly(0.305) * sc
svg.append('<rect x="0" y="%.0f" width="%d" height="%.0f" fill="#583b2b"/>' % (head_y + ly(0.60) * sc + 10, W_, table_y - (head_y + ly(0.60) * sc + 10)))
svg.append('<rect x="0" y="%.0f" width="%d" height="%.0f" fill="#234b40"/><rect x="0" y="%.0f" width="%d" height="14" fill="#583b2b"/>' % (table_y, W_, 620 - table_y, table_y - 3, W_))
for i, c in enumerate(CHARS):
    skin = SKINS[[1, 0, 1, 1, 2, 2, 0, 2][i]]["base"]
    svg.append('<g transform="translate(%.0f %.0f) scale(%.2f)">%s</g>' % (x0 + i * slot, head_y, sc, draw_char(c, skin)))
for i, c in enumerate(CHARS):
    cx = x0 + i * slot
    svg.append('<rect x="%.0f" y="660" width="%d" height="150" rx="14" fill="#17241f" stroke="#59625a" stroke-width="2"/>' % (cx - slot / 2 + 12, slot - 24))
    svg.append('<circle cx="%.0f" cy="694" r="8" fill="%s"/><text x="%.0f" y="702" font-size="22" fill="#eee1c7" font-weight="700" text-anchor="middle">%s</text>' % (cx - slot / 2 + 36, c["accent"], cx + 8, esc(c["name"])))
    svg.append('<text x="%.0f" y="730" font-size="10.5" fill="#cfc3a9" text-anchor="middle" letter-spacing=".4">%s</text>' % (cx, esc(c["tagline"])))
    ids_ = [a["id"] for a in c["accessories"]]; l1, l2 = ", ".join(ids_[:3]), ", ".join(ids_[3:])
    svg.append('<text x="%.0f" y="756" font-size="11" fill="#88968b" text-anchor="middle">%s</text>' % (cx, esc(l1)))
    svg.append('<text x="%.0f" y="773" font-size="11" fill="#88968b" text-anchor="middle">%s</text>' % (cx, esc((l2 + " · " if l2 else "") + "giysi: " + OUTFITS[c["outfit"]]["name"].lower())))
    svg.append('<text x="%.0f" y="795" font-size="10.5" fill="#88968b" text-anchor="middle">göbek ×%s · omuz ×%s · vurgu %s</text>' % (cx, fm(c["bodyScale"]["belly"]), fm(c["bodyScale"]["shoulders"]), c["accent"]))
svg.append('<text x="60" y="850" font-size="15" fill="#cfc3a9">Ten tonları (her karakterde 3 seçenek): açık #f1c9a3 · orta #c98f62 · koyu #7d4b30 — gölge tonları #d8a074 / #a56f46 / #5c3521 (burun, kulak içi, boyun).</text>')
svg.append('<text x="60" y="874" font-size="15" fill="#cfc3a9">Parti renkleri (liberal #427e9e / faşist #a94743) hiçbir karakterde yok. Vurgu ve giysi renkleri characters.json ile birebir.</text>')
for j, s in enumerate(SKINS):
    svg.append('<rect x="%d" y="896" width="46" height="46" rx="8" fill="%s"/><rect x="%d" y="896" width="46" height="46" rx="8" fill="none" stroke="#59625a" stroke-width="2"/><text x="%d" y="962" font-size="12" fill="#88968b" text-anchor="middle">%s</text>' % (60 + j * 70, s["base"], 60 + j * 70, 83 + j * 70, s["id"]))
for j, c in enumerate(CHARS):
    svg.append('<rect x="%d" y="896" width="46" height="46" rx="8" fill="%s"/><text x="%d" y="962" font-size="11" fill="#88968b" text-anchor="middle">%s</text>' % (320 + j * 70, c["accent"], 343 + j * 70, c["accent"]))
svg.append('<text x="60" y="1010" font-size="13" fill="#88968b">Kaynak: scratchpad/gen_d3.py (characters.json ile aynı veri). 2D konsept stili; nihai görünüm SDF pişirme sonrası D3.2 karelerinde doğrulanır.</text>')
svg.append('</svg>')
with open(os.path.join(OUT, "lineup.svg"), "w") as f: f.write("\n".join(svg))

# ---------------------------------------------------------------- body-sheet.svg (1 m = 1000 px)
PX = 1000
def fx(x): return x * PX
def fy(y): return -y * PX
REG_COL = {"torso": "#5c6b57", "neck": "#c98f62", "head": "#c98f62", "nose": "#a56f46", "ear": "#a56f46", "upperArm": "#6f7d69", "forearm": "#6f7d69", "cuff": "#e4d6b8", "leg": "#3b3833"}
def prim_svg(p, view):
    col = REG_COL.get(p["region"], "#888"); op = 'fill="%s" fill-opacity=".55" stroke="#eee1c7" stroke-opacity=".7" stroke-width="1.5"' % col
    X = (lambda v: fx(v[0])) if view == "front" else (lambda v: fx(v[2]))
    RX = (lambda r: r[0] * PX) if view == "front" else (lambda r: r[2] * PX)
    t = p["type"]
    if t == "ellipsoid": return '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" %s/>' % (X(p["c"]), fy(p["c"][1]), RX(p["r"]), p["r"][1] * PX, op)
    if t == "sphere": return '<circle cx="%.1f" cy="%.1f" r="%.1f" %s/>' % (X(p["c"]), fy(p["c"][1]), p["r"] * PX, op)
    if t == "capsule":
        r = (p["r0"] + p["r1"]) / 2 * PX
        return '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-opacity=".55" stroke-width="%.1f" stroke-linecap="round"/><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#eee1c7" stroke-opacity=".5" stroke-width="1" stroke-dasharray="4 4"/>' % (X(p["a"]), fy(p["a"][1]), X(p["b"]), fy(p["b"][1]), col, r * 2, X(p["a"]), fy(p["a"][1]), X(p["b"]), fy(p["b"][1]))
    return ""
def dim_v(x, y0, y1, label, side=1):
    return ('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#e3be73" stroke-width="1.5"/>' % (fx(x), fy(y0), fx(x), fy(y1)) +
            '<path d="M %.0f %.0f l -5 9 l 10 0 z M %.0f %.0f l -5 -9 l 10 0 z" fill="#e3be73"/>' % (fx(x), fy(y1), fx(x), fy(y0)) +
            '<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#e3be73" stroke-width="1" opacity=".5"/>' % (fx(x) - 40 * side, fy(y0), fx(x) + 8 * side, fy(y0)) +
            '<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#e3be73" stroke-width="1" opacity=".5"/>' % (fx(x) - 40 * side, fy(y1), fx(x) + 8 * side, fy(y1)) +
            '<text x="%.0f" y="%.0f" font-size="15" fill="#e3be73" font-weight="700" text-anchor="%s">%s</text>' % (fx(x) + 12 * side, (fy(y0) + fy(y1)) / 2 + 5, "start" if side > 0 else "end", label))
def dim_h(y, x0, x1, label):
    return ('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#e3be73" stroke-width="1.5"/>' % (fx(x0), fy(y), fx(x1), fy(y)) +
            '<path d="M %.0f %.0f l 9 -5 l 0 10 z M %.0f %.0f l -9 -5 l 0 10 z" fill="#e3be73"/>' % (fx(x0), fy(y), fx(x1), fy(y)) +
            '<text x="%.0f" y="%.0f" font-size="15" fill="#e3be73" font-weight="700" text-anchor="middle">%s</text>' % ((fx(x0) + fx(x1)) / 2, fy(y) - 8, label))
BW, BH = 1980, 1500
b = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="\'Helvetica Neue\', Helvetica, Arial, sans-serif">' % (BW, BH, BW, BH)]
b.append('<rect width="%d" height="%d" fill="#141d1c"/>' % (BW, BH))
b.append('<text x="60" y="64" font-size="32" fill="#eee1c7" font-weight="700">D3.1 · Taban gövde şeması — 23 SDF ilkeli, 8 kemik, ölçüler (1 m = 1000 px)</text>')
b.append('<text x="60" y="96" font-size="16" fill="#88968b">Karakter uzayı: orijin sandalye minderi üstü (dünya y −0,305), +Y yukarı, karakter −Z yönüne (masa merkezi) bakar. Sol: önden (x,y) · Sağ: yandan (z,y; masa solda). Aksesuarlar bu şemada yok (characters.json → accessories).</text>')
b.append('<text x="%d" y="64" font-size="15" fill="#88968b" text-anchor="end" letter-spacing="2">ŞARTNAME · 2026-09-11</text>' % (BW - 60))
for view, ox, oy, title in (("front", 600, 1180, "ÖNDEN"), ("side", 1420, 1180, "YANDAN (−Z sol)")):
    g = ['<g transform="translate(%d %d)">' % (ox, oy)]
    # zemin/masa çizgileri
    g.append('<line x1="-440" y1="0" x2="440" y2="0" stroke="#cfc3a9" stroke-width="2" stroke-dasharray="10 8" opacity=".6"/><text x="-440" y="-8" font-size="13" fill="#cfc3a9" opacity=".8">minder üstü · y 0 (dünya −0,305)</text>')
    g.append('<line x1="-440" y1="%.0f" x2="440" y2="%.0f" stroke="#a4c9b7" stroke-width="2" opacity=".6"/><text x="-440" y="%.0f" font-size="13" fill="#a4c9b7" opacity=".9">masa yüzeyi · y 0,305 (dünya 0)</text>' % (fy(0.305), fy(0.305), fy(0.305) - 8))
    if view == "side":
        g.append('<rect x="%.0f" y="%.0f" width="120" height="%.0f" fill="#5a4030" opacity=".5"/><text x="%.0f" y="%.0f" font-size="12" fill="#cfc3a9" text-anchor="end">masa kenarı z −0,29…−0,35</text>' % (fx(-0.35) - 120, fy(0.305), 0.21 * PX, fx(-0.35) - 8, fy(0.10)))
        g.append('<rect x="%.0f" y="%.0f" width="%.0f" height="8" fill="#583b2b"/><rect x="%.0f" y="%.0f" width="70" height="%.0f" fill="#583b2b" opacity=".8"/>' % (fx(-0.23), 0, 0.46 * PX, fx(0.16), fy(0.55), 0.55 * PX))
    order = sorted(BASE, key=lambda p: {"leg": 0, "torso": 1, "upperArm": 2, "forearm": 3, "cuff": 4, "neck": 5, "head": 6, "ear": 7, "nose": 8}[p["region"]])
    if view == "side": order = [p for p in order if not p["id"].endswith(".R")]
    for p in order: g.append(prim_svg(p, view))
    # kemikler
    for bn in BONES:
        if view == "side" and bn["name"].endswith(".R"): continue
        X = (lambda v: fx(v[0])) if view == "front" else (lambda v: fx(v[2]))
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e6a95c" stroke-width="3"/><circle cx="%.1f" cy="%.1f" r="6" fill="#141d1c" stroke="#e6a95c" stroke-width="3"/>' % (X(bn["head"]), fy(bn["head"][1]), X(bn["tail"]), fy(bn["tail"][1]), X(bn["head"]), fy(bn["head"][1])))
        if view == "front" and not bn["name"].endswith(".L"):
            g.append('<text x="%.1f" y="%.1f" font-size="13" fill="#e6a95c" text-anchor="start">%s</text>' % (X(bn["head"]) + (12 if bn["name"].endswith(".R") else 14), fy(bn["head"][1]) + 4, bn["name"].replace(".R", ".L/R")))
    # ölçüler
    if view == "front":
        g.append(dim_v(-0.40, 0.0, 1.00, "oturmuş boy 1,00", -1))
        g.append(dim_v(-0.33, 0.58, 1.00, "baş 0,42", -1))
        g.append(dim_v(0.36, 0.305, 1.00, "baş tepesi masa +0,695", 1))
        g.append(dim_h(1.06, -0.20, 0.20, "baş ø 0,40 (y 0,42 · z 0,38)"))
        g.append(dim_h(0.63, -0.265, 0.265, "omuz 0,53"))
        g.append(dim_h(-0.06, -0.21, 0.21, "kalça 0,42"))
        g.append(dim_h(0.26, -0.305, 0.305, "dirsekler dahil 0,61"))
        g.append('<circle cx="%.1f" cy="%.1f" r="5" fill="#8fd3a5"/><circle cx="%.1f" cy="%.1f" r="5" fill="#8fd3a5"/><text x="%.1f" y="%.1f" font-size="13" fill="#8fd3a5">göz y %s (dünya %s)</text>' % (fx(-0.08), fy(EYE_Y), fx(0.08), fy(EYE_Y), fx(0.11), fy(EYE_Y) + 4, fm(round(EYE_Y, 3)), fm(round(EYE_Y + SEAT_TOP_WORLD_Y, 3))))
        g.append('<circle cx="%.1f" cy="%.1f" r="5" fill="#8fd3a5"/><text x="%.1f" y="%.1f" font-size="13" fill="#8fd3a5">bilek W (±0,220, 0,340, −0,324) → D1 el</text>' % (fx(W[0]), fy(W[1]), fx(W[0]) + 10, fy(W[1]) + 48))
        g.append('<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#e3be73" stroke-width="1.5" stroke-dasharray="6 4"/><text x="%.0f" y="%.0f" font-size="13" fill="#e3be73">etiket alt kenarı 1,05 (dünya 0,745) + şapka</text>' % (fx(-0.30), fy(1.05), fx(0.30), fy(1.05), fx(-0.30), fy(1.05) - 8))
    else:
        g.append(dim_v(0.30, 0.0, 0.545, "omuz 0,545", 1))
        g.append(dim_v(0.30, 0.545, 0.62, "boyun", 1))
        g.append(dim_v(0.30, 0.62, 1.00, "baş kemiği", 1))
        g.append(dim_h(1.06, -0.20, 0.18, "baş z 0,38"))
        g.append(dim_h(0.35, -0.324, 0.0, "bilek z −0,324"))
        g.append(dim_h(-0.06, -0.15, 0.22, "kalça z 0,37"))
        g.append('<text x="%.0f" y="%.0f" font-size="13" fill="#8fd3a5">yüz penceresi y 0,62–0,94 · normal.z &lt; −0,25</text><line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#8fd3a5" stroke-width="2"/>' % (fx(-0.33), fy(0.60) + 30, fx(-0.215), fy(0.62), fx(-0.215), fy(0.94)))
    g.append('<text x="0" y="%.0f" font-size="18" fill="#eee1c7" font-weight="700" text-anchor="middle" letter-spacing="2">%s</text>' % (fy(-0.06) + 36, title))
    g.append('</g>'); b.extend(g)
# lejant
lg = 1390
b.append('<g transform="translate(60 %d)">' % lg)
items = [("torso", "gövde (hip, rump, belly, chest, upperChest, shoulders, deltoid)"), ("upperArm", "kollar (upperArm, forearm)"), ("cuff", "manşet"), ("neck", "boyun / baş / yanak"), ("nose", "burun / kulak (gölge ten)"), ("leg", "uyluk (masa altı)")]
for i, (k, lab) in enumerate(items):
    cx_, cy_ = (i % 3) * 620, (i // 3) * 26
    b.append('<rect x="%d" y="%d" width="18" height="18" rx="4" fill="%s" fill-opacity=".7" stroke="#eee1c7" stroke-opacity=".6"/><text x="%d" y="%d" font-size="13" fill="#cfc3a9">%s</text>' % (cx_, cy_, REG_COL[k], cx_ + 26, cy_ + 14, lab))
b.append('<line x1="0" y1="66" x2="30" y2="66" stroke="#e6a95c" stroke-width="3"/><circle cx="0" cy="66" r="5" fill="#141d1c" stroke="#e6a95c" stroke-width="3"/><text x="40" y="71" font-size="13" fill="#cfc3a9">kemik (orijin → uç) · skin: en yakın 2 kemik, σ 12 mm · baş kanalı: neck 40 % · head 60 % (yaw ±0,65 · pitch ±0,25)</text>')
b.append('<text x="0" y="97" font-size="13" fill="#cfc3a9">kapsüller ortalama yarıçapla çizildi; k değerleri ve tam liste: D3-characters.md §b, characters.json → base.primitives</text>')
b.append('</g></svg>')
with open(os.path.join(OUT, "body-sheet.svg"), "w") as f: f.write("\n".join(b))
print("ok", len(BASE), "base prims;", len(ACC), "accessories;", len(CHARS), "chars")
print("label:", LABEL["perCharacter"]); print("camera:", CAMERA)
