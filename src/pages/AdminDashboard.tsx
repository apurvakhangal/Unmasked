import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { 
  Settings, 
  Trash2, 
  Users, 
  FileText, 
  History, 
  Bell,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "@/components/ui/sonner"
import { useAuth } from "@/contexts/AuthContext"
import { AdminApiService } from "@/services/adminApi"

export default function AdminDashboard() {
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleResetData = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive"
      })
      return
    }

    setIsResetting(true)
    setShowResetDialog(false)

    try {
      const response = await AdminApiService.resetUserData(user.id)

      if (response.status === 'success') {
        const deleted = response.deleted || {}
        sonnerToast.success(
          `✅ All user data has been cleared successfully!`,
          {
            description: `Deleted ${deleted.analyses || 0} analyses, ${deleted.reports || 0} reports, ${deleted.history || 0} history entries, ${deleted.notifications || 0} notifications`
          }
        )
        
        toast({
          title: "Success",
          description: "All user data cleared. New user mantasha@gmail.com has been added.",
          variant: "default"
        })
        
        // Navigate to dashboard after 1 second to show updated data
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 1000)
      } else {
        throw new Error(response.message || "Failed to reset data")
      }
    } catch (error) {
      console.error('Reset error:', error)
      sonnerToast.error(
        "❌ Error occurred while resetting data",
        {
          description: error instanceof Error ? error.message : "An unexpected error occurred"
        }
      )
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset user data",
        variant: "destructive"
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage system settings and user data
        </p>
      </div>

      {/* Warning Alert */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin Area:</strong> Use caution when performing administrative actions. 
          These actions cannot be undone.
        </AlertDescription>
      </Alert>

      {/* Reset Data Card */}
      <Card className="card-cyber border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-destructive" />
            Data Management
          </CardTitle>
          <CardDescription>
            Reset all user data including analyses, reports, history, and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-semibold mb-2">What will be deleted:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                All analyses records
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                All reports
              </li>
              <li className="flex items-center gap-2">
                <History className="h-3 w-3" />
                All history entries
              </li>
              <li className="flex items-center gap-2">
                <Bell className="h-3 w-3" />
                All notifications
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <h4 className="font-semibold mb-2 text-success">What will be preserved:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-success" />
                All user accounts (users table)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-success" />
                Admin logs
              </li>
            </ul>
          </div>

          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowResetDialog(true)}
            disabled={isResetting}
            className="w-full"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting Data...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                ⚙️ Reset All User Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Actions Info */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Actions
          </CardTitle>
          <CardDescription>
            All administrative actions are logged for audit purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you perform a data reset, the action will be logged in the admin_logs table 
            with your email, timestamp, and action details. This ensures accountability and 
            provides an audit trail for administrative operations.
          </p>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Data Reset
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-foreground">
                Are you sure you want to reset all user data?
              </p>
              <p>
                This action will <strong>permanently delete</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All analyses records</li>
                <li>All reports</li>
                <li>All history entries</li>
                <li>All notifications</li>
              </ul>
              <p className="pt-2 border-t">
                <strong>This action cannot be undone.</strong> User accounts will remain intact.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetData}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Yes, Reset All Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

