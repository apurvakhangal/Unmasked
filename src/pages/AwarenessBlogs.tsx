import { useState, useEffect } from "react"
import { BookOpen, Lightbulb, Shield, Loader2, ArrowRight, Calendar, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { BlogsApiService, Blog } from "@/services/blogsApi"

export default function AwarenessBlogs() {
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    fetchBlogs()
  }, [])

  const fetchBlogs = async () => {
    setIsLoading(true)
    try {
      const response = await BlogsApiService.getAllBlogs()
      if (response.status === 'success' && response.blogs) {
        setBlogs(response.blogs)
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to load blogs",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to fetch blogs:', error)
      toast({
        title: "Error",
        description: "Failed to load blogs",
        variant: "destructive"
      })
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

  const getExcerpt = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg p-8 md:p-12" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center gap-3">
            <BookOpen className="h-10 w-10 md:h-12 md:w-12" />
            Digital Awareness & Safety Hub 🧠
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl">
            Stay informed. Learn how to protect yourself and others from deepfakes, misinformation, and online manipulation.
          </p>
        </div>
      </div>

      {/* Page Title Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Awareness Blogs</h2>
        <p className="text-muted-foreground">
          Explore verified articles, expert opinions, and safety guides about deepfakes and digital security.
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Blogs Grid */}
      {!isLoading && blogs.length === 0 && (
        <Card className="card-cyber">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No blogs available</h3>
            <p className="text-muted-foreground text-center">
              Check back soon for new awareness articles and safety guides.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && blogs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <Card 
              key={blog.id} 
              className="card-cyber hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(`/blogs/${blog.id}`)}
            >
              {blog.image_url && (
                <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                  <img
                    src={blog.image_url}
                    alt={blog.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="default" className="bg-primary/90">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                  {blog.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-xs mt-2">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {blog.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(blog.date)}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {getExcerpt(blog.content)}
                </p>
                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/blogs/${blog.id}`)
                  }}
                >
                  Read More
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

