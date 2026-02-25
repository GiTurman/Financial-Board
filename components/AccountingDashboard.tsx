
import React, { useEffect, useState } from 'react';
import { User, ExpenseRequest, RequestStatus, DirectiveSnapshot, UserRole } from '../types';
import { getAccountingRequests, updateRequestStatus, getDispatchedDirectives, updateDirectiveStatus, USERS, getInvoicesForAccountant } from '../services/mockService';
import * as XLSX from 'xlsx';
import { 
  Calculator,
  CheckCircle2,
  Wallet,
  Download,
  Clock,
  Banknote,
  FileText,
  Check,
  Printer,
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import { loadDispatchedDirectives, saveDispatchedDirectives, markDirectiveProcessed } from '../storage/directiveStorage';
import { AccountantInvoicesView } from './InventoryInvoices'; // NEW IMPORT

// --- START: NEW COMPONENT FOR DIRECTIVES ---
export const AccountantDirectivesView: React.FC<{ user: User }> = ({ user }) => {
  const [directives, setDirectives] = useState<DirectiveSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch from Service (Standard Flow)
    const serviceData = await getDispatchedDirectives();
    
    // 2. Fetch from LocalStorage (Management Archive Bridge)
    const lsDataString = localStorage.getItem('mgmt_archive_history');
    let lsDirectives: DirectiveSnapshot[] = [];
    
    if (lsDataString) {
        try {
            const history = JSON.parse(lsDataString);
            lsDirectives = history
                .filter((item: any) => item.status === 'SENT')
                .map((item: any) => {
                    const isProcessed = localStorage.getItem(`accounting_task_complete_${item.id}`) === 'true';
                    return {
                        id: `dir_ls_${item.id}`,
                        weekNumber: 0,
                        periodStart: item.date,
                        periodEnd: item.date,
                        dispatchedByUserId: 'u_fin',
                        dispatchedByName: 'Fin Director',
                        dispatchedAt: new Date(item.id).toISOString(),
                        directivesData: item.data.map((d: any) => ({
                            fundName: d.name,
                            category: d.category,
                            approvedAmount: d.approved
                        })),
                        status: isProcessed ? 'processed' : 'pending',
                        processedAt: isProcessed ? new Date().toISOString() : undefined
                    };
                });
        } catch (e) { console.error("Error parsing management archive history", e); }
    }

    // 3. Fetch from new dedicated storage (DirectiveSnapshot)
    const storedDirectives = loadDispatchedDirectives();

    // Deduplicate: Prefer Stored Directives (Source of Truth) over Service Mock
    // Service Mock adds 'dir_' prefix to IDs generated from Date.now()
    const storedIds = new Set(storedDirectives.map(d => d.id));
    
    const uniqueServiceData = serviceData.filter(d => {
        // Check if this service item corresponds to a stored item (by removing 'dir_' prefix)
        const rawId = d.id.startsWith('dir_') ? d.id.substring(4) : d.id;
        return !storedIds.has(rawId) && !storedIds.has(d.id);
    });

    // Combine all sources
    const combined = [...lsDirectives, ...uniqueServiceData, ...storedDirectives].reduce((acc, curr) => {
        if (!acc.find(d => d.id === curr.id)) {
            acc.push(curr);
        }
        return acc;
    }, [] as DirectiveSnapshot[]);

    // Sort by dispatchedAt desc
    combined.sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime());

    setDirectives(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handleStorage = () => fetchData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleMarkAsProcessed = async (directive: DirectiveSnapshot) => {
    if (window.confirm("ნამდვილად გსურთ დირექტივის შესრულებულად მონიშვნა?")) {
        setProcessingId(directive.id);
        
        try {
            // Handle different storage sources
            if (directive.id.startsWith('dir_ls_')) {
                const originalId = directive.id.replace('dir_ls_', '');
                localStorage.setItem(`accounting_task_complete_${originalId}`, 'true');
            } else {
                // 1. Try to update in Mock Service (if it exists there)
                await updateDirectiveStatus(directive.id, 'processed', user.id).catch(() => {});
                
                // 2. Also try updating Mock Service with 'dir_' prefix if current ID is raw timestamp
                if (!directive.id.startsWith('dir_')) {
                     await updateDirectiveStatus(`dir_${directive.id}`, 'processed', user.id).catch(() => {});
                }

                // 3. Update in Persistent Storage (Upsert logic)
                const allStored = loadDispatchedDirectives();
                const existingIndex = allStored.findIndex(d => d.id === directive.id);
                
                if (existingIndex !== -1) {
                    // Update existing
                    markDirectiveProcessed(directive.id, user.id);
                } else {
                    // Create new entry in storage to persist the "Processed" status
                    // This handles cases where data originated from Mock Service but wasn't in LS yet
                    const newEntry: DirectiveSnapshot = {
                        ...directive,
                        status: 'processed',
                        processedAt: new Date().toISOString(),
                        processedByUserId: user.id
                    };
                    saveDispatchedDirectives([...allStored, newEntry]);
                }
            }
            
            window.dispatchEvent(new Event('storage')); // Notify other tabs/components
            await fetchData();
        } catch (e) {
            console.error("Error updating directive status:", e);
            alert("სტატუსის განახლება ვერ მოხერხდა.");
        } finally {
            setProcessingId(null);
        }
    }
  };

  const handlePrint = () => {
    window.print();
  };
  
  if (loading) return <div className="p-12 text-center text-gray-500">იტვირთება დირექტივები...</div>;

  return (
    <div className="space-y-8">
      {/* Print Styles to fix scrollable area cutting off content */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #directive-print-container, #directive-print-container * {
            visibility: visible;
          }
          #directive-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible !important;
          }
          /* Hide scrollbars and ensure containers expand */
          html, body, #root, main {
            overflow: visible !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex justify-between items-center border-b border-black pb-4 no-print">
        <h2 className="text-3xl font-extrabold uppercase tracking-tight flex items-center gap-3">
            <FileText size={28}/> მენეჯეტის დირექტივები
        </h2>
        <p className="text-gray-500 font-bold">მხოლოდ წასაკითხი რეჟიმი</p>
      </div>

      <div id="directive-print-container">
        {directives.length === 0 ? (
            <div className="text-center p-12 border-2 border-dashed rounded-lg no-print">
            არ არის შემოსული დირექტივები.
            </div>
        ) : (
            <div className="space-y-6">
            {directives.map(directive => (
                <div key={directive.id} className="border rounded-lg overflow-hidden shadow-sm bg-white print:break-inside-avoid print:border-black print:mb-8">
                <div className={`flex justify-between items-center p-4 border-b ${directive.status === 'processed' ? 'bg-gray-100' : 'bg-blue-50'} print:bg-white print:border-black`}>
                    <div>
                    <h3 className="font-bold text-lg">
                        {directive.weekNumber > 0 ? `კვირა #${directive.weekNumber}` : 'დირექტივა'} ({directive.periodStart} - {directive.periodEnd})
                    </h3>
                    <div className="text-xs text-gray-500 print:text-black">
                        გამოგზავნილია: {directive.dispatchedByName} - {new Date(directive.dispatchedAt).toLocaleString('ka-GE')}
                    </div>
                    {directive.status === 'processed' && (
                        <div className="text-xs text-green-700 font-bold mt-1 print:text-black">
                            შესრულებულია: {directive.processedAt ? new Date(directive.processedAt).toLocaleString('ka-GE') : 'Completed'}
                        </div>
                    )}
                    </div>
                    <div className="flex items-center gap-2 no-print">
                        <button onClick={handlePrint} className="p-2 text-gray-600 hover:bg-gray-200 rounded" title="ბეჭდვა"><Printer size={16}/></button>
                    {directive.status === 'pending' ? (
                        <button 
                            onClick={() => handleMarkAsProcessed(directive)} 
                            disabled={processingId === directive.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase rounded shadow-sm hover:bg-green-700 disabled:bg-gray-400"
                        >
                            <Check size={16}/> {processingId === directive.id ? 'მუშავდება...' : 'შესრულებულია'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-xs font-bold uppercase rounded border border-green-200">
                            <CheckCircle2 size={16}/> შესრულებული
                        </div>
                    )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 print:bg-white print:border-b-2 print:border-black">
                        <tr className="border-b">
                        <th className="px-4 py-2 font-bold text-left">Fund Name</th>
                        <th className="px-4 py-2 font-bold text-left">Category</th>
                        <th className="px-4 py-2 font-bold text-right">Approved Amount (₾)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 print:divide-black">
                        {directive.directivesData.map((item, index) => (
                        <tr key={index}>
                            <td className="px-4 py-2 font-medium">{item.fundName}</td>
                            <td className="px-4 py-2">{item.category}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{formatNumber(item.approvedAmount)}</td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};


interface AccountingDashboardProps {
  user: User;
}

export const AccountingDashboard: React.FC<AccountingDashboardProps> = ({ user }) => {
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'archive' | 'invoices'>('pending');
  const [invoicesCount, setInvoicesCount] = useState(0);

  const fetchRequests = async () => {
    // Uses DISPATCHED_TO_ACCOUNTING filter + PAID and fetches pending invoices count
    const [data, invoices] = await Promise.all([
      getAccountingRequests(),
      getInvoicesForAccountant()
    ]);
    setRequests(data);
    setInvoicesCount(invoices.length);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handlePay = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      // Updates status to PAID
      await updateRequestStatus(requestId, RequestStatus.PAID, user.id);
      await fetchRequests(); 
    } catch (e) {
      console.error(e);
      alert('გადახდის დაფიქსირება ვერ მოხერხდა');
    } finally {
      setProcessingId(null);
    }
  };

  // Pending for Accountant = Dispatched by FD
  const pendingRequests = requests.filter(r => 
    r.status === RequestStatus.DISPATCHED_TO_ACCOUNTING ||
    r.status === RequestStatus.APPROVED_FOR_PAYMENT // Legacy fallback
  );

  const archivedRequests = requests.filter(r => 
    r.status === RequestStatus.PAID
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleExportPayments = () => {
    if (pendingRequests.length === 0) return;
    const dataToExport = pendingRequests.map(req => ({
      'თარიღი': new Date(req.createdAt).toLocaleDateString('ka-GE'),
      'მომთხოვნი': req.requesterName,
      'ხარჯის დასახელება': req.itemName || req.category,
      'თანხა': req.totalAmount,
      'ვალუტა': req.currency
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registry");
    XLSX.writeFile(workbook, `Payment_Registry.xlsx`);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-500 font-mono">ფინანსური მონაცემები იტვირთება...</div>;
  }

  return (
    <div className="space-y-8 font-sans text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-none border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            <Calculator size={24} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter uppercase">მთავარი ბუღალტერი</h2>
            <p className="text-sm font-bold text-gray-500 tracking-wide uppercase">გადახდების პორტალი</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {activeTab === 'pending' && pendingRequests.length > 0 && (
            <button
              onClick={handleExportPayments}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm"
            >
              <Download size={16} />
              ექსელი რეესტრისთვის
            </button>
          )}

          <div className="flex gap-1 bg-gray-100 p-1 rounded-none border border-black">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border border-transparent ${activeTab === 'pending' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              მიმდინარე ({pendingRequests.length})
            </button>
            <button 
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border border-transparent ${activeTab === 'invoices' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              ინვოისები
              {invoicesCount > 0 && (
                <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{invoicesCount}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('archive')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border border-transparent ${activeTab === 'archive' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              არქივი
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'pending' && (
        <>
          {pendingRequests.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 p-12 text-center bg-gray-50">
              <div className="w-16 h-16 bg-white border-2 border-gray-200 flex items-center justify-center mx-auto mb-4 rounded-full text-green-500">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-black uppercase tracking-tight">ყველა გადახდა შესრულებულია</h3>
              <p className="text-sm text-gray-500 font-medium mt-1">არ არის ახალი დადასტურებული მოთხოვნები.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-r border-gray-700">ხარჯის დასახელება</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-r border-gray-700">მომთხოვნი</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-r border-gray-700">დეპარტამენტი</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-r border-gray-700 text-right">ჯამური თანხა</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center">მოქმედება</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-black border-r border-gray-200">
                        {req.itemName || req.category}
                        <div className="flex items-center gap-1 text-xs font-normal text-blue-600 mt-0.5">
                            <Clock size={12} />
                            გადმოგზავნილია
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black border-r border-gray-200">
                        {req.requesterName}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-black border-r border-gray-200">
                        {req.department}
                      </td>
                      <td className="px-6 py-4 text-right border-r border-gray-200 font-mono">
                        <span className="font-extrabold text-lg tracking-tight">{formatNumber(req.totalAmount)}</span>
                        <span className="ml-1 text-xs font-bold text-gray-500">{req.currency}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         {processingId === req.id ? (
                           <span className="text-xs font-bold text-gray-400 animate-pulse uppercase">მუშავდება...</span>
                         ) : (
                           <button 
                             onClick={() => handlePay(req.id)}
                             className="px-6 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2 mx-auto"
                           >
                             <Banknote size={16} /> გადახდა
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'invoices' && (
        <div className="mt-4 animate-in fade-in">
          <AccountantInvoicesView user={user} />
        </div>
      )}
      
      {activeTab === 'archive' && (
        <div className="overflow-x-auto border border-gray-200">
           <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">ხარჯი</th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">თანხა</th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">სტატუსი</th>
              </tr>
            </thead>
            <tbody>
                {archivedRequests.map(r => (
                    <tr key={r.id} className="border-b hover:bg-green-50/50">
                        <td className="px-6 py-3 text-sm">{r.itemName}</td>
                        <td className="px-6 py-3 text-sm text-right font-mono">{formatNumber(r.totalAmount)}</td>
                        <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                <CheckCircle2 size={12} /> გადახდილია
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
           </table>
        </div>
      )}
    </div>
  );
};
