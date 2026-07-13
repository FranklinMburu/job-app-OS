import { GoogleGenAI } from "@google/genai";
import { 
  ExtractedJob, 
  JobAnalysis, 
  GeneratedApplication, 
  SourceType, 
  UserProfile, 
  OutputMode, 
  Tone,
  AIModelOutput,
  EmploymentType,
  Seniority,
  ExtractionConfidence,
  RemotePolicy,
  ApplicationMethod
} from "../types";
import { auth, saveAILog } from "../lib/firebase";

const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || "" });

const executeAI = async (
  action: string, 
  model: string, 
  contents: any, 
  config: any = {}
): Promise<any> => {
  const startTime = Date.now();
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config
    });
    const latency = Date.now() - startTime;
    
    const uid = auth.currentUser?.uid;
    if (uid) {
      saveAILog({
        uid,
        model,
        action,
        prompt: typeof contents === 'string' ? contents : JSON.stringify(contents),
        response: response.text || "No text returned",
        latency_ms: latency,
        tokens_input: response.usageMetadata?.promptTokenCount,
        tokens_output: response.usageMetadata?.candidatesTokenCount
      });
    }
    
    return response;
  } catch (error) {
    const latency = Date.now() - startTime;
    const uid = auth.currentUser?.uid;
    if (uid) {
      saveAILog({
        uid,
        model,
        action: `${action}_ERROR`,
        prompt: typeof contents === 'string' ? contents : JSON.stringify(contents),
        response: error instanceof Error ? error.message : String(error),
        latency_ms: latency
      });
    }
    throw error;
  }
};

export const aiService = {
  async extractJob(content: string, sourceType: SourceType): Promise<{ model_output: AIModelOutput, normalized_job: ExtractedJob }> {
    const prompt = `Extraction: Job Board Intelligence & OCR Engine
You are a top-tier neural data extraction engine. JSON ONLY.
OUTPUT SCHEMA:
{
  "title": "Clean Role Title",
  "company": "Company Name",
  "location": "City, State/Country or 'Remote'",
  "employment_type": "full_time | part_time | contract | internship | temporary",
  "seniority": "intern | entry | junior | mid | senior | lead | staff | principal | director | executive",
  "remote_policy": "remote | hybrid | onsite | unknown",
  "salary_info": "Currency + Range",
  "summary": "Brief summary",
  "requirements": ["List"],
  "skills": ["List"],
  "benefits": ["List"],
  "culture_info": "Vibe",
  "application_instructions": "How to apply",
  "deadline": "Deadline"
}`;

    try {
      let contents;
      if (sourceType === SourceType.image && content.startsWith('data:image')) {
        const base64Data = content.split(',')[1];
        const mimeType = content.split(';')[0].split(':')[1];
        contents = {
          parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType: mimeType } }]
        };
      } else {
        contents = [{ text: prompt }, { text: `INPUT CONTENT:\n${content.substring(0, 30000)}` }];
      }

      const response = await executeAI("extractJob", "gemini-3.5-flash", contents, {
        responseMimeType: "application/json",
        temperature: 0.1
      });

      const extractedData = JSON.parse(response.text || "{}");
      return this.processExtractedData(extractedData, content, sourceType);
    } catch (error) {
      console.error("AI Extraction Error:", error);
      throw new Error("Failed to extract job details.");
    }
  },

  processExtractedData(extractedData: any, content: string, sourceType: SourceType) {
    const model_output: AIModelOutput = {
      title: extractedData.title ?? null,
      company: extractedData.company ?? null,
      location: extractedData.location ?? null,
      employment_type: extractedData.employment_type ?? null,
      seniority: extractedData.seniority ?? null,
      remote_policy: extractedData.remote_policy ?? null,
      salary_info: extractedData.salary_info ?? null,
      summary: extractedData.summary ?? null,
      requirements: extractedData.requirements ?? [],
      skills: extractedData.skills ?? [],
      benefits: extractedData.benefits ?? [],
      culture_info: extractedData.culture_info ?? null,
      application_instructions: extractedData.application_instructions ?? null,
      deadline: extractedData.deadline ?? null
    };
    
    const normalized_job: ExtractedJob = {
      title: model_output.title || "Untitled Job",
      company: model_output.company || "Unknown Company",
      location: model_output.location || "Not Specified",
      employment_type: (model_output.employment_type as EmploymentType | null),
      seniority: (model_output.seniority as Seniority | null),
      summary: model_output.summary || `Extracted role at ${model_output.company}`,
      requirements: model_output.requirements,
      required_skills: model_output.skills,
      preferred_skills: [],
      remote_policy: (model_output.remote_policy as RemotePolicy | null),
      salary_info: model_output.salary_info || null,
      application_method: (model_output.application_instructions?.toLowerCase().includes('email') ? ApplicationMethod.email : ApplicationMethod.portal),
      application_url: model_output.application_instructions?.includes('http') ? model_output.application_instructions : null,
      deadline: model_output.deadline || null,
      missing_fields: [],
      source_type: sourceType,
      raw_content: content.substring(0, 5000),
      model_output
    };

    return { model_output, normalized_job };
  },

  async analyzeJob(job: ExtractedJob, userProfile: UserProfile): Promise<JobAnalysis> {
    const prompt = `TASK: FIT ANALYSIS. JSON ONLY. JOB: ${JSON.stringify(job)}. CANDIDATE: ${JSON.stringify(userProfile)}`;
    try {
      const response = await executeAI("analyzeJob", "gemini-3.5-flash", prompt, {
        responseMimeType: "application/json",
        temperature: 0.2
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error("Failed analysis.");
    }
  },

  async generateInterviewPrep(job: ExtractedJob, userProfile: UserProfile): Promise<any> {
    const prompt = `TASK: INTERVIEW PREP. JSON ONLY. JOB: ${JSON.stringify(job)}. CANDIDATE: ${JSON.stringify(userProfile)}`;
    try {
      const response = await executeAI("generateInterviewPrep", "gemini-3.5-flash", prompt, {
        responseMimeType: "application/json",
        temperature: 0.4
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error("Failed interview prep.");
    }
  },

  async generateApplication(job: ExtractedJob, analysis: JobAnalysis, userProfile: UserProfile, outputMode: OutputMode, tone: Tone): Promise<GeneratedApplication> {
    const prompt = `TASK: GEN APP. JSON ONLY. JOB: ${job.title}. USER: ${userProfile.full_name}`;
    try {
      const response = await executeAI("generateApplication", "gemini-3.5-flash", prompt, {
        responseMimeType: "application/json",
        temperature: 0.7
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error("Failed app generation.");
    }
  },

  async generateFollowUp(job: ExtractedJob, userProfile: UserProfile, originalApp: GeneratedApplication): Promise<GeneratedApplication> {
    const prompt = `TASK: FOLLOW UP. JSON ONLY.`;
    try {
      const response = await executeAI("generateFollowUp", "gemini-3.5-flash", prompt, {
        responseMimeType: "application/json",
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error("Failed follow-up.");
    }
  },

  async synthesizeProfile(cvText: string): Promise<Partial<UserProfile>> {
    const prompt = `TASK: SYNTHESIZE PROFILE. JSON ONLY. CV: ${cvText.substring(0, 10000)}`;
    try {
      const response = await executeAI("synthesizeProfile", "gemini-3.5-flash", prompt, {
        responseMimeType: "application/json",
      });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      throw new Error("Failed synthesis.");
    }
  },

  async generateTailoredCV(job: ExtractedJob, userProfile: UserProfile): Promise<{ markdown_content: string }> {
    const prompt = `TASK: TAILOR CV. JOB: ${job.title}. MASTER CV: ${userProfile.cv_text}`;
    try {
      const response = await executeAI("generateTailoredCV", "gemini-3.5-flash", prompt);
      return { markdown_content: response.text || "" };
    } catch (error) {
      throw new Error("Failed tailored CV.");
    }
  },

  async generateMasterCV(userProfile: UserProfile): Promise<{ markdown_content: string }> {
    const prompt = `TASK: MASTER CV. PROFILE: ${userProfile.experience_summary}`;
    try {
      const response = await executeAI("generateMasterCV", "gemini-3.5-flash", prompt);
      return { markdown_content: response.text || "" };
    } catch (error) {
      throw new Error("Failed master CV.");
    }
  },

  async generateCoverLetter(job: ExtractedJob, userProfile: UserProfile): Promise<{ markdown_content: string }> {
    const prompt = `
TASK: ELITE GENAI ENVOY ARCHITECT
Style: Technical, Direct, High-Impact, Builder-Centric.
Role: A world-class engineer drafting a technical partnership proposal.

CANDIDATE: ${userProfile.full_name}
LOCATION: ${userProfile.location || "Nairobi, Kenya"}
TECH STACK: ${userProfile.skills?.join(', ') || "Full-stack Engineering"}
FULL EXPERIENCE: ${userProfile.cv_text?.substring(0, 3000)}

TARGET ENTITY: ${job.company}
ROLE: ${job.title}
JOB INTELLIGENCE: ${job.raw_excerpt?.substring(0, 1500)}

MISSION:
Do not write a generic application. Propose a technical solution to the specific challenges implied in the Job Intelligence. 

REQUIRED ARCHITECTURE:

1. HEADER: Name, Location, Contact.
2. DATE: [Current Date]
3. RECIPIENT: Hiring Manager at ${job.company}.
4. SUBJECT: **RE: ${job.title}**
5. THE HOOK: A high-signal opening that connects your background in GenAI/Backend directly to ${job.company}'s mission. Avoid "I'm applying for...". Start with: "I build production-ready ${job.title}-related systems..."
6. DYNAMIC PILLARS (3 Sections): Identify the 3 most critical technical needs in the job description (e.g., Automation, Scalability, Security, UI/UX, multi-tenancy). Create 3 bold headers and describe exactly how your specific history makes you the solution for those 3 needs. Use data/metrics from your CV.
7. CULTURAL & LOCAL SYNC: A short paragraph on why ${job.company}'s specific engineering culture fits your "builder" mentality. Mention being Nairobi-based for fast iteration if applicable.
8. THE PROACTIVE CLOSE: A confident request to discuss their current technical roadmap and how you can add immediate value.

STRICT CONSTRAINTS:
- ABSOLUTELY NO: "enterprising", "landscapes", "tapestry", "digital age".
- Use bold only for Subject and Section Headers.
- Word count: 280-350 words.
- Tone: Senior Engineer to Senior Engineer.
- Format: Markdown only.
`;
    try {
      const response = await executeAI("generateCoverLetter", "gemini-3.5-flash", prompt, { temperature: 0.6 });
      return { markdown_content: response.text || "Letter failed." };
    } catch (error) {
      throw new Error("Failed cover letter.");
    }
  },

  async verifyCVStructure(markdown: string): Promise<any> {
    const prompt = `TASK: VERIFY CV JSON. CV: ${markdown}`;
    try {
      const response = await executeAI("verifyCVStructure", "gemini-3.5-flash", prompt, { responseMimeType: "application/json" });
      return JSON.parse(response.text || "{}");
    } catch (error) {
      return { success: false, score: 0, logs: ["Offline"], pillarStatus: {} };
    }
  }
};
