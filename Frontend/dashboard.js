/* ============================= */
/* DASHBOARD HISTORY MODULE      */
/* ============================= */

const API_BASE = "https://emotion-analytics-api-992380089252.us-central1.run.app";

let allRecords = [];

/* ============================= */
/* NORMALIZE RECORD              */
/* ============================= */
// Ensures all fields exist with safe defaults,
// so both old-format and new-format API responses work.

function normalize(r) {
  const happy = r.happy ?? 0;
  const neutral = r.neutral ?? 0;
  const surprised = r.surprised ?? 0;
  const bored = r.bored ?? 0;
  const sad = r.sad ?? 0;
  const angry = r.angry ?? 0;
  const total = r.total_students ?? 0;
  const engaged = r.engaged ?? (happy + neutral + surprised);
  const not_engaged = r.not_engaged ?? (bored + sad + angry);

  return {
    id: r.id ?? null,
    total_students: total,
    happy,
    neutral,
    bored,
    sad,
    angry,
    surprised,
    engaged,
    not_engaged,
    engagement_percentage: r.engagement_percentage ?? (total > 0 ? Math.round((engaged / total) * 100) : 0),
    attention_score: r.attention_score ?? 0,
    dominant_emotion: r.dominant_emotion ?? findDominant({ happy, neutral, bored, sad, angry, surprised }),
    image_thumbnail: r.image_thumbnail ?? null,
    timestamp: r.timestamp ?? null,
  };
}

function findDominant(emotions) {
  let best = "none";
  let max = -1;
  for (const [key, val] of Object.entries(emotions)) {
    if (val > max) { max = val; best = key; }
  }
  return max > 0 ? best : "none";
}

/* ============================= */
/* LOAD DASHBOARD                */
/* ============================= */

async function loadDashboard() {
  const historyLoading = document.getElementById("historyLoading");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyGrid = document.getElementById("historyGrid");
  const refreshBtn = document.getElementById("refreshBtn");

  // Show loading
  historyLoading.classList.remove("hidden");
  historyEmpty.classList.add("hidden");
  historyGrid.classList.add("hidden");
  if (refreshBtn) refreshBtn.classList.add("spinning");

  try {
    const response = await fetch(`${API_BASE}/records`);
    const raw = await response.json();

    // Normalize every record
    const data = raw.map(normalize);
    allRecords = data;

    historyLoading.classList.add("hidden");
    if (refreshBtn) refreshBtn.classList.remove("spinning");

    if (!data.length) {
      historyEmpty.classList.remove("hidden");
      return;
    }

    // ─── Update Summary Stats (Latest Record) ───
    const latest = data[0]; // newest first from backend
    document.getElementById("total").innerText = latest.total_students;
    document.getElementById("engaged").innerText = latest.engaged;
    document.getElementById("notEngaged").innerText = latest.not_engaged;
    document.getElementById("engRate").innerText = latest.engagement_percentage + "%";

    // ─── Draw Trend Chart ───
    drawTrendChart(data);

    // ─── Build History Cards ───
    buildHistoryCards(data);

  } catch (err) {
    console.error("Dashboard error:", err);
    historyLoading.classList.add("hidden");
    if (refreshBtn) refreshBtn.classList.remove("spinning");
    historyEmpty.classList.remove("hidden");
    historyEmpty.querySelector("h3").innerText = "Failed to Load";
    historyEmpty.querySelector("p").innerText = "Could not connect to the server. Please try again.";
  }
}

/* ============================= */
/* TREND CHART                   */
/* ============================= */

let trendChart = null;

function drawTrendChart(data) {
  const ctx = document.getElementById("engagementChart").getContext("2d");

  // Reverse so oldest is on the left
  const chronological = [...data].reverse();

  const labels = chronological.map((r, i) => {
    if (r.timestamp) {
      const d = new Date(r.timestamp);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
        " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }
    return `Analysis #${i + 1}`;
  });

  const engData = chronological.map(r => r.engagement_percentage);

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Engagement %",
        data: engData,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#60a5fa",
        pointBorderColor: "#1e40af",
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { family: "Inter", size: 13 } }
        },
        tooltip: {
          backgroundColor: "rgba(7,27,47,0.95)",
          titleColor: "#60a5fa",
          bodyColor: "#ffffff",
          borderColor: "rgba(59,130,246,0.3)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => `Engagement: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { family: "Inter", size: 11 }, maxRotation: 45 },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: "#94a3b8", font: { family: "Inter", size: 12 }, callback: v => v + "%" },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });
}

/* ============================= */
/* HISTORY CARDS                 */
/* ============================= */

function buildHistoryCards(data) {
  const grid = document.getElementById("historyGrid");
  grid.innerHTML = "";
  grid.classList.remove("hidden");

  data.forEach((record, index) => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.style.animationDelay = `${index * 0.08}s`;

    // Emotion emoji map
    const emotionEmoji = {
      happy: "😊",
      neutral: "😐",
      bored: "😴",
      sad: "😢",
      angry: "😠",
      surprised: "😲",
      none: "—"
    };

    const dominantKey = record.dominant_emotion || "none";
    const dominantEmoji = emotionEmoji[dominantKey] || "—";
    const dominantLabel = dominantKey !== "none" ? dominantKey.charAt(0).toUpperCase() + dominantKey.slice(1) : "N/A";

    const engagementClass = record.engagement_percentage >= 70 ? "high" :
      record.engagement_percentage >= 40 ? "medium" : "low";

    // Format timestamp
    let timeStr = "—";
    if (record.timestamp) {
      const d = new Date(record.timestamp);
      if (!isNaN(d.getTime())) {
        timeStr = d.toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric"
        }) + " — " + d.toLocaleTimeString("en-IN", {
          hour: "2-digit", minute: "2-digit"
        });
      }
    }

    // Image or placeholder
    const hasImage = record.image_thumbnail && record.image_thumbnail.length > 100;
    const imageHTML = hasImage
      ? `<img src="data:image/jpeg;base64,${record.image_thumbnail}" alt="Classroom image #${index + 1}" class="history-thumb" loading="lazy">`
      : `<div class="history-thumb-placeholder">
           <span>📷</span>
           <p>No preview</p>
         </div>`;

    // Only show emotion row if we have emotion data
    const hasEmotions = record.happy > 0 || record.neutral > 0 || record.bored > 0 ||
                        record.sad > 0 || record.angry > 0 || record.surprised > 0;

    const emotionsHTML = hasEmotions ? `
        <div class="history-card-emotions">
          <div class="emotion-bar-row">
            <span>😊 ${record.happy}</span>
            <span>😐 ${record.neutral}</span>
            <span>😴 ${record.bored}</span>
            <span>😢 ${record.sad}</span>
            <span>😠 ${record.angry}</span>
            <span>😲 ${record.surprised}</span>
          </div>
        </div>` : `
        <div class="history-card-emotions">
          <div class="emotion-bar-row">
            <span>✅ Engaged: ${record.engaged}</span>
            <span>❌ Not Engaged: ${record.not_engaged}</span>
          </div>
        </div>`;

    card.innerHTML = `
      <div class="history-card-image">
        ${imageHTML}
        <div class="history-card-badge engagement-${engagementClass}">
          ${record.engagement_percentage}%
        </div>
      </div>
      <div class="history-card-body">
        <div class="history-card-time">🕒 ${timeStr}</div>
        <div class="history-card-stats">
          <div class="hc-stat">
            <span class="hc-stat-label">Students</span>
            <span class="hc-stat-value">${record.total_students}</span>
          </div>
          <div class="hc-stat">
            <span class="hc-stat-label">Engaged</span>
            <span class="hc-stat-value hc-success">${record.engaged}</span>
          </div>
          <div class="hc-stat">
            <span class="hc-stat-label">Not Engaged</span>
            <span class="hc-stat-value hc-danger">${record.not_engaged}</span>
          </div>
          <div class="hc-stat">
            <span class="hc-stat-label">Dominant</span>
            <span class="hc-stat-value">${dominantEmoji} ${dominantLabel}</span>
          </div>
        </div>
        ${emotionsHTML}
        ${hasImage ? `<button class="btn btn-outline btn-xs" onclick="openModal(${index})">🔍 View Details</button>` : ""}
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ============================= */
/* IMAGE DETAIL MODAL            */
/* ============================= */

function openModal(index) {
  const record = allRecords[index];
  if (!record) return;

  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const modalTitle = document.getElementById("modalTitle");
  const modalDetails = document.getElementById("modalDetails");

  if (record.image_thumbnail) {
    modalImage.src = `data:image/jpeg;base64,${record.image_thumbnail}`;
    modalImage.style.display = "block";
  } else {
    modalImage.style.display = "none";
  }

  let timeStr = "";
  if (record.timestamp) {
    const d = new Date(record.timestamp);
    if (!isNaN(d.getTime())) {
      timeStr = d.toLocaleString("en-IN");
    }
  }

  modalTitle.innerText = `Analysis${timeStr ? " — " + timeStr : ""}`;

  const engClass = record.engagement_percentage >= 70 ? "high" :
    record.engagement_percentage >= 40 ? "medium" : "low";

  const total = record.total_students || 1; // avoid division by zero

  modalDetails.innerHTML = `
    <div class="modal-stat-grid">
      <div class="modal-stat">
        <span class="modal-stat-label">Total Students</span>
        <span class="modal-stat-val">${record.total_students}</span>
      </div>
      <div class="modal-stat">
        <span class="modal-stat-label">Engagement</span>
        <span class="modal-stat-val engagement-${engClass}">${record.engagement_percentage}%</span>
      </div>
      <div class="modal-stat">
        <span class="modal-stat-label">Attention Score</span>
        <span class="modal-stat-val">${record.attention_score}</span>
      </div>
      <div class="modal-stat">
        <span class="modal-stat-label">Dominant Emotion</span>
        <span class="modal-stat-val">${record.dominant_emotion !== "none" ? record.dominant_emotion : "N/A"}</span>
      </div>
    </div>
    <div class="modal-emotions-detail">
      <h4>Emotion Breakdown</h4>
      <div class="modal-emotion-row"><span>😊 Happy</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.happy / total * 100)}%;background:#22c55e;"></div></div><span>${record.happy}</span></div>
      <div class="modal-emotion-row"><span>😐 Neutral</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.neutral / total * 100)}%;background:#3b82f6;"></div></div><span>${record.neutral}</span></div>
      <div class="modal-emotion-row"><span>😴 Bored</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.bored / total * 100)}%;background:#f59e0b;"></div></div><span>${record.bored}</span></div>
      <div class="modal-emotion-row"><span>😢 Sad</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.sad / total * 100)}%;background:#8b5cf6;"></div></div><span>${record.sad}</span></div>
      <div class="modal-emotion-row"><span>😠 Angry</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.angry / total * 100)}%;background:#ef4444;"></div></div><span>${record.angry}</span></div>
      <div class="modal-emotion-row"><span>😲 Surprised</span><div class="modal-bar"><div class="modal-bar-fill" style="width:${(record.surprised / total * 100)}%;background:#06b6d4;"></div></div><span>${record.surprised}</span></div>
    </div>
  `;

  modal.classList.add("active");
}

function closeModal() {
  document.getElementById("imageModal").classList.remove("active");
}

// Close modal on overlay click
document.getElementById("imageModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

// Close on Escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeModal();
});

/* ============================= */
/* INIT                          */
/* ============================= */

loadDashboard();
