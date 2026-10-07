import { authFetch } from '@/lib/auth-client';

export interface FeedbackData {
  id?: string;
  toolName: string;
  score: number;
  comment: string;
  userId?: string;
  status?: string;
  createdAt?: string;
}

import { req } from '@/lib/http-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const feedbackApi = {
  async saveFeedback(feedback: FeedbackData): Promise<FeedbackData> {
    const res = await authFetch(`${API_BASE_URL}/feedbacks`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
    if (!res.ok) throw new Error(`Feedback API error ${res.status}`);
    return res.json();
  },

  async listFeedbacks(status?: string): Promise<FeedbackData[]> {
    const url = status
      ? `${API_BASE_URL}/feedbacks?status=${encodeURIComponent(status)}`
      : `${API_BASE_URL}/feedbacks`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`Feedback API error ${res.status}`);
    return res.json();
  },

  async updateStatus(id: string, status: string): Promise<FeedbackData> {
    const res = await authFetch(`${API_BASE_URL}/feedbacks/${id}/status?status=${encodeURIComponent(status)}`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Feedback API error ${res.status}`);
    return res.json();
  },

  async deleteFeedback(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/feedbacks/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Feedback API error ${res.status}`);
  }
};
