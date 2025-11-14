import { useState, useEffect } from "react"
import { 
  MessageSquare, 
  Heart, 
  Trash2, 
  Send, 
  Search, 
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/sonner"
import { useAuth } from "@/contexts/AuthContext"
import { 
  ForumApiService, 
  ForumPost, 
  ForumComment, 
  FORUM_TOPICS,
  ForumTopic 
} from "@/services/forumApi"
import { formatDistanceToNow } from "date-fns"

export default function Forum() {
  const { isAuthenticated, user, isAdmin } = useAuth()
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [topicFilter, setTopicFilter] = useState<string>("")
  const [newPostContent, setNewPostContent] = useState("")
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic>("General")
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, ForumComment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set())
  const [newComments, setNewComments] = useState<Record<string, string>>({})
  const [postingComments, setPostingComments] = useState<Set<string>>(new Set())
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'post' | 'comment'; id: string }>({ 
    open: false, 
    type: 'post', 
    id: '' 
  })

  // Fetch posts
  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ForumApiService.getPosts(
        searchQuery || undefined,
        topicFilter || undefined
      )
      
      if (response.status === 'success' && response.posts) {
        setPosts(response.posts)
      } else {
        const errorMsg = response.message || 'Failed to fetch posts'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to load forum posts'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchPosts, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, topicFilter])

  // Create new post
  const handleCreatePost = async () => {
    if (!isAuthenticated || !user) {
      toast.error('Please log in to create a post')
      return
    }

    if (!newPostContent.trim()) {
      toast.error('Please enter something before posting.')
      return
    }

    try {
      setPosting(true)
      const response = await ForumApiService.createPost(
        user.id,
        selectedTopic,
        newPostContent.trim()
      )

      if (response.status === 'success') {
        toast.success('Post created successfully!')
        setNewPostContent("")
        setSelectedTopic("General")
        await fetchPosts()
      } else {
        toast.error(response.message || 'Failed to create post')
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  // Like a post
  const handleLikePost = async (postId: string) => {
    if (!isAuthenticated) {
      toast.error('Please log in to like posts')
      return
    }

    try {
      const response = await ForumApiService.likePost(postId)
      
      if (response.status === 'success') {
        // Update local state
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? { ...post, likes: response.likes || post.likes + 1 }
              : post
          )
        )
      } else {
        toast.error(response.message || 'Failed to like post')
      }
    } catch (error) {
      console.error('Error liking post:', error)
      toast.error('Failed to like post')
    }
  }

  // Toggle comments visibility
  const toggleComments = async (postId: string) => {
    const isExpanded = expandedPosts.has(postId)
    
    if (isExpanded) {
      setExpandedPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    } else {
      setExpandedPosts(prev => new Set(prev).add(postId))
      
      // Fetch comments if not already loaded
      if (!comments[postId]) {
        try {
          setLoadingComments(prev => new Set(prev).add(postId))
          const response = await ForumApiService.getComments(postId)
          
          if (response.status === 'success' && response.comments) {
            setComments(prev => ({ ...prev, [postId]: response.comments || [] }))
          }
        } catch (error) {
          console.error('Error fetching comments:', error)
          toast.error('Failed to load comments')
        } finally {
          setLoadingComments(prev => {
            const newSet = new Set(prev)
            newSet.delete(postId)
            return newSet
          })
        }
      }
    }
  }

  // Add comment
  const handleAddComment = async (postId: string) => {
    if (!isAuthenticated || !user) {
      toast.error('Please log in to comment')
      return
    }

    const commentContent = newComments[postId]?.trim()
    if (!commentContent) {
      toast.error('Please enter something before commenting.')
      return
    }

    try {
      setPostingComments(prev => new Set(prev).add(postId))
      const response = await ForumApiService.createComment(
        postId,
        user.id,
        commentContent
      )

      if (response.status === 'success') {
        toast.success('Comment added successfully!')
        setNewComments(prev => ({ ...prev, [postId]: '' }))
        
        // Refresh comments
        const commentsResponse = await ForumApiService.getComments(postId)
        if (commentsResponse.status === 'success' && commentsResponse.comments) {
          setComments(prev => ({ ...prev, [postId]: commentsResponse.comments || [] }))
        }
        
        // Update comments count in posts
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? { ...post, comments_count: (post.comments_count || 0) + 1 }
              : post
          )
        )
      } else {
        toast.error(response.message || 'Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setPostingComments(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  // Delete post or comment
  const handleDelete = async () => {
    if (!user) return

    try {
      let response
      if (deleteDialog.type === 'post') {
        response = await ForumApiService.deletePost(deleteDialog.id, user.id)
      } else {
        response = await ForumApiService.deleteComment(deleteDialog.id, user.id)
      }

      if (response.status === 'success') {
        toast.success(`${deleteDialog.type === 'post' ? 'Post' : 'Comment'} deleted successfully`)
        
        if (deleteDialog.type === 'post') {
          await fetchPosts()
        } else {
          // Find which post this comment belongs to and refresh its comments
          const postId = Object.keys(comments).find(postId =>
            comments[postId].some(c => c.id === deleteDialog.id)
          )
          if (postId) {
            const commentsResponse = await ForumApiService.getComments(postId)
            if (commentsResponse.status === 'success' && commentsResponse.comments) {
              setComments(prev => ({ ...prev, [postId]: commentsResponse.comments || [] }))
            }
          }
        }
      } else {
        toast.error(response.message || `Failed to delete ${deleteDialog.type}`)
      }
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error(`Failed to delete ${deleteDialog.type}`)
    } finally {
      setDeleteDialog({ open: false, type: 'post', id: '' })
    }
  }

  const getTopicColor = (topic: string) => {
    const colors: Record<string, string> = {
      'Awareness': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Cyber Safety': 'bg-green-500/10 text-green-500 border-green-500/20',
      'AI Technology': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Law & Policy': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      'General': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }
    return colors[topic] || colors['General']
  }

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return timestamp
    }
  }

  // Debug: Log component render
  useEffect(() => {
    console.log('Forum component mounted', { isAuthenticated, user: user?.id })
  }, [isAuthenticated, user])

  // Ensure component always renders
  if (typeof isAuthenticated === 'undefined') {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-5xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Community Forum</h1>
        <p className="text-muted-foreground">
          Join the discussion on deepfake awareness, AI ethics, and online safety.
        </p>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={topicFilter || "all"} onValueChange={(value) => setTopicFilter(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {FORUM_TOPICS.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Post Creation */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>Start a Discussion</CardTitle>
            <CardDescription>Share your thoughts or questions with the community</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your thoughts or questions…"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedTopic} onValueChange={(v) => setSelectedTopic(v as ForumTopic)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORUM_TOPICS.map((topic) => (
                    <SelectItem key={topic} value={topic}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleCreatePost} 
                disabled={posting}
                className="w-full sm:w-auto"
              >
                {posting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forum Feed */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading posts...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchPosts} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery || topicFilter 
                  ? 'No posts found matching your search.' 
                  : 'No posts yet. Be the first to start a discussion!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold">{post.username}</span>
                      <Badge variant="outline" className={getTopicColor(post.topic)}>
                        {post.topic}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAgo(post.created_at)}
                    </p>
                  </div>
                  {(isAdmin || post.user_id === user?.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, type: 'post', id: post.id })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap">{post.content}</p>
                
                <div className="flex items-center gap-4 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLikePost(post.id)}
                    disabled={!isAuthenticated}
                    className="gap-2"
                  >
                    <Heart className="h-4 w-4" />
                    <span>{post.likes}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleComments(post.id)}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{post.comments_count || 0}</span>
                    {expandedPosts.has(post.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Comments Section */}
                {expandedPosts.has(post.id) && (
                  <div className="pt-4 border-t space-y-4">
                    {loadingComments.has(post.id) ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {/* Existing Comments */}
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{comment.username}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimeAgo(comment.created_at)}
                                </span>
                                {(isAdmin || comment.user_id === user?.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteDialog({ open: true, type: 'comment', id: comment.id })}
                                    className="h-6 px-2 text-destructive hover:text-destructive ml-auto"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          </div>
                        ))}

                        {/* Add Comment */}
                        {isAuthenticated && (
                          <div className="flex gap-2 pt-2">
                            <Textarea
                              placeholder="Write a comment..."
                              value={newComments[post.id] || ''}
                              onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                              rows={2}
                              className="resize-none flex-1"
                            />
                            <Button
                              onClick={() => handleAddComment(post.id)}
                              disabled={postingComments.has(post.id)}
                              size="sm"
                              className="self-end"
                            >
                              {postingComments.has(post.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => 
        setDeleteDialog(prev => ({ ...prev, open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type === 'post' ? 'Post' : 'Comment'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteDialog.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

