const API_BASE_URL = 'http://localhost:5000/api';

export interface PredictionResult {
  prediction: 'real' | 'fake';
  confidence: number;
  fake_probability: number;
  real_probability: number;
  frames_analyzed: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  result?: T;
  filename?: string;
}

export class DeepfakeApiService {
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

  static async healthCheck(): Promise<ApiResponse<{ model_loaded: boolean }>> {
    return this.makeRequest('/health');
  }

  static async predictVideo(file: File): Promise<ApiResponse<PredictionResult>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Video prediction failed:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Prediction failed'
      };
    }
  }

  static async trainModel(datasetPath: string = '../UADFV', epochs: number = 30): Promise<ApiResponse<any>> {
    return this.makeRequest('/train', {
      method: 'POST',
      body: JSON.stringify({
        dataset_path: datasetPath,
        epochs: epochs
      }),
    });
  }

  static async loadModel(modelPath: string = 'models/deepfake_model_50e.h5'): Promise<ApiResponse<any>> {
    return this.makeRequest('/load-model', {
      method: 'POST',
      body: JSON.stringify({
        model_path: modelPath
      }),
    });
  }

  static async getModelInfo(): Promise<ApiResponse<any>> {
    return this.makeRequest('/model-info');
  }

  static async evaluateModel(datasetPath: string = '../UADFV'): Promise<ApiResponse<any>> {
    return this.makeRequest('/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        dataset_path: datasetPath
      }),
    });
  }
}
