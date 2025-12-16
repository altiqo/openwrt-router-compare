Promise.all([
    fetch("data.csv").then(r => r.text()),
    fetch("notes.csv").then(r => r.text())
]).then(([dataText, notesText]) => {
    const data = parseCSV(dataText);
    const notes = parseNotes(notesText);

    buildTable(data, notes);
    renderNotes(notes);
});

function parseCSV(text) {
    return text
        .trim()
        .split("\n")
        .map(row => row.split(",").map(c => c.trim()));
}

function parseNotes(text) {
    const rows = parseCSV(text);
    const notes = {};

    rows.slice(1).forEach(([id, content]) => {
        notes[id] = content;
    });

    return notes;
}

function renderFootnotes(text, notes) {
    return text.replace(/\[(\d)\]/g, (m, n) => {
        return notes[n]
        ? `<sup title="${notes[n]}">${n}</sup>`
        : `<sup style="color:red">${n}</sup>`;
    });
}

function buildTable(rows, notes) {
    const table = document.getElementById("compare-table");

    const header = rows[0];
    const thead = document.createElement("thead");
    thead.innerHTML =
    "<tr>" + header.map(h => `<th>${h}</th>`).join("") + "</tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.forEach(cell => {
            const td = document.createElement("td");

            let text = cell;
            let cls = "";

            if (cell.includes("|")) {
                [text, cls] = cell.split("|");
                td.className = cls;
            }

            td.innerHTML = renderFootnotes(text, notes);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    enableColumnHover(table);
}

function renderNotes(notes) {
    const list = document.getElementById("notes-list");

    Object.keys(notes)
        .sort((a, b) => a - b)
        .forEach(id => {
        const li = document.createElement("li");
        li.textContent = notes[id];
        list.appendChild(li);
    });
}

function enableColumnHover(table) {
    table.querySelectorAll("td, th").forEach(cell => {
        cell.addEventListener("mouseenter", () => {
            const i = cell.cellIndex;
            table.querySelectorAll("tr").forEach(r => {
                if (r.cells[i]) r.cells[i].classList.add("hover-col");
            });
        });

        cell.addEventListener("mouseleave", () => {
            table.querySelectorAll(".hover-col")
                .forEach(c => c.classList.remove("hover-col"));
        });
    });
}
