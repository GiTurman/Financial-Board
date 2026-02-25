
import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, CashInflowRecord } from '../types';
import { 
    Download, Save, X, Plus, CircleDollarSign, BarChart2, Zap, ChevronDown, ChevronRight, Trash2 
} from 'lucide-react';
import { exportGenericToExcel } from '../utils/excelExport';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Bar, ComposedChart } from 'recharts';
import { 
    getCurrentWeekCashInflow,
    getArchivedCashInflow,
    addCurrentWeekCashInflowEntry,
    updateCurrentWeekCashInflowEntry,
    deleteCurrentWeekCashInflowEntry,
    finalizeCurrentWeek,
    USERS
} from '../services/mockService';
import { formatNumber } from '../utils/formatters';


// --- Helper Functions ---
const getWeekKeyFromDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (weekStart.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()} - კვირა ${weekNumber}`;
};

const generateHistoricalInflow = () => {
    const data = [];
    for (let i = 52; i > 0; i--) {
        const budgeted = 40000 + Math.random() * 10000;
        const actual = budgeted * (0.85 + Math.random() * 0.3);
        data.push({ week: 53 - i, დაგეგმილი: Math.round(budgeted), ფაქტიური: Math.round(actual) });
    }
    return data;
};

const generateAIInsightsForInflow = (currentWeekData: any[]) => {
    if (!currentWeekData || currentWeekData.length === 0) return "არჩეული კვირისთვის მონაცემები არ არის.";
    const totals = currentWeekData.reduce((acc, r) => {
        const cat = r.category;
        if (!acc[cat]) acc[cat] = { budgeted: 0, actual: 0 };
        acc[cat].budgeted += r.budgeted;
        acc[cat].actual += r.actual;
        return acc;
    }, {} as Record<string, { budgeted: number, actual: number }>);
    let insights = [];
    for (const cat in totals) {
        const { budgeted, actual } = totals[cat];
        if (budgeted > 0) {
            const variance = ((actual - budgeted) / budgeted) * 100;
            if (variance > 10) { insights.push(`'${cat}' კატეგორიამ გადააჭარბა გეგმას ${variance.toFixed(0)}%-ით.`); }
            else if (variance < -10) { insights.push(`'${cat}' კატეგორიაში გვაქვს ${Math.abs(variance).toFixed(0)}%-იანი ჩამორჩენა.`); }
        }
    }
    return insights.length > 0 ? insights.join(' ') : "ამ კვირაში შემოსავლები გეგმის ფარგლებშია.";
};

// --- Sub-components ---
const AuthorCell: React.FC<{ authorId: string }> = ({ authorId }) => {
    const author = USERS[authorId];
    if (!author) return <td className="px-4 py-2 text-gray-400">უცნობი</td>;
    return (
        <td className="px-4 py-2">
            <div className="font-bold">{author.name}</div>
            <div className="text-[10px] text-gray-500">{author.department}</div>
        </td>
    );
};

interface AnalysisModalProps { isOpen: boolean; onClose: () => void; data: Record<string, CashInflowRecord[]>; }
const CashInflowAnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, data }) => {
    const [history, setHistory] = useState<any[]>([]);
    const latestWeekKey = useMemo(() => Object.keys(data).sort().pop() || '', [data]);
    const latestWeekData = useMemo(() => data[latestWeekKey] || [], [data, latestWeekKey]);
    const categoryTotals = useMemo(() => {
        const totals = latestWeekData.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + r.actual; return acc; }, {} as Record<string, number>);
        return Object.entries(totals).map(([name, value]) => ({ name, ფაქტიური: value }));
    }, [latestWeekData]);
    const aiSummary = useMemo(() => generateAIInsightsForInflow(latestWeekData), [latestWeekData]);
    useEffect(() => { if (isOpen) { setHistory(generateHistoricalInflow()); } }, [isOpen]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b"><h3 className="text-lg font-bold flex items-center gap-2"><BarChart2 size={20} /> შემოსავლების ანალიზი</h3><button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button></div>
                <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-bold mb-1">შემოსავლების დინამიკა (1 წელი)</h4><p className="text-xs text-gray-500 mb-4">დაგეგმილი vs. ფაქტიური შემოსავალი</p>
                        <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 10 }} /><YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `${formatNumber(v as number)} ₾`} /><Legend /><Line type="monotone" dataKey="დაგეგმილი" stroke="#8884d8" dot={false} /><Line type="monotone" dataKey="ფაქტიური" stroke="#82ca9d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                    </div>
                     <div>
                        <h4 className="font-bold mb-1">მიმდინარე კვირის სტრუქტურა</h4><p className="text-xs text-gray-500 mb-4">{latestWeekKey}</p>
                        <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={categoryTotals} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} /><Tooltip formatter={(v) => `${formatNumber(v as number)} ₾`} /><Bar dataKey="ფაქტიური" barSize={20} fill="#413ea0" /></ComposedChart></ResponsiveContainer></div>
                    </div>
                    <div className="lg:col-span-2 bg-gray-50 border border-gray-200 p-4 rounded"><h4 className="font-bold text-sm mb-2 flex items-center gap-2"><Zap size={16} className="text-yellow-500"/> AI ანალიტიკა</h4><p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p></div>
                </div>
            </div>
        </div>
    );
};

// --- Main Unified View Component ---
export const CashInflowView: React.FC<{ user: User }> = ({ user }) => {
  const isTopLevel = [UserRole.FOUNDER, UserRole.FIN_DIRECTOR, UserRole.CEO].includes(user.role);
  
  const [archiveData, setArchiveData] = useState<Record<string, CashInflowRecord[]>>({});
  const [currentWeekEntries, setCurrentWeekEntries] = useState<CashInflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
      setLoading(true);
      const [current, archive] = await Promise.all([
          getCurrentWeekCashInflow(user),
          getArchivedCashInflow()
      ]);
      setCurrentWeekEntries(current);
      setArchiveData(archive);
      
      const latestWeek = Object.keys(archive).sort().pop();
      if (latestWeek) {
          setExpandedWeeks(prev => ({ ...prev, [latestWeek]: true }));
      }
      setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);
  
  const handleAddRow = async () => {
      const newEntry = await addCurrentWeekCashInflowEntry({}, user.id);
      setCurrentWeekEntries(prev => [...prev, newEntry]);
  };
  
  const handleUpdate = async (id: string, field: keyof CashInflowRecord, value: any) => {
      setCurrentWeekEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
      await updateCurrentWeekCashInflowEntry(id, { [field]: value }, user.id);
  };

  const handleDelete = async (id: string) => {
      setCurrentWeekEntries(prev => prev.filter(e => e.id !== id));
      await deleteCurrentWeekCashInflowEntry(id);
  };

  const handleFinalize = async () => {
      await finalizeCurrentWeek();
      await fetchData();
      alert('მიმდინარე კვირის შემოსავლები დაარქივდა.');
  };

  const currentWeekTotals = useMemo(() => currentWeekEntries.reduce((acc, curr) => { acc.budgeted += Number(curr.budgeted) || 0; acc.actual += Number(curr.actual) || 0; return acc; }, { budgeted: 0, actual: 0 }), [currentWeekEntries]);

  const toggleWeek = (key: string) => setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
  const sortedWeekKeys = useMemo(() => Object.keys(archiveData).sort((a, b) => b.localeCompare(a)), [archiveData]);

  if (loading) {
      return <div>იტვირთება...</div>;
  }

  return (
    <>
      {isTopLevel && <CashInflowAnalysisModal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} data={archiveData} />}
      <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
        
        <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CircleDollarSign size={24} /></div>
                {isTopLevel ? "შემოსავლების მართვა (კონსოლიდირებული)" : "ჩემი სამუშაო სივრცე (შემოსავლები)"}
            </h2>
            {isTopLevel && (
              <button onClick={() => setIsAnalysisModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-black text-xs font-bold uppercase tracking-wider hover:bg-gray-100 shadow-sm rounded">
                <BarChart2 size={16} /> ანალიზი
              </button>
            )}
        </div>
        
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">მიმდინარე კვირის შეყვანა</h3>
                <div className="flex gap-2">
                    <button onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-black text-xs font-bold uppercase rounded shadow-sm"><Plus size={14} /> რიგის დამატება</button>
                    {isTopLevel && <button onClick={handleFinalize} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold uppercase rounded shadow-sm"><Save size={14} /> კვირის დასრულება</button>}
                </div>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs">
                        <tr>
                            {isTopLevel && <th className="px-4 py-3 bg-blue-50 text-blue-800">შემვსები</th>}
                            <th className="px-4 py-3">დასახელება/კლიენტი</th>
                            <th className="px-4 py-3">კატეგორია</th>
                            <th className="px-4 py-3 text-right">დაგეგმილი</th>
                            <th className="px-4 py-3 text-right">ფაქტიური</th>
                            <th className="px-4 py-3">კომენტარი</th>
                            <th className="px-4 py-3 text-center">წაშლა</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {currentWeekEntries.map(entry => (
                        <tr key={entry.id}>
                            {isTopLevel && <AuthorCell authorId={entry.authorId} />}
                            <td className="px-2 py-1"><input type="text" value={entry.name} onChange={e => handleUpdate(entry.id, 'name', e.target.value)} className="w-full border-b p-1 bg-transparent focus:border-black outline-none" placeholder="კლიენტი..." /></td>
                            <td className="px-2 py-1"><select value={entry.category} onChange={e => handleUpdate(entry.id, 'category', e.target.value as any)} className="w-full border-b p-1 bg-transparent focus:border-black outline-none"><option>პროექტები</option><option>სერვისები</option><option>ნაწილები</option></select></td>
                            <td className="px-2 py-1"><input type="number" value={entry.budgeted || ''} onChange={e => handleUpdate(entry.id, 'budgeted', parseFloat(e.target.value))} className="w-24 text-right border-b p-1 bg-transparent focus:border-black outline-none" /></td>
                            <td className="px-2 py-1"><input type="number" value={entry.actual || ''} onChange={e => handleUpdate(entry.id, 'actual', parseFloat(e.target.value))} className="w-24 text-right border-b p-1 bg-transparent focus:border-black outline-none" /></td>
                            <td className="px-2 py-1"><input type="text" value={entry.comment} onChange={e => handleUpdate(entry.id, 'comment', e.target.value)} className="w-full border-b p-1 bg-transparent focus:border-black outline-none" /></td>
                            <td className="px-2 py-1 text-center"><button onClick={() => handleDelete(entry.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded"><Trash2 size={14} /></button></td>
                        </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-800 text-white font-bold text-xs uppercase">
                        <tr>
                            <td colSpan={isTopLevel ? 3 : 2} className="px-4 py-3">ჯამი</td>
                            <td className="px-4 py-3 text-right font-mono">{formatNumber(currentWeekTotals.budgeted)} ₾</td>
                            <td className="px-4 py-3 text-right font-mono">{formatNumber(currentWeekTotals.actual)} ₾</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {isTopLevel && (
            <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200 space-y-3">
              <h3 className="text-xl font-bold">არქივი</h3>
              {sortedWeekKeys.map(weekKey => {
                const weekData = archiveData[weekKey]; const isExpanded = !!expandedWeeks[weekKey]; const totals = weekData.reduce((acc, r) => { acc.budgeted += r.budgeted; acc.actual += r.actual; return acc; }, { budgeted: 0, actual: 0 }); const totalVariance = totals.actual - totals.budgeted;
                return (
                  <div key={weekKey} className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm">
                    <button onClick={() => toggleWeek(weekKey)} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-left"><div className="flex items-center gap-3 font-bold text-black">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {weekKey}</div><div className="flex items-center gap-4 text-xs font-mono"><span>დაგეგმილი: <span className="font-bold">{formatNumber(totals.budgeted)} ₾</span></span><span>ფაქტიური: <span className="font-bold">{formatNumber(totals.actual)} ₾</span></span><span className={`font-bold px-2 py-1 rounded ${totalVariance >=0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{totalVariance > 0 ? '+' : ''}{formatNumber(totalVariance)} ₾</span></div></button>
                    {isExpanded && (<div className="overflow-auto max-h-[60vh] relative"><table className="w-full text-left text-sm table-auto"><thead className="sticky top-0 z-10 bg-gray-100 text-gray-600 font-bold uppercase text-xs"><tr><th className="px-4 py-3 sticky left-0 bg-gray-100 z-10">დასახელება/კლიენტი</th><th className="px-4 py-3">თარიღი</th><th className="px-4 py-3">კატეგორია</th><th className="px-4 py-3 text-right">დაგეგმილი</th><th className="px-4 py-3 text-right">ფაქტიური</th><th className="px-4 py-3 text-right">გადახრა</th><th className="px-4 py-3">კომენტარი</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{weekData.map(rec => { const variance = rec.actual - rec.budgeted; return (<tr key={rec.id}><td className="px-4 py-2 font-bold sticky left-0 bg-white">{rec.name}</td><td className="px-4 py-2 font-mono text-gray-500">{rec.date ? new Date(rec.date).toLocaleDateString('ka-GE') : '-'}</td><td className="px-4 py-2 text-xs font-bold">{rec.category}</td><td className="px-4 py-2 text-right font-mono text-gray-500">{formatNumber(rec.budgeted)} ₾</td><td className="px-4 py-2 text-right font-mono text-green-700">{formatNumber(rec.actual)} ₾</td><td className={`px-4 py-2 text-right font-mono font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(variance)} ₾</td><td className="px-4 py-2 text-xs italic">{rec.comment}</td></tr>);})}</tbody><tfoot className="sticky bottom-0 z-10 bg-gray-800 text-white font-bold text-xs uppercase"><tr><td className="px-4 py-3 sticky left-0 bg-gray-800 z-10">ჯამი</td><td colSpan={2}></td><td className="px-4 py-3 text-right font-mono">{formatNumber(totals.budgeted)} ₾</td><td className="px-4 py-3 text-right font-mono">{formatNumber(totals.actual)} ₾</td><td className={`px-4 py-3 text-right font-mono text-base ${totalVariance >=0 ? 'text-green-400' : 'text-red-400'}`}>{formatNumber(totalVariance)} ₾</td><td></td></tr></tfoot></table></div>)}
                  </div>
                );
              })}
            </div>
        )}
      </div>
    </>
  );
};
