import { useState, useEffect } from "react"
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  RefreshCw,
  Loader2,
  User,
  Mail,
  Shield,
  Calendar,
  FileText,
  AlertTriangle
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { AdminApiService, User as UserType } from "@/services/adminApi"

export default function AdminUsers() {
  const [users, setUsers] = useState<UserType[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [userDetails, setUserDetails] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (currentUser?.id) {
      fetchUsers()
    }
  }, [currentUser])

  useEffect(() => {
    filterUsers()
  }, [users, searchQuery, roleFilter])

  const fetchUsers = async () => {
    if (!currentUser?.id) return

    setIsLoading(true)
    try {
      const response = await AdminApiService.getAllUsers(currentUser.id)
      if (response.status === 'success' && response.users) {
        setUsers(response.users)
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch users",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = [...users]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Apply role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(u => u.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }

  const handleViewDetails = async (userId: string) => {
    if (!currentUser?.id) return

    setIsLoadingDetails(true)
    setShowDetailsModal(true)
    try {
      const response = await AdminApiService.getUserDetails(userId, currentUser.id)
      if (response.status === 'success' && response.user) {
        setUserDetails(response)
        setSelectedUser(users.find(u => u.id === userId) || null)
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch user details",
          variant: "destructive"
        })
        setShowDetailsModal(false)
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error)
      toast({
        title: "Error",
        description: "Failed to fetch user details",
        variant: "destructive"
      })
      setShowDetailsModal(false)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleResetUserData = async () => {
    if (!currentUser?.id || !selectedUser) return

    setIsResetting(true)
    setShowResetDialog(false)

    try {
      const response = await AdminApiService.resetUserDataSingle(selectedUser.id, currentUser.id)
      if (response.status === 'success') {
        sonnerToast.success(`✅ User data cleared for ${selectedUser.email}`)
        toast({
          title: "Success",
          description: `User data cleared for ${selectedUser.email}`,
          variant: "default"
        })
        fetchUsers()
        setSelectedUser(null)
      } else {
        throw new Error(response.message || "Failed to reset user data")
      }
    } catch (error) {
      console.error('Reset error:', error)
      sonnerToast.error("❌ Failed to reset user data", {
        description: error instanceof Error ? error.message : "An error occurred"
      })
    } finally {
      setIsResetting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!currentUser?.id || !selectedUser) return

    setIsDeleting(true)
    setShowDeleteDialog(false)

    try {
      const response = await AdminApiService.deleteUser(selectedUser.id, currentUser.id)
      if (response.status === 'success') {
        sonnerToast.success(`✅ User ${selectedUser.email} deleted successfully`)
        toast({
          title: "Success",
          description: `User ${selectedUser.email} deleted successfully`,
          variant: "default"
        })
        fetchUsers()
        setSelectedUser(null)
      } else {
        throw new Error(response.message || "Failed to delete user")
      }
    } catch (error) {
      console.error('Delete error:', error)
      sonnerToast.error("❌ Failed to delete user", {
        description: error instanceof Error ? error.message : "An error occurred"
      })
    } finally {
      setIsDeleting(false)
    }
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage all users, view details, and perform administrative actions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered users in system
            </p>
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Users with admin privileges
            </p>
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'user').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Standard user accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Find users by email, name, or role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchUsers} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            List of all registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm mt-2">
                {searchQuery || roleFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "No users registered yet"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Analyses</TableHead>
                    <TableHead>Reports</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.total_analyses}</TableCell>
                      <TableCell>{user.total_reports}</TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(user.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowResetDialog(true)
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDeleteDialog(true)
                            }}
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete profile and activity information
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Profile Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{userDetails.user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{userDetails.user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <Badge variant={userDetails.user.role === 'admin' ? 'default' : 'secondary'}>
                      {userDetails.user.role}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Created</p>
                    <p className="font-medium">{formatDate(userDetails.user.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Analyses */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Recent Analyses</h3>
                {userDetails.recent_analyses && userDetails.recent_analyses.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.recent_analyses.map((analysis: any) => (
                      <div key={analysis.id} className="p-3 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{analysis.file_name}</p>
                          <Badge variant={analysis.prediction === 'FAKE' ? 'destructive' : 'default'}>
                            {analysis.prediction}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confidence: {(analysis.confidence * 100).toFixed(1)}% • {formatDate(analysis.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No analyses yet</p>
                )}
              </div>

              {/* Recent Reports */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Recent Reports</h3>
                {userDetails.recent_reports && userDetails.recent_reports.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.recent_reports.map((report: any) => (
                      <div key={report.id} className="p-3 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{report.file_name}</p>
                          <Badge variant={report.prediction === 'FAKE' ? 'destructive' : 'default'}>
                            {report.prediction}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confidence: {(report.confidence * 100).toFixed(1)}% • {formatDate(report.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reports yet</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reset User Data Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset User Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset all data for <strong>{selectedUser?.email}</strong>?
              This will delete all analyses, reports, history, and notifications for this user.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetUserData}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selectedUser?.email}</strong>?
              This will delete the user account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

