const API_BASE_URL = 'http://localhost:5000/api';

export interface CreateAnalysisRequest {
  user_id: string;
  file_name: string;
  prediction: string;
  confidence: number;
  processing_time?: number;
}

export class AnalysesApiService {
  static async createAnalysis(data: CreateAnalysisRequest): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyses`, {
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
      console.error('Failed to create analysis:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to record analysis',
      };
    }
  }
}

