/* =====================
   THEME LOGIC
===================== */

const toggleBtn = document.getElementById("theme-toggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const storedTheme = localStorage.getItem("theme");

setTheme(storedTheme || (prefersDark ? "dark" : "light"));

toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
});

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    toggleBtn.textContent = theme === "dark" ? "Светлая тема" : "Тёмная тема";
}

/* =====================
   DATA LOADING
===================== */

Promise.all([
    fetch("data.csv").then((response) => response.text()),
    fetch("notes.csv").then((response) => response.text())
]).then(([dataText, notesText]) => {
    const rows = parseCSV(dataText);
    const notes = parseNotes(notesText);

    buildTable(rows, notes);
    renderNotes(notes);
});

/* =====================
   CSV PARSER
===================== */

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        if (char === '"') {
            if (inQuotes && text[index + 1] === '"') {
                cell += '"';
                index++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(cell.trim());
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (row.length || cell) {
                row.push(cell.trim());
                rows.push(row);
            }

            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    if (row.length || cell) {
        row.push(cell.trim());
        rows.push(row);
    }

    return rows;
}

/* =====================
   NOTES
===================== */

function parseNotes(text) {
    const rows = parseCSV(text);
    const notes = {};

    rows.slice(1).forEach(([id, content]) => {
        notes[id] = content;
    });

    return notes;
}

function renderFootnotes(text, notes) {
    const replaced = text.replace(/\*\*/g, "[3]");

    return replaced.replace(/\[(\d+)\]/g, (_, id) => {
        return notes[id]
            ? `<sup data-note="${id}" title="${notes[id]}">${id}</sup>`
            : `<sup>${id}</sup>`;
    });
}

/* =====================
   TABLE
===================== */

function buildTable(rows, notes) {
    const table = document.getElementById("compare-table");
    const controlHost = document.getElementById("table-controls");

    table.innerHTML = "";
    controlHost.innerHTML = "";

    const headers = parseHeaders(rows[0]);
    const dataRows = rows.slice(1);

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    headers.forEach((header, columnIndex) => {
        const th = document.createElement("th");
        th.innerHTML = renderFootnotes(header.label, notes);
        th.dataset.column = String(columnIndex);

        if (header.optional) {
            th.classList.add("is-optional");
        }

        headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    dataRows.forEach((row) => {
        const tr = document.createElement("tr");
        const modelName = row[0] || "Без названия";

        tr.dataset.model = modelName;

        headers.forEach((header, columnIndex) => {
            const td = document.createElement("td");
            const cell = row[columnIndex] || "";
            let text = cell;
            let className = "";

            if (cell.includes("|")) {
                [text, className] = cell.split("|");
            }

            td.dataset.column = String(columnIndex);
            td.innerHTML = renderFootnotes(text, notes);

            if (className) {
                td.className = className;
            }

            if (header.optional) {
                td.classList.add("is-optional");
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    createControls(controlHost, table, headers, dataRows);
    enableColumnHover(table);
    enableFootnoteClicks();
}

function parseHeaders(rawHeaders) {
    return rawHeaders.map((header, index) => {
        const optional = header.startsWith("+");

        return {
            index,
            label: optional ? header.slice(1) : header,
            optional
        };
    });
}

function createControls(host, table, headers, dataRows) {
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";

    const resetButton = createButton("Показать все");
    const baseViewButton = createButton("Базовый вид");

    toolbar.append(resetButton, baseViewButton);
    host.appendChild(toolbar);

    const panels = document.createElement("div");
    panels.className = "control-panels";

    const modelPanel = createPanel("Модели", dataRows.map((row) => row[0] || "Без названия"), true);
    const columnPanel = createPanel(
        "Колонки",
        headers.slice(1).map((header) => header.label),
        false
    );

    panels.append(modelPanel.panel, columnPanel.panel);
    host.appendChild(panels);

    const hiddenColumns = new Set(headers.filter((header) => header.optional).map((header) => header.index));
    const hiddenModels = new Set();

    const modelCheckboxes = modelPanel.checkboxes;
    const columnCheckboxes = new Map();

    headers.slice(1).forEach((header) => {
        const checkbox = columnPanel.checkboxes.get(header.label);
        checkbox.checked = !header.optional;
        columnCheckboxes.set(header.index, checkbox);
    });

    applyColumnVisibility(table, hiddenColumns);
    applyModelVisibility(table, hiddenModels);

    modelCheckboxes.forEach((checkbox, modelName) => {
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                hiddenModels.delete(modelName);
            } else {
                hiddenModels.add(modelName);
            }

            applyModelVisibility(table, hiddenModels);
        });
    });

    columnCheckboxes.forEach((checkbox, columnIndex) => {
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                hiddenColumns.delete(columnIndex);
            } else {
                hiddenColumns.add(columnIndex);
            }

            applyColumnVisibility(table, hiddenColumns);
        });
    });

    resetButton.addEventListener("click", () => {
        hiddenModels.clear();
        hiddenColumns.clear();

        modelCheckboxes.forEach((checkbox) => {
            checkbox.checked = true;
        });

        columnCheckboxes.forEach((checkbox) => {
            checkbox.checked = true;
        });

        applyModelVisibility(table, hiddenModels);
        applyColumnVisibility(table, hiddenColumns);
    });

    baseViewButton.addEventListener("click", () => {
        hiddenModels.clear();
        hiddenColumns.clear();

        modelCheckboxes.forEach((checkbox) => {
            checkbox.checked = true;
        });

        headers.slice(1).forEach((header) => {
            const checkbox = columnCheckboxes.get(header.index);
            const visible = !header.optional;

            checkbox.checked = visible;

            if (!visible) {
                hiddenColumns.add(header.index);
            }
        });

        applyModelVisibility(table, hiddenModels);
        applyColumnVisibility(table, hiddenColumns);
    });
}

function createPanel(title, items, openByDefault) {
    const panel = document.createElement("details");
    panel.className = "control-panel";
    panel.open = openByDefault;

    const summary = document.createElement("summary");
    summary.textContent = title;
    panel.appendChild(summary);

    const body = document.createElement("div");
    body.className = "chip-list";

    const checkboxes = new Map();

    items.forEach((item) => {
        const label = document.createElement("label");
        label.className = "chip";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;

        const text = document.createElement("span");
        text.textContent = item;

        label.append(checkbox, text);
        body.appendChild(label);
        checkboxes.set(item, checkbox);
    });

    panel.appendChild(body);

    return { panel, checkboxes };
}

function createButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toolbar-button";
    button.textContent = text;
    return button;
}

function applyColumnVisibility(table, hiddenColumns) {
    table.querySelectorAll("[data-column]").forEach((cell) => {
        const columnIndex = Number(cell.dataset.column);
        cell.classList.toggle("is-hidden", hiddenColumns.has(columnIndex));
    });
}

function applyModelVisibility(table, hiddenModels) {
    table.querySelectorAll("tbody tr").forEach((row) => {
        row.classList.toggle("is-hidden-row", hiddenModels.has(row.dataset.model));
    });
}

/* =====================
   RENDER NOTES
===================== */

function renderNotes(notes) {
    const list = document.getElementById("notes-list");
    list.innerHTML = "";

    Object.keys(notes)
        .map(Number)
        .sort((left, right) => left - right)
        .forEach((id) => {
            const li = document.createElement("li");
            li.id = `note-${id}`;
            li.value = id;
            li.textContent = notes[id];
            list.appendChild(li);
        });
}

/* =====================
   INTERACTION
===================== */

function enableColumnHover(table) {
    table.querySelectorAll("td, th").forEach((cell) => {
        cell.addEventListener("mouseenter", () => {
            const columnIndex = cell.cellIndex;

            table.querySelectorAll("tr").forEach((row) => {
                if (row.cells[columnIndex] && !row.cells[columnIndex].classList.contains("is-hidden")) {
                    row.cells[columnIndex].classList.add("hover-col");
                }
            });
        });

        cell.addEventListener("mouseleave", () => {
            table.querySelectorAll(".hover-col").forEach((hoveredCell) => {
                hoveredCell.classList.remove("hover-col");
            });
        });
    });
}

function enableFootnoteClicks() {
    document.querySelectorAll("sup[data-note]").forEach((sup) => {
        sup.addEventListener("click", () => {
            const id = sup.dataset.note;
            const target = document.getElementById(`note-${id}`);

            if (!target) {
                return;
            }

            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("note-active");

            window.setTimeout(() => {
                target.classList.remove("note-active");
            }, 2000);
        });
    });
}
