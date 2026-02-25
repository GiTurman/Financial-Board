import React, { useState } from 'react';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck,
  Activity,
  AlertCircle,
  Loader2,
  Terminal,
  History,
  Calculator,
  BarChart2,
  Database,
  Trash2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { 
  USERS, 
  submitRequest, 
  updateRequestStatus, 
  getDirectorBoardRequests, 
  getFdFinalRequests,
  getAccountingRequests,
  getRequestById,
  getRequestsForUser,
  getAllRequests,
  deleteRequest,
  cleanTestData,
  resubmitRequest,
  runFullHierarchyTest,
  runFullLoopStressTest,
  runAccountingStressTest,
  runRevenueAndPaymentTest,
  generateScenariosPrompt413,
  generateFinancialStressData, 
  clearFinancialTestData,
  runCrossManagerPrivacyCheck,
  runCEOConsolidatedCheck,
  getCurrentWeekCashInflow,
  runStrategicFieldsValidationTest,
  runFullE2EJourneysTest,
  generateIncrementalBaseData,
  generateIncrementalMgmtData,
  generateIncrementalPrivacyData,
  clearBudgetOverride,
  generateVarianceStressData,
  runFullLifecycleStressTestP420,
  clearBudgetActuals,
  runReviewPageSyncTestP425, 
  runSystemRestoreAndRemapP426,
  runReportStressTestP425, // PROMPT 7.1-005
  runSystemStressTestP7_4_006, // PROMPT 7.4-006
} from '../services/mockService';
import { RequestStatus } from '../types';

interface ScenarioResult {
  id: number;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  errorMsg?: string;
}

export const TestCenter: React.FC = () => {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [stressLogs, setStressLogs] = useState<string[]>([]);
  
  const [incrementalStage, setIncrementalStage] = useState(0);
  const [isIncrementRunning, setIsIncrementRunning] = useState(false);

  const [p74006State, setP74006State] = useState({
    logs: [] as string[],
    progress: { current: 0, total: 100, message: ''},
    isRunning: false,
    isComplete: false,
  });

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const log = (msg: string) => {
    setStressLogs(prev => [...prev, `> ${msg}`]);
  };

  const handleRunP74006 = async () => {
    setP74006State({
        logs: [],
        progress: { current: 0, total: 100, message: 'Initializing...'},
        isRunning: true,
        isComplete: false,
    });
    const log = (msg: string) => setP74006State(prev => ({...prev, logs: [...prev.logs, `${msg}`]}));
    const setProgress = (p: {current: number; total: number; message: string}) => setP74006State(prev => ({...prev, progress: p}));
    
    try {
        await runSystemStressTestP7_4_006(log, setProgress);
        setP74006State(prev => ({...prev, isRunning: false, isComplete: true}));
    } catch(e: any) {
        log(`[CRITICAL ERROR] ${e.message}`);
        setP74006State(prev => ({...prev, isRunning: false, isComplete: false}));
    }
  };

  const handleWipeP74006 = async () => {
      setP74006State(prev => ({...prev, isRunning: true, logs: [...prev.logs, '> Wiping all test data...']}));
      await cleanTestData();
      setP74006State({ logs: ['> All test data has been wiped.'], progress: { current: 0, total: 100, message: '' }, isRunning: false, isComplete: false});
  };

  const handleRunE2EJourneys = async () => {
    setTestStatus('running');
    setStressLogs([]);
    
    const logCallback = (message: string, success: boolean = false) => {
      const prefix = success ? '[OK] ' : '... ';
      setStressLogs(prev => [...prev, `${prefix}${message}`]);
    };

    try {
      await runFullE2EJourneysTest(logCallback);
      setTestStatus('success');
    } catch(e: any) {
      logCallback(`E2E TEST FAILED: ${e.message}`);
      setTestStatus('error');
    }
  };

  const handleMasterReset = async () => {
    setIsIncrementRunning(true); // Reuse for global lock
    log("MASTER RESET: Clearing all test data...");
    await clearFinancialTestData();
    await cleanTestData();
    await clearBudgetOverride();
    await clearBudgetActuals();
    setIncrementalStage(0);
    setVarianceLogs([]);
    setP420Progress({ active: false, current: 0, total: 20, message: '' });
    setP420Logs([]);
    await delay(500);
    log("MASTER RESET: Environment clean.");
    setIsIncrementRunning(false);
  };
  
  const handleStage1 = async () => {
    setIsIncrementRunning(true);
    log("STAGE 1: Generating 10 base employee requests...");
    await generateIncrementalBaseData();
    const reqs = await getAllRequests();
    if (reqs.filter(r => r.isTestData).length >= 10) {
      log("INTEGRITY CHECK: 10 requests found. OK.");
      setIncrementalStage(1);
    } else {
      log("ERROR: Stage 1 failed. Data not generated correctly.");
    }
    setIsIncrementRunning(false);
  };

  const handleStage2 = async () => {
    setIsIncrementRunning(true);
    log("INTEGRITY CHECK: Verifying Stage 1 data...");
    let reqs = await getAllRequests();
    if (reqs.filter(r => r.isTestData).length < 10) {
       log("ERROR: Stage 1 data is missing. Aborting.");
       setIsIncrementRunning(false);
       return;
    }
    log("Check passed. STAGE 2: Generating 5 management requests...");
    await generateIncrementalMgmtData();
    reqs = await getAllRequests();
    if (reqs.filter(r => r.isTestData).length >= 15) {
      log("INTEGRITY CHECK: 15+ requests found. OK.");
      setIncrementalStage(2);
    } else {
      log("ERROR: Stage 2 failed. Data not generated correctly.");
    }
    setIsIncrementRunning(false);
  };
  
  const handleStage3 = async () => {
    setIsIncrementRunning(true);
    log("INTEGRITY CHECK: Verifying Stage 2 data...");
    const reqs = await getAllRequests();
     if (reqs.filter(r => r.isTestData).length < 15) {
       log("ERROR: Stage 2 data is missing. Aborting.");
       setIsIncrementRunning(false);
       return;
    }
    log("Check passed. STAGE 3: Generating inflow data & running privacy checks...");
    await generateIncrementalPrivacyData();
    try {
        await runCrossManagerPrivacyCheck();
        log("PRIVACY CHECK: Cross-manager isolation successful. OK.");
        await runCEOConsolidatedCheck();
        log("PRIVACY CHECK: CEO consolidation successful. OK.");
        setIncrementalStage(3);
    } catch(e: any) {
        log(`ERROR: Privacy check failed: ${e.message}`);
    }
    setIsIncrementRunning(false);
  };

  // --- Variance Test Logic ---
  const [varianceLogs, setVarianceLogs] = useState<string[]>([]);
  const [isVarianceRunning, setIsVarianceRunning] = useState(false);

  const handleVarianceStressTest = async () => {
    setIsVarianceRunning(true);
    setVarianceLogs([]);
    const logVar = (msg: string) => setVarianceLogs(prev => [...prev, `> ${msg}`]);
    
    logVar('Clearing previous overrides...');
    await clearBudgetOverride();
    logVar('Generating variance stress data...');
    await generateVarianceStressData();
    await delay(500);
    logVar('Data generated for 10 over-budget and several under-budget items.');
    logVar('VALIDATION: Please navigate to "Current Year Budget" tab.');
    logVar('Switch between Month/Quarter/Year views to verify calculations and color-coding.');
    
    setIsVarianceRunning(false);
  };

  // --- P420 Test Logic ---
  const [p420Progress, setP420Progress] = useState({ active: false, current: 0, total: 20, message: '' });
  const [p420Logs, setP420Logs] = useState<string[]>([]);

  const handleRunP420Test = async () => {
    setP420Progress({ active: true, message: 'Initializing...', current: 0, total: 20 });
    setP420Logs([]);
    const logCallback = (message: string, current: number, total: number) => {
        setP420Logs(prev => [...prev, message]);
        if (current !== undefined && total !== undefined) {
            setP420Progress({ active: true, message, current, total });
        }
    };
    await runFullLifecycleStressTestP420(logCallback);
    setP420Progress(prev => ({ ...prev, active: false, current: 20 }));
  };

  // --- Review Page Sync Test Logic ---
  const [reviewPageLogs, setReviewPageLogs] = useState<string[]>([]);
  const [isReviewPageRunning, setIsReviewPageRunning] = useState(false);

  const handleRunReviewPageTest = async () => {
      setIsReviewPageRunning(true);
      setReviewPageLogs([]);
      const logP425 = (msg: string) => setReviewPageLogs(prev => [...prev, `> ${msg}`]);
      await runReviewPageSyncTestP425(logP425);
      setIsReviewPageRunning(false);
  };
  
  // --- P426 Test Logic ---
  const [p426Logs, setP426Logs] = useState<string[]>([]);
  const [isP426Running, setIsP426Running] = useState(false);
  
  const handleRunP426Test = async () => {
      setIsP426Running(true);
      setP426Logs([]);
      const logP426 = (msg: string) => setP426Logs(prev => [...prev, `> ${msg}`]);
      logP426('> Running system restore on existing data...');
      await delay(500);
      await runSystemRestoreAndRemapP426(logP426);
      setIsP426Running(false);
  };

  // --- P425 v2: Aggregation Integrity Test Logic ---
  const [p425AggLogs, setP425AggLogs] = useState<string[]>([]);
  const [isP425AggRunning, setIsP425AggRunning] = useState(false);

  const handleRunP425AggTest = async () => {
      setIsP425AggRunning(true);
      setP425AggLogs([]);
      const logAgg = (msg: string) => setP425AggLogs(prev => [...prev, `> ${msg}`]);
      await runReportStressTestP425(logAgg);
      setIsP425AggRunning(false);
  };

  return (
    <div className="space-y-8">
       {/* Master Reset */}
       <div className="max-w-3xl mx-auto flex justify-end">
         <button
            onClick={handleMasterReset}
            disabled={isIncrementRunning || p420Progress.active}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold uppercase rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
        >
            <Trash2 size={14} /> MASTER RESET (CLEAN ALL TEST DATA)
        </button>
      </div>

      <div className="bg-white rounded-lg border-2 border-indigo-500 p-6 shadow-[8px_8px_0px_0px_rgba(99,102,241,0.5)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">System Stress Test (P7.4-006)</h3>
        {p74006State.isRunning && (
            <div className="mb-4">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-gray-500">{p74006State.progress.message}</span>
                    <span className="text-black">{p74006State.progress.current} / {p74006State.progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(p74006State.progress.current / p74006State.progress.total) * 100}%` }}></div>
                </div>
            </div>
        )}
        <div className="flex-1 bg-black text-indigo-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[100px] max-h-[200px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400">
                <Terminal size={12} /> Debug Logs
            </div>
            {p74006State.logs.length === 0 ? (<span className="text-gray-600 italic">// Standby...</span>) : (p74006State.logs.map((log, i) => (<div key={i}>{log}</div>)))}
        </div>
        <div className="flex gap-2">
            <button
                onClick={handleRunP74006}
                disabled={p74006State.isRunning}
                className="w-full py-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {p74006State.isRunning ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                INITIATE SYSTEM STRESS TEST
            </button>
            <button
                onClick={handleWipeP74006}
                disabled={p74006State.isRunning}
                className="py-3 px-4 bg-red-600 text-white hover:bg-red-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Trash2 size={12} /> WIPE
            </button>
        </div>
      </div>

      {/* P425 v2 Test Panel */}
      <div className="bg-white rounded-lg border-2 border-teal-500 p-6 shadow-[8px_8px_0px_0px_rgba(20,184,166,0.5)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">Aggregation Integrity Test (P425 v2)</h3>
        <div className="flex-1 bg-black text-teal-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[100px] max-h-[200px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400">
                <Terminal size={12} /> Console Output
            </div>
            {p425AggLogs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (p425AggLogs.map((log, i) => (<div key={i} className={log.includes('[FAIL]') ? 'text-red-400' : (log.includes('[PASS]') ? 'text-green-400' : '')}>{log}</div>)))}
        </div>
        <button
            onClick={handleRunP425AggTest}
            disabled={isP425AggRunning || p420Progress.active}
            className="w-full py-3 bg-teal-500 text-white hover:bg-teal-600 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {isP425AggRunning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            EXECUTE 30+ SCENARIO AGGREGATION TEST (P425)
        </button>
      </div>

      {/* P426 Test Panel */}
      <div className="bg-white rounded-lg border-2 border-red-500 p-6 shadow-[8px_8px_0px_0px_rgba(220,38,38,0.5)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">System Restore & Force Re-map (P426)</h3>
        <div className="flex-1 bg-black text-red-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[100px] max-h-[200px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400">
                <Terminal size={12} /> Console Output
            </div>
            {p426Logs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (p426Logs.map((log, i) => (<div key={i}>{log}</div>)))}
        </div>
        <button
            onClick={handleRunP426Test}
            disabled={isP426Running || p420Progress.active}
            className="w-full py-3 bg-red-600 text-white hover:bg-red-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {isP426Running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            EXECUTE SYSTEM RESTORE (P426)
        </button>
      </div>

      {/* Original P425 Test Panel */}
      <div className="bg-white rounded-lg border-2 border-orange-500 p-6 shadow-[8px_8px_0px_0px_rgba(249,115,22,0.5)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">Report Stress Test (P425) - 50 SCENARIOS</h3>
        <div className="flex-1 bg-black text-orange-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[100px] max-h-[200px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400">
                <Terminal size={12} /> Console Output
            </div>
            {reviewPageLogs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (reviewPageLogs.map((log, i) => (<div key={i}>{log}</div>)))}
        </div>
        <button
            onClick={handleRunReviewPageTest}
            disabled={isReviewPageRunning || p420Progress.active}
            className="w-full py-3 bg-orange-500 text-white hover:bg-orange-600 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {isReviewPageRunning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            GENERATE 50 SCENARIOS (P425)
        </button>
      </div>

       {/* P420 Test Panel */}
      <div className="bg-white rounded-lg border-2 border-gray-900 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">20 E2E Lifecycle Stress Test (P420)</h3>
        {p420Progress.active && (
            <div className="mb-4">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-gray-500">{p420Progress.message}</span>
                    <span className="text-black">{p420Progress.current} / {p420Progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(p420Progress.current / p420Progress.total) * 100}%` }}></div>
                </div>
            </div>
        )}
        <div className="flex-1 bg-black text-green-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[150px] max-h-[300px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400">
                <Terminal size={12} /> Console Output
            </div>
            {p420Logs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (p420Logs.map((log, i) => (<div key={i}>{log}</div>)))}
        </div>
        <button
            onClick={handleRunP420Test}
            disabled={p420Progress.active || isIncrementRunning}
            className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {p420Progress.active ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
            RUN 20 E2E LIFECYCLES (P420)
        </button>
      </div>


      {/* P417 Test Panel */}
      <div className="bg-white rounded-lg border-2 border-gray-900 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl mx-auto font-mono">
        <div className="flex justify-between items-center mb-8 border-b-2 border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-purple-600" />
            <div>
              <h3 className="font-black uppercase tracking-tight text-xl text-black">Hierarchy 5.0 Engine</h3>
              <p className="text-xs text-gray-500 font-bold">10-Scenario E2E Test Suite (P417)</p>
            </div>
          </div>
        </div>
        <div className="border-l border-gray-100 pl-8 flex flex-col h-full">
            <div className="flex-1 bg-black text-green-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[150px] max-h-[300px] mb-4">
                <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400"><Terminal size={12} /> Console Output</div>
                {stressLogs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (stressLogs.map((log, i) => (<div key={i}>{log}</div>)))}
            </div>
             <button 
                onClick={handleRunE2EJourneys}
                disabled={testStatus === 'running' || isIncrementRunning || p420Progress.active}
                className="w-full py-3 bg-purple-600 text-white hover:bg-purple-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {testStatus === 'running' ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                RUN 10 E2E JOURNEYS (P417)
            </button>
        </div>
      </div>

      {/* Incremental Testing Panel */}
      <div className="bg-white rounded-lg border-2 border-gray-900 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">Incremental Testing Panel (P418)</h3>
        <div className="space-y-3">
             <button onClick={handleStage1} disabled={isIncrementRunning || incrementalStage >= 1 || p420Progress.active} className={`w-full p-4 text-left font-bold text-sm uppercase transition-all rounded flex justify-between items-center ${incrementalStage >= 1 ? 'bg-green-600 text-white cursor-default' : 'bg-gray-100 hover:bg-gray-200'} ${isIncrementRunning || p420Progress.active ? 'opacity-50' : ''}`}>{<span>Stage 1: Generate Base Data (10 Requests)</span>}{incrementalStage >= 1 ? <Lock size={16} /> : <PlayCircle size={16} />}</button>
             <button onClick={handleStage2} disabled={isIncrementRunning || incrementalStage < 1 || incrementalStage >= 2 || p420Progress.active} className={`w-full p-4 text-left font-bold text-sm uppercase transition-all rounded flex justify-between items-center ${incrementalStage >= 2 ? 'bg-green-600 text-white cursor-default' : incrementalStage < 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} ${isIncrementRunning || p420Progress.active ? 'opacity-50' : ''}`}>{<span>Stage 2: Add Management Data (5 Requests)</span>}{incrementalStage >= 2 ? <Lock size={16} /> : <PlayCircle size={16} />}</button>
             <button onClick={handleStage3} disabled={isIncrementRunning || incrementalStage < 2 || incrementalStage >= 3 || p420Progress.active} className={`w-full p-4 text-left font-bold text-sm uppercase transition-all rounded flex justify-between items-center ${incrementalStage >= 3 ? 'bg-green-600 text-white cursor-default' : incrementalStage < 2 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'} ${isIncrementRunning || p420Progress.active ? 'opacity-50' : ''}`}>{<span>Stage 3: Run Privacy & Consolidation Checks</span>}{incrementalStage >= 3 ? <Lock size={16} /> : <PlayCircle size={16} />}</button>
        </div>
      </div>

       {/* Variance Analysis Test Panel */}
      <div className="bg-white rounded-lg border-2 border-gray-900 p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl mx-auto font-mono">
        <h3 className="font-black uppercase tracking-tight text-xl text-black mb-4">Variance Analysis Test (P418)</h3>
        <div className="flex-1 bg-black text-green-400 p-4 rounded text-[10px] font-mono overflow-y-auto min-h-[150px] max-h-[300px] mb-4">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2 text-gray-400"><Terminal size={12} /> Console Output</div>
            {varianceLogs.length === 0 ? (<span className="text-gray-600 italic">// Waiting to start...</span>) : (varianceLogs.map((log, i) => (<div key={i}>{log}</div>)))}
        </div>
        <button onClick={handleVarianceStressTest} disabled={isVarianceRunning || isIncrementRunning || p420Progress.active} className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded font-bold uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {isVarianceRunning ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />} EXECUTE VARIANCE STRESS TEST
        </button>
      </div>
    </div>
  );
};