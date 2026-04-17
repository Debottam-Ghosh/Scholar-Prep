export default async function handler(req, res) {
  try {
    const headers = {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    };

    const payload = { ...(req.body || {}) };

    const postCompletion = async (body) => {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return { response, data };
    };

    const listModels = async () => {
      const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers
      });
      const modelsData = await modelsRes.json();
      const ids = Array.isArray(modelsData?.data)
        ? modelsData.data.map((m) => m?.id).filter(Boolean)
        : [];
      return ids;
    };

    let { response, data } = await postCompletion(payload);

    const unsupported = response.status === 400 && data?.error?.code === "model_not_supported";
    if (unsupported) {
      const available = await listModels();

      if (available.length) {
        // Prefer common high-quality models when they exist, else use first available.
        const preferredOrder = [
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
          "gemma2-9b-it",
          "meta-llama/llama-4-maverick-17b-128e-instruct",
          "meta-llama/llama-4-scout-17b-16e-instruct",
          "deepseek-r1-distill-llama-70b"
        ];

        const supportedPreferred = preferredOrder.find((id) => available.includes(id));
        const fallbackModel = supportedPreferred || available[0];

        const retryPayload = { ...payload, model: fallbackModel };
        const retry = await postCompletion(retryPayload);
        response = retry.response;
        data = retry.data;
      }
    }

    res.status(response.status).json(data);

  } catch (err) {
    res.status(500).json({ error: "Groq chat failed" });
  }
}