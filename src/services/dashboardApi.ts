const API_BASE_URL = 'http://localhost:5000/api';

export interface RecentAnalysis {
  id: string;
  file_name: string;
  prediction: string;
  confidence: number;
  created_at: string;
  processing_time?: number | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'update' | 'warning' | 'info';
  timestamp: string;
  is_read: boolean;
}

export interface DashboardData {
  totalAnalyses: number;
  deepfakesDetected: number;
  accuracyRate: number;
  avgProcessingTime: number;
  recentAnalyses: RecentAnalysis[];
  notifications: Notification[];
}

export interface DashboardResponse {
  status: 'success' | 'error';
  data?: DashboardData;
  message?: string;
}

export interface NotificationsResponse {
  status: 'success' | 'error';
  notifications?: Notification[];
  message?: string;
}

export class DashboardApiService {
  static async getDashboard(userId: string): Promise<DashboardResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        status: data.status,
        data: data.status === 'success' ? {
          totalAnalyses: data.totalAnalyses,
          deepfakesDetected: data.deepfakesDetected,
          accuracyRate: data.accuracyRate,
          avgProcessingTime: data.avgProcessingTime,
          recentAnalyses: data.recentAnalyses || [],
          notifications: data.notifications || []
        } : undefined,
        message: data.message
      };
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
      };
    }
  }

  static async getNotifications(userId: string): Promise<NotificationsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${userId}`, {
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
      console.error('Failed to fetch notifications:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch notifications',
      };
    }
  }

  static async markNotificationRead(notificationId: string, userId: string): Promise<{ status: 'success' | 'error'; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'PATCH',
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
      console.error('Failed to mark notification as read:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update notification',
      };
    }
  }
}

