import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Calendar, User, Shield, Loader2, Share2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { BlogsApiService, Blog } from "@/services/blogsApi"

export default function BlogDetail() {
  const { id } = useParams<{ id: string }>()
  const [blog, setBlog] = useState<Blog | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    if (id) {
      fetchBlog(id)
    }
  }, [id])

  const fetchBlog = async (blogId: string) => {
    setIsLoading(true)
    try {
      const response = await BlogsApiService.getBlogById(blogId)
      if (response.status === 'success' && response.blog) {
        setBlog(response.blog)
      } else {
        toast({
          title: "Error",
          description: response.message || "Blog not found",
          variant: "destructive"
        })
        navigate('/blogs')
      }
    } catch (error) {
      console.error('Failed to fetch blog:', error)
      toast({
        title: "Error",
        description: "Failed to load blog",
        variant: "destructive"
      })
      navigate('/blogs')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: blog?.title,
          text: blog?.title,
          url: url
        })
      } else {
        await navigator.clipboard.writeText(url)
        toast({
          title: "Link Copied",
          description: "Blog link copied to clipboard",
          variant: "default"
        })
      }
    } catch (error) {
      // User cancelled share or error occurred
      if (error instanceof Error && error.name !== 'AbortError') {
        await navigator.clipboard.writeText(url)
        toast({
          title: "Link Copied",
          description: "Blog link copied to clipboard",
          variant: "default"
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="p-6">
        <Card className="card-cyber">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <h3 className="text-xl font-semibold mb-2">Blog Not Found</h3>
            <p className="text-muted-foreground mb-4">The blog you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/blogs')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blogs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/blogs')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        ← Back to Blogs
      </Button>

      {/* Blog Header */}
      <Card className="card-cyber">
        {blog.image_url && (
          <div className="relative h-64 md:h-96 w-full overflow-hidden rounded-t-lg">
            <img
              src={blog.image_url}
              alt={blog.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <div className="absolute top-4 right-4">
              <Badge variant="default" className="bg-primary/90">
                <Shield className="h-3 w-3 mr-1" />
                AI Verified
              </Badge>
            </div>
          </div>
        )}
        <CardContent className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {blog.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {blog.author}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(blog.date)}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="shrink-0"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blog Content */}
      <Card className="card-cyber">
        <CardContent className="p-6 md:p-8">
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {blog.content.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Button Footer */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={() => navigate('/blogs')}
          size="lg"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to All Blogs
        </Button>
      </div>
    </div>
  )
}

