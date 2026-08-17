export interface FeedbackData {
  id?: string;
  toolName: string;
  score: number;
  comment: string;
  userId?: string;
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const feedbackApi = {
  async saveFeedback(feedback: FeedbackData): Promise<FeedbackData> {
    const res = await fetch(`${API_BASE_URL}/feedbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback),
    });
    if (!res.ok) throw new Error(`Feedback API error ${res.status}`);
    return res.json();
  }
};
