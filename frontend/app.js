const API = "http://" + "127.0.0.1" + ":8000";
const $ = id => document.getElementById(id);
function setMetric(name, value, suffix="%") {
  $(name).textContent = `${value}${suffix}`;
  const bar = $(`${name}-bar`);
  if (bar) bar.style.width = `${Math.min(100, Number(value))}%`;
}
async function request(path, options={}) {
  const response = await fetch(`${API}${path}`, {headers:{"Content-Type":"application/json"}, ...options});
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}
function renderAnalysis(data) {
  setMetric("cpu", data.cpu); setMetric("memory", data.memory); setMetric("disk", data.disk);
  $("latency").textContent = data.latency_ms;
  $("risk").textContent = data.risk_score;
  $("health").textContent = data.status;
  $("health").className = `pill ${data.status}`;
  $("signals").innerHTML = (data.signals.length ? data.signals : ["No abnormal signals detected."]).map(x=>`<li>${x}</li>`).join("");
  $("recommendations").innerHTML = (data.recommendations.length ? data.recommendations : ["Continue monitoring; no action required."]).map(x=>`<li>${x}</li>`).join("");
}
async function refresh() {
  try {
    const data = await request("/api/metrics");
    renderAnalysis(data);
    await loadEvents();
    await loadAgents();
  } catch(e) { $("health").textContent = "API offline"; $("heal-result").textContent = e.message; }
}
async function loadProviders() {
  const providers = await request("/api/providers");
  $("providers").innerHTML = providers.map(p=>`<div class="provider"><b>${p.name}</b><small>● ${p.connection}</small></div>`).join("");
}
async function loadEvents() {
  const events = await request("/api/events");
  $("events").innerHTML = events.length ? events.slice(0,8).map(e=>`<div class="event"><span>${e.type || "event"} · ${e.status || e.action || e.service || ""}</span><span>${new Date(e.timestamp).toLocaleTimeString()}</span></div>`).join("") : "No events yet.";
}
$("refresh").addEventListener("click", refresh);
$("heal").addEventListener("click", async()=>{
  $("heal-result").textContent = "Submitting request…";
  try {
    const result = await request("/api/heal", {method:"POST", body:JSON.stringify({action:$("action").value, approved:$("approval").checked})});
    $("heal-result").textContent = result.message;
    await loadEvents();
  } catch(e) {$("heal-result").textContent=e.message;}
});
loadProviders().then(refresh).catch(e=>$("heal-result").textContent=e.message);
setInterval(refresh, 10000);


function setAgentStatus(id, status) {
  const element = $(id);
  element.textContent = status;
  element.className = "pill " + String(status).toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

async function loadAgents() {
  const endpoints = [
    { key: "monitor", path: "/api/monitoring/agent" },
    { key: "prediction", path: "/api/prediction/anomaly" },
    { key: "security", path: "/api/agents/security" },
    { key: "healing", path: "/api/agents/healing" }
  ];

  const results = await Promise.allSettled(
    endpoints.map(item => request(item.path))
  );

  results.forEach((result, index) => {
    const key = endpoints[index].key;

    if (result.status === "rejected") {
      setAgentStatus(key + "-status", "Offline");
      $(key + "-details").textContent = result.reason.message;
      return;
    }

    const data = result.value;

    if (key === "monitor") {
      const m = data.metrics;

      // Synchronize overview metrics with Monitor Agent
      setMetric("cpu", m.cpu_usage);
      setMetric("memory", m.memory_usage);
      setMetric("disk", m.disk_usage);

      setAgentStatus("monitor-status", data.status);
      $("monitor-details").textContent =
        `CPU: ${m.cpu_usage}% | Memory: ${m.memory_usage}% | Disk: ${m.disk_usage}% | Alerts: ${data.alerts.length}`;
    }

    if (key === "prediction") {
      setAgentStatus("prediction-status", data.status);
      $("prediction-details").textContent =
        `${data.prediction} | Anomaly score: ${data.anomaly_score} | Model: ${data.model}`;
      $("prediction-note").textContent =
        `Model: ${data.model} | Training samples: ${data.training_samples} | Anomaly score is a model output, not proof of failure.`;
    }

    if (key === "security") {
      setAgentStatus("security-status", data.status);
      $("security-details").textContent =
        `Security findings: ${data.total_issues}`;
      const findingsList = $("security-findings");
      findingsList.replaceChildren();

      if (data.findings.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No possible hardcoded secrets detected.";
        findingsList.appendChild(item);
      } else {
        data.findings.forEach(finding => {
          const item = document.createElement("li");
          item.textContent = `${finding.file} | Line ${finding.line} | ${finding.issue}`;
          findingsList.appendChild(item);
        });
      }
    }

    if (key === "healing") {
      setAgentStatus("healing-status", data.system_status);
      $("healing-details").textContent =
        `Mode: ${data.remediation.mode} | ${data.remediation.actions.join(", ")} | Executed: ${data.remediation.executed}`;
    }
  });
}

// Manual refresh for all four AI agents
const agentRefreshButton = $("refresh-agents");

if (agentRefreshButton) {
  agentRefreshButton.addEventListener("click", async () => {
    agentRefreshButton.disabled = true;
    agentRefreshButton.textContent = "Refreshing...";

    try {
      await loadAgents();
    } finally {
      agentRefreshButton.disabled = false;
      agentRefreshButton.textContent = "Refresh Agents ↻";
    }
  });
}


// Historical Metrics Charts
function drawHistoryChart(canvasId, rows, field, maxValue) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const width = canvas.clientWidth || 300;
  const height = 190;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const values = rows.map(row => Number(row[field]));
  if (values.length < 2) {
    ctx.fillStyle = "#91a3bf";
    ctx.fillText("Not enough historical samples", 12, 30);
    return;
  }

  const left = 35, right = 12, top = 12, bottom = 25;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  ctx.font = "10px sans-serif";
  ctx.strokeStyle = "#263b59";
  ctx.fillStyle = "#91a3bf";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = top + chartHeight * i / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(maxValue * (4-i) / 4)), 3, y + 3);
  }

  ctx.strokeStyle = "#45a5ff";
  ctx.lineWidth = 2;
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = left + chartWidth * index / (values.length - 1);
    const y = top + chartHeight * (1 - Math.max(0, Math.min(value, maxValue)) / maxValue);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
  ctx.fillStyle = "#91a3bf";
  ctx.fillText("Oldest", left, height - 5);
  ctx.fillText("Latest", width - 48, height - 5);
}

async function loadHistory() {
  const message = document.getElementById("history-message");
  const count = document.getElementById("history-count");

  try {
    const rows = await request("/api/history/metrics");

    if (!Array.isArray(rows) || rows.length === 0) {
      message.textContent = "No historical metric samples available yet.";
      count.textContent = "0 Samples";
      return;
    }

    const range = Number(document.getElementById("history-range")?.value || 100);
    const selectedRows = rows.slice(-range);

    drawHistoryChart("cpu-history", selectedRows, "cpu", 100);
    drawHistoryChart("memory-history", selectedRows, "memory", 100);
    drawHistoryChart("disk-history", selectedRows, "disk", 100);

    count.textContent = selectedRows.length + " Samples";
    message.textContent =
      "Showing the latest " + selectedRows.length +
      " recorded simulated infrastructure samples.";
  } catch (error) {
    message.textContent = "Could not load history: " + error.message;
    count.textContent = "Unavailable";
  }
}

document.getElementById("history-range")?.addEventListener("change", loadHistory);

loadHistory();
setInterval(loadHistory, 30000);

window.addEventListener("resize", loadHistory);



// Real Mac System Metrics History

async function loadRealSystemHistory() {
  const message = document.getElementById("real-history-message");

  try {
    const [rows, summary] = await Promise.all([
      request("/api/monitoring/history"),
      request("/api/monitoring/history/summary")
    ]);

    if (!Array.isArray(rows) || rows.length === 0) {
      message.textContent = "No real system samples available yet.";
      return;
    }

    const selectedRows = rows.slice(-100);

    drawHistoryChart("real-cpu-history", selectedRows, "cpu_usage", 100);
    drawHistoryChart("real-memory-history", selectedRows, "memory_usage", 100);
    drawHistoryChart("real-disk-history", selectedRows, "disk_usage", 100);

    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent =
        value === null || value === undefined ? "--" : value + "%";
    };

    setValue("real-avg-cpu", summary.cpu_usage?.average);
    setValue("real-avg-memory", summary.memory_usage?.average);
    setValue("real-avg-disk", summary.disk_usage?.average);

    const sampleCount = document.getElementById("real-sample-count");
    if (sampleCount) sampleCount.textContent = summary.total_samples ?? rows.length;

    message.textContent =
      "Showing " + selectedRows.length +
      " real system samples from this Mac.";
  } catch (error) {
    message.textContent = "Could not load real system history: " + error.message;
  }
}

document.getElementById("refresh-real-history")
  ?.addEventListener("click", loadRealSystemHistory);

loadRealSystemHistory();
setInterval(loadRealSystemHistory, 30000);

window.addEventListener("resize", loadRealSystemHistory);

// Historical Summary and Anomaly Insights
async function loadHistoryInsights() {
  const anomalyBox = document.getElementById("history-anomalies");

  try {
    const [summary, anomalies] = await Promise.all([
      request("/api/history/summary"),
      request("/api/history/anomalies")
    ]);

    document.getElementById("avg-cpu").textContent =
      summary.cpu ? summary.cpu.average + "%" : "--";
    document.getElementById("avg-memory").textContent =
      summary.memory ? summary.memory.average + "%" : "--";
    document.getElementById("avg-disk").textContent =
      summary.disk ? summary.disk.average + "%" : "--";
    document.getElementById("avg-latency").textContent =
      summary.latency_ms ? summary.latency_ms.average + " ms" : "--";

    const anomalyRecords = Array.isArray(anomalies) ? anomalies : [];
    const warningCount = anomalyRecords.filter(
      item => String(item.status).toLowerCase() === "warning"
    ).length;
    const criticalCount = anomalyRecords.filter(
      item => String(item.status).toLowerCase() === "critical"
    ).length;

    document.getElementById("anomaly-total").textContent = anomalyRecords.length;
    document.getElementById("anomaly-warning").textContent = warningCount;
    document.getElementById("anomaly-critical").textContent = criticalCount;

    anomalyBox.replaceChildren();

    if (anomalyRecords.length === 0) {
      anomalyBox.textContent = "No warning or critical events recorded.";
      return;
    }

    anomalyRecords.slice().reverse().slice(0, 10).forEach(event => {
      const row = document.createElement("div");
      row.className = "anomaly-row";

      const details = document.createElement("div");
      const status = document.createElement("strong");
      status.className = "anomaly-status " +
        String(event.status || "").toLowerCase();
      status.textContent = event.status || "Unknown";

      const metrics = document.createElement("small");
      metrics.textContent =
        "CPU: " + (event.cpu ?? "--") + "% | " +
        "Memory: " + (event.memory ?? "--") + "% | " +
        "Disk: " + (event.disk ?? "--") + "% | " +
        "Latency: " + (event.latency_ms ?? "--") + " ms";

      details.append(status, metrics);

      const time = document.createElement("small");
      time.textContent = event.timestamp
        ? new Date(event.timestamp).toLocaleString()
        : "Time unavailable";

      row.append(details, time);
      anomalyBox.appendChild(row);
    });
  } catch (error) {
    anomalyBox.textContent = "Unable to load historical insights: " + error.message;
  }
}

loadHistoryInsights();
setInterval(loadHistoryInsights, 30000);


// Export Historical Metrics as CSV
const exportHistoryButton = document.getElementById("export-history");

if (exportHistoryButton) {
  exportHistoryButton.addEventListener("click", async () => {
    const originalText = exportHistoryButton.textContent;
    exportHistoryButton.disabled = true;
    exportHistoryButton.textContent = "Preparing CSV...";

    try {
      const rows = await request("/api/history/metrics");

      if (!Array.isArray(rows) || rows.length === 0) {
        alert("No historical metrics available to export.");
        return;
      }

      const columns = [
        "timestamp", "provider", "service",
        "cpu", "memory", "disk",
        "latency_ms", "risk_score", "status"
      ];

      const escapeCSV = value => {
        const text = value == null ? "" : String(value);
        return '"' + text.replace(/"/g, '""') + '"';
      };

      const csv = [
        columns.join(","),
        ...rows.map(row =>
          columns.map(column => escapeCSV(row[column])).join(",")
        )
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cloudpilot-historical-metrics.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      exportHistoryButton.textContent = "CSV Exported ✓";
    } catch (error) {
      alert("CSV export failed: " + error.message);
    } finally {
      exportHistoryButton.disabled = false;
      if (exportHistoryButton.textContent === "Preparing CSV...") {
        exportHistoryButton.textContent = originalText;
      }
    }
  });
}



// Real System Alerts Dashboard

async function loadRealSystemAlerts() {
  const statusElement = document.getElementById("real-alert-status");
  const countElement = document.getElementById("real-alert-count");
  const alertList = document.getElementById("real-alert-list");

  try {
    // Collect fresh Mac system metrics before checking alerts
    await request("/api/monitoring/system");

    const data = await request("/api/monitoring/alerts");

    statusElement.textContent =
      data.status === "healthy" ? "All Systems Healthy" : data.status;

    countElement.textContent = data.total_alerts ?? 0;
    alertList.replaceChildren();

    if (!Array.isArray(data.alerts) || data.alerts.length === 0) {
      const message = document.createElement("p");
      message.textContent =
        "No warning or critical alerts detected. Last checked: " +
        new Date(data.timestamp).toLocaleTimeString();
      alertList.appendChild(message);
      return;
    }

    data.alerts.forEach(alert => {
      const row = document.createElement("div");
      row.className = "anomaly-row";

      const details = document.createElement("div");

      const severity = document.createElement("strong");
      severity.className = "anomaly-status " +
        String(alert.severity || "").toLowerCase();
      severity.textContent = String(alert.severity || "Alert").toUpperCase();

      const description = document.createElement("small");
      description.textContent = alert.message || "System threshold exceeded";

      details.append(severity, description);

      const value = document.createElement("strong");
      value.textContent = (alert.value ?? "--") + "%";

      row.append(details, value);
      alertList.appendChild(row);
    });

  } catch (error) {
    statusElement.textContent = "Unavailable";
    alertList.textContent = "Unable to load alerts: " + error.message;
  }
}

const refreshAlertsButton = document.getElementById("refresh-real-alerts");

refreshAlertsButton?.addEventListener("click", async () => {
  refreshAlertsButton.disabled = true;
  refreshAlertsButton.textContent = "Refreshing...";

  try {
    await loadRealSystemAlerts();
  } finally {
    refreshAlertsButton.disabled = false;
    refreshAlertsButton.textContent = "Refresh Alerts ↻";
  }
});

loadRealSystemAlerts();
setInterval(loadRealSystemAlerts, 30000);


// Alert Simulation Lab

async function runAlertSimulation(level) {
  const status = document.getElementById("simulation-status");
  const count = document.getElementById("simulation-count");
  const metricsBox = document.getElementById("simulation-metrics");
  const alertBox = document.getElementById("simulation-alert-list");
  const message = document.getElementById("simulation-message");

  const buttons = document.querySelectorAll("[data-simulation-level]");

  buttons.forEach(button => {
    button.disabled = true;
  });

  status.textContent = "Running...";
  message.textContent = "Running " + level + " simulation...";

  try {
    const data = await request(
      "/api/monitoring/alerts/simulate?level=" + encodeURIComponent(level)
    );

    if (data.status === "error") {
      throw new Error(data.message);
    }

    status.textContent =
      data.status === "healthy" ? "Healthy" : "Alert Detected";

    count.textContent = data.total_alerts;

    metricsBox.replaceChildren();

    Object.entries(data.simulated_metrics || {}).forEach(([name, value]) => {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const metric = document.createElement("strong");

      label.textContent = name.replace("_usage", "").toUpperCase();
      metric.textContent = value + "%";

      card.append(label, metric);
      metricsBox.appendChild(card);
    });

    alertBox.replaceChildren();

    if (!data.alerts || data.alerts.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No alerts detected. System is healthy.";
      alertBox.appendChild(empty);
    } else {
      data.alerts.forEach(alert => {
        const row = document.createElement("div");
        row.className = "anomaly-row";

        const details = document.createElement("div");
        const severity = document.createElement("strong");
        const description = document.createElement("small");
        const value = document.createElement("strong");

        severity.className =
          "anomaly-status " + String(alert.severity).toLowerCase();
        severity.textContent = String(alert.severity).toUpperCase();
        description.textContent = alert.message;
        value.textContent = alert.value + "%";

        details.append(severity, description);
        row.append(details, value);
        alertBox.appendChild(row);
      });
    }

    message.textContent =
      "Scenario: " + data.scenario +
      " | Simulation only — real Mac metrics are unchanged.";

  } catch (error) {
    status.textContent = "Failed";
    count.textContent = "--";
    message.textContent = "Simulation error: " + error.message;
  } finally {
    buttons.forEach(button => {
      button.disabled = false;
    });
  }
}

document.querySelectorAll("[data-simulation-level]").forEach(button => {
  button.addEventListener("click", () => {
    runAlertSimulation(button.dataset.simulationLevel);
  });
});

// Alert History Dashboard

let alertHistoryData = [];

function renderAlertHistory() {
  const list = document.getElementById("alert-history-list");
  const search = document.getElementById("alert-history-search");
  const filter = document.getElementById("alert-history-filter");

  if (!list || !search || !filter) return;

  const query = search.value.trim().toLowerCase();
  const selectedFilter = filter.value;

  const filtered = alertHistoryData.filter(event => {
    const alerts = event.alerts || [];

    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "healthy" && alerts.length === 0) ||
      alerts.some(alert => alert.severity === selectedFilter);

    const searchableText = [
      event.scenario,
      event.status,
      event.management_status,
      event.timestamp,
      ...alerts.map(alert =>
        [alert.metric, alert.severity, alert.message, alert.value].join(" ")
      )
    ].join(" ").toLowerCase();

    return matchesFilter && searchableText.includes(query);
  });

  list.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No matching alert events found.";
    list.appendChild(empty);
  } else {
    filtered.forEach(event => {
      const row = document.createElement("div");
      row.className = "anomaly-row";

      const details = document.createElement("div");
      const title = document.createElement("strong");
      const description = document.createElement("small");
      const badge = document.createElement("span");

      const managementStatus = event.management_status || "new";

      title.textContent =
        String(event.scenario || "Unknown").toUpperCase() +
        " — " + (event.total_alerts || 0) + " alerts";

      badge.className = "anomaly-status " + managementStatus;
      badge.textContent = managementStatus.toUpperCase();

      const alertDetails = (event.alerts || []).map(alert =>
        alert.metric + ": " + alert.value + "% (" + alert.severity + ")"
      ).join(", ");

      description.textContent =
        (event.timestamp || "Time unavailable") +
        " | " + (alertDetails || "No alerts detected");

      details.append(title, badge, description);
      row.appendChild(details);

      if ((event.alerts || []).length > 0 &&
          managementStatus !== "resolved") {

        const actions = document.createElement("div");

        if (managementStatus === "new") {
          actions.appendChild(
            createAlertActionButton("Acknowledge", "acknowledge", event.timestamp)
          );
        }

        actions.appendChild(
          createAlertActionButton("Resolve", "resolve", event.timestamp)
        );

        row.appendChild(actions);
      }

      list.appendChild(row);
    });
  }

  document.getElementById("alert-history-message").textContent =
    "Showing " + filtered.length + " of " +
    alertHistoryData.length + " recorded events.";
}

function createAlertActionButton(label, action, timestamp) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = label;

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      const url =
        "/api/monitoring/alerts/" + action +
        "?timestamp=" + encodeURIComponent(timestamp);

      await request(url, { method: "POST" });
      await loadAlertHistory();
    } catch (error) {
      alert("Unable to update alert: " + error.message);
      button.disabled = false;
    }
  });

  return button;
}

async function loadAlertHistory() {
  const total = document.getElementById("history-alert-count");
  const critical = document.getElementById("history-critical-count");
  const warning = document.getElementById("history-warning-count");
  const message = document.getElementById("alert-history-message");

  if (!total || !critical || !warning || !message) return;

  try {
    alertHistoryData = await request("/api/monitoring/alerts/history");

    total.textContent = alertHistoryData.length;

    critical.textContent = alertHistoryData.filter(event =>
      (event.alerts || []).some(alert => alert.severity === "critical")
    ).length;

    warning.textContent = alertHistoryData.filter(event =>
      (event.alerts || []).some(alert => alert.severity === "warning")
    ).length;

    const newCount = document.getElementById("history-new-count");
    const acknowledgedCount = document.getElementById("history-acknowledged-count");
    const resolvedCount = document.getElementById("history-resolved-count");

    if (newCount) {
      newCount.textContent = alertHistoryData.filter(
        event => (event.management_status || "new") === "new"
      ).length;
    }

    if (acknowledgedCount) {
      acknowledgedCount.textContent = alertHistoryData.filter(
        event => event.management_status === "acknowledged"
      ).length;
    }

    if (resolvedCount) {
      resolvedCount.textContent = alertHistoryData.filter(
        event => event.management_status === "resolved"
      ).length;
    }

    renderAlertHistory();
  } catch (error) {
    message.textContent = "Unable to load history: " + error.message;
  }
}

const historyRefreshButton =
  document.getElementById("refresh-alert-history");

if (historyRefreshButton) {
  historyRefreshButton.addEventListener("click", loadAlertHistory);
}

const historySearch =
  document.getElementById("alert-history-search");

const historyFilter =
  document.getElementById("alert-history-filter");

if (historySearch) {
  historySearch.addEventListener("input", renderAlertHistory);
}

if (historyFilter) {
  historyFilter.addEventListener("change", renderAlertHistory);
}

// Export Alert History as CSV

function exportAlertHistoryCSV() {
  if (!alertHistoryData.length) {
    alert("No alert history available to export.");
    return;
  }

  const headers = [
    "Timestamp",
    "Scenario",
    "Management Status",
    "Total Alerts",
    "Metric",
    "Value",
    "Severity",
    "Message"
  ];

  const escapeCSV = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const rows = [headers];

  alertHistoryData.forEach(event => {
    if (!event.alerts || event.alerts.length === 0) {
      rows.push([
        event.timestamp,
        event.scenario,
        event.management_status,
        event.total_alerts,
        "",
        "",
        "",
        "No alerts detected"
      ]);
    } else {
      event.alerts.forEach(alert => {
        rows.push([
          event.timestamp,
          event.scenario,
          event.management_status,
          event.total_alerts,
          alert.metric,
          alert.value,
          alert.severity,
          alert.message
        ]);
      });
    }
  });

  const csv = rows.map(row =>
    row.map(escapeCSV).join(",")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cloudpilot-alert-history.csv";
  link.click();

  URL.revokeObjectURL(url);
}

const exportAlertHistoryButton =
  document.getElementById("export-alert-history");

if (exportAlertHistoryButton) {
  exportAlertHistoryButton.addEventListener(
    "click",
    exportAlertHistoryCSV
  );
}

loadAlertHistory();



// Alert Analytics Charts

function drawAlertAnalyticsChart(canvasId, labels, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const width = canvas.clientWidth || 300;
  const height = 220;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const left = 35;
  const right = 12;
  const top = 20;
  const bottom = 42;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const maxValue = Math.max(...values, 1);

  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "#91a3bf";
  ctx.strokeStyle = "#263b59";

  for (let i = 0; i <= 4; i++) {
    const y = top + chartHeight * i / 4;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.fillText(
      String(Math.ceil(maxValue * (4 - i) / 4)),
      left - 7,
      y + 4
    );
  }

  const slotWidth = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.min(slotWidth * 0.55, 48);
  const colors = ["#ff657a", "#fbbf24", "#45a5ff"];

  labels.forEach((label, index) => {
    const barHeight = values[index] / maxValue * chartHeight;
    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
    const y = top + chartHeight - barHeight;

    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#e5edff";
    ctx.textAlign = "center";
    ctx.fillText(String(values[index]), x + barWidth / 2, y - 7);

    ctx.fillStyle = "#91a3bf";
    ctx.fillText(label, x + barWidth / 2, height - 15);
  });
}

async function loadAlertAnalytics() {
  const message = document.getElementById("alert-analytics-message");
  if (!message) return;

  try {
    const events = await request("/api/monitoring/alerts/history");

    const alerts = events.flatMap(event =>
      Array.isArray(event.alerts) ? event.alerts : []
    );

    const criticalCount = alerts.filter(
      alert => alert.severity === "critical"
    ).length;

    const warningCount = alerts.filter(
      alert => alert.severity === "warning"
    ).length;

    const cpuCount = alerts.filter(
      alert => alert.metric === "cpu_usage"
    ).length;

    const memoryCount = alerts.filter(
      alert => alert.metric === "memory_usage"
    ).length;

    const diskCount = alerts.filter(
      alert => alert.metric === "disk_usage"
    ).length;

    drawAlertAnalyticsChart(
      "alert-severity-chart",
      ["Critical", "Warning"],
      [criticalCount, warningCount]
    );

    drawAlertAnalyticsChart(
      "alert-metric-chart",
      ["CPU", "Memory", "Disk"],
      [cpuCount, memoryCount, diskCount]
    );

    message.textContent =
      "Analyzed " + events.length +
      " recorded events and " + alerts.length + " alerts.";

  } catch (error) {
    message.textContent =
      "Unable to load alert analytics: " + error.message;
  }
}

const alertAnalyticsRefreshButton =
  document.getElementById("refresh-alert-analytics");

if (alertAnalyticsRefreshButton) {
  alertAnalyticsRefreshButton.addEventListener(
    "click",
    loadAlertAnalytics
  );
}

loadAlertAnalytics();


// Notification Center

async function loadNotifications() {
  const list = document.getElementById("notification-list");
  const total = document.getElementById("notification-total");
  const unread = document.getElementById("notification-unread");
  const badge = document.getElementById("notification-unread-count");
  const message = document.getElementById("notification-message");

  if (!list || !total || !unread || !badge || !message) return;

  try {
    const data = await request("/api/notifications");
    const notifications = data.notifications || [];
    const severityFilter = document.getElementById("notification-severity-filter");
    const selectedSeverity = severityFilter ? severityFilter.value : "all";

    const filteredNotifications = selectedSeverity === "all"
      ? notifications
      : notifications.filter(n => n.severity === selectedSeverity);

    total.textContent = data.total;
    unread.textContent = data.unread;
    badge.textContent = data.unread + " Unread";

    list.innerHTML = "";

    if (!notifications.length) {
      list.textContent = "No notifications available.";
    }

    filteredNotifications.forEach(notification => {
      const card = document.createElement("article");
      card.className = "anomaly-row";

      const heading = document.createElement("strong");
      heading.textContent = notification.title;

      const details = document.createElement("p");
      details.textContent = notification.message;

      const meta = document.createElement("small");
      meta.textContent =
        notification.severity.toUpperCase() +
        " | " +
        new Date(notification.created_at).toLocaleString() +
        " | " +
        (notification.read ? "READ" : "UNREAD");

      card.append(heading, details, meta);

      if (!notification.read) {
        const button = document.createElement("button");
        button.className = "secondary";
        button.textContent = "Mark as Read";

        button.addEventListener("click", async () => {
          button.disabled = true;

          try {
            await request(
              "/api/notifications/" + encodeURIComponent(notification.id) + "/read",
              { method: "POST" }
            );
            await loadNotifications();

} catch (error) {
            alert("Unable to update notification: " + error.message);
            button.disabled = false;
          }
        });

        card.appendChild(button);
      }

      list.appendChild(card);
    });

    message.textContent = "Notification history loaded successfully.";

  } catch (error) {
    message.textContent =
      "Unable to load notifications: " + error.message;
  }
}

const notificationSeverityFilter =
  document.getElementById("notification-severity-filter");

if (notificationSeverityFilter) {
  notificationSeverityFilter.addEventListener("change", loadNotifications);
  console.log("Notification severity filter connected.");
}

const notificationRefreshButton =
  document.getElementById("refresh-notifications");

if (notificationRefreshButton) {
  notificationRefreshButton.onclick = async function () {
    console.log("REFRESH BUTTON CLICKED");
    await loadNotifications();
  };
  console.log("REFRESH BUTTON CONNECTED");
} else {
  console.error("REFRESH BUTTON NOT FOUND");
}

loadNotifications();


// CLOUDPILOT_REMOTE_DEVICES

let cloudPilotDashboardToken = "";
async function loadRemoteDevices() {
  const list = document.getElementById("remote-devices-list");
  if (!list) return;

  try {
    if (!cloudPilotDashboardToken) {
      list.textContent = "Enter your dashboard token to connect.";
      return;
    }

    const apiResponse = await fetch(`${API}/api/devices`, {
      headers: {
        "Authorization": `Bearer ${cloudPilotDashboardToken}`
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`API error ${apiResponse.status}`);
    }

    const response = await apiResponse.json();
    list.replaceChildren();

    if (!response.length) {
      list.textContent = "No connected devices yet.";
      return;
    }

    response.forEach(device => {
      const card = document.createElement("div");
      card.className = "provider";

      const title = document.createElement("b");
      title.textContent = device.device_name;

      const details = document.createElement("p");
      details.textContent =
        `CPU: ${device.cpu_usage}% | RAM: ${device.memory_usage}% | Disk: ${device.disk_usage}%`;

      const time = document.createElement("small");
      time.textContent = "Last update: " +
        new Date(device.timestamp).toLocaleString();

      card.append(title, details, time);
      list.appendChild(card);
    });
  } catch (error) {
    list.textContent = "Unable to load devices: " + error.message;
  }
}

const dashboardConnectButton =
  document.getElementById("connect-dashboard");

if (dashboardConnectButton) {
  dashboardConnectButton.onclick = () => {
    cloudPilotDashboardToken =
      document.getElementById("dashboard-token").value.trim();

    loadRemoteDevices();
    loadPendingEnrollments();
  };
}

const remoteDeviceRefreshButton =
  document.getElementById("refresh-devices");

if (remoteDeviceRefreshButton) {
  remoteDeviceRefreshButton.onclick = loadRemoteDevices;
}

loadRemoteDevices();
setInterval(loadRemoteDevices, 10000);
setInterval(loadPendingEnrollments, 10000);

// CLOUDPILOT_DEVICE_APPROVALS

async function loadPendingEnrollments() {
  const list = document.getElementById("enrollment-requests-list");
  if (!list) return;

  if (!cloudPilotDashboardToken) {
    list.textContent = "Connect your dashboard token to view pending requests.";
    return;
  }

  try {
    const response = await fetch(`${API}/api/devices/enrollment/requests`, {
      headers: {
        "Authorization": `Bearer ${cloudPilotDashboardToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const requests = await response.json();
    list.replaceChildren();

    if (!requests.length) {
      list.textContent = "No pending registration requests.";
      return;
    }

    requests.forEach(request => {
      const card = document.createElement("div");
      card.className = "provider";

      const title = document.createElement("b");
      title.textContent = request.device_name;

      const details = document.createElement("p");
      details.textContent =
        `Request ID: ${request.request_id} | Requested: ${new Date(request.requested_at).toLocaleString()}`;

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;";

      const approve = document.createElement("button");
      approve.className = "secondary";
      approve.textContent = "Approve";

      const reject = document.createElement("button");
      reject.className = "secondary";
      reject.textContent = "Reject";

      approve.onclick = async () => {
        approve.disabled = true;
        reject.disabled = true;
        approve.textContent = "Approving...";

        try {
          const result = await fetch(
            `${API}/api/devices/enrollment/${encodeURIComponent(request.request_id)}/approve`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cloudPilotDashboardToken}`
              }
            }
          );

          const data = await result.json();
          if (!result.ok) {
            throw new Error(data.detail || `API error ${result.status}`);
          }

          card.replaceChildren();

          const approvedTitle = document.createElement("b");
          approvedTitle.textContent = `${data.device_name} — Approved`;

          const approvedDeviceId = document.createElement("p");
          approvedDeviceId.textContent = `Device ID: ${data.device_id}`;

          const tokenLabel = document.createElement("p");
          tokenLabel.textContent =
            "One-time device token (copy and provide securely to the device owner):";

          const tokenValue = document.createElement("textarea");
          tokenValue.readOnly = true;
          tokenValue.value = data.device_token || "";
          tokenValue.rows = 3;
          tokenValue.style.cssText =
            "width:100%;margin-top:8px;overflow-wrap:anywhere;";

          const warning = document.createElement("small");
          warning.textContent =
            "This token is shown only in this approval response. Store it securely; do not share it publicly.";

          card.append(approvedTitle);

          const tokenResult = document.getElementById("enrollment-token-result");
          if (!tokenResult) {
            throw new Error("Persistent token display area not found.");
          }

          tokenResult.replaceChildren();

          const resultTitle = document.createElement("h3");
          resultTitle.textContent = "Approved Device — Save This Token";

          const deviceId = document.createElement("p");
          deviceId.textContent = `Device ID: ${data.device_id}`;

          const persistentTokenLabel = document.createElement("p");
          persistentTokenLabel.textContent = "One-time device token — save securely:";

          const persistentTokenValue = document.createElement("textarea");
          persistentTokenValue.readOnly = true;
          persistentTokenValue.value = data.device_token || "";
          persistentTokenValue.rows = 3;
          persistentTokenValue.style.cssText = "width:100%;margin-top:8px;overflow-wrap:anywhere;";

          const copyButton = document.createElement("button");
          copyButton.type = "button";
          copyButton.className = "secondary";
          copyButton.textContent = "Copy Device Token";
          copyButton.onclick = async () => {
            try {
              await navigator.clipboard.writeText(persistentTokenValue.value);
              copyButton.textContent = "Copied";
            } catch (error) {
              persistentTokenValue.focus();
              persistentTokenValue.select();
              copyButton.textContent = "Press Cmd+C to copy";
            }
          };

          const persistentWarning = document.createElement("small");
          persistentWarning.textContent = "Save this token securely. It is shown only once by the approval response. Do not share it publicly.";

          tokenResult.append(resultTitle, approvedDeviceId, persistentTokenLabel, persistentTokenValue, copyButton, persistentWarning);
          loadRemoteDevices();
        } catch (error) {
          approve.disabled = false;
          reject.disabled = false;
          approve.textContent = "Approve";
          alert("Approval failed: " + error.message);
        }
      };

      reject.onclick = async () => {
        if (!confirm(`Reject registration from ${request.device_name}?`)) return;

        approve.disabled = true;
        reject.disabled = true;
        reject.textContent = "Rejecting...";

        try {
          const result = await fetch(
            `${API}/api/devices/enrollment/${encodeURIComponent(request.request_id)}/reject`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cloudPilotDashboardToken}`
              }
            }
          );

          const data = await result.json();
          if (!result.ok) {
            throw new Error(data.detail || `API error ${result.status}`);
          }

          card.textContent = `${request.device_name} — Rejected`;
        } catch (error) {
          approve.disabled = false;
          reject.disabled = false;
          reject.textContent = "Reject";
          alert("Rejection failed: " + error.message);
        }
      };

      actions.append(approve, reject);
      card.append(title, details, actions);
      list.appendChild(card);
    });
  } catch (error) {
    list.textContent = "Unable to load requests: " + error.message;
  }
}

const enrollmentRefreshButton =
  document.getElementById("refresh-enrollments");

if (enrollmentRefreshButton) {
  enrollmentRefreshButton.onclick = loadPendingEnrollments;
}

// CLOUDPILOT_DEVICE_APPROVALS_END

// CLOUDPILOT_REMOTE_DEVICES_END

