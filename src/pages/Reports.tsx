import { useState, useEffect, useMemo } from "react"
import { FileText, Download, Eye, Search, Filter, Loader2, AlertCircle, Trash2, Download as DownloadIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { ReportsApiService, Report } from "@/services/reportsApi"
import { toast } from "@/components/ui/sonner"

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (user?.id) {
      fetchReports()
    }
  }, [user])

  const fetchReports = async () => {
    if (!user?.id) {
      setError("User not authenticated")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = isAdmin 
        ? await ReportsApiService.getAllReports(user.id)
        : await ReportsApiService.getUserReports(user.id)
      
      if (response.status === 'success' && response.reports) {
        setReports(response.reports)
      } else {
        setError(response.message || "Failed to fetch reports")
      }
    } catch (err) {
      console.error("Error fetching reports:", err)
      setError("Failed to load reports. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const formatFullDate = (timestamp: string): string => {
    try {
      // Parse the timestamp string (format: 'YYYY-MM-DD HH:MM:SS' stored in IST)
      if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        const [datePart, timePart] = timestamp.split(' ')
        const [year, month, day] = datePart.split('-').map(Number)
        const [hour, minute] = timePart.split(':').map(Number)
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthName = monthNames[month - 1]
        
        let displayHour = hour
        let ampm = 'AM'
        if (hour === 0) {
          displayHour = 12
        } else if (hour === 12) {
          ampm = 'PM'
        } else if (hour > 12) {
          displayHour = hour - 12
          ampm = 'PM'
        }
        
        const minuteStr = minute.toString().padStart(2, '0')
        const hourStr = displayHour.toString().padStart(2, '0')
        
        return `${monthName} ${day}, ${year} – ${hourStr}:${minuteStr} ${ampm}`
      } else {
        const date = new Date(timestamp)
        return date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      }
    } catch (error) {
      console.error('Error formatting date:', error, timestamp)
      return "Unknown date"
    }
  }

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) {
      return reports
    }
    
    const query = searchQuery.toLowerCase()
    return reports.filter(report => 
      report.file_name.toLowerCase().includes(query) ||
      report.prediction.toLowerCase().includes(query) ||
      formatFullDate(report.created_at).toLowerCase().includes(query) ||
      (isAdmin && report.user_email?.toLowerCase().includes(query))
    )
  }, [reports, searchQuery, isAdmin])

  const viewReport = (reportUrl: string) => {
    if (reportUrl) {
      window.open(reportUrl, '_blank', 'noopener,noreferrer')
    } else {
      toast.error("Report URL not available")
    }
  }

  const downloadReport = (report: Report) => {
    if (report.report_url) {
      // If it's a blob URL, we need to handle it differently
      if (report.report_url.startsWith('blob:')) {
        window.open(report.report_url, '_blank')
      } else {
        // For regular URLs, create a download link
        const a = document.createElement('a')
        a.href = report.report_url
        a.download = report.file_name.replace(/\.[^/.]+$/, '') + '_report.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } else {
      toast.error("Report URL not available")
    }
  }

  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      toast.error("No reports to export")
      return
    }

    const headers = isAdmin 
      ? ['File Name', 'User Email', 'Prediction', 'Confidence', 'Frames Analyzed', 'Created At']
      : ['File Name', 'Prediction', 'Confidence', 'Frames Analyzed', 'Created At']
    
    const rows = filteredReports.map(report => {
      const baseRow = [
        report.file_name,
        report.prediction,
        `${(report.confidence * 100).toFixed(1)}%`,
        report.frames_analyzed?.toString() || 'N/A',
        formatFullDate(report.created_at)
      ]
      
      if (isAdmin) {
        return [report.user_email || 'N/A', ...baseRow]
      }
      return baseRow
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("CSV exported successfully")
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View and download your deepfake detection reports
          </p>
        </div>
        <Card className="card-cyber">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading reports...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View and download your deepfake detection reports
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            {isAdmin ? "View and manage all system reports" : "View and download your deepfake detection reports"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && filteredReports.length > 0 && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              <DownloadIcon className="h-4 w-4" />
              Export CSV
            </Button>
          )}
          <Badge variant="secondary" className="text-sm">
            {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="card-cyber">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isAdmin ? "Search by file name, prediction, date, or user email..." : "Search by file name, prediction, or date..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card className="card-cyber">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No reports found" : "No reports generated yet"}
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {searchQuery 
                ? "Try adjusting your search query"
                : "Your deepfake detection reports will appear here once you generate them from the Upload page."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card 
              key={report.id} 
              className="card-cyber hover:border-primary/50 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {report.file_name}
                        </h3>
                        {isAdmin && report.user_email && (
                          <p className="text-sm text-muted-foreground">
                            User: {report.user_email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <Badge 
                        variant={report.prediction.toLowerCase() === 'fake' ? 'destructive' : 'default'}
                        className={report.prediction.toLowerCase() === 'fake' ? 'status-fake' : 'status-real'}
                      >
                        {report.prediction.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Confidence: <span className="font-medium text-foreground">{(report.confidence * 100).toFixed(1)}%</span>
                      </span>
                      {report.frames_analyzed && (
                        <span className="text-sm text-muted-foreground">
                          Frames: <span className="font-medium text-foreground">{report.frames_analyzed}</span>
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatFullDate(report.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewReport(report.report_url)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReport(report)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

