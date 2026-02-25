import React, { useState, useEffect, useMemo } from 'react';
// FIX: Import FundBalance from types.ts directly
import { User, UserRole, ExpenseRequest, RequestStatus, BankAccount, RevenueCategory, MasterReportData, DebtRecord, FundBalance } from '../types';
import { 
  getFundDistributionRules, 
  getFdFinalRequests, 
  getDispatchedRequests, 
  updateRequestStatus, 
  getBankAccounts,
  getRevenueCategories,
  updateBankAccountDetails,
  addManualBankAccount,
  validateBankAccountRules,
  getRealTimeFundBalances, 
  getExpenseFunds,
  syncBankAccounts,
  updateBankAccountSyncStatus,
  getFinancialCouncilSessions, 
  FinancialSession, 
  getMatrixDataForDate,
  getDebtors,
  getCreditors,
  generateAIReportSummary, // PROMPT 6.3-003
  getAllRequests, // PROMPT 6.3-008
  getInflationRate, // PROMPT 6.3-015
  getAnnualBudget, // PROMPT 7.4 - 001
} from '../services/mockService';
import { DirectorApprovals } from './DirectorApprovals';
import { DebtManagementView } from './DebtManagementView';
import { 
  Gavel, 
  ChevronRight, 
  PieChart, 
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Link as LinkIcon,
  Plus,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Save,
  X,
  Send,
  Layers,
  Clock,
  BarChart2,
  PieChart as PieChartIcon,
  AlertTriangle,
  Wallet,
  Archive,
  Calendar,
  Lock,
  Filter,
  ChevronDown,
  Download,
  ArrowLeftRight,
  BrainCircuit, // PROMPT 6.3-003
  FileEdit,
  Sparkles,
  FileDown,
  Printer,
  Info, // PROMPT 6.3-015
  // FIX: Import missing lucide-react icons
  Check,
  CornerUpLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { exportGenericToExcel, exportMultiSheetExcel } from '../utils/excelExport';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../utils/formatters';

interface FinancialCouncilProps {
  user: User;
}

const STEPS = [
  "არქივი",               // 0
  "ანგარიშების მართვა",   // 1
  "ფონდების მატრიცა",     // 2
  "ხარჯვის მოთხოვნების განხილვა", // 3
  "კომერცია & მარკეტინგი", // 4
  "მუშაობა დავალიანებებთან (დებიტორი/კრედიტორი)", // 5
  "სერვისი & ექსპლუატაცია",// 6
  "შესყიდვები & ნაწილები", // 7
  "სახელფასო ფონდი",      // 8
  "გადასახადები",         // 9
  "სარეზერვო & სხვა",     // 10
  "FD საბოლოო დასტური",   // 11
  "ბუღალტერიაში გადაცემა", // 12
  "საბჭოს დახურვა",       // 13
];

const MONTHS = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
];

// PROMPT 6.3-009: Timestamp formatting helper
const formatTimestamp = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const FinancialCouncil: React.FC<FinancialCouncilProps> = ({ user }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [fundRules, setFundRules] = useState<any[]>([]); 
  const [realTimeBalances, setRealTimeBalances] = useState<FundBalance[]>([]); 
  const [expenseFunds, setExpenseFunds] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [sessions, setSessions] = useState<FinancialSession[]>([]);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear());
  const [archiveMonth, setArchiveMonth] = useState<string>(''); 
  const [groupByMonth, setGroupByMonth] = useState<boolean>(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BankAccount>>({});
  const [editError, setEditError] = useState<string | null>(null);

  const [finalRequests, setFinalRequests] = useState<ExpenseRequest[]>([]);
  const [dispatchedHistory, setDispatchedHistory] = useState<ExpenseRequest[]>([]); 
  
  const [debtors, setDebtors] = useState<DebtRecord[]>([]);
  const [creditors, setCreditors] = useState<DebtRecord[]>([]);

  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const [isReportGenerated, setIsReportGenerated] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  
  const [aiConclusion, setAiConclusion] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiEditable, setIsAiEditable] = useState(false);
  const [isConclusionConfirmed, setIsConclusionConfirmed] = useState(false);

  const [completionTimestamp, setCompletionTimestamp] = useState<Date | null>(null);

  const [inflation, setInflation] = useState(0);

  // PROMPT 7.2-003: Visibility state
  const [hiddenFunds, setHiddenFunds] = useState<Record<string, boolean>>({});

  const isFinDirector = user.role === UserRole.FIN_DIRECTOR;
  const isTopLevel = user.role === UserRole.FOUNDER || user.role === UserRole.FIN_DIRECTOR || user.role === UserRole.CEO;
  
  const calculatedRevenue = useMemo(() => {
    return revenueCategories.map(cat => {
      const total = bankAccounts.filter(b => b.mappedCategoryId === cat.id).reduce((sum, b) => sum + b.currentBalance, 0);
      return { ...cat, actualAmount: total };
    });
  }, [revenueCategories, bankAccounts]);
  
  const totalActualRevenue = useMemo(() => {
    return calculatedRevenue.reduce((sum, c) => sum + (c.actualAmount || 0), 0);
  }, [calculatedRevenue]);


  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const [
        banks, cats, initialRules, funds, sessList, inflationRate, budget2026Data
      ] = await Promise.all([
        getBankAccounts(),
        getRevenueCategories(),
        getFundDistributionRules(),
        getExpenseFunds(),
        getFinancialCouncilSessions(),
        getInflationRate(),
        getAnnualBudget(2026)
      ]);
      
      let balances: FundBalance[] = [];
      if (selectedSessionDate && (currentStep === 2 || (currentStep >= 3 && currentStep <= 10))) {
          balances = await getMatrixDataForDate(selectedSessionDate);
      } else {
          balances = await getRealTimeFundBalances();
      }

      const totalRevenue2026 = budget2026Data
          .filter((item: any) => item.type === 'revenue')
          .reduce((sum, item) => sum + (item.plannedAmount || 0), 0);
      
      const budget2026MapByName = new Map(budget2026Data.map((item: any) => [item.name, item]));

      const updatedRules = funds.map((fund: any) => {
        const budgetItem = budget2026MapByName.get(fund.name); // STRICT NAME MATCH
        
        let percentage = 0;
        let syncStatus = '⚠️';
        let nameMismatch = false;

        if (budgetItem) {
            if (totalRevenue2026 > 0) {
                percentage = (Math.abs(budgetItem.plannedAmount) / totalRevenue2026) * 100;
            }
            syncStatus = '✅';
        } else {
            nameMismatch = true; // Set flag
            syncStatus = '❌';
        }
        
        const initialFact = balances.find(b => b.id === fund.id)?.totalSpent || 0;

        return { 
          id: fund.id, 
          name: fund.name, 
          percentage, 
          planAmount: fund.category === 'Direct' ? (budgetItem?.plannedAmount || 0) : 0,
          syncStatus,
          nameMismatch,
          manualFactAmount: initialFact
        };
      });
      setFundRules(updatedRules);

      setBankAccounts(banks);
      setRevenueCategories(cats);
      setExpenseFunds(funds);
      setRealTimeBalances(balances);
      setSessions(sessList);
      setInflation(inflationRate);
      
      if (sessList.length > 0) {
          const firstDate = new Date(sessList[0].dateConducted);
          const key = `${MONTHS[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
          setExpandedMonths(prev => ({ ...prev, [key]: true }));
      }

      setLoading(false);
    };
    init();
  }, [currentStep, selectedSessionDate]); 

  useEffect(() => {
    if (currentStep === 11) { 
      const fetchFinal = async () => {
        const data = await getFdFinalRequests();
        setFinalRequests(data);
      };
      fetchFinal();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 12 || currentStep === 13) { 
      const fetchStep12Data = async () => {
        const dispatched = await getDispatchedRequests();
        setDispatchedHistory(dispatched);
      };
      fetchStep12Data();
    }
  }, [currentStep]);
  
  const handleGenerateReport = async () => {
    setIsReportLoading(true);
    setIsReportGenerated(false);
    setAiConclusion("");
    setIsAiEditable(false);
    setIsConclusionConfirmed(false);
    setCompletionTimestamp(null);

    const [revenues, funds, fetchedDebtors, fetchedCreditors, allRequests] = await Promise.all([
      getRevenueCategories(),
      getRealTimeFundBalances(),
      getDebtors(),
      getCreditors(),
      getAllRequests()
    ]);
    
    setDebtors(fetchedDebtors);
    setCreditors(fetchedCreditors);

    const expenseAnalysis = allRequests.reduce((acc, req) => {
        const dept = req.department;
        if (!acc[dept]) {
            acc[dept] = { department: dept, totalRequested: 0, totalApproved: 0, requestCount: 0 };
        }
        acc[dept].requestCount++;
        acc[dept].totalRequested += req.totalAmount;

        if ([RequestStatus.DISPATCHED_TO_ACCOUNTING, RequestStatus.PAID, RequestStatus.APPROVED_FOR_PAYMENT].includes(req.status)) {
            acc[dept].totalApproved += req.totalAmount;
        }
        return acc;
    }, {} as Record<string, { department: string; totalRequested: number; totalApproved: number; requestCount: number; }>);


    const consolidatedData: MasterReportData = {
      revenues: revenues,
      funds: funds,
      expenseAnalysis: Object.values(expenseAnalysis),
      debtors: fetchedDebtors,
      creditors: fetchedCreditors,
      debtAnalysis: {
        debtors: fetchedDebtors.reduce((acc, d) => ({ increase: acc.increase + d.increase, decrease: acc.decrease + d.decrease, currentBalance: acc.currentBalance + d.currentBalance }), { increase: 0, decrease: 0, currentBalance: 0 }),
        creditors: fetchedCreditors.reduce((acc, c) => ({ increase: acc.increase + c.increase, decrease: acc.decrease + c.decrease, currentBalance: acc.currentBalance + c.currentBalance }), { increase: 0, decrease: 0, currentBalance: 0 })
      }
    };
    setReportData(consolidatedData);

    setIsAiLoading(true);
    const summary = await generateAIReportSummary(consolidatedData);
    setAiConclusion(summary);
    setIsAiLoading(false);

    setIsReportGenerated(true);
    setIsReportLoading(false);
  };
  
  const handleRegenerateAI = async () => {
    if (!reportData) return;
    setIsAiLoading(true);
    const summary = await generateAIReportSummary(reportData);
    setAiConclusion(summary);
    setIsAiLoading(false);
  };
  
  const handlePrint = () => { window.print(); };

  const handleFinalizeReport = () => {
    setCompletionTimestamp(new Date());
    setIsConclusionConfirmed(true); 
  };
  
  const handleMultiExport = () => {
    if (!reportData) return;
    const { revenues, funds, expenseAnalysis, debtAnalysis } = reportData;

    const summaryData: Array<{ Category: string; Amount: string | number }> = [
      { Category: 'Total Revenue', Amount: revenues.reduce((s, r) => s + (r.actualAmount || 0), 0) },
      { Category: 'Total Approved Expenses', Amount: expenseAnalysis.reduce((s, e) => s + e.totalApproved, 0) },
      { Category: 'Debtor Balance', Amount: debtAnalysis.debtors.currentBalance },
      { Category: 'Creditor Balance', Amount: debtAnalysis.creditors.currentBalance },
    ];
    
    if (completionTimestamp) {
        summaryData.push({ Category: 'ანგარიში დადასტურებულია', Amount: formatTimestamp(completionTimestamp) });
    }
    
    const sheets = [
        { data: summaryData, headers: { Category: 'პუნქტი', Amount: 'თანხა' }, sheetName: 'შემაჯამებელი' },
        { 
            data: expenseAnalysis, 
            headers: { 
                department: 'დეპარტამენტი', 
                requestCount: 'მოთხოვნების რაოდენობა', 
                totalRequested: 'მოთხოვნილი თანხა',
                totalApproved: 'დამტკიცებული თანხა' 
            }, 
            sheetName: 'ხარჯების ანალიზი' 
        },
        { data: [...debtors, ...creditors], headers: { name: 'დასახელება', previousBalance: 'საწყისი ნაშთი', increase: 'ზრდა', decrease: 'კლება', currentBalance: 'საბოლოო ნაშთი' }, sheetName: 'დავალიანებები' },
        { data: funds, headers: { name: 'ფონდი', totalAllocated: 'გამოყოფილი', totalSpent: 'დახარჯული', remaining: 'ნაშთი' }, sheetName: 'ფონდების მატრიცა' },
    ];

    exportMultiSheetExcel(sheets, 'Board_Closure_Report');
  };

  const filteredSessions = useMemo(() => {
      return sessions.filter(s => {
          const date = new Date(s.dateConducted);
          const matchesYear = date.getFullYear() === archiveYear;
          const matchesMonth = archiveMonth === '' || MONTHS[date.getMonth()] === archiveMonth;
          return matchesYear && matchesMonth;
      });
  }, [sessions, archiveYear, archiveMonth]);

  const groupedSessions = useMemo(() => {
      if (!groupByMonth) return null;
      
      const groups: Record<string, FinancialSession[]> = {};
      filteredSessions.forEach(s => {
          const date = new Date(s.dateConducted);
          const key = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
      });
      return groups; 
  }, [filteredSessions, groupByMonth]);

  const toggleMonthExpand = (key: string) => {
      setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const handleStartNewSession = () => {
      setSelectedSessionDate(null); 
      setCurrentStep(1); 
  };

  const handleOpenArchive = (dateStr: string) => {
      setSelectedSessionDate(dateStr);
      setCurrentStep(2); 
  };

  const handleBankSync = async () => {
    setIsSyncing(true);
    const updated = await syncBankAccounts();
    setBankAccounts(updated);
    setTimeout(() => setIsSyncing(false), 800);
  };

  const handleToggleSync = async (accountId: string, currentValue: boolean) => {
    await updateBankAccountSyncStatus(accountId, !currentValue);
    const updated = await getBankAccounts();
    setBankAccounts(updated);
  };

  const handleAddManualAccount = async () => {
    const newAcc = await addManualBankAccount();
    const updated = await getBankAccounts();
    setBankAccounts(updated);
    handleStartEdit(newAcc);
  };

  const handleStartEdit = (account: BankAccount) => {
      setEditingId(account.id);
      setEditForm({ ...account });
      setEditError(null);
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setEditForm({});
      setEditError(null);
  };

  const handleEditChange = (field: keyof BankAccount, value: any) => {
      setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
      if (!editingId) return;
      const error = await validateBankAccountRules(editForm, editingId);
      if (error) { setEditError(error); return; }
      await updateBankAccountDetails(editingId, editForm);
      const updated = await getBankAccounts();
      setBankAccounts(updated);
      handleCancelEdit();
  };

  const totalPlannedRevenue = revenueCategories.reduce((sum, c) => sum + c.plannedAmount, 0); 
  const unmappedTotal = bankAccounts.filter(b => !b.mappedCategoryId).reduce((sum, b) => sum + b.currentBalance, 0);
  const revenueVariance = totalActualRevenue - totalPlannedRevenue;
  const revenueVariancePct = totalPlannedRevenue > 0 ? (revenueVariance / totalPlannedRevenue) * 100 : 0;

  const handleMatrixChange = (id: string, value: number) => {
    if (selectedSessionDate) return;

    setFundRules(prev =>
      prev.map(rule => {
        const fund = expenseFunds.find((f: any) => f.id === rule.id);
        if (rule.id === id && fund?.category === 'Direct') { // Guard condition for Section A
            return { ...rule, planAmount: isNaN(value) ? 0 : value };
        }
        return rule;
      })
    );
  };
  
  const handleFactChange = (id: string, value: number) => {
    if (selectedSessionDate) return;
    setFundRules(prev =>
      prev.map(rule =>
        rule.id === id ? { ...rule, manualFactAmount: isNaN(value) ? 0 : value } : rule
      )
    );
  };

  const toggleFundVisibility = (fundId: string) => setHiddenFunds(prev => ({ ...prev, [fundId]: !prev[fundId] }));
  const toggleSectionVisibility = (category: string) => {
      const fundsInCategory = expenseFunds.filter((f: any) => f.category === category);
      const areAllHidden = fundsInCategory.every((f: any) => hiddenFunds[f.id]);
      const newHiddenState = { ...hiddenFunds };
      fundsInCategory.forEach((f: any) => { newHiddenState[f.id] = !areAllHidden; });
      setHiddenFunds(newHiddenState);
  };
  
  const weeklyTotalRevenue = useMemo(() => {
    if (selectedSessionDate) {
        const session = sessions.find(s => s.dateConducted === selectedSessionDate);
        return session ? session.totalRevenue : 0;
    }
    return totalActualRevenue;
  }, [selectedSessionDate, sessions, totalActualRevenue]);

  const groupedFunds = useMemo(() => {
      const groups = { Direct: [] as any[], Marginal: [] as any[], Adjustable: [] as any[], Special: [] as any[] };
      expenseFunds.forEach((fund: any) => {
          const rule = fundRules.find((r: any) => r.id === fund.id) || { percentage: 0, planAmount: 0, syncStatus: '⚠️', nameMismatch: true };
          
          const fact = fund.category === 'Direct'
            ? (rule.manualFactAmount ?? 0)
            : (realTimeBalances.find(b => b.id === fund.id)?.totalSpent || 0);
          
          let planAmount = 0;
          if (fund.category !== 'Direct') {
              planAmount = (weeklyTotalRevenue * (rule.percentage || 0)) / 100;
          } else {
              planAmount = rule.planAmount;
          }
            
          const variance = planAmount - fact;
          const variancePct = planAmount > 0 ? (variance / planAmount) * 100 : 0;
          const item = { ...fund, ...rule, planAmount, factAmount: fact, variance, variancePct };
          if (fund.category === 'Direct') groups.Direct.push(item);
          else if (fund.category === 'Marginal') groups.Marginal.push(item);
          else if (fund.category === 'Adjustable') groups.Adjustable.push(item);
          else if (fund.category === 'Special') groups.Special.push(item);
      });
      return groups;
  }, [expenseFunds, fundRules, weeklyTotalRevenue, realTimeBalances]);
  
  const sectionTotals = useMemo(() => {
    const calc = (funds: any[]) => funds.reduce((acc, f) => {
        acc.plan += f.planAmount || 0;
        acc.fact += f.factAmount || 0;
        acc.percentage += f.percentage || 0;
        return acc;
    }, { plan: 0, fact: 0, percentage: 0 });

    return {
        Direct: calc(groupedFunds.Direct),
        Marginal: calc(groupedFunds.Marginal),
        Adjustable: calc(groupedFunds.Adjustable),
        Special: calc(groupedFunds.Special),
    };
  }, [groupedFunds]);

  const grandTotal = useMemo(() => {
    return Object.values(sectionTotals).reduce((acc, sec) => {
        acc.plan += sec.plan;
        acc.fact += sec.fact;
        acc.percentage += sec.percentage;
        return acc;
    }, { plan: 0, fact: 0, percentage: 0 });
  }, [sectionTotals]);

  const TotalsRow: React.FC<{title: string, totals: any, isGrandTotal?: boolean}> = ({ title, totals, isGrandTotal = false }) => {
    const variance = totals.plan - totals.fact;
    const getVarianceColor = (v: number) => v >= 0 ? 'text-green-600' : 'text-red-600';
    
    return (
        <tr className={`font-bold whitespace-nowrap ${isGrandTotal ? 'bg-black text-white text-base border-t-4 border-double border-gray-400' : 'bg-slate-200 text-black'}`}>
            <td className={`px-4 py-4 sticky left-0 ${isGrandTotal ? 'bg-black' : 'bg-slate-200'}`}>{title}</td>
            {isTopLevel && <td className={`px-4 py-4 ${isGrandTotal ? 'bg-black' : 'bg-slate-200'}`}></td>}
            <td className="px-4 py-4 text-center font-mono">{`${totals.percentage.toFixed(2)}%`}</td>
            <td className="px-4 py-4 text-right font-mono">{formatNumber(totals.plan)}</td>
            <td className="px-4 py-4 text-right font-mono">{formatNumber(totals.fact)}</td>
            <td className={`px-4 py-4 text-right font-mono ${getVarianceColor(variance)}`}>
                {formatNumber(variance)}
            </td>
        </tr>
    );
  };


  const getFundName = (id?: string) => expenseFunds.find((f: any) => f.id === id)?.name || 'უცნობი ფონდი';
  
  const handleTransferToAccounting = async (id: string) => { 
      try { 
          await updateRequestStatus(id, RequestStatus.DISPATCHED_TO_ACCOUNTING, user.id); 
          setFinalRequests(prev => prev.filter(r => r.id !== id)); 
      } catch(e) {alert("Error")} 
  };
  
  const handleReturnToCouncil = async (id: string) => {
    if (!window.confirm("ნამდვილად გსურთ მოთხოვნის დაბრუნება საბჭოს განხილვაზე (ეტაპი 3)?")) return;
    try {
        await updateRequestStatus(id, RequestStatus.COUNCIL_REVIEW, user.id);
        setFinalRequests(prev => prev.filter(r => r.id !== id));
    } catch(e) {
        console.error(e);
        alert("Error returning request to council");
    }
  };

  const handleArchiveExport = () => {
    const headers = {
      weekNumber: 'კვირა #',
      periodStart: 'პერიოდის დასაწყისი',
      periodEnd: 'პერიოდის დასასრული',
      totalRevenue: 'ჯამური შემოსავალი',
      totalAmount: 'ჯამური ხარჯი',
      netBalance: 'ნაშთი',
      status: 'სტატუსი'
    };
    exportGenericToExcel(filteredSessions, headers, 'Archive', 'ფინანსური_არქივი');
  };

  const handleStep11Export = () => {
    const headers = {
      requesterName: 'მომთხოვნი',
      itemName: 'ხარჯის დასახელება',
      totalAmount: 'თანხა',
      currency: 'ვალუტა',
      assignedFundId: 'ფონდი'
    };
    const dataToExport = finalRequests.map(req => ({
      ...req,
      assignedFundId: getFundName(req.assignedFundId)
    }));
    exportGenericToExcel(dataToExport, headers, 'FD Final Approval', 'FD_საბოლოო_დასტური');
  };
  
  const handleStep12Export = () => {
    const headers = {
      createdAt: 'თარიღი',
      requesterName: 'მომთხოვნი',
      itemName: 'ხარჯი',
      totalAmount: 'თანხა',
      currency: 'ვალუტა',
      assignedFundId: 'ფონდი',
      status: 'სტატუსი'
    };
     const dataToExport = dispatchedHistory.map(req => ({
      ...req,
      assignedFundId: getFundName(req.assignedFundId)
    }));
    exportGenericToExcel(dataToExport, headers, 'Dispatched', 'ბუღალტერიაში_გადაცემა');
  };
  
  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-2 border-b border-black pb-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
            <div className="p-2 bg-black text-white rounded">
                <Gavel size={24} />
            </div>
            <div>
                <h1 className="text-3xl font-extrabold uppercase tracking-tight">ფინანსური საბჭო</h1>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-yellow-400 px-2 py-0.5 rounded text-black uppercase">
                        {currentStep === 0 ? "არქივი" : `ეტაპი ${currentStep}`}
                    </span>
                    {selectedSessionDate && (
                        <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-700 flex items-center gap-1">
                            <Lock size={10} /> Read-Only: {new Date(selectedSessionDate).toLocaleDateString('ka-GE')}
                        </span>
                    )}
                </div>
            </div>
           </div>
           
           {currentStep !== 0 && (
                <button onClick={() => { setCurrentStep(0); setSelectedSessionDate(null); }} className="text-xs font-bold text-gray-500 hover:text-black uppercase border-b border-gray-300 pb-0.5">
                    არქივში დაბრუნება
                </button>
           )}
        </div>
      </div>

      {currentStep !== 0 && (
        <div className="overflow-x-auto pb-4 scrollbar-hide">
            <div className="flex items-center min-w-max gap-2 px-1">
            {STEPS.map((step, index) => {
                if (index === 0) return null;
                
                const stepNum = index;
                const isActive = stepNum === currentStep;
                return (
                <div key={index} className="flex items-center">
                    <button 
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-bold uppercase ${isActive ? 'bg-black text-white border-black shadow-lg scale-105 z-10' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
                    onClick={() => setCurrentStep(stepNum)}
                    >
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${isActive ? 'bg-white text-black' : 'bg-gray-200 text-gray-500'}`}>{stepNum}</span>
                    <span>{step}</span>
                    </button>
                    {index < STEPS.length - 1 && <div className={`flex-1 h-1 transition-colors ${index < currentStep ? 'bg-black' : 'bg-gray-100'}`}></div>}
                </div>
                );
            })}
            </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm min-h-[600px] p-6 md:p-8">
        {loading ? <div className="text-center p-12 text-gray-400">მონაცემები იტვირთება...</div> : (
          <>
             {currentStep === 0 && (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                     
                     <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-6">
                         <h2 className="text-2xl font-bold flex items-center gap-3">
                             <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Archive size={24} /></div>
                             ფინანსური არქივი
                         </h2>
                         
                         <div className="flex flex-wrap items-center gap-3">
                             <div className="relative">
                                 <select 
                                    value={archiveYear} 
                                    onChange={(e) => setArchiveYear(parseInt(e.target.value))}
                                    className="appearance-none bg-white border border-gray-300 text-black py-2 pl-4 pr-10 rounded font-bold uppercase text-xs focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                 >
                                     <option value={2025}>2025 წელი</option>
                                     <option value={2026}>2026 წელი</option>
                                 </select>
                                 <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                             </div>

                             <div className="relative">
                                 <select 
                                    value={archiveMonth} 
                                    onChange={(e) => setArchiveMonth(e.target.value)}
                                    className="appearance-none bg-white border border-gray-300 text-black py-2 pl-4 pr-10 rounded font-bold uppercase text-xs focus:ring-2 focus:ring-black focus:border-transparent outline-none min-w-[140px]"
                                 >
                                     <option value="">ყველა თვე</option>
                                     {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                 </select>
                                 <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                             </div>

                             <button 
                                onClick={() => setGroupByMonth(!groupByMonth)}
                                className={`flex items-center gap-2 px-4 py-2 border rounded text-xs font-bold uppercase transition-colors ${groupByMonth ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                             >
                                <Layers size={14} /> ჩაშლა თვეებით
                             </button>
                             <button
                                onClick={handleArchiveExport}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded"
                              >
                                <Download size={16} />
                                ექსპორტი
                              </button>

                             <div className="w-px h-8 bg-gray-200 mx-2 hidden lg:block"></div>

                             <button 
                                onClick={handleStartNewSession}
                                className="px-6 py-2 bg-green-600 text-white font-bold uppercase rounded hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg text-xs"
                             >
                                 <Plus size={14} /> ახალი კვირა (Step 1)
                             </button>
                         </div>
                     </div>

                     <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                         <table className="w-full text-left text-sm">
                             <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs border-b border-gray-200">
                                 <tr>
                                     <th className="px-6 py-4">კვირა / პერიოდი</th>
                                     <th className="px-6 py-4 text-right bg-blue-50/30 text-blue-900 border-x border-blue-100">ჯამური შემოსავალი (ფაქტი)</th>
                                     <th className="px-6 py-4 text-right">ჯამური ხარჯი (დამტკიცებული)</th>
                                     <th className="px-6 py-4 text-right">ნაშთი (Delta)</th>
                                     <th className="px-6 py-4 text-center">სტატუსი</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100">
                                 {filteredSessions.length === 0 ? (
                                     <tr><td colSpan={5} className="p-12 text-center text-gray-400">არქივი ცარიელია არჩეული ფილტრებით</td></tr>
                                 ) : groupByMonth && groupedSessions ? (
                                     Object.entries(groupedSessions).map(([monthKey, sessionsInGroup]: [string, FinancialSession[]]) => {
                                         const isExpanded = expandedMonths[monthKey];
                                         const totalRev = sessionsInGroup.reduce((sum, s) => sum + s.totalRevenue, 0);
                                         const totalExp = sessionsInGroup.reduce((sum, s) => sum + s.totalAmount, 0);
                                         const totalDelta = totalRev - totalExp;

                                         return (
                                             <React.Fragment key={monthKey}>
                                                 <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-200" onClick={() => toggleMonthExpand(monthKey)}>
                                                     <td className="px-6 py-4 font-bold text-black flex items-center gap-2">
                                                         {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                         {monthKey} <span className="text-gray-400 font-normal text-xs ml-2">({sessionsInGroup.length} კვირა)</span>
                                                     </td>
                                                     <td className="px-6 py-4 text-right font-mono font-bold text-blue-900 bg-blue-50/20">{totalRev.toLocaleString()} ₾</td>
                                                     <td className="px-6 py-4 text-right font-mono font-bold text-black">{totalExp.toLocaleString()} ₾</td>
                                                     <td className={`px-6 py-4 text-right font-mono font-bold ${totalDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                         {totalDelta > 0 ? '+' : ''}{totalDelta.toLocaleString()} ₾
                                                     </td>
                                                     <td className="px-6 py-4 text-center"></td>
                                                 </tr>
                                                 {isExpanded && sessionsInGroup.map(session => (
                                                     <tr 
                                                        key={session.id} 
                                                        onClick={() => handleOpenArchive(session.dateConducted)}
                                                        className="hover:bg-blue-50 transition-colors cursor-pointer group bg-white"
                                                     >
                                                         <td className="px-6 py-3 pl-12 text-sm">
                                                             <div className="font-bold text-black">კვირა #{session.weekNumber}</div>
                                                             <div className="text-xs text-gray-500">{session.periodStart} - {session.periodEnd}</div>
                                                         </td>
                                                         <td className="px-6 py-3 text-right font-mono text-gray-600 bg-blue-50/10 text-xs">
                                                             {session.totalRevenue.toLocaleString()} ₾
                                                         </td>
                                                         <td className="px-6 py-3 text-right font-mono font-bold text-black text-xs">
                                                             {session.totalAmount.toLocaleString()} ₾
                                                         </td>
                                                         <td className="px-6 py-3 text-right font-mono text-xs">
                                                             <span className={`px-2 py-1 rounded font-bold ${session.netBalance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                 {session.netBalance > 0 ? '+' : ''}{session.netBalance.toLocaleString()} ₾
                                                             </span>
                                                         </td>
                                                         <td className="px-6 py-3 text-center">
                                                             <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                 session.status === 'active' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                                                             }`}>
                                                                 {session.status === 'active' ? 'აქტიური' : 'დასრულებული'}
                                                             </span>
                                                         </td>
                                                     </tr>
                                                 ))}
                                             </React.Fragment>
                                         );
                                     })
                                 ) : (
                                     filteredSessions.map((session) => (
                                         <tr key={session.id} onClick={() => handleOpenArchive(session.dateConducted)} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                                             <td className="px-6 py-4 font-bold text-black">
                                                 <div className="flex flex-col">
                                                     <span>კვირა #{session.weekNumber}</span>
                                                     <span className="text-[10px] text-gray-400 font-normal">{session.periodStart} - {session.periodEnd}</span>
                                                 </div>
                                             </td>
                                             <td className="px-6 py-4 text-right font-mono font-bold text-blue-900 bg-blue-50/10">{session.totalRevenue.toLocaleString()} ₾</td>
                                             <td className="px-6 py-4 text-right font-mono font-bold text-black">{session.totalAmount.toLocaleString()} ₾</td>
                                             <td className="px-6 py-4 text-right font-mono font-bold">
                                                 <span className={`${session.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{session.netBalance > 0 ? '+' : ''}{session.netBalance.toLocaleString()} ₾</span>
                                             </td>
                                             <td className="px-6 py-4 text-center">
                                                 <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${session.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{session.status === 'active' ? 'აქტიური' : 'არქივირებული'}</span>
                                             </td>
                                         </tr>
                                     ))
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
             )}

             {currentStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                   <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-bold flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><LinkIcon size={24} /></div>ანგარიშების მართვა & შემოსავლები</h2>
                     <div className="flex gap-2">
                       <button onClick={handleAddManualAccount} className="px-4 py-2 bg-white border border-gray-300 text-black rounded text-xs font-bold uppercase"><Plus size={14} /> ხელით დამატება</button>
                       <button onClick={handleBankSync} disabled={isSyncing} className="px-4 py-2 bg-gray-100 text-black rounded text-xs font-bold uppercase"><RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} /> სინქრონიზაცია</button>
                     </div>
                  </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center"><span className="font-bold text-sm uppercase text-gray-600">საბანკო ანგარიშები</span></div>
                          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                              {bankAccounts.map(acc => {
                                  const isEditing = editingId === acc.id;
                                  return (
                                    <div key={acc.id} className="p-4 hover:bg-gray-50">
                                      <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                              {isEditing ? (
                                                  <div className="flex flex-col gap-2 mr-4">
                                                      <input className="font-bold border-b focus:border-black outline-none" value={editForm.bankName || ''} onChange={(e) => handleEditChange('bankName', e.target.value)} placeholder="ბანკი" />
                                                      <input className="text-xs border-b focus:border-black outline-none" value={editForm.iban || ''} onChange={(e) => handleEditChange('iban', e.target.value)} placeholder="IBAN" />
                                                  </div>
                                              ) : (
                                                  <>
                                                      <div className="font-bold text-black">{acc.bankName} - {acc.accountName} <span className="text-[10px] text-gray-400">| {acc.currency}</span></div>
                                                      <div className="text-xs text-gray-500 font-mono">{acc.iban}</div>
                                                  </>
                                              )}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <button onClick={() => handleToggleSync(acc.id, acc.isAutoSync)}>{acc.isAutoSync ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400" />}</button>
                                            <div className="text-right">
                                              {acc.isAutoSync ? <><div className="font-bold font-mono">{acc.currentBalance.toLocaleString()}</div><div className="text-[10px] text-gray-400">API</div></> : isEditing ? <input type="number" value={editForm.currentBalance} onChange={(e) => handleEditChange('currentBalance', parseFloat(e.target.value))} className="w-24 text-right border-b" /> : <div className="font-bold font-mono">{acc.currentBalance.toLocaleString()}</div>}
                                            </div>
                                          </div>
                                      </div>
                                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                                          <div className="flex-1 mr-4">{isEditing ? <select value={editForm.mappedCategoryId || 'unmapped'} onChange={(e) => handleEditChange('mappedCategoryId', e.target.value === 'unmapped' ? undefined : e.target.value)} className="w-full text-xs font-bold border rounded"><option value="unmapped">⚠️ მოუწესრიგებელი</option>{revenueCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <span className={`text-xs font-bold px-2 py-1 rounded ${!acc.mappedCategoryId ? 'bg-red-50 text-red-700' : 'bg-gray-100'}`}>{acc.mappedCategoryId ? revenueCategories.find(c => c.id === acc.mappedCategoryId)?.name : '⚠️ მოუწესრიგებელი'}</span>}</div>
                                          <div>{isEditing ? <div className="flex gap-2"><button onClick={handleSaveEdit} className="p-1.5 bg-green-100 text-green-700 rounded"><Save size={16} /></button><button onClick={handleCancelEdit} className="p-1.5 bg-red-100 text-red-700 rounded"><X size={16} /></button></div> : <button onClick={() => handleStartEdit(acc)} className="p-1.5 text-gray-400 hover:text-black rounded"><Edit2 size={16} /></button>}</div>
                                      </div>
                                    </div>
                                  );
                              })}
                          </div>
                      </div>
                      <div className="flex flex-col gap-6">
                          <div className="bg-black text-white p-6 rounded-lg shadow-lg">
                              <div className="text-xs font-bold uppercase opacity-70 mb-1">ჯამური შემოსავალი (ფაქტი)</div>
                              <div className="text-4xl font-mono font-bold">{totalActualRevenue.toLocaleString()} GEL</div>
                          </div>
                          
                          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                             <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <BarChart2 size={18} className="text-gray-500" />
                                <h3 className="font-bold text-gray-800 uppercase text-sm">შემოსავლის ანალიზი</h3>
                             </div>
                             <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><div className="text-xs text-gray-400 font-bold uppercase">გეგმა (Goal)</div><div className="font-mono font-bold text-gray-600 text-lg">{totalPlannedRevenue.toLocaleString()} ₾</div></div>
                                <div><div className="text-xs text-gray-400 font-bold uppercase">ფაქტი (Actual)</div><div className="font-mono font-bold text-black text-lg">{totalActualRevenue.toLocaleString()} ₾</div></div>
                             </div>
                             <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-end"><div className="text-xs font-bold uppercase text-gray-500">გადახრა (Variance)</div><div className={`text-xl font-mono font-bold ${revenueVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{revenueVariance > 0 ? '+' : ''}{revenueVariance.toLocaleString()} ₾<span className="text-xs ml-1 opacity-75">({revenueVariancePct.toFixed(1)}%)</span></div></div>
                                <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${revenueVariance >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.abs(revenueVariancePct), 100)}%` }} /></div>
                             </div>
                          </div>
                          
                          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                              <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                  <PieChartIcon size={18} className="text-gray-500" />
                                  <h3 className="font-bold text-gray-800 uppercase text-xs">შემოსავლების სტრუქტურა</h3>
                              </div>
                              <div className="space-y-5">
                                  {calculatedRevenue.map(cat => {
                                      const pct = cat.plannedAmount > 0 ? ((cat.actualAmount || 0) / cat.plannedAmount) * 100 : 0;
                                      return (
                                          <div key={cat.id}>
                                              <div className="flex justify-between text-xs mb-1.5 items-end">
                                                  <span className="font-bold text-gray-700 uppercase tracking-tight">{cat.name}</span>
                                                  <span className="font-mono"><span className={(cat.actualAmount || 0) >= cat.plannedAmount ? "text-green-700 font-bold" : "text-black font-bold"}>{(cat.actualAmount || 0).toLocaleString()}</span> <span className="text-gray-400"> / {cat.plannedAmount.toLocaleString()} ₾</span></span>
                                              </div>
                                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${(cat.actualAmount || 0) >= cat.plannedAmount ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end pt-6 border-t border-gray-100">
                     <button disabled={unmappedTotal > 0} className={`flex items-center gap-3 px-8 py-4 font-bold uppercase rounded-lg transition-all shadow-lg ${unmappedTotal > 0 ? 'bg-gray-100 text-gray-400' : 'bg-black text-white'}`} onClick={() => setCurrentStep(2)}>შემდეგი <ArrowRight size={20} /></button>
                  </div>
                </div>
             )}

             {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                   <div className="flex items-center justify-between">
                       <h2 className="text-2xl font-bold flex items-center gap-3"><div className="p-2 bg-green-50 text-green-600 rounded-lg"><PieChart size={24} /></div>ფონდების განაწილების მატრიცა</h2>
                       <div className="text-right">
                           <div className="text-xs text-gray-500 font-bold uppercase">ბაზა (კვირის შემოსავალი)</div>
                           <div className="text-2xl font-mono font-bold text-green-600">{formatNumber(weeklyTotalRevenue)} GEL</div>
                       </div>
                   </div>
                   
                   <div className="border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="sticky top-0 z-20 bg-gray-100 text-gray-600 font-bold uppercase text-xs">
                               <tr className="whitespace-nowrap">
                                   <th className="px-4 py-4 sticky left-0 bg-gray-100 z-10 w-64">დასახელება</th>
                                   {isTopLevel && <th className="px-2 py-4 w-24 text-center">Sync Status</th>}
                                   <th className="px-4 py-4 w-32 text-center">განაწილება (%)</th>
                                   <th className="px-4 py-4 w-48 text-right">გეგმა (₾)</th>
                                   <th className="px-4 py-4 text-right w-48">ფაქტი (₾) {selectedSessionDate && <Lock size={10} className="inline ml-1"/>}</th>
                                   <th className="px-4 py-4 text-right w-48">გადახრა (+/-)</th>
                               </tr>
                           </thead>
                           <tbody className="bg-white">
                               {[
                                 { title: 'SECTION A: პირდაპირი ხარჯის ფონდები (Direct)', funds: groupedFunds.Direct, category: 'Direct', totals: sectionTotals.Direct },
                                 { title: 'SECTION B: მარჟინალური ფონდები (Marginal)', funds: groupedFunds.Marginal, category: 'Marginal', totals: sectionTotals.Marginal },
                                 { title: 'SECTION C: კორექტირებადი ხარჯების ფონდები (Adjustable)', funds: groupedFunds.Adjustable, category: 'Adjustable', totals: sectionTotals.Adjustable },
                                 { title: 'SECTION D: განსაკუთრებული ფონდები (Special)', funds: groupedFunds.Special, category: 'Special', totals: sectionTotals.Special },
                               ].map(({ title, funds, category, totals }) => (
                                 <React.Fragment key={category}>
                                   <tr style={{backgroundColor: '#E8ECEF'}}><td colSpan={isTopLevel ? 6 : 5} className="px-4 py-3 text-sm font-bold uppercase text-slate-800"><div className="flex items-center gap-2">{isTopLevel && <button onClick={()=>toggleSectionVisibility(category)}>{funds.every(f=>hiddenFunds[f.id]) ? <EyeOff size={14}/> : <Eye size={14}/>}</button>}{title}</div></td></tr>
                                   {funds.filter(r => !hiddenFunds[r.id]).map(row => (
                                       <tr key={row.id} className={`${row.nameMismatch ? 'bg-red-100' : ''} hover:bg-yellow-50 transition-colors whitespace-nowrap`}>
                                           <td className={`px-4 py-4 font-bold text-gray-800 flex items-center gap-2 sticky left-0 z-10 ${row.nameMismatch ? 'bg-red-100' : 'bg-white hover:bg-yellow-50'}`}>{isTopLevel && <button onClick={() => toggleFundVisibility(row.id)}>{hiddenFunds[row.id] ? <EyeOff size={14} className="text-gray-400"/> : <Eye size={14}/>}</button>}<div>{row.name}<div className="text-[10px] text-gray-400 font-normal">{row.description}</div></div></td>
                                           {isTopLevel && (<td className={`px-2 py-4 text-center font-bold text-xs ${row.nameMismatch ? 'text-red-600' : ''}`}><span title={row.syncStatus === '✅' ? 'Linked to Budget 2026' : 'Name Mismatch / No Link Found'}>{row.nameMismatch ? 'Name Mismatch' : row.syncStatus}</span></td>)}
                                           <td className="px-4 py-4 font-mono text-center text-gray-500">{row.percentage > 0 ? `${row.percentage.toFixed(2)}%` : 'N/A'}</td>
                                           <td className="px-4 py-4 text-right">
                                              {row.category === 'Direct' && !selectedSessionDate ? (
                                                <input 
                                                  type="text" 
                                                  value={formatNumber(row.planAmount)} 
                                                  onChange={(e) => {
                                                      const val = parseFloat(e.target.value.replace(/\s/g, '')) || 0;
                                                      handleMatrixChange(row.id, val);
                                                  }}
                                                  className="w-full text-right py-2 border-b-2 border-transparent focus:border-blue-500 outline-none font-mono bg-yellow-50"
                                                />
                                              ) : (
                                                <input type="text" value={formatNumber(row.planAmount)} disabled className="w-full text-right py-2 border-b border-transparent outline-none font-mono bg-gray-100 text-gray-500 cursor-not-allowed"/>
                                              )}
                                           </td>
                                           <td className="px-4 py-4 text-right font-mono">
                                                {row.category === 'Direct' && !selectedSessionDate ? (
                                                    <input
                                                        type="text"
                                                        value={formatNumber(row.factAmount)}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value.replace(/\s/g, '')) || 0;
                                                            handleFactChange(row.id, val);
                                                        }}
                                                        className="w-full text-right py-2 border-b-2 border-transparent focus:border-blue-500 outline-none font-mono font-bold bg-yellow-50 text-blue-900"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-blue-900">{formatNumber(row.factAmount)}</span>
                                                )}
                                           </td>
                                           <td className="px-4 py-4 text-right font-mono"><span className={`font-bold ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.variance > 0 ? '+' : ''}{formatNumber(row.variance)}</span><div className={`text-[10px] ${row.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>({row.variancePct.toFixed(1)}%)</div></td>
                                       </tr>
                                   ))}
                                   <TotalsRow title={`სულ სექცია ${category[0]}`} totals={totals} />
                                 </React.Fragment>
                               ))}
                           </tbody>
                            <tfoot>
                                <TotalsRow title="ჯამური დირექტივა" totals={grandTotal} isGrandTotal={true} />
                            </tfoot>
                       </table>
                   </div>
                   
                   <div className="flex justify-between pt-6 border-t border-gray-100">
                      <button onClick={() => setCurrentStep(1)} className="text-gray-500 hover:text-black font-bold uppercase text-xs">უკან</button>
                      <button onClick={() => setCurrentStep(3)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                   </div>
                </div>
             )}
            
            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                 <DirectorApprovals user={user} currentStep={currentStep} />
                 <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                    <button onClick={() => setCurrentStep(currentStep - 1)} className="text-gray-500 hover:text-black font-bold uppercase text-xs">უკან</button>
                    <button onClick={() => setCurrentStep(currentStep + 1)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                 </div>
              </div>
            )}
            
            {(currentStep === 4 || (currentStep >= 6 && currentStep <= 10)) && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                   <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-4">
                      <div className="p-2 bg-gray-100 rounded text-gray-700 font-bold text-sm border border-gray-300">
                         {currentStep}
                      </div>
                      <h2 className="text-xl font-bold uppercase text-gray-800">{STEPS[currentStep]}</h2>
                   </div>
                   <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                       <h3 className="text-xl font-bold text-black">მოდული დამუშავების პროცესშია</h3>
                       <p className="mt-2 text-sm">{STEPS[currentStep]} module is under development.</p>
                   </div>
                   <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                      <button onClick={() => setCurrentStep(currentStep - 1)} className="text-gray-500 hover:text-black font-bold uppercase text-xs">უკან</button>
                      <button onClick={() => setCurrentStep(currentStep + 1)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                   </div>
                </div>
             )}

            {currentStep === 5 && (
              <>
                <DebtManagementView />
                <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                    <button onClick={() => setCurrentStep(currentStep - 1)} className="text-gray-500 hover:text-black font-bold uppercase text-xs">უკან</button>
                    <button onClick={() => setCurrentStep(currentStep + 1)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                </div>
              </>
            )}

             {currentStep === 11 && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center justify-between mb-6">
                       <h2 className="text-2xl font-bold flex items-center gap-3">
                           <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><CheckCircle2 size={24} /></div>
                           FD საბოლოო დასტური (Step 11)
                       </h2>
                       <button
                           onClick={handleStep11Export}
                           className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded"
                         >
                           <Download size={16} />
                           ჩამოტვირთვა (Excel)
                         </button>
                   </div>
                   {!isFinDirector ? (
                      <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">წვდომა შეზღუდულია.</div>
                   ) : (
                      <>
                        {finalRequests.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 border rounded-lg bg-gray-50">საბოლოო დასტურის მოლოდინში განაცხადები არ არის.</div>
                        ) : (
                          <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                            <table className="w-full text-xs text-left bg-white whitespace-nowrap">
                              <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-300 uppercase tracking-tight">
                                <tr>
                                  <th className="px-3 py-3 border-r">მომთხოვნი</th>
                                  <th className="px-3 py-3 border-r">ხარჯის დასახელება</th>
                                  <th className="px-3 py-3 border-r text-right">ჯამური თანხა</th>
                                  <th className="px-3 py-3 border-r">დაფინანსების წყარო</th>
                                  <th className="px-3 py-3 border-r text-center">ხელმოწერები</th>
                                  <th className="px-3 py-3 text-center">მოქმედება</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {finalRequests.map(req => (
                                  <tr key={req.id}>
                                    <td className="px-3 py-2 border-r">{req.requesterName}</td>
                                    <td className="px-3 py-2 border-r">{req.itemName || req.category}</td>
                                    <td className="px-3 py-2 border-r text-right font-bold">{req.totalAmount.toLocaleString()} {req.currency}</td>
                                    <td className="px-3 py-2 border-r">{getFundName(req.assignedFundId)}</td>
                                    <td className="px-3 py-2 border-r text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            {req.finDirectorNote === 'დასტურდება' && <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">FD <Check size={12}/></span>}
                                            {req.directorNote === 'დასტურდება' && <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">CEO <Check size={12}/></span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <button 
                                          onClick={() => handleReturnToCouncil(req.id)}
                                          className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white text-xs font-bold uppercase rounded hover:bg-yellow-600 transition-colors shadow-md"
                                          title="საბჭოზე დაბრუნება"
                                        >
                                          <CornerUpLeft size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleTransferToAccounting(req.id)}
                                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700 transition-colors shadow-md"
                                        >
                                          <Send size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                   )}
                   <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                      <button onClick={() => setCurrentStep(10)} className="text-gray-500 hover:text-black font-bold uppercase text-xs">უკან</button>
                      <button onClick={() => setCurrentStep(12)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                   </div>
               </div>
            )}

            {currentStep === 12 && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                   <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                       <h2 className="text-2xl font-bold flex items-center gap-3">
                           <div className="p-2 bg-black text-white rounded-lg"><Layers size={24} /></div>
                           ბუღალტერიაში გადაცემა (Step 12)
                       </h2>
                       <button
                           onClick={handleStep12Export}
                           className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded"
                         >
                           <Download size={16} />
                           ჩამოტვირთვა (Excel)
                         </button>
                   </div>

                   {!isFinDirector && !user.role.includes('FOUNDER') ? (
                       <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">წვდომა შეზღუდულია.</div>
                   ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs">
                                  <tr>
                                      <th className="px-4 py-3">ხარჯი</th>
                                      <th className="px-4 py-3">თანხა</th>
                                      <th className="px-4 py-3">ფონდი</th>
                                      <th className="px-4 py-3 text-center">სტატუსი</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {dispatchedHistory.length === 0 ? (
                                      <tr><td colSpan={4} className="p-8 text-center text-gray-400">ისტორია ცარიელია</td></tr>
                                  ) : (
                                      dispatchedHistory.map(req => (
                                          <tr key={req.id} className="bg-white">
                                              <td className="px-4 py-3 font-bold">{req.itemName || req.category}</td>
                                              <td className="px-4 py-3 font-mono">{req.totalAmount} {req.currency}</td>
                                              <td className="px-4 py-3"><span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold uppercase">{getFundName(req.assignedFundId)}</span></td>
                                              <td className="px-4 py-3 text-center">
                                                  {req.status === RequestStatus.PAID ? (
                                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded border border-green-200">
                                                          <CheckCircle2 size={12} /> გადახდილია
                                                      </span>
                                                  ) : (
                                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-100">
                                                          <Clock size={12} /> გადაგზავნილია
                                                      </span>
                                                  )}
                                              </td>
                                          </tr>
                                      ))
                                  )}
                              </tbody>
                          </table>
                      </div>
                   )}

                   <div className="flex justify-between pt-8 mt-8 border-t border-gray-200">
                      <button onClick={() => setCurrentStep(11)} className="text-gray-500 hover:text-black font-bold uppercase text-xs flex items-center gap-2"><ChevronRight size={16} className="rotate-180"/> უკან</button>
                      <button onClick={() => setCurrentStep(13)} className="bg-black text-white px-8 py-4 font-bold uppercase rounded-lg">შემდეგი</button>
                   </div>
               </div>
            )}
            
            {currentStep === 13 && (
                 <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                     <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-black text-white rounded-lg"><CheckCircle2 size={24} /></div>
                                საბჭოს დახურვა (Step 13)
                            </h2>
                            {isReportGenerated && (
                                <div className="mt-2 ml-12 text-sm font-bold text-gray-600 bg-gray-100 border border-gray-200 p-2 rounded inline-flex items-center gap-1.5" title="ბოლო 12 თვის სამომხმარებლო ფასების ინდექსი (CPI)">
                                    ინფლაციის მაჩვენებელი: <span className="text-red-600 font-mono">{inflation.toFixed(1)}%</span>
                                    <Info size={14} className="cursor-help" />
                                </div>
                            )}
                        </div>
                         <div className="flex items-center gap-2">
                             <button
                                 onClick={handleGenerateReport}
                                 disabled={isReportLoading || !!completionTimestamp}
                                 className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm rounded disabled:opacity-50"
                               >
                                 {isReportLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                 {isReportGenerated ? 'ხელახლა გენერაცია' : 'დასრულება & რეპორტის გენერაცია'}
                               </button>

                               {isReportGenerated && !completionTimestamp && (
                                   <button 
                                      onClick={handleFinalizeReport}
                                      className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-800 transition-colors shadow-sm rounded animate-in fade-in"
                                   >
                                      <CheckCircle2 size={16} /> დასრულება
                                   </button>
                               )}

                               {isReportGenerated && (
                                <>
                                  <button onClick={handleMultiExport} className="no-print flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-xs font-bold uppercase rounded"><FileDown size={16}/> Excel</button>
                                  <button onClick={handlePrint} className="no-print flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-xs font-bold uppercase rounded"><Printer size={16}/> PDF</button>
                                </>
                               )}
                         </div>
                     </div>
                      
                      {completionTimestamp && (
                        <div className="text-center text-sm font-bold text-gray-600 bg-gray-100 border border-gray-200 p-2 rounded">
                          დასრულების თარიღი: {formatTimestamp(completionTimestamp)}
                        </div>
                      )}

                     {!isReportGenerated ? (
                        <div className="p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                            <h3 className="text-lg font-bold">რეპორტი არ არის გენერირებული</h3>
                            <p className="text-sm mt-1">დააჭირეთ ღილაკს პერიოდის მონაცემების კონსოლიდაციისთვის.</p>
                        </div>
                     ) : (
                       <div id="report-preview" className="bg-white p-8 md:p-12 border border-gray-300 shadow-lg rounded-none max-w-[210mm] mx-auto space-y-10">
                          
                          {reportData && (
                            <>
                              <section>
                                <h3 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase">შემოსავლების სტრუქტურა</h3>
                                <table className="w-full text-sm">
                                  <tbody>{reportData.revenues.map(r => <tr key={r.name}><td className="py-1 font-medium">{r.name}</td><td className="py-1 text-right font-mono">{formatNumber(r.actualAmount)} ₾</td></tr>)}</tbody>
                                </table>
                              </section>
                              
                              <section>
                                <h3 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase">ფონდების მატრიცა (ნაშთები)</h3>
                                <table className="w-full text-sm">
                                    <thead><tr className="font-bold"><td className="py-1">ფონდი</td><td className="py-1 text-right">მიმდინარე ნაშთი</td></tr></thead>
                                    <tbody>{reportData.funds.map(f => <tr key={f.id}><td className="py-1 font-medium">{f.name}</td><td className="py-1 text-right font-mono">{formatNumber(f.remaining)} ₾</td></tr>)}</tbody>
                                </table>
                              </section>

                              <section>
                                <h3 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase">ხარჯების ანალიზი (დეპარტამენტების მიხედვით)</h3>
                                <table className="w-full text-sm">
                                   <thead>
                                      <tr className="font-bold">
                                          <td className="py-1">დეპარტამენტი</td>
                                          <td className="py-1 text-center">მოთხოვნების რაოდენობა</td>
                                          <td className="py-1 text-right">მოთხოვნილი თანხა</td>
                                          <td className="py-1 text-right">დადასტურებული თანხა</td>
                                      </tr>
                                   </thead>
                                  <tbody>
                                    {reportData.expenseAnalysis.map(e => (
                                      <tr key={e.department}>
                                        <td className="py-1 font-medium">{e.department}</td>
                                        <td className="py-1 text-center font-mono">{e.requestCount}</td>
                                        <td className="py-1 text-right font-mono">{formatNumber(e.totalRequested)} ₾</td>
                                        <td className="py-1 text-right font-mono font-bold">{formatNumber(e.totalApproved)} ₾</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </section>

                              <section>
                                  <h3 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase">დავალიანებების მართვა</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                      <h4 className="font-bold mb-2">დებიტორები</h4>
                                      <table className="w-full text-sm">
                                        <thead><tr className="font-bold"><td className="py-1"></td><td className="py-1 text-right">საწყისი</td><td className="py-1 text-right">ზრდა</td><td className="py-1 text-right">კლება</td><td className="py-1 text-right">საბოლოო</td></tr></thead>
                                        <tbody>
                                            {reportData.debtors.map(d => (<tr key={d.id}><td className="py-1 font-medium">{d.name}</td><td className="py-1 text-right font-mono text-gray-500">{formatNumber(d.previousBalance)}</td><td className="py-1 text-right font-mono text-green-600">{formatNumber(d.increase)}</td><td className="py-1 text-right font-mono text-red-600">{formatNumber(d.decrease)}</td><td className="py-1 text-right font-mono font-bold">{formatNumber(d.currentBalance)}</td></tr>))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div>
                                      <h4 className="font-bold mb-2">კრედიტორები</h4>
                                      <table className="w-full text-sm">
                                        <thead><tr className="font-bold"><td className="py-1"></td><td className="py-1 text-right">საწყისი</td><td className="py-1 text-right">ზრდა</td><td className="py-1 text-right">კლება</td><td className="py-1 text-right">საბოლოო</td></tr></thead>
                                        <tbody>
                                            {reportData.creditors.map(c => (<tr key={c.id}><td className="py-1 font-medium">{c.name}</td><td className="py-1 text-right font-mono text-gray-500">{formatNumber(c.previousBalance)}</td><td className="py-1 text-right font-mono text-green-600">{formatNumber(c.increase)}</td><td className="py-1 text-right font-mono text-red-600">{formatNumber(c.decrease)}</td><td className="py-1 text-right font-mono font-bold">{formatNumber(c.currentBalance)}</td></tr>))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                              </section>
                              
                              <section>
                                <h3 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase flex items-center gap-2"><BrainCircuit size={20}/> AI გენერირებული დასკვნა და რეკომენდაციები</h3>
                                {isAiLoading ? (
                                  <div className="p-4 text-center text-gray-500 animate-pulse-slow">AI აანალიზებს მონაცემებს...</div>
                                ) : (
                                  <>
                                    <div className={`p-4 rounded border ${isAiEditable ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                                      {isAiEditable ? (
                                        <textarea value={aiConclusion} onChange={(e) => setAiConclusion(e.target.value)} rows={6} className="w-full bg-transparent outline-none text-sm leading-relaxed" />
                                      ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiConclusion}</p>
                                      )}
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4 no-print">
                                      {isAiEditable ? (
                                        <button onClick={() => setIsAiEditable(false)} disabled={!!completionTimestamp} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-1 disabled:opacity-50"><Save size={12}/> შენახვა</button>
                                      ) : (
                                        <button onClick={() => setIsAiEditable(true)} disabled={!!completionTimestamp} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded flex items-center gap-1 disabled:opacity-50"><FileEdit size={12}/> რედაქტირება</button>
                                      )}
                                      <button onClick={handleRegenerateAI} disabled={!!completionTimestamp} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded flex items-center gap-1 disabled:opacity-50"><RefreshCw size={12}/> ხელახლა გენერაცია</button>
                                      {!isConclusionConfirmed && <button onClick={() => setIsConclusionConfirmed(true)} className="px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded flex items-center gap-1"><CheckCircle2 size={12}/> რეპორტის დადასტურება</button>}
                                    </div>
                                  </>
                                )}
                              </section>

                              {completionTimestamp && (
                                <section className="pt-8 mt-8 border-t border-gray-200">
                                   <p className="text-xs text-gray-500 text-center">
                                      ანგარიში დადასტურებულია: {formatTimestamp(completionTimestamp)}
                                   </p>
                                </section>
                              )}
                              
                              <section className="pt-16">
                                <div className="grid grid-cols-2 gap-16">
                                    <div className="border-t-2 border-black pt-2"><span className="font-bold">ფინანსური დირექტორი:</span></div>
                                    <div className="border-t-2 border-black pt-2"><span className="font-bold">საბჭოს თავმჯდომარე:</span></div>
                                </div>
                              </section>
                            </>
                          )}
                       </div>
                     )}

                     <div className="flex justify-start pt-8 mt-8 border-t border-gray-200">
                        <button onClick={() => setCurrentStep(12)} className="text-gray-500 hover:text-black font-bold uppercase text-xs flex items-center gap-2"><ChevronRight size={16} className="rotate-180"/> უკან</button>
                     </div>
                 </div>
              )}

          </>
        )}
      </div>
    </div>
  );
};