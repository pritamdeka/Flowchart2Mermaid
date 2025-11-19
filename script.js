/**
 * script.js for Flowchart to Mermaid Converter
 * This handles UI logic, image preview, and client-side utility functions.
 */

// ====================================================================
// === GLOBAL STATE & ELEMENTS (Needed for inline HTML calls) ===
// ====================================================================

let uploadedBase64Image = null;
let uploadedFileName = "diagram";
let selectedModel = "gpt-4.1";
let userApiKey = null; // Key is null until loaded/entered

// Get key DOM elements needed globally
const imagePreview = document.getElementById("imagePreview");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const loadingOverlay = document.getElementById("loadingOverlay");
const messageBox = document.getElementById("messageBox");

// ====================================================================
// === GLOBAL UTILITY FUNCTIONS ===
// ====================================================================

/**
 * Creates a URL for the Mermaid Live Editor by compressing the code.
 * @param {string} input The Mermaid code.
 * @returns {string} The base64 compressed string.
 */
function compressToPakoBase64(input) {
    const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
    const data = new TextEncoder().encode(json);
    const deflated = pako.deflate(data, { to: 'string' });
    // pako.deflate with {to: 'string'} outputs binary string which needs to be base64-encoded
    // We use btoa(String.fromCharCode.apply(null, deflated)) for robust binary string base64 encoding
    return btoa(String.fromCharCode.apply(null, deflated));
}


/**
 * Handles file selection, previews the image, and sets the base64 data.
 * Called directly from index.html's onchange attribute.
 */
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedFileName = file.name.split(".")[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedBase64Image = e.target.result.split(",")[1]; // Get only the base64 part
            imagePreview.src = e.target.result;
            imagePreview.classList.remove("hidden");
            
            if (convertButton) {
                convertButton.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }
}
// Make the function accessible to the HTML
window.previewImage = previewImage;


/**
 * Displays a temporary message box notification.
 * @param {string} text The message to display.
 */
function showMessage(text) {
    messageBox.textContent = text;
    messageBox.classList.remove("hidden");
    setTimeout(() => messageBox.classList.add("hidden"), 3000);
}


/**
 * Debounce utility to limit function calls.
 */
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}


// ====================================================================
// === DOMContentLoaded LOGIC (Main event handling) ===
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {

    // === DOM Elements (Defined again locally for DOMContentLoaded scope) ===
    const modelSelector = document.getElementById("modelSelector");
    const renderTarget = document.getElementById("mermaidRenderTarget");
    const previewMessage = document.getElementById("previewMessage");
    const diagramScrollBox = document.getElementById("diagramScrollBox");
    const aiPromptInput = document.getElementById("aiPrompt");


    // === Mermaid Init ===
    // Initializes Mermaid but prevents it from running automatically on page load
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });


    // === Model Selector ===
    modelSelector.addEventListener("change", (e) => {
        selectedModel = e.target.value;
        uploadedBase64Image = null;
        uploadedFileName = "diagram";
        document.getElementById("imageInput").value = "";
        document.getElementById("results").classList.add("hidden");
        renderTarget.innerHTML = "";
        previewMessage.textContent = "Upload a new image for this model.";
        imagePreview.classList.add("hidden");
        convertButton.disabled = true;
        showMessage(`Model switched to ${selectedModel}.`);
    });

    
    // === API Key Popup Modal ===
    async function promptForApiKey() {
        return new Promise((resolve) => {
            // Note: Removed the modal creation logic for brevity, 
            // assuming you have a way to prompt the user or handle the key input.
            // Placeholder: For now, it immediately resolves to null, you must fill this logic.
            
            // --- YOUR API KEY MODAL LOGIC GOES HERE ---
            
            // Example of a temporary prompt (replace with your modal):
            const key = prompt("Please paste your API key to continue:");
            if (key) {
                resolve(key.trim());
            } else {
                resolve(null);
            }
        });
    }

    // === Generate Mermaid Code (Core API Call Logic) ===
    convertButton.addEventListener("click", async () => {
        if (!uploadedBase64Image) return showMessage("Please upload an image first.");

        // 1. Prompt for API Key (if not already set)
        if (!userApiKey) {
            userApiKey = await promptForApiKey();
            if (!userApiKey) {
                showMessage("API key required to continue.");
                return;
            }
        }

        // 2. Quick Key Validation (client-side guess)
        if (selectedModel.startsWith("gpt-") && !userApiKey.startsWith("sk-")) {
            return showMessage("Invalid API key format for GPT models (expected 'sk-').");
        }
        
        // 3. Start Conversion
        generateMermaidCode();
    });

    async function generateMermaidCode() {
        if (!uploadedBase64Image || !userApiKey) {
            return showMessage("Please upload an image and provide the API key.");
        }

        convertButton.disabled = true;
        loadingOverlay.classList.remove("hidden");
        document.getElementById("results").classList.remove("hidden");
        mermaidTextarea.value = "";
        previewMessage.textContent = "Generating diagram...";
        previewMessage.classList.remove("hidden");
        renderTarget.innerHTML = '';


        try {
            // --- Placeholder for actual API call ---
            // The existing fetch call assumes a backend endpoint at /api/generate:
            
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel, apiKey: userApiKey }),
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            let code = result.output?.trim();
            if (!code) throw new Error("No Mermaid code returned.");
            
            // Basic cleanup: remove markdown fences if present
            code = code.replace(/```mermaid\n?|\n?```/g, '').trim(); 

            mermaidTextarea.value = code;
            renderDiagram();
            showMessage("Code generated successfully!");
        } catch (err) {
            showMessage("Error: " + err.message);
            // Fallback for demo/testing if API fails:
            // mermaidTextarea.value = "flowchart TD\nA[Start] --> B{Error Occurred};\nB --> C(End);";
            // renderDiagram();
        } finally {
            loadingOverlay.classList.add("hidden");
            convertButton.disabled = false;
        }
    }

    // === Render Diagram ===
    // Use debounce on input to avoid rendering on every single key stroke
    mermaidTextarea.addEventListener("input", debounce(renderDiagram, 600));

    async function renderDiagram() {
        const code = mermaidTextarea.value.trim();
        renderTarget.innerHTML = "";
        
        if (!code) {
            previewMessage.textContent = "Enter Mermaid code to preview.";
            previewMessage.classList.remove("hidden");
            return;
        }
        
        previewMessage.classList.add("hidden");

        try {
            // Use the standard Mermaid API run/render methods
            const { svg } = await mermaid.render('mermaidSvg', code);
            renderTarget.innerHTML = svg;

            // Scroll to top-left when rendering new diagram
            diagramScrollBox.scrollLeft = 0;
            diagramScrollBox.scrollTop = 0;
            
            // Note: Removed autoScaleDiagram and applyTransform for simplicity, 
            // you should re-add them if they contain zoom/pan logic.
            // enableInlineEditing() also requires additional complex code.
            
        } catch (e) {
            previewMessage.textContent = "Invalid Mermaid syntax. Check the console for details.";
            previewMessage.classList.remove("hidden");
            console.error("Mermaid Render Error:", e);
        }
    }


    // === Export and Share Functionality ===

    // 1. Download SVG
    document.getElementById('downloadSvg').addEventListener('click', () => {
        const svgElement = renderTarget.querySelector('svg');
        if (!svgElement) return showMessage("No diagram rendered to download.");

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = uploadedFileName + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage("SVG downloaded successfully.");
    });

    // 2. Download MMD
    document.getElementById('downloadMmd').addEventListener('click', () => {
        const code = mermaidTextarea.value;
        if (!code) return showMessage("No Mermaid code to save.");
        
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = uploadedFileName + '.mmd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(".MMD file saved successfully.");
    });
    
    // 3. Open in Mermaid Live Editor (Uses pako compression)
    document.getElementById('openEditorButton').addEventListener('click', () => {
        const code = mermaidTextarea.value;
        if (!code) return showMessage("No Mermaid code to open.");

        try {
            // Use the compression function defined globally
            const compressed = compressToPakoBase64(code);
            const liveUrl = `https://mermaid.live/edit#${compressed}`;
            window.open(liveUrl, '_blank');
        } catch (error) {
            showMessage("Error creating Live Editor URL.");
            console.error("Compression error:", error);
        }
    });

    // === ZOOM Controls (Placeholder setup) ===
    document.getElementById('zoomInBtn').addEventListener('click', () => showMessage('Zoom functionality needs full implementation.'));
    document.getElementById('zoomOutBtn').addEventListener('click', () => showMessage('Zoom functionality needs full implementation.'));
    document.getElementById('zoomResetBtn').addEventListener('click', () => showMessage('Reset zoom functionality needs full implementation.'));
    document.getElementById('zoomFitBtn').addEventListener('click', () => showMessage('Fit zoom functionality needs full implementation.'));

    // === AI Assistant (Placeholder setup) ===
    document.getElementById('runAiButton').addEventListener('click', () => {
        const prompt = aiPromptInput.value;
        if (!prompt) return showMessage("Please enter a modification for the AI.");
        
        showMessage(`AI request sent: "${prompt}". Logic needs to be implemented.`);
        aiPromptInput.value = '';
    });
    
    // Initial state setup (if needed)
    convertButton.disabled = true;
});