
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ArrowLeftRight, Download, Upload, Edit2, Save, X, BarChart2, Zap, Plus } from 'lucide-react';
import { exportGenericToExcel } from '../utils/excelExport';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DebtRecord } from '../types';
import { 
    getDebtors, 
    getCreditors, 
    updateDebtor, 
    updateCreditor, 
    addDebtor, 
    addCreditor 
} from '../services/mockService';
import { formatNumber } from '../utils/formatters';


// --- START: Debt Analysis Modal and Logic (PROMPT 6.1-002) ---
// ... (The entire DebtAnalysisModal component and its helper functions remain unchanged) ...
interface HistoricalDebtData {
  week: number;
  totalDebtors: number;
  totalCreditors: number;
}
const getDebtHistory = async (): Promise<HistoricalDebtData[]> => {
  const history: HistoricalDebtData[] = [];
  let lastDebtor = 50000;
  let lastCreditor = 30000;
  for (let i = 52; i > 0; i--) {
    const debtorChange = (Math.random() - 0.4) * 5000;
    lastDebtor += debtorChange + 500;
    if (i % 13 === 0) lastDebtor *= 1.1;
    const creditorChange = (Math.random() - 0.5) * 4000;
    lastCreditor += creditorChange;
    history.push({
      week: 53 - i,
      totalDebtors: Math.max(0, Math.round(lastDebtor)),
      totalCreditors: Math.max(0, Math.round(lastCreditor)),
    });
  }
  return history;
};
const generateAIInsights = (history: HistoricalDebtData[], currentDebtors: number, currentCreditors: number): string => {
  if (history.length < 12) return "არასაკმარისი ისტორიული მონაცემები ანალიზისთვის.";
  const lastQuarter = history.slice(-12);
  const firstQuarterDebtors = lastQuarter[0].totalDebtors;
  const lastQuarterDebtors = lastQuarter[11].totalDebtors;
  const debtorTrend = (lastQuarterDebtors - firstQuarterDebtors) / firstQuarterDebtors;
  let insights = [];
  if (debtorTrend > 0.3) {
    insights.push(`დებიტორული დავალიანების მკვეთრი ზრდა ფიქსირდება ბოლო კვარტალში (${(debtorTrend * 100).toFixed(0)}%). საჭიროა დაუყოვნებელი რეაგირება ფულადი ნაკადების სტაბილურობისთვის.`);
  } else if (debtorTrend > 0.1) {
    insights.push(`დებიტორული დავალიანება სტაბილურად იზრდება ბოლო 3 თვის განმავლობაში, რაც ფულადი ნაკადების გაუარესების საშუალოვადიან რისკს ქმნის.`);
  } else if (debtorTrend < -0.1) {
     insights.push(`დებიტორული დავალიანების შემცირების პოზიტიური ტრენდი შეინიშნება.`);
  } else {
     insights.push(`დებიტორული დავალიანება სტაბილურია.`);
  }
  const creditorAvg = history.reduce((sum, item) => sum + item.totalCreditors, 0) / history.length;
  if (currentCreditors > creditorAvg * 1.2) {
    insights.push(`კრედიტორული დავალიანება აჭარბებს საშუალო ისტორიულ მაჩვენებელს, თუმცა კონტროლს ექვემდებარება.`);
  } else {
    insights.push(`კრედიტორული ვალდებულებები ეფექტურად იმართება და საშუალო ნიშნულზეა.`);
  }
  return insights.join(' ');
};
interface DebtAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDebtorsTotal: number;
  currentCreditorsTotal: number;
}
const DebtAnalysisModal: React.FC<DebtAnalysisModalProps> = ({ isOpen, onClose, currentDebtorsTotal, currentCreditorsTotal }) => {
  const [history, setHistory] = useState<HistoricalDebtData[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiCommentary, setAiCommentary] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const fetchData = async () => {
        const histData = await getDebtHistory();
        setHistory(histData);
        const insights = generateAIInsights(histData, currentDebtorsTotal, currentCreditorsTotal);
        setAiCommentary(insights);
        setLoading(false);
      };
      fetchData();
    }
  }, [isOpen, currentDebtorsTotal, currentCreditorsTotal]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold flex items-center gap-2"><BarChart2 size={20} /> დავალიანების ანალიზი (1 წელი)</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-500">ისტორიული მონაცემები იტვირთება...</div>
        ) : (
          <div className="p-6 overflow-y-auto">
            <div className="h-80 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} label={{ value: 'კვირა', position: 'insideBottom', offset: -5, fontSize: 12 }}/>
                  {/* FIX: Explicitly cast value to number for type safety. */}
                  <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(Number(value))} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => `${formatNumber(value as number)} ₾`} />
                  <Legend />
                  <Line type="monotone" dataKey="totalDebtors" name="დებიტორები" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalCreditors" name="კრედიტორები" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2"><Zap size={16} className="text-yellow-500"/> AI ანალიტიკა</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{aiCommentary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
// --- END: Debt Analysis Modal and Logic ---

const excelHeaderMapping: { [key: string]: keyof Omit<DebtRecord, 'id'> } = {
  'დასახელება': 'name',
  'წინა კვირის დავალიანება': 'previousBalance',
  'ზრდა': 'increase',
  'კლება': 'decrease',
  'მიმდინარე კვირის დავალიანება': 'currentBalance',
  'კომენტარი': 'comment',
};

const defaultNewRecord: Omit<DebtRecord, 'id'> = {
  name: '',
  previousBalance: 0,
  increase: 0,
  decrease: 0,
  currentBalance: 0,
  comment: '',
};

export const DebtManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'debtors' | 'creditors'>('debtors');
  const [debtors, setDebtors] = useState<DebtRecord[]>([]);
  const [creditors, setCreditors] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<DebtRecord>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newRecord, setNewRecord] = useState(defaultNewRecord);

  const activeData = activeTab === 'debtors' ? debtors : creditors;
  
  const fetchData = async () => {
    setLoading(true);
    const [debtorData, creditorData] = await Promise.all([getDebtors(), getCreditors()]);
    setDebtors(debtorData);
    setCreditors(creditorData);
    setLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  // PROMPT 6.1-005: Calculate Totals
  const totals = useMemo(() => {
    return activeData.reduce((acc, record) => {
      acc.previousBalance += record.previousBalance;
      acc.increase += record.increase;
      acc.decrease += record.decrease;
      acc.currentBalance += record.currentBalance;
      return acc;
    }, { previousBalance: 0, increase: 0, decrease: 0, currentBalance: 0 });
  }, [activeData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (File upload logic remains unchanged) ...
  };

  const triggerFileUpload = () => document.getElementById('excel-upload-input')?.click();
  
  const handleExport = () => {
    const headers = {
      name: 'დასახელება',
      previousBalance: 'წინა კვირის დავალიანება',
      increase: 'ზრდა',
      decrease: 'კლება',
      currentBalance: 'მიმდინარე კვირის დავალიანება',
      comment: 'კომენტარი',
    };
    const fileNameBase = activeTab === 'debtors' ? 'დებიტორები' : 'კრედიტორები';
    exportGenericToExcel(activeData, headers, fileNameBase, fileNameBase, totals);
  };
  
  const handleStartEdit = (record: DebtRecord) => { setEditingId(record.id); setEditFormData({ increase: record.increase, decrease: record.decrease, comment: record.comment }); };
  const handleCancelEdit = () => { setEditingId(null); setEditFormData({}); };
  const handleSaveEdit = async (id: string) => {
    const record = activeData.find(r => r.id === id);
    if (!record) return;

    const newIncrease = Number(editFormData.increase) || 0;
    const newDecrease = Number(editFormData.decrease) || 0;
    const newComment = String(editFormData.comment || '');
    const newCurrentBalance = record.previousBalance + newIncrease - newDecrease;
    const updatedRecord = { ...record, increase: newIncrease, decrease: newDecrease, comment: newComment, currentBalance: newCurrentBalance };
    
    if (activeTab === 'debtors') await updateDebtor(id, updatedRecord);
    else await updateCreditor(id, updatedRecord);
    
    await fetchData();
    handleCancelEdit();
  };
  const handleEditChange = (field: 'increase' | 'decrease' | 'comment', value: string) => { setEditFormData(prev => ({ ...prev, [field]: value })); };

  const handleAddNewClick = () => { setIsAdding(true); setNewRecord(defaultNewRecord); };
  const handleCancelNew = () => { setIsAdding(false); };
  const handleSaveNew = async () => {
    if (!newRecord.name) { alert('გთხოვთ შეავსოთ დასახელება.'); return; }
    const newEntry: DebtRecord = { ...newRecord, id: `manual-${Date.now()}` };
    
    if (activeTab === 'debtors') await addDebtor(newEntry);
    else await addCreditor(newEntry);
    
    await fetchData();
    setIsAdding(false);
  };
  const handleNewRecordChange = (field: keyof typeof defaultNewRecord, value: string | number) => {
    setNewRecord(prev => {
      const updated = { ...prev, [field]: value };
      updated.currentBalance = (Number(updated.previousBalance) || 0) + (Number(updated.increase) || 0) - (Number(updated.decrease) || 0);
      return updated;
    });
  };

  if(loading) return <div>იტვირთება...</div>;

  const renderTable = () => {
    const dataToRender = activeData;
    if (dataToRender.length === 0 && !isAdding) {
      return (
        <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-bold text-black">მონაცემები არ არის</h3>
          <p className="mt-2 text-sm">დაამატეთ ჩანაწერი ხელით ან შემოიტანეთ Excel ფაილი.</p>
        </div>
      );
    }

    return (
      <div className="overflow-auto max-h-[65vh] border border-gray-200 rounded-lg shadow-sm relative">
        <table className="w-full text-left text-sm table-auto">
           <thead className="sticky top-0 z-20">
            <tr className="bg-gray-100 text-gray-600 font-bold uppercase text-xs">
              <th className="px-4 py-3 sticky left-0 bg-gray-100 z-10">დასახელება</th>
              <th className="px-4 py-3 text-right">წინა ნაშთი</th>
              <th className="px-4 py-3 text-right bg-green-50 text-green-800">ზრდა</th>
              <th className="px-4 py-3 text-right bg-red-50 text-red-800">კლება</th>
              <th className="px-4 py-3 text-right font-black bg-gray-200 text-black">მიმდინარე ნაშთი</th>
              <th className="px-4 py-3">კომენტარი</th>
              <th className="px-4 py-3 text-center">მოქმედება</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isAdding && (
              <tr className="bg-blue-50">
                <td className="px-2 py-2 sticky left-0 bg-blue-50 z-10"><input type="text" placeholder="დასახელება" value={newRecord.name} onChange={e => handleNewRecordChange('name', e.target.value)} className="w-full border-b-2 border-blue-300 outline-none p-1 bg-transparent"/></td>
                <td className="px-2 py-2 text-right"><input type="number" placeholder="0" value={newRecord.previousBalance || ''} onChange={e => handleNewRecordChange('previousBalance', Number(e.target.value))} className="w-24 text-right border-b-2 border-blue-300 outline-none p-1 bg-transparent"/></td>
                <td className="px-2 py-2 text-right"><input type="number" placeholder="0" value={newRecord.increase || ''} onChange={e => handleNewRecordChange('increase', Number(e.target.value))} className="w-24 text-right border-b-2 border-green-300 outline-none p-1 bg-transparent"/></td>
                <td className="px-2 py-2 text-right"><input type="number" placeholder="0" value={newRecord.decrease || ''} onChange={e => handleNewRecordChange('decrease', Number(e.target.value))} className="w-24 text-right border-b-2 border-red-300 outline-none p-1 bg-transparent"/></td>
                <td className="px-4 py-2 text-right font-mono font-black">{formatNumber(newRecord.currentBalance)} ₾</td>
                <td className="px-2 py-2"><input type="text" placeholder="კომენტარი" value={newRecord.comment} onChange={e => handleNewRecordChange('comment', e.target.value)} className="w-full border-b-2 border-blue-300 outline-none p-1 bg-transparent"/></td>
                <td className="px-2 py-2 text-center"><div className="flex justify-center gap-2"><button onClick={handleSaveNew} className="p-1.5 text-green-600 hover:bg-green-100 rounded"><Save size={16}/></button><button onClick={handleCancelNew} className="p-1.5 text-red-600 hover:bg-red-100 rounded"><X size={16}/></button></div></td>
              </tr>
            )}
            {dataToRender.map(record => {
              const isEditing = editingId === record.id;
              const rowBg = isEditing ? "bg-yellow-50" : "bg-white";
              return (
                <tr key={record.id} className={`${!isEditing && 'hover:bg-gray-50'}`}>
                  <td className={`px-4 py-2 font-bold sticky left-0 z-10 ${rowBg}`}>{record.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">{formatNumber(record.previousBalance)} ₾</td>
                  <td className="px-4 py-2 text-right font-mono bg-green-50/50">{isEditing ? <input type="number" value={editFormData.increase} onChange={(e) => handleEditChange('increase', e.target.value)} className="w-24 text-right bg-white border-b-2 border-green-500 outline-none"/> : <span className="text-green-700">{formatNumber(record.increase)} ₾</span>}</td>
                  <td className="px-4 py-2 text-right font-mono bg-red-50/50">{isEditing ? <input type="number" value={editFormData.decrease} onChange={(e) => handleEditChange('decrease', e.target.value)} className="w-24 text-right bg-white border-b-2 border-red-500 outline-none"/> : <span className="text-red-700">{formatNumber(record.decrease)} ₾</span>}</td>
                  <td className="px-4 py-2 text-right font-mono font-black bg-gray-100 text-black">{formatNumber(record.currentBalance)} ₾</td>
                  <td className="px-4 py-2">{isEditing ? <input type="text" value={editFormData.comment} onChange={(e) => handleEditChange('comment', e.target.value)} className="w-full text-left bg-white border-b-2 border-yellow-500 outline-none"/> : <span className="text-gray-600 text-xs italic">{record.comment}</span>}</td>
                  <td className="px-4 py-2 text-center">{isEditing ? (<div className="flex justify-center gap-2"><button onClick={() => handleSaveEdit(record.id)} className="p-1.5 text-green-600 hover:bg-green-100 rounded"><Save size={16}/></button><button onClick={handleCancelEdit} className="p-1.5 text-red-600 hover:bg-red-100 rounded"><X size={16}/></button></div>) : (<button onClick={() => handleStartEdit(record)} className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded"><Edit2 size={16}/></button>)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-gray-800 text-white font-bold text-xs uppercase">
              <td className="px-4 py-3 sticky left-0 bg-gray-800 z-10">ჯამი</td>
              <td className="px-4 py-3 text-right font-mono">{formatNumber(totals.previousBalance)} ₾</td>
              <td className="px-4 py-3 text-right font-mono bg-green-900/50">{formatNumber(totals.increase)} ₾</td>
              <td className="px-4 py-3 text-right font-mono bg-red-900/50">{formatNumber(totals.decrease)} ₾</td>
              <td className="px-4 py-3 text-right font-mono text-base bg-black">{formatNumber(totals.currentBalance)} ₾</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };
  
  return (
    <>
      <DebtAnalysisModal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} currentDebtorsTotal={debtors.reduce((sum, d) => sum + d.currentBalance, 0)} currentCreditorsTotal={creditors.reduce((sum, c) => sum + c.currentBalance, 0)} />
      <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
        <input type="file" id="excel-upload-input" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><ArrowLeftRight size={24} /></div>
                მუშაობა დავალიანებებთან
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setIsAnalysisModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-black text-xs font-bold uppercase tracking-wider hover:bg-gray-100 shadow-sm rounded"><BarChart2 size={16} /> ანალიზი</button>
              <button onClick={handleAddNewClick} disabled={isAdding} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-black text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors shadow-sm rounded disabled:bg-gray-200 disabled:cursor-not-allowed"><Plus size={16} /> ჩანაწერის დამატება</button>
              <button onClick={triggerFileUpload} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-sm rounded"><Upload size={16} /> ექსელის შეტვირთვა</button>
              <button onClick={handleExport} disabled={activeData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded disabled:bg-gray-300 disabled:cursor-not-allowed"><Download size={16} /> ჩამოტვირთვა</button>
            </div>
        </div>
        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => { setActiveTab('debtors'); setEditingId(null); setIsAdding(false); }} className={`px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'debtors' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>დებიტორები</button>
          <button onClick={() => { setActiveTab('creditors'); setEditingId(null); setIsAdding(false); }} className={`px-4 py-2 text-sm font-bold transition-colors ${activeTab === 'creditors' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'}`}>კრედიტორები</button>
        </div>
        {renderTable()}
      </div>
    </>
  );
};
