/**
 * LLM Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives a conversation history (array of {role, content} messages)
 * and returns the AI's next response as a string.
 *
 * Currently: stub that returns a hardcoded reply.
 * Replace the body of `askLLM` with your preferred AI provider.
 *
 * Options to plug in:
 *   • Google Gemini  → npm install @google/generative-ai
 *   • OpenAI / GPT   → npm install openai
 *   • Anthropic Claude → npm install @anthropic-ai/sdk
 *   • Azure OpenAI   → use the openai SDK with an Azure base URL
 */

import logger from "../logger.ts";

type Message = { role: string; content: string };

// System prompt — defines your bot's personality and capabilities
const SYSTEM_PROMPT = `You are a helpful AI voice assistant.
Keep your responses concise and conversational — 1 to 3 sentences max.
You are speaking to someone on the phone, so avoid using lists or markdown formatting.`;

export async function askLLM(history: Message[]): Promise<string> {
  logger.debug({ turns: history.length }, "LLM: processing conversation");

  // ── TODO: Replace this stub with real LLM ─────────────────────────────────
  //
  // Example using Google Gemini:
  //
  // import { GoogleGenerativeAI } from "@google/generative-ai";
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  // const chat = model.startChat({
  //   systemInstruction: SYSTEM_PROMPT,
  //   history: history.slice(0, -1).map(m => ({
  //     role: m.role === "assistant" ? "model" : "user",
  //     parts: [{ text: m.content }],
  //   })),
  // });
  // const result = await chat.sendMessage(history.at(-1)!.content);
  // return result.response.text();
  //
  // ── Example using OpenAI / Azure OpenAI ───────────────────────────────────
  //
  // import OpenAI from "openai";
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const completion = await openai.chat.completions.create({
  //   model: "gpt-4o",
  //   messages: [
  //     { role: "system", content: SYSTEM_PROMPT },
  //     ...history,
  //   ],
  // });
  // return completion.choices[0].message.content ?? "";
  // ───────────────────────────────────────────────────────────────────────────

  // Stub: simulate LLM latency
  await new Promise((r) => setTimeout(r, 500));
  const lastUserMessage = history.findLast((m) => m.role === "user")?.content;
  return `I heard you say: "${lastUserMessage}". How can I help you further?`;
}
