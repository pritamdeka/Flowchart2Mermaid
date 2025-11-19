// generate.js (Example using a framework like Next.js or similar serverless function)

export default async function handler(req, res) {
    // Note: process.env.PROMPT_TEXT must be set in your environment
    const prompt = process.env.PROMPT_TEXT;

    try {
        const { image, model, apiKey } = req.body;

        if (!image || !model) {
            return res.status(400).json({ error: "Missing image or model." });
        }

        if (!apiKey) {
            return res.status(400).json({ error: "Missing API key." });
        }

        // ------------------------------------
        // ===== 🚀 GPT MODELS (OpenAI) =====
        // ------------------------------------
        if (model.startsWith("gpt-")) {
            if (!apiKey.startsWith("sk-")) {
                return res.status(400).json({ error: "Invalid API key for GPT models (expected 'sk-')." });
            }

            const messages = [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Convert this diagram image to valid Mermaid code. Only output the code itself, do not include any explanatory text." },
                        // The base64 image data must be prepended with the data URL scheme (data:image/<format>;base64,)
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
                    ],
                },
            ];

            const r = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Use the user-provided API key from the frontend
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: 2000,
                    temperature: 0,
                }),
            });

            const d = await r.json();
            if (!r.ok) throw new Error(d.error?.message || "OpenAI API error");

            // Extract the content and trim any surrounding markdown
            const output = d.choices?.[0]?.message?.content?.trim() || "";
            const cleanedOutput = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

            return res.status(200).json({ output: cleanedOutput });
        }

        // ------------------------------------
        // ===== ♊ GEMINI MODELS (Google) =====
        // ------------------------------------
        if (model.startsWith("gemini")) {
            if (apiKey.startsWith("sk-")) {
                return res.status(400).json({ error: "Invalid API key for Gemini models (API key should not start with 'sk-')." });
            }
            
            // The image type is likely unknown to the server, so we default to jpeg or try to infer from client logic.
            // Using 'image/jpeg' or 'image/png' is usually safest for general flowcharts.
            const mimeType = "image/jpeg"; 

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            // System prompt is combined with the user's primary request text
                            { text: `${prompt}\n\nConvert this diagram image to valid Mermaid code. Only output the code itself, do not include any explanatory text.` },
                            // The image is passed as inlineData (base64 string)
                            { inlineData: { mimeType: mimeType, data: image } },
                        ],
                    },
                ],
                // Add generation config for temperature/max_tokens if desired
                config: {
                    temperature: 0,
                    maxOutputTokens: 2000,
                },
            };

            // FIX: Use the correct, simplified Gemini API endpoint path
            // The model is interpolated directly into the path
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const r = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const d = await r.json();
            
            // Handle specific Gemini error structure
            if (!r.ok || d.error) {
                const errorMessage = d.error?.message || d.error || "Gemini API error";
                throw new Error(errorMessage);
            }

            let output = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            // Clean up surrounding markdown fences from the output
            output = output.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

            return res.status(200).json({ output });
        }

        // ------------------------------------
        // ===== 🛑 UNSUPPORTED MODEL =====
        // ------------------------------------
        res.status(400).json({ error: "Unsupported model selected." });
    } catch (err) {
        console.error("Error in handler:", err);
        // Ensure error message is user-friendly and doesn't leak secrets
        res.status(500).json({ error: err.message.includes('API') ? err.message : "An unexpected server error occurred." });
    }
}