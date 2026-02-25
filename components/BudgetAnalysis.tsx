import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../types';
import { getAnnualBudget, getBudgetAnalysisComments, updateBudgetAnalysisComment } from '../services/mockService';
import { Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface BudgetAnalysisProps {
  user: User;
}

interface ComparisonItem {
  id: string;
  name: string;
  type: 'revenue' | 'expense';
  category: string;
  budget2025: number;
  budget2026: number;
  difference: number;
  percentage: number;
}

const getChangeColor = (change: number, itemType: 'revenue' | 'expense' | 'net') => {
    if (change === 0 || !isFinite(change)) return 'text-gray-500';
    if (itemType === 'revenue' || itemType === 'net') {
        return change > 0 ? 'text-green-600' : 'text-red-600';
    }
    // For expense
    return change > 0 ? 'text-red-600' : 'text-green-600';
};

export const BudgetAnalysis: React.FC<BudgetAnalysisProps> = ({ user }) => {
  const [comparisonData, setComparisonData] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [data2025, data2026, savedComments] = await Promise.all([
        getAnnualBudget(2025),
        getAnnualBudget(2026),
        getBudgetAnalysisComments(),
      ]);

      const data2025Map = new Map(data2025.map(item => [item.id, item]));

      const combinedData: ComparisonItem[] = data2026.map(item2026 => {
        const item2025 = data2025Map.get(item2026.id);
        const budget2025 = item2025?.plannedAmount || 0;
        const budget2026 = item2026.plannedAmount || 0;
        const difference = budget2026 - budget2025;
        const percentage = budget2025 !== 0 ? (difference / Math.abs(budget2025)) * 100 : (difference !== 0 ? 100 : 0);

        return {
          id: item2026.id,
          name: item2026.name,
          type: item2026.type,
          category: item2026.category,
          budget2025,
          budget2026,
          difference,
          percentage,
        };
      });

      setComparisonData(combinedData);
      setComments(savedComments);
      setLoading(false);
    };
    loadData();
  }, []);
  
  const handleCommentChange = (id: string, value: string) => {
    setComments(prev => ({ ...prev, [id]: value }));
  };

  const handleCommentSave = async (id: string) => {
    await updateBudgetAnalysisComment(id, comments[id] || '');
  };

  const processedData = useMemo(() => {
    const revenues = comparisonData.filter(item => item.type === 'revenue');
    const expenses = {
      Direct: comparisonData.filter(e => e.category === 'Direct'),
      Marginal: comparisonData.filter(e => e.category === 'Marginal'),
      Adjustable: comparisonData.filter(e => e.category === 'Adjustable'),
      Special: comparisonData.filter(e => e.category === 'Special'),
    };

    const calculateTotals = (items: ComparisonItem[]) => {
      return items.reduce((acc, item) => {
        acc.budget2025 += item.budget2025;
        acc.budget2026 += item.budget2026;
        return acc;
      }, { budget2025: 0, budget2026: 0 });
    };

    return {
      revenues,
      expenses,
      totals: {
        revenues: calculateTotals(revenues),
        direct: calculateTotals(expenses.Direct),
        marginal: calculateTotals(expenses.Marginal),
        adjustable: calculateTotals(expenses.Adjustable),
        special: calculateTotals(expenses.Special),
        allExpenses: calculateTotals(Object.values(expenses).flat()),
      }
    };
  }, [comparisonData]);

  const renderSection = (title: string, items: ComparisonItem[], sectionTotals: { budget2025: number; budget2026: number }, type: 'revenue' | 'expense') => (
    <>
      <tr className="bg-slate-200">
        <td colSpan={6} className="p-2 text-sm font-bold uppercase text-slate-800">{title}</td>
      </tr>
      {items.map(item => (
        <tr key={item.id} className="border-b border-gray-100">
          <td className="px-4 py-3 font-bold sticky left-0 bg-white">{item.name}</td>
          <td className="px-4 py-3 text-right font-mono">{formatNumber(item.budget2025)}</td>
          <td className="px-4 py-3 text-right font-mono">{formatNumber(item.budget2026)}</td>
          <td className={`px-4 py-3 text-right font-mono font-bold ${getChangeColor(item.difference, type)}`}>{formatNumber(item.difference)}</td>
          <td className={`px-4 py-3 text-right font-mono font-bold ${getChangeColor(item.percentage, type)}`}>
            {isFinite(item.percentage) ? `${item.percentage.toFixed(2)}%` : 'N/A'}
          </td>
          <td className="p-2 w-1/4">
            <textarea
              value={comments[item.id] || ''}
              onChange={(e) => handleCommentChange(item.id, e.target.value)}
              onBlur={() => handleCommentSave(item.id)}
              placeholder="კომენტარი..."
              className="w-full text-xs p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-black focus:border-black outline-none"
              rows={1}
            />
          </td>
        </tr>
      ))}
      {renderTotalsRow(`ჯამი: ${title}`, sectionTotals, type)}
    </>
  );

  const renderTotalsRow = (title: string, totals: { budget2025: number; budget2026: number }, type: 'revenue' | 'expense' | 'net', isGrandTotal = false) => {
    const difference = totals.budget2026 - totals.budget2025;
    const percentage = totals.budget2025 !== 0 ? (difference / Math.abs(totals.budget2025)) * 100 : (difference !== 0 ? 100 : 0);
    return (
      <tr className={`font-bold bg-gray-800 text-white ${isGrandTotal ? 'text-base' : 'text-sm'}`}>
        <td className="px-4 py-3 sticky left-0 bg-gray-800">{title}</td>
        <td className="px-4 py-3 text-right font-mono">{formatNumber(totals.budget2025)}</td>
        <td className="px-4 py-3 text-right font-mono">{formatNumber(totals.budget2026)}</td>
        <td className={`px-4 py-3 text-right font-mono ${getChangeColor(difference, type)}`}>{formatNumber(difference)}</td>
        <td className={`px-4 py-3 text-right font-mono ${getChangeColor(percentage, type)}`}>{isFinite(percentage) ? `${percentage.toFixed(2)}%` : 'N/A'}</td>
        <td className="p-2"></td>
      </tr>
    );
  };
  
  const netProfit2025 = processedData.totals.revenues.budget2025 - processedData.totals.allExpenses.budget2025;
  const netProfit2026 = processedData.totals.revenues.budget2026 - processedData.totals.allExpenses.budget2026;
  const netProfitTotals = { budget2025: netProfit2025, budget2026: netProfit2026 };

  if (loading) return <div className="p-12 text-center text-gray-400">ანალიზის მონაცემები იტვირთება...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-black pb-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded text-white bg-black"><Scale size={24} /></div>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight">ბიუჯეტის ანალიზი (2025 vs 2026)</h1>
            <p className="text-sm text-gray-500 font-medium">წლიური ბიუჯეტების შედარებითი ანალიზი</p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg shadow-sm overflow-auto" style={{ maxHeight: '75vh' }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100 text-gray-600">
            <tr className="whitespace-nowrap">
              <th className="px-4 py-3 text-left font-bold uppercase sticky left-0 bg-gray-100 z-20 w-1/4">დასახელება</th>
              <th className="px-4 py-3 text-right font-bold uppercase">ბიუჯეტი 2025 (ჯამი)</th>
              <th className="px-4 py-3 text-right font-bold uppercase">ბიუჯეტი 2026 (ჯამი)</th>
              <th className="px-4 py-3 text-right font-bold uppercase">ზრდა/კლება (₾)</th>
              <th className="px-4 py-3 text-right font-bold uppercase">ზრდა/კლება (%)</th>
              <th className="px-4 py-3 text-left font-bold uppercase w-1/4">ანალიზის ველი</th>
            </tr>
          </thead>
          <tbody>
            {renderSection('შემოსავლები', processedData.revenues, processedData.totals.revenues, 'revenue')}
            {renderSection('SECTION A: პირდაპირი ხარჯები', processedData.expenses.Direct, processedData.totals.direct, 'expense')}
            {renderSection('SECTION B: მარჟინალური ხარჯები', processedData.expenses.Marginal, processedData.totals.marginal, 'expense')}
            {renderSection('SECTION C: კორექტირებადი ხარჯები', processedData.expenses.Adjustable, processedData.totals.adjustable, 'expense')}
            {renderSection('SECTION D: განსაკუთრებული ფონდები', processedData.expenses.Special, processedData.totals.special, 'expense')}
          </tbody>
          <tfoot>
            {renderTotalsRow('სულ ხარჯი', processedData.totals.allExpenses, 'expense', true)}
            {renderTotalsRow('სუფთა მოგება', netProfitTotals, 'net', true)}
          </tfoot>
        </table>
      </div>
    </div>
  );
};
