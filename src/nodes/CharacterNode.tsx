import React, { useState, useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { UserCircle2, RefreshCw, Image as ImageIcon, Trash2, AlertCircle, Upload, X } from 'lucide-react';
import { useAI } from '../AIContext';
import { base64ToBlobUrl } from '../utils/imageUtils';

export function CharacterNode({ id, data }: { id: string, data: any }) {
  const { updateNodeData, setNodes, setEdges } = useReactFlow();
  const { getAIClient, textModel, imageModel, generationMode } = useAI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateVisuals = async () => {
    if (!data.description || !data.name) return;
    setIsGenerating(true);
    setError(null);
    try {
      const textResponse = await getAIClient().models.generateContent({
        model: textModel,
        taskLabel: `Describing visual traits for ${data.name}`,
        contents: `Create a detailed visual description for a character named ${data.name} who is described as: ${data.description}. Focus on consistent features like hair color, clothing, and unique physical traits.`,
      });
      const visualTraits = textResponse.text;
      updateNodeData(id, { visualTraits });

      const images: string[] = [];
      const countToGen = generationMode === 'draft' ? 1 : 2;

      // Clean and condense visual traits so diffusion models don't choke
      const conciseTraits = visualTraits
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0 && !l.startsWith('Here is a detailed') && !l.startsWith('Overall Appearance'))
        .slice(0, 4)
        .join(', ')
        .slice(0, 250);

      const cleanStyle = (data.artStyle || 'storybook illustration')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .split('\n')
        .filter(Boolean)
        .slice(0, 2)
        .join(', ')
        .slice(0, 100);

      const portraitPrompt = `Character portrait of ${data.name}: ${conciseTraits || data.description}. Neutral background, clear character design, ${cleanStyle} style, high quality.`;

      for (let i = 0; i < countToGen; i++) {
        if (i > 0) await new Promise(res => setTimeout(res, 2000)); // Delay to prevent rate limits
        const imgResponse = await getAIClient().models.generateContent({
          model: imageModel,
          taskLabel: `Rendering portrait for ${data.name} (${i + 1}/${countToGen})`,
          contents: {
            parts: [{ text: portraitPrompt }]
          }
        });
        for (const part of imgResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            const blobUrl = base64ToBlobUrl(`data:image/png;base64,${part.inlineData.data}`);
            images.push(blobUrl);
          }
        }
      }
      updateNodeData(id, { referenceImages: images });
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || "";
      if (errorMessage.includes("paid API key") || errorMessage.includes("limit is 0") || errorMessage.includes("limit: 0")) {
        setError("Gemini Image Models require a paid API key (free tier limit is 0). Switch to Pollinations (Free) in Settings to generate without keys!");
      } else if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setError("Rate limit reached. Please wait a moment before trying again, or switch to Pollinations (Free) in Settings.");
      } else if (errorMessage.includes("high server traffic") || errorMessage.includes("503") || errorMessage.includes("high demand")) {
        setError("Image service is experiencing high traffic. Please try generating again in a few moments.");
      } else {
        setError(errorMessage || "Failed to generate character visuals.");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const currentImages = data.referenceImages || [];
      updateNodeData(id, { referenceImages: [url, ...currentImages] });
    }
  };

  const removeImage = (idxToRemove: number) => {
    const newImages = data.referenceImages.filter((_: any, idx: number) => idx !== idxToRemove);
    updateNodeData(id, { referenceImages: newImages });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 w-80 overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-stone-400" />
      <div className="bg-indigo-600 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircle2 className="w-4 h-4" />
          <span className="font-serif font-medium">Character</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${generationMode === 'draft' ? 'bg-indigo-800/80 text-indigo-200' : 'bg-indigo-900 text-white'}`}>
            {generationMode === 'draft' ? 'Draft' : 'Final'}
          </span>
        </div>
        <button onClick={deleteNode} className="text-indigo-200 hover:text-white transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Name</label>
          <input 
            type="text" 
            value={data.name || ''}
            onChange={(e) => updateNodeData(id, { name: e.target.value })}
            placeholder="Character Name"
            className="nodrag w-full text-lg font-serif border-b border-stone-200 focus:border-indigo-600 outline-none pb-1"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Description</label>
          <textarea 
            value={data.description || ''}
            onChange={(e) => updateNodeData(id, { description: e.target.value })}
            placeholder="Personality and role..."
            className="nodrag w-full h-16 text-sm border border-stone-200 rounded-lg p-2 focus:border-indigo-600 outline-none resize-none"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Visual Traits</label>
            <button 
              onClick={generateVisuals}
              disabled={isGenerating || !data.description || !data.name}
              className="text-[10px] font-mono uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              Generate
            </button>
          </div>
          {data.visualTraits && (
            <div className="text-xs text-stone-600 bg-stone-50 p-2 rounded-lg max-h-24 overflow-y-auto nodrag">
              {data.visualTraits}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Reference Images</label>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-mono uppercase tracking-widest text-stone-500 hover:text-stone-700 flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          {data.referenceImages && data.referenceImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 nodrag">
              {data.referenceImages.map((img: string, idx: number) => (
                <div key={idx} className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                  <img src={img} alt="Reference" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-600" />
    </div>
  );
}
