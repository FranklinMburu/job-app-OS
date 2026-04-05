import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { 
  ExtractedJob, 
  JobAnalysis, 
  GeneratedApplication, 
  UserProfile, 
  SourceType, 
  ExtractionConfidence,
  Seniority,
  EmploymentType,
  RemotePolicy,
  ApplicationMethod,
  Verdict,
  ApplyRecommendation,
  Confidence,
  Tone,
  OutputMode
} from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

// Initialize AI
const getAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY as string) || (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey });
};

// Logging Middleware
async function logAIInteraction(action: string, prompt: string, response: string, latency: number) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "ai_logs"), {
      uid: user.uid,
      model: MODEL_NAME,
      action,
      prompt,
      response,
      latency_ms: latency,
      timestamp: Timestamp.now(),
      // Token counting is not directly available in the simple response, 
      // but we can estimate or leave as null if not provided by SDK
      tokens_input: prompt.length / 4, // Rough estimate
      tokens_output: response.length / 4 // Rough estimate
    });
  } catch (err) {
    console.error("Failed to log AI interaction:", err);
  }
}

export const geminiService = {
  async extractJob(content: string, sourceType: SourceType): Promise<ExtractedJob> {
    const ai = getAI();
    const startTime = Date.now();
    
    const prompt = `
      TASK: Extract job details from the provided content.
      SOURCE TYPE: ${sourceType}
      CONTENT:
      ---
      ${content}
      ---
      
      STRICT RULES:
      1. GROUNDING: Only use information present in the content.
      2. NULLS: Use null for missing string fields.
      3. ENUMS: Use 'unknown' for missing enum fields.
      4. LISTS: Use [] for missing list fields.
      5. FORMAT: Return valid JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            summary: { type: Type.STRING },
            requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
            required_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            preferred_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience_years_required: { type: Type.STRING },
            seniority: { type: Type.STRING },
            employment_type: { type: Type.STRING },
            location: { type: Type.STRING },
            remote_policy: { type: Type.STRING },
            application_method: { type: Type.STRING },
            application_email: { type: Type.STRING },
            application_url: { type: Type.STRING },
            deadline: { type: Type.STRING },
            salary_info: { type: Type.STRING },
            missing_fields: { type: Type.ARRAY, items: { type: Type.STRING } },
            extraction_confidence: { type: Type.STRING }
          },
          required: ["title", "company", "extraction_confidence"]
        }
      }
    });

    const resultText = response.text || "{}";
    const latency = Date.now() - startTime;
    await logAIInteraction("extract_job", prompt, resultText, latency);

    const data = JSON.parse(resultText);
    return {
      ...data,
      source_type: sourceType,
      captured_at: Timestamp.now()
    };
  },

  async analyzeJob(job: ExtractedJob, profile: UserProfile): Promise<JobAnalysis> {
    const ai = getAI();
    const startTime = Date.now();

    const prompt = `
      TASK: Compare the job description and the user profile to determine fit.
      
      JOB DATA:
      ${JSON.stringify(job, null, 2)}
      
      USER PROFILE:
      ${JSON.stringify(profile, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING },
            apply_recommendation: { type: Type.STRING },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
            gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.STRING },
            fit_summary: { type: Type.STRING }
          },
          required: ["verdict", "apply_recommendation", "fit_summary"]
        }
      }
    });

    const resultText = response.text || "{}";
    const latency = Date.now() - startTime;
    await logAIInteraction("analyze_job", prompt, resultText, latency);

    return JSON.parse(resultText);
  },

  async generateApplication(
    job: ExtractedJob, 
    analysis: JobAnalysis, 
    profile: UserProfile, 
    mode: OutputMode, 
    tone: Tone
  ): Promise<GeneratedApplication> {
    const ai = getAI();
    const startTime = Date.now();

    const prompt = `
      TASK: Generate a tailored job application (${mode}).
      TONE: ${tone}
      
      JOB: ${JSON.stringify(job, null, 2)}
      ANALYSIS: ${JSON.stringify(analysis, null, 2)}
      PROFILE: ${JSON.stringify(profile, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            email_body: { type: Type.STRING },
            short_fit_answer: { type: Type.STRING },
            cover_note: { type: Type.STRING },
            generation_confidence: { type: Type.STRING }
          },
          required: ["generation_confidence"]
        }
      }
    });

    const resultText = response.text || "{}";
    const latency = Date.now() - startTime;
    await logAIInteraction("generate_application", prompt, resultText, latency);

    const data = JSON.parse(resultText);
    return {
      ...data,
      output_mode: mode,
      applied_at: Timestamp.now()
    };
  },

  async generateFollowUp(job: ExtractedJob, application: GeneratedApplication): Promise<string> {
    const ai = getAI();
    const startTime = Date.now();

    const prompt = `
      TASK: Generate a professional follow-up email for a job application sent 1 week ago.
      JOB: ${job.title} at ${job.company}
      PREVIOUS APP: ${application.subject}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are a professional career assistant. Generate a concise, polite follow-up email."
      }
    });

    const resultText = response.text || "";
    const latency = Date.now() - startTime;
    await logAIInteraction("generate_follow_up", prompt, resultText, latency);

    return resultText;
  }
};
