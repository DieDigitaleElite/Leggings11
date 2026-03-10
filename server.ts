import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_CONFIG = {
  IMAGE_MODEL: 'gemini-2.5-flash-image',
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // API Route for Virtual Try-On
  app.post("/api/tryon", async (req, res) => {
    const { userImage, productImage, productName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured on server." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const response = await ai.models.generateContent({
        model: APP_CONFIG.IMAGE_MODEL,
        contents: {
          parts: [
            { text: `VIRTUAL TRY-ON & SIZE ESTIMATION TASK:
            - IMAGE 1: The person to be dressed.
            - IMAGE 2: The target outfit (${productName}).
            
            YOUR MISSION:
            1. SIZE: Analyze the person's body in IMAGE 1 and determine the best size (XS, S, M, L, XL, XXL) for the product in IMAGE 2.
            2. IMAGE: Generate a new image where the person from IMAGE 1 is wearing the EXACT clothing from IMAGE 2.
            
            REQUIREMENTS:
            - Replace clothes in IMAGE 1 with IMAGE 2.
            - Keep person's face, hair, and background identical.
            - Return the size as text and the result as an image part.` },
            { inlineData: { data: userImage.replace(/^data:[^;]+;base64,/, ""), mimeType: "image/jpeg" } },
            { inlineData: { data: productImage.replace(/^data:[^;]+;base64,/, ""), mimeType: "image/jpeg" } },
          ],
        },
        config: { 
          imageConfig: { aspectRatio: "3:4" },
          safetySettings: SAFETY_SETTINGS
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        return res.status(500).json({ error: "No candidates from AI." });
      }

      const firstCandidate = candidates[0];
      if (firstCandidate.finishReason === 'SAFETY') {
        return res.status(400).json({ error: "SAFETY_BLOCK" });
      }

      const parts = firstCandidate.content?.parts || [];
      
      let recommendedSize = 'M';
      const textPart = parts.find(p => p.text);
      if (textPart?.text) {
        const sizeMatch = textPart.text.match(/\b(XS|S|M|L|XL|XXL)\b/i);
        if (sizeMatch) recommendedSize = sizeMatch[0].toUpperCase();
      }

      const imagePart = parts.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
        return res.json({
          image: `data:image/jpeg;base64,${imagePart.inlineData.data}`,
          size: recommendedSize
        });
      }

      return res.status(500).json({ error: "No image generated." });
    } catch (err: any) {
      console.error("Server AI Error:", err);
      return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
