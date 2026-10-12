#!/usr/bin/env python3
"""Imagen -> .glb con Meshy (forma 5 + textura 10 créditos; --rig +5).
Uso: python3 tools/meshy.py assets/torre.png [--rig]   |   python3 tools/meshy.py --balance
Key: MESHY_API_KEY en .env (raíz del proyecto, excluido de git) o en el entorno."""
import base64, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.meshy.ai/openapi/v1"
MODEL = "meshy-6-lite"   # no cambiar sin preguntar (créditos)
POLYCOUNT = 5000         # caras; subir para más detalle


def load_key():
    if os.environ.get("MESHY_API_KEY"):
        return os.environ["MESHY_API_KEY"]
    try:
        for line in open(os.path.join(ROOT, ".env")):
            k, _, v = line.strip().partition("=")
            if k == "MESHY_API_KEY":
                return v.strip().strip('"\'')
    except FileNotFoundError:
        pass
    sys.exit("Falta MESHY_API_KEY en .env")


KEY = load_key()
ERRORS = {401: "key inválida", 402: "sin créditos", 429: "demasiados pedidos, esperá un minuto"}


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {ERRORS.get(e.code, e.read().decode()[:300])}")


def wait(kind, task_id):
    while True:
        t = call("GET", f"/{kind}/{task_id}")
        print(kind, t["status"], t.get("progress", 0), "%", flush=True)
        if t["status"] == "SUCCEEDED": return t
        if t["status"] in ("FAILED", "CANCELED"): sys.exit(t.get("task_error"))
        time.sleep(10)


def balance():
    return call("GET", "/balance").get("balance")


if "--balance" in sys.argv:
    print(json.dumps(call("GET", "/balance"), indent=2)); sys.exit()

img = next(a for a in sys.argv[1:] if not a.startswith("--"))
mime = "image/png" if img.lower().endswith(".png") else "image/jpeg"
uri = f"data:{mime};base64," + base64.b64encode(open(img, "rb").read()).decode()
before = balance()
print("créditos antes:", before)

mesh_id = call("POST", "/image-to-3d", {"image_url": uri, "ai_model": MODEL,
    "should_texture": False, "should_remesh": True,
    "target_polycount": POLYCOUNT, "target_formats": ["glb"]})["result"]
wait("image-to-3d", mesh_id)

tex_id = call("POST", "/retexture", {"input_task_id": mesh_id, "image_style_url": uri,
    "ai_model": MODEL, "enable_original_uv": True, "target_formats": ["glb"]})["result"]
tex = wait("retexture", tex_id)

out = img.rsplit(".", 1)[0] + ".glb"
urllib.request.urlretrieve(tex["model_urls"]["glb"], out)
print("listo:", out)

if "--rig" in sys.argv:
    rig_id = call("POST", "/rigging", {"input_task_id": tex_id, "height_meters": 1.7})["result"]
    rig = wait("rigging", rig_id)["result"]
    base = img.rsplit(".", 1)[0]
    urllib.request.urlretrieve(rig["rigged_character_glb_url"], base + "_rig.glb")
    print("listo:", base + "_rig.glb")
    for k, v in (rig.get("basic_animations") or {}).items():
        if k.endswith("glb_url") and v:
            dst = f"{base}_{k.removesuffix('_glb_url')}.glb"
            urllib.request.urlretrieve(v, dst); print("listo:", dst)

after = balance()
print("créditos después:", after, f"(gastados: {before - after})")
