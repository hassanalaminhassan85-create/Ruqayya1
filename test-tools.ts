import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'MISSING' });

async function run() {
  const tools = [{
    functionDeclarations: [
      {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.STRING }
          },
          required: ["value"]
        }
      } as FunctionDeclaration
    ]
  }];
  
  // Just testing if the types compile
  console.log("Types compile!", Type.OBJECT);
}
run();
