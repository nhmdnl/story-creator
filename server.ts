import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { generateOpenRouterImage, generateHiggsfieldImage, generatePollinationsImage } from './server/imageGenerators';

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in the server environment.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' })); // Allow large JSON payloads for Drive save

  // Generation Proxy Route (Supports Gemini, OpenRouter, and Higgsfield)
  app.post('/api/gemini/generateContent', async (req, res) => {
    try {
      const { model, contents, config, provider } = req.body;

      // Check if routed to Pollinations AI (100% Free, No Key Required)
      if (provider === 'pollinations') {
        let promptText = '';
        if (typeof contents === 'string') {
          promptText = contents;
        } else if (contents?.parts && Array.isArray(contents.parts)) {
          promptText = contents.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n\n');
        } else if (contents?.text) {
          promptText = contents.text;
        }

        const result = await generatePollinationsImage({
          prompt: promptText,
          model: model || 'flux',
          aspectRatio: config?.imageConfig?.aspectRatio || '1:1'
        });

        return res.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: result.mimeType,
                      data: result.data
                    }
                  }
                ]
              }
            }
          ]
        });
      }

      // Check if routed to OpenRouter image generator
      if (provider === 'openrouter') {
        let promptText = '';
        if (typeof contents === 'string') {
          promptText = contents;
        } else if (contents?.parts && Array.isArray(contents.parts)) {
          promptText = contents.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n\n');
        } else if (contents?.text) {
          promptText = contents.text;
        }

        const result = await generateOpenRouterImage({
          prompt: promptText,
          model: model || 'black-forest-labs/flux-1-schnell',
          aspectRatio: '1:1'
        });

        return res.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: result.mimeType,
                      data: result.data
                    }
                  }
                ]
              }
            }
          ]
        });
      }

      // Check if routed to Higgsfield AI
      if (provider === 'higgsfield') {
        let promptText = '';
        if (typeof contents === 'string') {
          promptText = contents;
        } else if (contents?.parts && Array.isArray(contents.parts)) {
          promptText = contents.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n\n');
        } else if (contents?.text) {
          promptText = contents.text;
        }

        const result = await generateHiggsfieldImage({
          prompt: promptText,
          model: model || 'flux',
          aspectRatio: '1:1'
        });

        return res.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: result.mimeType,
                      data: result.data
                    }
                  }
                ]
              }
            }
          ]
        });
      }

      // Default: Google Gemini Generation
      const ai = getAIClient();

      let selectedModel = model;
      if (model === 'gemini-2.5-flash-image') {
        selectedModel = 'gemini-3.1-flash-image';
      }

      // Retry mechanism for transient 503 (high demand) errors
      let response: any;
      let lastErr: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: selectedModel,
            contents,
            config
          });
          break;
        } catch (genErr: any) {
          lastErr = genErr;
          const is503 = genErr.status === 503 || genErr.code === 503 || 
                        genErr.message?.includes('503') || 
                        genErr.message?.includes('UNAVAILABLE') || 
                        genErr.message?.includes('high demand');
          if (is503 && attempt < 3) {
            console.warn(`[Gemini API] 503 High demand on ${selectedModel}. Retrying in ${attempt * 1200}ms...`);
            await new Promise(r => setTimeout(r, attempt * 1200));
            // On second retry, fallback to gemini-2.5-flash if text model is busy
            if (attempt === 2 && !selectedModel.includes('image')) {
              selectedModel = 'gemini-2.5-flash';
              console.log(`[Gemini API] Switching to resilient model: ${selectedModel}`);
            }
            continue;
          }
          throw genErr;
        }
      }

      const text = response.text || '';
      res.json({
        ...response,
        text,
        candidates: response.candidates || []
      });
    } catch (error: any) {
      console.error('Generation API error:', error);
      const status = error.status || error.code || 500;
      const rawMsg = error.message || '';
      const isQuotaError = status === 429 || rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED');
      const isFreeTierLimitZero = rawMsg.includes('limit: 0') || rawMsg.includes('free_tier_requests');
      const isUnavailable = status === 503 || rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand');

      let userFriendlyMessage = rawMsg || 'Generation API call failed';
      if (isFreeTierLimitZero) {
        userFriendlyMessage = 'Gemini image models require a paid API key with billing enabled. Please use Pollinations (Free) or OpenRouter in Settings.';
      } else if (isQuotaError) {
        userFriendlyMessage = 'API Rate Limit exceeded (429). Please wait a few seconds before generating again, or switch providers in Settings.';
      } else if (isUnavailable) {
        userFriendlyMessage = 'The AI model is experiencing high demand. Please try clicking Generate again in a few moments.';
      }

      res.status(typeof status === 'number' && status >= 400 && status < 600 ? status : 500).json({
        error: {
          code: error.code || status,
          message: userFriendlyMessage,
          status: error.status || (isUnavailable ? 'UNAVAILABLE' : isQuotaError ? 'RESOURCE_EXHAUSTED' : 'UNKNOWN'),
          isQuotaExceeded: isQuotaError,
          isPaidKeyRequired: isFreeTierLimitZero
        }
      });
    }
  });

  // Providers Status Endpoint
  app.get('/api/providers/status', (req, res) => {
    res.json({
      pollinations: {
        id: 'pollinations',
        name: 'Pollinations.ai (Free - No Key Needed)',
        configured: true,
        defaultModel: 'flux',
        models: [
          { id: 'flux', name: 'FLUX.1 (High Detail & Storybook)' },
          { id: 'flux-realism', name: 'FLUX Realism (Photorealistic)' },
          { id: 'flux-anime', name: 'FLUX Anime / Manga Style' },
          { id: 'flux-3d', name: 'FLUX 3D Render' },
          { id: 'turbo', name: 'SDXL Turbo (Fastest)' }
        ]
      },
      gemini: {
        id: 'gemini',
        name: 'Google Gemini (Native)',
        configured: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
        defaultModel: 'gemini-3.1-flash-image',
        models: [
          { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (Final)' },
          { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash-Lite Image (Draft)' }
        ]
      },
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter Image Hub',
        configured: !!process.env.OPENROUTER_API_KEY,
        defaultModel: 'black-forest-labs/flux-1-schnell',
        models: [
          { id: 'black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell (Fast & Crisp)' },
          { id: 'black-forest-labs/flux-1-dev', name: 'FLUX.1 Dev (Storybook Artistry)' },
          { id: 'recraft-ai/recraft-v3', name: 'Recraft v3 (Vector & Book Illustration)' },
          { id: 'stabilityai/stable-diffusion-3-medium', name: 'Stable Diffusion 3 Medium' },
          { id: 'bytedance-seed/seedream-4.5', name: 'Seedream 4.5' }
        ]
      },
      higgsfield: {
        id: 'higgsfield',
        name: 'Higgsfield AI',
        configured: !!(process.env.HIGGSFIELD_API_KEY || process.env.HUGGSFIELD_API_KEY),
        defaultModel: 'flux',
        models: [
          { id: 'flux', name: 'Higgsfield FLUX Generative Model' }
        ]
      }
    });
  });

  // OAuth Routes
  app.get('/api/auth/google/url', (req, res) => {
    const redirectUri = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/auth/callback`;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      return res.status(400).json({ 
        error: 'Google Drive client credentials are not configured yet in this environment.',
        isConfigured: false
      });
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent'
    });
    
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, isConfigured: true });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    const redirectUri = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/auth/callback`;
    
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      
      const tokens = await tokenResponse.json();
      
      if (tokens.access_token) {
        res.cookie('google_access_token', tokens.access_token, {
          secure: true,
          sameSite: 'none',
          httpOnly: true,
          maxAge: tokens.expires_in * 1000
        });
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.post('/api/drive/save', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.slice(7) 
      : req.cookies.google_access_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated with Google' });

    const { filename, content } = req.body;

    try {
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const contentType = 'application/json';
      const metadata = {
        name: filename,
        mimeType: contentType
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(content) +
        close_delim;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to upload to Drive');
      }
      res.json(result);
    } catch (error: any) {
      console.error('Drive save error:', error);
      res.status(500).json({ error: error.message || 'Failed to save to Drive' });
    }
  });

  app.get('/api/auth/status', (req, res) => {
    res.json({ 
      isAuthenticated: !!req.cookies.google_access_token,
      isConfigured: !!process.env.GOOGLE_CLIENT_ID
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('google_access_token', { secure: true, sameSite: 'none', httpOnly: true });
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
