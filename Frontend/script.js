/* ============================= */
/* THEME TOGGLE */
/* ============================= */

function toggleTheme() {
  document.body.classList.toggle("light-mode");
}

/* ============================= */
/* DRAG & DROP UPLOAD */
/* ============================= */

const dropArea = document.getElementById("dropArea");
const input = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const resultCard = document.getElementById("resultCard");
const resultText = document.getElementById("result");

const API_BASE = "https://emotion-analytics-api-992380089252.us-central1.run.app";

if (dropArea) {

  function triggerFile() {
    input.click();
  }

  window.triggerFile = triggerFile;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }
  });

  dropArea.addEventListener("dragover", e => {
    e.preventDefault();
    dropArea.classList.add("dragging");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("dragging");
  });

  dropArea.addEventListener("drop", e => {
    e.preventDefault();
    dropArea.classList.remove("dragging");
    input.files = e.dataTransfer.files;

    if (input.files[0]) {
      preview.src = URL.createObjectURL(input.files[0]);
      preview.style.display = "block";
    }
  });
}

/* ============================= */
/* FADE-UP ANIMATION */
/* ============================= */

window.addEventListener("load", () => {
  document.querySelectorAll(".fade-up").forEach(el => {
    el.classList.add("show");
  });
});

/* ============================= */
/* HELPER: FILE → BASE64 */
/* ============================= */

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

/* ============================= */
/* CLOUD ANALYZE FUNCTION */
/* ============================= */

async function uploadImage() {
  if (!input.files || !input.files[0]) {
    alert("Please select an image first!");
    return;
  }

  resultCard.classList.remove("hidden");
  resultText.innerHTML = "🔄 Analyzing image...";

  try {
    const base64String = await toBase64(input.files[0]);

    const response = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: base64String })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "AI processing failed");
    }

    resultText.innerHTML = `
  <strong>Total Students:</strong> ${data.total_students} <br>
  😊 Happy: ${data.happy} <br>
  😐 Neutral: ${data.neutral} <br>
  😴 Bored: ${data.bored} <br>
  😢 Sad: ${data.sad} <br>
  😠 Angry: ${data.angry} <br>
  😲 Surprised: ${data.surprised} <br>
  <strong>Engagement Score:</strong> ${data.engagement_percentage}%
`;


  } catch (err) {
    console.error("Upload error:", err);

    resultText.innerHTML = `
      <span style="color:red;">
        ❌ ${err.message || "Network error. Please try again."}
      </span>
    `;
  }
}

window.uploadImage = uploadImage;






