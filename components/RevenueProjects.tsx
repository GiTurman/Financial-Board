
import React, { useState, useEffect, useMemo } from 'react';
import { ProjectRevenue, ProjectTranche, Currency } from '../types';
import { getProjects, addProject, updateProject, terminateProject, getCurrencyRates } from '../services/mockService';
import { formatNumber } from '../utils/formatters';
import { FolderKanban, Plus, Download, Edit2, ChevronDown, ChevronRight, Save, X, Trash2, AlertTriangle, Archive } from 'lucide-react';
import { exportGenericToExcel } from '../utils/excelExport';

const MONTH_NAMES_GE = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const CURRENT_YEAR = 2026;

// --- START: Reusable Termination Modal (PROMPT 6.9-001) ---
interface TerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string, reason: string) => void;
}

const TerminationModal: React.FC<TerminationModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setReason('');
    }
  }, [isOpen]);

  const canConfirm = date && reason.trim() !== '';

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(date, reason);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b">
          <h3 className="font-bold text-lg text-red-700">ჩანაწერის შეწყვეტა</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">შეწყვეტის თარიღი</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-black outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">შეწყვეტის მიზეზი/კომენტარი</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={4} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-black outline-none" placeholder="მიუთითეთ მიზეზი..."></textarea>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded font-bold text-sm">გაუქმება</button>
          <button onClick={handleConfirm} disabled={!canConfirm} className="px-4 py-2 bg-red-600 text-white rounded font-bold text-sm disabled:bg-gray-300">დადასტურება</button>
        </div>
      </div>
    </div>
  );
};
// --- END: Reusable Termination Modal ---

// --- Modal Component ---
interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<ProjectRevenue, 'id' | 'status'> | ProjectRevenue) => void;
  initialData: Omit<ProjectRevenue, 'id' | 'status'> | ProjectRevenue | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Omit<ProjectRevenue, 'id' | 'status'>>({
    clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 1, contractNumber: '', productType: '', brand: '', product: '',
    unit: '', numberOfFloors: 1, quantity: 1, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      const { status, ...rest } = initialData as ProjectRevenue;
      setFormData({ ...rest, contractDate: new Date(initialData.contractDate).toISOString().split('T')[0] });
    } else {
      setFormData({
        clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 1, contractNumber: '', productType: '', brand: '', product: '',
        unit: '', numberOfFloors: 1, quantity: 1, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Omit<ProjectRevenue, 'id' | 'status'>, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTrancheChange = (index: number, field: keyof ProjectTranche, value: any) => {
    // FIX: Use immutable update with .map() instead of .forEach() to prevent state mutation issues.
    const newTranches = formData.tranches.map((tranche, i) => {
        if (i === index) {
            return { ...tranche, [field]: value };
        }
        return tranche;
    });
    setFormData(prev => ({ ...prev, tranches: newTranches }));
  };

  const addTranche = () => {
    if (formData.tranches.length < 4) {
      setFormData(prev => ({...prev, tranches: [...prev.tranches, { id: `tr_${Date.now()}`, percentage: 0, month: 0, year: CURRENT_YEAR }]}));
    }
  };
  
  const removeTranche = (index: number) => {
    setFormData(prev => ({...prev, tranches: prev.tranches.filter((_, i) => i !== index)}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
    if (totalPercentage !== 100) {
      setError(`ტრანშების ჯამური პროცენტი უნდა იყოს 100%. ამჟამად არის ${totalPercentage}%.`);
      return;
    }
    setError('');
    onSave(initialData ? { ...(initialData as ProjectRevenue), ...formData } : formData);
  };

  if (!isOpen) return null;

  const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-bold text-lg">{initialData ? 'პროექტის კორექტირება' : 'ახალი პროექტის დამატება'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 space-y-4">
          {/* Section A */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <input type="text" placeholder="დამკვეთი" value={formData.clientName} onChange={e => handleChange('clientName', e.target.value)} required className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="date" value={formData.contractDate} onChange={e => handleChange('contractDate', e.target.value)} required className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="text" placeholder="კონტრაქტი N" value={formData.contractNumber} onChange={e => handleChange('contractNumber', e.target.value)} required className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="number" placeholder="ვადა (კვირა)" value={formData.durationInWeeks || ''} onChange={e => handleChange('durationInWeeks', parseInt(e.target.value) || 1)} required min="1" className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="text" placeholder="პროდუქციის ტიპი" value={formData.productType} onChange={e => handleChange('productType', e.target.value)} className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="text" placeholder="ბრენდი" value={formData.brand} onChange={e => handleChange('brand', e.target.value)} className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="text" placeholder="პროდუქცია" value={formData.product} onChange={e => handleChange('product', e.target.value)} className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="text" placeholder="ერთეული" value={formData.unit} onChange={e => handleChange('unit', e.target.value)} className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="number" placeholder="სართ. რაოდენობა" value={formData.numberOfFloors || ''} onChange={e => handleChange('numberOfFloors', parseInt(e.target.value) || 1)} required min="1" className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="number" placeholder="რაოდენობა" value={formData.quantity || ''} onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)} required min="1" className="px-2.5 py-1.5 text-sm border rounded"/>
             <input type="number" placeholder="ღირებულება" value={formData.value || ''} onChange={e => handleChange('value', parseFloat(e.target.value) || 0)} required className="px-2.5 py-1.5 text-sm border rounded"/>
             <select value={formData.currency} onChange={e => handleChange('currency', e.target.value as Currency)} className="px-2.5 py-1.5 text-sm border rounded bg-white"><option value="GEL">GEL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
             <input type="number" placeholder="სულ მიღებული თანხა" value={formData.totalReceived || ''} onChange={e => handleChange('totalReceived', parseFloat(e.target.value) || 0)} className="px-2.5 py-1.5 text-sm border rounded"/>
          </div>
          
          {/* Tranches Section */}
          <div className="space-y-2 pt-4 border-t">
            <label className="font-bold text-sm">გადახდის გრაფიკი (ტრანშები)</label>
            {formData.tranches.map((tranche, index) => (
              <div key={tranche.id} className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded">
                <input type="number" placeholder="%" value={tranche.percentage || ''} onChange={e => handleTrancheChange(index, 'percentage', parseFloat(e.target.value) || 0)} className="w-20 px-2.5 py-1.5 text-sm border rounded" max="100" min="0"/>
                <select value={tranche.month} onChange={e => handleTrancheChange(index, 'month', parseInt(e.target.value))} className="flex-1 px-2.5 py-1.5 text-sm border rounded bg-white">{MONTH_NAMES_GE.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                <select value={tranche.year} onChange={e => handleTrancheChange(index, 'year', parseInt(e.target.value))} className="px-2.5 py-1.5 text-sm border rounded bg-white"><option>2025</option><option>2026</option><option>2027</option></select>
                <button type="button" onClick={() => removeTranche(index)} disabled={formData.tranches.length === 1} className="p-2 text-red-500 disabled:opacity-50"><Trash2 size={16}/></button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button type="button" onClick={addTranche} disabled={formData.tranches.length >= 4} className="text-xs font-bold text-blue-600 disabled:opacity-50">+ ტრანშის დამატება</button>
              <div className={`text-xs font-bold ${totalPercentage !== 100 ? 'text-red-600' : 'text-green-600'}`}>სულ: {totalPercentage}%</div>
            </div>
          </div>
          
          {error && <div className="text-red-600 text-sm p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}

        </form>
        <div className="p-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded font-bold text-sm">გაუქმება</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-black text-white rounded font-bold text-sm">შენახვა</button>
        </div>
      </div>
    </div>
  );
};


// --- Main Component ---
export const RevenueProjects: React.FC = () => {
    const [projects, setProjects] = useState<ProjectRevenue[]>([]);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectRevenue | null>(null);
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({ C: true, D: true, E: true });

    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ projectId: string; field: keyof ProjectRevenue } | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState<string>('');
    
    // Termination state
    const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
    const [terminatingProject, setTerminatingProject] = useState<ProjectRevenue | null>(null);


    const fetchData = async () => {
        setLoading(true);
        const [projectData, currencyRates] = await Promise.all([getProjects(), getCurrencyRates()]);
        setProjects(projectData);
        setRates(currencyRates);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const activeProjects = useMemo(() => projects.filter(p => p.status === 'active'), [projects]);
    const terminatedProjects = useMemo(() => projects.filter(p => p.status === 'terminated'), [projects]);
    
    const handleSaveProject = async (projectData: Omit<ProjectRevenue, 'id' | 'status'> | ProjectRevenue) => {
      if ('id' in projectData) {
        await updateProject(projectData.id, projectData);
      } else {
        await addProject(projectData);
      }
      fetchData();
      setIsModalOpen(false);
    };

    const handleConfirmTermination = async (date: string, reason: string) => {
      if (!terminatingProject) return;
      await terminateProject(terminatingProject.id, date, reason);
      setIsTerminationModalOpen(false);
      setTerminatingProject(null);
      fetchData();
    };
    
    const handleOpenModal = (project: ProjectRevenue | null = null) => {
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const toggleBlock = (block: string) => {
        setCollapsedBlocks(prev => ({ ...prev, [block]: !prev[block] }));
    };

    // --- Inline Editing Handlers ---
    const handleCellDoubleClick = (projectId: string, field: keyof ProjectRevenue, value: any) => {
        setEditingCell({ projectId, field });
        setInlineEditValue(String(value || ''));
    };

    const handleSaveInlineEdit = async () => {
        if (!editingCell) return;
        const { projectId, field } = editingCell;
        const numericValue = parseFloat(inlineEditValue);

        if (!isNaN(numericValue)) {
            await updateProject(projectId, { [field]: numericValue });
            setProjects(projects.map(p => p.id === projectId ? { ...p, [field]: numericValue } : p));
        }
        setEditingCell(null);
    };

    const renderEditableCell = (p: ProjectRevenue, field: keyof ProjectRevenue, isNumeric: boolean = true) => {
        const value = p[field] as number;
        if (editingCell?.projectId === p.id && editingCell?.field === field) {
            return (
                <input
                    type="number"
                    value={inlineEditValue}
                    onChange={(e) => setInlineEditValue(e.target.value)}
                    onBlur={handleSaveInlineEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveInlineEdit();
                        if (e.key === 'Escape') setEditingCell(null);
                    }}
                    className="w-full text-right bg-yellow-100 border-b-2 border-yellow-400 outline-none p-1 font-mono"
                    autoFocus
                />
            );
        }
        return (
            <span onDoubleClick={() => handleCellDoubleClick(p.id, field, value)} className="cursor-pointer">
                {isNumeric ? formatNumber(value) : value}
            </span>
        );
    };


    const getRate = (currency: Currency) => (currency === 'USD' ? rates.USD : currency === 'EUR' ? rates.EUR : 1);

    const processedProjects = useMemo(() => {
        return activeProjects.map(p => {
            const unitPrice = (p.value > 0 && p.quantity > 0) ? p.value / p.quantity : 0;
            const floorPrice = (p.value > 0 && p.numberOfFloors > 0) ? p.value / p.numberOfFloors : 0;
            const weeklyPrice = (p.value > 0 && p.durationInWeeks > 0) ? p.value / p.durationInWeeks : 0;
            const monthlyPrice = weeklyPrice * 4.33;

            return {
                ...p,
                priceAnalysisUnitPrice: unitPrice,
                priceAnalysisFloorPrice: floorPrice,
                priceAnalysisWeeklyPrice: weeklyPrice,
                priceAnalysisMonthlyPrice: monthlyPrice
            };
        });
    }, [activeProjects]);

    const monthlyDistribution = useMemo(() => {
        const distribution: Record<string, number[]> = {};
        activeProjects.forEach(p => {
            const monthly: number[] = Array(12).fill(0);
            const rate = getRate(p.currency);
            if(Array.isArray(p.tranches)) {
              p.tranches.forEach(t => {
                  if (t.year === CURRENT_YEAR) {
                      const amount = p.value * (t.percentage / 100) * rate;
                      monthly[t.month] += amount;
                  }
              });
            }
            distribution[p.id] = monthly;
        });
        return distribution;
    }, [activeProjects, rates]);
    
    const totals = useMemo(() => {
        const totalGEL = processedProjects.reduce((sum, p) => sum + p.value * getRate(p.currency), 0);
        const receivedGEL = processedProjects.reduce((sum, p) => sum + p.totalReceived * getRate(p.currency), 0);
        const remainingGEL = totalGEL - receivedGEL;
        const totalQuantity = processedProjects.reduce((sum,p) => sum + p.quantity, 0);
        const totalNumberOfFloors = processedProjects.reduce((sum,p) => sum + p.numberOfFloors, 0);
        const totalDurationInWeeks = processedProjects.reduce((sum, p) => sum + p.durationInWeeks, 0);
        
        const monthlyTotals = Array(12).fill(0);
        Object.values(monthlyDistribution).forEach(monthlyAmounts => {
            monthlyAmounts.forEach((amount, i) => {
                monthlyTotals[i] += amount;
            });
        });
        
        const totalUnitPrice = totalQuantity > 0 ? totalGEL / totalQuantity : 0;
        const totalFloorPrice = totalNumberOfFloors > 0 ? totalGEL / totalNumberOfFloors : 0;
        const totalWeeklyPrice = totalDurationInWeeks > 0 ? totalGEL / totalDurationInWeeks : 0;
        const totalMonthlyPrice = totalWeeklyPrice * 4.33;

        return { totalGEL, receivedGEL, remainingGEL, totalQuantity, totalNumberOfFloors, totalDurationInWeeks, monthlyTotals, totalUnitPrice, totalFloorPrice, totalWeeklyPrice, totalMonthlyPrice };
    }, [processedProjects, rates, monthlyDistribution]);
    
    const handleExport = () => {
        const headers: Record<string, string> = {
            clientName: 'დამკვეთი',
            contractDate: 'გაფორმების თარიღი',
            durationInWeeks: 'ვადა (კვირა)',
            contractNumber: 'კონტრაქტი N',
            productType: 'პროდ. ტიპი',
            brand: 'ბრენდი',
            product: 'პროდუქცია',
            unit: 'ერთ.',
            numberOfFloors: 'სართ. რაოდ.',
            quantity: 'რაოდ.',
            value: 'ღირებულება',
            currency: 'ვალუტა',
            priceAnalysisUnitPrice: 'ერთეულის ღირებულება',
            priceAnalysisFloorPrice: 'სართულის ღირებულება',
            priceAnalysisWeeklyPrice: 'კვირის ღირებულება',
            priceAnalysisMonthlyPrice: 'თვის ღირებულება',
            totalGEL: 'სულ მისაღები (GEL)',
            receivedGEL: 'სულ მიღებული (GEL)',
            remainingGEL: 'დარჩენილი (GEL)',
            ...Object.fromEntries(MONTH_NAMES_GE.map((m, i) => [`month_${i}`, `${m} ${CURRENT_YEAR}`]))
        };

        const dataToExport = processedProjects.map(p => {
            const rate = getRate(p.currency);
            const totalGEL = p.value * rate;
            const receivedGEL = p.totalReceived * rate;
            const remainingGEL = totalGEL - receivedGEL;
            const monthly = monthlyDistribution[p.id] || Array(12).fill(0);
            
            const monthlyData: Record<string, number> = {};
            monthly.forEach((val, i) => { monthlyData[`month_${i}`] = val; });

            return {
                ...p,
                contractDate: new Date(p.contractDate).toLocaleDateString('ka-GE'),
                totalGEL,
                receivedGEL,
                remainingGEL,
                ...monthlyData
            };
        });

        const exportTotals = {
            totalGEL: totals.totalGEL,
            receivedGEL: totals.receivedGEL,
            remainingGEL: totals.remainingGEL,
            durationInWeeks: totals.totalDurationInWeeks,
            quantity: totals.totalQuantity,
            numberOfFloors: totals.totalNumberOfFloors,
            priceAnalysisUnitPrice: totals.totalUnitPrice,
            priceAnalysisFloorPrice: totals.totalFloorPrice,
            priceAnalysisWeeklyPrice: totals.totalWeeklyPrice,
            priceAnalysisMonthlyPrice: totals.totalMonthlyPrice,
            ...Object.fromEntries(MONTH_NAMES_GE.map((m, i) => [`month_${i}`, totals.monthlyTotals[i]]))
        };

        exportGenericToExcel(
            dataToExport,
            headers,
            'Projects_Revenue',
            'Projects_Revenue_Report',
            exportTotals
        );
    };

    if (loading) return <div>იტვირთება პროექტები...</div>;

    return (
        <>
            <ProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveProject} initialData={editingProject} />
            <TerminationModal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} onConfirm={handleConfirmTermination} />
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-3"><FolderKanban size={24}/> პროექტები</h2>
                    <div className="flex gap-2">
                        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm"><Plus size={16}/> პროექტის დამატება</button>
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm"><Download size={16}/> ექსპორტი</button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm" style={{maxHeight: '75vh'}}>
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-100 text-gray-600 font-bold uppercase sticky top-0 z-20">
                            <tr>
                                <th className="px-2 py-1.5 sticky left-0 bg-gray-100 z-30 w-48"><button onClick={() => toggleBlock('A')} className="flex items-center gap-1 w-full text-xs">A. დეტალიზაცია {collapsedBlocks['A'] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button></th>
                                {!collapsedBlocks['A'] && <th colSpan={11}></th>}

                                <th className="px-2 py-1.5 border-l"><button onClick={() => toggleBlock('B')} className="flex items-center gap-1 w-full text-xs">B. გრაფიკი {collapsedBlocks['B'] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button></th>
                                {!collapsedBlocks['B'] && <th colSpan={3}></th>}
                                
                                <th className="px-2 py-1.5 border-l"><button onClick={() => toggleBlock('E')} className="flex items-center gap-1 w-full text-xs">E. ფასის ანალიზი {collapsedBlocks['E'] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button></th>
                                {!collapsedBlocks['E'] && <th colSpan={3}></th>}

                                <th className="px-2 py-1.5 border-l"><button onClick={() => toggleBlock('C')} className="flex items-center gap-1 w-full text-xs">C. ანალიზი {collapsedBlocks['C'] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button></th>
                                {!collapsedBlocks['C'] && <th colSpan={3}></th>}
                                
                                <th className="px-2 py-1.5 border-l"><button onClick={() => toggleBlock('D')} className="flex items-center gap-1 w-full text-xs">D. შემოსავალი (2026) {collapsedBlocks['D'] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button></th>
                                {!collapsedBlocks['D'] && <th colSpan={11}></th>}
                            </tr>
                            <tr>
                                {/* A */}
                                <th className="px-2 py-1 sticky left-0 bg-gray-100 z-30">დამკვეთი</th>
                                {!collapsedBlocks['A'] && <><th className="px-2 py-1">გაფორმების თარიღი</th><th className="px-2 py-1">კონტრაქტი N</th><th className="px-2 py-1">ვადა (კვირა)</th><th className="px-2 py-1">პროდ. ტიპი</th><th className="px-2 py-1">ბრენდი</th><th className="px-2 py-1">პროდუქცია</th><th className="px-2 py-1">ერთ.</th><th className="px-2 py-1">სართ. რაოდ.</th><th className="px-2 py-1">რაოდ.</th><th className="px-2 py-1 text-right">ღირებულება</th><th className="px-2 py-1">ვალუტა</th></>}
                                {/* B */}
                                {!collapsedBlocks['B'] && <><th className="px-2 py-1 text-center border-l">I %</th><th className="px-2 py-1 text-center">II %</th><th className="px-2 py-1 text-center">III %</th><th className="px-2 py-1 text-center">IV %</th></>}
                                {/* E */}
                                {!collapsedBlocks['E'] && <><th className="px-2 py-1 text-right border-l">ერთ. ღირებულება</th><th className="px-2 py-1 text-right">სართ. ღირებულება</th><th className="px-2 py-1 text-right">კვირ. ღირებულება</th><th className="px-2 py-1 text-right">თვის. ღირებულება</th></>}
                                {/* C */}
                                {!collapsedBlocks['C'] && <><th className="px-2 py-1 text-right border-l">სულ მისაღები</th><th className="px-2 py-1 text-right">სულ მიღებული</th><th className="px-2 py-1 text-right">დარჩენილი (GEL)</th><th className="px-2 py-1 w-28">დარჩენილი %</th></>}
                                {/* D */}
                                {!collapsedBlocks['D'] && MONTH_NAMES_GE.map(m => <th key={m} className="px-2 py-1 text-right border-l w-24">{m}</th>)}
                                <th className="px-2 py-1 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {processedProjects.map(p => {
                            const rate = getRate(p.currency);
                            const totalGEL = p.value * rate;
                            const receivedGEL = p.totalReceived * rate;
                            const remainingGEL = totalGEL - receivedGEL;
                            const remainingPct = totalGEL > 0 ? (remainingGEL / totalGEL) * 100 : 0;
                            return (
                            <tr key={p.id} className="hover:bg-blue-50/50">
                                <td className="px-2 py-1.5 font-bold sticky left-0 bg-white hover:bg-blue-50/50 z-10">{p.clientName}</td>
                                {!collapsedBlocks['A'] && <><td className="px-2 py-1.5">{new Date(p.contractDate).toLocaleDateString()}</td><td className="px-2 py-1.5">{p.contractNumber}</td><td className="px-2 py-1.5 text-center font-mono">{renderEditableCell(p, 'durationInWeeks', false)}</td><td>{p.productType}</td><td>{p.brand}</td><td>{p.product}</td><td>{p.unit}</td><td className="px-2 py-1.5 text-center font-mono">{renderEditableCell(p, 'numberOfFloors', false)}</td><td className="px-2 py-1.5 text-center font-mono">{renderEditableCell(p, 'quantity', false)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(p.value)}</td><td className="px-2 py-1.5">{p.currency}</td></>}
                                {!collapsedBlocks['B'] && <>{[0, 1, 2, 3].map(i => <td key={i} className={`px-2 py-1.5 text-center font-mono ${i===0?'border-l':''}`}>{p.tranches[i] ? `${p.tranches[i].percentage}%` : '-'}</td>)}</>}
                                {!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l bg-gray-100">{formatNumber(p.priceAnalysisUnitPrice)}</td><td className="px-2 py-1.5 text-right font-mono bg-gray-100">{formatNumber(p.priceAnalysisFloorPrice)}</td><td className="px-2 py-1.5 text-right font-mono bg-gray-100">{formatNumber(p.priceAnalysisWeeklyPrice)}</td><td className="px-2 py-1.5 text-right font-mono bg-gray-100">{formatNumber(p.priceAnalysisMonthlyPrice)}</td></>}
                                {!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono text-green-600">{formatNumber(receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono font-bold text-red-600">{formatNumber(remainingGEL)}</td><td className="px-2 py-1.5"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-600 h-2.5 rounded-full" style={{width: `${100-remainingPct}%`}}></div></div></td></>}
                                {!collapsedBlocks['D'] && monthlyDistribution[p.id].map((amount, i) => <td key={i} className="px-2 py-1.5 text-right font-mono border-l">{amount > 0 ? formatNumber(amount) : '-'}</td>)}
                                <td className="px-2 py-1.5 text-center"><button onClick={() => handleOpenModal(p)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={14}/></button><button onClick={() => { setTerminatingProject(p); setIsTerminationModalOpen(true); }} className="p-1 text-red-500 hover:bg-red-100 rounded ml-1"><Trash2 size={14}/></button></td>
                            </tr>
                            );
                        })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20">
                            <tr className="bg-gray-200 text-black font-bold">
                                <td className="px-2 py-1.5 sticky left-0 bg-gray-200 z-30">ჯამი:</td>
                                {!collapsedBlocks['A'] && <><td colSpan={2}></td><td className="px-2 py-1.5 text-center font-mono">{totals.totalDurationInWeeks}</td><td colSpan={3}></td><td className="px-2 py-1.5 text-center font-mono">{totals.totalNumberOfFloors}</td><td className="px-2 py-1.5 text-center font-mono">{totals.totalQuantity}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalGEL)}</td><td>GEL</td></>}
                                {!collapsedBlocks['B'] && <td colSpan={4} className="border-l"></td>}
                                {!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalUnitPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalFloorPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalWeeklyPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalMonthlyPrice)}</td></>}
                                {!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.remainingGEL)}</td><td></td></>}
                                {!collapsedBlocks['D'] && totals.monthlyTotals.map((total, i) => (<td key={i} className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(total)}</td>))}
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                 {terminatedProjects.length > 0 && (
                    <div className="mt-12 space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-3"><Archive size={20}/> არქივი: შეწყვეტილი ჩანაწერები</h3>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-200 text-gray-700 font-bold uppercase">
                                    <tr>
                                        <th className="px-4 py-2">დამკვეთი</th>
                                        <th className="px-4 py-2">კონტრაქტი N</th>
                                        <th className="px-4 py-2 text-right">ღირებულება</th>
                                        <th className="px-4 py-2">შეწყვეტის თარიღი</th>
                                        <th className="px-4 py-2">კომენტარი</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {terminatedProjects.map(p => (
                                        <tr key={p.id}>
                                            <td className="px-4 py-2 font-bold">{p.clientName}</td>
                                            <td className="px-4 py-2">{p.contractNumber}</td>
                                            <td className="px-4 py-2 text-right font-mono">{formatNumber(p.value)} {p.currency}</td>
                                            <td className="px-4 py-2">{p.terminationDate ? new Date(p.terminationDate).toLocaleDateString('ka-GE') : '-'}</td>
                                            <td className="px-4 py-2 text-gray-600 italic whitespace-normal max-w-xs">{p.terminationReason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
