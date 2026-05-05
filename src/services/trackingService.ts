import { JobStatus } from '../types';

const API_BASE = '/backend-v2060/tracking';

export interface JobTrackingRecord {
    id: number;
    uid: string;
    firestore_id?: string;
    title: string;
    company: string;
    status: JobStatus;
    captured_at: string;
    updated_at?: string;
}

export const trackingService = {
    async getJobs(uid: string, token?: string): Promise<JobTrackingRecord[]> {
        const url = `${API_BASE}/jobs?uid=${uid}`;
        console.log(`[TrackingService] Fetching from: ${url}`);
        const headers: HeadersInit = {};
        if (token) {
            headers['X-Firebase-Auth'] = token;
        }
        
        const response = await fetch(`${API_BASE}/jobs?uid=${uid}`, { headers });
        const contentType = response.headers.get('content-type');
        
        if (!response.ok || !contentType?.includes('application/json')) {
            const bodyText = await response.text().catch(() => '');
            console.error('[TrackingService] API Error:', {
                status: response.status,
                contentType,
                body: bodyText.substring(0, 200)
            });
            throw new Error(`API Error: ${response.status}. Received ${contentType}. ` + 
                (bodyText.startsWith('<!doctype') ? 'The server returned an HTML page instead of JSON. Check your API routes.' : bodyText.substring(0, 100)));
        }
        return response.json();
    },

    async createJob(jobData: any, token?: string): Promise<JobTrackingRecord> {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
            headers['X-Firebase-Auth'] = token;
        }
        
        const response = await fetch(`${API_BASE}/jobs`, {
            method: 'POST',
            headers,
            body: JSON.stringify(jobData)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to create job: ${response.status} ${JSON.stringify(errorData)}`);
        }
        return response.json();
    },

    async updateStatus(jobId: number, status: JobStatus, firestoreId?: string, token?: string): Promise<JobTrackingRecord> {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
            headers['X-Firebase-Auth'] = token;
        }
        
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status, firestore_id: firestoreId })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to update status: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
        }
        return response.json();
    },

    async deleteJob(jobId: number, token?: string): Promise<void> {
        const headers: HeadersInit = {};
        if (token) {
            headers['X-Firebase-Auth'] = token;
        }
        
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            method: 'DELETE',
            headers
        });
        if (!response.ok) throw new Error('Failed to delete job');
    }
};
