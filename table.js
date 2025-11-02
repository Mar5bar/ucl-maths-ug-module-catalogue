let hideAncillaryModules = true;
let themesOverride = true;

let moduleData = {};

let themes = new Set();
let levels = new Set();
let prereqsMap = {};
let requiredForMap = {};
let modulesAtLevel = {};
let themeButtons = {};

let userActivatedTheme = null;
let activeTheme = null;

let activeModule = null;
let lines = [];

let themesToModules = {};
let ancillaryModules;

const defaultSyllabusBaseURL =
  "https://www.ucl.ac.uk/mathematical-physical-sciences/sites/mathematical_physical_sciences/files/";
const defaultDetailPreferences = {
  description: "on",
  syllabus: "on",
  prereqs: "on",
  reqfors: "off",
  themes: "off",
};

// Fetch module_data.
fetch("module_data.json")
  .then((response) => response.json())
  .then((data) => {
    ancillaryModules = new Set(data.ancillaryModules || []);
    for (const module of data.modules) {
      // Skip ancillary modules.
      if (hideAncillaryModules && ancillaryModules.has(module.code)) {
        continue;
      }
      moduleData[module.code] = module;
    }
    themesToModules = data.themesToModules;
    processModuleData(moduleData);
  })
  .catch((error) => {
    console.error("Error fetching module data:", error);
  });

function processModuleData(moduleData) {
  // Loop through the modules and populate lists of metadata.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    const level = module.level;
    // Record levels and themes.
    levels.add(level);
    if (module.themes) {
      module.themes.forEach((theme) => themes.add(theme));
    }
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

  // We will override the themes.
  if (themesOverride) {
    themes = Array.from(Object.keys(themesToModules)) || [];
    // Clear existing themes from modules.
    for (const moduleCode in moduleData) {
      delete moduleData[moduleCode].themes;
    }
    // Update the themesToModules mapping to include prerequistites.
    for (const theme in themesToModules) {
      const moduleCodes = themesToModules[theme];
      const toConsider = [...moduleCodes];
      const allModuleCodes = new Set(moduleCodes);
      while (toConsider.length > 0) {
        const code = toConsider.pop();
        const module = moduleData[code];
        if (module && module.prereqs) {
          module.prereqs.forEach((prereq) => {
            allModuleCodes.add(prereq);
            toConsider.push(prereq);
          });
        }
      }
      themesToModules[theme] = Array.from(allModuleCodes);
    }

    // Assign themes based on the themesToModules mapping.
    for (const theme of themes) {
      const moduleCodes = themesToModules[theme] || [];
      moduleCodes.forEach((code) => {
        const module = moduleData[code];
        if (module) {
          module.themes = module.themes || [];
          module.themes.push(theme);
        }
      });
    }
  }

  // Convert levels and themes to sorted arrays.
  levels = Array.from(levels).sort();
  themes = Array.from(themes).sort();

  // Build the grid of modules. Each level gets its own section.
  const moduleGrid = document.getElementById("module-grid");
  for (const level of levels) {
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
    // Sort module codes alphabetically.
    moduleCodes = moduleCodes.sort((a, b) => a.localeCompare(b));
    for (const moduleCode of moduleCodes) {
      const module = moduleData[moduleCode];
      const moduleRow = document.createElement("tr");
      const data = {
        module: `<a href=${
          module.syllabus ||
          defaultSyllabusBaseURL + module.code.toLowerCase() + ".pdf"
        } target="_blank">${moduleCode.toUpperCase()} ${module.title}</a>`,
        term: module.term || "",
        prereqs: prereqsMap[moduleCode]?.join(", ") || "",
        reqfors: requiredForMap[moduleCode]?.join(", ") || "",
      };
      for (const field of ["module", "term", "prereqs", "reqfors"]) {
        const cell = document.createElement("td");
        cell.className = field + "-cell";
        cell.innerHTML = data[field] || "";
        moduleRow.appendChild(cell);
      }
      tbody.appendChild(moduleRow);
    }
  }
}
