import { Bell, User, LogOut, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { DashboardApiService, Notification } from "@/services/dashboardApi"

export function AppHeader() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user?.id && isAuthenticated) {
      fetchNotifications()
      // Poll for notifications every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [user, isAuthenticated])

  const fetchNotifications = async () => {
    if (!user?.id) return
    
    try {
      const response = await DashboardApiService.getNotifications(user.id)
      if (response.status === 'success' && response.notifications) {
        setNotifications(response.notifications.slice(0, 5)) // Show latest 5
        setUnreadCount(response.notifications.filter(n => !n.is_read).length)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user?.id) return
    
    try {
      await DashboardApiService.markNotificationRead(notificationId, user.id)
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    try {
      if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        const [datePart, timePart] = timestamp.split(' ')
        const [year, month, day] = datePart.split('-').map(Number)
        const [hour, minute] = timePart.split(':').map(Number)
        
        const now = new Date()
        const then = new Date(year, month - 1, day, hour, minute)
        const diffMs = now.getTime() - then.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        
        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${day}/${month}`
      }
      return "Unknown"
    } catch {
      return "Unknown"
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login", { replace: true })
  }

  const handleSignIn = () => {
    navigate("/login")
  }

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">
            Deepfake Analysis System
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {/* Notifications */}
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {unreadCount} unread
                      </Badge>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-1">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                            !notification.is_read ? 'bg-primary/5 border border-primary/20' : ''
                          }`}
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                              {notification.type === "alert" && (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              )}
                              {notification.type === "warning" && (
                                <Clock className="h-4 w-4 text-warning" />
                              )}
                              {(notification.type === "info" || notification.type === "update") && (
                                <CheckCircle className="h-4 w-4 text-success" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimestamp(notification.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No notifications
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {user?.name || user?.email || "User"}
                    {user?.role === "admin" && (
                      <Badge variant="secondary" className="ml-2 text-xs">Admin</Badge>
                    )}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <User className="mr-2 h-4 w-4" />
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" onClick={handleSignIn} className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}