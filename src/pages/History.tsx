import { useState, useEffect } from "react"
import { History, Brain, Newspaper, Download, ExternalLink, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { HistoryApiService, HistoryEntry } from "@/services/historyApi"

export default function HistoryPage() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user?.id) {
      fetchHistory()
    }
  }, [user])

  const fetchHistory = async () => {
    if (!user?.id) {
      setError("User not authenticated")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await HistoryApiService.getHistory(user.id)
      
      if (response.status === 'success' && response.history) {
        setHistoryEntries(response.history)
      } else {
        setError(response.message || "Failed to fetch history")
      }
    } catch (err) {
      console.error("Error fetching history:", err)
      setError("Failed to load history. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const formatFullDate = (timestamp: string): string => {
    try {
      // Parse the timestamp string (format: 'YYYY-MM-DD HH:MM:SS' stored in IST)
      // Check if timestamp is in SQLite format (YYYY-MM-DD HH:MM:SS)
      if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Parse the timestamp - it's already in IST format
        const [datePart, timePart] = timestamp.split(' ')
        const [year, month, day] = datePart.split('-').map(Number)
        const [hour, minute] = timePart.split(':').map(Number)
        
        // Create a date object in UTC, then convert to IST for display
        // Since timestamp is in IST, we need to create it as if it were UTC+5:30
        // We'll create an ISO string with IST offset and parse it
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthName = monthNames[month - 1]
        
        // Format hour for 12-hour format
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
        
        return `${monthName} ${day}, ${year}, ${hourStr}:${minuteStr} ${ampm}`
      } else {
        // Try parsing as ISO string or other format
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

  const downloadReport = (reportUrl: string) => {
    if (reportUrl) {
      window.open(reportUrl, '_blank')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity History</h1>
          <p className="text-muted-foreground mt-2">
            View your deepfake scans and news article views
          </p>
        </div>
        <Card className="card-cyber">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading your history...</p>
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
          <h1 className="text-3xl font-bold text-foreground">Activity History</h1>
          <p className="text-muted-foreground mt-2">
            View your deepfake scans and news article views
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
            <History className="h-8 w-8" />
            Activity History
          </h1>
          <p className="text-muted-foreground mt-2">
            View your deepfake scans and news article views
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {historyEntries.length} {historyEntries.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </div>

      {historyEntries.length === 0 ? (
        <Card className="card-cyber">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your deepfake scans and news article views will appear here once you start using the platform.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {historyEntries.map((entry) => (
            <Card 
              key={entry.id} 
              className="card-cyber hover:border-primary/50 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-lg ${
                    entry.action_type === 'scan' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {entry.action_type === 'scan' ? (
                      <Brain className="h-5 w-5" />
                    ) : (
                      <Newspaper className="h-5 w-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={entry.action_type === 'scan' ? 'default' : 'secondary'}>
                            {entry.action_type === 'scan' ? 'Deepfake Scan' : 'News View'}
                          </Badge>
                        </div>

                        {entry.action_type === 'scan' ? (
                          <div className="space-y-1">
                            <h3 className="font-semibold text-foreground">
                              {entry.file_name || 'Unknown file'}
                            </h3>
                            {entry.prediction && (
                              <div className="flex items-center gap-3 text-sm">
                                <Badge 
                                  variant={entry.prediction === 'fake' ? 'destructive' : 'default'}
                                  className={entry.prediction === 'fake' ? 'status-fake' : 'status-real'}
                                >
                                  {entry.prediction.toUpperCase()}
                                </Badge>
                                {entry.confidence !== null && entry.confidence !== undefined && (
                                  <span className="text-muted-foreground">
                                    Confidence: {(entry.confidence * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {entry.news_title || 'Unknown article'}
                            </h3>
                            {entry.news_url && (
                              <a
                                href={entry.news_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                View Article
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {formatFullDate(entry.timestamp)}
                      </span>
                      {entry.action_type === 'scan' && entry.report_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadReport(entry.report_url!)}
                          className="ml-auto"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Report
                        </Button>
                      )}
                    </div>
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

