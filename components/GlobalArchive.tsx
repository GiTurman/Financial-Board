
import React, { useState, useEffect, useMemo } from 'react';
import { User, ExpenseRequest, RequestStatus } from '../types';
import { getAllRequests } from '../services/mockService';
import { 
  Archive, 
  Calendar, 
  Filter, 
  Search, 
  Wallet, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  CornerUpLeft // Added for returned status
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatNumber } from '../utils/formatters';

interface GlobalArchiveProps {
  user: User;
}

export const GlobalArchive: React.FC<GlobalArchiveProps> = ({ user }) => {
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetch = async () => {
      const data = await getAllRequests();
      const archived = data.filter(r => 
        r.status === RequestStatus.PAID || 
        r.status === RequestStatus.REJECTED ||
        r.status === RequestStatus.APPROVED_FOR_PAYMENT ||
        r.status === RequestStatus.RETURNED_TO_SENDER // Now included in archive
      );
      setRequests(archived);
      
      // Expand first session
      if (archived.length > 0) {
        const date = archived[0].boardDate;
        setExpandedSessions({ [date]: true });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(requests.map(r => r.department));
    return ['All', ...Array.from(depts)];
  }, [requests]);

  // Grouping Logic
  const groupedData = useMemo(() => {
    // 1. Filter
    const filtered = requests.filter(req => {
      const matchesSearch = 
        (req.itemName || req.category).toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.totalAmount.toString().includes(searchQuery) || 
        req.requesterName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDepartment === 'All' || req.department === selectedDepartment;
      
      return matchesSearch && matchesDept;
    });

    // 2. Group
    const groups: Record<string, ExpenseRequest[]> = {};
    filtered.forEach(req => {
      const dateKey = req.boardDate;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(req);
    });

    // 3. Sort Keys
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [requests, searchQuery, selectedDepartment]);

  const toggleSession = (key: string) => {
    setExpandedSessions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    const dataToExport = requests.map(req => ({
      'ID': req.id,
      'თარიღი': new Date(req.createdAt).toLocaleDateString('ka-GE'),
      'დეპარტამენტი': req.department,
      'მომთხოვნი': req.requesterName,
      'კატეგორია': req.category,
      'ხარჯის დასახელება': req.itemName || req.category,
      'თანხა': req.totalAmount,
      'ვალუტა': req.currency,
      'სტატუსი': req.status,
      'ფინანსური დირექტორის გადაწყვეტილება': req.finDirectorNote
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Archive");
    XLSX.writeFile(workbook, `Global_Archive_Export.xlsx`);
  };

  if (loading) return <div className="p-12 text-center text-gray-500 font-mono">იტვირთება არქივი...</div>;

  return (
    <div className="space-y-8 font-sans text-black">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-none border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            <Archive size={24} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter uppercase">გლობალური არქივი</h2>
            <p className="text-sm font-bold text-gray-500 tracking-wide uppercase">ისტორიული ჩანაწერები</p>
          </div>
        </div>
        <button 
          onClick={handleExport}
          className="px-4 py-2 border border-black text-black font-bold text-xs uppercase hover:bg-black hover:text-white transition-colors"
        >
          სრული რეპორტის ექსპორტი
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-gray-50 p-6 border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="flex items-center gap-2 text-xs font-bold uppercase mb-2 text-gray-500">
            <Search size={14} /> ძებნა
          </label>
          <input 
            type="text" 
            placeholder="სახელი, თანხა, მომთხოვნი..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-black"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-bold uppercase mb-2 text-gray-500">
            <Filter size={14} /> დეპარტამენტი
          </label>
          <select 
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-black"
          >
            {departments.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'ყველა' : d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {groupedData.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-gray-200 text-gray-400">
            ჩანაწერები არ მოიძებნა.
          </div>
        ) : (
          groupedData.map(([dateKey, groupRequests]) => {
            const isExpanded = expandedSessions[dateKey];
            const sessionDate = new Date(dateKey);
            
            return (
               <div key={dateKey} className="border border-gray-200 rounded bg-white overflow-hidden shadow-sm">
                 <button 
                   onClick={() => toggleSession(dateKey)}
                   className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                 >
                    <div className="flex items-center gap-3">
                       {isExpanded ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                       <div className="font-bold flex items-center gap-2 text-black">
                          <Calendar size={16} />
                          საბჭოს სხდომა: {sessionDate.toLocaleDateString('ka-GE', { year: 'numeric', month: 'long', day: 'numeric' })}
                       </div>
                    </div>
                    <div className="text-xs font-bold text-gray-500">{groupRequests.length} ჩანაწერი</div>
                 </button>

                 {isExpanded && (
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-100/50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">თარიღი</th>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">დეპარტამენტი</th>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">მომთხოვნი</th>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">ხარჯის დასახელება</th>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">თანხა</th>
                            <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-center">სტატუსი</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {groupRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-blue-50/20 transition-colors">
                              <td className="px-6 py-4 font-mono text-gray-500 text-xs">
                                {new Date(req.createdAt).toLocaleDateString('ka-GE')}
                              </td>
                              <td className="px-6 py-4 font-bold text-black">{req.department}</td>
                              <td className="px-6 py-4 text-gray-700">{req.requesterName}</td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-black">{req.itemName || req.category}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">{req.description}</div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-bold">
                                {formatNumber(req.totalAmount)} {req.currency}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {req.status === RequestStatus.PAID ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase rounded">
                                    <Wallet size={12} /> გადახდილია
                                  </span>
                                ) : req.status === RequestStatus.REJECTED ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold uppercase rounded">
                                    <XCircle size={12} /> უარყოფილია
                                  </span>
                                ) : req.status === RequestStatus.RETURNED_TO_SENDER ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded">
                                    <CornerUpLeft size={12} /> დაბრუნებული
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold uppercase rounded">
                                     {req.status}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                 )}
               </div>
            );
          })
        )}
      </div>
    </div>
  );
};