import json
from pathlib import Path

# Define the pdfs directory
pdfs_dir = Path("pdfs")
manifests_by_folder = {}

# Loop through subfolders in pdfs directory
for subfolder in pdfs_dir.iterdir():
    # Skip if not a directory
    if not subfolder.is_dir():
        continue
    
    # Get all PDF files in the subfolder
    pdf_files = list(subfolder.glob("*.pdf"))
    
    # Create manifest data with module names (filenames without extension, in uppercase)
    manifest_data = {
        "modules": [pdf.stem.strip().upper() for pdf in sorted(pdf_files)]
    }
    manifests_by_folder[subfolder.name] = set(manifest_data["modules"])
    
    # Write manifest.json to the subfolder
    manifest_path = subfolder / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest_data, f, indent=2)
    
    print(f"Created manifest.json in {subfolder.name} with {len(manifest_data['modules'])} modules")
    
    # Rename all the pdfs to have uppercase filenames.
    for pdf in pdf_files:
        new_name = pdf.parent / f"{pdf.stem.upper()}.pdf"
        pdf.rename(new_name)

latest_modules = manifests_by_folder.get("latest")
if latest_modules is None:
    print("Could not compare manifests: no 'latest' folder found.")
else:
    print("\nComparison summary against 'latest':")
    for folder_name in sorted(manifests_by_folder):
        if folder_name == "latest":
            continue

        folder_modules = manifests_by_folder[folder_name]
        overlap = folder_modules & latest_modules
        missing_in_latest_for_folder = folder_modules - latest_modules
        extras_in_latest_vs_folder = latest_modules - folder_modules

        print(
            f"- {folder_name}: {len(folder_modules)} modules, "
            f"latest: {len(latest_modules)}, overlap: {len(overlap)}, "
            f"missing from latest: {len(missing_in_latest_for_folder)}, "
            f"in latest only: {len(extras_in_latest_vs_folder)}"
        )

    modules_in_other_folders = {}
    for folder_name, modules in manifests_by_folder.items():
        if folder_name == "latest":
            continue
        for module in modules:
            modules_in_other_folders.setdefault(module, set()).add(folder_name)

    missing_from_latest = {
        module: sorted(folders)
        for module, folders in modules_in_other_folders.items()
        if module not in latest_modules
    }

    if missing_from_latest:
        missing_modules = sorted(missing_from_latest)
        print(
            f"\nModules present in other folders but missing from 'latest' ({len(missing_modules)} total):"
        )
        for index, module in enumerate(missing_modules, start=1):
            folders = ", ".join(missing_from_latest[module])
            print(f"{index}. {module} (found in: {folders})")
    else:
        print("\nNo modules are missing from 'latest' compared with other folders.")

print("Done!")
