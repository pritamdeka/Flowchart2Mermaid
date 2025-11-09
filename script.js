let uploadedBase64Image = null;
let selectedModel = "gpt-4.1";

const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const renderTarget = document.getElementById("mermaidRenderTarget");
const previewMessage = document.getElementById("previewMessage");

// Ensure Mermaid starts clean
mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

/* -----------------------------
   MODEL CHANGE RESET
------------------------------ */
modelSelector.addEventListener("change", (e) => {
  selectedModel = e.target.value;
  uploadedBase64Image = null;

  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("imageInput").value = "";
  document.getElementById("results").classList.add("hidden");
  renderTarget.innerHTML = "";
  previewMessage.textContent = "Upload a new image for this model.";
  showMessage(`Model switched to ${selectedModel}.`);
});

/* -----------------------------
   IMAGE PREVIEW
------------------------------ */
function previewImage(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("imagePreview");
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64Image = e.target.result.split(",")[1];
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      convertButton.disabled = false;
    };
    reader.readAsDataURL(file);
  }
}

/* -----------------------------
   GENERATE MERMAID CODE
------------------------------ */
async function generateMermaidCode() {
  if (!uploadedBase64Image) return showMessage("Please upload an image first.");
  convertButton.disabled = true;
  convertButton.textContent = "Processing...";
  document.getElementById("results").classList.remove("hidden");
  mermaidTextarea.value = "";
  previewMessage.textContent = "Generating diagram...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);

    const code = result.output?.trim();
    if (!code) throw new Error("No Mermaid code returned.");
    mermaidTextarea.value = code;
    renderDiagram(); // auto-render
  } catch (err) {
    showMessage("Error: " + err.message);
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = "Generate Code";
  }
}

/* -----------------------------
   RENDER DIAGRAM
------------------------------ */
async function renderDiagram() {
  const code = mermaidTextarea.value.trim();
  renderTarget.innerHTML = ""; // clear old diagram

  if (!code) {
    previewMessage.textContent = "Enter Mermaid code to preview.";
    previewMessage.classList.remove("hidden");
    return;
  }

  try {
    // Create a temporary div for rendering
    const tempDiv = document.createElement("div");
    tempDiv.classList.add("mermaid");
    tempDiv.textContent = code;

    renderTarget.innerHTML = ""; // clear again
    renderTarget.appendChild(tempDiv);

    // Force Mermaid to process the new content
    await mermaid.run({ nodes: [tempDiv] });

    previewMessage.classList.add("hidden");
  } catch (err) {
    console.error(err);
    previewMessage.textContent = "Invalid Mermaid syntax.";
    previewMessage.classList.remove("hidden");
  }
}

/* -----------------------------
   LIVE EDIT (debounced)
------------------------------ */
mermaidTextarea?.addEventListener("input", debounce(renderDiagram, 600));

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/* -----------------------------
   UTILITIES
------------------------------ */
function showMessage(text) {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}
