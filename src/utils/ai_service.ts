import { GoogleGenAI } from '@google/genai';

export interface AIServiceOptions {
  model?: string;
  stream?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

// Ensure TypeScript knows the structure of Cloudflare bindings when compiled
export interface CFEnv {
  ruqayya?: {
    run: (model: string, options: any) => Promise<any>;
  };
}

export class WorkersAIService {
  private env: CFEnv;

  constructor(env: CFEnv = {}) {
    this.env = env;
  }

  /**
   * Cleans sensitive attributes from the context to prevent accidental leakages
   */
  public static cleanContext(context: any): any {
    if (!context) return context;
    const cleaned = JSON.parse(JSON.stringify(context));
    
    const removeSensitive = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      if (Array.isArray(obj)) {
        obj.forEach(removeSensitive);
        return;
      }
      
      const sensitiveKeys = [
        'password_hash', 'password', 'passwordhash', 'token', 'session_token', 
        'sessiontoken', 'pin', 'transaction_pin', 'secret', 'secret_key', 
        'apikey', 'api_key', 'private_key', 'recovery_code', 'otp', 
        'verification_code', 'jwt', 'cookie', 'credentials'
      ];
      
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          delete obj[key];
        } else {
          removeSensitive(obj[key]);
        }
      }
    };
    
    removeSensitive(cleaned);
    return cleaned;
  }

  /**
   * Main text generation router supporting Cloudflare Workers AI with fallback to Gemini API
   */
  public async generate(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: AIServiceOptions = {}
  ): Promise<string> {
    const model = options.model || '@cf/meta/llama-3.1-8b-instruct';
    const maxRetries = options.maxRetries ?? 3;
    const timeoutMs = options.timeoutMs ?? 15000;

    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        // Option A: Real Workers AI Binding or Remote REST API
        if (this.env.ruqayya && typeof this.env.ruqayya.run === 'function') {
          const runPromise = this.env.ruqayya.run(model, {
            messages,
            stream: false
          });

          // Timeout wrapper
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Workers AI request timed out.')), timeoutMs)
          );

          const response: any = await Promise.race([runPromise, timeoutPromise]);
          if (response && response.response) {
            return response.response.trim();
          }
          if (typeof response === 'string') {
            return response.trim();
          }
          throw new Error('Invalid response structure from Workers AI binding.');
        } else {
          // Fallback: Direct Cloudflare REST API if account credentials are provided
          const cfAccountId = (this.env as any)?.CLOUDFLARE_ACCOUNT_ID || (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_ACCOUNT_ID : undefined);
          const cfApiToken = (this.env as any)?.CLOUDFLARE_API_TOKEN || (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_API_TOKEN : undefined);
          
          if (cfAccountId && cfApiToken) {
            const runPromise = fetch(
              `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cfApiToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  messages,
                  stream: false
                })
              }
            ).then(async (res) => {
              if (!res.ok) {
                const text = await res.text();
                throw new Error(`Cloudflare API returned status ${res.status}: ${text}`);
              }
              return res.json();
            });

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Workers AI REST request timed out.')), timeoutMs)
            );

            const response: any = await Promise.race([runPromise, timeoutPromise]);
            if (response && response.result && typeof response.result.response === 'string') {
              return response.result.response.trim();
            }
            throw new Error('Invalid response structure from Cloudflare Workers AI REST API.');
          }
        }

        // Option B: Local/Preview Fallback via Gemini API
        const apiKey = (this.env as any)?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
        if (apiKey) {
          const ai = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });

          // Translate standard chat messages to Gemini's format
          const systemMsg = messages.find(m => m.role === 'system');
          const chatHistory = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: chatHistory,
            config: {
              systemInstruction: systemMsg?.content,
              temperature: 0.2
            }
          });

          const resText = response.text || '';
          return resText.trim();
        }

        // Option C: Hard static fallback for offline sandbox testing
        return "RUQAYYA AI Offline Mode: Please ensure Cloudflare Workers AI binding 'ruqayya' or GEMINI_API_KEY environment variable is configured to receive live AI insights.";
      } catch (error: any) {
        console.error(`AI generate attempt ${attempt} failed:`, error.message);
        if (attempt >= maxRetries) {
          throw new Error(`AI Service unavailable after ${maxRetries} attempts: ${error.message}`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 200));
      }
    }
    throw new Error('AI Service failed to respond.');
  }

  /**
   * Streaming text generator for raw chunks, wrapping Workers AI & Gemini streams
   */
  public async *generateStream(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: AIServiceOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const model = options.model || '@cf/meta/llama-3.1-8b-instruct';

    try {
      // Option A: Real Workers AI Streaming or Remote REST API Streaming
      if (this.env.ruqayya && typeof this.env.ruqayya.run === 'function') {
        const response: any = await this.env.ruqayya.run(model, {
          messages,
          stream: true
        });

        // Cloudflare returns a ReadableStream
        if (response instanceof ReadableStream) {
          const reader = response.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // Workers AI stream returns SSE lines (data: {...})
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') break;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.response) {
                    yield parsed.response;
                  }
                } catch {
                  // If not valid JSON, yield raw data
                  yield dataStr;
                }
              }
            }
          }
          return;
        }
        throw new Error('Workers AI binding did not return a stream.');
      } else {
        // Fallback: Direct Cloudflare REST API Streaming
        const cfAccountId = (this.env as any)?.CLOUDFLARE_ACCOUNT_ID || (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_ACCOUNT_ID : undefined);
        const cfApiToken = (this.env as any)?.CLOUDFLARE_API_TOKEN || (typeof process !== 'undefined' ? process.env?.CLOUDFLARE_API_TOKEN : undefined);
        
        if (cfAccountId && cfApiToken) {
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${cfApiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messages,
                stream: true
              })
            }
          );

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Cloudflare API returned status ${res.status}: ${text}`);
          }

          const bodyReader = res.body;
          if (bodyReader) {
            const reader = bodyReader.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const dataStr = line.slice(5).trim();
                  if (dataStr === '[DONE]') break;
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.response) {
                      yield parsed.response;
                    }
                  } catch {
                    yield dataStr;
                  }
                }
              }
            }
            return;
          }
          throw new Error('Cloudflare REST API did not return a stream.');
        }
      }

      // Option B: Local/Preview Fallback Streaming via Gemini API
      const apiKey = (this.env as any)?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
      if (apiKey) {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const systemMsg = messages.find(m => m.role === 'system');
        const chatHistory = messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.5-flash',
          contents: chatHistory,
          config: {
            systemInstruction: systemMsg?.content,
            temperature: 0.2
          }
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            yield chunk.text;
          }
        }
        return;
      }

      // Option C: Hard static fallback streaming
      const fallbackStr = "RUQAYYA AI Sandbox Streaming: Active D1 context digested successfully. Please bind Workers AI in wrangler.json for edge compilation.";
      for (const word of fallbackStr.split(' ')) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } catch (error: any) {
      console.error('AI Stream generation failed:', error.message);
      yield `[AI ERROR: ${error.message}]`;
    }
  }
}
