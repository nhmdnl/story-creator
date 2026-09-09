import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

export type GenerationMode = 'draft' | 'production';
export type ImageProvider = 'gemini' | 'openrouter' | 'higgsfield' | 'pollinations';

export interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  defaultModel: string;
  models: { id: string; name: string }[];
}

export interface ActiveTask {
  id: string;
  label: string;
  startedAt: number;
}

export interface SessionUsage {
  totalRequests: number;
  textRequests: number;
  imageRequests: number;
  failedRequests: number;
  recentTimestamps: number[];
  lastRequestTime: number | null;
  lastError: string | null;
}

interface AIClientInterface {
  models: {
    generateContent: (params: {
      model: string;
      contents: any;
      config?: any;
      taskLabel?: string;
      provider?: ImageProvider;
    }) => Promise<any>;
  };
}

interface AIContextType {
  getAIClient: () => AIClientInterface;
  generationMode: GenerationMode;
  setGenerationMode: (mode: GenerationMode) => void;
  imageProvider: ImageProvider;
  setImageProvider: (provider: ImageProvider) => void;
  openrouterModel: string;
  setOpenrouterModel: (model: string) => void;
  higgsfieldModel: string;
  setHiggsfieldModel: (model: string) => void;
  pollinationsModel: string;
  setPollinationsModel: (model: string) => void;
  providerStatuses: Record<string, ProviderInfo>;
  refreshProviderStatuses: () => Promise<void>;
  textModel: string;
  imageModel: string;
  activeTasks: ActiveTask[];
  isBusy: boolean;
  sessionUsage: SessionUsage;
  requestsInLastMinute: number;
  cooldownRemainingSeconds: number;
  resetSessionUsage: () => void;
}

const AIContext = createContext<AIContextType | null>(null);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [generationMode, setGenerationModeState] = useState<GenerationMode>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (localStorage.getItem('storyflow_generation_mode') as GenerationMode) || 'draft';
    }
    return 'draft';
  });

  const [imageProvider, setImageProviderState] = useState<ImageProvider>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('storyflow_image_provider');
      if (saved) return saved as ImageProvider;
    }
    return 'pollinations';
  });

  const [openrouterModel, setOpenrouterModelState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('storyflow_openrouter_model') || 'black-forest-labs/flux-1-schnell';
    }
    return 'black-forest-labs/flux-1-schnell';
  });

  const [higgsfieldModel, setHiggsfieldModelState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('storyflow_higgsfield_model') || 'flux';
    }
    return 'flux';
  });

  const [pollinationsModel, setPollinationsModelState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('storyflow_pollinations_model') || 'flux';
    }
    return 'flux';
  });

  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderInfo>>({});

  const refreshProviderStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/providers/status');
      if (res.ok) {
        const data = await res.json();
        setProviderStatuses(data);
      }
    } catch (e) {
      console.error('Failed to fetch provider status', e);
    }
  }, []);

  useEffect(() => {
    refreshProviderStatuses();
  }, [refreshProviderStatuses]);

  const setImageProvider = (prov: ImageProvider) => {
    setImageProviderState(prov);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('storyflow_image_provider', prov);
    }
  };

  const setOpenrouterModel = (mod: string) => {
    setOpenrouterModelState(mod);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('storyflow_openrouter_model', mod);
    }
  };

  const setHiggsfieldModel = (mod: string) => {
    setHiggsfieldModelState(mod);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('storyflow_higgsfield_model', mod);
    }
  };

  const setPollinationsModel = (mod: string) => {
    setPollinationsModelState(mod);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('storyflow_pollinations_model', mod);
    }
  };

  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('storyflow_session_usage');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            totalRequests: parsed.totalRequests || 0,
            textRequests: parsed.textRequests || 0,
            imageRequests: parsed.imageRequests || 0,
            failedRequests: parsed.failedRequests || 0,
            recentTimestamps: [],
            lastRequestTime: parsed.lastRequestTime || null,
            lastError: null
          };
        } catch {
          // ignore
        }
      }
    }
    return {
      totalRequests: 0,
      textRequests: 0,
      imageRequests: 0,
      failedRequests: 0,
      recentTimestamps: [],
      lastRequestTime: null,
      lastError: null
    };
  });

  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Tick every second to update live cooldown and 60-second window
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save session usage to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('storyflow_session_usage', JSON.stringify({
        totalRequests: sessionUsage.totalRequests,
        textRequests: sessionUsage.textRequests,
        imageRequests: sessionUsage.imageRequests,
        failedRequests: sessionUsage.failedRequests,
        lastRequestTime: sessionUsage.lastRequestTime
      }));
    }
  }, [sessionUsage]);

  const setGenerationMode = (mode: GenerationMode) => {
    setGenerationModeState(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('storyflow_generation_mode', mode);
    }
  };

  const textModel = generationMode === 'draft' ? 'gemini-3.8-flash' : 'gemini-3.1-pro-preview';
  const imageModel = generationMode === 'draft' ? 'gemini-3.1-flash-lite-image' : 'gemini-3.1-flash-image';

  // Compute live window stats
  const requestsInLastMinute = sessionUsage.recentTimestamps.filter(t => currentTime - t < 60000).length;
  
  // Recommended cooldown: 4 seconds between requests to ensure safe RPM spacing
  const timeSinceLast = sessionUsage.lastRequestTime ? currentTime - sessionUsage.lastRequestTime : 999999;
  const cooldownRemainingSeconds = timeSinceLast < 4000 ? Math.ceil((4000 - timeSinceLast) / 1000) : 0;

  const resetSessionUsage = useCallback(() => {
    setSessionUsage({
      totalRequests: 0,
      textRequests: 0,
      imageRequests: 0,
      failedRequests: 0,
      recentTimestamps: [],
      lastRequestTime: null,
      lastError: null
    });
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('storyflow_session_usage');
    }
  }, []);

  const getAIClient = useCallback((): AIClientInterface => {
    return {
      models: {
        generateContent: async ({ model, contents, config, taskLabel, provider }: { 
          model: string; 
          contents: any; 
          config?: any; 
          taskLabel?: string;
          provider?: ImageProvider;
        }) => {
          const isImage = model.includes('image') || (contents?.parts && contents.parts.some((p: any) => p.text && p.text.includes('illustration')));
          const activeProvider: ImageProvider = provider || (isImage ? imageProvider : 'gemini');
          
          let activeModel = model;
          if (isImage) {
            if (activeProvider === 'openrouter') {
              activeModel = openrouterModel || 'black-forest-labs/flux-1-schnell';
            } else if (activeProvider === 'higgsfield') {
              activeModel = higgsfieldModel || 'flux';
            } else if (activeProvider === 'pollinations') {
              activeModel = pollinationsModel || 'flux';
            }
          }

          const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const providerTag = activeProvider === 'openrouter' ? 'OpenRouter' : activeProvider === 'higgsfield' ? 'Higgsfield' : activeProvider === 'pollinations' ? 'Pollinations.ai' : 'Gemini';
          const defaultLabel = taskLabel || (isImage ? `[${providerTag}] Rendering illustration...` : 'Generating story narrative...');

          // Register active task
          setActiveTasks(prev => [...prev, { id: taskId, label: defaultLabel, startedAt: Date.now() }]);

          const reqTime = Date.now();
          setSessionUsage(prev => ({
            ...prev,
            totalRequests: prev.totalRequests + 1,
            textRequests: isImage ? prev.textRequests : prev.textRequests + 1,
            imageRequests: isImage ? prev.imageRequests + 1 : prev.imageRequests,
            recentTimestamps: [...prev.recentTimestamps.filter(t => reqTime - t < 60000), reqTime],
            lastRequestTime: reqTime
          }));

          try {
            const res = await fetch('/api/gemini/generateContent', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                model: activeModel, 
                contents, 
                config,
                provider: activeProvider
              })
            });

            const text = await res.text();
            let data: any;
            try {
              data = JSON.parse(text);
            } catch {
              const err: any = new Error(
                res.ok 
                  ? 'Invalid server response format' 
                  : `Server error (${res.status}): ${text.slice(0, 200)}`
              );
              err.code = res.status;
              err.status = res.status;
              setSessionUsage(prev => ({
                ...prev,
                failedRequests: prev.failedRequests + 1,
                lastError: `Server error ${res.status}`
              }));
              throw err;
            }

            if (!res.ok) {
              const errorMsg = data.error?.message || `API error ${res.status}`;
              const err: any = new Error(errorMsg);
              err.code = data.error?.code || res.status;
              err.status = data.error?.status;
              const isQuota = err.code === 429 || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
              const isPaidReq = errorMsg.includes('paid API key') || errorMsg.includes('limit is 0') || errorMsg.includes('free tier');
              const is503 = err.code === 503 || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE');

              let summaryError = errorMsg;
              if (isPaidReq) {
                summaryError = 'Paid API key required for Gemini image generation (free tier limit is 0)';
              } else if (isQuota) {
                summaryError = 'Rate limit exceeded (429)';
              } else if (is503) {
                summaryError = 'AI model temporarily high in demand (503). Please retry.';
              }

              setSessionUsage(prev => ({
                ...prev,
                failedRequests: prev.failedRequests + 1,
                lastError: summaryError
              }));
              throw err;
            }
            return data;
          } catch (err: any) {
            throw err;
          } finally {
            setActiveTasks(prev => prev.filter(t => t.id !== taskId));
          }
        }
      }
    };
  }, [imageProvider, openrouterModel, higgsfieldModel, pollinationsModel]);

  const isBusy = activeTasks.length > 0;

  return (
    <AIContext.Provider 
      value={{ 
        getAIClient, 
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
        imageModel: imageProvider === 'openrouter' ? openrouterModel : imageProvider === 'higgsfield' ? higgsfieldModel : imageProvider === 'pollinations' ? pollinationsModel : imageModel,
        activeTasks,
        isBusy,
        sessionUsage,
        requestsInLastMinute,
        cooldownRemainingSeconds,
        resetSessionUsage
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be used within AIProvider");
  return ctx;
};
