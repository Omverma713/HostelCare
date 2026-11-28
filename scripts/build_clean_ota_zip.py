import os
import zipfile
import hashlib

dist_dir = os.path.abspath("frontend/dist")
out_zip = os.path.abspath("public/ota-bundles/hostelcare-bundle-v1.2.2.107.zip")

os.makedirs(os.path.dirname(out_zip), exist_ok=True)
if os.path.exists(out_zip):
    os.remove(out_zip)

with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            full_path = os.path.join(root, file)
            # Use strict POSIX forward slashes for Capacitor on Android
            rel_path = os.path.relpath(full_path, dist_dir).replace("\\", "/")
            zf.write(full_path, arcname=rel_path)

hasher = hashlib.sha256()
with open(out_zip, "rb") as f:
    while chunk := f.read(65536):
        hasher.update(chunk)

sha256 = hasher.hexdigest()
print(f"ZIP created: {out_zip}")
print(f"Size: {os.path.getsize(out_zip)} bytes")
print(f"SHA256: {sha256}")

# Print first 10 entries in zip
with zipfile.ZipFile(out_zip, "r") as zf:
    names = zf.namelist()[:10]
    print("Sample entries:")
    for name in names:
        print(" ", name)
