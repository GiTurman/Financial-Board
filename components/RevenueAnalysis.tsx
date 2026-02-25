import React, { useState, useEffect, useMemo } from 'react';
import { Download, BarChart2, AlertTriangle, Server, FolderKanban, Plus, Edit2, ChevronDown, ChevronRight, X, Trash2, Package, Archive } from 'lucide-react';
import { RevenueProjects } from './RevenueProjects';
import { ServiceRevenue, PartRevenue, ProjectTranche, Currency } from '../types';
import { getServices, addService, updateService, terminateService, getParts, addPart, updatePart, terminatePart, getCurrencyRates } from '../services/mockService';
import { formatNumber } from '../utils/formatters';
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


// --- START: Service Module Component (PROMPT 6.8-001) ---

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Omit<ServiceRevenue, 'id' | 'status'> | ServiceRevenue) => void;
  initialData: Omit<ServiceRevenue, 'id' | 'status'> | ServiceRevenue | null;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Omit<ServiceRevenue, 'id' | 'status'>>({
    clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 52, contractNumber: '', productType: 'მომსახურება', brand: 'Generic', product: '',
    unit: 'თვე', floorsOrStops: 1, quantity: 12, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      const { status, ...rest } = initialData as ServiceRevenue;
      setFormData({ ...rest, contractDate: new Date(initialData.contractDate).toISOString().split('T')[0] });
    } else {
      setFormData({
        clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 52, contractNumber: '', productType: 'მომსახურება', brand: 'Generic', product: '',
        unit: 'თვე', floorsOrStops: 1, quantity: 12, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Omit<ServiceRevenue, 'id' | 'status'>, value: any) => {
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
  
  const addTranche = () => { if (formData.tranches.length < 4) { setFormData(prev => ({...prev, tranches: [...prev.tranches, { id: `tr_${Date.now()}`, percentage: 0, month: 0, year: CURRENT_YEAR }]})); } };
  const removeTranche = (index: number) => { setFormData(prev => ({...prev, tranches: prev.tranches.filter((_, i) => i !== index)})); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
    if (Math.round(totalPercentage) !== 100) { setError(`ტრანშების ჯამური პროცენტი უნდა იყოს 100%. ამჟამად არის ${totalPercentage}%.`); return; }
    setError('');
    onSave(initialData ? { ...(initialData as ServiceRevenue), ...formData } : formData);
  };

  const analysis = useMemo(() => {
    const { value, quantity, floorsOrStops, durationInWeeks } = formData;
    const unitPrice = (value > 0 && quantity > 0) ? value / quantity : 0;
    const stopPrice = (value > 0 && floorsOrStops > 0) ? value / floorsOrStops : 0;
    const weeklyPrice = (value > 0 && durationInWeeks > 0) ? value / durationInWeeks : 0;
    const monthlyPrice = weeklyPrice * 4.33;
    return { unitPrice, stopPrice, weeklyPrice, monthlyPrice };
  }, [formData.value, formData.quantity, formData.floorsOrStops, formData.durationInWeeks]);

  if (!isOpen) return null;
  const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-bold text-lg">{initialData ? 'სერვისის კორექტირება' : 'ახალი სერვისის დამატება'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="დამკვეთი" value={formData.clientName} onChange={e => handleChange('clientName', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="date" value={formData.contractDate} onChange={e => handleChange('contractDate', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="კონტრაქტი N" value={formData.contractNumber} onChange={e => handleChange('contractNumber', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="პროდუქციის ტიპი" value={formData.productType} onChange={e => handleChange('productType', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="ბრენდი" value={formData.brand} onChange={e => handleChange('brand', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="პროდუქცია" value={formData.product} onChange={e => handleChange('product', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="ერთეული" value={formData.unit} onChange={e => handleChange('unit', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="ღირებულება" value={formData.value || ''} onChange={e => handleChange('value', parseFloat(e.target.value) || 0)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <select value={formData.currency} onChange={e => handleChange('currency', e.target.value as Currency)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"><option value="GEL">GEL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
            <input type="number" placeholder="რაოდენობა" value={formData.quantity || ''} onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)} required min="1" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="სართული/გაჩერება" value={formData.floorsOrStops || ''} onChange={e => handleChange('floorsOrStops', parseInt(e.target.value) || 1)} required min="1" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="ვადა (კვირა)" value={formData.durationInWeeks || ''} onChange={e => handleChange('durationInWeeks', parseInt(e.target.value) || 1)} required min="1" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="სულ მიღებული თანხა" value={formData.totalReceived || ''} onChange={e => handleChange('totalReceived', parseFloat(e.target.value) || 0)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
          </div>
          <div className="space-y-2 pt-4 border-t border-gray-700"><label className="font-bold text-sm text-gray-300">ფასის ანალიზი</label><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[{l:'ერთეულის ღირ.',v:analysis.unitPrice},{l:'სართულის ღირ.',v:analysis.stopPrice},{l:'კვირის ღირ.',v:analysis.weeklyPrice},{l:'თვის ღირ.',v:analysis.monthlyPrice}].map(item=>(<div key={item.l} className="bg-gray-700/50 p-3 rounded-md text-center border border-gray-600"><div className="text-xs text-gray-400 uppercase">{item.l}</div><div className="font-bold text-lg font-mono">{formatNumber(item.v)}</div></div>))}</div></div>
          <div className="space-y-2 pt-4 border-t border-gray-700"><label className="font-bold text-sm text-gray-300">გადახდის გრაფიკი (ტრანშები)</label>{formData.tranches.map((tranche, index) => (<div key={tranche.id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-md"><input type="number" placeholder="%" value={tranche.percentage || ''} onChange={e => handleTrancheChange(index, 'percentage', parseFloat(e.target.value) || 0)} className="w-20 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded" max="100" min="0"/><select value={tranche.month} onChange={e => handleTrancheChange(index, 'month', parseInt(e.target.value))} className="flex-1 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded">{MONTH_NAMES_GE.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><select value={tranche.year} onChange={e => handleTrancheChange(index, 'year', parseInt(e.target.value))} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded"><option>2025</option><option>2026</option><option>2027</option></select><button type="button" onClick={() => removeTranche(index)} disabled={formData.tranches.length === 1} className="p-2 text-red-400 disabled:opacity-50 hover:bg-gray-700 rounded"><Trash2 size={16}/></button></div>))}<div className="flex items-center justify-between"><button type="button" onClick={addTranche} disabled={formData.tranches.length >= 4} className="text-xs font-bold text-blue-400 disabled:opacity-50 hover:underline">+ ტრანშის დამატება</button><div className={`text-xs font-bold ${Math.round(totalPercentage) !== 100 ? 'text-red-400' : 'text-green-400'}`}>სულ: {totalPercentage}%</div></div></div>
          {error && <div className="text-red-400 text-sm p-3 bg-red-900/30 border border-red-500/50 rounded flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}
        </form>
        <div className="p-4 border-t border-gray-700 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 border border-gray-600 rounded font-bold text-sm hover:bg-gray-700">გაუქმება</button><button type="submit" form="modal-form" onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">შენახვა</button></div>
      </div>
    </div>
  );
};

export const RevenueService: React.FC = () => {
    const [services, setServices] = useState<ServiceRevenue[]>([]);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<ServiceRevenue | null>(null);
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({ C: true, D: true, E: true });
    const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
    const [terminatingService, setTerminatingService] = useState<ServiceRevenue | null>(null);

    const fetchData = async () => { setLoading(true); const [data, currencyRates] = await Promise.all([getServices(), getCurrencyRates()]); setServices(data); setRates(currencyRates); setLoading(false); };
    useEffect(() => { fetchData(); }, []);

    const activeServices = useMemo(() => services.filter(s => s.status === 'active'), [services]);
    const terminatedServices = useMemo(() => services.filter(s => s.status === 'terminated'), [services]);
    
    const handleSaveService = async (data: Omit<ServiceRevenue, 'id' | 'status'> | ServiceRevenue) => { if ('id' in data) { await updateService(data.id, data); } else { await addService(data); } fetchData(); setIsModalOpen(false); };
    const handleOpenModal = (service: ServiceRevenue | null = null) => { setEditingService(service); setIsModalOpen(true); };
    const handleConfirmTermination = async (date: string, reason: string) => { if (!terminatingService) return; await terminateService(terminatingService.id, date, reason); setIsTerminationModalOpen(false); setTerminatingService(null); fetchData(); };
    
    const toggleBlock = (block: string) => setCollapsedBlocks(prev => ({ ...prev, [block]: !prev[block] }));
    const getRate = (currency: Currency) => (currency === 'USD' ? rates.USD : currency === 'EUR' ? rates.EUR : 1);

    const processedServices = useMemo(() => activeServices.map(s => ({...s, priceAnalysisUnitPrice: (s.value > 0 && s.quantity > 0) ? s.value / s.quantity : 0, priceAnalysisFloorPrice: (s.value > 0 && s.floorsOrStops > 0) ? s.value / s.floorsOrStops : 0, priceAnalysisWeeklyPrice: (s.value > 0 && s.durationInWeeks > 0) ? s.value / s.durationInWeeks : 0, priceAnalysisMonthlyPrice: ((s.value > 0 && s.durationInWeeks > 0) ? s.value / s.durationInWeeks : 0) * 4.33 })), [activeServices]);
    const monthlyDistribution = useMemo(() => { const dist: Record<string, number[]> = {}; processedServices.forEach(p => { const monthly: number[] = Array(12).fill(0); const rate = getRate(p.currency); if (Array.isArray(p.tranches)) { p.tranches.forEach(t => { if (t.year === CURRENT_YEAR) { monthly[t.month] += p.value * (t.percentage / 100) * rate; } }); } dist[p.id] = monthly; }); return dist; }, [processedServices, rates]);
    const totals = useMemo(() => { const totalGEL = processedServices.reduce((s, p) => s + p.value * getRate(p.currency), 0); const receivedGEL = processedServices.reduce((s, p) => s + p.totalReceived * getRate(p.currency), 0); const remainingGEL = totalGEL - receivedGEL; const totalQuantity = processedServices.reduce((s, p) => s + p.quantity, 0); const totalFloorsOrStops = processedServices.reduce((s, p) => s + p.floorsOrStops, 0); const monthlyTotals = Array(12).fill(0); Object.values(monthlyDistribution).forEach(mA => mA.forEach((a, i) => monthlyTotals[i] += a)); const totalUnitPrice = totalQuantity > 0 ? totalGEL / totalQuantity : 0; const totalStopPrice = totalFloorsOrStops > 0 ? totalGEL / totalFloorsOrStops : 0; const totalDuration = processedServices.reduce((s,p)=>s+p.durationInWeeks,0); const totalWeeklyPrice = totalDuration > 0 ? totalGEL / totalDuration : 0; const totalMonthlyPrice = totalWeeklyPrice * 4.33; return { totalGEL, receivedGEL, remainingGEL, totalQuantity, totalFloorsOrStops, monthlyTotals, totalUnitPrice, totalStopPrice, totalWeeklyPrice, totalMonthlyPrice }; }, [processedServices, rates, monthlyDistribution]);
    
    if (loading) return <div>იტვირთება სერვისები...</div>;

    return (
        <>
            <ServiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveService} initialData={editingService} />
            <TerminationModal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} onConfirm={handleConfirmTermination} />
            <div className="space-y-4">
                <div className="flex justify-between items-center"><h2 className="text-2xl font-bold flex items-center gap-3"><Server size={24}/> სერვისი</h2><div className="flex gap-2"><button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm"><Plus size={16}/> სერვისის დამატება</button><button disabled className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm disabled:opacity-50"><Download size={16}/> ექსპორტი</button></div></div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm" style={{maxHeight: '75vh'}}>
                    <table className="w-full text-xs text-left">
                        <thead className="sticky top-0 z-20"><tr className="bg-amber-100 text-amber-800 font-bold uppercase">{['A. დეტალიზაცია','B. გრაფიკი','E. ფასის ანალიზი','C. ანალიზი',`D. შემოსავალი (${CURRENT_YEAR})`].map((h, i)=>(<th key={h} className={`px-2 py-1.5 ${i > 0 && 'border-l border-amber-200'}`} colSpan={i === 0 ? 11 : i === 3 ? 4 : i === 4 ? 12 : 4}><button onClick={()=>toggleBlock(h[0])} className="flex items-center gap-1 w-full text-xs">{h} {collapsedBlocks[h[0]]?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button></th>))}<th className="bg-amber-100"></th></tr><tr className="bg-sky-100 text-sky-800 font-bold uppercase"><th className="px-2 py-1 sticky left-0 bg-sky-100 z-30">დამკვეთი</th>{!collapsedBlocks['A']&&<><th className="px-2 py-1">გაფ. თარიღი</th><th className="px-2 py-1">კონტრაქტი N</th><th className="px-2 py-1">პროდ. ტიპი</th><th className="px-2 py-1">ბრენდი</th><th className="px-2 py-1">პროდუქცია</th><th className="px-2 py-1">ერთ.</th><th className="px-2 py-1">რაოდ.</th><th className="px-2 py-1 text-right">ღირებულება</th><th className="px-2 py-1">ვალუტა</th><th className="px-2 py-1">სართ/გაჩერება</th></>}{!collapsedBlocks['B']&&<><th className="px-2 py-1 text-center border-l border-sky-200">I %</th><th className="px-2 py-1 text-center">II %</th><th className="px-2 py-1 text-center">III %</th><th className="px-2 py-1 text-center">IV %</th></>}{!collapsedBlocks['E']&&<><th className="px-2 py-1 text-right border-l border-sky-200">ერთ. ღირ.</th><th className="px-2 py-1 text-right">სართ. ღირ.</th><th className="px-2 py-1 text-right">კვირ. ღირ.</th><th className="px-2 py-1 text-right">თვის. ღირ.</th></>}{!collapsedBlocks['C']&&<><th className="px-2 py-1 text-right border-l border-sky-200">სულ მისაღები</th><th className="px-2 py-1 text-right">სულ მიღებული</th><th className="px-2 py-1 text-right">დარჩენილი (GEL)</th><th className="px-2 py-1 w-28">დარჩენილი %</th></>}{!collapsedBlocks['D']&&MONTH_NAMES_GE.map(m=><th key={m} className="px-2 py-1 text-right border-l border-sky-200 w-24">{m}</th>)}<th className="px-2 py-1 w-20"></th></tr></thead>
                        <tbody className="divide-y divide-gray-100">{processedServices.map(s => { const rate = getRate(s.currency); const totalGEL = s.value * rate; const receivedGEL = s.totalReceived * rate; const remainingGEL = totalGEL - receivedGEL; const remainingPct = totalGEL > 0 ? (remainingGEL / totalGEL) * 100 : 0; return (<tr key={s.id} className="hover:bg-blue-50/50"><td className="px-2 py-1.5 font-bold sticky left-0 bg-white hover:bg-blue-50/50 z-10">{s.clientName}</td>{!collapsedBlocks['A'] && <><td className="px-2 py-1.5">{new Date(s.contractDate).toLocaleDateString()}</td><td className="px-2 py-1.5">{s.contractNumber}</td><td>{s.productType}</td><td>{s.brand}</td><td>{s.product}</td><td>{s.unit}</td><td className="px-2 py-1.5 text-center font-mono">{s.quantity}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(s.value)}</td><td className="px-2 py-1.5">{s.currency}</td><td className="px-2 py-1.5 text-center font-mono">{s.floorsOrStops}</td></>}{!collapsedBlocks['B'] && <>{[0, 1, 2, 3].map(i => <td key={i} className={`px-2 py-1.5 text-center font-mono ${i===0?'border-l':''}`}>{s.tranches[i] ? `${s.tranches[i].percentage}%` : '-'}</td>)}</>}{!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(s.priceAnalysisUnitPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(s.priceAnalysisFloorPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(s.priceAnalysisWeeklyPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(s.priceAnalysisMonthlyPrice)}</td></>}{!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono text-green-600">{formatNumber(receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono font-bold text-red-600">{formatNumber(remainingGEL)}</td><td className="px-2 py-1.5"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-600 h-2.5 rounded-full" style={{width: `${100-remainingPct}%`}}></div></div></td></>}{!collapsedBlocks['D'] && monthlyDistribution[s.id].map((amount, i) => <td key={i} className="px-2 py-1.5 text-right font-mono border-l">{amount > 0 ? formatNumber(amount) : '-'}</td>)}<td className="px-2 py-1.5 text-center"><button onClick={() => handleOpenModal(s)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={14}/></button><button onClick={() => { setTerminatingService(s); setIsTerminationModalOpen(true); }} className="p-1 text-red-500 hover:bg-red-100 rounded ml-1"><Trash2 size={14}/></button></td></tr>);})}</tbody>
                        <tfoot className="sticky bottom-0 z-20"><tr className="bg-gray-200 text-black font-bold"><td className="px-2 py-1.5 sticky left-0 bg-gray-200 z-30">ჯამი:</td>{!collapsedBlocks['A'] && <><td colSpan={6}></td><td className="px-2 py-1.5 text-center font-mono">{totals.totalQuantity}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalGEL)}</td><td>GEL</td><td className="px-2 py-1.5 text-center font-mono">{totals.totalFloorsOrStops}</td></>}{!collapsedBlocks['B'] && <td colSpan={4} className="border-l"></td>}{!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalUnitPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalStopPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalWeeklyPrice)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalMonthlyPrice)}</td></>}{!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.remainingGEL)}</td><td></td></>}{!collapsedBlocks['D'] && totals.monthlyTotals.map((total, i) => (<td key={i} className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(total)}</td>))}<td></td></tr></tfoot>
                    </table>
                </div>
                 {terminatedServices.length > 0 && (<div className="mt-8 space-y-4"><h3 className="text-xl font-bold flex items-center gap-3"><Archive size={20}/> არქივი: შეწყვეტილი ჩანაწერები</h3><div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm"><table className="w-full text-xs text-left">
                     <thead className="bg-gray-200 text-gray-700 font-bold uppercase"><tr><th className="px-4 py-2">დამკვეთი</th><th className="px-4 py-2">კონტრაქტი N</th><th className="px-4 py-2 text-right">ღირებულება</th><th className="px-4 py-2">შეწყვეტის თარიღი</th><th className="px-4 py-2">კომენტარი</th></tr></thead>
                     <tbody className="divide-y divide-gray-100">{terminatedServices.map(s => (<tr key={s.id}><td className="px-4 py-2 font-bold">{s.clientName}</td><td className="px-4 py-2">{s.contractNumber}</td><td className="px-4 py-2 text-right font-mono">{formatNumber(s.value)} {s.currency}</td><td className="px-4 py-2">{s.terminationDate ? new Date(s.terminationDate).toLocaleDateString('ka-GE') : '-'}</td><td className="px-4 py-2 text-gray-600 italic whitespace-normal max-w-xs">{s.terminationReason}</td></tr>))}</tbody>
                 </table></div></div>)}
            </div>
        </>
    );
};
// --- END: Service Module Component ---

// --- START: Parts Module Component (PROMPT 6.8-005) ---

interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (part: Omit<PartRevenue, 'id' | 'status'> | PartRevenue) => void;
  initialData: Omit<PartRevenue, 'id' | 'status'> | PartRevenue | null;
}

const PartModal: React.FC<PartModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Omit<PartRevenue, 'id' | 'status'>>({
    clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 2, contractNumber: '', productType: 'ნაწილი', brand: '', product: '',
    unit: 'ცალი', floorsOrStops: 0, quantity: 1, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      const { status, ...rest } = initialData as PartRevenue;
      setFormData({ ...rest, contractDate: new Date(initialData.contractDate).toISOString().split('T')[0] });
    } else {
      setFormData({
        clientName: '', contractDate: new Date().toISOString().split('T')[0], durationInWeeks: 2, contractNumber: '', productType: 'ნაწილი', brand: '', product: '',
        unit: 'ცალი', floorsOrStops: 0, quantity: 1, value: 0, currency: Currency.GEL, totalReceived: 0, tranches: [{ id: `tr_${Date.now()}`, percentage: 100, month: 0, year: CURRENT_YEAR }],
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Omit<PartRevenue, 'id'| 'status'>, value: any) => { setFormData(prev => ({ ...prev, [field]: value })); };
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
  const addTranche = () => { if (formData.tranches.length < 4) { setFormData(prev => ({...prev, tranches: [...prev.tranches, { id: `tr_${Date.now()}`, percentage: 0, month: 0, year: CURRENT_YEAR }]})); } };
  const removeTranche = (index: number) => { setFormData(prev => ({...prev, tranches: prev.tranches.filter((_, i) => i !== index)})); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
    if (Math.round(totalPercentage) !== 100) { setError(`ტრანშების ჯამური პროცენტი უნდა იყოს 100%. ამჟამად არის ${totalPercentage}%.`); return; }
    setError('');
    onSave(initialData ? { ...(initialData as PartRevenue), ...formData } : formData);
  };

  const analysis = useMemo(() => {
    const { value, quantity, floorsOrStops, durationInWeeks } = formData;
    const unitPrice = (value > 0 && quantity > 0) ? value / quantity : 0;
    const stopPrice = (value > 0 && floorsOrStops > 0) ? value / floorsOrStops : 0;
    const weeklyPrice = (value > 0 && durationInWeeks > 0) ? value / durationInWeeks : 0;
    const monthlyPrice = weeklyPrice * 4.33;
    return { unitPrice, stopPrice, weeklyPrice, monthlyPrice };
  }, [formData.value, formData.quantity, formData.floorsOrStops, formData.durationInWeeks]);

  if (!isOpen) return null;
  const totalPercentage = formData.tranches.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-700"><h3 className="font-bold text-lg">{initialData ? 'ნაწილის კორექტირება' : '+ ნაწილის დამატება'}</h3></div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="დამკვეთი" value={formData.clientName} onChange={e => handleChange('clientName', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="date" value={formData.contractDate} onChange={e => handleChange('contractDate', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="კონტრაქტი N" value={formData.contractNumber} onChange={e => handleChange('contractNumber', e.target.value)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="პროდუქციის ტიპი" value={formData.productType} onChange={e => handleChange('productType', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="ბრენდი" value={formData.brand} onChange={e => handleChange('brand', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="პროდუქცია" value={formData.product} onChange={e => handleChange('product', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="text" placeholder="ერთეული" value={formData.unit} onChange={e => handleChange('unit', e.target.value)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="ღირებულება" value={formData.value || ''} onChange={e => handleChange('value', parseFloat(e.target.value) || 0)} required className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <select value={formData.currency} onChange={e => handleChange('currency', e.target.value as Currency)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"><option value="GEL">GEL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
            <input type="number" placeholder="რაოდენობა" value={formData.quantity || ''} onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)} required min="1" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="სართული/გაჩერება" value={formData.floorsOrStops || ''} onChange={e => handleChange('floorsOrStops', parseInt(e.target.value) || 0)} required min="0" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="მიწოდების ვადა (კვირა)" value={formData.durationInWeeks || ''} onChange={e => handleChange('durationInWeeks', parseInt(e.target.value) || 1)} required min="1" className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <input type="number" placeholder="სულ მიღებული თანხა" value={formData.totalReceived || ''} onChange={e => handleChange('totalReceived', parseFloat(e.target.value) || 0)} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
          </div>
          <div className="space-y-2 pt-4 border-t border-gray-700"><label className="font-bold text-sm text-gray-300">ფასის ანალიზი</label><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[{l:'ერთეულის ღირ.',v:analysis.unitPrice},{l:'სართულის ღირ.',v:analysis.stopPrice},{l:'კვირის ღირ.',v:analysis.weeklyPrice},{l:'თვის ღირ.',v:analysis.monthlyPrice}].map(item=>(<div key={item.l} className="bg-gray-700/50 p-3 rounded-md text-center border border-gray-600"><div className="text-xs text-gray-400 uppercase">{item.l}</div><div className="font-bold text-lg font-mono">{formatNumber(item.v)}</div></div>))}</div></div>
          <div className="space-y-2 pt-4 border-t border-gray-700"><label className="font-bold text-sm text-gray-300">გადახდის გრაფიკი (ტრანშები)</label>{formData.tranches.map((tranche, index) => (<div key={tranche.id} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded-md"><input type="number" placeholder="%" value={tranche.percentage || ''} onChange={e => handleTrancheChange(index, 'percentage', parseFloat(e.target.value) || 0)} className="w-20 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded" max="100" min="0"/><select value={tranche.month} onChange={e => handleTrancheChange(index, 'month', parseInt(e.target.value))} className="flex-1 px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded">{MONTH_NAMES_GE.map((m, i) => <option key={i} value={i}>{m}</option>)}</select><select value={tranche.year} onChange={e => handleTrancheChange(index, 'year', parseInt(e.target.value))} className="px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded"><option>2025</option><option>2026</option><option>2027</option></select><button type="button" onClick={() => removeTranche(index)} disabled={formData.tranches.length === 1} className="p-2 text-red-400 disabled:opacity-50 hover:bg-gray-700 rounded"><Trash2 size={16}/></button></div>))}<div className="flex items-center justify-between"><button type="button" onClick={addTranche} disabled={formData.tranches.length >= 4} className="text-xs font-bold text-blue-400 disabled:opacity-50 hover:underline">+ ტრანშის დამატება</button><div className={`text-xs font-bold ${Math.round(totalPercentage) !== 100 ? 'text-red-400' : 'text-green-400'}`}>სულ: {totalPercentage}%</div></div></div>
          {error && <div className="text-red-400 text-sm p-3 bg-red-900/30 border border-red-500/50 rounded flex items-center gap-2"><AlertTriangle size={16}/>{error}</div>}
        </form>
        <div className="p-4 border-t border-gray-700 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 border border-gray-600 rounded font-bold text-sm hover:bg-gray-700">გაუქმება</button><button type="submit" form="modal-form" onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">შენახვა</button></div>
      </div>
    </div>
  );
};

export const RevenueParts: React.FC = () => {
    const [parts, setParts] = useState<PartRevenue[]>([]);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPart, setEditingPart] = useState<PartRevenue | null>(null);
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({ C: true, D: true, E: true });
    const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
    const [terminatingPart, setTerminatingPart] = useState<PartRevenue | null>(null);

    const fetchData = async () => { setLoading(true); const [data, currencyRates] = await Promise.all([getParts(), getCurrencyRates()]); setParts(data); setRates(currencyRates); setLoading(false); };
    useEffect(() => { fetchData(); }, []);
    
    const activeParts = useMemo(() => parts.filter(p => p.status === 'active'), [parts]);
    const terminatedParts = useMemo(() => parts.filter(p => p.status === 'terminated'), [parts]);

    const handleSavePart = async (data: Omit<PartRevenue, 'id' | 'status'> | PartRevenue) => { if ('id' in data) { await updatePart(data.id, data); } else { await addPart(data); } fetchData(); setIsModalOpen(false); };
    const handleOpenModal = (part: PartRevenue | null = null) => { setEditingPart(part); setIsModalOpen(true); };
    const handleConfirmTermination = async (date: string, reason: string) => { if (!terminatingPart) return; await terminatePart(terminatingPart.id, date, reason); setIsTerminationModalOpen(false); setTerminatingPart(null); fetchData(); };

    const toggleBlock = (block: string) => setCollapsedBlocks(prev => ({ ...prev, [block]: !prev[block] }));
    const getRate = (currency: Currency) => (currency === 'USD' ? rates.USD : currency === 'EUR' ? rates.EUR : 1);

    const processedParts = useMemo(() => activeParts.map(s => ({...s, priceAnalysisUnitPrice: (s.value > 0 && s.quantity > 0) ? s.value / s.quantity : 0, priceAnalysisFloorPrice: (s.value > 0 && s.floorsOrStops > 0) ? s.value / s.floorsOrStops : 0, priceAnalysisWeeklyPrice: (s.value > 0 && s.durationInWeeks > 0) ? s.value / s.durationInWeeks : 0, priceAnalysisMonthlyPrice: ((s.value > 0 && s.durationInWeeks > 0) ? s.value / s.durationInWeeks : 0) * 4.33 })), [activeParts]);
    const monthlyDistribution = useMemo(() => { const dist: Record<string, number[]> = {}; processedParts.forEach(p => { const monthly: number[] = Array(12).fill(0); const rate = getRate(p.currency); if (Array.isArray(p.tranches)) { p.tranches.forEach(t => { if (t.year === CURRENT_YEAR) { monthly[t.month] += p.value * (t.percentage / 100) * rate; } }); } dist[p.id] = monthly; }); return dist; }, [processedParts, rates]);
    const totals = useMemo(() => { const totalGEL = processedParts.reduce((s, p) => s + p.value * getRate(p.currency), 0); const receivedGEL = processedParts.reduce((s, p) => s + p.totalReceived * getRate(p.currency), 0); const remainingGEL = totalGEL - receivedGEL; const totalQuantity = processedParts.reduce((s, p) => s + p.quantity, 0); const totalFloorsOrStops = processedParts.reduce((s, p) => s + p.floorsOrStops, 0); const monthlyTotals = Array(12).fill(0); Object.values(monthlyDistribution).forEach(mA => mA.forEach((a, i) => monthlyTotals[i] += a)); const totalUnitPrice = totalQuantity > 0 ? totalGEL / totalQuantity : 0; const totalStopPrice = totalFloorsOrStops > 0 ? totalGEL / totalFloorsOrStops : 0; const totalDuration = processedParts.reduce((s,p)=>s+p.durationInWeeks,0); const totalWeeklyPrice = totalDuration > 0 ? totalGEL / totalDuration : 0; const totalMonthlyPrice = totalWeeklyPrice * 4.33; return { totalGEL, receivedGEL, remainingGEL, totalQuantity, totalFloorsOrStops, monthlyTotals, totalUnitPrice, totalStopPrice, totalWeeklyPrice, totalMonthlyPrice }; }, [processedParts, rates, monthlyDistribution]);
    
    if (loading) return <div>იტვირთება ნაწილები...</div>;

    return (
        <>
            <PartModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSavePart} initialData={editingPart} />
            <TerminationModal isOpen={isTerminationModalOpen} onClose={() => setIsTerminationModalOpen(false)} onConfirm={handleConfirmTermination} />
            <div className="space-y-4">
                <div className="flex justify-between items-center"><h2 className="text-2xl font-bold flex items-center gap-3"><Package size={24}/> ნაწილები</h2><div className="flex gap-2"><button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm"><Plus size={16}/> + ნაწილის დამატება</button><button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm"><Download size={16}/> ექსპორტი</button></div></div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm" style={{maxHeight: '75vh'}}>
                    <table className="w-full text-xs text-left">
                        <thead className="sticky top-0 z-20"><tr className="bg-amber-100 text-amber-800 font-bold uppercase">{['A. დეტალიზაცია','B. გრაფიკი','E. ფასის ანალიზი','C. ანალიზი',`D. შემოსავალი (${CURRENT_YEAR})`].map((h, i)=>(<th key={h} className={`px-2 py-1.5 ${i > 0 && 'border-l border-amber-200'}`} colSpan={i === 0 ? 11 : i === 3 ? 4 : i === 4 ? 12 : i === 2 ? 1 : 4}><button onClick={()=>toggleBlock(h[0])} className="flex items-center gap-1 w-full text-xs">{h} {collapsedBlocks[h[0]]?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button></th>))}<th className="bg-amber-100"></th></tr><tr className="bg-sky-100 text-sky-800 font-bold uppercase"><th className="px-2 py-1 sticky left-0 bg-sky-100 z-30">დამკვეთი</th>{!collapsedBlocks['A']&&<><th className="px-2 py-1">გაფ. თარიღი</th><th className="px-2 py-1">კონტრაქტი N</th><th className="px-2 py-1">პროდ. ტიპი</th><th className="px-2 py-1">ბრენდი</th><th className="px-2 py-1">პროდუქცია</th><th className="px-2 py-1">ერთ.</th><th className="px-2 py-1">რაოდ.</th><th className="px-2 py-1 text-right">ღირებულება</th><th className="px-2 py-1">ვალუტა</th><th className="px-2 py-1">სართ/გაჩერება</th></>}{!collapsedBlocks['B']&&<><th className="px-2 py-1 text-center border-l border-sky-200">I %</th><th className="px-2 py-1 text-center">II %</th><th className="px-2 py-1 text-center">III %</th><th className="px-2 py-1 text-center">IV %</th></>}{!collapsedBlocks['E']&&<><th className="px-2 py-1 text-right border-l border-sky-200">ერთ. ღირ.</th></>}{!collapsedBlocks['C']&&<><th className="px-2 py-1 text-right border-l border-sky-200">სულ მისაღები</th><th className="px-2 py-1 text-right">სულ მიღებული</th><th className="px-2 py-1 text-right">დარჩენილი (GEL)</th><th className="px-2 py-1 w-28">დარჩენილი %</th></>}{!collapsedBlocks['D']&&MONTH_NAMES_GE.map(m=><th key={m} className="px-2 py-1 text-right border-l border-sky-200 w-24">{m}</th>)}<th className="px-2 py-1 w-20"></th></tr></thead>
                        <tbody className="divide-y divide-gray-100">{processedParts.map(s => { const rate = getRate(s.currency); const totalGEL = s.value * rate; const receivedGEL = s.totalReceived * rate; const remainingGEL = totalGEL - receivedGEL; const remainingPct = totalGEL > 0 ? (remainingGEL / totalGEL) * 100 : 0; return (<tr key={s.id} className="hover:bg-blue-50/50"><td className="px-2 py-1.5 font-bold sticky left-0 bg-white hover:bg-blue-50/50 z-10">{s.clientName}</td>{!collapsedBlocks['A'] && <><td className="px-2 py-1.5">{new Date(s.contractDate).toLocaleDateString()}</td><td className="px-2 py-1.5">{s.contractNumber}</td><td>{s.productType}</td><td>{s.brand}</td><td>{s.product}</td><td>{s.unit}</td><td className="px-2 py-1.5 text-center font-mono">{s.quantity}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(s.value)}</td><td className="px-2 py-1.5">{s.currency}</td><td className="px-2 py-1.5 text-center font-mono">{s.floorsOrStops}</td></>}{!collapsedBlocks['B'] && <>{[0, 1, 2, 3].map(i => <td key={i} className={`px-2 py-1.5 text-center font-mono ${i===0?'border-l':''}`}>{s.tranches[i] ? `${s.tranches[i].percentage}%` : '-'}</td>)}</>}{!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(s.priceAnalysisUnitPrice)}</td></>}{!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono text-green-600">{formatNumber(receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono font-bold text-red-600">{formatNumber(remainingGEL)}</td><td className="px-2 py-1.5"><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-600 h-2.5 rounded-full" style={{width: `${100-remainingPct}%`}}></div></div></td></>}{!collapsedBlocks['D'] && monthlyDistribution[s.id].map((amount, i) => <td key={i} className="px-2 py-1.5 text-right font-mono border-l">{amount > 0 ? formatNumber(amount) : '-'}</td>)}<td className="px-2 py-1.5 text-center"><button onClick={() => handleOpenModal(s)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={14}/></button><button onClick={() => { setTerminatingPart(s); setIsTerminationModalOpen(true); }} className="p-1 text-red-500 hover:bg-red-100 rounded ml-1"><Trash2 size={14}/></button></td></tr>);})}</tbody>
                        <tfoot className="sticky bottom-0 z-20"><tr className="bg-gray-200 text-black font-bold"><td className="px-2 py-1.5 sticky left-0 bg-gray-200 z-30">ჯამი:</td>{!collapsedBlocks['A'] && <><td colSpan={6}></td><td className="px-2 py-1.5 text-center font-mono">{totals.totalQuantity}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.totalGEL)}</td><td>GEL</td><td className="px-2 py-1.5 text-center font-mono">{totals.totalFloorsOrStops}</td></>}{!collapsedBlocks['B'] && <td colSpan={4} className="border-l"></td>}{!collapsedBlocks['E'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalUnitPrice)}</td></>}{!collapsedBlocks['C'] && <><td className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(totals.totalGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.receivedGEL)}</td><td className="px-2 py-1.5 text-right font-mono">{formatNumber(totals.remainingGEL)}</td><td></td></>}{!collapsedBlocks['D'] && totals.monthlyTotals.map((total, i) => (<td key={i} className="px-2 py-1.5 text-right font-mono border-l">{formatNumber(total)}</td>))}<td></td></tr></tfoot>
                    </table>
                </div>
                {terminatedParts.length > 0 && (<div className="mt-8 space-y-4"><h3 className="text-xl font-bold flex items-center gap-3"><Archive size={20}/> არქივი: შეწყვეტილი ჩანაწერები</h3><div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm"><table className="w-full text-xs text-left">
                     <thead className="bg-gray-200 text-gray-700 font-bold uppercase"><tr><th className="px-4 py-2">დამკვეთი</th><th className="px-4 py-2">კონტრაქტი N</th><th className="px-4 py-2 text-right">ღირებულება</th><th className="px-4 py-2">შეწყვეტის თარიღი</th><th className="px-4 py-2">კომენტარი</th></tr></thead>
                     <tbody className="divide-y divide-gray-100">{terminatedParts.map(p => (<tr key={p.id}><td className="px-4 py-2 font-bold">{p.clientName}</td><td className="px-4 py-2">{p.contractNumber}</td><td className="px-4 py-2 text-right font-mono">{formatNumber(p.value)} {p.currency}</td><td className="px-4 py-2">{p.terminationDate ? new Date(p.terminationDate).toLocaleDateString('ka-GE') : '-'}</td><td className="px-4 py-2 text-gray-600 italic whitespace-normal max-w-xs">{p.terminationReason}</td></tr>))}</tbody>
                </table></div></div>)}
            </div>
        </>
    );
};
// --- END: Parts Module Component ---


interface RevenueAnalysisProps {
  category: 'პროექტები' | 'სერვისი' | 'ნაწილები';
}

export const RevenueAnalysis: React.FC<RevenueAnalysisProps> = ({ category }) => {
  
  if (category === 'პროექტები') {
    return <RevenueProjects />;
  }

  if (category === 'სერვისი') {
    return <RevenueService />;
  }
  
  if (category === 'ნაწილები') {
    return <RevenueParts />;
  }

  // Fallback, should not be reached with current routing
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-black pb-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight uppercase flex items-center gap-3">
            <BarChart2 size={28} />
            {category}
          </h2>
          <p className="text-gray-500 font-bold mt-1">იზოლირებული შემოსავლების ანალიზის მოდული</p>
        </div>
      </div>
      <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 min-h-[400px] flex flex-col justify-center">
        <AlertTriangle size={32} className="mx-auto text-yellow-500 mb-4" />
        <h3 className="text-xl font-bold text-black">მოდული "{category}" ვერ მოიძებნა</h3>
      </div>
    </div>
  );
};