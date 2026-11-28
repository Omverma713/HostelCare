import os
import zipfile
import hashlib
import sys

def create_bundle(dist_dir, output_zip):
    print(f"Creating OTA bundle from {dist_dir} -> {output_zip}")
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
    print(f"Size: {size} bytes")
    print(f"SHA-256: {checksum}")
    return checksum

if __name__ == '__main__':
    dist_dir = os.path.abspath('frontend/dist')
    output_zip = os.path.abspath('public/ota-bundles/hostelcare-bundle-v1.2.2.100.zip')
    create_bundle(dist_dir, output_zip)
