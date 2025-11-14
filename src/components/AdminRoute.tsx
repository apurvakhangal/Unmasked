import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/components/ui/sonner"
import { useEffect } from "react"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      if (!isAuthenticated) {
        toast.error("Please login to access this page")
      } else if (!isAdmin) {
        toast.error("Access denied. Admin privileges required.")
      }
    }
  }, [isLoading, isAuthenticated, isAdmin])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

