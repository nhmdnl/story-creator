export interface ImageGenResult {
  mimeType: string;
  data: string; // base64 string without data: prefix
}

async function urlToBase64(url: string): Promise<ImageGenResult> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image from ${url}: ${res.statusText}`);
  }
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const mimeType = res.headers.get('content-type') || 'image/png';
  return { mimeType, data: base64 };
}

export async function generateOpenRouterImage(params: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  referenceImageBase64?: string;
}): Promise<ImageGenResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in the environment. Please add it to your environment variables.');
  }

  const model = params.model || 'black-forest-labs/flux-1-schnell';
  const prompt = params.prompt;

  // Try OpenRouter dedicated Images API first
  const requestBody: any = {
    model,
    prompt,
    aspect_ratio: params.aspectRatio || '1:1'
  };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.APP_URL || 'https://storyflow.app',
    'X-Title': 'StoryFlow Storybook Studio'
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const json = await response.json();
      const firstItem = json.data?.[0];
      if (firstItem?.b64_json) {
        return {
          mimeType: firstItem.media_type || 'image/png',
          data: firstItem.b64_json
        };
      }
      if (firstItem?.url) {
        return await urlToBase64(firstItem.url);
      }
    } else {
      const errorText = await response.text();
      let errorMsg = `OpenRouter Image API failed (${response.status}): ${errorText}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error?.message || errorMsg;
      } catch {
        // use raw
      }

      // If /api/v1/images didn't work for this model, try the OpenAI-compatible images/generations
      const fallbackResponse = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json'
        })
      });

      if (fallbackResponse.ok) {
        const fallbackJson = await fallbackResponse.json();
        const item = fallbackJson.data?.[0];
        if (item?.b64_json) {
          return { mimeType: 'image/png', data: item.b64_json };
        }
        if (item?.url) {
          return await urlToBase64(item.url);
        }
      }

      // Also try OpenRouter chat/completions multimodal endpoint (e.g. for Gemini/GPT image models)
      const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text']
        })
      });

      if (chatResponse.ok) {
        const chatJson = await chatResponse.json();
        const choice = chatJson.choices?.[0]?.message;
        if (choice) {
          // Check for parts inlineData
          if (choice.parts && Array.isArray(choice.parts)) {
            for (const part of choice.parts) {
              if (part.inlineData?.data) {
                return {
                  mimeType: part.inlineData.mimeType || 'image/png',
                  data: part.inlineData.data
                };
              }
              if (part.image_url?.url) {
                const url = part.image_url.url;
                if (url.startsWith('data:')) {
                  const [header, data] = url.split(',');
                  const mime = header.split(';')[0].replace('data:', '') || 'image/png';
                  return { mimeType: mime, data };
                }
                return await urlToBase64(url);
              }
            }
          }
          // Check for data:image in content string
          if (typeof choice.content === 'string') {
            const dataUrlMatch = choice.content.match(/data:(image\/[a-zA-Z0-9+]+);base64,([a-zA-Z0-9+/=]+)/);
            if (dataUrlMatch) {
              return { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] };
            }
            const httpUrlMatch = choice.content.match(/(https:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp))/i);
            if (httpUrlMatch) {
              return await urlToBase64(httpUrlMatch[1]);
            }
          }
        }
      }

      throw new Error(errorMsg);
    }
  } catch (err: any) {
    console.error('OpenRouter generation error:', err);
    throw err;
  }

  throw new Error('No image returned by OpenRouter API');
}

export async function generateHiggsfieldImage(params: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
}): Promise<ImageGenResult> {
  const apiKey = process.env.HIGGSFIELD_API_KEY || process.env.HUGGSFIELD_API_KEY;
  if (!apiKey) {
    throw new Error('HIGGSFIELD_API_KEY is not configured in the environment. Please add it to your environment variables.');
  }

  const model = params.model || 'flux';
  const prompt = params.prompt;

  const response = await fetch('https://api.higgsfield.ai/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task: 'text-to-image',
      model,
      prompt,
      aspect_ratio: params.aspectRatio || '1:1'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = `Higgsfield AI failed (${response.status})`;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.message || parsed.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const result = await response.json();

  // If immediate image URL or base64 is returned:
  if (result.image_url || result.url) {
    return await urlToBase64(result.image_url || result.url);
  }
  if (result.data?.[0]?.b64_json) {
    return { mimeType: 'image/png', data: result.data[0].b64_json };
  }
  if (result.data?.[0]?.url) {
    return await urlToBase64(result.data[0].url);
  }

  // If async task ID is returned: poll for completion
  const taskId = result.id || result.task_id;
  if (taskId) {
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(res => setTimeout(res, 2000));
      const statusRes = await fetch(`https://api.higgsfield.ai/v1/generations/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
      });
      if (statusRes.ok) {
        const taskData = await statusRes.json();
        if (taskData.status === 'completed' || taskData.status === 'succeeded') {
          const finalUrl = taskData.output?.url || taskData.image_url || taskData.url;
          if (finalUrl) return await urlToBase64(finalUrl);
        }
        if (taskData.status === 'failed') {
          throw new Error(taskData.error || 'Higgsfield image generation failed.');
        }
      }
    }
  }

  throw new Error('Higgsfield did not return completed image data in time.');
}

function cleanPromptForImageGen(prompt: string): string {
  if (!prompt) return 'storybook illustration';
  // Remove markdown formatting that confuses diffusion models
  let cleaned = prompt
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If prompt exceeds 1200 characters, truncate cleanly at sentence boundary to stay within token limits
  if (cleaned.length > 1200) {
    const truncated = cleaned.slice(0, 1200);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 600) {
      cleaned = truncated.slice(0, lastPeriod + 1);
    } else {
      cleaned = truncated;
    }
  }
  return cleaned;
}

export async function generatePollinationsImage(params: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  seed?: number;
}): Promise<ImageGenResult> {
  const primaryModel = params.model || 'flux';
  const cleanPrompt = cleanPromptForImageGen(params.prompt);
  const seed = params.seed ?? Math.floor(Math.random() * 10000000);

  // Map aspect ratio to dimensions supported cleanly by diffusion models
  let width = 1024;
  let height = 1024;
  if (params.aspectRatio === '4:3') {
    width = 1024;
    height = 768;
  } else if (params.aspectRatio === '3:4') {
    width = 768;
    height = 1024;
  } else if (params.aspectRatio === '16:9') {
    width = 1280;
    height = 720;
  } else if (params.aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  }

  // Build model fallback sequence: selected model -> turbo (super resilient & fast) -> flux -> default
  const modelCandidates = Array.from(new Set([primaryModel, 'turbo', 'flux', '']));
  let lastError: any = null;

  // 1. Try POST request with JSON payload (robust against URL length issues)
  for (const candidateModel of modelCandidates) {
    try {
      const body: any = {
        prompt: cleanPrompt,
        width,
        height,
        seed,
        nologo: true
      };
      if (candidateModel) {
        body.model = candidateModel;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch('https://image.pollinations.ai/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'StoryForge/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        // Verify response is actually an image and not an HTML error
        if (contentType.startsWith('image/') || contentType.includes('octet-stream')) {
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength > 1000) {
            const base64 = Buffer.from(arrayBuf).toString('base64');
            const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
            return { mimeType, data: base64 };
          }
        }
      }

      const errText = await res.text().catch(() => '');
      console.warn(`[Pollinations] POST with model '${candidateModel || 'default'}' returned ${res.status}: ${errText.slice(0, 150)}`);
      lastError = new Error(`Pollinations error (${res.status}): ${errText.slice(0, 150)}`);
    } catch (e: any) {
      console.warn(`[Pollinations] POST failed with model '${candidateModel || 'default'}':`, e.message);
      lastError = e;
    }
  }

  // 2. Fallback: Try GET request with concise encoded prompt
  try {
    const compactPrompt = encodeURIComponent(cleanPrompt.slice(0, 400));
    const getUrl = `https://image.pollinations.ai/prompt/${compactPrompt}?model=turbo&width=${width}&height=${height}&seed=${seed}&nologo=true`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(getUrl, {
      headers: { 'User-Agent': 'StoryForge/1.0' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          const base64 = Buffer.from(arrayBuf).toString('base64');
          return { mimeType: contentType, data: base64 };
        }
      }
    }
  } catch (e: any) {
    console.warn('[Pollinations] GET fallback failed:', e.message);
  }

  throw new Error(
    `Pollinations AI is currently experiencing high server traffic. ${lastError?.message || 'Please retry in a moment.'}`
  );
}

