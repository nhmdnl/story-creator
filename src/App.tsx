/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { set, get } from 'idb-keyval';

import { ConceptNode } from './nodes/ConceptNode';
import { StyleNode } from './nodes/StyleNode';
import { CharacterNode } from './nodes/CharacterNode';
import { BuilderNode } from './nodes/BuilderNode';
import { PageNode } from './nodes/PageNode';
import { ExportNode } from './nodes/ExportNode';
import { AIProvider, useAI } from './AIContext';
import { Plus, Loader2, Settings, Zap, Sparkles } from 'lucide-react';
import { serializeNodes, deserializeNodes } from './utils/imageUtils';
import { SettingsModal } from './components/SettingsModal';
import { UsageStatusBar } from './components/UsageStatusBar';

const nodeTypes = {
  concept: ConceptNode,
  style: StyleNode,
  character: CharacterNode,
  builder: BuilderNode,
  page: PageNode,
  export: ExportNode,
};

const initialNodes = [
  { id: 'concept-1', type: 'concept', position: { x: 100, y: 100 }, data: { title: '', concept: '' } },
  { id: 'style-1', type: 'style', position: { x: 100, y: 400 }, data: { artStyle: '' } },
  { id: 'builder-1', type: 'builder', position: { x: 600, y: 250 }, data: { targetPageCount: 5 } },
  { id: 'export-1', type: 'export', position: { x: 1600, y: 250 }, data: {} },
];

const initialEdges = [
  { id: 'e-concept-builder', source: 'concept-1', target: 'builder-1', animated: true },
  { id: 'e-style-builder', source: 'style-1', target: 'builder-1', animated: true },
];

const FLOW_KEY = 'storyflow-canvas-state';

function Flow() {
  const { generationMode, setGenerationMode } = useAI();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const loadFlow = async () => {
      try {
        const savedData = await get(FLOW_KEY);
        if (savedData) {
          const { nodes: savedNodes, edges: savedEdges } = savedData;
          setNodes(deserializeNodes(savedNodes));
          setEdges(savedEdges);
        } else {
          setNodes(initialNodes);
          setEdges(initialEdges);
        }
      } catch (err) {
        console.error("Failed to load flow from IndexedDB", err);
        setNodes(initialNodes);
        setEdges(initialEdges);
      } finally {
        setIsLoaded(true);
      }
    };
    loadFlow();
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    const saveFlow = async () => {
      try {
        const serializedNodes = await serializeNodes(nodes);
        await set(FLOW_KEY, { nodes: serializedNodes, edges });
      } catch (err) {
        console.error("Failed to save flow to IndexedDB", err);
      }
    };
    
    const timeoutId = setTimeout(saveFlow, 1000);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isLoaded]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const addCharacterNode = () => {
    const id = `character-${Date.now()}`;
    const newNode = {
      id,
      type: 'character',
      position: { x: 100, y: 700 + (nodes.filter(n => n.type === 'character').length * 400) },
      data: { name: '', description: '', visualTraits: '', referenceImages: [] }
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => addEdge({ source: id, target: 'builder-1', animated: true }, eds));
  };

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#FDFCFB]">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#FDFCFB]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-stone-50"
      >
        <Background color="#e7e5e4" gap={16} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        
        <Panel position="top-left" className="bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border border-stone-200 m-4">
          <h1 className="text-2xl font-serif italic mb-2">Story Node Builder</h1>
          <p className="text-xs text-stone-500 mb-4 max-w-xs">
            Connect your ideas, styles, and characters to the Builder node to generate your story.
          </p>
          <button 
            onClick={addCharacterNode}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Character
          </button>
        </Panel>

        <Panel position="top-right" className="m-4 flex items-center gap-2.5">
          {/* Quality Mode Switcher */}
          <div className="bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-stone-200 flex items-center text-xs font-medium">
            <button
              onClick={() => setGenerationMode('draft')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                generationMode === 'draft'
                  ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Draft Mode: Low quota usage & ultra-fast (gemini-3.8-flash + gemini-3.1-flash-lite-image)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Draft (Quota-Saver)</span>
            </button>
            <button
              onClick={() => setGenerationMode('production')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                generationMode === 'production'
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Final Release: Publication quality (gemini-3.1-pro + gemini-3.1-flash-image)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Final Release</span>
            </button>
          </div>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white p-2.5 rounded-2xl shadow-sm border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </Panel>

        <Panel position="bottom-center" className="mb-4 z-40">
          <UsageStatusBar />
        </Panel>

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </ReactFlow>
    </div>
  );
}

export default function App() {
  return (
    <AIProvider>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </AIProvider>
  );
}
