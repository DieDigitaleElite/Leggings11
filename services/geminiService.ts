
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { APP_CONFIG } from "../constants";

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

async function optimizeImage(base64: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas failure"));
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error("Bildverarbeitung fehlgeschlagen."));
  });
}

function getCleanBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("INVALID_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

export interface TryOnResult {
  image: string;
  size: string;
}

export async function performVirtualTryOn(userBase64: string, productBase64: string, productName: string): Promise<TryOnResult> {
  const [optUser, optProduct] = await Promise.all([
    optimizeImage(userBase64, 1024),
    optimizeImage(productBase64, 1024)
  ]);

  const ai = getAI();
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
          { inlineData: { data: getCleanBase64(optUser), mimeType: "image/jpeg" } },
          { inlineData: { data: getCleanBase64(optProduct), mimeType: "image/jpeg" } },
        ],
      },
      config: { 
        imageConfig: { aspectRatio: "3:4" },
        safetySettings: SAFETY_SETTINGS
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("Keine Antwort von der KI.");
    }

    const firstCandidate = candidates[0];
    if (firstCandidate.finishReason === 'SAFETY') {
      throw new Error("SAFETY_BLOCK");
    }

    const parts = firstCandidate.content?.parts || [];
    
    // Extract Size
    let recommendedSize = 'M';
    const textPart = parts.find(p => p.text);
    if (textPart?.text) {
      const sizeMatch = textPart.text.match(/\b(XS|S|M|L|XL|XXL)\b/i);
      if (sizeMatch) recommendedSize = sizeMatch[0].toUpperCase();
    }

    // Extract Image
    const imagePart = parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return {
        image: `data:image/jpeg;base64,${imagePart.inlineData.data}`,
        size: recommendedSize
      };
    }

    throw new Error("Kein Bild generiert.");
  } catch (err: any) {
    if (err.message === "SAFETY_BLOCK") {
      throw new Error("Bild aus Sicherheitsgründen abgelehnt.");
    }
    throw err;
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

export async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/jpeg', 0.9)); }
    };
    img.onerror = () => reject(new Error("Ladefehler"));
    img.src = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=1024&output=jpg`;
  });
}
