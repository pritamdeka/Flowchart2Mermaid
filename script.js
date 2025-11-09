document.addEventListener("DOMContentLoaded", () => {
  // === Compression utility for Mermaid.live ===
  function compressToPakoBase64(input) {
    const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
    const data = new TextEncoder().encode(json);
    const deflated = pako.deflate(data);
    const str = String.fromCharCode.apply(null, deflated);
    return btoa(str);
  }

  // === Global Variables ===
  let uploadedBase64Image = null;
  let uploadedFileName = "diagram";
  let selectedModel = "gpt-4.1";

  // === DOM Elements ===
  const modelSelector = document.getElementById("modelSelector");
  const convertButton = document.getElementById("convertButton");
  const mermaidTextarea = document.getElementById("mermaidCode");
  const renderTarget = document.getElementById("mermaidRenderTarget");
  const previewMessage = document.getElementById("previewMessage");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const downloadSvgBtn = document.getElementById("downloadSvg");
  const downloadMmdBtn = document.getElementById("downloadMmd");
  const updatePreviewBtn = document.getElementById("updatePreview");
  const openEditorBtn = document.getElementById("openEditorButton");

  // === Mermaid Init ===
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

  // === Debug check ===
  console.log("✅ JS loaded, buttons found:", {
    downloadSvg: !!downloadSvgBtn,
    downloadMmd: !!downloadMmdBtn,
    convert: !!convertButton,
  });

  // === Model change handler ===
  modelSelector.addEventListener("change", (e) => {
    selectedModel = e.target.value;
    uploadedBase64Image = null;
    uploadedFileName = "diagram";
    document.getElementById("imagePreview").classList.add("hidden");
    document.getElementById("imageInput").value = "";
    document.getElementById("results").classList.add("hidden");
    renderTarget.innerHTML = "";
    previewMessage.textContent = "Upload a new image for this model.";
    showMessage(`Model switched to ${selectedModel}.`);
  });

  // === File name cleaner ===
  function cleanFileName(name) {
    name = name.split(".")[0];
    name = name.replace(/[_\-\s]*\d{2,5}x\d{2,5}[_\-\s]*/gi, "");
    name = name.replace(/[^a-zA-Z0-9_\-]/g, "_");
    if (name.length > 30) name = name.substring(0, 30);
    return name || "diagram";
  }

  // === Image Preview ===
  window.previewImage = function (event) {
    const file = event.target.files[0];
    const preview = document.getElementById("imagePreview");
    if (file) {
      uploadedFileName = cleanFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedBase64Image = e.target.result.split(",")[1];
        preview.src = e.target.result;
        preview.classList.remove("hidden");
        convertButton.disabled = false;
      };
      reader.readAsDataURL(file);
    }
  };

  // === Generate Mermaid Code ===
  convertButton.addEventListener("click", generateMermaidCode);

  async function generateMermaidCode() {
    if (!uploadedBase64Image)
      return showMessage("Please upload an image first.");
    convertButton.disabled = true;
    loadingOverlay.classList.remove("hidden");
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
      loadingOverlay.classList.add("hidden");
      convertButton.disabled = false;
    }
  }

  // === Render Mermaid Diagram ===
  updatePreviewBtn.addEventListener("click", renderDiagram);
  mermaidTextarea.addEventListener("input", debounce(renderDiagram, 600));

  async function renderDiagram() {
    const code = mermaidTextarea.value.trim();
    renderTarget.innerHTML = "";
    if (!code) {
      previewMessage.textContent = "Enter Mermaid code to preview.";
      previewMessage.classList.remove("hidden");
      return;
    }
    try {
      const tempDiv = document.createElement("div");
      tempDiv.classList.add("mermaid");
      tempDiv.textContent = code;
      renderTarget.innerHTML = "";
      renderTarget.appendChild(tempDiv);
      await mermaid.run({ nodes: [tempDiv] });
      previewMessage.classList.add("hidden");
    } catch {
      previewMessage.textContent = "Invalid Mermaid syntax.";
      previewMessage.classList.remove("hidden");
    }
  }

  // === Open in Mermaid Live Editor ===
  openEditorBtn.addEventListener("click", async () => {
    const code = mermaidTextarea.value.trim();
    if (!code) return showMessage("No Mermaid code to edit yet!");
    try {
      await navigator.clipboard.writeText(code);
      const compressed = compressToPakoBase64(code);
      const editorUrl = `https://mermaid.live/edit#pako:${compressed}`;
      window.open(editorUrl, "_blank");
      showMessage("Code copied! Opening Mermaid Live Editor...");
    } catch (err) {
      showMessage("Could not open editor or copy code.");
      console.error(err);
    }
  });

  // === Download SVG ===
  downloadSvgBtn.addEventListener("click", () => {
    const svg = renderTarget.querySelector("svg");
    if (!svg) return showMessage("No diagram to download.");
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${uploadedFileName}.svg`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 500);
    showMessage(`✅ Saved ${uploadedFileName}.svg`);
  });

  // === Download .MMD file (fully fixed) ===
  downloadMmdBtn.addEventListener("click", () => {
    const code = mermaidTextarea.value.trim();
    if (!code) {
      showMessage("No Mermaid code to save.");
      return;
    }
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${uploadedFileName || "diagram"}.mmd`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
      link.remove();
    }, 1000);
    showMessage(`✅ Saved ${uploadedFileName}.mmd`);
  });

  // === Helpers ===
  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function showMessage(text) {
    const box = document.getElementById("messageBox");
    box.textContent = text;
    box.classList.remove("hidden");
    setTimeout(() => box.classList.add("hidden"), 3000);
  }
});
