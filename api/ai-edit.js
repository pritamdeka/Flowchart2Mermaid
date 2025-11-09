export default async function handler(req, res) {
  try {
    const { prompt, currentCode } = req.body;
    if (!prompt || !currentCode)
      return res.status(400).json({ error: "Missing prompt or currentCode." });

    const systemPrompt = `
You are an expert Mermaid.js editor.
You take existing Mermaid code and modify it based on the user’s natural language instruction.
Always return ONLY valid Mermaid code — no commentary, markdown fences, or explanations.
Start directly with the Mermaid syntax (e.g., 'flowchart TD').
`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current Mermaid code:\n${currentCode}\n\nUser request:\n${prompt}\n\nReturn only updated Mermaid code:`,
      },
    ];

    // --- OpenAI GPT-4.1 API ---
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "OpenAI API error");

    let updatedCode = d.choices?.[0]?.message?.content?.trim() || "";
    updatedCode = updatedCode.replace(/```mermaid\s*/gi, "").replace(/```/g, "").trim();

    return res.status(200).json({ updatedCode });
  } catch (err) {
    console.error("Error in AI edit handler:", err);
    res.status(500).json({ error: err.message });
  }
}
