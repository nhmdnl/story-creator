import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useAI } from '../AIContext';
import { Type as GenAIType } from "@google/genai";

export function ConceptNode({ id, data }: { id: string, data: any }) {
  const { updateNodeData, getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  const { getAIClient, textModel, generationMode } = useAI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateConcept = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await getAIClient().models.generateContent({
        model: textModel,
        taskLabel: "Generating story concept & characters",
        contents: "Generate a creative story concept for a children's book. Include a catchy title, a 3-sentence plot summary, a highly descriptive suggested art style, and a list of the main characters with their names and brief descriptions.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: GenAIType.OBJECT,
            properties: {
              title: { type: GenAIType.STRING },
              concept: { type: GenAIType.STRING },
              suggestedArtStyle: { type: GenAIType.STRING },
              characters: {
                type: GenAIType.ARRAY,
                items: {
                  type: GenAIType.OBJECT,
                  properties: {
                    name: { type: GenAIType.STRING },
                    description: { type: GenAIType.STRING }
                  },
                  required: ["name", "description"]
                }
              }
            },
            required: ["title", "concept", "suggestedArtStyle", "characters"]
          }
        }
      });
      const resData = JSON.parse(response.text || '{}');
      
      // 1. Update current Concept Node
      updateNodeData(id, { title: resData.title, concept: resData.concept });

      const currentNodes = getNodes();
      const builderNode = currentNodes.find(n => n.type === 'builder');
      const builderId = builderNode ? builderNode.id : 'builder-1';

      // 2. Update or Create Style Node
      let styleNode = currentNodes.find(n => n.type === 'style');
      if (styleNode) {
        updateNodeData(styleNode.id, { artStyle: resData.suggestedArtStyle });
      } else {
        const newStyleId = `style-${Date.now()}`;
        const newStyleNode = {
          id: newStyleId,
          type: 'style',
          position: { x: 100, y: 400 },
          data: { artStyle: resData.suggestedArtStyle }
        };
        setNodes(nds => [...nds, newStyleNode]);
        setEdges(eds => [...eds, { id: `e-${newStyleId}-${builderId}`, source: newStyleId, target: builderId, animated: true }]);
      }

      // 3. Create Character Nodes
      if (resData.characters && resData.characters.length > 0) {
        // Find existing characters to position new ones below them
        const existingChars = currentNodes.filter(n => n.type === 'character');
        const startY = 700 + (existingChars.length * 400);

        const newCharNodes = resData.characters.map((char: any, index: number) => {
          const charId = `character-${Date.now()}-${index}`;
          return {
            id: charId,
            type: 'character',
            position: { x: 100, y: startY + (index * 400) },
            data: { name: char.name, description: char.description, visualTraits: '', referenceImages: [] }
          };
        });

        const newCharEdges = newCharNodes.map((node: any) => ({
          id: `e-${node.id}-${builderId}`,
          source: node.id,
          target: builderId,
          animated: true
        }));

        setNodes(nds => [...nds, ...newCharNodes]);
        setEdges(eds => [...eds, ...newCharEdges]);
      }

    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || "";
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setError("API Quota exceeded. Please wait a moment and try again.");
      } else {
        setError("Failed to generate concept. Please try again.");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 w-80 overflow-hidden">
      <div className="bg-stone-900 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-serif font-medium">Story Concept</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${generationMode === 'draft' ? 'bg-amber-900/60 text-amber-200' : 'bg-stone-800 text-stone-300'}`}>
            {generationMode === 'draft' ? 'Draft' : 'Final'}
          </span>
        </div>
        <button 
          onClick={generateConcept}
          disabled={isGenerating}
          className="text-stone-300 hover:text-white disabled:opacity-50"
          title="Auto-Generate Idea & Characters"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
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
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Title</label>
          <input 
            type="text" 
            value={data.title || ''}
            onChange={(e) => updateNodeData(id, { title: e.target.value })}
            placeholder="Story Title"
            className="nodrag w-full text-lg font-serif border-b border-stone-200 focus:border-stone-900 outline-none pb-1"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Concept</label>
          <textarea 
            value={data.concept || ''}
            onChange={(e) => updateNodeData(id, { concept: e.target.value })}
            placeholder="What is your story about?"
            className="nodrag w-full h-24 text-sm border border-stone-200 rounded-lg p-2 focus:border-stone-900 outline-none resize-none"
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-stone-900" />
    </div>
  );
}