import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Layout, BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { useAI } from '../AIContext';
import { Type as GenAIType } from "@google/genai";

export function BuilderNode({ id, data }: { id: string, data: any }) {
  const { getNodes, getEdges, setNodes, setEdges, updateNodeData } = useReactFlow();
  const { getAIClient, textModel, generationMode } = useAI();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateOutline = async () => {
    const edges = getEdges();
    const nodes = getNodes();
    
    const incomingEdges = edges.filter(e => e.target === id);
    const incomingNodes = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as any[];
    
    const conceptNode = incomingNodes.find(n => n.type === 'concept');
    const styleNode = incomingNodes.find(n => n.type === 'style');
    const characterNodes = incomingNodes.filter(n => n.type === 'character');

    if (!conceptNode || !conceptNode.data.concept) {
      setError("Please connect a Concept node with a defined concept.");
      return;
    }
    if (!styleNode || !styleNode.data.artStyle) {
      setError("Please connect a Style node with a defined art style.");
      return;
    }

    const concept = conceptNode.data.concept;
    const artStyle = styleNode.data.artStyle;
    const characters = characterNodes.map(n => n.data);
    const targetPageCount = data.targetPageCount || 5;

    setIsGenerating(true);
    setError(null);
    try {
      const charNames = characters.map(c => c.name).join(', ');
      const response = await getAIClient().models.generateContent({
        model: textModel,
        taskLabel: `Drafting ${targetPageCount}-page story outline`,
        contents: `Based on the concept: "${concept}", create a ${targetPageCount}-page story outline. For each page, provide the text and a detailed image prompt that includes the characters: ${charNames}. Ensure the art style "${artStyle}" is maintained.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: GenAIType.ARRAY,
            items: {
              type: GenAIType.OBJECT,
              properties: {
                pageNumber: { type: GenAIType.INTEGER },
                text: { type: GenAIType.STRING },
                imagePrompt: { type: GenAIType.STRING },
                layout: { type: GenAIType.STRING, enum: ['top', 'bottom', 'left', 'right', 'full'] }
              },
              required: ["pageNumber", "text", "imagePrompt", "layout"]
            }
          }
        }
      });
      
      const pagesData = JSON.parse(response.text || '[]');
      
      const newNodes = pagesData.map((p: any, index: number) => {
        const pageId = `page-${Date.now()}-${index}`;
        return {
          id: pageId,
          type: 'page',
          position: { x: 1100, y: 100 + (index * 600) },
          data: {
            ...p,
            images: [],
            artStyle,
            characters,
            styleReferenceImage: styleNode.data.referenceImage
          }
        };
      });

      const newEdges = newNodes.map((n: any) => ({
        id: `edge-${id}-${n.id}`,
        source: id,
        target: n.id,
        type: 'smoothstep',
        animated: true
      }));

      const oldEdges = edges.filter(e => e.source === id);
      const oldPageIds = oldEdges.map(e => e.target);
      
      setNodes(nds => [...nds.filter(n => !oldPageIds.includes(n.id)), ...newNodes]);
      setEdges(eds => [...eds.filter(e => e.source !== id), ...newEdges]);

    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || "";
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setError("API Quota exceeded. Please wait a moment and try again.");
      } else {
        setError("Failed to generate story outline.");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 w-80 overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-stone-400" />
      <div className="bg-emerald-600 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span className="font-serif font-medium">Story Builder</span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${generationMode === 'draft' ? 'bg-emerald-800/80 text-emerald-200' : 'bg-emerald-900 text-white'}`}>
          {generationMode === 'draft' ? 'Draft' : 'Final'}
        </span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-stone-500">
          Connect Concept, Style, and Character nodes here to generate the story outline.
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Target Pages</label>
          <select 
            value={data.targetPageCount || 5}
            onChange={(e) => updateNodeData(id, { targetPageCount: parseInt(e.target.value) })}
            className="w-full border border-stone-200 rounded-lg p-2 text-sm outline-none"
          >
            {[5, 8, 10, 12, 15, 20].map(n => <option key={n} value={n}>{n} Pages</option>)}
          </select>
        </div>

        <button 
          onClick={generateOutline}
          disabled={isGenerating}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="animate-spin w-4 h-4" /> : <Layout className="w-4 h-4" />}
          Generate Outline
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-600" />
    </div>
  );
}
