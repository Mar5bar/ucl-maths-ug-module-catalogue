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
    // If there's a theme in the URL query string, activate it.
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get("theme");
    if (themeParam && themes.includes(themeParam)) {
      userActivatedTheme = themeParam;
      activateTheme(themeParam);
    }
    // Restore any preferences.
    restoreDetailPreferences();
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
    const moduleGroup = document.createElement("div");
    moduleGroup.className = "module-group";
    levelSection.appendChild(moduleGroup);
    moduleGrid.appendChild(levelSection);

    const moduleCodes = modulesAtLevel[level] || [];
    // Sort module codes by Term and then alphabetically.
    moduleCodes.sort((a, b) => {
      const termA = moduleData[a].term || "4"; // Default to 4 if no term specified.
      const termB = moduleData[b].term || "4";
      if (termA !== termB) {
        return termA - termB;
      }
      return a.localeCompare(b);
    });
    for (const moduleCode of moduleCodes) {
      const module = moduleData[moduleCode];
      const moduleElement = document.createElement("div");
      moduleElement.id = `module-${moduleCode}`;
      moduleElement.className = "module";
      // Add the title, code, description, etc.
      moduleElement.innerHTML = `
                <div class='top-container'>
                <h4>${module.title} <br class="title-break"> <span class="module-code">(${module.code})</span></h4>
                <p class="description">${module.description}</p>
                </div>
            `;

      // Add prerequisite information.
      if (module.prereqs && module.prereqs.length > 0) {
        const prereqElement = document.createElement("p");
        prereqElement.className = "prereqs-list";
        prereqElement.innerHTML = `<strong>Requires:</strong> <span class="module-code">${module.prereqs.join(
          ", ",
        )}</span>`;
        moduleElement.appendChild(prereqElement);
      }

      // Add dependent modules information.
      const dependents = requiredForMap[moduleCode];
      if (dependents && dependents.length > 0) {
        const dependentElement = document.createElement("p");
        dependentElement.className = "reqfors-list";
        dependentElement.innerHTML = `<strong>Required for:</strong> ${dependents
          .sort()
          .join(", ")}`;
        moduleElement.appendChild(dependentElement);
      }

      // Add themes information.
      if (module.themes) {
        const themeElement = document.createElement("p");
        themeElement.className = "themes-list";
        themeElement.innerHTML = "<strong>Themes:</strong> ";
        // Add each theme as a button.
        for (const theme of module.themes.sort()) {
          const themeButton = createThemeButton(theme);
          themeElement.appendChild(themeButton);
        }
        moduleElement.appendChild(themeElement);
      }

      // If a syllabus link is provided, add it to the element.
      if (module.syllabus || true) {
        const syllabusElement = document.createElement("a");
        syllabusElement.href =
          module.syllabus ||
          defaultSyllabusBaseURL + module.code.toLowerCase() + ".pdf";
        syllabusElement.className = "syllabus";
        syllabusElement.target = "_blank";
        syllabusElement.onclick = (e) => {
          e.stopPropagation();
        };
        syllabusElement.innerHTML = "Syllabus";
        moduleElement.appendChild(syllabusElement);
      }

      // Make the module element clickable to highlight it.
      moduleElement.addEventListener("click", () => {
        const prereqCodes = prereqsMap[moduleCode] || [];
        const dependentCodes = requiredForMap[moduleCode] || [];
        clearHighlightedModules();
        if (activeModule === moduleCode) {
          // Deactivate the module.
          activeModule = null;
        } else {
          // Activate the module.
          activeModule = moduleCode;
          moduleElement.classList.add("active-module");
          highlightRelatedModules(activeModule);
        }
      });

      moduleGroup.appendChild(moduleElement);
      moduleData[moduleCode].element = moduleElement;
    }
  }
  // Add in a row of buttons at the top for each theme.
  const themeButtonRow = document.getElementById("theme-button-row");
  for (const theme of themes) {
    const themeButton = createThemeButton(theme);
    themeButtonRow.appendChild(themeButton);
  }
}

function toggleThemeOnClick(theme) {
  // If the user is deactivating a theme they activated, deactivate it.
  if (userActivatedTheme && userActivatedTheme === theme) {
    userActivatedTheme = null;
    deactivateTheme();
  } else {
    // Otherwise, the user is activating a theme.
    userActivatedTheme = theme;
    activateTheme(theme);
  }
}

function activateTheme(theme) {
  activeTheme = theme;
  // Highlight modules matching the selected theme.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    const moduleElement = module.element;
    if (module.themes && module.themes.includes(theme)) {
      moduleElement.classList.add("active-theme");
      moduleElement.classList.remove("inactive-theme");
    } else {
      moduleElement.classList.remove("active-theme");
      moduleElement.classList.add("inactive-theme");
    }
  }
  // Highlight theme buttons.
  for (const themeName in themeButtons) {
    const buttons = themeButtons[themeName];
    for (const button of buttons) {
      if (themeName === theme) {
        button.classList.add("active-theme");
        button.classList.remove("inactive-theme");
      } else {
        button.classList.remove("active-theme");
        button.classList.add("inactive-theme");
      }
    }
  }
  // If the selected theme hides the active module, clear the active module.
  if (activeModule && !isModuleVisible(activeModule)) {
    clearHighlightedModules();
    activeModule = null;
  }
  redrawLines();
}

function deactivateTheme() {
  // Remove highlighting from all modules.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    const moduleElement = module.element;
    moduleElement.classList.remove("active-theme");
    moduleElement.classList.remove("inactive-theme");
  }
  // Remove highlighting from all theme buttons.
  for (const themeName in themeButtons) {
    const buttons = themeButtons[themeName];
    for (const button of buttons) {
      button.classList.remove("active-theme");
      button.classList.remove("inactive-theme");
    }
  }
  activeTheme = null;
  redrawLines();
}

function createThemeButton(theme) {
  const themeButton = document.createElement("button");
  themeButton.className = "theme-button";
  themeButton.textContent = theme;
  themeButton.dataset.theme = theme;
  themeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleThemeOnClick(theme);
  });
  themeButton.addEventListener("mouseover", () => {
    return;
    // Don't override user selection.
    if (userActivatedTheme) return;
    activateTheme(theme);
  });
  themeButton.addEventListener("mouseout", () => {
    return;
    // Deactivate the theme, then re-activate the user-selected theme if any.
    deactivateTheme();
    if (userActivatedTheme) {
      activateTheme(userActivatedTheme);
    }
  });
  // Store the button for later access.
  if (!themeButtons[theme]) {
    themeButtons[theme] = [];
  }
  themeButtons[theme].push(themeButton);
  return themeButton;
}

function highlightRelatedModules(moduleCode) {
  const modulesConsidered = new Set();

  lines = [];
  // Maintain a stack of modules whose prereqs need connecting (checking for chains).
  let toDo = [moduleCode];
  let parentModule;
  let prereqCodes;
  while (toDo.length > 0) {
    parentModule = toDo.pop();
    if (modulesConsidered.has(parentModule)) {
      continue;
    }
    // Record that we've seen this module to prevent duplication.
    modulesConsidered.add(parentModule);
    // Loop over the prereqs of this module, marking them as prereqs and adding them to the stack. Skip any that are hidden.
    prereqCodes = prereqsMap[parentModule] || [];
    for (const prereq of prereqCodes) {
      if (!moduleData[prereq] || !isModuleVisible(prereq)) {
        continue;
      }
      moduleData[prereq].element.classList.add("prereq-module");
      lines.push([
        moduleData[prereq].element,
        moduleData[parentModule].element,
      ]);
      // If we've not looked at the new module's own prereqs yet, add the module to the stack.
      if (!modulesConsidered.has(prereq)) {
        toDo.push(prereq);
      }
    }
  }

  const dependentCodes = requiredForMap[moduleCode] || [];
  for (const code of dependentCodes) {
    if (!moduleData[code] || !isModuleVisible(code)) {
      continue;
    }
    moduleData[code].element.classList.add("dependent-module");
    lines.push([moduleData[moduleCode].element, moduleData[code].element]);
    modulesConsidered.add(code);
  }
  // Dim all other modules.
  for (const code in moduleData) {
    if (!modulesConsidered.has(code)) {
      moduleData[code].element.classList.add("inactive-module");
    }
  }
  clearLines();
  drawLines(lines);
}

function clearHighlightedModules() {
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    module.element.classList.remove("active-module");
    module.element.classList.remove("inactive-module");
    module.element.classList.remove("prereq-module");
    module.element.classList.remove("dependent-module");
  }
  lines = [];
  clearLines();
}

function showAllConnections() {
  lines = [];
  for (const moduleCode in moduleData) {
    const prereqCodes = prereqsMap[moduleCode] || [];
    for (const prereqCode of prereqCodes) {
      lines.push([
        moduleData[prereqCode].element,
        moduleData[moduleCode].element,
      ]);
    }
  }
  clearLines();
  drawLines(lines);
}

function clearLines() {
  const svg = document.getElementById("svg-lines");
  // Get all the path elements that are direct descendants and remove them, whilst preserving the marker definitions.
  const paths = Array.from(svg.children).filter(
    (child) => child.tagName === "path",
  );
  paths.forEach((path) => {
    svg.removeChild(path);
  });
}

function redrawLines() {
  // Prune the lines to only those between visible modules.
  let linesToDraw = lines.filter((line) => {
    const el1 = line[0];
    const el2 = line[1];
    return el1.offsetParent !== null && el2.offsetParent !== null;
  });
  clearLines();
  svgResize();
  drawLines(linesToDraw);
}

function drawLines(lines) {
  // If there are no lines to draw, return.
  if (!lines || lines.length === 0) {
    return;
  }
  // Use a JQuery library to draw SVG paths between elements.
  lines.forEach((line) => {
    const el1 = line[0];
    const el2 = line[1];

    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    // We want to make the shortest path between any side of el1 to any side of el2. We could be intelligent about this, or we could loop through all combinations and pick the shortest.
    const el1Points = [
      { x: rect1.left, y: rect1.top + rect1.height / 2, label: "lr" }, // left
      { x: rect1.right, y: rect1.top + rect1.height / 2, label: "lr" }, // right
      { x: rect1.left + rect1.width / 2, y: rect1.top, label: "tb" }, // top
      { x: rect1.left + rect1.width / 2, y: rect1.bottom, label: "tb" }, // bottom
    ];
    const el2Points = [
      { x: rect2.left, y: rect2.top + rect2.height / 2, label: "lr" }, // left
      { x: rect2.right, y: rect2.top + rect2.height / 2, label: "lr" }, // right
      { x: rect2.left + rect2.width / 2, y: rect2.top, label: "tb" }, // top
      { x: rect2.left + rect2.width / 2, y: rect2.bottom, label: "tb" }, // bottom
    ];
    let minDistance = Infinity;
    let bestPair = [el1Points[0], el2Points[0]];
    for (const p1 of el1Points) {
      for (const p2 of el2Points) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < minDistance) {
          minDistance = distanceSquared;
          bestPair = [p1, p2];
        }
      }
    }
    const startX = bestPair[0].x + window.scrollX;
    const startY = bestPair[0].y + window.scrollY;
    const endX = bestPair[1].x + window.scrollX;
    const endY = bestPair[1].y + window.scrollY;

    const node1X = bestPair[0].label === "lr" ? endX : startX;
    const node1Y = bestPair[0].label === "lr" ? startY : endY;
    const node2X = bestPair[1].label === "lr" ? startX : endX;
    const node2Y = bestPair[1].label === "lr" ? endY : startY;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const d = `M ${startX} ${startY} C ${node1X} ${node1Y} ${node2X} ${node2Y} ${endX} ${endY}`;
    path.setAttribute("d", d);
    path.setAttribute("stroke", "black");
    path.setAttribute("fill", "transparent");
    path.setAttribute("marker-end", "url(#arrow)");

    const svg = document.getElementById("svg-lines");
    svg.appendChild(path);
  });
}

window.addEventListener("resize", () => {
  redrawLines();
});

function svgResize() {
  const svg = document.getElementById("svg-lines");
  svg.setAttribute("width", document.body.scrollWidth + window.scrollX);
  svg.setAttribute("height", document.body.scrollHeight + window.scrollY);
  svg.style.width = document.body.scrollWidth + "px";
  svg.style.height = document.body.scrollHeight + "px";
}

function toggleDetailLevel(className, enable) {
  document.getElementById("module-grid").classList.toggle(className, enable);
  redrawLines();
}

function toggleDetailHandler(button, type) {
  button.setAttribute(
    "data-state",
    button.getAttribute("data-state") === "on" ? "off" : "on",
  );
  toggleDetailLevel(
    type + "-low-detail",
    button.getAttribute("data-state") === "off",
  );
  // Record the state of the button in local storage.
  localStorage.setItem("detail-" + type, button.getAttribute("data-state"));
  checkAnyDetails();
}

function restoreDetailPreferences() {
  const detailTypes = [
    "description",
    "prereqs",
    "reqfors",
    "themes",
    "syllabus",
  ];
  detailTypes.forEach((type) => {
    const button = document.getElementById(type + "-detail-toggle");
    if (!button) return;
    const state =
      localStorage.getItem("detail-" + type) ||
      defaultDetailPreferences[type] ||
      "on";
    button.setAttribute("data-state", state);
    toggleDetailLevel(type + "-low-detail", state === "off");
  });
  checkAnyDetails();
}

function checkAnyDetails() {
  // If no details are enabled, add a class to module-grid to indicate this.
  const detailTypes = [
    "description",
    "prereqs",
    "reqfors",
    "themes",
    "syllabus",
  ];
  let anyOn = false;
  detailTypes.forEach((dt) => {
    const btn = document.getElementById(dt + "-detail-toggle");
    if (btn && btn.getAttribute("data-state") === "on") {
      anyOn = true;
    }
  });
  document
    .getElementById("module-grid")
    .classList.toggle("no-details-enabled", !anyOn);
}

function searchModules() {
  const input = document.getElementById("search-input");
  let query = input.value.trim().toUpperCase();
  if (!query) {
    return;
  }
  // If the query contains no letters, add in MATH as a prefix.
  if (!/[A-Z]/.test(query)) {
    // If the query has fewer than 4 digits, pad with leading zeros.
    query = query.padStart(4, "0");
    query = "MATH" + query;
  }
  const module = moduleData[query];
  if (module) {
    // If the module is not visible due to theme filtering, deactivate the theme.
    if (!isModuleVisible(module.code) && activeTheme) {
      deactivateTheme();
      userActivatedTheme = null;
      activeTheme = null;
    }
    // Scroll to the module.
    module.element.scrollIntoView({ behavior: "smooth", block: "center" });
    // Highlight the module.
    clearHighlightedModules();
    activeModule = query;
    module.element.classList.add("active-module");
    highlightRelatedModules(activeModule);
  } else {
    // Module not found.
    // Display a little tooltip.
    displayTooltip(input, "Module not found");
  }
}

function displayTooltip(element, message) {
  // Create tooltip element.
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.textContent = message;
  document.body.appendChild(tooltip);

  // Position the tooltip above the element.
  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + window.scrollX + "px";
  tooltip.style.top =
    rect.top + window.scrollY - tooltip.offsetHeight - 5 + "px";

  // Remove the tooltip after 2 seconds.
  setTimeout(() => {
    document.body.removeChild(tooltip);
  }, 2000);
}

function isModuleVisible(moduleCode) {
  return (
    moduleData[moduleCode] &&
    !moduleData[moduleCode].element.classList.contains("inactive-theme")
  );
}

const input = document.getElementById("search-input");
const button = document.getElementById("search-button");

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevent form submission or page reload
    button.click(); // Trigger the button's click event
  }
});
