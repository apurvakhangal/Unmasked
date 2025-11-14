import { useState, useEffect } from "react"
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Trash2,
  RefreshCw,
  Loader2,
  Calendar,
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Eye,
  ExternalLink
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { AdminApiService, Report } from "@/services/adminApi"
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import jsPDF from "jspdf"

export default function AdminContent() {
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [resultFilter, setResultFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [statistics, setStatistics] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [dailyReports, setDailyReports] = useState<any[]>([])
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user?.id) {
      fetchReports()
    }
  }, [user, resultFilter, dateFrom, dateTo])

  useEffect(() => {
    filterReports()
  }, [reports, searchQuery])

  useEffect(() => {
    // Always prepare chart data, even if reports array is empty
    prepareChartData()
    prepareDailyData()
    calculateStatistics()
  }, [reports])

  const calculateStatistics = () => {
    if (reports.length === 0) {
      setStatistics(null)
      return
    }

    const totalReports = reports.length
    const fakeReports = reports.filter(r => r.prediction?.toUpperCase() === 'FAKE').length
    const realReports = reports.filter(r => r.prediction?.toUpperCase() === 'REAL').length
    const fakePercentage = totalReports > 0 ? (fakeReports / totalReports) * 100 : 0
    
    const avgConfidence = reports.length > 0
      ? reports.reduce((sum, r) => sum + (r.confidence || 0), 0) / reports.length * 100
      : 0
    
    const mostRecent = reports.length > 0
      ? reports.reduce((latest, r) => {
          if (!latest) return r.created_at
          return new Date(r.created_at) > new Date(latest) ? r.created_at : latest
        }, '')
      : null

    setStatistics({
      total_reports: totalReports,
      fake_reports: fakeReports,
      real_reports: realReports,
      fake_percentage: fakePercentage,
      avg_confidence: Math.round(avgConfidence * 100) / 100,
      most_recent: mostRecent
    })
  }

  const fetchReports = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const filters: any = {}
      if (resultFilter !== "all") {
        filters.result = resultFilter
      }
      if (dateFrom) {
        filters.date_from = dateFrom
      }
      if (dateTo) {
        filters.date_to = dateTo
      }

      const response = await AdminApiService.getAllReports(user.id, filters)
      if (response.status === 'success' && response.reports) {
        setReports(response.reports)
        // Statistics are now calculated from reports array in useEffect
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to fetch reports",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterReports = () => {
    let filtered = [...reports]

    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.user_email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredReports(filtered)
  }

  const prepareChartData = () => {
    const fakeCount = reports.filter(r => r.prediction?.toUpperCase() === 'FAKE').length
    const realCount = reports.filter(r => r.prediction?.toUpperCase() === 'REAL').length
    
    // Always set chart data, even if zeros, so chart renders
    const data = [
      { name: 'Real', value: realCount, color: '#22c55e' },
      { name: 'Fake', value: fakeCount, color: '#ef4444' }
    ]
    
    setChartData(data)
  }

  const prepareDailyData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    const dailyCounts = last7Days.map(date => {
      const count = reports.filter(r => {
        const reportDate = r.created_at.split(' ')[0]
        return reportDate === date
      }).length
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      }
    })

    setDailyReports(dailyCounts)
  }

  const handleDeleteReport = async () => {
    if (!user?.id || !selectedReport) return

    setIsDeleting(true)
    setShowDeleteDialog(false)

    try {
      const response = await AdminApiService.deleteReport(selectedReport.id, user.id)
      if (response.status === 'success') {
        sonnerToast.success("✅ Report deleted successfully")
        toast({
          title: "Success",
          description: "Report deleted successfully",
          variant: "default"
        })
        fetchReports()
        setSelectedReport(null)
      } else {
        throw new Error(response.message || "Failed to delete report")
      }
    } catch (error) {
      console.error('Delete error:', error)
      sonnerToast.error("❌ Failed to delete report", {
        description: error instanceof Error ? error.message : "An error occurred"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      toast({
        title: "No Data",
        description: "No reports to export",
        variant: "destructive"
      })
      return
    }

    setIsExporting(true)
    try {
      const headers = ['Report ID', 'User Email', 'File Name', 'Confidence %', 'Result', 'Date']
      const rows = filteredReports.map(r => [
        r.id,
        r.user_email,
        r.file_name,
        (r.confidence * 100).toFixed(2),
        r.prediction,
        r.created_at
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `reports_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      sonnerToast.success("✅ CSV exported successfully")
      toast({
        title: "Success",
        description: "Reports exported to CSV",
        variant: "default"
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Error",
        description: "Failed to export CSV",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportToPDF = () => {
    if (filteredReports.length === 0) {
      toast({
        title: "No Data",
        description: "No reports to export",
        variant: "destructive"
      })
      return
    }

    setIsExporting(true)
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      let yPos = margin

      // Header
      doc.setFontSize(20)
      doc.text('Deepfake Detection Reports', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      doc.setFontSize(10)
      doc.text(`Export Date: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // Statistics
      doc.setFontSize(14)
      doc.text('Summary Statistics', margin, yPos)
      yPos += 8

      doc.setFontSize(10)
      if (statistics) {
        doc.text(`Total Reports: ${statistics.total_reports}`, margin, yPos)
        yPos += 6
        doc.text(`Fake Reports: ${statistics.fake_reports} (${statistics.fake_percentage.toFixed(1)}%)`, margin, yPos)
        yPos += 6
        doc.text(`Real Reports: ${statistics.real_reports}`, margin, yPos)
        yPos += 6
        doc.text(`Average Confidence: ${statistics.avg_confidence}%`, margin, yPos)
        yPos += 10
      }

      // Table headers
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      const colWidths = [30, 40, 50, 25, 20, 25]
      const headers = ['ID', 'User Email', 'File Name', 'Conf%', 'Result', 'Date']
      let xPos = margin

      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos)
        xPos += colWidths[i]
      })
      yPos += 8

      // Table rows (limit to 25 per page)
      doc.setFont(undefined, 'normal')
      const reportsToShow = filteredReports.slice(0, 25)
      
      reportsToShow.forEach((report, index) => {
        if (yPos > pageHeight - 30) {
          doc.addPage()
          yPos = margin
          // Redraw headers
          xPos = margin
          doc.setFont(undefined, 'bold')
          headers.forEach((header, i) => {
            doc.text(header, xPos, yPos)
            xPos += colWidths[i]
          })
          yPos += 8
          doc.setFont(undefined, 'normal')
        }

        xPos = margin
        const row = [
          report.id.substring(0, 8),
          report.user_email.substring(0, 20),
          report.file_name.substring(0, 25),
          (report.confidence * 100).toFixed(0),
          report.prediction,
          report.created_at.split(' ')[0]
        ]

        row.forEach((cell, i) => {
          doc.text(cell.toString(), xPos, yPos)
          xPos += colWidths[i]
        })
        yPos += 6
      })

      if (filteredReports.length > 25) {
        doc.addPage()
        yPos = margin
        doc.setFontSize(12)
        doc.text(`Note: Showing first 25 of ${filteredReports.length} reports`, margin, yPos)
      }

      doc.save(`reports_export_${new Date().toISOString().split('T')[0]}.pdf`)

      sonnerToast.success("✅ PDF exported successfully")
      toast({
        title: "Success",
        description: "Reports exported to PDF",
        variant: "default"
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const viewReport = async (report: Report) => {
    if (!report.report_url) {
      toast({
        title: "Error",
        description: "Report URL not available",
        variant: "destructive"
      })
      return
    }

    try {
      // If it's a blob URL, try to fetch it first to check if it's still valid
      if (report.report_url.startsWith('blob:')) {
        try {
          const response = await fetch(report.report_url)
          if (!response.ok) {
            throw new Error('Blob URL expired')
          }
          // If fetch succeeds, open the blob URL
          window.open(report.report_url, '_blank', 'noopener,noreferrer')
        } catch (error) {
          toast({
            title: "Report Unavailable",
            description: "This report is no longer available. The file may have expired or been deleted.",
            variant: "destructive"
          })
        }
      } else {
        // For regular URLs (http/https), open directly
        window.open(report.report_url, '_blank', 'noopener,noreferrer')
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

  const downloadReport = async (report: Report) => {
    if (!report.report_url) {
      toast({
        title: "Error",
        description: "Report URL not available",
        variant: "destructive"
      })
      return
    }

    try {
      // If it's a blob URL, fetch it and create a new blob URL for download
      if (report.report_url.startsWith('blob:')) {
        try {
          const response = await fetch(report.report_url)
          if (!response.ok) {
            throw new Error('Blob URL expired')
          }
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${report.file_name.replace(/\.[^/.]+$/, '')}_report.pdf`
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
        a.href = report.report_url
        a.download = `${report.file_name.replace(/\.[^/.]+$/, '')}_report.pdf`
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Content Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage all deepfake detection reports and analyses
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Analytics Dashboard */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="card-cyber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_reports}</div>
              <p className="text-xs text-muted-foreground">
                All generated reports
              </p>
            </CardContent>
          </Card>

          <Card className="card-cyber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fake Reports</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{statistics.fake_reports}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.fake_percentage.toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="card-cyber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Real Reports</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{statistics.real_reports}</div>
              <p className="text-xs text-muted-foreground">
                {(100 - statistics.fake_percentage).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="card-cyber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.avg_confidence}%</div>
              <p className="text-xs text-muted-foreground">
                Average confidence score
              </p>
            </CardContent>
          </Card>

          <Card className="card-cyber">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Recent</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {statistics.most_recent ? formatDate(statistics.most_recent).split(',')[0] : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Latest detection
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-cyber">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Reports Over Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyReports.length > 0 && dailyReports.some(d => d.count > 0) ? (
              <div className="w-full" style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyReports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No data available</p>
                  <p className="text-sm mt-1">Generate reports to see trends</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Filter reports by result, date range, or search by file name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by file name or user email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="FAKE">Fake</SelectItem>
                <SelectItem value="REAL">Real</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full md:w-[150px]"
            />
            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full md:w-[150px]"
            />
            <Button onClick={fetchReports} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="card-cyber">
        <CardHeader>
          <CardTitle>Reports ({filteredReports.length})</CardTitle>
          <CardDescription>
            All deepfake detection reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No reports found</p>
              <p className="text-sm mt-2">
                {searchQuery || resultFilter !== "all" || dateFrom || dateTo
                  ? "Try adjusting your search or filters" 
                  : "No reports generated yet"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report ID</TableHead>
                    <TableHead>User Email</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-xs">{report.id.substring(0, 8)}...</TableCell>
                      <TableCell>{report.user_email}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{report.file_name}</TableCell>
                      <TableCell>{(report.confidence * 100).toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge variant={report.prediction === 'FAKE' ? 'destructive' : 'default'}>
                          {report.prediction}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(report.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {report.report_url && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewReport(report)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Report
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadReport(report)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Report
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report)
                              setShowDeleteDialog(true)
                            }}
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

      {/* Delete Report Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the report for <strong>{selectedReport?.file_name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Report"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

