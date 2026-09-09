import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Image as ImageIcon, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAI } from '../AIContext';
import { base64ToBlobUrl, blobUrlToBase64 } from '../utils/imageUtils';

export function PageNode({ id, data }: { id: string, data: any }) {
  const { updateNodeData } = useReactFlow();
  const { getAIClient, imageModel, generationMode } = useAI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImages = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Condense character descriptions so diffusion models don't choke on giant text walls
      const charTraits = (data.characters || []).map((c: any) => {
        const raw = c.visualTraits || c.description || '';
        const cleaned = raw
          .replace(/#{1,6}\s+/g, '')
          .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0 && !l.startsWith('Here is a detailed') && !l.startsWith('Overall Appearance'))
          .slice(0, 3)
          .join(', ')
          .slice(0, 200);
        return `${c.name}${cleaned ? ` (${cleaned})` : ''}`;
      }).join('. ');

      const cleanStyle = (data.artStyle || 'children storybook vector art')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(', ')
        .slice(0, 150);

      const fullPrompt = `${data.imagePrompt || 'Story scene illustration'}. ${charTraits ? `Characters: ${charTraits}. ` : ''}Style: ${cleanStyle}. High quality children's book illustration, vibrant and charming.`;

      const parts: any[] = [{ text: fullPrompt }];

      // Add style reference if available
      if (data.styleReferenceImage) {
         try {
           const base64 = await blobUrlToBase64(data.styleReferenceImage);
           parts.push({
             inlineData: {
               data: base64.split(',')[1] || base64,
               mimeType: 'image/png'
             }
           });
         } catch (e) {
           console.error("Failed to load style reference image", e);
         }
      }

      // Add character references if available
      if (data.characters) {
        for (const char of data.characters) {
          if (char.referenceImages && char.referenceImages.length > 0) {
            try {
              const base64 = await blobUrlToBase64(char.referenceImages[0]);
              parts.push({
                inlineData: {
                  data: base64.split(',')[1] || base64,
                  mimeType: 'image/png'
                }
              });
            } catch (e) {
              console.error("Failed to load character reference image", e);
            }
          }
        }
      }

      const images: string[] = [];
      const countToGen = generationMode === 'draft' ? 1 : 2;
      for (let i = 0; i < countToGen; i++) {
        if (i > 0) await new Promise(res => setTimeout(res, 2000)); // Delay to prevent rate limits
        const imgResponse = await getAIClient().models.generateContent({
          model: imageModel,
          taskLabel: `Rendering Page ${data.pageNumber} illustration (${i + 1}/${countToGen})`,
          contents: { parts }
        });
        for (const part of imgResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            const blobUrl = base64ToBlobUrl(`data:image/png;base64,${part.inlineData.data}`);
            images.push(blobUrl);
          }
        }
      }
      
      updateNodeData(id, { images });
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || "";
      if (errorMessage.includes("paid API key") || errorMessage.includes("limit is 0") || errorMessage.includes("limit: 0")) {
        setError("Gemini Image Models require a paid API key (free tier limit is 0). Switch to Pollinations (Free) in Settings to generate without keys!");
      } else if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setError("Rate limit reached. Please wait a moment before trying again, or switch to Pollinations (Free) in Settings.");
      } else if (errorMessage.includes("high server traffic") || errorMessage.includes("503") || errorMessage.includes("high demand")) {
        setError("Image service is under temporary high traffic. Please retry in a moment.");
      } else {
        setError(errorMessage || "Failed to generate page images.");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 w-[400px] overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-stone-400" />
      <div className="bg-stone-100 text-stone-900 border-b border-stone-200 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif font-medium">Page {data.pageNumber}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${generationMode === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'}`}>
            {generationMode === 'draft' ? 'Draft' : 'Final'}
          </span>
        </div>
        <div className="flex gap-1">
          {['top', 'bottom', 'left', 'right', 'full'].map(l => (
            <button 
              key={l}
              onClick={() => updateNodeData(id, { layout: l })}
              className={`text-[9px] uppercase font-mono px-2 py-1 rounded-full border ${data.layout === l ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-400 border-stone-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Story Text</label>
          <textarea 
            value={data.text || ''}
            onChange={(e) => updateNodeData(id, { text: e.target.value })}
            className="nodrag w-full h-24 text-sm border border-stone-200 rounded-lg p-2 focus:border-stone-900 outline-none resize-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Image Prompt</label>
          <textarea 
            value={data.imagePrompt || ''}
            onChange={(e) => updateNodeData(id, { imagePrompt: e.target.value })}
            className="nodrag w-full h-16 text-xs text-stone-500 border border-stone-200 rounded-lg p-2 focus:border-stone-900 outline-none resize-none"
          />
        </div>

        <button 
          onClick={generateImages}
          disabled={isGenerating}
          className="w-full bg-stone-100 text-stone-900 py-2 rounded-lg font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="animate-spin w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          Generate Illustrations
        </button>

        {data.images && data.images.length > 0 && (
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Generated Options</label>
            <div className="grid grid-cols-2 gap-2">
              {data.images.map((img: string, idx: number) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-stone-200 aspect-[4/3]">
                  <img src={img} alt={`Option ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        const newImages = [...data.images];
                        const selected = newImages.splice(idx, 1)[0];
                        newImages.unshift(selected);
                        updateNodeData(id, { images: newImages });
                      }}
                      className="bg-white/90 backdrop-blur p-1.5 rounded-full shadow-lg text-stone-900 hover:bg-white"
                      title="Set as Primary"
                    >
                      <CheckCircle2 className={`w-3 h-3 ${idx === 0 ? "text-emerald-500" : "text-stone-400"}`} />
                    </button>
                  </div>
                  {idx === 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur text-white text-[9px] px-2 py-0.5 rounded-full">
                      Primary
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-stone-400" />
    </div>
  );
}
