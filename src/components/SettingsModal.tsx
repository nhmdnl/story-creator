import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Cloud, Key, CheckCircle2, AlertCircle, Loader2, Zap, Sparkles, Download, Upload, FileJson, LogOut, Layers, Cpu } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { serializeNodes, deserializeNodes } from '../utils/imageUtils';
import { useAI } from '../AIContext';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken, uploadProjectToGoogleDrive } from '../services/googleDriveAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { 
    generationMode, 
    setGenerationMode, 
    imageProvider,
    setImageProvider,
    openrouterModel,
    setOpenrouterModel,
    higgsfieldModel,
    setHiggsfieldModel,
    pollinationsModel,
    setPollinationsModel,
    providerStatuses,
    refreshProviderStatuses,
    textModel, 
    imageModel 
  } = useAI();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setIsGoogleConnected(true);
        setUserEmail(user.email || null);
      },
      () => {
        setIsGoogleConnected(false);
        setUserEmail(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleConnectGoogle = async () => {
    setAuthError(null);
    setIsConnectingGoogle(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setIsGoogleConnected(true);
        setUserEmail(result.user.email || null);
      }
    } catch (error: any) {
      console.error('Google Sign In error:', error);
      if (error?.code !== 'auth/popup-closed-by-user') {
        setAuthError(error?.message || 'Failed to complete Google sign in.');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await logoutGoogle();
      setIsGoogleConnected(false);
      setUserEmail(null);
      setSaveMessage(null);
    } catch (err) {
      console.error("Failed to disconnect", err);
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      const nodes = getNodes();
      const edges = getEdges();
      const serializedNodes = await serializeNodes(nodes);
      
      const projectData = {
        name: 'StoryFlow Project',
        version: 1,
        timestamp: new Date().toISOString(),
        nodes: serializedNodes,
        edges
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyflow-project-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export JSON error:', err);
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          const deserializedNodes = deserializeNodes(parsed.nodes);
          setNodes(deserializedNodes);
          if (parsed.edges && Array.isArray(parsed.edges)) {
            setEdges(parsed.edges);
          }
          setImportMessage({ type: 'success', text: 'Project restored successfully!' });
        } else {
          setImportMessage({ type: 'error', text: 'Invalid project JSON structure.' });
        }
      } catch (err) {
        setImportMessage({ type: 'error', text: 'Failed to read project file.' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveToDrive = async () => {
    if (!isGoogleConnected) return;

    const token = await getAccessToken();
    if (!token) {
      setSaveMessage({ type: 'error', text: 'Session token expired. Please re-connect your Google account.' });
      return;
    }

    const confirmSave = window.confirm(
      'Save this complete storybook project file to your Google Drive?'
    );
    if (!confirmSave) return;
    
    setIsSavingToDrive(true);
    setSaveMessage(null);
    
    try {
      const nodes = getNodes();
      const edges = getEdges();
      
      // Serialize nodes to convert Blob URLs to Base64
      const serializedNodes = await serializeNodes(nodes);
      
      const projectData = {
        name: 'StoryFlow Project',
        nodes: serializedNodes,
        edges,
        version: 1,
        timestamp: new Date().toISOString()
      };

      const fileName = `StoryFlow_Project_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
      await uploadProjectToGoogleDrive(fileName, projectData, token);

      setSaveMessage({ type: 'success', text: `Successfully saved "${fileName}" to your Google Drive!` });
    } catch (error: any) {
      console.error("Save to drive error:", error);
      setSaveMessage({ type: 'error', text: error?.message || 'Failed to save to Google Drive.' });
    } finally {
      setIsSavingToDrive(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="font-serif font-medium text-lg">Settings</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* Google Account Integration */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                Google Drive Integration
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Connect your Google account to save project files directly to your Drive.
              </p>
            </div>

            {isGoogleConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Connected to Google Drive
                    </div>
                    {userEmail && (
                      <div className="text-[11px] text-emerald-700 font-mono truncate max-w-[200px]">
                        {userEmail}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleDisconnectGoogle}
                    className="text-xs text-stone-500 hover:text-red-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-white/80 transition-colors"
                    title="Disconnect Google Account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
                
                <button
                  onClick={handleSaveToDrive}
                  disabled={isSavingToDrive}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingToDrive ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to Drive...</>
                  ) : (
                    <><Cloud className="w-4 h-4" /> Save Project to Drive</>
                  )}
                </button>

                {saveMessage && (
                  <div className={`text-xs p-2.5 rounded-lg flex items-start gap-2 ${saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                    <span>{saveMessage.text}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="w-full bg-white border border-stone-300 text-stone-700 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 shadow-sm"
                >
                  {isConnectingGoogle ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-stone-500" /> Connecting to Google...</>
                  ) : (
                    <>
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>

                {authError && (
                  <div className="text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Connection Status</span>
                      <span className="text-[11px] text-amber-700 leading-tight block mt-0.5">
                        {authError}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="border-stone-100" />

          {/* Local Project Backup & Restore */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-600" />
                Project Backup &amp; Portability
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Save your full storyboard nodes, character designs, and pages locally as a JSON file, or restore a previous project.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                disabled={isExportingJson}
                className="p-2.5 border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 rounded-xl text-xs font-medium text-stone-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                title="Download full project data as JSON"
              >
                {isExportingJson ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Packaging...</>
                ) : (
                  <><Download className="w-3.5 h-3.5 text-stone-600" /> Export (.json)</>
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 rounded-xl text-xs font-medium text-stone-700 flex items-center justify-center gap-2 transition-colors"
                title="Load a previously saved project JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-stone-600" /> Import (.json)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </div>

            {importMessage && (
              <div className={`text-xs p-2 rounded-lg flex items-start gap-2 ${importMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {importMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{importMessage.text}</span>
              </div>
            )}
          </div>

          <hr className="border-stone-100" />

          {/* Third-Party Image Generation Engine */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  Image Generation Engine
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  {imageProvider.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Generate storybook illustrations using Pollinations.ai (Free), Google Gemini, OpenRouter, or Higgsfield AI.
              </p>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Pollinations.ai (100% Free) */}
              <button
                type="button"
                onClick={() => setImageProvider('pollinations')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  imageProvider === 'pollinations'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">Pollinations</span>
                    {imageProvider === 'pollinations' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                    FLUX.1, Anime &amp; 3D
                  </div>
                </div>
                <span className="mt-2 text-[9px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded self-start">
                  Free &bull; No Key
                </span>
              </button>

              {/* Gemini Native */}
              <button
                type="button"
                onClick={() => setImageProvider('gemini')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  imageProvider === 'gemini'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">Gemini</span>
                    {imageProvider === 'gemini' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                    Google Native Imagen &amp; Flash
                  </div>
                </div>
                <span className="mt-2 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded self-start">
                  Paid Tier
                </span>
              </button>

              {/* OpenRouter */}
              <button
                type="button"
                onClick={() => setImageProvider('openrouter')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  imageProvider === 'openrouter'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">OpenRouter</span>
                    {imageProvider === 'openrouter' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                    FLUX.1, Recraft v3, SD3
                  </div>
                </div>
                <span className={`mt-2 text-[9px] font-semibold px-1.5 py-0.5 rounded self-start ${
                  providerStatuses.openrouter?.configured 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-amber-700 bg-amber-50'
                }`}>
                  {providerStatuses.openrouter?.configured ? 'Active' : 'API Key Setup'}
                </span>
              </button>

              {/* Higgsfield AI */}
              <button
                type="button"
                onClick={() => setImageProvider('higgsfield')}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  imageProvider === 'higgsfield'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">Higgsfield</span>
                    {imageProvider === 'higgsfield' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                    Higgsfield FLUX Generative
                  </div>
                </div>
                <span className={`mt-2 text-[9px] font-semibold px-1.5 py-0.5 rounded self-start ${
                  providerStatuses.higgsfield?.configured 
                    ? 'text-emerald-700 bg-emerald-50' 
                    : 'text-amber-700 bg-amber-50'
                }`}>
                  {providerStatuses.higgsfield?.configured ? 'Active' : 'API Key Setup'}
                </span>
              </button>
            </div>

            {/* Provider-Specific Model Config */}
            {imageProvider === 'pollinations' && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label htmlFor="pollinations-model-select" className="font-semibold text-emerald-950">
                    Pollinations AI Model:
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    100% Free &bull; Unlimited Generations
                  </span>
                </div>
                <select
                  id="pollinations-model-select"
                  value={pollinationsModel}
                  onChange={(e) => setPollinationsModel(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                >
                  <option value="flux">FLUX.1 (High Detail &amp; Storybook Illustrations)</option>
                  <option value="flux-realism">FLUX Realism (Photorealistic)</option>
                  <option value="flux-anime">FLUX Anime (Japanese Manga / Anime Art)</option>
                  <option value="flux-3d">FLUX 3D (CGI Animation &amp; Clay Style)</option>
                  <option value="turbo">SDXL Turbo (Fastest Generations)</option>
                </select>
                <p className="text-[11px] text-emerald-800 leading-relaxed pt-1">
                  Pollinations generates character visuals and storybook page art freely without any accounts, credits, or billing limits.
                </p>
              </div>
            )}

            {/* Provider-Specific Model Config */}
            {imageProvider === 'openrouter' && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label htmlFor="openrouter-model-select" className="font-semibold text-stone-800">
                    OpenRouter Model:
                  </label>
                  <span className="text-[10px] text-stone-500">
                    {providerStatuses.openrouter?.configured ? 'API Connected' : 'Requires OPENROUTER_API_KEY'}
                  </span>
                </div>
                <select
                  id="openrouter-model-select"
                  value={openrouterModel}
                  onChange={(e) => setOpenrouterModel(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                >
                  <option value="black-forest-labs/flux-1-schnell">FLUX.1 Schnell (High Speed &amp; Crisp Details)</option>
                  <option value="black-forest-labs/flux-1-dev">FLUX.1 Dev (Storybook Artistry &amp; Style)</option>
                  <option value="recraft-ai/recraft-v3">Recraft v3 (Best for Vector &amp; Children's Book)</option>
                  <option value="stabilityai/stable-diffusion-3-medium">Stable Diffusion 3 Medium</option>
                  <option value="bytedance-seed/seedream-4.5">Seedream 4.5</option>
                </select>
                <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                  Requests are proxied server-side using your <code className="font-mono text-stone-700 bg-stone-200/70 px-1 py-0.5 rounded">OPENROUTER_API_KEY</code>. Character and page nodes will generate directly through OpenRouter.
                </p>
              </div>
            )}

            {imageProvider === 'higgsfield' && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label htmlFor="higgsfield-model-select" className="font-semibold text-stone-800">
                    Higgsfield Model:
                  </label>
                  <span className="text-[10px] text-stone-500">
                    {providerStatuses.higgsfield?.configured ? 'API Connected' : 'Requires HIGGSFIELD_API_KEY'}
                  </span>
                </div>
                <select
                  id="higgsfield-model-select"
                  value={higgsfieldModel}
                  onChange={(e) => setHiggsfieldModel(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                >
                  <option value="flux">Higgsfield FLUX Generative Model</option>
                </select>
                <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                  Requests are proxied server-side using your <code className="font-mono text-stone-700 bg-stone-200/70 px-1 py-0.5 rounded">HIGGSFIELD_API_KEY</code>. Character and page nodes will generate directly through Higgsfield AI.
                </p>
              </div>
            )}
          </div>

          <hr className="border-stone-100" />

          {/* Model Selection & Quality Preset */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Model & Quality Preset
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Choose between quota-saving fast prototyping or full publication-grade rendering.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Draft Mode Option */}
              <button
                type="button"
                onClick={() => setGenerationMode('draft')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  generationMode === 'draft'
                    ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-stone-900">Draft & Exploration</div>
                      <div className="text-[11px] text-amber-800 font-medium">Quota-Friendly & High Speed</div>
                    </div>
                  </div>
                  {generationMode === 'draft' && (
                    <CheckCircle2 className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-amber-100/60 text-[11px] text-stone-600 space-y-1">
                  <div><strong>Text:</strong> gemini-3.8-flash (Fast outlines)</div>
                  <div><strong>Art:</strong> gemini-3.1-flash-lite-image (Low quota consumption)</div>
                  <div className="text-stone-400 text-[10px] pt-0.5">Best for testing concepts, layouts, and rapid prompt iterating.</div>
                </div>
              </button>

              {/* Final Release Mode Option */}
              <button
                type="button"
                onClick={() => setGenerationMode('production')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  generationMode === 'production'
                    ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${generationMode === 'production' ? 'bg-stone-800 text-amber-300' : 'bg-stone-100 text-stone-800'}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${generationMode === 'production' ? 'text-white' : 'text-stone-900'}`}>Final Release & Production</div>
                      <div className={`text-[11px] font-medium ${generationMode === 'production' ? 'text-stone-300' : 'text-stone-500'}`}>High-Fidelity Studio Grade</div>
                    </div>
                  </div>
                  {generationMode === 'production' && (
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className={`mt-2.5 pt-2 border-t text-[11px] space-y-1 ${generationMode === 'production' ? 'border-stone-800 text-stone-300' : 'border-stone-100 text-stone-600'}`}>
                  <div><strong>Text:</strong> gemini-3.1-pro-preview (Deep story logic & rhythm)</div>
                  <div><strong>Art:</strong> gemini-3.1-flash-image (High consistency & 1K/2K resolution)</div>
                  <div className={`text-[10px] pt-0.5 ${generationMode === 'production' ? 'text-stone-400' : 'text-stone-400'}`}>Best for final illustrations, character consistency, and export.</div>
                </div>
              </button>
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Gemini AI Configuration */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Gemini AI Configuration
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                StoryFlow runs high-performance multimodal Gemini models server-side for maximum reliability and quota.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 space-y-1">
              <div className="flex items-center gap-2 text-stone-900 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Active Models: <span className="font-mono text-[11px] text-stone-700">{textModel}</span> &amp; <span className="font-mono text-[11px] text-stone-700">{imageModel}</span>
              </div>
              <p className="text-stone-500 text-[11px] leading-relaxed pt-1">
                Your API key is automatically attached to backend generation calls. To use your custom paid plan or upgrade quotas, attach your key in the AI Studio <strong>Settings &gt; Secrets</strong> panel.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
