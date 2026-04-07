/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SourceType {
    text = "text",
    link = "link",
    image = "image",
}

export enum Seniority {
    intern = "intern",
    junior = "junior",
    mid = "mid",
    senior = "senior",
    lead = "lead",
    unknown = "unknown",
}

export enum EmploymentType {
    full_time = "full_time",
    part_time = "part_time",
    contract = "contract",
    internship = "internship",
    temporary = "temporary",
    unknown = "unknown",
}

export enum RemotePolicy {
    remote = "remote",
    hybrid = "hybrid",
    onsite = "onsite",
    unknown = "unknown",
}

export enum ApplicationMethod {
    email = "email",
    external_link = "external_link",
    portal = "portal",
    unknown = "unknown",
}

export enum ExtractionConfidence {
    low = "low",
    medium = "medium",
    high = "high",
}

export enum OutputMode {
    email = "email",
    form_answers = "form_answers",
}

export enum Tone {
    professional = "professional",
    confident = "confident",
    concise = "concise",
}

export interface UserProfile {
    full_name: string;
    email: string;
    phone?: string;
    location?: string;
    target_roles: string[];
    skills: string[];
    years_of_experience: string;
    experience_summary: string;
    preferred_industries: string[];
    cv_text: string;
    tone_preference: Tone;
    linkedin_url?: string;
    portfolio_url?: string;
    updated_at?: any;
}

export enum JobStatus {
    saved = "saved",
    captured = "captured",
    analyzed = "analyzed",
    apply_now = "apply_now",
    applied = "applied",
    interview = "interview",
    rejected = "rejected",
    offer = "offer",
    archived = "archived",
    follow_up = "follow_up",
}

export interface ExtractedJob {
    id?: string;
    uid?: string;
    title?: string;
    company?: string;
    summary?: string;
    requirements: string[];
    required_skills: string[];
    preferred_skills: string[];
    experience_years_required?: string;
    seniority: Seniority;
    employment_type: EmploymentType;
    location?: string;
    remote_policy: RemotePolicy;
    application_method: ApplicationMethod;
    application_email?: string;
    application_url?: string;
    deadline?: string;
    salary_info?: string;
    source_type: SourceType;
    source_label?: string;
    source_url?: string;
    raw_excerpt?: string;
    raw_content?: string;
    missing_fields: string[];
    extraction_confidence: ExtractionConfidence;
    status?: JobStatus;
    postgres_id?: number;
    analysis?: JobAnalysis;
    analysis_at?: any;
    analysis_profile_at?: any;
    captured_at?: any;
}

export enum Verdict {
    relevant = "relevant",
    maybe = "maybe",
    not_worth_it = "not_worth_it",
}

export enum ApplyRecommendation {
    apply = "apply",
    apply_if_time = "apply_if_time",
    skip = "skip",
}

export enum Confidence {
    low = "low",
    medium = "medium",
    high = "high",
}

export interface JobAnalysis {
    verdict: Verdict;
    apply_recommendation: ApplyRecommendation;
    reasons: string[];
    gaps: string[];
    confidence: Confidence;
    fit_summary: string;
}

export interface GeneratedApplication {
    id?: string;
    uid?: string;
    job_id?: string;
    output_mode: OutputMode;
    subject?: string;
    email_body?: string;
    short_fit_answer?: string;
    cover_note?: string;
    attachment_note?: string;
    generation_confidence: ExtractionConfidence;
    applied_at?: any;
    notes?: string;
}
