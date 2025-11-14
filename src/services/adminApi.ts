const API_BASE_URL = 'http://localhost:5000/api';

export interface ResetDataResponse {
  status: 'success' | 'error';
  message?: string;
  deleted?: {
    analyses: number;
    reports: number;
    history: number;
    notifications: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
  total_analyses: number;
  total_reports: number;
}

export interface UsersResponse {
  status: 'success' | 'error';
  users?: User[];
  total_users?: number;
  message?: string;
}

export interface UserDetailsResponse {
  status: 'success' | 'error';
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
  };
  recent_analyses?: any[];
  recent_reports?: any[];
  message?: string;
}

export interface Report {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  file_name: string;
  prediction: string;
  confidence: number;
  frames_analyzed: number;
  report_url: string;
  model_version: string;
  created_at: string;
}

export interface ReportsResponse {
  status: 'success' | 'error';
  reports?: Report[];
  statistics?: {
    total_reports: number;
    fake_reports: number;
    real_reports: number;
    fake_percentage: number;
    avg_confidence: number;
    most_recent: string;
  };
  message?: string;
}

export class AdminApiService {
  static async resetUserData(userId: string): Promise<ResetDataResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reset-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to reset user data:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset user data',
      };
    }
  }

  static async getAllUsers(adminId: string): Promise<UsersResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users?admin_id=${adminId}`, {
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
      console.error('Failed to fetch users:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch users',
      };
    }
  }

  static async getUserDetails(userId: string, adminId: string): Promise<UserDetailsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}?admin_id=${adminId}`, {
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
      console.error('Failed to fetch user details:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch user details',
      };
    }
  }

  static async resetUserDataSingle(userId: string, adminId: string): Promise<ResetDataResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to reset user data:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset user data',
      };
    }
  }

  static async deleteUser(userId: string, adminId: string): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete user:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  }

  static async getAllReports(
    adminId: string,
    filters?: {
      result?: string;
      user_id?: string;
      date_from?: string;
      date_to?: string;
    }
  ): Promise<ReportsResponse> {
    try {
      let url = `${API_BASE_URL}/admin/reports?admin_id=${adminId}`;
      
      if (filters?.result) {
        url += `&result=${filters.result}`;
      }
      if (filters?.user_id) {
        url += `&user_id=${filters.user_id}`;
      }
      if (filters?.date_from) {
        url += `&date_from=${filters.date_from}`;
      }
      if (filters?.date_to) {
        url += `&date_to=${filters.date_to}`;
      }

      const response = await fetch(url, {
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
      console.error('Failed to fetch reports:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch reports',
      };
    }
  }

  static async deleteReport(reportId: string, adminId: string): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete report:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete report',
      };
    }
  }
}

