
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

export async function estimateSizeFromImage(userBase64: string, productName: string): Promise<string> {
  try {
    const optimized = await optimizeImage(userBase64, 800);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: APP_CONFIG.TEXT_MODEL,
      contents: {
        parts: [
          { inlineData: { data: getCleanBase64(optimized), mimeType: "image/jpeg" } },
          { text: `You are a professional fashion fit expert. Analyze the person's body type in the image and suggest the best clothing size (XS, S, M, L, XL, XXL) for the product "${productName}". Return ONLY the size code (e.g., "M").` },
        ],
      },
      config: {
        safetySettings: SAFETY_SETTINGS
      }
    });
    const size = response.text?.trim().toUpperCase() || 'M';
    const valid = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return valid.find(s => size.includes(s)) || 'M';
  } catch (err) {
    console.error("Size estimation error:", err);
    return 'M'; // Fallback
  }
}

export async function performVirtualTryOn(userBase64: string, productBase64: string, productName: string): Promise<string> {
  const [optUser, optProduct] = await Promise.all([
    optimizeImage(userBase64, 1024),
    optimizeImage(productBase64, 1024)
  ]);

  const isSwimwear = productName.toLowerCase().includes('badeanzug') || productName.toLowerCase().includes('bikini') || productName.toLowerCase().includes('swim');
  
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: APP_CONFIG.IMAGE_MODEL,
      contents: {
        parts: [
          { text: `STRICT FASHION VIRTUAL TRY-ON - NO HALLUCINATIONS ALLOWED:
          1. TARGET: Person in IMAGE 1.
          2. SOURCE OUTFIT: Exact garment(s) shown in IMAGE 2 (${productName}).
          
          CRITICAL RULES:
          - IDENTICAL DESIGN: You must apply the EXACT design, cut, and garment type from IMAGE 2. 
          - SLEEVE REPLACEMENT: Replace the original sleeves from IMAGE 1 with the exact sleeve style from IMAGE 2. If IMAGE 2 is sleeveless or has different sleeves, you MUST modify the person's arms/shoulders to match IMAGE 2 perfectly.
          - NO STYLE CHANGES: If IMAGE 2 shows leggings, the result MUST be leggings. If IMAGE 2 shows a one-piece swimsuit, the result MUST be a one-piece swimsuit. DO NOT add skirts, ruffles, or change the silhouette.
          - COMPLETE DRESSING: The person must be fully dressed in the COMPLETE set from IMAGE 2 (e.g., both top and bottom if it's a set).
          - PIXEL PERFECT COLORS: Use the exact colors and patterns from IMAGE 2.
          - PRESERVE PERSON: Keep the face, hair, skin tone, pose, and background of the person in IMAGE 1 100% identical.
          - NO CROPPING: Do not crop the image. Keep the full frame of IMAGE 1.
          - REALISM: The fabric must wrap naturally around the body contours of the person in IMAGE 1.` },
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
      throw new Error("Die KI hat keine Antwort geliefert. Bitte versuche es mit einem anderen Foto erneut.");
    }

    const firstCandidate = candidates[0];
    
    // Check for safety block
    if (firstCandidate.finishReason === 'SAFETY') {
      throw new Error("SAFETY_BLOCK");
    }

    const content = firstCandidate.content;
    if (!content || !content.parts || content.parts.length === 0) {
      throw new Error("Die KI-Antwort war leer. Bitte versuche es mit einem anderen Foto erneut.");
    }

    const parts = content.parts;
    
    // Look for image data
    const imagePart = parts.find(p => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return `data:image/jpeg;base64,${imagePart.inlineData.data}`;
    }
    
    // Look for text explanation if no image
    const textPart = parts.find(p => p.text);
    if (textPart?.text) {
      console.warn("AI returned text instead of image:", textPart.text);
      const lowerText = textPart.text.toLowerCase();
      if (lowerText.includes("sorry") || lowerText.includes("cannot") || lowerText.includes("unable") || lowerText.includes("policy")) {
        throw new Error("Die KI konnte dieses Bild leider nicht verarbeiten. Bitte versuche ein Foto mit neutralerem Hintergrund.");
      }
    }

    throw new Error("Die KI hat kein Bild generiert. Bitte versuche ein anderes Foto oder eine andere Pose.");
  } catch (err: any) {
    if (err.message === "SAFETY_BLOCK") {
      throw new Error("Das Bild wurde aus Sicherheitsgründen abgelehnt. Bitte versuche ein Foto mit neutralerem Hintergrund oder einer anderen Pose.");
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
