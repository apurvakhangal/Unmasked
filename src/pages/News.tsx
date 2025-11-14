import { useState, useEffect } from "react"
import { Newspaper, ExternalLink, Calendar, Shield, RefreshCw, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { toast } from "@/components/ui/sonner"
import { HistoryApiService } from "@/services/historyApi"

interface NewsArticle {
  title: string
  source: string
  publishedAt: string
  description: string
  url: string
  urlToImage: string | null
}

// Format date helper function
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
    
    return date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "short", 
      day: "numeric" 
    })
  } catch {
    return "Unknown date"
  }
}

// Article Card Component
function ArticleCard({ 
  article, 
  index,
  onArticleView 
}: { 
  article: NewsArticle
  index: number
  onArticleView?: (article: NewsArticle) => void
}) {
  const [imageError, setImageError] = useState(false)

  return (
    <Card 
      className="card-cyber hover:border-primary/50 transition-all duration-300 hover:shadow-lg group animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="relative w-full h-48 overflow-hidden rounded-t-lg bg-muted">
        {!imageError && article.urlToImage ? (
          <img 
            src={article.urlToImage} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Newspaper className="h-16 w-16 text-primary/40" />
          </div>
        )}
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {article.source}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(article.publishedAt)}
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="line-clamp-3">
          {article.description}
        </CardDescription>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            if (article.url && article.url !== "#") {
              window.open(article.url, "_blank", "noopener,noreferrer")
              // Record history if callback is provided
              if (onArticleView) {
                onArticleView(article)
              }
            } else {
              toast.error("Article URL not available")
            }
          }}
          disabled={!article.url || article.url === "#"}
        >
          Read Full Article
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    
    try {
      // Use backend proxy to avoid CORS issues with NewsAPI
      const apiKey = import.meta.env.VITE_NEWS_API_KEY || "1f013bdd0a824f99a37c796fe086806d"
      
      if (!apiKey) {
        throw new Error("NewsAPI key not configured. Please add VITE_NEWS_API_KEY to your environment variables.")
      }

      const response = await fetch(
        `http://localhost:5000/api/news?q=deepfake&language=en&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API request failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === "error") {
        throw new Error(data.message || "Failed to fetch news from NewsAPI")
      }

      // Format articles from NewsAPI response - only use real articles with valid URLs
      const formattedArticles: NewsArticle[] = (data.articles || [])
        .filter((article: any) => article.url && article.title) // Only include articles with valid URL and title
        .map((article: any) => ({
          title: article.title,
          source: article.source?.name || "Unknown source",
          publishedAt: article.publishedAt || new Date().toISOString(),
          description: article.description || article.content?.substring(0, 150) || "No description available",
          url: article.url, // Real URL from NewsAPI
          urlToImage: article.urlToImage || null
        }))
        .slice(0, 15) // Limit to 15 articles

      if (formattedArticles.length === 0) {
        throw new Error("No articles found. Please try again later.")
      }

      setArticles(formattedArticles)
      setLastUpdated(new Date())
      
      if (isRefresh) {
        toast.success("News updated successfully")
      }
    } catch (err: any) {
      console.error("Error fetching news:", err)
      const errorMessage = err.message || "Unable to load latest news. Please try again."
      setError(errorMessage)
      
      // Set empty state for retry
      setArticles([])
      
      if (!isRefresh) {
        toast.error(errorMessage)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchNews(true)
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleDetectDeepfake = () => {
    if (isAuthenticated) {
      navigate("/upload") // Redirect to upload/detection page
    } else {
      toast.error("Please log in to use the detection feature")
      setTimeout(() => {
        navigate("/login")
      }, 1000)
    }
  }

  const handleArticleView = async (article: NewsArticle) => {
    // Record history if user is authenticated
    if (isAuthenticated && user?.id) {
      try {
        await HistoryApiService.createHistory({
          user_id: user.id,
          action_type: 'news_view',
          news_title: article.title,
          news_url: article.url,
        })
      } catch (error) {
        console.error('Failed to record history:', error)
        // Don't show error to user, history recording is non-critical
      }
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            Deepfake News & Updates
          </h1>
          <p className="text-muted-foreground mt-2">
            Stay informed about the latest developments in deepfake detection and AI security
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last updated: {lastUpdated.toLocaleTimeString("en-US", { 
                hour: "2-digit", 
                minute: "2-digit",
                second: "2-digit"
              })}</span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleRefresh}
            variant="outline"
            size="lg"
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleDetectDeepfake}
            className="btn-hero flex items-center gap-2"
            size="lg"
          >
            <Shield className="h-5 w-5" />
            Detect Deepfake
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchNews(false)}
              className="ml-4"
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 animate-in fade-in">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading latest news...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && articles.length === 0 && (
        <Card className="card-cyber">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Newspaper className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No recent deepfake news found</h3>
            <p className="text-muted-foreground text-center mb-4">
              We couldn't find any news articles at the moment. Please try again later.
            </p>
            <Button onClick={() => fetchNews(false)} variant="outline" disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* News Articles Grid */}
      {!isLoading && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, index) => (
            <ArticleCard 
              key={`${article.url}-${index}`} 
              article={article} 
              index={index}
              onArticleView={handleArticleView}
            />
          ))}
        </div>
      )}

      {/* Info Banner for Non-Authenticated Users */}
      {!isAuthenticated && !isLoading && (
        <Card className="card-cyber border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">Want to Detect Deepfakes?</h3>
                <p className="text-muted-foreground mb-4">
                  Sign in to access our advanced deepfake detection tools. Upload videos and images to analyze them for AI-generated content.
                </p>
                <Button onClick={handleDetectDeepfake} className="btn-hero">
                  Sign In to Get Started
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

