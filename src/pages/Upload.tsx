import { useState, useRef, useEffect } from "react"
import { Upload, FileVideo, X, CheckCircle, AlertCircle, Loader2, Brain, Download, FileText, Eye, HelpCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "@/components/ui/sonner"
import { DeepfakeApiService, PredictionResult } from "@/services/deepfakeApi"
import { useAuth } from "@/contexts/AuthContext"
import { HistoryApiService } from "@/services/historyApi"
import { ReportsApiService } from "@/services/reportsApi"
import { AnalysesApiService } from "@/services/analysesApi"

interface UploadedFile {
  file: File
  uploadProgress: number
  status: "uploading" | "analyzing" | "completed" | "error"
  result?: PredictionResult
  error?: string
  generatingReport?: boolean
  reportReady?: boolean
  reportUrl?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  // Check if model is loaded on component mount
  useEffect(() => {
    checkModelStatus()
  }, [])

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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const validateFile = (file: File): string | null => {
    // Only accept video files
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/webm', 'video/quicktime']
    const maxSize = 500 * 1024 * 1024 // 500MB

    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please use MP4, AVI, MOV, or WebM video files.`
    }

    if (file.size > maxSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 500MB limit.`
    }

    return null
  }

  const handleFiles = (fileList: File[]) => {
    const newFiles: UploadedFile[] = []

    fileList.forEach(file => {
      const error = validateFile(file)
      if (error) {
        toast({
          title: "Invalid File",
          description: error,
          variant: "destructive"
        })
        newFiles.push({
          file,
          uploadProgress: 0,
          status: "error",
          error
        })
      } else {
        newFiles.push({
          file,
          uploadProgress: 0,
          status: "uploading"
        })
      }
    })

    setFiles(prev => {
      const updated = [...prev, ...newFiles]
      // Process each valid file after state is updated
      newFiles.forEach((uploadedFile) => {
        if (uploadedFile.status !== "error") {
          processFile(uploadedFile.file)
        }
      })
      return updated
    })
  }

  const processFile = (file: File) => {
    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.file === file && f.status === "uploading") {
          const newProgress = Math.min(f.uploadProgress + 10, 100)
          if (newProgress >= 100) {
            clearInterval(uploadInterval)
            // Start analysis
            analyzeVideo(file)
            return { ...f, uploadProgress: 100, status: "analyzing" }
          }
          return { ...f, uploadProgress: newProgress }
        }
        return f
      }))
    }, 200)
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
    const chartWidth = canvas.width - padding * 2
    const chartHeight = canvas.height - padding * 2
    const barWidth = 120
    const gap = 80
    const startX = (canvas.width - (barWidth * 2 + gap)) / 2
    const baseY = canvas.height - padding
    
    // Max bar height
    const maxBarHeight = chartHeight
    
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

  const generateReport = async (file: File, result: PredictionResult) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate reports",
        variant: "destructive"
      })
      return
    }

    setFiles(prev => prev.map(f => 
      f.file === file 
        ? { ...f, generatingReport: true }
        : f
    ))

    try {
      // Generate chart
      const chartImage = generateConfidenceChart(result)
      
      // Get model version (you can enhance this to get actual model info)
      const modelInfo = await DeepfakeApiService.getModelInfo()
      const modelVersion = modelInfo.status === 'success' ? 'deepfake_model.h5' : 'deepfake_model.h5'
      
      // Prepare report data
      const reportData = {
        filename: file.name,
        prediction: result.prediction,
        confidence: result.confidence,
        frames_analyzed: result.frames_analyzed,
        fake_probability: result.fake_probability,
        real_probability: result.real_probability,
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
      
      // Create a copy of the blob for download (so we don't revoke the original URL)
      const downloadBlob = blob.slice()
      const downloadUrl = window.URL.createObjectURL(downloadBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const reportFileName = `deepfake_report_${file.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.pdf`
      a.download = reportFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Revoke only the download URL, keep the original for viewing
      window.URL.revokeObjectURL(downloadUrl)
      
      // Save report to database
      // Note: In production, upload the PDF to a storage service (Supabase Storage, S3, etc.)
      // and use the permanent URL instead of the blob URL
      if (user?.id) {
        try {
          await ReportsApiService.createReport({
            user_id: user.id,
            file_name: file.name,
            prediction: result.prediction,
            confidence: result.confidence,
            frames_analyzed: result.frames_analyzed,
            report_url: url, // Blob URL (temporary - in production use permanent storage URL)
            model_version: modelVersion
          })
          
          sonnerToast.success("✅ Report saved successfully!")
        } catch (error) {
          console.error('Failed to save report:', error)
          // Don't show error to user, report generation was successful
        }
      }

      // Note: We keep the blob URL alive so reports can be accessed later
      // In production, you'd upload to storage and use a permanent URL
      // Store the URL in state - this will trigger the UI to show View/Download options
      setFiles(prev => prev.map(f => 
        f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified
          ? { ...f, generatingReport: false, reportReady: true, reportUrl: url }
          : f
      ))

      toast({
        title: "Report generated successfully!",
        description: "PDF report has been downloaded and saved",
        variant: "default"
      })
    } catch (error) {
      console.error('Report generation error:', error)
      setFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, generatingReport: false }
          : f
      ))
      
      toast({
        title: "Failed to generate report",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    }
  }

  const analyzeVideo = async (file: File) => {
    const startTime = Date.now()
    
    try {
      const response = await DeepfakeApiService.predictVideo(file)
      
      if (response.status === 'success' && response.result) {
        const processingTime = (Date.now() - startTime) / 1000 // Convert to seconds
        
        setFiles(prev => prev.map(f => 
          f.file === file 
            ? { ...f, status: "completed", result: response.result }
            : f
        ))
        
        // Record history and analysis if user is authenticated
        if (isAuthenticated && user?.id && response.result) {
          try {
            // Record in history
            await HistoryApiService.createHistory({
              user_id: user.id,
              action_type: 'scan',
              file_name: file.name,
              prediction: response.result.prediction,
              confidence: response.result.confidence,
            })
            
            // Record in analyses table for dashboard
            await AnalysesApiService.createAnalysis({
              user_id: user.id,
              file_name: file.name,
              prediction: response.result.prediction.toUpperCase(),
              confidence: response.result.confidence,
              processing_time: processingTime
            })
          } catch (error) {
            console.error('Failed to record history/analysis:', error)
            // Don't show error to user, recording is non-critical
          }
        }
        
        toast({
          title: "Analysis Complete",
          description: `Video is ${response.result.prediction} (${(response.result.confidence * 100).toFixed(1)}% confidence)`,
          variant: response.result.prediction === 'fake' ? 'destructive' : 'default'
        })
      } else {
        setFiles(prev => prev.map(f => 
          f.file === file 
            ? { 
                ...f, 
                status: "error", 
                error: response.message || "Failed to analyze video" 
              }
            : f
        ))
        
        toast({
          title: "Analysis Failed",
          description: response.message || "Failed to analyze video",
          variant: "destructive"
        })
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.file === file 
          ? { 
              ...f, 
              status: "error", 
              error: "Failed to connect to analysis service" 
            }
          : f
      ))
      
      toast({
        title: "Analysis Error",
        description: "Failed to connect to analysis service",
        variant: "destructive"
      })
    }
  }

  const removeFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(f => f.file !== fileToRemove))
  }

  const viewReport = async (reportUrl: string, fileName: string) => {
    if (!reportUrl) {
      toast({
        title: "Error",
        description: "Report URL not available",
        variant: "destructive"
      })
      return
    }

    try {
      // If it's a blob URL, try to fetch it first to check if it's still valid
      if (reportUrl.startsWith('blob:')) {
        try {
          const response = await fetch(reportUrl)
          if (!response.ok) {
            throw new Error('Blob URL expired')
          }
          // If fetch succeeds, open the blob URL
          window.open(reportUrl, '_blank', 'noopener,noreferrer')
        } catch (error) {
          toast({
            title: "Report Unavailable",
            description: "This report is no longer available. The file may have expired or been deleted.",
            variant: "destructive"
          })
        }
      } else {
        // For regular URLs (http/https), open directly
        window.open(reportUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('View report error:', error)
      toast({
        title: "Error",
        description: "Failed to open report",
        variant: "destructive"
      })
    }
  }

  const downloadReport = async (reportUrl: string, fileName: string) => {
    if (!reportUrl) {
      toast({
        title: "Error",
        description: "Report URL not available",
        variant: "destructive"
      })
      return
    }

    try {
      // If it's a blob URL, fetch it and create a new blob URL for download
      if (reportUrl.startsWith('blob:')) {
        try {
          const response = await fetch(reportUrl)
          if (!response.ok) {
            throw new Error('Blob URL expired')
          }
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${fileName.replace(/\.[^/.]+$/, '')}_report.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
          
          sonnerToast.success("✅ Report downloaded successfully")
        } catch (error) {
          toast({
            title: "Report Unavailable",
            description: "This report is no longer available. The file may have expired or been deleted.",
            variant: "destructive"
          })
        }
      } else {
        // For regular URLs, create a download link
        const a = document.createElement('a')
        a.href = reportUrl
        a.download = `${fileName.replace(/\.[^/.]+$/, '')}_report.pdf`
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        
        sonnerToast.success("✅ Report downloaded successfully")
      }
    } catch (error) {
      console.error('Download report error:', error)
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive"
      })
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload & Analyze</h1>
        <p className="text-muted-foreground mt-2">
          Upload video files for deepfake detection analysis
        </p>
      </div>

      {/* Upload Zone */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            File Upload
          </CardTitle>
          <CardDescription>
            Drag and drop your video files here or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`upload-zone rounded-lg p-8 text-center transition-all border-2 border-dashed ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Drop your video files here</h3>
            <p className="text-muted-foreground mb-4">
              or click the button below to browse
            </p>
            <Button onClick={openFileDialog} className="btn-hero">
              Select Video Files
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="video/mp4,video/avi,video/mov,video/webm,video/quicktime"
              onChange={handleFileInput}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4" />
              <span>Videos: MP4, AVI, MOV, WebM</span>
            </div>
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Max size: 500MB per file</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-3 w-3" />
              <span>Model Status: {modelLoaded ? 'Loaded' : 'Not Loaded'}</span>
              <Badge variant={modelLoaded ? 'default' : 'secondary'} className="text-xs">
                {modelLoaded ? 'Ready' : 'Training Required'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Processing Queue */}
      {files.length > 0 && (
        <Card className="card-cyber">
          <CardHeader>
            <CardTitle>Processing Queue</CardTitle>
            <CardDescription>
              Track the progress of your uploaded files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((uploadedFile, index) => (
                <div key={index} className="border border-border/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <FileVideo className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{uploadedFile.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadedFile.status === "completed" && uploadedFile.result && (
                        <Badge 
                          variant={uploadedFile.result.prediction === 'fake' ? 'destructive' : 'default'}
                          className={uploadedFile.result.prediction === 'fake' ? 'status-fake' : 'status-real'}
                        >
                          {uploadedFile.result.prediction === 'fake' ? 'FAKE' : 'REAL'}
                        </Badge>
                      )}
                      {uploadedFile.status === "error" && (
                        <Badge variant="destructive">Error</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.file)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {uploadedFile.status === "error" && uploadedFile.error && (
                    <Alert className="mb-3" variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{uploadedFile.error}</AlertDescription>
                    </Alert>
                  )}

                  {uploadedFile.status === "uploading" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Uploading...</span>
                        <span className="text-muted-foreground">
                          {uploadedFile.uploadProgress}%
                        </span>
                      </div>
                      <Progress value={uploadedFile.uploadProgress} />
                    </div>
                  )}

                  {uploadedFile.status === "analyzing" && (
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

                  {uploadedFile.status === "completed" && uploadedFile.result && (
                    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Analysis Results</h4>
                        <Badge 
                          variant={uploadedFile.result.prediction === 'fake' ? 'destructive' : 'default'}
                          className={uploadedFile.result.prediction === 'fake' ? 'status-fake' : 'status-real'}
                        >
                          {uploadedFile.result.prediction === 'fake' ? 'FAKE' : 'REAL'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Confidence:</span>
                          <span className="font-medium">{(uploadedFile.result.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Fake Probability:</span>
                          <span className="font-medium">{(uploadedFile.result.fake_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Real Probability:</span>
                          <span className="font-medium">{(uploadedFile.result.real_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Frames Analyzed:</span>
                          <span className="font-medium">{uploadedFile.result.frames_analyzed}</span>
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
                            style={{ width: `${uploadedFile.result.real_probability * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium text-success">Analysis Complete</span>
                          </div>
                          {isAuthenticated && (
                            <div className="flex items-center gap-2">
                            {!uploadedFile.reportReady && !uploadedFile.reportUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => uploadedFile.result && generateReport(uploadedFile.file, uploadedFile.result)}
                                disabled={uploadedFile.generatingReport}
                                className="flex items-center gap-2"
                              >
                                {uploadedFile.generatingReport ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-4 w-4" />
                                    Generate Report
                                  </>
                                )}
                              </Button>
                            ) : (uploadedFile.reportReady || uploadedFile.reportUrl) ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Report
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => uploadedFile.reportUrl && viewReport(uploadedFile.reportUrl, uploadedFile.file.name)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Report
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => uploadedFile.reportUrl && downloadReport(uploadedFile.reportUrl, uploadedFile.file.name)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Report
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                            </div>
                          )}
                          {!isAuthenticated && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>Login to generate report</span>
                            </div>
                          )}
                        </div>
                        {isAuthenticated && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/support')}
                            className="w-full border-primary/20 hover:bg-primary/10 hover:border-primary/40"
                          >
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Need Help or Expert Review?
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
