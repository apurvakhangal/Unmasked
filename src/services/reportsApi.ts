const API_BASE_URL = 'http://localhost:5000/api';

export interface Report {
  id: string;
  file_name: string;
  prediction: string;
  confidence: number;
  frames_analyzed?: number | null;
  report_url: string;
  model_version?: string | null;
  created_at: string;
  // Admin fields
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

export interface ReportsResponse {
  status: 'success' | 'error';
  reports?: Report[];
  message?: string;
}

export interface CreateReportRequest {
  user_id: string;
  file_name: string;
  prediction: string;
  confidence: number;
  frames_analyzed?: number;
  report_url: string;
  model_version?: string;
}

export class ReportsApiService {
  static async getUserReports(userId: string): Promise<ReportsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${userId}`, {
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
      console.error('Failed to fetch reports:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  static async getAllReports(userId: string): Promise<ReportsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/reports?user_id=${userId}`, {
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
      console.error('Failed to fetch all reports:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  static async createReport(data: CreateReportRequest): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/reports`, {
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
      console.error('Failed to create report:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save report',
      };
    }
  }
}

