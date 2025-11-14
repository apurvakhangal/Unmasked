const API_BASE_URL = 'http://localhost:5000/api';

export interface Blog {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  author: string;
  date: string;
  created_at?: string;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  [key: string]: any;
}

export class BlogsApiService {
  static async getAllBlogs(): Promise<ApiResponse<Blog[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs`, {
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
      console.error('Failed to fetch blogs:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch blogs',
        blogs: [],
      };
    }
  }

  static async getBlogById(blogId: string): Promise<ApiResponse<Blog>> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/${blogId}`, {
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
      console.error('Failed to fetch blog:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch blog',
      };
    }
  }
}

