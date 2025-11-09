export default async function handler(req, res) {
  try {
    const { image, model } = req.body;
    const prompt = process.env.PROMPT_TEXT;

    if (!image || !model) {
      return res.status(400).json({ error: "Missing image or model." });
    }

    // ----------- GPT branch -----------
    if (model.startsWith("gpt-")) {
      const messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Convert this diagram image to valid Mermaid code." },
            { type: "image_url", image_url: `data:image/png;base64,${image}` },
          ],
        },
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0 }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenAI API error");

      const output = data.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ output });
    }

    // ----------- GEMINI branch -----------
    if (model.startsWith("gemini")) {
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: "Convert this diagram image to a clean Mermaid diagram." },
              { inlineData: { mimeType: "image/png", data: image } },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: prompt }] },
      };

      let attempt = 0;
      const maxRetries = 4;
      let backoff = 4;

      while (attempt < maxRetries) {
        attempt++;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        const data = await response.json();
        if (response.ok) {
          const output = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          return res.status(200).json({ output });
        }

        const errText = data?.error?.message || JSON.stringify(data);
        if (response.status === 429 || response.status === 503) {
          // retry with exponential backoff
          await new Promise((r) => setTimeout(r, backoff * 1000));
          backoff = Math.min(backoff * 2, 60);
          continue;
        }
        throw new Error(errText);
      }
      throw new Error("Gemini API failed after retries.");
    }

    return res.status(400).json({ error: "Unsupported model selected." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
