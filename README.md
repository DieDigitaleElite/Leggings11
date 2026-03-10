# Shopware Virtual Try-On App

## 🚀 Hosting auf Vercel

### WICHTIG für den Upload:
Wenn du die Dateien manuell bei GitHub hochlädst, achte bitte penibel auf die Ordnerstruktur:
1. `App.tsx`, `index.tsx`, `package.json`, `tsconfig.json` usw. liegen im **Hauptordner**.
2. Erstelle einen Unterordner namens `components` und lege `ProductCard.tsx` sowie `StepIndicator.tsx` dort hinein.
3. Erstelle einen Unterordner namens `services` und lege `geminiService.ts` dort hinein.

Vercel kann die Dateien nur finden, wenn sie in den richtigen Ordnern liegen.

### API Key
Vergiss nicht, in den Vercel Project Settings unter **Environment Variables** den Key `API_KEY` mit deinem Wert von Google AI Studio zu hinterlegen.
