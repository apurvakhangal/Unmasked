const API_BASE_URL = 'http://localhost:5000/api';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
  last_login: string;
  total_analyses: number;
  total_reports: number;
}

export interface ProfileResponse {
  status: 'success' | 'error';
  profile?: UserProfile;
  message?: string;
}

export interface UpdateProfileData {
  name?: string;
  password?: string;
  current_password?: string;
}

export class ProfileApiService {
  static async getProfile(userId: string): Promise<ProfileResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
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
      console.error('Failed to fetch profile:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch profile',
      };
    }
  }

  static async updateProfile(userId: string, data: UpdateProfileData): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
        method: 'PUT',
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
      console.error('Failed to update profile:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  }
}

