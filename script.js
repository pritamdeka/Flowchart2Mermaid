let uploadedBase64Image = null;
let selectedModel = "gpt-4.1";

const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const renderTarget = document.getElementById("mermaidRenderTarget");
const previewMessage = document.getElementById("previewMessage");

// Reset state on model change
modelSelector.addEventListener("change", (e) => {
  selectedModel = e.target.value;
  uploadedBase64Image = null;

  // Reset UI
  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("imageInput").value = "";
  document.getElementById("results").classList.add("hidden");
  renderTarget.innerHTML = "";
  previewMessage.textContent = "Upload a new image for this model.";
  showMessage(`Model switched to ${selectedModel}.`);
});

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
    renderDiagram();
  } catch (err) {
    showMessage("Error: " + err.message);
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = "Generate Code";
  }
}

// Live re-render whenever user edits Mermaid code
mermaidTextarea?.addEventListener("input", debounce(renderDiagram, 500));

async function renderDiagram() {
  const code = mermaidTextarea.value.trim();
  renderTarget.innerHTML = "";
  if (!code) {
    previewMessage.textContent = "Enter Mermaid code to preview.";
    return;
  }
  try {
    const { svg } = await mermaid.render("graphDiv", code);
    renderTarget.innerHTML = svg;
    previewMessage.classList.add("hidden");
  } catch {
    previewMessage.textContent = "Invalid Mermaid syntax.";
  }
}

function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showMessage(text) {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}
