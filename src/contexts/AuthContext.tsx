import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { toast } from "@/components/ui/sonner"

export interface User {
  id: string
  email: string
  role: "admin" | "user"
  name?: string
}

export interface AuthSession {
  loggedIn: boolean
  user: User | null
  token: string
  createdAt: number
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = "http://localhost:5000/api"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user
  const isAdmin = user?.role === "admin"

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const sessionRaw = localStorage.getItem("authSession")
      if (!sessionRaw) {
        setIsLoading(false)
        return
      }

      const session: AuthSession = JSON.parse(sessionRaw)
      if (session?.loggedIn && session?.user && session?.token) {
        // Verify token with backend
        try {
          const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.token}`,
            },
            body: JSON.stringify({ token: session.token }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.status === "success") {
              setUser(session.user)
            } else {
              // Invalid token, clear session
              localStorage.removeItem("authSession")
              setUser(null)
            }
          } else {
            // Token invalid, clear session
            localStorage.removeItem("authSession")
            setUser(null)
          }
        } catch (error) {
          // If verify endpoint doesn't exist yet, use stored session
          setUser(session.user)
        }
      } else {
        localStorage.removeItem("authSession")
        setUser(null)
      }
    } catch (error) {
      console.error("Auth check error:", error)
      localStorage.removeItem("authSession")
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.status === "success" && data.user && data.token) {
        const session: AuthSession = {
          loggedIn: true,
          user: data.user,
          token: data.token,
          createdAt: Date.now(),
        }
        localStorage.setItem("authSession", JSON.stringify(session))
        setUser(data.user)
        toast.success("Login successful! Redirecting…")
        return true
      } else {
        toast.error(data.message || "Invalid email or password.")
        return false
      }
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Failed to connect to server. Please try again.")
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem("authSession")
    setUser(null)
    toast.success("Logged out successfully")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

