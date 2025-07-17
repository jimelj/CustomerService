'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Dashboard() {
  const [callLogs, setCallLogs] = useState([])
  const [customers, setCustomers] = useState([])
  const [serviceRequests, setServiceRequests] = useState([])
  const [systemHealth, setSystemHealth] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedCall(null)
      }
    }

    if (selectedCall) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedCall])

  const fetchData = async () => {
    console.log('Fetching data...')
    try {
      console.log('Making API calls...')
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const [logsRes, customersRes, requestsRes, healthRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/call-logs`),
        fetch(`${apiBaseUrl}/api/customers`),
        fetch(`${apiBaseUrl}/api/service-requests`),
        fetch(`${apiBaseUrl}/health`)
      ])

      console.log('API responses received:', {
        logs: logsRes.status,
        customers: customersRes.status,
        requests: requestsRes.status,
        health: healthRes.status
      })

      if (logsRes.ok) {
        const logs = await logsRes.json()
        console.log('Call logs loaded:', logs.length)
        setCallLogs(logs)
      } else {
        console.error('Call logs failed:', logsRes.status)
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json()
        console.log('Customers loaded:', customersData.length)
        setCustomers(customersData)
      } else {
        console.error('Customers failed:', customersRes.status)
      }

      if (requestsRes.ok) {
        const requests = await requestsRes.json()
        console.log('Service requests loaded:', requests.length)
        setServiceRequests(requests)
      } else {
        console.error('Service requests failed:', requestsRes.status)
      }

      if (healthRes.ok) {
        const health = await healthRes.json()
        console.log('Health loaded:', health)
        setSystemHealth(health)
      } else {
        console.error('Health failed:', healthRes.status)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const getIntentBadgeVariant = (intent) => {
    switch (intent?.toLowerCase()) {
      case 'start': return 'success'
      case 'stop': return 'destructive'
      case 'missed': return 'warning'
      case 'report': return 'info'
      default: return 'secondary'
    }
  }

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success'
      case 'in-progress': return 'warning'
      case 'failed': return 'destructive'
      default: return 'secondary'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatPhone = (phone) => {
    if (!phone) return '';
    // Remove all non-digit except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Match +1XXXXXXXXXX or 1XXXXXXXXXX or XXXXXXXXXX
    const match = cleaned.match(/^(\+?1)?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      const country = match[1] ? '+1 ' : '';
      return `${country}(${match[2]}) ${match[3]}-${match[4]}`;
    }
    return phone;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CBA Customer Service Dashboard</h1>
            <p className="text-muted-foreground">Monitor calls, customers, and system health</p>
          </div>
          <Button onClick={fetchData} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Analytics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{callLogs.length}</div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
              <p className="text-xs text-muted-foreground">
                Registered customers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Service Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serviceRequests.length}</div>
              <p className="text-xs text-muted-foreground">
                Pending requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={systemHealth.status === 'healthy' ? 'success' : 'destructive'}>
                {systemHealth.status || 'Unknown'}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                Last checked: {formatDate(systemHealth.timestamp || new Date())}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Call Logs</CardTitle>
            <CardDescription>
              Latest customer service calls and their details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callLogs.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>{formatDate(call.created_at)}</TableCell>
                    <TableCell>{formatPhone(call.phoneNumber)}</TableCell>
                    <TableCell>
                      <Badge variant={getIntentBadgeVariant(call.customer?.serviceRequests?.[0]?.intent)}>
                        {call.customer?.serviceRequests?.[0]?.intent || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(call.callStatus)}>
                        {call.callStatus || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>{call.duration || 'N/A'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Call Detail Modal */}
        {selectedCall && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Call Details</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCall(null)}
                  className="absolute top-4 right-4"
                >
                  ✕
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                    <p>{formatPhone(selectedCall.phoneNumber)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                    <p>{formatDate(selectedCall.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p>{selectedCall.customer ? `${selectedCall.customer.firstName} ${selectedCall.customer.lastName}` : 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p>{selectedCall.customer?.address || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Intent</label>
                    <Badge variant={getIntentBadgeVariant(selectedCall.customer?.serviceRequests?.[0]?.intent)}>
                      {selectedCall.customer?.serviceRequests?.[0]?.intent || 'Unknown'}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge variant={getStatusBadgeVariant(selectedCall.callStatus)}>
                      {selectedCall.callStatus || 'Unknown'}
                    </Badge>
                  </div>
                </div>
                
                {selectedCall.conversationLog && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Conversation</label>
                    <div className="mt-2 p-3 bg-muted rounded-md max-h-40 overflow-y-auto">
                      {(() => {
                        try {
                          const conversation = JSON.parse(selectedCall.conversationLog);
                          return (
                            <div className="space-y-2">
                              {conversation.map((entry, index) => {
                                let message = '';
                                if (entry.message) {
                                  message = entry.message;
                                } else if (entry.user) {
                                  message = `Customer: ${entry.user}`;
                                } else if (entry.address) {
                                  message = `Address: ${entry.address}`;
                                } else if (entry.name) {
                                  message = `Name: ${entry.name}`;
                                } else {
                                  message = JSON.stringify(entry);
                                }
                                
                                return (
                                  <div key={index} className="flex flex-col">
                                    <div className="text-sm font-medium text-foreground">
                                      {message}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatDate(entry.timestamp)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } catch (error) {
                          return (
                            <pre className="text-sm whitespace-pre-wrap">{selectedCall.conversationLog}</pre>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}

                {selectedCall.audio_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Audio Recording</label>
                    <audio controls className="w-full mt-2">
                      <source src={selectedCall.audio_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
