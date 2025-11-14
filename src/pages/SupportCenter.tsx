import { useState, useEffect } from "react"
import { 
  Shield, 
  Users, 
  FileText, 
  AlertTriangle, 
  Mail, 
  ExternalLink, 
  CheckCircle,
  Loader2,
  HelpCircle,
  BookOpen,
  Send,
  RefreshCw
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "@/components/ui/sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { SupportApiService, DailyTip } from "@/services/supportApi"

export default function SupportCenter() {
  const [expertModalOpen, setExpertModalOpen] = useState(false)
  const [complaintModalOpen, setComplaintModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dailyTips, setDailyTips] = useState<DailyTip[]>([])
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Expert request form state
  const [expertForm, setExpertForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    file_reference: '',
    description: ''
  })

  // Complaint form state
  const [complaintForm, setComplaintForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    type: '' as 'Identity Misuse' | 'Fake News' | 'Explicit Deepfake' | 'Harassment' | '',
    description: '',
    evidence_file: ''
  })

  // Newsletter subscription
  const [newsletterEmail, setNewsletterEmail] = useState(user?.email || '')

  useEffect(() => {
    fetchDailyTips()
    // Rotate tips every 5 seconds
    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % dailyTips.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [dailyTips.length])

  const fetchDailyTips = async () => {
    const response = await SupportApiService.getDailyTips()
    if (response.status === 'success' && response.tips) {
      setDailyTips(response.tips)
    }
  }

  const handleExpertRequest = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit an expert request",
        variant: "destructive"
      })
      return
    }

    if (!expertForm.name || !expertForm.email || !expertForm.description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await SupportApiService.createExpertRequest({
        user_id: user.id,
        ...expertForm
      })

      if (response.status === 'success') {
        sonnerToast.success("✅ Your request has been submitted. Our expert team will contact you within 24 hours.")
        setExpertModalOpen(false)
        setExpertForm({
          name: user.name || '',
          email: user.email || '',
          file_reference: '',
          description: ''
        })
      } else {
        throw new Error(response.message || "Failed to submit request")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit expert request",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleComplaint = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a complaint",
        variant: "destructive"
      })
      return
    }

    if (!complaintForm.name || !complaintForm.email || !complaintForm.type || !complaintForm.description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await SupportApiService.createComplaint({
        user_id: user.id,
        ...complaintForm
      } as any)

      if (response.status === 'success') {
        sonnerToast.success("✅ Complaint submitted successfully. Your complaint ID: " + response.complaint_id)
        setComplaintModalOpen(false)
        setComplaintForm({
          name: user.name || '',
          email: user.email || '',
          type: '' as any,
          description: '',
          evidence_file: ''
        })
      } else {
        throw new Error(response.message || "Failed to submit complaint")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit complaint",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNewsletterSubscribe = async () => {
    if (!newsletterEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await SupportApiService.subscribeNewsletter({
        user_id: user?.id,
        email: newsletterEmail
      })

      if (response.status === 'success') {
        sonnerToast.success("✅ " + response.message)
        setNewsletterEmail('')
      } else {
        throw new Error(response.message || "Failed to subscribe")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to subscribe",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg p-8 md:p-12" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            You're Not Alone. We're Here to Help 🤝
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl">
            If you've encountered manipulated or harmful media, take the next step safely — consult an expert, report it, or learn how to protect yourself.
          </p>
        </div>
      </div>

      {/* Section 1: Connect with Expert */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            👩‍💻 Connect with a Verification Expert
          </CardTitle>
          <CardDescription>
            Need a deeper analysis? Our verification partners and digital safety experts can review your file confidentially and help you understand the results in more detail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <Shield className="inline h-4 w-4 mr-1" />
            All requests are handled privately.
          </p>
          <Button onClick={() => setExpertModalOpen(true)} className="w-full md:w-auto">
            <Users className="h-4 w-4 mr-2" />
            Connect with Expert
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: Report or Seek Legal Help */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            🚨 Report Deepfake or Online Harassment
          </CardTitle>
          <CardDescription>
            If you believe this content violates your rights or privacy, contact law enforcement or trusted NGOs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cybercrime Portal */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cybercrime Portal (India)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Official government portal</p>
                <div className="space-y-1 text-sm">
                  <p><strong>Phone:</strong> 1930</p>
                  <p><strong>Email:</strong> help@cybercrime.gov.in</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open('https://cybercrime.gov.in/', '_blank')}
                >
                  Visit Portal <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* CyberPeace Foundation */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CyberPeace Foundation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Free legal & emotional support</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open('https://www.cyberpeace.org/', '_blank')}
                >
                  Visit Website <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Track Complaint */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Track My Complaint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Check your complaint status</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate('/track-complaint')}
                >
                  Track Complaint <FileText className="h-3 w-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Button 
            variant="outline" 
            onClick={() => setComplaintModalOpen(true)}
            className="w-full md:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Submit Complaint Form
          </Button>
        </CardContent>
      </Card>

      {/* Section 3: Learn & Stay Safe */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            🛡️ Protect Yourself from Deepfakes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dailyTips.length > 0 ? (
            <div className="relative min-h-[100px] p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Daily Safety Tip</p>
                  <p className="text-sm text-muted-foreground">
                    {dailyTips[currentTipIndex]?.text || dailyTips[0]?.text}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentTipIndex((prev) => (prev + 1) % dailyTips.length)}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading safety tips...</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="Enter your email for weekly newsletter"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleNewsletterSubscribe}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Subscribe
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Community / NGO Connect */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            💬 Join the Safety Network
          </CardTitle>
          <CardDescription>
            We partner with digital rights NGOs to offer counseling and awareness drives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline"
              onClick={() => window.location.href = 'mailto:support@deepscan.com?subject=NGO Partner Inquiry'}
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact NGO Partner
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/blogs')}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Read Awareness Blogs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expert Request Modal */}
      <Dialog open={expertModalOpen} onOpenChange={setExpertModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect with Verification Expert</DialogTitle>
            <DialogDescription>
              Fill out the form below and our expert team will contact you within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="expert-name">Name *</Label>
              <Input
                id="expert-name"
                value={expertForm.name}
                onChange={(e) => setExpertForm({ ...expertForm, name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label htmlFor="expert-email">Email *</Label>
              <Input
                id="expert-email"
                type="email"
                value={expertForm.email}
                onChange={(e) => setExpertForm({ ...expertForm, email: e.target.value })}
                placeholder="your.email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="expert-file">File ID (Optional)</Label>
              <Input
                id="expert-file"
                value={expertForm.file_reference}
                onChange={(e) => setExpertForm({ ...expertForm, file_reference: e.target.value })}
                placeholder="Report ID or file reference"
              />
            </div>
            <div>
              <Label htmlFor="expert-description">Description *</Label>
              <Textarea
                id="expert-description"
                value={expertForm.description}
                onChange={(e) => setExpertForm({ ...expertForm, description: e.target.value })}
                placeholder="Please describe what you need help with..."
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExpertModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExpertRequest} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complaint Modal */}
      <Dialog open={complaintModalOpen} onOpenChange={setComplaintModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Complaint</DialogTitle>
            <DialogDescription>
              Report deepfake content or online harassment. All complaints are handled confidentially.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="complaint-name">Name *</Label>
              <Input
                id="complaint-name"
                value={complaintForm.name}
                onChange={(e) => setComplaintForm({ ...complaintForm, name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label htmlFor="complaint-email">Email *</Label>
              <Input
                id="complaint-email"
                type="email"
                value={complaintForm.email}
                onChange={(e) => setComplaintForm({ ...complaintForm, email: e.target.value })}
                placeholder="your.email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="complaint-type">Complaint Type *</Label>
              <Select
                value={complaintForm.type}
                onValueChange={(value) => setComplaintForm({ ...complaintForm, type: value as any })}
              >
                <SelectTrigger id="complaint-type">
                  <SelectValue placeholder="Select complaint type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Identity Misuse">Identity Misuse</SelectItem>
                  <SelectItem value="Fake News">Fake News</SelectItem>
                  <SelectItem value="Explicit Deepfake">Explicit Deepfake</SelectItem>
                  <SelectItem value="Harassment">Harassment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complaint-description">Description *</Label>
              <Textarea
                id="complaint-description"
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                placeholder="Please describe the incident in detail..."
                rows={5}
              />
            </div>
            <div>
              <Label htmlFor="complaint-evidence">Evidence File URL (Optional)</Label>
              <Input
                id="complaint-evidence"
                value={complaintForm.evidence_file}
                onChange={(e) => setComplaintForm({ ...complaintForm, evidence_file: e.target.value })}
                placeholder="Link to evidence file or report"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComplaintModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleComplaint} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Complaint
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

