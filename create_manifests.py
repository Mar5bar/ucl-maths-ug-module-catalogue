import os
import json
from pathlib import Path

# Define the pdfs directory
pdfs_dir = Path("pdfs")

# Loop through subfolders in pdfs directory
for subfolder in pdfs_dir.iterdir():
    # Skip if not a directory
    if not subfolder.is_dir():
        continue
    
    # Get all PDF files in the subfolder
    pdf_files = list(subfolder.glob("*.pdf"))
    
    # Create manifest data with module names (filenames without extension, in uppercase)
    manifest_data = {
        "modules": [pdf.stem.upper() for pdf in sorted(pdf_files)]
    }
    
    # Write manifest.json to the subfolder
    manifest_path = subfolder / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f, indent=2)
    
    print(f"Created manifest.json in {subfolder.name} with {len(manifest_data['modules'])} modules")
    
    # Rename all the pdfs to have uppercase filenames.
    for pdf in pdf_files:
        new_name = pdf.parent / f"{pdf.stem.upper()}.pdf"
        pdf.rename(new_name)

print("Done!")
