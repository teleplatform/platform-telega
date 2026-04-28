"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Clock, 
  DollarSign, 
  Eye, 
  FileText, 
  HardDrive, 
  Server,
  Shield,
  TrendingUp
} from 'lucide-react';

// Types based on our backend API
type DashboardData = {
  overview: {
    activeJobs: number;
    queueDepths: {
      interactive: number;
      batch: number;
    };
    denyRates: Record<string, number>;
    recoveryStats: {
      recoverableFound: number;
      resumeSuccess: number;
      resumeFail: number;
    };
    gcStats: {
      lastRun: string;
      deletedJobs: number;
      deletedTraces: number;
      deletedArtifacts: number;
      durationMs: number;
    };
    costTotals: {
      today: number;
      lastHour: number;
      byKind: Record<string, number>;
    };
  };
  lastUpdated: string;
};

type SessionListItem = {
  sid: string;
  jobId?: string;
  status: string;
  lastEvent: string;
  rule?: string;
  reason?: string;
  costTotal: number;
  createdAt: string;
};

type SessionDetail = {
  sid: string;
  jobId?: string;
  status: string;
  timeline: Array<{
    timestamp: string;
    eventType: string;
    details: string;
  }>;
  explain: any; // DecisionResponse
  receipt: any; // ReceiptResponse
  recovery: {
    leases: Array<any>;
    checkpoints: Array<any>;
    resumeHistory: Array<any>;
  };
  artifacts: Array<{
    id: string;
    name: string;
    sizeBytes: number;
    retentionTier: string;
    ttlRemaining: number; // seconds
  }>;
  createdAt: string;
  updatedAt: string;
};

export default function MissionControlPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch dashboard data
        const dashboardRes = await fetch('/api/admin?path=/dashboard');
        const dashboardJson = await dashboardRes.json();
        if (dashboardJson.ok) {
          setDashboardData(dashboardJson.data);
        }
        
        // Fetch sessions list
        const sessionsRes = await fetch('/api/admin?path=/sessions');
        const sessionsJson = await sessionsRes.json();
        if (sessionsJson.ok) {
          setSessions(sessionsJson.data.sessions);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSessionClick = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin?path=/session&sid=${sessionId}`);
      const json = await res.json();
      if (json.ok) {
        setSelectedSession(json.data);
        setActiveTab('detail');
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Server className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Mission Control</h1>
          </div>
          <Badge variant="secondary">
            Last updated: {dashboardData ? new Date(dashboardData.lastUpdated).toLocaleTimeString() : 'N/A'}
          </Badge>
        </div>

        {/* Overview Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="detail">Session Detail</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Active Jobs Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData?.overview.activeJobs || 0}</div>
                  <p className="text-xs text-muted-foreground">Currently processing</p>
                </CardContent>
              </Card>

              {/* Queue Depths Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((dashboardData?.overview.queueDepths.interactive || 0) + (dashboardData?.overview.queueDepths.batch || 0)).toLocaleString()}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Interactive: {dashboardData?.overview.queueDepths.interactive}</span>
                    <span>Batch: {dashboardData?.overview.queueDepths.batch}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Cost Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(dashboardData?.overview.costTotals.today || 0) / 1000000}
                  </div>
                  <p className="text-xs text-muted-foreground">in Teletons</p>
                </CardContent>
              </Card>

              {/* Recovery Stats Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recovery</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardData?.overview.recoveryStats.recoverableFound || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Recoverable sessions</p>
                </CardContent>
              </Card>
            </div>

            {/* Deny Rates Section */}
            <Card>
              <CardHeader>
                <CardTitle>Deny Rates by Rule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.overview.denyRates || {}).map(([rule, rate]) => (
                    <div key={rule} className="flex items-center justify-between">
                      <span className="capitalize">{rule.replace('_', ' ')}</span>
                      <span>{rate.toFixed(2)}/min</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Explorer */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div 
                      key={session.sid} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSessionClick(session.sid)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{session.sid}</div>
                          <div className="text-sm text-gray-500">
                            {session.jobId ? `Job: ${session.jobId}` : 'No job ID'}
                          </div>
                        </div>
                        <Badge 
                          variant={session.status === 'completed' ? 'default' : 
                                  session.status === 'denied' ? 'destructive' : 'secondary'}
                        >
                          {session.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          <span>${session.costTotal / 1000000}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{new Date(session.createdAt).toLocaleString()}</span>
                        </div>
                        {session.rule && (
                          <div className="flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            <span>{session.rule}</span>
                          </div>
                        )}
                        {session.reason && (
                          <div className="text-red-600 text-sm">{session.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Session Detail View */}
          <TabsContent value="detail" className="space-y-6">
            {selectedSession ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Session: {selectedSession.sid}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Status: <Badge variant={selectedSession.status === 'completed' ? 'default' : 'destructive'}>
                        {selectedSession.status}
                      </Badge></span>
                      <span>Created: {new Date(selectedSession.createdAt).toLocaleString()}</span>
                      <span>Updated: {new Date(selectedSession.updatedAt).toLocaleString()}</span>
                    </div>
                  </CardHeader>
                </Card>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Explain Tab */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Eye className="h-4 w-4 mr-2" />
                        Decision Explanation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Decision:</strong> {selectedSession.explain.decision}</div>
                        <div><strong>Rule:</strong> {selectedSession.explain.rule}</div>
                        <div><strong>Reason:</strong> {selectedSession.explain.reasonCode}</div>
                        <div><strong>Summary:</strong> {selectedSession.explain.humanSummary}</div>
                        <div className="mt-3">
                          <strong>Suggested Fixes:</strong>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {selectedSession.explain.suggestedFix.map((fix: string, idx: number) => (
                              <li key={idx}>{fix}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Receipt Tab */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Cost Receipt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Total Cost:</strong> ${(selectedSession.receipt.totalCostMicros || 0) / 1000000}</div>
                        <div><strong>Model Cost:</strong> ${(selectedSession.receipt.breakdown.model.costMicros || 0) / 1000000}</div>
                        <div><strong>Tokens In:</strong> {selectedSession.receipt.breakdown.model.tokensIn}</div>
                        <div><strong>Tokens Out:</strong> {selectedSession.receipt.breakdown.model.tokensOut}</div>
                        <div><strong>Tool Calls:</strong> {selectedSession.receipt.breakdown.tools.count}</div>
                        <div><strong>Tool Cost:</strong> ${(selectedSession.receipt.breakdown.tools.costMicros || 0) / 1000000}</div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Timeline */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Session Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedSession.timeline.map((event, idx) => (
                          <div key={idx} className="flex">
                            <div className="flex flex-col items-center mr-4">
                              <div className="rounded-full border border-gray-300 h-8 w-8 flex items-center justify-center">
                                <BarChart3 className="h-4 w-4" />
                              </div>
                              {idx < selectedSession.timeline.length - 1 && (
                                <div className="h-full w-0.5 bg-gray-300 mt-1" />
                              )}
                            </div>
                            <div className="pb-8">
                              <p className="text-sm font-medium">{event.eventType}</p>
                              <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                              <p className="text-sm">{event.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a session to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Metrics View */}
          <TabsContent value="metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Active Jobs</span>
                      <span>{dashboardData?.overview.activeJobs || 0}/{dashboardData?.overview.activeJobs || 50}</span>
                    </div>
                    <Progress value={(dashboardData?.overview.activeJobs || 0) / ((dashboardData?.overview.activeJobs || 50) / 100)} className="w-full" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Queue Depth</span>
                      <span>
                        {(dashboardData?.overview.queueDepths.interactive || 0) + (dashboardData?.overview.queueDepths.batch || 0)}/1000
                      </span>
                    </div>
                    <Progress 
                      value={
                        ((dashboardData?.overview.queueDepths.interactive || 0) + (dashboardData?.overview.queueDepths.batch || 0)) / 10
                      } 
                      className="w-full" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Cost by Type</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(dashboardData?.overview.costTotals.byKind || {}).map(([kind, amount]) => (
                          <div key={kind} className="flex justify-between">
                            <span className="capitalize">{kind}:</span>
                            <span>${(amount || 0) / 1000000}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Recovery Stats</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Recoverable:</span>
                          <span>{dashboardData?.overview.recoveryStats.recoverableFound || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Resume Success:</span>
                          <span>{dashboardData?.overview.recoveryStats.resumeSuccess || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Resume Fail:</span>
                          <span>{dashboardData?.overview.recoveryStats.resumeFail || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">GC Stats</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Jobs Deleted:</span>
                          <span>{dashboardData?.overview.gcStats.deletedJobs || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Traces Deleted:</span>
                          <span>{dashboardData?.overview.gcStats.deletedTraces || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Artifacts Deleted:</span>
                          <span>{dashboardData?.overview.gcStats.deletedArtifacts || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
