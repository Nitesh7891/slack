import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Schema that Gemini must conform to when returning parsed tasks.
 * Maps onto our Task model fields as closely as possible.
 */
const taskSchema = {
  type: 'array',
  description: 'List of tasks extracted from the stand-up message.',
  items: {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: "Team member name who owns this task. Default to 'Unknown' if not found.",
      },
      taskName: {
        type: 'string',
        description: 'The specific task being worked on. Ignore headings and attendance notes.',
      },
      status: {
        type: 'string',
        description:
          "One of: 'PROCESSING' (in progress), 'COMPLETED' (done), 'BLOCKED' (blocked by something). Defaults to 'PROCESSING'.",
      },
      priority: {
        type: 'string',
        description:
          "One of: 'Low', 'Medium', 'High', 'Critical'. Infer from urgency words. Default to 'Medium'.",
      },
      workflowStage: {
        type: 'string',
        description:
          "One of: 'DEVELOPMENT', 'QA', 'REVIEW', 'PRODUCTION'. Infer from context. Default to 'DEVELOPMENT'.",
      },
      blockerDescription: {
        type: 'string',
        description: 'If the task is BLOCKED, describe what is blocking it. Otherwise null.',
      },
    },
    required: ['owner', 'taskName', 'status', 'priority', 'workflowStage'],
  },
};

/**
 * Sends raw standup text to Gemini and returns an array of structured tasks.
 * @param {string} rawText - The compiled standup messages (member + message pairs)
 * @returns {Promise<Array>} Array of parsed task objects
 */
export async function parseStandupMessage(rawText) {
  if (!rawText || rawText.trim() === '') {
    throw new Error('No standup text provided for parsing.');
  }

  const prompt = `
You are a scrum master AI. Parse the following daily stand-up messages and extract every individual task mentioned.

Rules:
- Each task should be a separate item in the array.
- Map status words: "done"/"finished"/"completed" → COMPLETED, "blocked"/"waiting"/"stuck" → BLOCKED, everything else → PROCESSING.
- Map priority: "urgent"/"critical"/"production" → Critical or High, "low priority" → Low, default → Medium.
- Map stage: "qa"/"testing" → QA, "review"/"PR" → REVIEW, "prod"/"deploy"/"release" → PRODUCTION, default → DEVELOPMENT.
- Ignore greetings, attendance, and headings.
- The "owner" field should match exactly the "Member:" name in the message.

Stand-up messages:
${rawText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: taskSchema,
      },
    });

    const parsed = JSON.parse(response.text);
    console.log(`✅ Gemini parsed ${parsed.length} task(s).`);
    return parsed;
  } catch (error) {
    console.error('❌ Gemini Parsing Error:', error.message);
    throw new Error('Failed to parse standup message via AI.');
  }
}