import os
import zipfile
import hashlib
import sys
import json

def get_frontend_version():
    pkg_path = os.path.abspath('frontend/package.json')
    with open(pkg_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return data.get('version', '1.2.2.101')

def create_bundle(dist_dir, output_zip):
    print(f"Creating OTA bundle from {dist_dir} -> {output_zip}")
    os.makedirs(os.path.dirname(output_zip), exist_ok=True)
    with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, dist_dir)
                # CRITICAL: Always use POSIX forward slashes in ZIP entries!
                # Android Capgo throws 'Unzip failed: Windows path not supported' if backslashes are present!
                posix_entry_name = rel_path.replace('\\', '/')
                zf.write(abs_path, posix_entry_name)
                print(f"  + {posix_entry_name}")

    # Calculate SHA-256
    sha256 = hashlib.sha256()
    with open(output_zip, 'rb') as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    
    checksum = sha256.hexdigest().lower()
    size = os.path.getsize(output_zip)
    print(f"\nBundle created successfully!")
    print(f"File: {output_zip}")
    print(f"Size: {size} bytes")
    print(f"SHA-256: {checksum}")
    return checksum, size

if __name__ == '__main__':
    version = sys.argv[1] if len(sys.argv) > 1 else get_frontend_version()
    dist_dir = os.path.abspath('frontend/dist')
    version_zip = os.path.abspath(f'public/ota-bundles/hostelcare-bundle-v{version}.zip')
    checksum, size = create_bundle(dist_dir, version_zip)
    
    # Also update generic web-bundle.zip
    generic_zip = os.path.abspath('public/ota-bundles/hostelcare-web-bundle.zip')
    create_bundle(dist_dir, generic_zip)
    
    print(f"\n--- BUNDLE INFO FOR VERSION {version} ---")
    print(f"VERSION: {version}")
    print(f"SHA256: {checksum}")
    print(f"SIZE: {size}")
