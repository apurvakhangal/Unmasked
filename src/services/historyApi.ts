const API_BASE_URL = 'http://localhost:5000/api';

export interface HistoryEntry {
  id: string;
  action_type: 'scan' | 'news_view';
  file_name?: string | null;
  prediction?: string | null;
  confidence?: number | null;
  news_title?: string | null;
  news_url?: string | null;
  timestamp: string;
  report_url?: string | null;
}

export interface HistoryResponse {
  status: 'success' | 'error';
  history?: HistoryEntry[];
  message?: string;
}

export interface CreateHistoryRequest {
  user_id: string;
  action_type: 'scan' | 'news_view';
  file_name?: string;
  prediction?: string;
  confidence?: number;
  news_title?: string;
  news_url?: string;
  report_url?: string;
}

export class HistoryApiService {
  static async getHistory(userId: string): Promise<HistoryResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/history/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch history',
      };
    }
  }

  static async createHistory(data: CreateHistoryRequest): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create history:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to record history',
      };
    }
  }
}

