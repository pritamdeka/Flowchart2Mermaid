document.addEventListener("DOMContentLoaded", () => {
  // === Pako Compressor for Mermaid.live ===
  function compressToPakoBase64(input) {
    const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
    const data = new TextEncoder().encode(json);
    const deflated = pako.deflate(data);
    const str = String.fromCharCode.apply(null, deflated);
    return btoa(str);
  }

  // === Globals ===
  let uploadedBase64Image = null;
  let uploadedFileName = "diagram";
  let selectedModel = "gpt-4.1";
  let deleteMode = false;
  const dragData = new Map();

  const modelSelector = document.getElementById("modelSelector");
  const convertButton = document.getElementById("convertButton");
  const mermaidTextarea = document.getElementById("mermaidCode");
  const renderTarget = document.getElementById("mermaidRenderTarget");
  const previewMessage = document.getElementById("previewMessage");
  const loadingOverlay = document.getElementById("loadingOverlay");

  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

  // === File Preview ===
  window.previewImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    uploadedFileName = file.name.split(".")[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64Image = e.target.result.split(",")[1];
      const preview = document.getElementById("imagePreview");
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      convertButton.disabled = false;
    };
    reader.readAsDataURL(file);
  };

  // === Generate Mermaid ===
  convertButton.addEventListener("click", generateMermaidCode);
  async function generateMermaidCode() {
    if (!uploadedBase64Image) return showMessage("Please upload an image first.");
    convertButton.disabled = true;
    loadingOverlay.classList.remove("hidden");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      mermaidTextarea.value = result.output?.trim() || "";
      renderDiagram();
    } catch (e) {
      showMessage("Error: " + e.message);
    } finally {
      loadingOverlay.classList.add("hidden");
      convertButton.disabled = false;
    }
  }

  // === Render Mermaid Diagram ===
  document.getElementById("updatePreview").addEventListener("click", renderDiagram);
  mermaidTextarea.addEventListener("input", debounce(renderDiagram, 500));

  async function renderDiagram() {
    const code = mermaidTextarea.value.trim();
    renderTarget.innerHTML = "";
    if (!code) return (previewMessage.textContent = "Enter code to preview.");

    try {
      const div = document.createElement("div");
      div.classList.add("mermaid");
      div.textContent = code;
      renderTarget.innerHTML = "";
      renderTarget.appendChild(div);
      await mermaid.run({ nodes: [div] });
      previewMessage.classList.add("hidden");
      enableInlineEditing();
      enableDrag();
    } catch {
      previewMessage.textContent = "Invalid Mermaid syntax.";
      previewMessage.classList.remove("hidden");
    }
  }

  // === Toolbar ===
  const toolbar = document.createElement("div");
  toolbar.className = "absolute top-2 right-2 flex gap-2 z-40";
  toolbar.innerHTML = `
    <button id="addNodeBtn" class="px-2 py-1 bg-green-500 text-white rounded">+ Node</button>
    <button id="deleteNodeBtn" class="px-2 py-1 bg-red-500 text-white rounded">− Node</button>
  `;
  document.querySelector("#diagramPreview").appendChild(toolbar);

  document.getElementById("addNodeBtn").onclick = () => {
    const id = prompt("Enter node ID:");
    const label = prompt("Enter node label:");
    const from = prompt("Connect FROM node ID (optional):");
    let code = mermaidTextarea.value.trim();
    if (!code.startsWith("graph") && !code.startsWith("flowchart")) code = "flowchart TD\n" + code;
    code += `\n${id}["${label}"]`;
    if (from) code += `\n${from} --> ${id}`;
    mermaidTextarea.value = code;
    renderDiagram();
  };

  document.getElementById("deleteNodeBtn").onclick = () => {
    deleteMode = !deleteMode;
    showMessage(deleteMode ? "🗑️ Delete mode ON" : "❌ Delete mode OFF");
  };

  // === Inline Editing ===
  function enableInlineEditing() {
    renderTarget.querySelectorAll("text").forEach((t) => {
      t.style.cursor = "pointer";
      t.onclick = (e) => {
        if (deleteMode) {
          deleteNode(t.textContent.trim());
          deleteMode = false;
          return;
        }
        const oldText = t.textContent.trim();
        const input = document.createElement("input");
        input.value = oldText;
        input.style.position = "fixed";
        input.style.left = e.clientX + "px";
        input.style.top = e.clientY + "px";
        document.body.appendChild(input);
        input.focus();
        input.onblur = () => {
          updateNodeText(oldText, input.value.trim());
          input.remove();
        };
      };
    });
  }

  function updateNodeText(oldText, newText) {
    const code = mermaidTextarea.value.replaceAll(oldText, newText);
    mermaidTextarea.value = code;
    renderDiagram();
  }

  function deleteNode(label) {
    let code = mermaidTextarea.value;
    const idMatch = code.match(new RegExp(`\\w+\\[["']?${label}["']?\\]`));
    if (!idMatch) return showMessage("Node not found.");
    const id = idMatch[0].split("[")[0];
    const pattern = new RegExp(`^.*${id}.*$`, "gm");
    mermaidTextarea.value = code.replace(pattern, "").trim();
    renderDiagram();
  }

  // === Drag Nodes ===
  function enableDrag() {
    const svg = renderTarget.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll("g.node").forEach((node) => {
      node.style.cursor = "move";
      let startX, startY, initX, initY, dragging = false;

      node.onmousedown = (e) => {
        dragging = true;
        const t = node.getAttribute("transform") || "translate(0,0)";
        const m = /translate\(([-0-9.]+),\s*([-0-9.]+)\)/.exec(t);
        initX = m ? parseFloat(m[1]) : 0;
        initY = m ? parseFloat(m[2]) : 0;
        startX = e.clientX;
        startY = e.clientY;
      };
      document.onmousemove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        node.setAttribute("transform", `translate(${initX + dx},${initY + dy})`);
      };
      document.onmouseup = () => (dragging = false);
    });
  }

  // === AI Assistant ===
  document.getElementById("runAiButton").addEventListener("click", async () => {
    const prompt = document.getElementById("aiPrompt").value.trim();
    const currentCode = mermaidTextarea.value.trim();
    if (!prompt) return showMessage("Enter a command for the AI Assistant.");
    if (!currentCode) return showMessage("No code to edit.");

    loadingOverlay.classList.remove("hidden");
    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currentCode }),
      });
      const data = await res.json();
      mermaidTextarea.value = data.updatedCode;
      renderDiagram();
      document.getElementById("aiPrompt").value = "";
      showMessage("✨ Updated by AI!");
    } catch (e) {
      showMessage("AI failed: " + e.message);
    } finally {
      loadingOverlay.classList.add("hidden");
    }
  });

  // === Utility ===
  function showMessage(msg) {
    const box = document.getElementById("messageBox");
    box.textContent = msg;
    box.classList.remove("hidden");
    setTimeout(() => box.classList.add("hidden"), 3000);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
});
