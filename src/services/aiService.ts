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
  ExtractionConfidence
} from "../types";

// Initialize Gemini API
// Note: In this environment, GEMINI_API_KEY is provided in the environment.
const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || "" });

export const aiService = {
  async extractJob(content: string, sourceType: SourceType): Promise<{ model_output: AIModelOutput, normalized_job: ExtractedJob }> {
    const prompt = `
Extraction: Job Board Intelligence
You are a strict data extraction engine specializing in job postings.

Your task is to extract structured job information from raw job description text or images.

RULES:
* Return ONLY valid JSON
* No explanations, markdown, or extra text
* Do NOT hallucinate missing fields. If data is missing, return null or empty array.

OUTPUT FORMAT:
{
  "title": "string | null",
  "company": "string | null",
  "location": "string | null",
  "employment_type": "string | null",
  "seniority": "string | null",
  "summary": "string | null",
  "requirements": ["string"],
  "skills": ["string"]
}

EXTRACTION GUIDELINES:

* "title": The official job role. 
  - EDGE CASE: If the title is buried in a sentence like "We are seeking a [Role] to join...", extract "[Role]".
  - CLEANING: Remove locations, company names, and salary info from the title (e.g., "Fullstack Developer - Remote - 100k" -> "Fullstack Developer").
  - FORMAT: Use Title Case.

* "company": The specific hiring entity.
  - EDGE CASE: If a recruiter says "Hiring for our client in the Fintech space", return null for company unless the client name is explicitly named. 
  - PROSE: Look for phrases like "Join the team at [Company]" or "[Company] is looking for...".
  - DO NOT return the name of the job board (e.g., "LinkedIn", "Indeed") as the company.

* "requirements": A clean, merged list of responsibilities and mandatory qualifications. Max 15 items.
* "skills": Explicit tools (e.g., React, AWS), programming languages, and hard competencies.
* "seniority": One of: Intern, Entry, Junior, Mid, Senior, Lead, Staff, Principal, Director, Executive. Infer from context.

EXAMPLES (EDGE CASES):
1. INPUT: "Exciting opportunity for a Python expert to help our growth at EcoTech Solutions."
   -> title: "Python Expert", company: "EcoTech Solutions"

2. INPUT: "Software Engineer (Javascript/Node) | Global Bank | New York"
   -> title: "Software Engineer (Javascript/Node)", company: "Global Bank", location: "New York"

3. INPUT: "We are an industry-leading startup in AI looking for a Senior Product Manager."
   -> title: "Senior Product Manager", company: null (name not provided)
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
        contents = prompt + `\n\nINPUT:\n${content.substring(0, 30000)}`;
      }

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config: {
            responseMimeType: "application/json",
          }
        });

        const extractedData = JSON.parse(response.text || "{}");
        return this.processExtractedData(extractedData, content, sourceType);
      } catch (visionError) {
        // Robust Fallback: If vision fails (quota, network, etc.), use Tesseract
        if (sourceType === SourceType.image && content.startsWith('data:image')) {
          console.warn("[AI Service] Gemini Vision failed. Falling back to local Tesseract OCR...", visionError);
          const { ocrService } = await import("./ocrService");
          const extractedText = await ocrService.tesseractOCR(content);
          
          if (!extractedText || extractedText.trim().length < 10) {
            throw new Error("OCR failed to find legible text in this image.");
          }

          // Recursive call but as text source type to get structure
          return this.extractJob(extractedText, SourceType.text);
        }
        throw visionError;
      }
    } catch (error) {
      console.error("AI Extraction Error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to extract job details.");
    }
  },

  processExtractedData(extractedData: any, content: string, sourceType: SourceType) {
    const model_output: AIModelOutput = {
      title: extractedData.title ?? null,
      company: extractedData.company ?? null,
      location: extractedData.location ?? null,
      employment_type: extractedData.employment_type ?? null,
      seniority: extractedData.seniority ?? null,
      summary: extractedData.summary ?? null,
      requirements: extractedData.requirements ?? [],
      skills: extractedData.skills ?? []
    };

    const normalized_job: ExtractedJob = {
      title: model_output.title,
      company: model_output.company,
      location: model_output.location,
      employment_type: (model_output.employment_type as EmploymentType | null),
      seniority: (model_output.seniority as Seniority | null),
      summary: model_output.summary,
      requirements: model_output.requirements,
      required_skills: model_output.skills,
      preferred_skills: [],
      remote_policy: null,
      application_method: null,
      missing_fields: [],
      source_type: sourceType,
      raw_content: content,
      model_output: model_output
    };

    return {
      model_output,
      normalized_job
    };
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
  },

  async generateTailoredCV(job: ExtractedJob, userProfile: UserProfile): Promise<{ markdown_content: string }> {
    const masterCV = userProfile.cv_text || userProfile.experience_summary;

    const generationPrompt = `
      TASK: DETERMINISTIC CV COMPILER
      You are a strict CV compiler. Your task is to transform the provided MASTER CV into a tailored version for a specific JOB while strictly adhering to a non-negotiable format and quality rules.

      JOB DATA:
      - Title: ${job.title}
      - Company: ${job.company}
      - Requirements: ${job.requirements.join(', ')}
      - Skills Needed: ${job.required_skills.join(', ')}

      MASTER CV DATA:
      ---
      ${masterCV}
      ---

      1. FIXED STRUCTURE (NON-NEGOTIABLE):
      The CV must always follow this exact skeleton. Do NOT change these headers or the order:
      
      # [NAME]
      **[TITLE]**
      [Location]
      [Phone]
      [Email]
      [GitHub]
      [Portfolio]

      ---
      ## PROFESSIONAL SUMMARY
      [Exactly 3 paragraphs tailored to the job]

      ---
      ## CORE TECHNICAL SKILLS
      ### [Category Name]
      * [Skill Item]
      (Repeat categories like Backend, Frontend, Cloud & Infrastructure, etc.)

      ---
      ## PROFESSIONAL EXPERIENCE
      ### [Role]
      **[Company] – [Location]**
      [Dates]
      * [Measurable Achievement Bullets]
      Impact:
      * [Summary of results/business impact]
      (Repeat for each relevant role)

      ---
      ## SELECTED ENGINEERING PROJECTS
      ### [Project Name]
      **[Stack/Technologies]**
      * [Implementation Details]
      Impact: (optional)
      Keywords: [Comma separated list of tags]

      ---
      ## EDUCATION
      [Degree] - [University] - [Date]

      ---
      ## ADDITIONAL VALUE
      * [Certifications, Languages, or Volunteer work]

      ---
      ## AVAILABILITY
      [1 paragraph about notice period and location preference]

      2. BULLET FORMULA (MANDATORY):
      Every bullet in 'Professional Experience' and 'Projects' must follow:
      [ACTION VERB] + [SYSTEM/TECHNOLOGY] + [MEASURABLE IMPACT/CONTEXT]

      3. HARD RULES:
      - NO WEAK VERBS (e.g., worked on, helped, assisted, responsible for). Use: Engineered, Architected, Orchestrated, Optimized, Spearheaded.
      - NO GENERIC PHRASES.
      - EVERY business experience bullet MUST include specific system context and technology.
      - EVERY role in 'Professional Experience' MUST conclude with an "Impact:" section.

      4. OUTPUT FORMAT (STRICT MARKDOWN):
      - Use "#" for Name.
      - Use "**" for Titles and Companies.
      - Use "*" for bullets.
      - Use "---" between sections.
      - Maintain exact spacing and professional alignment.

      Proceed with the controlled transformation.
    `;

    try {
      // STEP 2 & 3: Generation and Bullet Formula Enforcement
      const firstPass = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: generationPrompt
      });
      const rawCV = firstPass.text;

      // STEP 4: Validation Pass (Mandatory)
      const validationPrompt = `
        TASK: CV COMPILER VALIDATION (STRICT SECOND PASS)
        Review the generated CV below and fix any deviations from the strict CV Compiler rules.

        GENERATED CV:
        ---
        ${rawCV}
        ---

        VALIDATION CHECKLIST:
        1. STRUCTURE: Ensure order is: Header -> Summary (3 paras) -> Skills -> Experience -> Projects -> Education -> Additional Value -> Availability.
        2. ENTITY CHECK: Does every experience section have an "Impact:" subsection?
        3. BULLET FORMULA: Does every bullet follow [ACTION] + [SYSTEM/TECH] + [IMPACT]?
        4. VERB CHECK: Are there any weak verbs like "helped" or "assisted"? If yes, replace with high-impact engineering verbs.
        5. FORMATTING: Are "#", "**", and "---" used correctly for strict Markdown styling?

        Return ONLY the final, validated Markdown CV. No preamble, no commentary.
      `;

      const finalPass = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: validationPrompt
      });

      // STEP 5: Return final Markdown CV
      return { 
        markdown_content: finalPass.text || "DETERMINISTIC COMPILER ERROR: Output was empty." 
      };
    } catch (error) {
      console.error("DETERMINISTIC CV COMPILER Error:", error);
      throw new Error("Failed to compile deterministic CV. Pipeline interruption.");
    }
  },

  async generateMasterCV(userProfile: UserProfile): Promise<{ markdown_content: string }> {
    const rawProfile = userProfile.cv_text || userProfile.experience_summary;

    const generationPrompt = `
      TASK: MASTER CV GENERATOR
      You are a strategic career architect. Your task is to generate a comprehensive MASTER CV based on the user's total professional context. This CV is not tailored to a job but serves as the definitive reference artifact.

      USER DATA:
      ---
      ${rawProfile}
      ---

      1. FIXED STRUCTURE (NON-NEGOTIABLE):
      The CV must always follow this exact skeleton. Do NOT change these headers or the order:
      
      # [NAME]
      **[TITLE]**
      [Location]
      [Phone]
      [Email]
      [GitHub]
      [Portfolio]

      ---
      ## PROFESSIONAL SUMMARY
      [Exactly 3 paragraphs summarizing the total career value]

      ---
      ## CORE TECHNICAL SKILLS
      ### [Category Name]
      * [Skill Item]
      (Categorize all skills from the profile)

      ---
      ## PROFESSIONAL EXPERIENCE
      ### [Role]
      **[Company] – [Location]**
      [Dates]
      * [Measurable Achievement Bullets]
      Impact:
      * [Summary of results/business impact]
      (Include all relevant roles)

      ---
      ## SELECTED ENGINEERING PROJECTS
      ### [Project Name]
      **[Stack/Technologies]**
      * [Implementation Details]
      Impact: (optional)
      Keywords: [Comma separated list of tags]

      ---
      ## EDUCATION
      [Degree] - [University] - [Date]

      ---
      ## ADDITIONAL VALUE
      * [Certifications, Languages, or Volunteer work]

      ---
      ## AVAILABILITY
      [1 paragraph about notice period and location preference]

      RULES:
      - Use strictly professional, high-impact language.
      - Follow the exact 8-pillar skeleton.
      - Return ONLY Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: generationPrompt
      });

      return { 
        markdown_content: response.text || "MASTER GENERATOR ERROR: Output was empty." 
      };
    } catch (error) {
      console.error("MASTER CV GENERATOR Error:", error);
      throw new Error("Failed to generate master CV.");
    }
  }
};
