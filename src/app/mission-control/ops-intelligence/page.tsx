"use client";

import { useState, useEffect } from 'react';
import { OpsSignal, SignalSeverity, SignalCategory } from '../../../core/ops-intelligence/opsSignals';

// Mock data for ops signals
const MOCK_SIGNALS: OpsSignal[] = [
  {
    signalId: 'sig-capacity-001',
    severity: 'critical',
    category: 'capacity',
    summary: 'Backpressure deny rate spiked from 2.1/min to 7.8/min',
    detectedAt: new Date(Date.now() - 300000), // 5 minutes ago
    evidence: {
      metrics: ['deny_rate{rule=backpressure}=7.8'],
      sessions: ['sess-123', 'sess-456'],
      timestamps: [new Date(Date.now() - 300000)],
      details: {
        queue_depth_interactive: 120,
        queue_depth_batch: 340,
        active_jobs: 48
      }
    },
    probableCause: 'System overloaded with queue depth at 460/1000. May be caused by burst traffic or resource exhaustion.',
    recommendedActions: [
      'Check for traffic bursts or scheduled jobs',
      'Scale up workers if queue depth remains high (460/1000)',
      'Review recent deployments that might affect performance'
    ],
    resolved: false
  },
  {
    signalId: 'sig-cost-001',
    severity: 'warning',
    category: 'cost',
    summary: 'Potentially inefficient usage: tools cost (1200000) much higher than model (80000)',
    detectedAt: new Date(Date.now() - 1800000), // 30 minutes ago
    evidence: {
      metrics: ['cost_total=1280000'],
      sessions: ['sess-789'],
      timestamps: [new Date(Date.now() - 1800000)],
      details: {
        model: 80000,
        tools: 1200000
      }
    },
    probableCause: 'High tool call costs relative to model costs suggest inefficient usage pattern. May be excessive network calls or file operations.',
    recommendedActions: [
      'Review tool usage patterns in job logs',
      'Optimize network calls (batching, caching)',
      'Minimize file system operations'
    ],
    resolved: false
  },
  {
    signalId: 'sig-recovery-001',
    severity: 'critical',
    category: 'recovery',
    summary: 'Recovery storm: 12 sessions need recovery',
    detectedAt: new Date(Date.now() - 7200000), // 2 hours ago
    evidence: {
      metrics: ['recoverable_found=12'],
      sessions: ['sess-101', 'sess-102', 'sess-103', 'sess-104'],
      timestamps: [new Date(Date.now() - 7200000)],
      details: {
        resume_success: 8,
        resume_fail: 4
      }
    },
    probableCause: 'Multiple sessions failed simultaneously, suggesting system-wide issue. May be infrastructure or code deployment related.',
    recommendedActions: [
      'Check system health and infrastructure status',
      'Review recent deployments or configuration changes',
      'Monitor for cascading failures'
    ],
    resolved: true,
    resolvedAt: new Date(Date.now() - 3600000), // 1 hour ago
    resolverId: 'admin-001'
  }
];

export default function OpsIntelligencePage() {
  const [signals, setSignals] = useState<OpsSignal[]>(MOCK_SIGNALS);
  const [filteredSignals, setFilteredSignals] = useState<OpsSignal[]>(MOCK_SIGNALS);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedSignal, setSelectedSignal] = useState<OpsSignal | null>(null);
  const [filters, setFilters] = useState({
    severity: 'all' as 'all' | SignalSeverity,
    category: 'all' as 'all' | SignalCategory,
    resolved: 'active' as 'active' | 'resolved' | 'all'
  });

  // Apply filters when they change
  useEffect(() => {
    let result = [...signals];
    
    if (filters.severity !== 'all') {
      result = result.filter(s => s.severity === filters.severity);
    }
    
    if (filters.category !== 'all') {
      result = result.filter(s => s.category === filters.category);
    }
    
    if (filters.resolved === 'active') {
      result = result.filter(s => !s.resolved);
    } else if (filters.resolved === 'resolved') {
      result = result.filter(s => s.resolved);
    }
    
    setFilteredSignals(result);
  }, [filters, signals]);

  const handleResolveSignal = (signalId: string) => {
    setSignals(prev => prev.map(signal => 
      signal.signalId === signalId 
        ? { ...signal, resolved: true, resolvedAt: new Date(), resolverId: 'current-user' } 
        : signal
    ));
  };

  const getSeverityIcon = (severity: SignalSeverity) => {
    switch (severity) {
      case 'critical': return <span className="text-red-500 font-bold">🔴</span>;
      case 'warning': return <span className="text-yellow-500 font-bold">🟡</span>;
      case 'info': return <span className="text-blue-500 font-bold">🔵</span>;
      default: return <span className="text-gray-500 font-bold">ℹ️</span>;
    }
  };

  const getSeverityClass = (severity: SignalSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryClass = (category: SignalCategory) => {
    switch (category) {
      case 'capacity': return 'bg-purple-100 text-purple-800';
      case 'cost': return 'bg-green-100 text-green-800';
      case 'recovery': return 'bg-orange-100 text-orange-800';
      case 'abuse': return 'bg-red-100 text-red-800';
      case 'misuse': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-blue-600 font-bold text-xl">📊</span>
            <h1 className="text-3xl font-bold text-gray-900">Ops Intelligence</h1>
          </div>
          <div className="bg-gray-200 px-3 py-1 rounded-md text-sm">
            Auto-refresh enabled
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Critical Signals</h3>
              <span className="text-red-500 font-bold">🔴</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {signals.filter(s => s.severity === 'critical' && !s.resolved).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Needing immediate attention</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Warnings</h3>
              <span className="text-yellow-500 font-bold">🟡</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {signals.filter(s => s.severity === 'warning' && !s.resolved).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Requiring review</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Total Active</h3>
              <span className="text-gray-500 font-bold">📊</span>
            </div>
            <div className="text-2xl font-bold mt-2">{filteredSignals.length}</div>
            <p className="text-xs text-gray-500 mt-1">After filtering</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-600">Resolved Today</h3>
              <span className="text-green-500 font-bold">✅</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {signals.filter(s => s.resolved && new Date(s.detectedAt).toDateString() === new Date().toDateString()).length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Issues addressed</p>
          </div>
        </div>

        {/* Filters and Signals List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(['all', 'info', 'warning', 'critical'] as const).map(level => (
                      <button
                        key={level}
                        className={`px-3 py-1 rounded text-xs ${
                          filters.severity === level 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        onClick={() => setFilters({...filters, severity: level})}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Category</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(['all', 'capacity', 'cost', 'recovery', 'abuse', 'misuse'] as const).map(cat => (
                      <button
                        key={cat}
                        className={`px-3 py-1 rounded text-xs ${
                          filters.category === cat 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        onClick={() => setFilters({...filters, category: cat})}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(['active', 'resolved', 'all'] as const).map(status => (
                      <button
                        key={status}
                        className={`px-3 py-1 rounded text-xs ${
                          filters.resolved === status 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        onClick={() => setFilters({...filters, resolved: status})}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Signals List */}
          <div className="lg:col-span-2">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h2 className="text-lg font-semibold mb-4">Ops Signals</h2>
              <div className="space-y-4">
                {filteredSignals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl text-gray-300">📊</span>
                    <p>No signals match your filters</p>
                  </div>
                ) : (
                  filteredSignals.map(signal => (
                    <div 
                      key={signal.signalId} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        signal.resolved ? 'opacity-70 bg-green-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSignal(signal)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          {getSeverityIcon(signal.severity)}
                          <div>
                            <div className="font-medium">{signal.summary}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`px-2 py-1 rounded text-xs ${getSeverityClass(signal.severity)}`}>
                                {signal.severity.toUpperCase()}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${getCategoryClass(signal.category)}`}>
                                {signal.category}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(signal.detectedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {!signal.resolved ? (
                          <button 
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveSignal(signal.signalId);
                            }}
                          >
                            Mark Resolved
                          </button>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            Resolved
                          </span>
                        )}
                      </div>
                      
                      {signal.resolved && signal.resolvedAt && (
                        <div className="mt-2 text-xs text-green-600">
                          Resolved by {signal.resolverId} at {new Date(signal.resolvedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Signal Detail Modal */}
        {selectedSignal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center">
                      {getSeverityIcon(selectedSignal.severity)}
                      <span className="ml-2">{selectedSignal.summary}</span>
                    </h2>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`px-2 py-1 rounded text-sm ${getSeverityClass(selectedSignal.severity)}`}>
                        {selectedSignal.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm ${getCategoryClass(selectedSignal.category)}`}>
                        {selectedSignal.category}
                      </span>
                      <span className="text-sm text-gray-500">
                        Detected: {new Date(selectedSignal.detectedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button 
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedSignal(null)}
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">Probable Cause</h3>
                    <p className="text-gray-700">{selectedSignal.probableCause}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2">Evidence</h3>
                    <div className="text-sm space-y-1">
                      {selectedSignal.evidence.metrics?.map((metric, idx) => (
                        <div key={idx} className="bg-gray-100 p-2 rounded">📊 {metric}</div>
                      ))}
                      {selectedSignal.evidence.sessions?.map((session, idx) => (
                        <div key={idx} className="bg-gray-100 p-2 rounded">📋 Session: {session}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Recommended Actions</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedSignal.recommendedActions.map((action, idx) => (
                      <li key={idx} className="text-gray-700">{action}</li>
                    ))}
                  </ul>
                </div>

                {!selectedSignal.resolved ? (
                  <div className="mt-6 flex justify-end space-x-2">
                    <button 
                      className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                      onClick={() => setSelectedSignal(null)}
                    >
                      Close
                    </button>
                    <button 
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      onClick={() => {
                        handleResolveSignal(selectedSignal.signalId);
                        setSelectedSignal(null);
                      }}
                    >
                      Mark as Resolved
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 p-3 bg-green-100 rounded-md text-green-800">
                    ✅ This signal was resolved by {selectedSignal.resolverId} at {new Date(selectedSignal.resolvedAt!).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}