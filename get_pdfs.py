# Loop through a list of module codes and download the pdfs from
import os
import requests
baseURL = "https://www.ucl.ac.uk/mathematical-physical-sciences/sites/mathematical_physical_sciences/files/"

module_codes = [
    "MATH0002", "MATH0003", "MATH0004", "MATH0005", "MATH0006", "MATH0007", "MATH0008", "MATH0009",
    "MATH0010", "MATH0011", "MATH0012", "MATH0013", "MATH0014", "MATH0015", "MATH0016", "MATH0017",
    "MATH0018", "MATH0019", "MATH0020", "MATH0021", "MATH0022", "MATH0023", "MATH0024", "MATH0025",
    "MATH0026", "MATH0027", "MATH0028", "MATH0029", "MATH0030", "MATH0031", "MATH0033", "MATH0034",
    "MATH0035", "MATH0036", "MATH0037", "MATH0038", "MATH0039", "MATH0040", "MATH0041", "MATH0042",
    "MATH0043", "MATH0045", "MATH0046", "MATH0047", "MATH0048", "MATH0050", "MATH0051", "MATH0053",
    "MATH0054", "MATH0055", "MATH0056", "MATH0057", "MATH0058", "MATH0061", "MATH0065", "MATH0069",
    "MATH0070", "MATH0071", "MATH0073", "MATH0074", "MATH0075", "MATH0076", "MATH0077", "MATH0078",
    "MATH0079", "MATH0080", "MATH0082", "MATH0083", "MATH0084", "MATH0086", "MATH0088", "MATH0092",
    "MATH0101", "MATH0102", "MATH0103", "MATH0104", "MATH0107", "MATH0108", "MATH0109", "MATH0110",
    "MATH0114", "MATH0115", "MATH0117", "MATH0118", "MATH0119", "STAT0001"
]


pdf_dir = "pdfs/"
os.makedirs(pdf_dir, exist_ok=True)
for code in module_codes:
    pdf_url = f"{baseURL}{code.lower()}.pdf"
    response = requests.get(pdf_url)
    if response.status_code == 200:
        with open(os.path.join(pdf_dir, f"{code.lower()}.pdf"), "wb") as f:
            f.write(response.content)
        print(f"Downloaded {code}.pdf")
    else:
        print(f"Failed to download {code}.pdf")
