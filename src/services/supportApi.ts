const API_BASE_URL = 'http://localhost:5000/api';

export interface ExpertRequest {
  user_id: string;
  name: string;
  email: string;
  file_reference?: string;
  description: string;
}

export interface Complaint {
  user_id: string;
  name: string;
  email: string;
  type: 'Identity Misuse' | 'Fake News' | 'Explicit Deepfake' | 'Harassment';
  description: string;
  evidence_file?: string;
}

export interface Subscription {
  user_id?: string;
  email: string;
}

export interface DailyTip {
  id: string;
  text: string;
  category: string;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  [key: string]: any;
}

export class SupportApiService {
  static async createExpertRequest(request: ExpertRequest): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/expert-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create expert request:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create expert request',
      };
    }
  }

  static async createComplaint(complaint: Complaint): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/complaint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(complaint),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create complaint:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create complaint',
      };
    }
  }

  static async trackComplaint(id?: string, email?: string): Promise<ApiResponse> {
    try {
      const params = new URLSearchParams();
      if (id) params.append('id', id);
      if (email) params.append('email', email);

      const response = await fetch(`${API_BASE_URL}/support/track-complaint?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to track complaint:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to track complaint',
      };
    }
  }

  static async subscribeNewsletter(subscription: Subscription): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to subscribe',
      };
    }
  }

  static async getDailyTips(): Promise<ApiResponse<DailyTip[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/support/daily-tips`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch daily tips:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch daily tips',
        tips: [],
      };
    }
  }
}

