
import React, { useEffect, useState, useMemo } from 'react';
// FIX: Import FundBalance from types.ts directly
import { User, ExpenseRequest, RequestStatus, UserRole, BoardSession, ExpenseFund, Priority, FundBalance } from '../types';
import { 
  getDirectorBoardRequests, 
  getAllRequests,
  updateRequestStatus, 
  updateRequestDetails,
  getBoardSession,
  getExpenseFunds,
  getRealTimeFundBalances
} from '../services/mockService';
import { 
  Check, 
  X, 
  CornerUpLeft, 
  ArrowRight,
  History,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  Info,
  Download,
  Database
} from 'lucide-react';
import { exportGenericToExcel } from '../utils/excelExport';
import { formatNumber } from '../utils/formatters';

interface DirectorApprovalsProps {
  user: User;
  currentStep?: number;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StatusControl = ({ 
  current, 
  onChange, 
  disabled 
}: { 
  current: string | undefined;
  onChange: (val: string) => void; 
  disabled: boolean;
}) => {
  return (
    <div className="flex flex-col gap-1 items-center">
      <div className={`text-[9px] font-bold uppercase tracking-tight ${
        current === 'დასტურდება' ? 'text-green-600' : 
        current === 'ბრუნდება' ? 'text-yellow-600' : 
        current === 'უარყოფილია' ? 'text-red-600' : 'text-gray-400'
      }`}>
        {current || '-'}
      </div>
      
      <div className="flex gap-1">
        <button 
          onClick={() => onChange('დასტურდება')}
          disabled={disabled}
          title="დადასტურება"
          className={`p-1 rounded border transition-all ${
            current === 'დასტურდება'
              ? 'bg-green-500 text-white border-green-600 shadow-sm' 
              : 'bg-white text-gray-300 border-gray-200 hover:border-green-300 hover:text-green-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
        >
          <Check size={14} strokeWidth={3} />
        </button>

        <button 
          onClick={() => onChange('ბრუნდება')}
          disabled={disabled}
          title="დაბრუნება"
          className={`p-1 rounded border transition-all ${
            current === 'ბრუნდება' 
              ? 'bg-yellow-500 text-white border-yellow-600 shadow-sm' 
              : 'bg-white text-gray-300 border-gray-200 hover:border-yellow-300 hover:text-yellow-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
        >
          <CornerUpLeft size={14} strokeWidth={3} />
        </button>

        <button 
          onClick={() => onChange('უარყოფილია')}
          disabled={disabled}
          title="უარყოფა"
          className={`p-1 rounded border transition-all ${
            current === 'უარყოფილია' 
              ? 'bg-red-500 text-white border-red-600 shadow-sm' 
              : 'bg-white text-gray-300 border-gray-200 hover:border-red-300 hover:text-red-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const config = {
    [Priority.LOW]: { label: 'დაბალი', color: 'bg-blue-100 text-blue-800' },
    [Priority.MEDIUM]: { label: 'საშუალო', color: 'bg-yellow-100 text-yellow-800' },
    [Priority.HIGH]: { label: 'მაღალი', color: 'bg-red-100 text-red-800' },
    [Priority.CRITICAL]: { label: 'კრიტიკული', color: 'bg-purple-100 text-purple-800' },
  };
  const { label, color } = config[priority] || { label: 'N/A', color: 'bg-gray-100 text-gray-800' };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color}`}>{label}</span>;
};


export const DirectorApprovals: React.FC<DirectorApprovalsProps> = ({ user, currentStep }) => {
  const [allRequests, setAllRequests] = useState<ExpenseRequest[]>([]);
  const [funds, setFunds] = useState<ExpenseFund[]>([]);
  const [fundBalances, setFundBalances] = useState<FundBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [selectedBoardDateStr, setSelectedBoardDateStr] = useState<string>('');
  const [notes, setNotes] = useState<Record<string, { director?: string, fin?: string, discussion?: string }>>({});

  const isFinDirector = user.role === UserRole.FIN_DIRECTOR;
  const isDirectorLevel = user.role === UserRole.CEO || user.role === UserRole.FOUNDER;
  
  const fetchBoardRequests = async () => {
    setLoading(true);
    
    const [fundData, balanceData, data] = await Promise.all([
       getExpenseFunds(),
       getRealTimeFundBalances(),
       getDirectorBoardRequests() // Always fetch the consolidated list
    ]);

    setFunds(fundData);
    setFundBalances(balanceData);
    setAllRequests(data);
    
    const initialNotes: any = {};
    data.forEach(r => {
      initialNotes[r.id] = {
        director: r.directorNote || '',
        fin: r.finDirectorNote || '',
        discussion: r.discussionResult || ''
      };
    });
    setNotes(initialNotes);
    setLoading(false);
  };

  useEffect(() => {
    fetchBoardRequests();
  }, []); 

  const groupedRequests = useMemo(() => {
    const groups: Record<string, ExpenseRequest[]> = {};
    allRequests.forEach(req => {
      const key = req.boardDate; 
      if (!groups[key]) groups[key] = [];
      groups[key].push(req);
    });
    return groups;
  }, [allRequests]);

  const availableDates = useMemo(() => {
    return Object.keys(groupedRequests).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedRequests]);

  useEffect(() => {
    if (availableDates.length > 0 && !selectedBoardDateStr) {
      const now = new Date();
      now.setHours(0,0,0,0);
      const upcoming = availableDates.find(d => new Date(d) >= now);
      setSelectedBoardDateStr(upcoming || availableDates[0]);
    }
  }, [availableDates, selectedBoardDateStr]);

  const currentViewRequests = useMemo(() => {
    if (!selectedBoardDateStr) return [];
    return groupedRequests[selectedBoardDateStr] || [];
  }, [groupedRequests, selectedBoardDateStr]);

  const pendingTotal = useMemo(() => currentViewRequests.reduce((sum, req) => sum + req.totalAmount, 0), [currentViewRequests]);


  const handleMoveToFinalApproval = async (requestId: string) => {
    setProcessingId(requestId);
    try {
        await handleSaveNotes(requestId);
        await updateRequestStatus(requestId, RequestStatus.FD_APPROVED, user.id);
        setAllRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) {
        console.error(e);
        alert('ოპერაცია ვერ შესრულდა');
    } finally {
        setProcessingId(null);
    }
  };
  
  const handleNoteChange = (requestId: string, field: 'director' | 'fin' | 'discussion', value: string) => {
    setNotes(prev => ({ ...prev, [requestId]: { ...prev[requestId], [field]: value } }));
  };
  
  const handleReturnWithComment = async (requestId: string) => {
    const currentComment = notes[requestId]?.discussion || "";

    setProcessingId(requestId);
    try {
        // Step 1: Save comment ONLY if it exists
        if (currentComment.trim().length > 0) {
            await updateRequestDetails(requestId, {
                discussionResult: currentComment,
                lastComment: currentComment // This is for the manager's dashboard
            });
        }

        // Step 2: Update the global status to RETURNED_TO_MANAGER
        await updateRequestStatus(requestId, RequestStatus.RETURNED_TO_MANAGER, user.id);

        // Step 3: Remove from the current view
        setAllRequests(prev => prev.filter(r => r.id !== requestId));
        
    } catch (e) {
        console.error("Error during return process:", e);
        alert('ოპერაცია ვერ შესრულდა');
    } finally {
        setProcessingId(null);
    }
};

  const handleReturnToManager = async (requestId: string) => {
    await handleReturnWithComment(requestId);
  };

  const handleSignatureChange = async (requestId: string, field: 'director' | 'fin', value: string) => {
    if (value === 'ბრუნდება') {
      await handleReturnWithComment(requestId);
      return;
    }
    
    handleNoteChange(requestId, field, value);
    
    const updates: any = {};
    if (field === 'director') updates.directorNote = value;
    if (field === 'fin') updates.finDirectorNote = value;

    await updateRequestDetails(requestId, updates);

    if (value === 'უარყოფილია') {
      const currentComment = notes[requestId]?.discussion || "";
      setProcessingId(requestId);
      try {
        const updatePayload: Partial<ExpenseRequest> = {
            discussionResult: currentComment,
            lastComment: `საბჭოს მიერ უარყოფილია: ${currentComment || 'მიზეზი არ არის მითითებული'}` 
        };
        
        await updateRequestDetails(requestId, updatePayload);
        await updateRequestStatus(requestId, RequestStatus.RETURNED_TO_MANAGER, user.id);
        setAllRequests(prev => prev.filter(r => r.id !== requestId));
      } catch (e) {
        console.error(e);
        alert('მოთხოვნის უარყოფა ვერ მოხერხდა.');
      } finally {
        setProcessingId(null);
      }
    }
  };
  
  const handleFundAssignment = async (requestId: string, fundId: string) => {
      await updateRequestDetails(requestId, { assignedFundId: fundId });
      setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, assignedFundId: fundId } : r));
      const newBalances = await getRealTimeFundBalances();
      setFundBalances(newBalances);
  };

  const handleSaveNotes = async (requestId: string) => {
    const currentNotes = notes[requestId];
    if (currentNotes) {
      await updateRequestDetails(requestId, {
        directorNote: currentNotes.director,
        finDirectorNote: currentNotes.fin,
        discussionResult: currentNotes.discussion
      });
    }
  };

  const handleExport = () => {
    const headers = {
      requesterName: 'მომთხოვნი',
      department: 'დეპარტამენტი',
      itemName: 'ხარჯის დასახელება',
      totalAmount: 'ჯამური თანხა',
      currency: 'ვალუტა',
      assignedFundId: 'დაფინანსების წყარო',
      discussionResult: 'განხილვის შედეგი',
      finDirectorNote: 'ფინ. დირექტორის გადაწყვეტილება',
      directorNote: 'დირექტორის გადაწყვეტილება',
    };

    const dataToExport = currentViewRequests.map(req => ({
      ...req,
      assignedFundId: funds.find(f => f.id === req.assignedFundId)?.name || 'განუსაზღვრელი',
      discussionResult: notes[req.id]?.discussion || req.discussionResult,
      finDirectorNote: notes[req.id]?.fin || req.finDirectorNote,
      directorNote: notes[req.id]?.director || req.directorNote,
    }));
    
    const sessionDateStr = selectedBoardDateStr ? new Date(selectedBoardDateStr).toLocaleDateString('ka-GE') : 'Active';
    const fileName = `საბჭოს_განხილვა_${sessionDateStr.replace(/\s/g, '_')}`;

    exportGenericToExcel(dataToExport, headers, 'Council Review', fileName);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">იტვირთება საბჭოს მონაცემები...</div>;
  }

  return (
    <div className="space-y-8 font-sans relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-200 pb-4">
         <div className="flex items-center gap-2">
            <History size={20} className="text-gray-500"/>
            <span className="font-bold text-gray-700">აირჩიეთ ფინანსური კვირა:</span>
            <select 
              value={selectedBoardDateStr} 
              onChange={(e) => setSelectedBoardDateStr(e.target.value)}
              className="ml-2 px-4 py-2 border border-gray-300 rounded bg-white text-black font-medium focus:ring-2 focus:ring-black outline-none cursor-pointer"
            >
              {availableDates.map(dateStr => (
                <option key={dateStr} value={dateStr}>
                   კვირა: {formatDate(new Date(dateStr))}
                </option>
              ))}
            </select>
         </div>
         <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded"
          >
            <Download size={16} />
            ჩამოტვირთვა (Excel)
          </button>
      </div>

      <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded-lg mb-6 flex justify-between items-center">
        <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase">ჯამური განსახილველი თანხა</h3>
            <p className="text-3xl font-black text-black font-mono">{formatNumber(pendingTotal)} GEL</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded">
          <Database size={14} />
          <span>Database Status: Active</span>
        </div>
      </div>

      {currentViewRequests.length === 0 ? (
        <div className="bg-gray-50 rounded border border-gray-200 p-12 text-center">
           <h3 className="text-lg font-bold text-black">ამ კვირაში განსახილველი მოთხოვნები არ არის</h3>
           <p className="text-sm text-gray-500 mt-2">
             თუ ფიქრობთ, რომ ეს შეცდომაა, შეგიძლიათ სცადოთ სისტემის იძულებითი სინქრონიზაცია "Settings" &gt; "Test Center" პანელიდან (P426).
           </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="w-full text-xs text-left bg-white whitespace-nowrap">
            <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300 uppercase tracking-tight">
              <tr>
                <th className="px-3 py-3 border-r border-gray-200">მომთხოვნი</th>
                <th className="px-3 py-3 border-r border-gray-200 min-w-[350px]">ხარჯის დასახელება & დასაბუთება</th>
                <th className="px-3 py-3 border-r border-gray-200 text-right">ჯამური თანხა</th>
                <th className="px-3 py-3 border-r border-gray-200 w-56 text-center bg-blue-50/50">
                    <span className="flex items-center gap-1 justify-center">
                        <Wallet size={12} /> დაფინანსების წყარო (ნაშთი)
                    </span>
                </th>
                <th className="px-3 py-3 border-r border-gray-200 min-w-[200px]">განხილვის შედეგი</th>
                <th className="px-3 py-3 border-r border-gray-200 bg-blue-50 text-center">ფინანსური დირექტორი</th>
                <th className="px-3 py-3 border-r border-gray-200 bg-blue-50 text-center">დირექტორი (CEO)</th>
                <th className="px-3 py-3 text-center sticky right-0 bg-gray-100 border-l border-gray-300 z-10">მოქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentViewRequests.map((req, idx) => {
                const isFdApproved = notes[req.id]?.fin === 'დასტურდება';
                const hasAssignedFund = !!req.assignedFundId;
                const hasStrategicInfo = !!req.priority && !!req.revenuePotential && !!req.selectedOptionReason;
                const canMove = isFdApproved && hasAssignedFund && hasStrategicInfo;
                
                const assignedBalance = fundBalances.find(f => f.id === req.assignedFundId);
                const isInsufficient = assignedBalance ? (assignedBalance.remaining < req.totalAmount) : false;

                return (
                  <tr key={req.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}>
                    <td className="px-3 py-2 border-r border-gray-200 align-top">
                        <div className="font-bold">{req.requesterName}</div>
                        <div className="text-[10px] text-gray-500">{req.department}</div>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 whitespace-normal align-top">
                        <div className="font-bold text-black text-xs">{req.itemName || req.category}</div>
                        <p className="text-[11px] text-gray-600 mt-1 italic">"{req.description}"</p>
                        
                        <div className="mt-3 space-y-1.5 text-[10px] text-gray-500 font-medium border-t border-gray-100 pt-2">
                            <div className="grid grid-cols-3">
                                <strong className="text-gray-700 uppercase col-span-1">პრიორიტეტი:</strong>
                                <div className="col-span-2"><PriorityBadge priority={req.priority} /></div>
                            </div>
                            <div className="grid grid-cols-3">
                                <strong className="text-gray-700 uppercase col-span-1">პოტენციალი:</strong>
                                <span className="col-span-2">{req.revenuePotential}</span>
                            </div>
                            <div className="grid grid-cols-3">
                                <strong className="text-gray-700 uppercase col-span-1">მოკვლევა:</strong>
                                <span className="col-span-2">{req.selectedOptionReason}</span>
                            </div>
                        </div>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 font-bold align-top font-mono text-right text-red-600">-{formatNumber(req.totalAmount)} {req.currency}</td>
                    
                    <td className="px-3 py-2 border-r border-gray-200 bg-blue-50/20 text-center align-top">
                        {isFinDirector ? (
                            <div className="relative">
                                <select 
                                    value={req.assignedFundId || ''}
                                    onChange={(e) => handleFundAssignment(req.id, e.target.value)}
                                    className={`w-full text-[10px] p-1 border rounded outline-none focus:ring-1 focus:ring-black font-bold appearance-none
                                        ${!req.assignedFundId ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-300 bg-white'}
                                        ${isInsufficient ? 'text-red-600 border-red-500 bg-red-50' : ''}
                                    `}
                                >
                                    <option value="">- აირჩიეთ ფონდი -</option>
                                    {fundBalances.map(f => {
                                        const lowBalance = f.remaining < req.totalAmount;
                                        return (
                                            <option key={f.id} value={f.id} className={lowBalance ? "text-red-500 font-bold" : ""}>
                                                {f.name} - ({formatNumber(f.remaining)} ₾) {lowBalance ? '⚠️' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {isInsufficient && req.assignedFundId && (
                                    <div className="absolute top-1/2 right-6 transform -translate-y-1/2 text-red-500 pointer-events-none">
                                        <AlertTriangle size={12} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                req.assignedFundId ? 'bg-gray-100 border border-gray-200' : 'text-gray-400 italic'
                            }`}>
                                {funds.find(f => f.id === req.assignedFundId)?.name || 'განუსაზღვრელი'}
                            </span>
                        )}
                    </td>

                    <td className="px-2 py-1 border-r border-gray-200 bg-gray-50 border-l border-gray-300 align-top">
                       <textarea 
                         value={notes[req.id]?.discussion || ''}
                         onChange={(e) => handleNoteChange(req.id, 'discussion', e.target.value)}
                         onBlur={() => handleSaveNotes(req.id)}
                         placeholder="დაბრუნების შემთხვევაში, შეავსეთ მიზეზი აქ..."
                         className="w-full bg-white border border-gray-200 rounded p-1 text-[10px] h-14 resize-none focus:border-black focus:ring-0"
                       />
                    </td>

                    <td className="px-2 py-1 border-r border-gray-200 bg-blue-50/30 align-top">
                       <StatusControl 
                         current={notes[req.id]?.fin}
                         onChange={(val) => handleSignatureChange(req.id, 'fin', val)}
                         disabled={!isFinDirector}
                       />
                    </td>

                    <td className="px-2 py-1 border-r border-gray-200 bg-blue-50/30 align-top">
                       <StatusControl 
                         current={notes[req.id]?.director}
                         onChange={(val) => handleSignatureChange(req.id, 'director', val)}
                         disabled={!isDirectorLevel}
                       />
                    </td>

                    <td className="px-3 py-2 text-center sticky right-0 bg-white border-l border-gray-300 z-10 align-top">
                      {processingId === req.id ? (
                        <span className="text-xs text-gray-400 animate-pulse">მუშავდება...</span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                           <button
                             onClick={() => handleReturnToManager(req.id)}
                             className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white text-xs font-bold uppercase rounded hover:bg-yellow-600 transition-colors shadow-md"
                             title="დაბრუნება მენეჯერთან"
                           >
                             <CornerUpLeft size={14} />
                           </button>
                           <button
                             onClick={() => handleMoveToFinalApproval(req.id)}
                             disabled={!canMove}
                             className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-bold uppercase rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-70 transition-colors shadow-md"
                             title={
                                !hasStrategicInfo ? "გადასატანად საჭიროა სტრატეგიული ველების შევსება (პრიორიტეტი, პოტენციალი, მოკვლევა)" :
                                !isFdApproved ? "გადასატანად საჭიროა ფინანსური დირექტორის ხელმოწერა" :
                                !hasAssignedFund ? "გადასატანად საჭიროა ფონდის მითითება" :
                                "გადატანა დასტურზე"
                             }
                           >
                             <ArrowRight size={14} />
                           </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};