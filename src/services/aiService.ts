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
      TASK: STRATEGIC CAREER ARCHITECT (DETERMINISTIC CV COMPILER)
      You are NOT a simple resume writer. You are a High-Level Strategic Career Architect. Your mission is to re-engineer the user's MASTER CV into a precise, high-performance weapon designed to land an interview for the target role.

      JOB INTELLIGENCE:
      - Role: ${job.title}
      - Target Company: ${job.company}
      - Core Requirements: ${job.requirements.join(', ')}
      - Technical Stack Hub: ${job.required_skills.join(', ')}

      MASTER CV REFERENCE:
      ---
      ${masterCV}
      ---

      MISSION OBJECTIVES:
      1. UNDERLYING PAIN POINT: Identify the implicit problem this company has (based on the job description) and position the user as the primary solution.
      2. KEYWORD DENSITY: Saturate P3 and P4 with the specific technical keywords from the JOB DATA while maintaining professional narrative flow.
      3. IMPACT AMPLIFICATION: Every achievement bullet must demonstrate a measurable business or technical lift.

      ---
      1. FIXED 8-PILLAR SKELETON (NON-NEGOTIABLE):
      
      P1. HEADER MATRIX
      # [NAME]
      **[TARGET ROLE: Match the job requirements]**
      [Location] | [GitHub/Portfolio] | [Email] | [LinkedIn]

      ---
      P2. PROFESSIONAL SUMMARY (THE BRIDGE)
      ## PROFESSIONAL SUMMARY
      INSTRUCTIONS: EXACTLY 3 PARAGRAPHS.
      Para 1: THE ANCHOR. Position user as a master of the job's core domain.
      Para 2: THE ARSENAL. High-density skill array matching the tech stack hub.
      Para 3: THE BRIDGE. Explicitly address ${job.company}'s mission or industry-specific engineering challenges.

      ---
      P3. CORE TECHNICAL SKILLS
      ## CORE TECHNICAL SKILLS
      Categorized skill arrays (Backend, Frontend, Cloud, etc.).
      * Group related technologies together into logical semantic clusters.

      ---
      P4. PROFESSIONAL EXPERIENCE
      ## PROFESSIONAL EXPERIENCE
      ### [Role]
      **[Company] – [Location]**
      [Dates]
      * [Achievement Bullets: Action + Tech + Result]. Use the "X-Y-Z" formula.
      
      IMPACT:
      * [MANDATORY IMPACT SUBSECTION]: Measurable outcomes, scalability metrics, or business ROI specifically resulting from the user's intervention.

      ---
      P5. SELECTED ENGINEERING PROJECTS
      ## SELECTED ENGINEERING PROJECTS
      ### [Project Name]
      **Tech Stack Tags: [DevOps, Blockchain, React, etc.]**
      * [Detailed technical implementation of complex features]
      * [Engineering challenges overcome and architectural decisions]

      ---
      P6. EDUCATION
      ## EDUCATION
      **[Degree + Classification]** - [University] - [Date]

      ---
      P7. ADDITIONAL VALUE
      ## ADDITIONAL VALUE
      * [Certifications]
      * [Secondary Languages]
      * [Volunteer Missions / Open Source]

      ---
      P8. AVAILABILITY
      ## AVAILABILITY
      [Notice Period] | [Location Mobility: Remote/Hybrid/Willing to Relocate]

      HARD MANDATES:
      - FORBIDDEN VERBS: helped, assisted, worked on, responsible for, supported.
      - REQUIRED VERBS: Architected, Orchestrated, Engineered, Spearheaded, Optimized, Scaled, Accelerated, Synthesized.
      - Every bullet must have a technical "hook" and a business "result".
    `;

    try {
      // Pass 1: Strategic Compilation
      const firstPass = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: generationPrompt
      });
      const rawCV = firstPass.text;

      // Pass 2: ATS & Impact Validation
      const validationPrompt = `
        TASK: ATS & IMPACT AUDITOR (STRICT SECOND PASS)
        Review the generated CV and fix any weaknesses. 

        CV TO AUDIT:
        ${rawCV}

        AUDIT CRITERIA:
        1. ATS DENSITY: Does it mention ${job.required_skills.join(', ')} in a natural but prominent way?
        2. VERB STRENGTH: Are there any weak verbs? Replace with high-power engineering verbs if found.
        3. P2 BRIDGE: Does Paragraph 3 of the Summary explicitly mention ${job.company} or their industry specific challenge?
        4. MEASURABILITY: Does every experience section have a quantifiable result? If a percentage is missing, estimate a realistic technical lift based on the context.

        Return ONLY the final, validated Markdown CV. No preamble.
      `;

      const finalPass = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: validationPrompt
      });

      return { 
        markdown_content: finalPass.text || "ARCHITECT ERROR: Pipeline failed to produce content." 
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
      The CV must always follow this exact 8-pillar skeleton. Do NOT change these headers or the order:
      
      P1. HEADER MATRIX
      ## CONTACT MATRIX
      # [NAME]
      **[CORE PROFESSIONAL TITLE]**
      [Location] | [GitHub/Portfolio] | [Email] | [LinkedIn]

      ---
      P2. PROFESSIONAL SUMMARY
      ## PROFESSIONAL SUMMARY
      INSTRUCTIONS: EXACTLY 3 PARAGRAPHS.
      Para 1: Professional identity and years of experience.
      Para 2: Core technical domains and architectural expertise.
      Para 3: Career goals and industry focus.

      ---
      P3. CORE TECHNICAL SKILLS
      ## CORE TECHNICAL SKILLS
      Categorized skill arrays (Backend, Frontend, Cloud, etc.).

      ---
      P4. PROFESSIONAL EXPERIENCE
      ## PROFESSIONAL EXPERIENCE
      ### [Role]
      **[Company] – [Location]**
      [Dates]
      * [Achievement bullets].
      IMPACT:
      * [MANDATORY IMPACT SUBSECTION]: Measurable outcomes specifically resulting from the user's intervention.

      ---
      P5. SELECTED ENGINEERING PROJECTS
      ## SELECTED ENGINEERING PROJECTS
      ### [Project Name]
      **Tech Stack Tags: [Languages/Tools]**
      * Technical implementation details and complexity notes.

      ---
      P6. EDUCATION
      ## EDUCATION
      **[Degree + Classification]** - [University] - [Date]

      ---
      P7. ADDITIONAL VALUE
      ## ADDITIONAL VALUE
      * [Certifications]
      * [Secondary Languages]
      * [Volunteer Missions]

      ---
      P8. AVAILABILITY
      ## AVAILABILITY
      [Notice period and location mobility.]

      RULES:
      - Use strictly professional, high-impact language.
      - Follow the exact 8-pillar skeleton with P1-P8 labels in your thought process but output standard headers in Markdown.
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
  },

  async verifyCVStructure(markdown: string): Promise<{ success: boolean; score: number; logs: string[]; pillarStatus: any }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `
        You are a CV Structure Audit System. 
        Your task is to analyze the following Markdown CV against the mandatory 8-pillar structure:
        1. Header Matrix (Contact/Links)
        2. Professional Summary
        3. Core Technical Skills
        4. Professional Experience
        5. Selected Engineering Projects
        6. Education
        7. Additional Value (Certs/Languages)
        8. Availability (Notice/Location)

        Analyze for:
        - Presence of each section (P1-P8).
        - Deterministic ordering (strictly follow the 8-pillar sequence).
        - Paragraph Count: Section P2 MUST have exactly 3 paragraphs.
        - Impact Subsections: Section P4 MUST have a dedicated 'IMPACT:' subsection for each role.
        - Tech Stack Tags: Section P5 MUST use 'Tech Stack Tags:' or similar label.
        - Bullet point density (Achievement + Tech + Impact).
        - Markdown semantic integrity.

        Return a JSON object:
        {
          "success": boolean,
          "score": number (0-100),
          "logs": string[],
          "pillarStatus": { "P1": boolean, "P2": boolean, "P3": boolean, "P4": boolean, "P5": boolean, "P6": boolean, "P7": boolean, "P8": boolean }
        }

        CV CONTENT:
        ${markdown}
        `,
        config: {
          responseMimeType: "application/json",
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("SKELETON VERIFIER Error:", error);
      return {
        success: false,
        score: 0,
        logs: ["Neural verification system offline", "Falling back to basic pattern matching"],
        pillarStatus: {}
      };
    }
  }
};
