import React, { useRef } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Palette, Upload, X } from 'lucide-react';

export function StyleNode({ id, data }: { id: string, data: any }) {
  const { updateNodeData } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const styles = [
    'Classic Watercolor', 'Digital Flat Art', 'Charcoal Sketch', 
    '3D Claymation', 'Vintage Ink', 'Oil Painting'
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateNodeData(id, { referenceImage: url });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 w-80 overflow-hidden">
      <div className="bg-stone-900 text-white p-3 flex items-center gap-2">
        <Palette className="w-4 h-4" />
        <span className="font-serif font-medium">Art Style</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Preset Styles</label>
          <div className="flex flex-wrap gap-2">
            {styles.map(s => (
              <button 
                key={s}
                onClick={() => updateNodeData(id, { artStyle: s })}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${data.artStyle === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Custom Style</label>
          <textarea 
            value={data.artStyle || ''}
            onChange={(e) => updateNodeData(id, { artStyle: e.target.value })}
            placeholder="Describe the visual style..."
            className="nodrag w-full h-16 text-sm border border-stone-200 rounded-lg p-2 focus:border-stone-900 outline-none resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Style Reference Image</label>
          {data.referenceImage ? (
            <div className="relative rounded-lg overflow-hidden border border-stone-200 aspect-video">
              <img src={data.referenceImage} alt="Style Reference" className="w-full h-full object-cover" />
              <button 
                onClick={() => updateNodeData(id, { referenceImage: null })}
                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-200 rounded-lg p-4 flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-300 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 mb-2" />
              <span className="text-xs">Upload Reference Image</span>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-stone-900" />
    </div>
  );
}
