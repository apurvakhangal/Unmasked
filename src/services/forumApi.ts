const API_BASE_URL = 'http://localhost:5000/api';

export interface ForumPost {
  id: string;
  user_id: string;
  username: string;
  topic: string;
  content: string;
  likes: number;
  created_at: string;
  comments_count: number;
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  posts?: T[];
  comments?: T[];
  post_id?: string;
  comment_id?: string;
  likes?: number;
}

export const FORUM_TOPICS = [
  'Awareness',
  'Cyber Safety',
  'AI Technology',
  'Law & Policy',
  'General'
] as const;

export type ForumTopic = typeof FORUM_TOPICS[number];

export class ForumApiService {
  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async getPosts(search?: string, topic?: string): Promise<ApiResponse<ForumPost>> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (topic) params.append('topic', topic);
    
    const queryString = params.toString();
    const endpoint = `/forum/posts${queryString ? `?${queryString}` : ''}`;
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect to server. Please ensure the backend is running.',
        posts: []
      };
    }
  }

  static async createPost(
    user_id: string,
    topic: ForumTopic,
    content: string
  ): Promise<ApiResponse<ForumPost>> {
    return this.makeRequest<ForumPost>('/forum/posts', {
      method: 'POST',
      body: JSON.stringify({ user_id, topic, content }),
    });
  }

  static async likePost(post_id: string): Promise<ApiResponse<ForumPost>> {
    return this.makeRequest<ForumPost>(`/forum/posts/${post_id}/like`, {
      method: 'PUT',
    });
  }

  static async deletePost(post_id: string, user_id: string): Promise<ApiResponse<ForumPost>> {
    return this.makeRequest<ForumPost>(`/forum/posts/${post_id}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id }),
    });
  }

  static async getComments(post_id: string): Promise<ApiResponse<ForumComment>> {
    return this.makeRequest<ForumComment>(`/forum/posts/${post_id}/comments`, {
      method: 'GET',
    });
  }

  static async createComment(
    post_id: string,
    user_id: string,
    content: string
  ): Promise<ApiResponse<ForumComment>> {
    return this.makeRequest<ForumComment>(`/forum/posts/${post_id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ user_id, content }),
    });
  }

  static async deleteComment(comment_id: string, user_id: string): Promise<ApiResponse<ForumComment>> {
    return this.makeRequest<ForumComment>(`/forum/comments/${comment_id}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id }),
    });
  }
}

