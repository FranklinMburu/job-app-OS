import { GoogleGenAI } from "@google/genai";
import { 
  ExtractedJob, 
  JobAnalysis, 
  GeneratedApplication, 
  SourceType, 
  UserProfile, 
  OutputMode, 
  Tone
} from "../types";

// Initialize Gemini API
// Note: In this environment, GEMINI_API_KEY is provided in the environment.
const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || "" });

export const aiService = {
  async extractJob(content: string, sourceType: SourceType): Promise<ExtractedJob> {
    const prompt = `
      TASK: Extract job details from the provided ${sourceType}.
      
      INSTRUCTIONS:
      1. Extract all relevant job information into the specified JSON format.
      2. Identify the source platform (e.g., LinkedIn, Indeed, Company Website) and set 'source_label'.
      3. If a field is not found, leave it as null or an empty list as appropriate.
      4. For 'seniority', 'employment_type', 'remote_policy', and 'application_method', use ONLY the allowed enum values.
      5. For 'extraction_confidence', use 'high' only if the title, company, and requirements are clearly present.
      
      ENUM VALUES:
      - seniority: intern, junior, mid, senior, lead, unknown
      - employment_type: full_time, part_time, contract, internship, temporary, unknown
      - remote_policy: remote, hybrid, onsite, unknown
      - application_method: email, external_link, portal, unknown
      - extraction_confidence: low, medium, high
      
      SCHEMA:
      {
        "title": "Job title",
        "company": "Company name",
        "summary": "2-3 sentence overview",
        "requirements": ["List of key requirements"],
        "required_skills": ["List of technical skills"],
        "preferred_skills": ["List of nice-to-have skills"],
        "experience_years_required": "e.g. 3+ years",
        "seniority": "Enum value",
        "employment_type": "Enum value",
        "location": "City, State/Country or Remote",
        "remote_policy": "Enum value",
        "application_method": "Enum value",
        "application_email": "Email to apply to",
        "application_url": "URL to apply at",
        "deadline": "ISO 8601 date or raw string",
        "salary_info": "e.g. $120k - $150k",
        "source_label": "e.g. LinkedIn",
        "raw_excerpt": "A 200-300 character snippet of the original text",
        "missing_fields": ["List of missing important fields"],
        "extraction_confidence": "Enum value"
      }
    `;

    try {
      let contents;
      if (sourceType === SourceType.image && content.startsWith('data:image')) {
        const base64Data = content.split(',')[1];
        const mimeType = content.split(';')[0].split(':')[1];
        contents = {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        };
      } else {
        contents = prompt + `\n\nCONTENT:\n---\n${content.substring(0, 30000)}\n---`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          responseMimeType: "application/json",
        }
      });

      const data = JSON.parse(response.text || "{}");
      return {
        ...data,
        source_type: sourceType,
        raw_content: sourceType === SourceType.image ? content : content // content is already the raw text or base64
      };
    } catch (error) {
      console.error("AI Extraction Error:", error);
      throw new Error("Failed to extract job details. Please try again or provide more text.");
    }
  },

  async analyzeJob(job: ExtractedJob, userProfile: UserProfile): Promise<JobAnalysis> {
    const prompt = `
      TASK: Compare the job description and the user profile to determine fit.
      
      JOB DATA:
      ${JSON.stringify(job, null, 2)}
      
      USER PROFILE:
      ${JSON.stringify(userProfile, null, 2)}
      
      INSTRUCTIONS:
      1. Analyze the alignment between the job requirements and the user's skills/experience.
      2. Determine a 'verdict' (relevant, maybe, not_worth_it).
      3. Provide a 'apply_recommendation' (apply, apply_if_time, skip).
      4. List specific 'reasons' for the recommendation (strengths).
      5. List specific 'gaps' where the user might be lacking.
      6. Provide a concise 'fit_summary' explaining the overall match.
      7. Set a 'confidence' level for your analysis.
      
      OUTPUT FORMAT: JSON matching the JobAnalysis schema.
      {
        "verdict": "relevant | maybe | not_worth_it",
        "apply_recommendation": "apply | apply_if_time | skip",
        "reasons": ["string"],
        "gaps": ["string"],
        "fit_summary": "string",
        "confidence": "low | medium | high"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      throw new Error("Failed to analyze job fit. Please ensure your profile is complete.");
    }
  },

  async generateApplication(
    job: ExtractedJob, 
    analysis: JobAnalysis, 
    userProfile: UserProfile,
    outputMode: OutputMode,
    tone: Tone
  ): Promise<GeneratedApplication> {
    const prompt = `
      TASK: Generate a tailored job application (${outputMode}).
      
      JOB: ${JSON.stringify(job, null, 2)}
      ANALYSIS: ${JSON.stringify(analysis, null, 2)}
      PROFILE: ${JSON.stringify(userProfile, null, 2)}
      
      STRICT RULES:
      1. GROUNDING: Do not make fake claims.
      2. TONE: Use a ${tone} tone.
      3. MODE: The output_mode is ${outputMode}.
      4. CONCISENESS: Keep it professional.
      5. SUBJECT: Generate a concise, professional email subject line relevant to the job title.
      
      OUTPUT FORMAT: JSON matching the GeneratedApplication schema.
      {
        "output_mode": "${outputMode}",
        "subject": "string",
        "email_body": "string",
        "short_fit_answer": "string",
        "cover_note": "string",
        "attachment_note": "string",
        "generation_confidence": "low | medium | high"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Generation Error:", error);
      throw new Error("Failed to generate application content.");
    }
  },

  async generateFollowUp(
    job: ExtractedJob, 
    userProfile: UserProfile,
    originalApp: GeneratedApplication
  ): Promise<GeneratedApplication> {
    const prompt = `
      TASK: Generate a professional, polite, and concise follow-up email for a job application.
      
      JOB: ${JSON.stringify(job, null, 2)}
      ORIGINAL APPLICATION: ${JSON.stringify(originalApp, null, 2)}
      PROFILE: ${JSON.stringify(userProfile, null, 2)}
      
      STRICT RULES:
      1. TONE: Professional and polite.
      2. CONCISENESS: Keep it short (2-3 paragraphs max).
      3. SUBJECT: Generate a follow-up subject line (e.g., "Follow-up: [Original Subject]").
      
      OUTPUT FORMAT: JSON matching the GeneratedApplication schema.
      {
        "output_mode": "email",
        "subject": "string",
        "email_body": "string",
        "generation_confidence": "low | medium | high"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Follow-up Error:", error);
      throw new Error("Failed to generate follow-up content.");
    }
  },

  async synthesizeProfile(cvText: string): Promise<Partial<UserProfile>> {
    const prompt = `
      TASK: Extract structured professional profile data from the provided CV text.
      
      CV TEXT:
      ---
      ${cvText.substring(0, 30000)}
      ---
      
      INSTRUCTIONS:
      1. Extract the user's full name, email, phone, and location.
      2. Identify their target roles based on their experience.
      3. Extract a comprehensive list of technical and soft skills.
      4. Estimate their total years of professional experience.
      5. Write a concise 2-3 sentence experience summary.
      6. Identify preferred industries based on their work history.
      
      OUTPUT FORMAT: JSON matching a partial UserProfile schema.
      {
        "full_name": "string",
        "email": "string",
        "phone": "string",
        "location": "string",
        "target_roles": ["string"],
        "skills": ["string"],
        "years_of_experience": "string",
        "experience_summary": "string",
        "preferred_industries": ["string"]
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Synthesis Error:", error);
      throw new Error("Failed to synthesize profile from CV text.");
    }
  }
};
