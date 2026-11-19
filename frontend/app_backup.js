const API = "http://127.0.0.1:8000";
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
