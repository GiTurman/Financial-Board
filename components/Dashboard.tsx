
import React, { useEffect, useState, useMemo } from 'react';
// FIX: Import UserRole to use in component logic.
import { User, ExpenseRequest, RequestStatus, UserRole } from '../types';
import { getRequestsForUser, getArchivedRequestsForUser, updateRequestStatus, resubmitRequest } from '../services/mockService';
import { exportToExcel } from '../utils/excelExport';
import { formatNumber } from '../utils/formatters';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  FileSpreadsheet, 
  CornerUpLeft, 
  Check, 
  X,
  Inbox,
  Wallet,
  Hourglass,
  Archive,
  AlertOctagon,
  Edit,
  Send,
  GitPullRequestArrow,
  Calendar,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface DashboardProps {
  user: User;
}

const StatusBadge = ({ status }: { status: RequestStatus }) => {
  const styles = {
    [RequestStatus.DRAFT]: 'bg-gray-100 text-gray-600 border-gray-200',
    [RequestStatus.WAITING_DEPT_APPROVAL]: 'bg-white text-yellow-700 border-yellow-200',
    [RequestStatus.COUNCIL_REVIEW]: 'bg-white text-orange-700 border-orange-200',
    [RequestStatus.FD_APPROVED]: 'bg-purple-50 text-purple-700 border-purple-200',
    [RequestStatus.FD_FINAL_CONFIRM]: 'bg-purple-50 text-purple-700 border-purple-200',
    [RequestStatus.READY_FOR_PAYMENT]: 'bg-blue-50 text-blue-700 border-blue-200',
    [RequestStatus.DISPATCHED_TO_ACCOUNTING]: 'bg-blue-100 text-blue-800 border-blue-200',
    [RequestStatus.APPROVED_FOR_PAYMENT]: 'bg-blue-50 text-blue-700 border-blue-200',
    [RequestStatus.PAID]: 'bg-green-600 text-white border-green-600',
    [RequestStatus.REJECTED]: 'bg-red-800 text-white border-red-900',
    [RequestStatus.RETURNED_TO_SENDER]: 'bg-red-100 text-red-700 border-red-200 shadow-sm animate-pulse',
    [RequestStatus.RETURNED_TO_MANAGER]: 'bg-yellow-100 text-yellow-800 border-yellow-200 shadow-sm animate-pulse',
  };

  const labels: Record<string, string> = {
    [RequestStatus.DRAFT]: 'დრაფტი',
    [RequestStatus.WAITING_DEPT_APPROVAL]: 'ეტაპი 2: დეპ. ხელმძღვანელი',
    [RequestStatus.COUNCIL_REVIEW]: 'ეტაპი 3: საბჭოს განხილვა',
    [RequestStatus.FD_APPROVED]: 'ეტაპი 11: საბოლოო დასტური',
    [RequestStatus.FD_FINAL_CONFIRM]: 'ეტაპი 11: საბოლოო დასტური',
    [RequestStatus.READY_FOR_PAYMENT]: 'ეტაპი 12: ბუღალტერია',
    [RequestStatus.DISPATCHED_TO_ACCOUNTING]: 'ბუღალტერიაშია',
    [RequestStatus.APPROVED_FOR_PAYMENT]: 'ბუღალტერია',
    [RequestStatus.PAID]: 'დასრულებული (გადახდილი)',
    [RequestStatus.REJECTED]: 'უარყოფილი',
    [RequestStatus.RETURNED_TO_SENDER]: 'დაბრუნებული (შესასწორებელი)',
    [RequestStatus.RETURNED_TO_MANAGER]: 'დაბრუნებული (მენეჯერთან)',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${styles[status]}`}>
      {labels[status] || status}
    </span>
  );
};

// Helper function for grouping by week
const getWeekInfo = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (weekStart.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const label = `კვირა ${weekNumber}: ${weekStart.toLocaleDateString('ka-GE', options)} - ${weekEnd.toLocaleDateString('ka-GE', options)}, ${weekStart.getFullYear()}`;
    
    return {
        key: weekStart.toISOString(),
        label,
    };
};

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [activeRequests, setActiveRequests] = useState<ExpenseRequest[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const fetchRequests = async () => {
    setLoading(true);
    const [active, archive] = await Promise.all([
      getRequestsForUser(user.id),
      getArchivedRequestsForUser(user)
    ]);
    setActiveRequests(active);
    setArchivedRequests(archive);
    
    // Auto-expand the first week if there are archived items
    if (archive.length > 0) {
        const firstWeekKey = getWeekInfo(archive[0].updatedAt || archive[0].createdAt).key;
        setExpandedWeeks({ [firstWeekKey]: true });
    }

    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user.id]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'return') => {
    setProcessingId(id);
    try {
        const request = activeRequests.find(r => r.id === id);
        if (!request) return;

        let newStatus: RequestStatus;

        if (request.status === RequestStatus.RETURNED_TO_MANAGER) {
            // Actions for a request returned from the council
            if (action === 'approve') {
                newStatus = RequestStatus.COUNCIL_REVIEW; // Send it back up to the council
            } else if (action === 'return') {
                newStatus = RequestStatus.RETURNED_TO_SENDER; // Send it further down to the initiator
            } else { // reject
                newStatus = RequestStatus.REJECTED;
            }
        } else {
            // Original logic for new requests from employees
            if (action === 'approve') {
                newStatus = RequestStatus.COUNCIL_REVIEW;
            } else if (action === 'return') {
                newStatus = RequestStatus.RETURNED_TO_SENDER;
            } else { // reject
                newStatus = RequestStatus.REJECTED;
            }
        }

        await updateRequestStatus(id, newStatus, user.id);
        await fetchRequests();
    } catch (e) { 
        console.error("Action failed:", e);
        alert('ოპერაცია ვერ შესრულდა'); 
    } finally { 
        setProcessingId(null); 
    }
  };

  const handleResubmit = async (id: string) => {
    setProcessingId(id);
    try {
      await resubmitRequest(id, { description: 'Resubmitted after correction' });
      await fetchRequests();
    } catch (e) { alert('Resubmit failed'); }
    finally { setProcessingId(null); }
  };

  const groupedArchivedRequests = useMemo(() => {
    const groups: Record<string, { label: string, requests: ExpenseRequest[] }> = {};
    archivedRequests.forEach(req => {
        const { key, label } = getWeekInfo(req.updatedAt || req.createdAt);
        if (!groups[key]) {
            groups[key] = { label, requests: [] };
        }
        groups[key].requests.push(req);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [archivedRequests]);

  const toggleWeek = (key: string) => {
    setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const pendingForCorrection = activeRequests.filter(r => r.userId === user.id && r.status === RequestStatus.RETURNED_TO_SENDER);
  const inbox = activeRequests.filter(r => 
      r.managerId === user.id && 
      r.userId !== user.id && 
      (r.status === RequestStatus.WAITING_DEPT_APPROVAL || r.status === RequestStatus.RETURNED_TO_MANAGER)
  );
  const myActive = activeRequests.filter(r => r.userId === user.id && r.status !== RequestStatus.RETURNED_TO_SENDER);

  if (loading) return <div className="p-8 text-center text-gray-400">იტვირთება...</div>;

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter">პანელი</h2>
        <button onClick={() => exportToExcel(activeRequests, 'Report')} className="text-xs font-bold border-b border-black">REPORT EXPORT</button>
      </div>

      {/* Correction Section */}
      {pendingForCorrection.length > 0 && (
        <section className="bg-red-50 border-2 border-red-200 p-6 rounded-lg animate-in slide-in-from-top-4">
          <h3 className="text-red-800 font-black uppercase text-sm mb-4 flex items-center gap-2">
            <AlertOctagon size={16} /> შესასწორებელი მოთხოვნები
          </h3>
          <div className="space-y-3">
            {pendingForCorrection.map(req => (
              <div key={req.id} className="bg-white p-4 border border-red-100 flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-bold text-black">{req.itemName || req.category}</div>
                  <div className="text-xs text-red-600 font-medium italic">{req.lastComment}</div>
                </div>
                <button 
                  onClick={() => handleResubmit(req.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase hover:bg-red-700 transition-all shadow-md"
                >
                  <Send size={14} /> ხელახლა გაგზავნა
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manager Inbox (Level 2 Approval) */}
      {inbox.length > 0 && (
        <section>
          <h3 className="font-black uppercase text-sm mb-4 border-b border-black pb-1">დასადასტურებელი (INBOX) - Level 2</h3>
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">მომთხოვნი</th>
                  <th className="px-4 py-3">ხარჯი</th>
                  <th className="px-4 py-3 text-right">თანხა</th>
                  <th className="px-4 py-3 text-center">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inbox.map(req => (
                  <tr key={req.id} className={req.status === RequestStatus.RETURNED_TO_MANAGER ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 font-bold">
                        {req.requesterName}
                        {req.status === RequestStatus.RETURNED_TO_MANAGER && (
                            <>
                                <div className="text-[9px] font-bold text-yellow-700 uppercase flex items-center gap-1 mt-1">
                                    <GitPullRequestArrow size={10} /> საბჭოდან დაბრუნებული
                                </div>
                                {req.lastComment && (
                                    <div className="text-[10px] text-red-600 font-normal italic mt-1 max-w-[150px] whitespace-normal">
                                        "{req.lastComment}"
                                    </div>
                                )}
                            </>
                        )}
                    </td>
                    <td className="px-4 py-3">{req.itemName || req.category}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono">{formatNumber(req.totalAmount)} {req.currency}</td>
                    <td className="px-4 py-3 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => handleAction(req.id, 'approve')} 
                        className="p-1.5 bg-black text-white rounded hover:bg-green-600 transition-colors"
                        title="დადასტურება"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, 'return')} 
                        className="p-1.5 bg-gray-100 rounded border hover:bg-yellow-100 text-yellow-700 transition-colors"
                        title={req.status === RequestStatus.RETURNED_TO_MANAGER ? 'დაბრუნება ინიციატორთან' : 'დაბრუნება'}
                      >
                        <CornerUpLeft size={14} />
                      </button>
                      <button 
                        onClick={() => handleAction(req.id, 'reject')} 
                        className="p-1.5 bg-red-50 rounded border border-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                        title="უარყოფა"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100">
        <button onClick={() => setActiveTab('active')} className={`pb-2 text-xs font-bold uppercase ${activeTab === 'active' ? 'border-b-2 border-black' : 'text-gray-400'}`}>აქტიური</button>
        <button onClick={() => setActiveTab('archive')} className={`pb-2 text-xs font-bold uppercase ${activeTab === 'archive' ? 'border-b-2 border-black' : 'text-gray-400'}`}>არქივი</button>
      </div>

      {activeTab === 'active' ? (
        <div className="space-y-2">
          {myActive.length === 0 && <div className="text-center py-12 text-gray-300 font-bold uppercase">აქტიური მოთხოვნები არ არის</div>}
          {myActive.map(req => (
            <div key={req.id} className="p-4 border border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-colors">
               <div>
                 <div className="font-bold text-black">{req.itemName || req.category}</div>
                 <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(req.createdAt).toLocaleDateString()}</div>
               </div>
               <div className="flex items-center gap-4">
                  <StatusBadge status={req.status} />
                  <div className="font-bold text-sm min-w-[120px] text-right font-mono">{formatNumber(req.totalAmount)} {req.currency}</div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedArchivedRequests.length === 0 ? (
             <div className="text-center py-12 text-gray-300 font-bold uppercase">არქივი ცარიელია</div>
          ) : (
            groupedArchivedRequests.map(([key, { label, requests: weekRequests }]) => {
              const isExpanded = !!expandedWeeks[key];
              return (
                <div key={key} className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm">
                  <button 
                    onClick={() => toggleWeek(key)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 font-bold text-black">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      {label}
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{weekRequests.length} ჩანაწერი</span>
                  </button>
                  {isExpanded && (
                    <div className="p-2">
                      <div className="divide-y divide-gray-100">
                        {weekRequests.map(req => {
                          const isManagerAction = user.role !== UserRole.EMPLOYEE && req.managerId === user.id && req.userId !== user.id;
                          return (
                            <div key={req.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                              <div>
                                <div className="font-bold text-black">{req.itemName || req.category}</div>
                                {isManagerAction && (
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">
                                    მენეჯერის ქმედება ({req.requesterName})
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <StatusBadge status={req.status} />
                                <div className="font-bold text-sm min-w-[120px] text-right font-mono">{formatNumber(req.totalAmount)} {req.currency}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
