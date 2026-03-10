
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
          { text: `VIRTUAL TRY-ON TASK:
          - IMAGE 1: The person who needs to be dressed.
          - IMAGE 2: The target outfit (${productName}).
          
          YOUR MISSION:
          Generate a new image where the person from IMAGE 1 is wearing the EXACT clothing shown in IMAGE 2.
          
          TECHNICAL REQUIREMENTS:
          1. CLOTHING REPLACEMENT: Remove the current clothes of the person in IMAGE 1 and replace them with the outfit from IMAGE 2.
          2. PERFECT MATCH: The colors, patterns, and cut (e.g., leggings, crop top, or one-piece swimsuit) must be identical to IMAGE 2.
          3. ANATOMICAL REALISM: The new clothing must follow the body shape and pose of the person in IMAGE 1 perfectly.
          4. PRESERVATION: Keep the person's face, hair, skin tone, and the background from IMAGE 1 exactly as they are.
          5. NO ADDITIONS: Do not add any accessories, skirts, or extra layers that are not in IMAGE 2.
          
          Output only the resulting image.` },
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
