import pdfplumber
import re
from llama_cpp import Llama

listOfThemes = [
    "Algebra",
    "Analysis",
    "Applied",
    "Computation",
    "Number Theory",
    "Geometry",
    "Modelling",
]

llm = Llama.from_pretrained(
    repo_id="ggml-org/gemma-3-1b-it-GGUF", filename="gemma-3-1b-it-Q4_K_M.gguf", verbose=False)

def extract_course_info(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join(page.extract_text()
                         for page in pdf.pages if page.extract_text())

    # Code and Title (e.g. "MATH0015 Fluid Mechanics")
    match_title = re.search(r'([A-Z]{4}\d{4})\s+([A-Za-z].+)', text)
    code, title = match_title.groups() if match_title else (None, None)

    # Level (just the number)
    match_level = re.search(r'Level:\s*(\d+)', text)
    level = match_level.group(1) if match_level else None
    
    # Term (just the number)
    match_term = re.search(r'Term:\s*([1-4])', text)
    term = match_term.group(1) if match_term else None

    # Prerequisites
    match_pre = re.search(r'Normal Pre-?requisites:\s*(.+)', text)
    prerequisites = match_pre.group(1).strip() if match_pre else None
    # Remove any prequisites that are in parentheses, and convert to an array of codes.
    if prerequisites:
        prerequisites = re.sub(r'\s*\(.*?\)\s*', ' ', prerequisites).strip()
        prerequisites = [code.strip() for code in prerequisites.split(",")]
        # Split at spaces too.
        prerequisites = [subcode for code in prerequisites for subcode in code.split(" ")]
        # Remove any non-module codes (e.g. "recommended", "or permission of the department")
        prerequisites = [code for code in prerequisites if re.match(r'^[A-Z]{4}\d{4}$', code)]
        if not prerequisites:
            prerequisites = None

    lecturer = re.search(r'Lecturer:\s*(.+)', text)
    if lecturer:
        lecturer = lecturer.group(1).strip()

    description = re.search(
        r'Course Description(?: and Objectives)?\s*(.+?)(?:\n[A-Z][a-z]+:|\Z)', text, re.DOTALL)
    themes = []
    if description:
        description = description.group(1).strip()
        # Keep only the first 1500 characters to avoid overloading the LLM.
        description = description[:1500]
        llm_response = llm.create_chat_completion(
            messages=[{"role": "system", "content": "Summarise the following course description in one very short sentence (UK English). Give a general overview of what the course is about. Start abruptly and do not include any introductory phrases, e.g. 'An introduction to'."},
                      {"role": "user", "content": description}
                      ]
        )
        description = llm_response['choices'][0]['message']['content'].strip()
        llm_response = llm.create_chat_completion(
            messages=[{"role": "system", "content": "Select one or more themes from the following options that best fits the course description:" + ", ".join(listOfThemes) + ". Respond with only the theme names, separated by commas. Be strict; only select themes that are clearly relevant to the description."},
                      {"role": "user", "content": description}
                      ]
        )
        themes = llm_response['choices'][0]['message']['content'].strip().split(",")
        themes = [theme.strip() for theme in themes if theme.strip() in listOfThemes]
        
    data = {}
    data['code'] = code
    data['title'] = title
    data['level'] = level
    data['term'] = term
    data['description'] = description
    if themes:
        data['themes'] = themes
    if prerequisites:
        data['prereqs'] = prerequisites
    if lecturer:
        data['lead'] = lecturer

    return data

# Loop through all pdfs in the pdfs/ directory. Create one JSON object with an array of all courses.
import os

pdf_dir = "pdfs/"
all_courses = []
for filename in os.listdir(pdf_dir):
    if filename.endswith(".pdf"):
        print(f"Parsing {filename}...")
        info = extract_course_info(os.path.join(pdf_dir, filename))
        all_courses.append(info)
import json
with open("auto_generated_courses.json", "w") as f:
    # Sort all_courses by code.
    all_courses.sort(key=lambda x: x['code'])
    to_write = {"modules": all_courses}
    json.dump(to_write, f, indent=2)