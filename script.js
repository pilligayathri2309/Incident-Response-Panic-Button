const API_URL =
    "https://p7tbvepucj.execute-api.us-east-1.amazonaws.com/prod/incidents";


// -----------------------------------------
// API REQUEST WITH AUTOMATIC RETRIES
// -----------------------------------------

async function fetchWithRetry(url, options = {}, maxAttempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = new AbortController();

            // Stop waiting if the server does not respond in time.
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 12000);

            let result;

            try {
                result = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            // Retry temporary server errors.
            if (result.status >= 500 && result.status <= 599) {
                throw new Error(
                    `Server error: HTTP ${result.status}`
                );
            }

            // Do not retry client errors such as HTTP 400 or 404.
            if (!result.ok) {
              if (result.status >= 400 && result.status < 500) {
                const error = new Error(
                  `Request failed: HTTP ${result.status}`
                );

                error.noRetry = true;
                throw error;
              }

              throw new Error(`Request failed: HTTP ${result.status}`);
            }

            return result;

        } catch (error) {
            lastError = error;

            if (error.noRetry) {
              throw error;
            }

            console.warn(
                `API request attempt ${attempt}/${maxAttempts} failed:`,
                error.message
            );

            if (attempt < maxAttempts) {
                const delay = 1000 * attempt;

                await new Promise(resolve =>
                    setTimeout(resolve, delay)
                );
            }
        }
    }

    throw lastError || new Error("API request failed");
}



    let allIncidents = [];

  const triggerButton = document.getElementById("triggerButton");
  const panicButton = document.getElementById("panicButton");
  const statusBadge = document.getElementById("statusBadge");
  const threatLevel = document.getElementById("threatLevel");
  const containment = document.getElementById("containment");

  // Create the incident history section without changing the
  // existing page layout or CSS.
  function createHistorySection() {
    if (document.getElementById("incidentHistory")) return;

    const section = document.createElement("section");
    section.id = "incidentHistory";
    section.className = "section";

    section.innerHTML = `
      <div class="container">
        <div class="section-title">
          <h2>Incident History</h2>
          <button class="btn btn-secondary" id="refreshHistoryButton"
                  type="button">
            Refresh History
          </button>
        </div>

        <p id="historyMessage"
           style="color: var(--muted); margin-bottom: 18px;"
           aria-live="polite">
          Loading incidents from AWS...
        </p>

      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;">

        <input
          id="incidentSearch"
          type="search"
          placeholder="Search by ID or description..."
          aria-label="Search incidents"
          style="flex: 1; min-width: 220px; padding: 12px; border-radius: 8px;
                border: 1px solid #334155; background: #0f172a; color: white;"
        />

        <select
          id="severityFilter"
          aria-label="Filter by severity"
          style="padding: 12px; border-radius: 8px;
                border: 1px solid #334155; background: #0f172a; color: white;"
        >
          <option value="All">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          id="statusFilter"
          aria-label="Filter by status"
          style="padding: 12px; border-radius: 8px;
                border: 1px solid #334155; background: #0f172a; color: white;"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Investigating">Investigating</option>
          <option value="Resolved">Resolved</option>
        </select>

        <button
          id="clearIncidentFilters"
          type="button"
          class="btn btn-secondary"
        >
          Clear Filters
        </button>

      </div>

<p id="filterResultMessage"
   style="color: var(--muted); margin-bottom: 12px;"
   aria-live="polite">
</p>


        <div class="panel"
             style="padding: 18px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;
                        text-align: left; min-width: 760px;">
            <thead>
              <tr style="color: var(--primary);
                         border-bottom: 1px solid var(--line);">
                <th style="padding: 12px;">Incident ID</th>
                <th style="padding: 12px;">Description</th>
                <th style="padding: 12px;">Severity</th>
                <th style="padding: 12px;">Status</th>
                <th style="padding: 12px;">Created At</th>
                <th style="padding: 12px;">Action</th>
              </tr>
            </thead>
            <tbody id="incidentHistoryBody">
              <tr>
                <td colspan="6" style="padding: 16px;">
                  Loading...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelector("main").appendChild(section);

    document
      .getElementById("refreshHistoryButton")
      .addEventListener("click", loadIncidentHistory);
  }

  // Safely create table cells so incident descriptions are treated
  // as text rather than HTML.
  function addCell(row, value) {
    const cell = document.createElement("td");
    cell.style.padding = "12px";
    cell.style.borderBottom = "1px solid var(--line)";
    cell.textContent = value ?? "—";
    row.appendChild(cell);
  }

  // Update the latest incident snapshot.
  function displayLatestIncident(incident) {
    if (!incident) return;

    document.getElementById("incidentId").textContent =
      incident.incidentId || "—";

    document.getElementById("incidentSeverity").textContent =
      incident.severity || "—";

    document.getElementById("incidentStatus").textContent =
      incident.status || "—";

    document.getElementById("incidentCreatedAt").textContent =
      incident.createdAt
        ? new Date(incident.createdAt).toLocaleString()
        : "—";

    threatLevel.textContent = incident.severity || "Unknown";
    containment.textContent =
      incident.remediationStatus || "Recorded";
  }

// Calculate and display live incident statistics.
function updateIncidentStatistics(incidents) {
  const total = incidents.length;

  const active = incidents.filter(
    incident => incident.status === "Active"
  ).length;

  const critical = incidents.filter(
    incident => incident.severity === "Critical"
  ).length;

  const resolved = incidents.filter(
    incident => incident.status === "Resolved"
  ).length;

  document.getElementById("totalIncidents").textContent = total;
  document.getElementById("activeIncidents").textContent = active;
  document.getElementById("criticalIncidents").textContent = critical;
  document.getElementById("resolvedIncidents").textContent = resolved;
}


function filterIncidentHistory() {
  const searchText =
    document.getElementById("incidentSearch").value.trim().toLowerCase();

  const severity =
    document.getElementById("severityFilter").value;

  const status =
    document.getElementById("statusFilter").value;

  const filteredIncidents = allIncidents.filter((incident) => {
    const matchesSearch =
      String(incident.incidentId || "").toLowerCase().includes(searchText) ||
      String(incident.description || "").toLowerCase().includes(searchText);

    const matchesSeverity =
      severity === "All" || incident.severity === severity;

    const matchesStatus =
      status === "All" || incident.status === status;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  renderIncidentRows(filteredIncidents);

  document.getElementById("filterResultMessage").textContent =
    `Showing ${filteredIncidents.length} of ${allIncidents.length} incident(s).`;
}


function renderIncidentRows(incidents) {
    const tableBody = document.getElementById("incidentHistoryBody");
    tableBody.replaceChildren();

    // Show a message if no incidents match the filters.
    if (incidents.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.style.padding = "16px";
        cell.style.textAlign = "center";
        cell.textContent = "No incidents match your search or filters.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    incidents.forEach((incident) => {
        const row = document.createElement("tr");

        addCell(row, incident.incidentId);
        addCell(row, incident.description);
        addCell(row, incident.severity);
        addCell(row, incident.status);

        addCell(
            row,
            incident.createdAt
                ? new Date(incident.createdAt).toLocaleString()
                : "—"
        );

        const actionCell = document.createElement("td");
        actionCell.style.padding = "12px";
        actionCell.style.borderBottom = "1px solid var(--line)";

        const statusSelect = document.createElement("select");

        statusSelect.style.padding = "8px";
        statusSelect.style.borderRadius = "8px";
        statusSelect.style.background = "#0f172a";
        statusSelect.style.color = "#ffffff";
        statusSelect.style.border = "1px solid #334155";

        ["Active", "Investigating", "Resolved"].forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });

        statusSelect.value = [
            "Active",
            "Investigating",
            "Resolved"
        ].includes(incident.status)
            ? incident.status
            : "Active";

        const updateButton = document.createElement("button");

        updateButton.type = "button";
        updateButton.textContent = "Update";
        updateButton.style.marginLeft = "8px";
        updateButton.style.padding = "8px 12px";
        updateButton.style.border = "none";
        updateButton.style.borderRadius = "8px";
        updateButton.style.cursor = "pointer";
        updateButton.style.fontWeight = "bold";

        updateButton.addEventListener("click", async () => {
            if (statusSelect.value === incident.status) {
                alert("Please select a different status first.");
                return;
            }

            updateButton.disabled = true;
            updateButton.textContent = "Updating...";

            try {
                await updateIncidentStatus(
                    incident.incidentId,
                    statusSelect.value
                );
            } finally {
                updateButton.disabled = false;
                updateButton.textContent = "Update";
            }
        });

        actionCell.appendChild(statusSelect);
        actionCell.appendChild(updateButton);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}



  // Retrieve saved incidents from the API Gateway GET endpoint.
async function loadIncidentHistory() {
const message = document.getElementById("historyMessage");
const tableBody = document.getElementById("incidentHistoryBody");

message.textContent = allIncidents.length > 0
? "Refreshing incident history..."
: "Loading incidents from AWS...";

try {
const response = await fetchWithRetry(
API_URL,
{
method: "GET",
headers: { "Accept": "application/json" }
},
3
);

const result = await response.json();

if (!response.ok) { 
  throw new Error( 
    result.error || result.message || `HTTP ${response.status}` ); 
}

const incidents = Array.isArray(result.incidents)
  ? result.incidents
  : [];

updateIncidentStatistics(incidents);

allIncidents = incidents;
filterIncidentHistory();

if (incidents.length === 0) {
  message.textContent = "No incidents have been recorded yet.";
  return;
}

message.textContent =
  `Successfully loaded ${incidents.length} incident(s) from AWS.`;

// The API returns the newest incidents first.
displayLatestIncident(incidents[0]);


} catch (error) {
console.error("Could not load incident history:", error);


message.textContent = allIncidents.length > 0
  ? "Unable to refresh incidents. Previously loaded records are still displayed."
  : "The incident service is temporarily unavailable. Please try again.";

// Keep previously loaded incidents visible if refreshing fails.
if (allIncidents.length === 0) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 6;
  cell.style.padding = "16px";
  cell.style.textAlign = "center";
  cell.textContent =
    "Unable to load incidents. Check your connection and try Refresh History.";

  row.appendChild(cell);
  tableBody.replaceChildren(row);
}


}
}



  // Create an incident using the existing POST endpoint.
async function activateEmergencyMode() {
triggerButton.disabled = true;
panicButton.disabled = true;

statusBadge.textContent = "Submitting incident...";
statusBadge.style.color = "#ffb703";
containment.textContent = "Submitting";
panicButton.textContent = "Submitting...";

const incident = {
incidentType: "Emergency",
description:
document.getElementById("incidentDescription").value.trim() ||
"Incident triggered from the dashboard",
severity:
document.getElementById("incidentSeverityInput").value,
timestamp: new Date().toISOString()
};

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
const response = await fetch(API_URL, {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(incident),
signal: controller.signal
});


const result = await response.json();

if (!response.ok) {
  throw new Error(
    result.error || result.message || `HTTP ${response.status}`
  );
}

if (!result.incident) {
  throw new Error("The API response did not contain an incident.");
}

displayLatestIncident(result.incident);

statusBadge.textContent = "Incident recorded successfully";
statusBadge.style.color = "#39d98a";
containment.textContent = "Incident recorded";
panicButton.textContent = "Incident submitted";

alert(
  "Incident recorded successfully!\n\nIncident ID: " +
  result.incident.incidentId
);

await loadIncidentHistory();


} catch (error) {
console.error("Incident submission failed:", error);


statusBadge.textContent = "Submission could not be confirmed";
statusBadge.style.color = "#ff4d4d";
containment.textContent = "Not confirmed";
panicButton.textContent = "Retry submission";

const errorMessage = error.name === "AbortError"
  ? "The request timed out."
  : error.message;

alert(
  "Could not confirm incident submission.\n\n" +
  errorMessage +
  "\n\nRefresh incident history before submitting again. " +
  "The incident may already have been recorded."
);


} finally {
clearTimeout(timeoutId);
triggerButton.disabled = false;
panicButton.disabled = false;

if (panicButton.textContent === "Submitting...") {
  panicButton.textContent = "Trigger emergency response";
}


}
}


  // Connect both buttons to the same incident-creation function.
  triggerButton.addEventListener("click", activateEmergencyMode);
  panicButton.addEventListener("click", activateEmergencyMode);

  // Load history as soon as the page opens.
  createHistorySection();
  loadIncidentHistory();

  // Automatically filter incidents when the user searches.
document
    .getElementById("incidentSearch")
    .addEventListener("input", filterIncidentHistory);

// Filter by severity.
document
    .getElementById("severityFilter")
    .addEventListener("change", filterIncidentHistory);

// Filter by status.
document
    .getElementById("statusFilter")
    .addEventListener("change", filterIncidentHistory);

// Clear all filters.
document
    .getElementById("clearIncidentFilters")
    .addEventListener("click", () => {
        document.getElementById("incidentSearch").value = "";
        document.getElementById("severityFilter").value = "All";
        document.getElementById("statusFilter").value = "All";

        filterIncidentHistory();
    });


async function updateIncidentStatus(incidentId, status) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(API_URL, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        incidentId: incidentId,
        status: status
      }),
      signal: controller.signal
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || result.message || `HTTP ${response.status}`
      );
    }

    alert("Incident status updated successfully!");

    await loadIncidentHistory();

  } catch (error) {
    console.error("Status update failed:", error);

    alert(
      "Could not confirm the status update.\n\n" +
      error.message +
      "\n\nRefresh incident history to check the current status."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
