
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../types';
import { getAnnualBudget, updateAnnualBudget, getHiddenFunds, toggleFundVisibility, toggleSectionVisibility } from '../services/mockService';
import { TrendingUp, History, Lock, Edit, CheckSquare, Eye, EyeOff } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface BudgetingProps {
  user: User;
  year: number;
}

type ViewMode = 'year' | 'quarter' | 'month';

const MONTH_NAMES = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const QUARTER_NAMES = ['Q1', 'Q2', 'Q3', 'Q4'];

// FIX: Allow 'net' type for variance color calculation, treating it like 'revenue'.
const getVarianceColor = (variancePercent: number, itemType: 'revenue' | 'expense' | 'net'): string => {
    if (isNaN(variancePercent) || !isFinite(variancePercent)) {
        return '';
    }
    
    let isGood = false;
    let isBad = false;

    if (itemType === 'revenue' || itemType === 'net') {
        if (variancePercent > 5) isGood = true;
        if (variancePercent < -5) isBad = true;
    } else { // 'expense'
        if (variancePercent < -5) isGood = true; // Less expense than budget is good
        if (variancePercent > 5) isBad = true;  // More expense than budget is bad
    }

    if (isGood) return 'bg-green-100 text-green-800';
    if (isBad) return 'bg-red-100 text-red-800';
    
    if (Math.abs(variancePercent) > 0) return 'bg-yellow-100 text-yellow-800';

    return '';
};


export const Budgeting: React.FC<BudgetingProps> = ({ user, year }) => {
  const [budgetData, setBudgetData] = useState<any[]>([]);
  const [previousYearData, setPreviousYearData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('year');
  const [hiddenFunds, setHiddenFunds] = useState<Record<string, boolean>>({});

  const isCurrentPlanningYear = year === new Date().getFullYear() + 1;
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const isTopLevel = [UserRole.FOUNDER, UserRole.CEO, UserRole.FIN_DIRECTOR].includes(user.role);

  useEffect(() => {
    const loadBudget = async () => {
      setLoading(true);
      const [currentData, prevData, hidden] = await Promise.all([
        getAnnualBudget(year),
        getAnnualBudget(year - 1),
        getHiddenFunds(),
      ]);

      // INJECT 2026 BUDGET OVERRIDES FROM SPREADSHEET IMAGE
      let processedCurrentData = currentData;
      if (year === 2026) {
          const overrides: Record<string, number[]> = {
            // Revenues
            'პროექტები': [1016972, 1283853, 1183968, 1318977, 1062561, 1205053, 1198042, 973303, 1328599, 1179809, 937000, 958897],
            'სერვისი': Array(12).fill(83333),
            'ნაწილები': Array(12).fill(18333),
            'სხვა': Array(12).fill(0),

            // Section A
            'პროექტის პირდაპირი ხარჯი': [654999, 826888, 762556, 849511, 684361, 776136, 771620, 626873, 855708, 759877, 603492, 617595],
            'სერვისის პირდაპირი ხარჯი': Array(12).fill(33192),
            'ნაწილები პირდაპირი ხარჯი': Array(12).fill(14667),

            // Section B
            'სახელფასო ფონდი - ადმინისტრაცია': Array(12).fill(37835),
            'სახელფასო ფონდი - კომერცია': Array(12).fill(46250),
            'სახელფასო ფონდი - სერვისი': Array(12).fill(56953),
            'სხვა საგადასახადო ვალდებულებები': [224592, 267293, 251311, 272913, 231886, 254685, 253563, 217605, 274452, 250646, 211796, 215300],
            'ყოველთვიური ფიქსირებული': Array(12).fill(10577),
            'ავტომობილების მოვლის და საწვავის': Array(12).fill(10325),
            'სწრაფცვეთადი მასალები': Array(12).fill(1812),

            // Section C
            'საბონუსე - ადმინისტრაცია': Array(12).fill(13333),
            'საბონუსე - კომერცია': Array(12).fill(27467),
            'საბონუსე - სერვისი': Array(12).fill(600),
            'საოფისე და ადმინისტრაციული': Array(12).fill(4111),
            'მივლინებები': Array(12).fill(1475),
            'რეკლამა და მარკეტინგის ფონდი': [5017, 5017, 5017, 8600, 7700, 10900, 4900, 4900, 61201, 8500, 5700, 9900],
            'ძირითადი საშუალებების': Array(12).fill(0),
            'წარმომადგენლობითი': Array(12).fill(3000),
            'სხვა ხარჯები': Array(12).fill(1140),

            // Section D
            'სარეზერვო ფონდი': [1647, 1647, 4527, 3106, 2537, 4563, 2039, 1714, 2900, 1633, 1633, 1633],
            'დამფუძნებლის ფონდი': [8235, 8235, 22636, 15528, 12683, 22815, 10195, 8572, 14498, 8167, 8167, 8167],
            'განვითარების ფონდი': Array(12).fill(32000)
          };

          processedCurrentData = currentData.map((item: any) => {
              if (overrides[item.name]) {
                  const monthlyValues = overrides[item.name];
                  const newMonthlyData = item.monthlyData.map((m: any, i: number) => ({
                      ...m,
                      plan: monthlyValues[i] !== undefined ? monthlyValues[i] : m.plan
                  }));
                  const newPlannedAmount = newMonthlyData.reduce((sum: number, m: any) => sum + m.plan, 0);
                  return { ...item, monthlyData: newMonthlyData, plannedAmount: newPlannedAmount };
              }
              return item;
          });
      }

      setBudgetData(processedCurrentData);
      setPreviousYearData(prevData);
      setHiddenFunds(hidden);
      setLoading(false);
    };
    loadBudget();
    setIsPlanningMode(false);
  }, [year]);
  
  const handleToggleFundVisibility = async (fundId: string) => {
    await toggleFundVisibility(fundId);
    setHiddenFunds(prev => ({ ...prev, [fundId]: !prev[fundId] }));
  };

  const handleToggleSectionVisibility = async (category: string) => {
    await toggleSectionVisibility(category); // This updates the central state
    const fundsInCategory = budgetData.filter(f => f.category === category || (category === 'Revenues' && f.type === 'revenue'));
    const areAllCurrentlyHidden = fundsInCategory.every(f => hiddenFunds[f.id]);
    const newHiddenState = { ...hiddenFunds };
    fundsInCategory.forEach(f => {
      newHiddenState[f.id] = !areAllCurrentlyHidden;
    });
    setHiddenFunds(newHiddenState);
  };

  const handlePlanChange = (itemId: string, monthIndex: number, newValue: number) => {
    setBudgetData(prevData => prevData.map(item => {
      if (item.id === itemId) {
        const newMonthlyData = [...item.monthlyData];
        newMonthlyData[monthIndex] = { ...newMonthlyData[monthIndex], plan: newValue };
        const newPlannedAmount = newMonthlyData.reduce((sum, m) => sum + m.plan, 0);
        return { ...item, monthlyData: newMonthlyData, plannedAmount: newPlannedAmount };
      }
      return item;
    }));
  };

  const handleSavePlan = async (itemId: string) => {
    const itemToSave = budgetData.find(item => item.id === itemId);
    if (itemToSave) {
      await updateAnnualBudget(year, itemId, itemToSave.plannedAmount);
    }
  };
  
  const periodHeaders = viewMode === 'month' ? MONTH_NAMES : viewMode === 'quarter' ? QUARTER_NAMES : ['წელი'];

  const processedDataAndTotals = useMemo(() => {
    const revenueItems = budgetData.filter(item => item.type === 'revenue');
    const expenseItems = budgetData.filter(item => item.type === 'expense');

    const calculateAnnualPlanTotal = (items: any[]) => items.reduce((sum, item) => sum + (item.plannedAmount || 0), 0);
    
    const totalRevenueAmount = calculateAnnualPlanTotal(revenueItems);
    const sectionTotalsMap = {
        Revenues: totalRevenueAmount,
        Direct: calculateAnnualPlanTotal(expenseItems.filter(e => e.category === 'Direct')),
        Marginal: calculateAnnualPlanTotal(expenseItems.filter(e => e.category === 'Marginal')),
        Adjustable: calculateAnnualPlanTotal(expenseItems.filter(e => e.category === 'Adjustable')),
        Special: calculateAnnualPlanTotal(expenseItems.filter(e => e.category === 'Special')),
    };

    const processItems = (items: any[]) => {
      if (!items) return [];
      return items.map(item => {
        const prevYearItem = previousYearData.find(py => py.id === item.id);
        let periods: any[] = [];

        if (viewMode === 'month') {
          periods = item.monthlyData;
        } else if (viewMode === 'quarter') {
          for (let i = 0; i < 4; i++) {
            const start = i * 3;
            const quarterMonths = item.monthlyData.slice(start, start + 3);
            periods.push({
              plan: quarterMonths.reduce((sum: number, m: any) => sum + m.plan, 0),
              fact: quarterMonths.reduce((sum: number, m: any) => sum + m.fact, 0),
            });
          }
        } else { // year
          periods.push({ plan: item.plannedAmount, fact: item.actualAmount });
        }
        
        const processedPeriods = periods.map(p => {
          const varianceAmount = p.fact - p.plan;
          const variancePercent = p.plan !== 0 ? (varianceAmount / Math.abs(p.plan)) * 100 : (p.fact > 0 ? 100 : 0);
          return { plan: p.plan, fact: p.fact, varianceAmount, variancePercent };
        });

        const totalVarianceAmount = item.actualAmount - item.plannedAmount;
        const totalVariancePercent = item.plannedAmount !== 0 ? (totalVarianceAmount / Math.abs(item.plannedAmount)) * 100 : (item.actualAmount > 0 ? 100 : 0);
        
        const shareOfRevenue = totalRevenueAmount !== 0 ? (Math.abs(item.plannedAmount) / totalRevenueAmount) * 100 : 0;
        const itemCategoryKey = item.type === 'revenue' ? 'Revenues' : item.category;
        const sectionTotalAmount = sectionTotalsMap[itemCategoryKey as keyof typeof sectionTotalsMap] || 0;
        const shareOfCategory = sectionTotalAmount !== 0 ? (Math.abs(item.plannedAmount) / sectionTotalAmount) * 100 : 0;

        return { ...item, periods: processedPeriods, totalVarianceAmount, totalVariancePercent, shareOfRevenue, shareOfCategory };
      });
    };

    const calculateTotals = (items: any[]) => {
      const totals = {
        periods: Array(periodHeaders.length).fill(0).map(() => ({ plan: 0, fact: 0, varianceAmount: 0 })),
        plannedAmount: 0,
        actualAmount: 0,
        totalVarianceAmount: 0,
        shareOfRevenue: 0,
      };
      items.forEach(item => {
        totals.plannedAmount += item.plannedAmount;
        totals.actualAmount += item.actualAmount;
        totals.shareOfRevenue += item.shareOfRevenue || 0;
        item.periods.forEach((p: any, i: number) => {
          totals.periods[i].plan += p.plan;
          totals.periods[i].fact += p.fact;
          totals.periods[i].varianceAmount += p.varianceAmount;
        });
      });
      totals.totalVarianceAmount = totals.actualAmount - totals.plannedAmount;
      return totals;
    };
    
    const processedRevenues = processItems(revenueItems);
    const processedExpenses = {
      Direct: processItems(expenseItems.filter(e => e.category === 'Direct')),
      Marginal: processItems(expenseItems.filter(e => e.category === 'Marginal')),
      Adjustable: processItems(expenseItems.filter(e => e.category === 'Adjustable')),
      Special: processItems(expenseItems.filter(e => e.category === 'Special')),
    };
    
    return {
      revenues: processedRevenues,
      expenses: processedExpenses,
      totals: {
        revenues: calculateTotals(processedRevenues),
        direct: calculateTotals(processedExpenses.Direct),
        marginal: calculateTotals(processedExpenses.Marginal),
        adjustable: calculateTotals(processedExpenses.Adjustable),
        special: calculateTotals(processedExpenses.Special),
        allExpenses: calculateTotals(Object.values(processedExpenses).flat()),
      }
    };
  }, [budgetData, previousYearData, viewMode]);

  const totalRevenueForRatios = processedDataAndTotals.totals.revenues.plannedAmount;

  const renderTotalsRow = (title: string, totals: any, type: 'revenue' | 'expense' | 'net', isGrandTotal: boolean = false) => {
    let plannedAmount = totals.plannedAmount;
    let actualAmount = totals.actualAmount;
    let totalVarianceAmount = totals.totalVarianceAmount;
    
    if (type === 'expense') {
      plannedAmount *= -1;
      actualAmount *= -1;
      totalVarianceAmount *= -1;
    }

    const totalVariancePercent = plannedAmount !== 0 ? ((actualAmount - plannedAmount) / Math.abs(plannedAmount)) * 100 : 0;
    
    let shareOfRevenueDisplay = '--';
    let shareOfCategoryDisplay = '--';

    if (title === 'ჯამი: შემოსავლები') {
        shareOfRevenueDisplay = '100.00%';
        shareOfCategoryDisplay = '100.00%';
    } else if (!isGrandTotal) {
        shareOfRevenueDisplay = `${(totals.shareOfRevenue || 0).toFixed(2)}%`;
        shareOfCategoryDisplay = '100.00%';
    } else if (totalRevenueForRatios > 0) {
        const ratio = (Math.abs(totals.plannedAmount) / totalRevenueForRatios) * 100;
        shareOfRevenueDisplay = `${ratio.toFixed(2)}%`;
    }

    return (
      <tr className={`whitespace-nowrap bg-gray-800 text-white font-bold ${isGrandTotal ? 'border-t-4 border-double border-gray-500' : 'border-t-2 border-gray-400'}`}>
        <td className="sticky left-0 z-10 p-3 whitespace-nowrap text-xs bg-gray-800">{title}</td>
        {totals.periods.map((p: any, i: number) => {
          let periodPlan = p.plan;
          let periodFact = p.fact;
          let periodVar = p.varianceAmount;
          if (type === 'expense') {
            periodPlan *= -1;
            periodFact *= -1;
            periodVar *= -1;
          }
          const periodVariancePercent = periodPlan !== 0 ? ((periodFact - periodPlan) / Math.abs(periodPlan)) * 100 : 0;
          return (
            <React.Fragment key={i}>
              <td className="p-3 text-right font-mono text-xs">{formatNumber(periodPlan)}</td>
              <td className="p-3 text-right font-mono text-xs">{formatNumber(periodFact)}</td>
              <td className="p-3 text-right font-mono text-xs">{formatNumber(periodVar)}</td>
              <td className={`p-3 text-right font-mono text-xs ${getVarianceColor(periodVariancePercent, type)}`}>{isFinite(periodVariancePercent) ? `${periodVariancePercent.toFixed(1)}%` : 'N/A'}</td>
            </React.Fragment>
          );
        })}
        <td className="p-3 text-right font-mono text-xs">{formatNumber(plannedAmount)}</td>
        <td className="p-3 text-right font-mono text-xs">{formatNumber(actualAmount)}</td>
        <td className="p-3 text-right font-mono text-xs">{formatNumber(totalVarianceAmount)}</td>
        <td className={`p-3 text-right font-mono text-xs ${getVarianceColor(totalVariancePercent, type)}`}>{isFinite(totalVariancePercent) ? `${totalVariancePercent.toFixed(1)}%` : 'N/A'}</td>
        <td className="p-3 text-right font-mono text-xs" style={{color: 'white'}}>{shareOfRevenueDisplay}</td>
        <td className="p-3 text-right font-mono text-xs" style={{color: 'white'}}>{shareOfCategoryDisplay}</td>
      </tr>
    );
  };
  
  const renderSection = (title: string, items: any[], sectionTotals: any, type: 'revenue' | 'expense', category: string) => {
    const isSectionHidden = items.every(f => hiddenFunds[f.id]);
    
    return (
      <>
        <tr className="bg-slate-200">
          <td colSpan={1 + periodHeaders.length * 4 + 4 + 2} className="p-2 text-sm font-bold uppercase text-slate-800">
            <div className="flex items-center gap-3">
              {isTopLevel && <button onClick={() => handleToggleSectionVisibility(category)}>{isSectionHidden ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
              {title}
            </div>
          </td>
        </tr>
        {items.filter(item => !hiddenFunds[item.id]).map((item, idx) => {
          let plannedAmount = item.plannedAmount;
          let actualAmount = item.actualAmount;
          let totalVarianceAmount = item.totalVarianceAmount;
          if (type === 'expense') {
              plannedAmount *= -1;
              actualAmount *= -1;
              totalVarianceAmount *= -1;
          }
          return (
            <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} whitespace-nowrap`}>
              <td className="sticky left-0 z-10 p-3 whitespace-nowrap text-xs bg-inherit">
                <div className="font-bold flex items-center gap-3">
                  {isTopLevel && <button onClick={() => handleToggleFundVisibility(item.id)}>{hiddenFunds[item.id] ? <EyeOff size={16} className="text-gray-400"/> : <Eye size={16}/>}</button>}
                  {item.name}
                </div>
              </td>
              {item.periods.map((p: any, i: number) => {
                let periodPlan = p.plan;
                let periodFact = p.fact;
                let periodVar = p.varianceAmount;
                if (type === 'expense') {
                    periodPlan *= -1;
                    periodFact *= -1;
                    periodVar *= -1;
                }
                return (
                  <React.Fragment key={i}>
                    <td className="p-3 text-right font-mono text-xs">{formatNumber(periodPlan)}</td>
                    <td className="p-3 text-right font-mono text-xs font-bold">{formatNumber(periodFact)}</td>
                    <td className="p-3 text-right font-mono text-xs">{formatNumber(periodVar)}</td>
                    <td className={`p-3 text-right font-mono text-xs font-bold ${getVarianceColor(p.variancePercent, type)}`}>{isFinite(p.variancePercent) ? `${p.variancePercent.toFixed(1)}%` : 'N/A'}</td>
                  </React.Fragment>
                )
              })}
              <td className="p-3 text-right font-mono text-xs">{formatNumber(plannedAmount)}</td>
              <td className="p-3 text-right font-mono text-xs font-bold">{formatNumber(actualAmount)}</td>
              <td className="p-3 text-right font-mono text-xs">{formatNumber(totalVarianceAmount)}</td>
              <td className={`p-3 text-right font-mono text-xs font-bold ${getVarianceColor(item.totalVariancePercent, type)}`}>{isFinite(item.totalVariancePercent) ? `${item.totalVariancePercent.toFixed(1)}%` : 'N/A'}</td>
              <td className="p-3 text-right font-mono text-xs" style={{color: '#00008B'}}>{isFinite(item.shareOfRevenue) ? item.shareOfRevenue.toFixed(2) : '0.00'}%</td>
              <td className="p-3 text-right font-mono text-xs" style={{color: '#00008B'}}>{isFinite(item.shareOfCategory) ? item.shareOfCategory.toFixed(2) : '0.00'}%</td>
            </tr>
          );
        })}
        {renderTotalsRow(`ჯამი: ${title}`, sectionTotals, type)}
      </>
    );
  };
  
  const netProfitTotals = useMemo(() => {
    const { revenues, allExpenses } = processedDataAndTotals.totals;
    const totals = {
      periods: Array(periodHeaders.length).fill(0).map(() => ({ plan: 0, fact: 0, varianceAmount: 0 })),
      plannedAmount: revenues.plannedAmount - allExpenses.plannedAmount,
      actualAmount: revenues.actualAmount - allExpenses.actualAmount,
      totalVarianceAmount: 0,
    };
    totals.periods.forEach((_, i) => {
      totals.periods[i].plan = revenues.periods[i].plan - allExpenses.periods[i].plan;
      totals.periods[i].fact = revenues.periods[i].fact - allExpenses.periods[i].fact;
      totals.periods[i].varianceAmount = totals.periods[i].fact - totals.periods[i].plan;
    });
    totals.totalVarianceAmount = totals.actualAmount - totals.plannedAmount;
    return totals;
  }, [processedDataAndTotals.totals, periodHeaders.length]);

  if (loading) return <div className="p-12 text-center text-gray-400">ბიუჯეტი იტვირთება...</div>;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center border-b border-black pb-4">
           <div className="flex items-center gap-4">
                <div className={`p-3 rounded text-white ${!isCurrentPlanningYear ? 'bg-gray-500' : 'bg-black'}`}>
                    {!isCurrentPlanningYear ? <History size={24} /> : <TrendingUp size={24} />}
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold uppercase tracking-tight">ბიუჯეტირება {year}</h1>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase ${!isCurrentPlanningYear ? 'bg-gray-400' : 'bg-green-600'}`}>
                        {!isCurrentPlanningYear ? 'არქივი' : 'აქტიური'}
                    </span>
                </div>
           </div>
           <div className="flex items-center gap-4">
                {isCurrentPlanningYear && (
                    <button 
                        onClick={() => setIsPlanningMode(!isPlanningMode)}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded border transition-colors ${
                            isPlanningMode ? 'bg-yellow-400 border-yellow-500 text-black' : 'bg-white border-gray-300'
                        }`}
                    >
                        {isPlanningMode ? <CheckSquare size={14} /> : <Edit size={14} />}
                        {isPlanningMode ? 'რეჟიმის დასრულება' : 'დაგეგმვის რეჟიმი'}
                    </button>
                )}
                <div className="flex gap-1 bg-gray-200 p-1 rounded-md">
                    {(['year', 'quarter', 'month'] as ViewMode[]).map(mode => (
                        <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-bold rounded ${viewMode === mode ? 'bg-white shadow' : 'text-gray-500'}`}>
                            {mode === 'year' ? 'წელი' : mode === 'quarter' ? 'კვარტალი' : 'თვე'}
                        </button>
                    ))}
                </div>
           </div>
      </div>
      
      <div className="border border-gray-200 rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-gray-100 text-gray-600">
                <tr className="whitespace-nowrap">
                    <th className="sticky left-0 z-30 bg-gray-100 p-2 text-xs font-bold uppercase w-64">კატეგორია</th>
                    {periodHeaders.map(h => (
                      <th key={h} className="p-2 text-xs font-bold uppercase text-center" colSpan={4}>{h}</th>
                    ))}
                    <th className="p-2 text-xs font-bold uppercase text-center" colSpan={4}>ჯამი {year}</th>
                    <th className="p-2 text-xs font-bold uppercase text-center whitespace-nowrap" style={{width: '120px'}}>წილი შემოსავლიდან %</th>
                    <th className="p-2 text-xs font-bold uppercase text-center whitespace-nowrap" style={{width: '120px'}}>წილი კატეგორიაში %</th>
                </tr>
                <tr className="whitespace-nowrap">
                    <th className="sticky left-0 z-30 bg-gray-100 p-2 text-xs font-bold"></th>
                    {[...periodHeaders, 'Total'].map(h => (
                        <React.Fragment key={`${h}-sub`}>
                            <th className="p-2 text-[10px] font-bold text-right">Budget</th>
                            <th className="p-2 text-[10px] font-bold text-right">Actual</th>
                            <th className="p-2 text-[10px] font-bold text-right">Var $</th>
                            <th className="p-2 text-[10px] font-bold text-right">Var %</th>
                        </React.Fragment>
                    ))}
                    <th className="p-2 text-[10px] font-bold"></th>
                    <th className="p-2 text-[10px] font-bold"></th>
                </tr>
            </thead>
            <tbody>
              {renderSection('შემოსავლები', processedDataAndTotals.revenues, processedDataAndTotals.totals.revenues, 'revenue', 'Revenues')}
              {renderSection('SECTION A: პირდაპირი ხარჯები', processedDataAndTotals.expenses.Direct, processedDataAndTotals.totals.direct, 'expense', 'Direct')}
              {renderSection('SECTION B: მარჟინალური ხარჯები', processedDataAndTotals.expenses.Marginal, processedDataAndTotals.totals.marginal, 'expense', 'Marginal')}
              {renderSection('SECTION C: კორექტირებადი ხარჯები', processedDataAndTotals.expenses.Adjustable, processedDataAndTotals.totals.adjustable, 'expense', 'Adjustable')}
              {renderSection('SECTION D: განსაკუთრებული ფონდები', processedDataAndTotals.expenses.Special, processedDataAndTotals.totals.special, 'expense', 'Special')}
            </tbody>
            <tfoot>
              {renderTotalsRow('სულ ხარჯი', processedDataAndTotals.totals.allExpenses, 'expense', true)}
              {renderTotalsRow('სუფთა მოგება', netProfitTotals, 'net', true)}
            </tfoot>
        </table>
      </div>
    </div>
  );
};
