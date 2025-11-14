import { useState, useEffect } from "react"
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Clock, 
  FileText, 
  Save, 
  X,
  Loader2,
  Settings,
  Lock,
  Eye,
  EyeOff
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "@/components/ui/sonner"
import { useAuth } from "@/contexts/AuthContext"
import { ProfileApiService, UserProfile } from "@/services/profileApi"
import { useNavigate } from "react-router-dom"

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { user, checkAuth } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.id) {
      navigate('/login')
      return
    }
    fetchProfile()
  }, [user])

  useEffect(() => {
    if (profile) {
      const nameChanged = name !== profile.name
      const passwordChanged = newPassword.length > 0 || confirmPassword.length > 0 || currentPassword.length > 0
      setHasChanges(nameChanged || passwordChanged)
    }
  }, [name, newPassword, confirmPassword, currentPassword, profile])

  const fetchProfile = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const response = await ProfileApiService.getProfile(user.id)
      if (response.status === 'success' && response.profile) {
        setProfile(response.profile)
        setName(response.profile.name)
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch profile",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      toast({
        title: "Error",
        description: "Failed to fetch profile",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/(?=.*[0-9])/.test(password)) {
      return "Password must contain at least one number"
    }
    return null
  }

  const handleSave = async () => {
    if (!user?.id || !profile) return

    // Validate password if being changed
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        toast({
          title: "Validation Error",
          description: "Current password is required to change password",
          variant: "destructive"
        })
        return
      }

      if (!newPassword) {
        toast({
          title: "Validation Error",
          description: "New password is required",
          variant: "destructive"
        })
        return
      }

      if (newPassword !== confirmPassword) {
        toast({
          title: "Validation Error",
          description: "Passwords do not match",
          variant: "destructive"
        })
        return
      }

      const passwordError = validatePassword(newPassword)
      if (passwordError) {
        toast({
          title: "Validation Error",
          description: passwordError,
          variant: "destructive"
        })
        return
      }
    }

    setIsSaving(true)
    try {
      const updateData: any = {}
      
      if (name !== profile.name) {
        updateData.name = name
      }

      if (newPassword && currentPassword) {
        updateData.password = newPassword
        updateData.current_password = currentPassword
      }

      const response = await ProfileApiService.updateProfile(user.id, updateData)
      
      if (response.status === 'success') {
        sonnerToast.success("✅ Profile updated successfully")
        toast({
          title: "Success",
          description: "Profile updated successfully",
          variant: "default"
        })
        
        // Reset password fields
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        
        // Refresh profile and auth context
        await fetchProfile()
        await checkAuth()
      } else {
        throw new Error(response.message || "Failed to update profile")
      }
    } catch (error) {
      console.error('Update error:', error)
      sonnerToast.error("❌ Failed to update profile", {
        description: error instanceof Error ? error.message : "An error occurred"
      })
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setName(profile.name)
    }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setHasChanges(false)
  }

  const getInitials = (name: string, email: string) => {
    if (name && name.length > 0) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load profile</p>
              <Button onClick={fetchProfile} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info Card */}
        <Card className="card-cyber lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary mb-4">
                {getInitials(profile.name, profile.email)}
              </div>
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="mt-2">
                {profile.role === 'admin' ? 'Admin' : 'User'}
              </Badge>
            </div>

            <Separator />

            {/* User Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role === 'admin' ? 'Administrator' : 'User'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{formatDate(profile.created_at)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Activity</p>
                  <p className="font-medium">{formatDate(profile.last_login)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{profile.total_reports}</p>
                <p className="text-xs text-muted-foreground">Reports</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{profile.total_analyses}</p>
                <p className="text-xs text-muted-foreground">Analyses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form Card */}
        <Card className="card-cyber lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>
              Update your name and password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Email Field (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            {/* Role Field (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="role"
                  type="text"
                  value={profile.role === 'admin' ? 'Administrator' : 'User'}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">Role cannot be changed</p>
            </div>

            <Separator />

            {/* Password Change Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Change Password
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Leave blank if you don't want to change your password
                </p>
              </div>

              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {newPassword && (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving || !hasChanges}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

