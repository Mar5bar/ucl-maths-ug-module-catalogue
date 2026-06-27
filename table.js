let moduleData = {};

let levels = new Set();
let levelsList = [];
let prereqsMap = {};
let requiredForMap = {};
let modulesAtLevel = {};

let activeModule = null;
let lines = [];

const defaultSyllabusBaseURL = "./pdfs";
const defaultDetailPreferences = {
  description: "on",
  syllabus: "on",
  prereqs: "on",
  reqfors: "off",
};

const urlParams = new URLSearchParams(window.location.search);
let activeYearOfEntry = urlParams.get("year") || "latest";

// If there is only 1 year button, hide anything with the year-select class.
const yearButtons = document.getElementsByClassName("year-button");
if (yearButtons.length <= 1) {
  const yearSelectElements = document.getElementsByClassName("year-select");
  for (const elem of yearSelectElements) {
    elem.style.display = "none";
  }
}

// Load the specified (or most recent) module data.
loadYear(activeYearOfEntry);

function loadYear(year, updating = false) {
  activeYearOfEntry = year;
  // Update the URL parameter.
  setQueryParameter("year", year);
  // Update the year buttons.
  const yearButtons = document.getElementsByClassName("year-button");
  for (const yb of yearButtons) {
    if (yb.dataset.year === year) {
      yb.setAttribute("data-state", "on");
    } else {
      yb.setAttribute("data-state", "off");
    }
  }
  const dataURL = `./module_data/${year}.json`;
  // Clear existing module data.
  moduleData = {};
  // Fetch module_data.
  fetch(dataURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Module data unavailable for year: ${year}`);
      }
      return response.json();
    })
    .then((data) => {
      for (const module of data.modules) {
        // Skip modules not listed as being in the catalogue.
        if (!module.in_catalogue) {
          continue;
        }
        moduleData[module.code] = module;
      }
      processModuleData(moduleData);
    })
    .catch((error) => {
      if (year !== "latest") {
        console.warn(
          `Module data for year '${year}' is unavailable; falling back to latest.`,
          error,
        );
        loadYear("latest", updating);
        return;
      }
      console.error("Error fetching module data:", error);
    });
}

function processModuleData(moduleData) {
  // Loop through the modules and populate lists of metadata.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    const level = module.level;
    // Record levels.
    levels.add(level);
    // Record this module in the corresponding level.
    if (!modulesAtLevel[level]) {
      modulesAtLevel[level] = [];
    }
    modulesAtLevel[level].push(moduleCode);
    if (module.prereqs) {
      prereqsMap[moduleCode] = module.prereqs;
      // Populate a reverse mapping of prerequisites.
      for (const prereq of module.prereqs) {
        if (!requiredForMap[prereq]) {
          requiredForMap[prereq] = [];
        }
        requiredForMap[prereq].push(moduleCode);
      }
    }
  }

  // Convert levels to sorted arrays.
  levelsList = Array.from(levels).sort();

  // Build the grid of modules. Each level gets its own section.
  const moduleGrid = document.getElementById("module-grid");
  // Clear existing content.
  moduleGrid.innerHTML = "";
  for (const level of levelsList) {
    const levelSection = document.createElement("div");
    levelSection.className = "level-section";
    levelSection.innerHTML = `<h3>Level ${level}</h3>`;
    const moduleGroup = document.createElement("table");
    moduleGroup.className = "module-group";
    moduleGroup.innerHTML = `
      <thead>
        <tr>
          <th>Module</th>
          <th>Term</th>
          <th>Group</th>
          <th>Prerequisites</th>
          <th>Required for</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    levelSection.appendChild(moduleGroup);
    moduleGrid.appendChild(levelSection);
    const tbody = moduleGroup.querySelector("tbody");

    let moduleCodes = modulesAtLevel[level] || [];
    let fieldList = ["module", "term", "groups", "prereqs", "reqfors"];
    // Check if any modules in this level have groups.
    const hasGroups = moduleCodes.some(
      (code) =>
        moduleData[code].groups && moduleData[code].groups.trim() !== "",
    );
    if (!hasGroups) {
      // Remove groups from field list and header.
      fieldList = fieldList.filter((field) => field !== "groups");
      const groupHeader = moduleGroup.querySelector("th:nth-child(3)");
      if (groupHeader) {
        groupHeader.remove();
      }
    }
    // Sort module codes alphabetically.
    moduleCodes = moduleCodes.sort((a, b) => a.localeCompare(b));
    for (const moduleCode of moduleCodes) {
      const module = moduleData[moduleCode];
      const moduleRow = document.createElement("tr");
      const data = {
        module: `<a href=${
          module.syllabus ||
          defaultSyllabusBaseURL +
            "/" +
            activeYearOfEntry +
            "/" +
            module.code.toUpperCase() +
            ".pdf"
        } target="_blank">${moduleCode.toUpperCase()} ${module.title}</a>`,
        term: module.term || "",
        groups: module.groups?.split(" ").join(", ") || "",
        prereqs:
          module.prereqs
            ?.map((p) => {
              if (Array.isArray(p)) {
                return p.sort().join(" or ");
              } else {
                return p;
              }
            })
            .sort()
            .join(", ") || "",
        reqfors: requiredForMap[moduleCode]?.sort().join(", ") || "",
      };
      for (const field of fieldList) {
        const cell = document.createElement("td");
        cell.className = field + "-cell";
        cell.innerHTML = data[field] || "";
        moduleRow.appendChild(cell);
      }
      tbody.appendChild(moduleRow);
    }
  }
}

function setQueryParameter(key, value) {
  // Set query parameter in URL without reloading the page.
  const url = new URL(window.location);
  url.searchParams.set(key, encodeURI(value));
  window.history.replaceState({}, "", url);
}


function setYearOfEntryHandler(button) {
  // Deselect all year buttons.
  const yearButtons = document.getElementsByClassName("year-button");
  for (const yb of yearButtons) {
    yb.setAttribute("data-state", "off");
  }
  button.setAttribute("data-state", "on");
  // Load the required data, specifying that this is an update.
  activeYearOfEntry = button.dataset.year;
  loadYear(activeYearOfEntry, true);
}