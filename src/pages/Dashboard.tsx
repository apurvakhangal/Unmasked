import { useState, useRef, useEffect } from "react"
import { Upload, FileText, TrendingUp, Shield, Activity, Clock, CheckCircle, AlertTriangle, X, Play, Brain, Loader2, Download, RefreshCw, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { DeepfakeApiService, PredictionResult } from "@/services/deepfakeApi"
import { useAuth } from "@/contexts/AuthContext"
import { DashboardApiService, DashboardData, RecentAnalysis, Notification } from "@/services/dashboardApi"
import { AnalysesApiService } from "@/services/analysesApi"

export default function Dashboard() {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null)
  const [currentTip, setCurrentTip] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { isAuthenticated, user } = useAuth()

  // Deepfake safety tips - defined outside component to avoid recreation
  const safetyTips = [
    "Always verify video sources before sharing — deepfakes can spread misinformation easily.",
    "Check for inconsistencies in facial movements, lighting, or audio synchronization.",
    "Be skeptical of videos showing people saying things that seem out of character.",
    "Use reverse image search to verify if images or videos have been manipulated.",
    "Look for unnatural blinking patterns or eye movements in video content.",
    "Verify information through multiple trusted sources before believing viral videos.",
    "Be cautious of videos shared on social media without clear attribution or source.",
    "Pay attention to audio quality — deepfakes often have mismatched or synthetic audio.",
    "Check the context and timing of when the video was supposedly recorded.",
    "Use official channels to verify claims made in suspicious videos.",
    "Look for signs of digital manipulation like pixelation around faces or inconsistent shadows.",
    "Be aware that deepfakes are becoming more sophisticated — stay informed about detection methods.",
    "When in doubt, don't share — preventing the spread of misinformation is crucial.",
    "Report suspected deepfakes to platform moderators to help protect others.",
    "Educate yourself and others about deepfake technology and its potential misuse."
  ]

  // Get a random tip
  const getRandomTip = () => {
    const randomIndex = Math.floor(Math.random() * safetyTips.length)
    return safetyTips[randomIndex]
  }

  // Initialize tip on component mount
  useEffect(() => {
    setCurrentTip(getRandomTip())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch dashboard data on mount and set up polling
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData()
      // Set up polling every 30 seconds for real-time updates
      const interval = setInterval(() => {
        fetchDashboardData()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [user])

  // Check if model is loaded on component mount
  useEffect(() => {
    checkModelStatus()
  }, [])

  const fetchDashboardData = async () => {
    if (!user?.id) return

    try {
      const response = await DashboardApiService.getDashboard(user.id)
      if (response.status === 'success' && response.data) {
        setDashboardData(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoadingDashboard(false)
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
        const diffDays = Math.floor(diffMs / 86400000)
        
        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${monthNames[month - 1]} ${day}, ${year}`
      }
      return "Unknown"
    } catch {
      return "Unknown"
    }
  }

  const checkModelStatus = async () => {
    try {
      const response = await DeepfakeApiService.healthCheck()
      if (response.status === 'success') {
        setModelLoaded(response.result?.model_loaded || false)
      }
    } catch (error) {
      console.error('Failed to check model status:', error)
    }
  }

  const handleQuickUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/webm', 'video/quicktime']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file (MP4, AVI, MOV, WebM)",
        variant: "destructive"
      })
      return
    }

    // Validate file size (500MB limit)
    const maxSize = 500 * 1024 * 1024 // 500MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 500MB",
        variant: "destructive"
      })
      return
    }

    setSelectedFile(file)
    startUpload(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const startUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    setPredictionResult(null)
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploading(false)
          // Start analysis
          analyzeVideo(file)
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const analyzeVideo = async (file: File) => {
    setAnalyzing(true)
    const startTime = Date.now()
    setAnalysisStartTime(startTime)
    
    try {
      const response = await DeepfakeApiService.predictVideo(file)
      
      if (response.status === 'success' && response.result) {
        const processingTime = (Date.now() - startTime) / 1000 // Convert to seconds
        setPredictionResult(response.result)
        
        // Record analysis in database
        if (user?.id) {
          try {
            await AnalysesApiService.createAnalysis({
              user_id: user.id,
              file_name: file.name,
              prediction: response.result.prediction.toUpperCase(),
              confidence: response.result.confidence,
              processing_time: processingTime
            })
            // Refresh dashboard data
            fetchDashboardData()
          } catch (error) {
            console.error('Failed to record analysis:', error)
          }
        }
        
        toast({
          title: "Analysis Complete",
          description: `Video is ${response.result.prediction} (${(response.result.confidence * 100).toFixed(1)}% confidence)`,
          variant: response.result.prediction === 'fake' ? 'destructive' : 'default'
        })
      } else {
        toast({
          title: "Analysis Failed",
          description: response.message || "Failed to analyze video",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Analysis Error",
        description: "Failed to connect to analysis service",
        variant: "destructive"
      })
    } finally {
      setAnalyzing(false)
      setAnalysisStartTime(null)
    }
  }

  const generateConfidenceChart = (result: PredictionResult): string => {
    // Create a simple bar chart showing real vs fake probabilities
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 300
    const ctx = canvas.getContext('2d')!
    
    // Background
    ctx.fillStyle = '#0b0b0b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Chart area
    const padding = 40
    const barWidth = 120
    const gap = 80
    const startX = (canvas.width - (barWidth * 2 + gap)) / 2
    const baseY = canvas.height - padding
    
    // Max bar height
    const maxBarHeight = canvas.height - padding * 2
    
    // Real bar
    const realBarHeight = maxBarHeight * result.real_probability
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(startX, baseY - realBarHeight, barWidth, realBarHeight)
    
    // Fake bar
    const fakeBarHeight = maxBarHeight * result.fake_probability
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(startX + barWidth + gap, baseY - fakeBarHeight, barWidth, fakeBarHeight)
    
    // Labels
    ctx.fillStyle = '#ddd'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Real (${(result.real_probability * 100).toFixed(1)}%)`, startX + barWidth / 2, baseY + 24)
    ctx.fillText(`Fake (${(result.fake_probability * 100).toFixed(1)}%)`, startX + barWidth + gap + barWidth / 2, baseY + 24)
    
    // Title
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText('Confidence Analysis', canvas.width / 2, padding - 10)
    
    return canvas.toDataURL('image/png')
  }

  const generateReport = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate reports",
        variant: "destructive"
      })
      return
    }

    if (!selectedFile || !predictionResult) {
      toast({
        title: "No Analysis Data",
        description: "Please analyze a video first",
        variant: "destructive"
      })
      return
    }

    setGeneratingReport(true)

    try {
      // Generate chart
      const chartImage = generateConfidenceChart(predictionResult)
      
      // Get model version
      const modelInfo = await DeepfakeApiService.getModelInfo()
      const modelVersion = modelInfo.status === 'success' ? 'deepfake_model.h5' : 'deepfake_model.h5'
      
      // Prepare report data
      const reportData = {
        filename: selectedFile.name,
        prediction: predictionResult.prediction,
        confidence: predictionResult.confidence,
        frames_analyzed: predictionResult.frames_analyzed,
        fake_probability: predictionResult.fake_probability,
        real_probability: predictionResult.real_probability,
        chart_image: chartImage,
        model_version: modelVersion
      }

      // Generate PDF via backend
      const response = await fetch('http://localhost:5000/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Download PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deepfake_report_${selectedFile.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Report generated successfully!",
        description: "PDF report has been downloaded",
        variant: "default"
      })
    } catch (error) {
      console.error('Report generation error:', error)
      toast({
        title: "Failed to generate report",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setUploadProgress(0)
    setPredictionResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor deepfake detection activities and system performance
        </p>
      </div>

      {/* Daily Deepfake Safety Tip */}
      <Card className="card-cyber border-l-4 border-l-primary/50" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 mt-1">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">🔒 Daily Deepfake Safety Tip</h3>
                </div>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {currentTip || "Loading safety tip..."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentTip(getRandomTip())}
              className="shrink-0 border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              🔁 New Tip
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{dashboardData?.totalAnalyses.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  {dashboardData?.totalAnalyses ? 'All time analyses' : 'No analyses yet'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deepfakes Detected</CardTitle>
            <Shield className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">{dashboardData?.deepfakesDetected || 0}</div>
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {dashboardData?.totalAnalyses 
                    ? `${((dashboardData.deepfakesDetected / dashboardData.totalAnalyses) * 100).toFixed(1)}% detection rate`
                    : 'No detections yet'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-success">{dashboardData?.accuracyRate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  <CheckCircle className="inline h-3 w-3 mr-1" />
                  Average confidence score
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-cyber">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{dashboardData?.avgProcessingTime.toFixed(1) || 0}s</div>
                <p className="text-xs text-muted-foreground">
                  Average analysis duration
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Upload */}
        <Card className="card-cyber">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Quick Analysis
            </CardTitle>
            <CardDescription>
              Upload a file for immediate deepfake detection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Upload zone */}
            <div 
              className={`upload-zone rounded-lg p-6 text-center border-2 border-dashed transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : selectedFile 
                    ? 'border-success bg-success/5' 
                    : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Play className="h-6 w-6 text-success" />
                    <span className="font-medium text-success">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag & drop your video file here, or click to browse
                  </p>
                  <Button 
                    onClick={handleQuickUpload} 
                    disabled={uploading}
                    className="btn-hero"
                  >
                    {uploading ? "Uploading..." : "Select Video File"}
                  </Button>
                </>
              )}
            </div>
            
            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading video... ({uploadProgress}%)
                </p>
              </div>
            )}

            {analyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analyzing video with AI model...</span>
                </div>
                <Progress value={75} className="animate-pulse" />
                <p className="text-xs text-muted-foreground text-center">
                  Extracting frames and running deepfake detection
                </p>
              </div>
            )}

            {predictionResult && (
              <div className="space-y-3 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Analysis Results</h4>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={predictionResult.prediction === 'fake' ? 'destructive' : 'default'}
                      className={predictionResult.prediction === 'fake' ? 'status-fake' : 'status-real'}
                    >
                      {predictionResult.prediction === 'fake' ? 'FAKE' : 'REAL'}
                    </Badge>
                    {isAuthenticated && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateReport}
                        disabled={generatingReport}
                        className="flex items-center gap-1"
                      >
                        {generatingReport ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            PDF
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Confidence:</span>
                    <span className="font-medium">{(predictionResult.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fake Probability:</span>
                    <span className="font-medium">{(predictionResult.fake_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Real Probability:</span>
                    <span className="font-medium">{(predictionResult.real_probability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frames Analyzed:</span>
                    <span className="font-medium">{predictionResult.frames_analyzed}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Real</span>
                    <span>Fake</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${predictionResult.real_probability * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Supported formats: MP4, AVI, MOV, WebM</p>
              <p>• Maximum file size: 500MB</p>
              <p>• Average processing time: 1-3 seconds</p>
              <div className="flex items-center gap-2 mt-2">
                <Brain className="h-3 w-3" />
                <span>Model Status: {modelLoaded ? 'Loaded' : 'Not Loaded'}</span>
                <Badge variant={modelLoaded ? 'default' : 'secondary'} className="text-xs">
                  {modelLoaded ? 'Ready' : 'Training Required'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="card-cyber">
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>
              Latest deepfake detection results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData?.recentAnalyses && dashboardData.recentAnalyses.length > 0 ? (
                  dashboardData.recentAnalyses.map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{analysis.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(analysis.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {analysis.prediction === "REAL" && (
                          <Badge className="status-real">
                            Real ({(analysis.confidence * 100).toFixed(0)}%)
                          </Badge>
                        )}
                        {analysis.prediction === "FAKE" && (
                          <Badge className="status-fake">
                            Fake ({(analysis.confidence * 100).toFixed(0)}%)
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No analyses yet</p>
                    <p className="text-xs mt-2">Upload a video to get started</p>
                  </div>
                )}
                {analyzing && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedFile?.name || "Analyzing..."}</p>
                      <p className="text-xs text-muted-foreground">Just now</p>
                    </div>
                    <Badge className="status-analyzing">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Analyzing...
                    </Badge>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 text-center">
              <Link to="/history">
                <Button variant="ghost" size="sm">
                  View All Results
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle>System Notifications</CardTitle>
          <CardDescription>
            Recent alerts and system updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDashboard ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {dashboardData?.notifications && dashboardData.notifications.length > 0 ? (
                dashboardData.notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors ${!notification.is_read ? 'bg-primary/5' : ''}`}
                  >
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
                      <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatTimestamp(notification.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No notifications</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}