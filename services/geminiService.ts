
import { APP_CONFIG } from "../constants";

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

export interface TryOnResult {
  image: string;
  size: string;
}

export async function performVirtualTryOn(userBase64: string, productBase64: string, productName: string, retries = 2): Promise<TryOnResult> {
  const [optUser, optProduct] = await Promise.all([
    optimizeImage(userBase64, 1024),
    optimizeImage(productBase64, 1024)
  ]);

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userImage: optUser,
          productImage: optProduct,
          productName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server Error");
      }

      const result = await response.json();
      return {
        image: result.image,
        size: result.size
      };
    } catch (err: any) {
      const errorStr = err.message.toLowerCase();
      const isRateLimit = errorStr.includes("429") || errorStr.includes("exhausted");
      
      if (isRateLimit && i < retries) {
        console.log(`Rate limit hit, retrying in ${Math.pow(2, i)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      
      if (err.message === "SAFETY_BLOCK") {
        throw new Error("Bild aus Sicherheitsgründen abgelehnt.");
      }
      throw err;
    }
  }
  throw new Error("Maximale Versuche erreicht.");
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
