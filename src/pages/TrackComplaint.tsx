import { useState, useEffect } from "react"
import { FileText, Search, AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { SupportApiService } from "@/services/supportApi"
import { useAuth } from "@/contexts/AuthContext"

export default function TrackComplaint() {
  const [complaintId, setComplaintId] = useState("")
  const [email, setEmail] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [complaint, setComplaint] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  // Prefill email if user is logged in
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email)
    }
  }, [user?.email])

  const handleSearch = async () => {
    if (!complaintId && !email) {
      toast({
        title: "Missing Information",
        description: "Please provide either Complaint ID or Email",
        variant: "destructive"
      })
      return
    }

    setIsSearching(true)
    setNotFound(false)
    setComplaint(null)

    try {
      const response = await SupportApiService.trackComplaint(
        complaintId || undefined,
        email || undefined
      )

      if (response.status === 'success' && response.complaint) {
        setComplaint(response.complaint)
        setNotFound(false)
      } else {
        setNotFound(true)
        setComplaint(null)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to track complaint",
        variant: "destructive"
      })
      setNotFound(true)
    } finally {
      setIsSearching(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
      case 'under review':
        return (
          <Badge variant="default" className="flex items-center gap-1 w-fit">
            <Loader2 className="h-3 w-3 animate-spin" />
            Under Review
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="w-fit">
            {status}
          </Badge>
        )
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Track Complaint</h1>
        <p className="text-muted-foreground mt-2">
          Enter your Complaint ID or Email to check the status of your complaint
        </p>
      </div>

      {/* Search Card */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Complaint
          </CardTitle>
          <CardDescription>
            Use either your Complaint ID or the email address you used to submit the complaint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="complaint-id">Complaint ID</Label>
              <Input
                id="complaint-id"
                value={complaintId}
                onChange={(e) => setComplaintId(e.target.value)}
                placeholder="Enter complaint ID (optional)"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email (optional)"
              />
            </div>
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="w-full md:w-auto"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Complaint Details */}
      {complaint && (
        <Card className="card-cyber border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Complaint Details
              </span>
              {getStatusBadge(complaint.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Complaint ID</Label>
                <p className="font-mono text-sm">{complaint.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {getStatusBadge(complaint.status)}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-sm">{complaint.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="text-sm">{complaint.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p className="text-sm">{complaint.type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Submitted</Label>
                <p className="text-sm">{formatDate(complaint.created_at)}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm mt-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                {complaint.description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Found Message */}
      {notFound && !isSearching && (
        <Card className="card-cyber border-destructive/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Record Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No complaint found with the provided information. Please check your email or complaint ID and try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

