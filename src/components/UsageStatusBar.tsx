import React, { useState } from 'react';
import { useAI } from '../AIContext';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  Image as ImageIcon, 
  FileText, 
  AlertTriangle, 
  ChevronUp, 
  ChevronDown, 
  RefreshCw, 
  RotateCcw,
  Zap,
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react';

export function UsageStatusBar() {
  const { 
    isBusy, 
    activeTasks, 
    sessionUsage, 
    requestsInLastMinute, 
    cooldownRemainingSeconds, 
    generationMode,
    imageProvider,
    textModel,
    imageModel,
    resetSessionUsage 
  } = useAI();

  const [isExpanded, setIsExpanded] = useState(false);

  const currentTask = activeTasks[activeTasks.length - 1];
  const hasError = !!sessionUsage.lastError;

  return (
    <div className="relative">
      {/* Expanded Popover Card */}
      {isExpanded && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[460px] max-w-[90vw] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 p-5 text-stone-800 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-stone-100 text-stone-800">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Session Usage &amp; Quota Monitor</h3>
                <p className="text-[11px] text-stone-500">Live tracker to prevent rate limits and monitor generations</p>
              </div>
            </div>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Status Advisory Banner */}
          <div className="mt-3.5">
            {isBusy ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Task in progress:</span>
                    <span className="font-normal text-amber-800 underline decoration-amber-300">{currentTask?.label || 'Processing...'}</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    <strong>Please wait until finished.</strong> Running parallel requests on the free tier can trigger 429 quota exhaustion.
                  </p>
                </div>
              </div>
            ) : hasError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Recent API Warning</div>
                  <p className="text-[11px] text-red-700">
                    {sessionUsage.lastError}.
                    {sessionUsage.lastError?.includes('Paid API key') || sessionUsage.lastError?.includes('free tier')
                      ? ' Gemini Image Models require a Paid Tier API key. You can switch to Pollinations.ai (Free - No Key Needed) or OpenRouter in Settings.'
                      : ' Wait ~30 seconds for the RPM rate window to clear, or switch to Draft Mode.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">All Tasks Finished &bull; Safe to Continue</div>
                  <p className="text-[11px] text-emerald-700">
                    No active API calls. You can safely generate new outlines, characters, or page illustrations.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 mt-3.5">
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block">Total Requests</span>
              <span className="text-xl font-bold font-mono text-stone-900">{sessionUsage.totalRequests}</span>
              <span className="text-[10px] text-stone-500 block">this session</span>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block">Illustrations</span>
              <span className="text-xl font-bold font-mono text-indigo-600">{sessionUsage.imageRequests}</span>
              <span className="text-[10px] text-stone-500 block">images</span>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block">Story Texts</span>
              <span className="text-xl font-bold font-mono text-stone-700">{sessionUsage.textRequests}</span>
              <span className="text-[10px] text-stone-500 block">outlines / lore</span>
            </div>
          </div>

          {/* Live Rate Limiting & Health */}
          <div className="mt-3.5 bg-stone-50/70 border border-stone-200/80 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                Recent Speed (Last 60s):
              </span>
              <span className={`font-mono font-bold ${requestsInLastMinute >= 4 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {requestsInLastMinute} req / min
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                Recommended Pacing:
              </span>
              <span className="font-mono text-stone-700">
                {cooldownRemainingSeconds > 0 ? (
                  <span className="text-amber-600 font-bold">Wait {cooldownRemainingSeconds}s</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">Safe (0s wait)</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
              <span className="text-stone-500 flex items-center gap-1.5">
                {generationMode === 'draft' ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
                Art Engine:
              </span>
              <div className="text-right">
                <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mr-1.5 uppercase">
                  {imageProvider}
                </span>
                <span className="font-mono text-[10px] text-stone-600 truncate max-w-[150px] inline-block align-bottom">
                  {imageModel.split('/').pop()?.replace('gemini-', '')}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3.5 pt-3 border-t border-stone-100 flex items-center justify-between">
            <button
              onClick={resetSessionUsage}
              className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-stone-100 transition-colors"
              title="Reset session request counters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Counters
            </button>

            <span className="text-[11px] text-stone-400">
              Mode: <strong className="text-stone-700 uppercase">{generationMode}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Main Status Dock Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border transition-all cursor-pointer select-none flex items-center gap-3 text-xs ${
          isBusy 
            ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-amber-500/10' 
            : hasError 
              ? 'border-red-300 ring-2 ring-red-400/20' 
              : 'border-stone-200 hover:border-stone-300'
        }`}
        title="Click to view detailed session usage and quota guidance"
      >
        {/* Status indicator pulse dot */}
        <div className="flex items-center gap-2">
          {isBusy ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            </div>
          ) : hasError ? (
            <span className="flex h-2.5 w-2.5 rounded-full bg-red-500" />
          ) : (
            <span className="relative flex h-2.5 w-2.5">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}

          {/* Status Text / Actionable guidance */}
          <div className="font-medium whitespace-nowrap">
            {isBusy ? (
              <div className="flex items-center gap-1.5 text-amber-900">
                <span className="font-bold">Busy:</span>
                <span className="max-w-[200px] truncate text-stone-700">{currentTask?.label || 'Processing...'}</span>
                <span className="text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold ml-0.5">Please wait</span>
              </div>
            ) : hasError ? (
              <span className="text-red-700 font-semibold">Rate limit warning (click for details)</span>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="font-bold">Ready</span>
                <span className="text-stone-500 font-normal hidden sm:inline">&bull; All finished (Safe to continue)</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-stone-200" />

        {/* Counter chips */}
        <div className="flex items-center gap-2 text-stone-600 font-mono text-[11px]">
          <span 
            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
              imageProvider === 'pollinations'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : imageProvider === 'openrouter' 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                : imageProvider === 'higgsfield'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}
            title={`Active Image Generator Engine: ${imageProvider}`}
          >
            {imageProvider === 'pollinations' ? 'Pollinations (Free)' : imageProvider === 'openrouter' ? 'OpenRouter' : imageProvider === 'higgsfield' ? 'Higgsfield' : 'Gemini'}
          </span>

          <span className="text-stone-300">&bull;</span>

          <div className="flex items-center gap-1" title="Illustrations generated this session">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span>{sessionUsage.imageRequests} img</span>
          </div>

          <span className="text-stone-300">&bull;</span>

          <div className="flex items-center gap-1" title="Story texts / outlines generated">
            <FileText className="w-3.5 h-3.5 text-stone-500" />
            <span>{sessionUsage.textRequests} txt</span>
          </div>

          {requestsInLastMinute > 0 && (
            <>
              <span className="text-stone-300">&bull;</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${requestsInLastMinute >= 4 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`} title="Requests in the last 60 seconds">
                {requestsInLastMinute}/m
              </span>
            </>
          )}
        </div>

        {/* Expand / Details Chevron */}
        <div className="text-stone-400 hover:text-stone-700 ml-1">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>
    </div>
  );
}
