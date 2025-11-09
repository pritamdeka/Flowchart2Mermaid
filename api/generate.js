export default async function handler(req, res) {
  try {
    const { image, model } = req.body;
    const prompt = process.env.PROMPT_TEXT;

    if (model.startsWith("gpt-")) {
      // --- OpenAI models ---
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
        body: JSON.stringify({ model, messages }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenAI API error");
      return res.status(200).json({ output: data.choices?.[0]?.message?.content || "" });
    }

    if (model.startsWith("gemini")) {
      // --- Gemini models ---
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: "Convert the diagram image into a Mermaid diagram." },
              { inlineData: { mimeType: "image/png", data: image } },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: prompt }] },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gemini API error");
      const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ output });
    }

    res.status(400).json({ error: "Unsupported model selected." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
