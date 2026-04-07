import { JobStatus } from '../types';

const API_BASE = '/app-backend-v1/tracking';

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
        console.log(`[TrackingService] Fetching from: ${API_BASE}/jobs?uid=${uid}`);
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}/jobs?uid=${uid}`, { headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch tracking data: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
        }
        return response.json();
    },

    async updateStatus(jobId: number, status: JobStatus, firestoreId?: string, token?: string): Promise<JobTrackingRecord> {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
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
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
            method: 'DELETE',
            headers
        });
        if (!response.ok) throw new Error('Failed to delete job');
    }
};
