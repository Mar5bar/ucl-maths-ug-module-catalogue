let hideAncillaryModules = true;
let themesOverride = true;

let moduleData = {};

let themes;
let levels;
let groups;
let prereqsMap;
let requiredForMap;
let modulesAtLevel;
let themeButtons;

let userActivatedTheme = null;
let activeTheme;

let activeModule;
let lines = [];

let loadedThemesToModules;
let themesToModules;
let themesToModulesNoPrereqs;
let ancillaryModules;

const defaultSyllabusBaseURL =
  "https://www.ucl.ac.uk/mathematical-physical-sciences/sites/mathematical_physical_sciences/files/";
const defaultDetailPreferences = {
  description: "on",
  syllabus: "on",
  prereqs: "on",
  reqfors: "off",
  themes: "off",
  terms: "off",
  "theme-prereqs": "on",
  groups: "off",
  years: "on",
};

let splitByTerm = defaultDetailPreferences["terms"] === "on";
let themePrereqsEnabled = defaultDetailPreferences["theme-prereqs"] === "on";

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
    loadedThemesToModules = data.themesToModules;
    processModuleData(moduleData);
    // If there's a theme in the URL query string, activate it.
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = decodeURI(urlParams.get("theme"));
    if (themeParam && themes.includes(themeParam)) {
      userActivatedTheme = themeParam;
      activateTheme(themeParam);
      setQueryParameter("theme", themeParam);
    } else {
      // If no theme, ensure none are active and all modules are shown.
      deactivateTheme();
    }
    // Restore any preferences.
    restoreDetailPreferences();
    // If there's a module in the URL query string, activate it.
    const moduleParam = urlParams.get("module");
    if (moduleParam) {
      activateModule(moduleParam);
    }
    runMathJax();
  })
  .catch((error) => {
    console.error("Error fetching module data:", error);
  });

function processModuleData(moduleData) {
  // Clear the module grid and theme buttons.
  document.getElementById("module-grid").innerHTML = "";
  document.getElementById("theme-button-row").innerHTML = "Theme:&nbsp;";
  levels = new Set();
  themes = new Set();
  groups = new Set();
  modulesAtLevel = {};
  prereqsMap = {};
  requiredForMap = {};
  modulesAtLevel = {};
  themeButtons = {};
  themesToModules = structuredClone(loadedThemesToModules) || {};
  themesToModulesNoPrereqs = {};

  // Loop through the modules and populate lists of metadata.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    let level = module.level;
    const term = module.term;
    if (splitByTerm && term) {
      level = level + ": Term " + term;
    }
    // Record levels, themes, and groups.
    levels.add(level);
    if (module.themes) {
      module.themes.forEach((theme) => themes.add(theme));
    }
    if (module.groups) {
      // If groups is a string, convert to array.
      if (typeof module.groups === "string") {
        module.groups = module.groups.split(" ").map((g) => g.trim());
      }
      module.groups.forEach((group) => groups.add(group));
    }
    // Record this module in the corresponding level.
    if (!modulesAtLevel[level]) {
      modulesAtLevel[level] = [];
    }
    modulesAtLevel[level].push(moduleCode);
    if (module.prereqs) {
      prereqsMap[moduleCode] = unpackPrereqs(module.prereqs);
      // Populate a reverse mapping of prerequisites.
      for (const prereq of prereqsMap[moduleCode]) {
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
    // Add in themes for each group.
    for (const group of groups) {
      const themeName = "Group " + group;
      themes.push(themeName);
      themesToModules[themeName] = [];
      for (const moduleCode in moduleData) {
        const module = moduleData[moduleCode];
        if (module.groups && module.groups.includes(group)) {
          themesToModules[themeName].push(moduleCode);
        }
      }
    }
    // Clear existing themes from modules.
    for (const moduleCode in moduleData) {
      delete moduleData[moduleCode].themes;
    }

    if (themePrereqsEnabled) {
      // Update the themesToModules mapping to include prerequistites.
      for (const theme in themesToModules) {
        const moduleCodes = themesToModules[theme];
        themesToModulesNoPrereqs[theme] = Array.from(moduleCodes).filter(
          (code) => moduleData[code],
        );
        const toConsider = [...moduleCodes];
        const allModuleCodes = new Set(moduleCodes);
        while (toConsider.length > 0) {
          const code = toConsider.pop();
          const module = moduleData[code];
          if (module && module.prereqs) {
            module.prereqs.forEach((prereq) => {
              const unpackedPrereqs = unpackPrereqs(prereq);
              for (const p of unpackedPrereqs) {
                allModuleCodes.add(p);
                toConsider.push(p);
              }
            });
          }
        }
        themesToModules[theme] = Array.from(allModuleCodes);
      }
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
  themes = Array.from(themes).sort((a, b) => {
    // Sort any Groups to the end.
    const aIsGroup = a.startsWith("Group ");
    const bIsGroup = b.startsWith("Group ");
    if (aIsGroup && !bIsGroup) return 1;
    if (!aIsGroup && bIsGroup) return -1;
    return a.localeCompare(b);
  });

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

    let moduleCodes = modulesAtLevel[level] || [];
    // Sort module codes by prerequisites: a before b if a is a prerequisite of b.
    moduleCodes = topologicalSort(moduleCodes);
    for (const moduleCode of moduleCodes) {
      const module = moduleData[moduleCode];
      const moduleElement = document.createElement("div");
      moduleElement.id = `module-${moduleCode}`;
      moduleElement.className = "module";

      // List the years.
      let yearString;
      if (module.years) {
        moduleElement.classList.add("multi-year-module");
        yearString = `<span class="years-list">, Year ${module.years.join(
          "/",
        )}</span>`;
      }
      // Add the title, code, description, etc.
      moduleElement.innerHTML = `
                <div class='top-container'>
                <h4>${
                  module.title
                } <br class="title-break"> <span class="module-code">(${
        module.code + (yearString ? yearString : "")
      }<span class="groups-list">${
        module.groups ? ", Group " + module.groups.join("/") : ""
      }</span>)</span></h4>
                <p class="description">${module.description}</p>
                </div>
            `;

      // Add prerequisite information.
      if (module.prereqs && module.prereqs.length > 0) {
        const prereqElement = document.createElement("p");
        prereqElement.className = "prereqs-list";
        let prereqsText = module.prereqs
          .map((p) => {
            if (Array.isArray(p)) {
              return p.sort().join(" or ");
            } else {
              return p;
            }
          })
          .sort()
          .join(", ");
        prereqElement.innerHTML = `<strong>Requires:</strong> <span class="module-code">${prereqsText}</span>`;
        moduleElement.appendChild(prereqElement);
      }

      // Add dependent modules information.
      const dependents = requiredForMap[moduleCode];
      if (dependents && dependents.length > 0) {
        const dependentElement = document.createElement("p");
        dependentElement.className = "reqfors-list";
        dependentElement.innerHTML = `<strong>Required for:</strong> <span class="module-code">${dependents
          .sort()
          .join(", ")}</span>`;
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

      // Add a link to the syllabus.
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

      // Make the module element clickable to highlight it.
      moduleElement.addEventListener("click", () => {
        const prereqCodes = prereqsMap[moduleCode] || [];
        const dependentCodes = requiredForMap[moduleCode] || [];
        clearHighlightedModules();
        if (activeModule === moduleCode) {
          // Deactivate the module.
          deactivateModule();
        } else {
          // Activate the module.
          activateModule(moduleCode);
        }
      });

      moduleGroup.appendChild(moduleElement);
      moduleData[moduleCode].element = moduleElement;
    }
  }
  // Add in a row of buttons at the top for each theme.
  const themeButtonRow = document.getElementById("theme-button-row");
  let startedGroups = false;
  for (const theme of themes) {
    // Add a newline and "Group: " before Group themes.
    if (theme.startsWith("Group ") && !startedGroups) {
      const groupLabel = document.createElement("span");
      groupLabel.innerHTML = "<br>Group: &nbsp;";
      themeButtonRow.appendChild(groupLabel);
      startedGroups = true;
    }
    const themeButton = createThemeButton(theme);
    if (startedGroups) {
      themeButton.textContent = theme.replace("Group ", "");
    }
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
  deactivateTheme();
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
    deactivateModule();
  } else {
    // Re-highlight the active module to redraw connections.
    activateModule(activeModule, false);
  }
  // Note via a class that a theme is active.
  document.getElementById("module-grid").classList.remove("no-theme-active");

  // If the theme starts with "Group ", turn on the groups detail level.
  if (theme.startsWith("Group ")) {
    const groupsButton = document.getElementById("groups-detail-toggle");
    if (groupsButton && groupsButton.getAttribute("data-state") === "off") {
      toggleDetailHandler(groupsButton, "groups");
    }
  }

  // Add a class to modules in the theme (not the included prereqs) to highlight them.
  for (const moduleCode of themesToModulesNoPrereqs[theme]) {
    // Add a class to show that it is in the current theme.
    moduleData[moduleCode].element.classList.add("current-theme-no-prereqs");
  }

  setQueryParameter("theme", theme);
  // Redraw all lines.
  redrawLines();
}

function deactivateTheme() {
  // Remove highlighting from all modules.
  for (const moduleCode in moduleData) {
    const module = moduleData[moduleCode];
    const moduleElement = module.element;
    moduleElement.classList.remove("active-theme");
    moduleElement.classList.remove("inactive-theme");
    moduleElement.classList.remove("current-theme-no-prereqs");
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
  // Note via a class that no theme is active.
  document.getElementById("module-grid").classList.add("no-theme-active");

  clearQueryParameter("theme");
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
    // If Terms splitting is enabled, allow connections from all four sides; if not, limit to right/bottom of el1 and left/top of el2.
    const el1Points = [
      { x: rect1.right, y: rect1.top + rect1.height / 2, label: "lr" }, // right
      { x: rect1.left + rect1.width / 2, y: rect1.bottom, label: "tb" }, // bottom
    ];
    const el2Points = [
      { x: rect2.left, y: rect2.top + rect2.height / 2, label: "lr" }, // left
      { x: rect2.left + rect2.width / 2, y: rect2.top, label: "tb" }, // top
    ];
    if (splitByTerm) {
      el1Points.push(
        { x: rect1.left, y: rect1.top + rect1.height / 2, label: "lr" }, // left
        { x: rect1.left + rect1.width / 2, y: rect1.top, label: "tb" }, // top
      );
      el2Points.push(
        { x: rect2.right, y: rect2.top + rect2.height / 2, label: "lr" }, // right
        { x: rect2.left + rect2.width / 2, y: rect2.bottom, label: "tb" }, // bottom
      );
    }
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

    // Add a control point 5px from the end by sampling the current path, finishing the line with a straight segment.
    const pathLength = path.getTotalLength();
    const samplePoint = path.getPointAtLength(Math.max(0, pathLength - 5));
    const controlX = samplePoint.x;
    const controlY = samplePoint.y;

    // Reconstruct the path with the additional control point
    const newD = `M ${startX} ${startY} C ${node1X} ${node1Y} ${node2X} ${node2Y} ${controlX} ${controlY} L ${endX} ${endY}`;
    path.setAttribute("d", newD);

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
  if (type === "terms") {
    splitByTerm = button.getAttribute("data-state") === "on";
    refreshAll(false);
  }
  if (type === "theme-prereqs") {
    themePrereqsEnabled = button.getAttribute("data-state") === "on";
    refreshAll(false);
  }
  // Record the state of the button in local storage.
  localStorage.setItem("detail-" + type, button.getAttribute("data-state"));
  checkAnyDetails();
}

function refreshAll(scrollTo = true) {
  // Re-process the module data to update levels.
  processModuleData(moduleData);
  redrawLines();
  // Re-highlight the active module if any.
  if (activeModule) {
    activateModule(activeModule, scrollTo);
  }
  // If a theme is active, re-activate it to re-apply filtering.
  if (activeTheme) {
    activateTheme(activeTheme);
  }
}

function restoreDetailPreferences() {
  const detailTypes = Object.keys(defaultDetailPreferences);
  detailTypes.forEach((type) => {
    const button = document.getElementById(type + "-detail-toggle");
    if (!button) return;
    const state =
      localStorage.getItem("detail-" + type) ||
      defaultDetailPreferences[type] ||
      "on";
    button.setAttribute("data-state", state);
    toggleDetailLevel(type + "-low-detail", state === "off");
    if (type === "terms") {
      splitByTerm = state === "on";
    }
    if (type === "theme-prereqs") {
      themePrereqsEnabled = state === "on";
    }
  });
  checkAnyDetails();
  const defaultSplitByTerm = defaultDetailPreferences["terms"] === "on";
  const defaultThemePrereqs =
    defaultDetailPreferences["theme-prereqs"] === "on";
  if (
    splitByTerm !== defaultSplitByTerm ||
    themePrereqsEnabled !== defaultThemePrereqs
  ) {
    refreshAll();
  }
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
    // Highlight the module.
    activateModule(module.code);
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

function topologicalSort(codes) {
  const incoming = new Map();
  const graph = new Map();

  for (const code of codes) {
    incoming.set(code, 0);
    graph.set(code, []);
  }

  // Edges are from prereq to module.
  const edges = [];
  for (const code of codes) {
    const prereqs = prereqsMap[code] || [];
    for (const prereq of prereqs) {
      if (codes.includes(prereq)) {
        edges.push([prereq, code]);
      }
    }
  }

  const nodes = Array.from(codes);

  for (const [a, b] of edges) {
    // a < b
    graph.get(a).push(b);
    incoming.set(b, (incoming.get(b) || 0) + 1);
  }

  // Start with all nodes with no incoming edges
  let layer = nodes.filter((n) => incoming.get(n) === 0);
  const result = [];

  while (layer.length > 0) {
    // Sort the current layer using the given compare function
    layer.sort((a, b) => a.localeCompare(b));
    result.push(...layer);

    const nextLayer = [];

    for (const node of layer) {
      for (const neighbor of graph.get(node)) {
        incoming.set(neighbor, incoming.get(neighbor) - 1);
        if (incoming.get(neighbor) === 0) nextLayer.push(neighbor);
      }
    }

    layer = nextLayer;
  }

  // Check for cycles
  if (result.length !== nodes.length)
    throw new Error("Cycle detected or invalid partial order");

  return result;
}

function activateModule(moduleCode, scrollTo = true) {
  clearHighlightedModules();
  if (!moduleData[moduleCode] || !isModuleVisible(moduleCode)) {
    return;
  }
  activeModule = moduleCode;
  moduleData[moduleCode].element.classList.add("active-module");
  highlightRelatedModules(activeModule);
  setQueryParameter("module", moduleCode);
  if (!scrollTo) {
    return;
  }
  // If the module isn't onscreen, scroll to it.
  const rect = moduleData[moduleCode].element.getBoundingClientRect();
  if (
    rect.bottom < 0 ||
    rect.top > (window.innerHeight || document.documentElement.clientHeight)
  ) {
    moduleData[moduleCode].element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

function deactivateModule() {
  clearHighlightedModules();
  activeModule = null;
  clearQueryParameter("module");
}

function setQueryParameter(key, value) {
  // Set query parameter in URL without reloading the page.
  const url = new URL(window.location);
  url.searchParams.set(key, encodeURI(value));
  window.history.replaceState({}, "", url);
}

function clearQueryParameter(key) {
  const url = new URL(window.location);
  url.searchParams.delete(key);
  window.history.replaceState({}, "", url);
}

function runMathJax() {
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise().then(() => {
      redrawLines();
    });
  }
}

function unpackPrereqs(prereqList) {
  if (!Array.isArray(prereqList)) {
    return [prereqList];
  }
  const unpacked = new Set();
  for (const prereq of prereqList) {
    if (Array.isArray(prereq)) {
      prereq.forEach((p) => unpacked.add(p));
    } else {
      unpacked.add(prereq);
    }
  }
  return Array.from(unpacked);
}

const input = document.getElementById("search-input");
const button = document.getElementById("search-button");

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevent form submission or page reload
    button.click(); // Trigger the button's click event
  }
});
