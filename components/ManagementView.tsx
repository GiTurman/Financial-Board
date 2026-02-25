
import React, { useState, useEffect, useMemo } from 'react';
import { getBankAccounts, getRevenueCategories, getRealTimeFundBalances, getFinancialCouncilSessions, getExpenseFunds, getAllRequests, dispatchDirectivesToAccounting, getAnnualBudget } from '../services/mockService';
import { FundBalance, User, UserRole, ExpenseRequest, DirectiveSnapshot } from '../types';
import { formatNumber } from '../utils/formatters';
import { Briefcase, Download, RefreshCw, Eye, EyeOff, Search, Circle, Send, X, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { addDirective } from '../storage/directiveStorage';

type ManagementTab = 'cover' | 'revenue' | 'funds' | 'directives' | 'full';
type AggregatedRevenue = Record<string, Record<string, number>>;

// --- Unified Data Structure ---
interface IntegratedFundData {
  id: string;
  name: string;
  category: 'Direct' | 'Marginal' | 'Adjustable' | 'Special';
  available: number;
  calculated: number;
  approved: number; 
  carryOver: number;
  expense: number;
  returnedUnspent: number; 
  distributionPercentage: number;
}

// --- Tab Content Components ---

const CoverPageTab: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState('');
    const [boardWeekLabel, setBoardWeekLabel] = useState('');
    const [boardDateRange, setBoardDateRange] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const today = new Date();
            const dateOptions: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', year: 'numeric' };
            setCurrentDate(today.toLocaleDateString('en-US', dateOptions));
            const sessions = await getFinancialCouncilSessions();
            if (sessions.length > 0) {
                const activeSession = sessions.find(s => s.status === 'active') || sessions[0];
                setBoardWeekLabel(`საბჭოს კვირა: კვირა #${activeSession.weekNumber}`);
                const endDate = new Date(activeSession.dateConducted);
                const startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 6);
                const rangeDateOptions: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', year: 'numeric' };
                setBoardDateRange(`${startDate.toLocaleDateString('en-US', rangeDateOptions)} - ${endDate.toLocaleDateString('en-US', rangeDateOptions)}`);
            } else {
                setBoardWeekLabel('საბჭოს კვირა: მონაცემები არ არის');
                setBoardDateRange('');
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">იტვირთება...</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] text-center px-4">
            <h1 className="text-2xl md:text-4xl font-extrabold text-black">მენეჯეტი - {currentDate}</h1>
            <p className="text-lg md:text-xl text-gray-500 mt-4">{boardWeekLabel}</p>
            {boardDateRange && <p className="text-base md:text-lg text-gray-500 mt-1 font-mono">{boardDateRange}</p>}
        </div>
    );
};

const RevenueSummaryTab: React.FC<{ data: AggregatedRevenue; loading: boolean; lastUpdated: Date | null }> = ({ data, loading, lastUpdated }) => {
    if (loading) return <div className="p-8 text-center text-gray-500">იტვირთება...</div>;
    const grandTotal = Object.values(data).reduce((catSum: number, banks: Record<string, number>) => catSum + Object.values(banks).reduce((bankSum: number, total: number) => bankSum + total, 0), 0);
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-xs md:text-sm text-gray-500 gap-2">
                <p>მხოლოდ წასაკითხი რეჟიმი. ჯამებში გათვალისწინებულია მხოლოდ ის ანგარიშები, რომლებიც მიბმულია შემოსავლის კატეგორიასთან.</p>
                {lastUpdated && (<div className="text-[10px] md:text-xs font-mono whitespace-nowrap">განახლდა: {lastUpdated.toLocaleTimeString('ka-GE')}</div>)}
            </div>
            <div className="space-y-6">
                {Object.keys(data).length === 0 ? 
                    <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-lg">აგრეგირებული მონაცემები არ მოიძებნა.</div> : 
                    Object.entries(data).map(([categoryName, banks]) => (
                        <div key={categoryName} className="p-4 md:p-6 bg-gray-50 border-2 border-gray-100 rounded-lg">
                            <h4 className="font-bold text-gray-800 mb-3 text-base md:text-lg border-b pb-2">{categoryName}</h4>
                            <ul className="space-y-2">
                                {Object.entries(banks).map(([bankName, total]) => (
                                    <li key={bankName} className="flex justify-between items-center text-xs md:text-sm">
                                        <span className="truncate mr-2">{bankName}</span>
                                        <span className="font-mono font-bold text-black whitespace-nowrap">{formatNumber(total)} GEL</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                }
            </div>
            <div className="p-4 md:p-6 bg-gray-800 text-white rounded-lg mt-4">
                <h4 className="font-bold uppercase tracking-wider text-sm md:text-base">სულ ჯამი</h4>
                <p className="text-2xl md:text-4xl font-mono font-bold">{formatNumber(grandTotal)} GEL</p>
            </div>
        </div>
    );
};

const FundsTab: React.FC<{ data: IntegratedFundData[], hiddenFunds: Record<string, boolean> }> = ({ data, hiddenFunds }) => {
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">მონაცემები მზადდება...</div>;

    const visibleData = data.filter(f => !hiddenFunds[f.id]);

    const fundsByCat = {
        Direct: visibleData.filter(f => f.category === 'Direct').map(f => ({ ...f, incomeFromDistribution: f.approved })),
        Marginal: visibleData.filter(f => f.category === 'Marginal').map(f => ({ ...f, incomeFromDistribution: f.approved })),
        Adjustable: visibleData.filter(f => f.category === 'Adjustable').map(f => ({ ...f, incomeFromDistribution: f.approved })),
        Special: visibleData.filter(f => f.category === 'Special').map(f => ({ ...f, incomeFromDistribution: f.approved })),
    };
    
    const calculateTotals = (funds: any[]) => funds.reduce((acc, fund) => { 
        acc.carryOver += fund.carryOver; 
        acc.incomeFromDistribution += fund.incomeFromDistribution; 
        acc.afterDistribution += (fund.carryOver + fund.incomeFromDistribution); 
        acc.expense += fund.expense; 
        acc.remainingAfterExpense += (fund.carryOver + fund.incomeFromDistribution - fund.expense); 
        acc.returnedUnspent += fund.returnedUnspent; 
        acc.finalAmount += (fund.carryOver + fund.incomeFromDistribution - fund.expense + fund.returnedUnspent); 
        return acc; 
    }, { carryOver: 0, incomeFromDistribution: 0, afterDistribution: 0, expense: 0, remainingAfterExpense: 0, returnedUnspent: 0, finalAmount: 0 });
    
    const grandTotals = calculateTotals(Object.values(fundsByCat).flat());
    
    const renderFundRow = (fund: any, isTotal = false) => {
        const afterDistribution = fund.carryOver + fund.incomeFromDistribution; 
        const remainingAfterExpense = afterDistribution - fund.expense; 
        const finalAmount = remainingAfterExpense + fund.returnedUnspent;
        return (
            <tr key={isTotal ? 'total' : fund.id} className={isTotal ? "bg-gray-800 text-white font-bold" : "hover:bg-gray-50"}>
                <td className={`px-3 py-2 font-bold ${isTotal ? 'bg-gray-800' : 'bg-white'} sticky left-0 min-w-[150px]`}>{fund.name}</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumber(fund.carryOver)}</td>
                <td className="px-3 py-2 text-center font-mono text-[10px] md:text-xs">{isTotal ? '-' : `${fund.distributionPercentage.toFixed(2)}%`}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700 font-bold">+{formatNumber(fund.incomeFromDistribution)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumber(afterDistribution)}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700 font-bold">-{formatNumber(fund.expense)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumber(remainingAfterExpense)}</td>
                <td className="px-3 py-2 text-right font-mono text-blue-700 font-bold">+{formatNumber(fund.returnedUnspent)}</td>
                <td className={`px-3 py-2 text-right font-mono font-bold ${isTotal ? 'text-lg md:text-xl' : ''}`}>{formatNumber(finalAmount)}</td>
            </tr>
        );
    };

    return (
        <div className="space-y-6">
            <p className="text-xs md:text-sm text-gray-500">ეს არის მხოლოდ წასაკითხი რეჟიმი. მონაცემები ასახავს ფონდების დეტალურ მოძრაობას და სინქრონიზებულია დირექტივის (ეტაპი 3) გვერდთან.</p>
            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm -mx-2 md:mx-0">
                <div className="min-w-[800px]">
                    <table className="w-full text-[10px] md:text-xs whitespace-nowrap">
                        <thead className="bg-gray-200 text-gray-700 font-bold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 text-left sticky left-0 bg-gray-200 z-20 w-48 md:w-64">დასახელება</th>
                                <th className="px-3 py-3 text-right">ძველი პერიოდან გადმოსული</th>
                                <th className="px-3 py-3 text-center">განაწილების %</th>
                                <th className="px-3 py-3 text-right">შემოსავალი განაწილების შედეგად</th>
                                <th className="px-3 py-3 text-right">განაწილების შემდეგ</th>
                                <th className="px-3 py-3 text-right">ხარჯი ფონდიდან</th>
                                <th className="px-3 py-3 text-right">დარჩენილი</th>
                                <th className="px-3 py-3 text-right">დაბრუნებული დაუხარჯავი</th>
                                <th className="px-3 py-3 text-right">საბოლოო თანხა</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr className="bg-blue-50"><td colSpan={9} className="px-3 py-2 font-bold text-blue-800 text-xs md:text-sm sticky left-0">SECTION A: პირდაპირი ხარჯის ფონდები</td></tr>
                            {fundsByCat.Direct.map(fund => renderFundRow(fund))}
                            <tr className="bg-purple-50"><td colSpan={9} className="px-3 py-2 font-bold text-purple-800 text-xs md:text-sm sticky left-0">SECTION B: მარჟინალური ხარჯების ფონდები</td></tr>
                            {fundsByCat.Marginal.map(fund => renderFundRow(fund))}
                            <tr className="bg-green-50"><td colSpan={9} className="px-3 py-2 font-bold text-green-800 text-xs md:text-sm sticky left-0">SECTION C: კორექტირებადი ხარჯების ფონდები</td></tr>
                            {fundsByCat.Adjustable.map(fund => renderFundRow(fund))}
                            <tr className="bg-red-50"><td colSpan={9} className="px-3 py-2 font-bold text-red-800 text-xs md:text-sm sticky left-0">SECTION D: განსაკუთრებული ფონდები</td></tr>
                            {fundsByCat.Special.map(fund => renderFundRow(fund))}
                        </tbody>
                        <tfoot className="sticky bottom-0">
                            <tr className="bg-gray-800">
                                <td colSpan={9} className="px-3 py-2 font-extrabold text-white text-xs md:text-sm tracking-wider sticky left-0">SECTION C: TOTALS (SUM)</td>
                            </tr>
                            {renderFundRow({ name: 'სულ ჯამი', ...grandTotals }, true)}
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DirectivesTab: React.FC<{ data: IntegratedFundData[], revenue: any, margin: any, onUpdate: (id: string, value: number) => void, user: User, hiddenFunds: Record<string, boolean>, toggleFundVisibility: (id: string) => void, toggleSectionVisibility: (cat: string) => void, isLocked: boolean }> = ({ data, revenue, margin, onUpdate, user, hiddenFunds, toggleFundVisibility, toggleSectionVisibility, isLocked }) => {
    const isTopLevel = [UserRole.FOUNDER, UserRole.CEO, UserRole.FIN_DIRECTOR].includes(user.role);

    if (!data || data.length === 0) return <div className="p-12 text-center text-gray-500">მონაცემები მზადდება...</div>;

    const fundsByCat = {
        Direct: data.filter(d => d.category === 'Direct'),
        Marginal: data.filter(d => d.category === 'Marginal'),
        Adjustable: data.filter(d => d.category === 'Adjustable'),
        Special: data.filter(d => d.category === 'Special'),
    };
    
    const totalCalculated = data.reduce((sum, d) => sum + d.calculated, 0);
    const totalApproved = data.reduce((sum, d) => sum + d.approved, 0);
    const remainingBalance = revenue.total - totalApproved;

    const renderSection = (title: string, funds: IntegratedFundData[], category: 'Direct' | 'Marginal' | 'Adjustable' | 'Special', bgColor: string) => {
      const isSectionHidden = funds.every(f => hiddenFunds[f.id]);
      return (
        <React.Fragment key={category}>
            <tr className={bgColor}>
                <td colSpan={5} className="p-2 font-bold text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                        {isTopLevel && <button onClick={() => toggleSectionVisibility(category)}>{isSectionHidden ? <EyeOff size={14}/> : <Eye size={14}/>}</button>}
                        {title}
                    </div>
                </td>
            </tr>
            {funds.filter(f => !hiddenFunds[f.id]).map(fund => {
              const approvedExceeds = fund.approved > fund.available;
              const calculatedAmount = fund.calculated;
              const currentPct = revenue.total > 0 ? (fund.approved / revenue.total) * 100 : 0;

              return (
                <tr key={fund.id} className="border-b">
                  <td className="p-2 font-bold flex items-center gap-2 min-w-[150px]">
                    {isTopLevel && <button onClick={() => toggleFundVisibility(fund.id)}>{hiddenFunds[fund.id] ? <EyeOff size={14} className="text-gray-400"/> : <Eye size={14}/>}</button>}
                    <span className="text-[10px] md:text-xs">{fund.name}</span>
                  </td>
                  <td className="p-2 text-right font-mono text-[10px] md:text-xs">{formatNumber(fund.available)}</td>
                  <td className={`p-2 text-center font-mono font-bold text-[10px] md:text-xs ${fund.category === 'Adjustable' ? 'bg-gray-100' : 'text-gray-600'}`}>
                      {currentPct.toFixed(2)}%
                  </td>
                  <td className="p-2 text-right font-mono text-gray-500 text-[10px] md:text-xs">{formatNumber(calculatedAmount)}</td>
                  <td className="p-1 min-w-[100px]">
                      <input 
                        type="number" 
                        value={Math.round(fund.approved)} 
                        onChange={(e) => onUpdate(fund.id, parseFloat(e.target.value))} 
                        disabled={isLocked}
                        className={`w-full text-right font-mono font-bold text-xs md:text-sm p-2 rounded bg-yellow-50 border ${approvedExceeds ? 'border-red-500 text-red-600' : 'border-yellow-300'} outline-none focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200`}
                      />
                  </td>
                </tr>
              );
            })}
        </React.Fragment>
      );
    };

    return (
        <div className="space-y-8">
            <div><h2 className="text-xl md:text-2xl font-bold">დირექტივა (Step 3)</h2><p className="text-xs md:text-sm text-gray-500">ფონდების განაწილების საბოლოო დამტკიცება.</p></div>
            
            <div className="bg-gray-50 p-4 md:p-6 border border-gray-200 rounded-lg">
                <h3 className="font-bold text-base md:text-lg mb-4 border-b pb-2">BLOCK A: შემოსავალი</h3>
                <div className="space-y-2 text-xs md:text-sm">
                    <div className="flex justify-between"><span>პროექტები:</span><span className="font-mono font-bold">{formatNumber(revenue.projects)}</span></div>
                    <div className="flex justify-between"><span>სერვისი:</span><span className="font-mono font-bold">{formatNumber(revenue.service)}</span></div>
                    <div className="flex justify-between"><span>ნაწილები:</span><span className="font-mono font-bold">{formatNumber(revenue.parts)}</span></div>
                    <div className="flex justify-between"><span>ბიუჯეტიდან დაბრუნებული:</span><span className="font-mono font-bold">{formatNumber(revenue.returned)}</span></div>
                    <div className="flex justify-between font-extrabold text-sm md:text-base pt-2 border-t mt-2"><span>სულ:</span><span className="font-mono">{formatNumber(revenue.total)}</span></div>
                </div>
            </div>

            <div className="bg-white p-4 md:p-6 border border-gray-200 rounded-lg">
                <h3 className="font-bold text-base md:text-lg mb-4 border-b pb-2">BLOCK B: ფონდების განაწილება</h3>
                <div className="overflow-x-auto -mx-2 md:mx-0" style={{ maxHeight: '60vh' }}>
                    <div className="min-w-[600px]">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-100 z-10 font-bold uppercase text-[10px] md:text-xs">
                                <tr>
                                    <th className="p-2 text-left">ფონდის დასახელება</th>
                                    <th className="p-2 text-right">ხელმისაწვდომი</th>
                                    <th className="p-2 text-center w-24">განაწილების %</th>
                                    <th className="p-2 text-right">გამოთვლილი თანხა</th>
                                    <th className="p-2 text-right w-32">დამტკიცებული</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderSection('SECTION A: პირდაპირი ხარჯის ფონდები (MANUAL)', fundsByCat.Direct, 'Direct', 'bg-blue-50 text-blue-800')}
                                {renderSection('SECTION B: მარჟინალური ხარჯების ფონდები (MANUAL)', fundsByCat.Marginal, 'Marginal', 'bg-purple-50 text-purple-800')}
                                {renderSection('SECTION C: კორექტირებადი ხარჯების ფონდები (AUTOMATIC)', fundsByCat.Adjustable, 'Adjustable', 'bg-green-50 text-green-800')}
                                {renderSection('SECTION D: განსაკუთრებული ფონდები (MANUAL)', fundsByCat.Special, 'Special', 'bg-red-50 text-red-800')}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white font-bold text-[10px] md:text-xs">
                                    <td className="p-2">სულ:</td>
                                    <td className="p-2 text-right font-mono">-</td>
                                    <td className="p-2 text-center font-mono">{data.reduce((s,d)=>d.category === 'Adjustable' ? s + d.distributionPercentage : s, 0).toFixed(2)}%</td>
                                    <td className="p-2 text-right font-mono">{formatNumber(totalCalculated)}</td>
                                    <td className="p-2 text-right font-mono">{formatNumber(totalApproved)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="p-2 text-right font-bold text-sm md:text-lg">ნაშთი განაწილებისთვის:</td>
                                    <td className={`p-2 text-right font-mono font-extrabold text-sm md:text-lg ${remainingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatNumber(remainingBalance)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-4 md:p-6 border border-gray-200 rounded-lg">
                <h3 className="font-bold text-base md:text-lg mb-4 border-b pb-2">BLOCK C: მარჟა & კორექტირება</h3>
                <div className="space-y-2 text-xs md:text-sm">
                    <div className="flex justify-between"><span>მარჟა (პროექტები):</span><span className="font-mono font-bold">{formatNumber(margin.projects)}</span></div>
                    <div className="flex justify-between"><span>მარჟა (სერვისი):</span><span className="font-mono font-bold">{formatNumber(margin.service)}</span></div>
                    <div className="flex justify-between"><span>მარჟა (ნაწილები):</span><span className="font-mono font-bold">{formatNumber(margin.parts)}</span></div>
                    <div className="flex justify-between font-extrabold text-sm md:text-base pt-2 border-t mt-2"><span>კორექტირებადი შემოსავალი:</span><span className="font-mono">{formatNumber(margin.adjustable)}</span></div>
                </div>
            </div>
        </div>
    );
};

interface FullOverviewTabProps {
  allRequests: ExpenseRequest[];
  sessions: any[]; 
  expenseFunds: any[];
  fundRules: any[];
  fundBalances: FundBalance[];
  loading: boolean;
  user: User;
  integratedFundData: IntegratedFundData[];
  onStartNewWeek: () => void;
  isPeriodLocked: boolean;
  onDispatchLiveDirective: () => void;
  currentTotalRevenue: number;
}

const FullOverviewTab: React.FC<FullOverviewTabProps> = ({ allRequests, sessions, expenseFunds, fundRules, fundBalances, loading, user, integratedFundData, onStartNewWeek, isPeriodLocked, onDispatchLiveDirective, currentTotalRevenue }) => {
    const isAuthorized = user.role === 'FIN_DIRECTOR' || user.role === 'FOUNDER';
    const [searchQuery, setSearchQuery] = useState('');
    const [archiveHistory, setArchiveHistory] = useState<any[]>([]);
    
    // [ENHANCEMENT: READ-ONLY VIEW & ACCOUNTING STATUS]
    const [viewingRecord, setViewingRecord] = useState<any | null>(null);
    const [accountingStatuses, setAccountingStatuses] = useState<Record<string, boolean>>({});

    useEffect(() => {
        try {
            const saved = localStorage.getItem('mgmt_archive_history');
            if (saved) {
                const history = JSON.parse(saved);
                setArchiveHistory(history);
                
                // Sync accounting status from localStorage (mock)
                const statuses: Record<string, boolean> = {};
                history.forEach((log: any) => {
                    const isDone = localStorage.getItem(`accounting_task_complete_${log.id}`);
                    if (isDone === 'true') statuses[log.id] = true;
                });
                setAccountingStatuses(statuses);
            }
        } catch (e) {}
    }, []);

    const summaryData = useMemo(() => {
        const totalRevenue = sessions.reduce((sum, s) => sum + s.totalRevenue, 0);
        const totalExpense = allRequests.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.totalAmount, 0);
        const freeBalance = totalRevenue - totalExpense;
        const reserveBalance = fundBalances
            .filter(fb => expenseFunds.find(ef => ef.id === fb.id)?.category === 'Special')
            .reduce((sum, fb) => sum + fb.remaining, 0);
        return { totalRevenue, totalExpense, freeBalance, reserveBalance };
    }, [allRequests, sessions, fundBalances, expenseFunds]);

    const weeklyBreakdown = useMemo(() => {
        const paidRequestsByDate = allRequests
            .filter(r => r.status === 'paid' && r.boardDate)
            .reduce((acc, req) => {
                const key = req.boardDate;
                if (!acc[key]) acc[key] = [];
                acc[key].push(req);
                return acc;
            }, {} as Record<string, ExpenseRequest[]>);

        return sessions
            .sort((a, b) => new Date(b.dateConducted).getTime() - new Date(a.dateConducted).getTime())
            .map(session => {
                const weeklyRequests = paidRequestsByDate[session.dateConducted] || [];
                const funds = expenseFunds.map(fund => {
                    const actual = weeklyRequests
                        .filter(r => r.assignedFundId === fund.id)
                        .reduce((sum, r) => sum + r.totalAmount, 0);
                    
                    const rule = fundRules.find(r => r.id === fund.id) || { percentage: 0 };
                    
                    let planned = 0;
                    if (fund.category === 'Direct') {
                        planned = actual; 
                    } else {
                        planned = session.totalRevenue * (rule.percentage / 100);
                    }
                    
                    return { id: fund.id, name: fund.name, category: fund.category, planned, actual, variance: planned - actual };
                });

                const fundsByCategory = {
                    Direct: funds.filter(f => f.category === 'Direct'),
                    Marginal: funds.filter(f => f.category === 'Marginal'),
                    Adjustable: funds.filter(f => f.category === 'Adjustable'),
                    Special: funds.filter(f => f.category === 'Special'),
                };
                return { session, fundsByCategory };
            });
    }, [allRequests, sessions, expenseFunds, fundRules]);

    const filteredBreakdown = useMemo(() => {
        if (!searchQuery) return weeklyBreakdown;
        const lowercasedQuery = searchQuery.toLowerCase();
        
        return weeklyBreakdown
            .map(week => {
                const filteredFundsByCategory: Record<string, any[]> = {};
                let hasMatch = false;
                Object.entries(week.fundsByCategory).forEach(([category, funds]) => {
                    const matchingFunds = funds.filter(fund =>
                        fund.name.toLowerCase().includes(lowercasedQuery) ||
                        category.toLowerCase().includes(lowercasedQuery)
                    );
                    if (matchingFunds.length > 0) {
                        filteredFundsByCategory[category] = matchingFunds;
                        hasMatch = true;
                    }
                });
                return hasMatch ? { ...week, fundsByCategory: filteredFundsByCategory } : null;
            })
            .filter(Boolean) as typeof weeklyBreakdown;
    }, [searchQuery, weeklyBreakdown]);


    if (loading) return <div className="p-12 text-center text-gray-500">იტვირთება სრული სურათი...</div>;
    
    const getStatusColor = (variance: number, planned: number) => {
        if (planned === 0 && variance === 0) return 'text-gray-300';
        if (planned === 0 && variance < 0) return 'text-orange-500';
        if (planned === 0) return 'text-gray-300';
        const percentage = Math.abs(variance / planned);
        if (percentage < 0.1) return 'text-green-500';
        if (percentage < 0.25) return 'text-yellow-500';
        return 'text-red-500';
    };

    const handleTransferToAccounting = async (id: number) => {
        if (!window.confirm("გსურთ მონაცემების ბუღალტერიაში გადაგზავნა?")) return;
        
        // 1. Update Local State & Storage
        const updated = archiveHistory.map((item: any) => 
            item.id === id ? { ...item, status: 'SENT' } : item
        );
        setArchiveHistory(updated);
        localStorage.setItem('mgmt_archive_history', JSON.stringify(updated));

        // 2. Dispatch to Mock Service (Bridge to standard flow for Accountant)
        const record = archiveHistory.find(r => r.id === id);
        if (record) {
             const mockSession: any = {
                 id: record.id.toString(),
                 weekNumber: 0,
                 periodStart: record.date,
                 periodEnd: record.date,
                 dateConducted: new Date(record.id).toISOString(),
                 totalRevenue: record.totalRevenue,
                 totalAmount: 0,
                 netBalance: 0,
                 status: 'archived'
             };
             try {
                await dispatchDirectivesToAccounting(user, record.data, mockSession);
             } catch(e) {
                console.warn("Mock Service Dispatch Warning:", e);
             }
        }
        
        // 3. Dispatch storage event for instant synchronization
        window.dispatchEvent(new Event('storage'));

        alert("დირექტივა წარმატებით გადაიგზავნა ბუღალტერიაში.");
    };

    const handleAccountingComplete = (id: number) => {
        if (!window.confirm("ადასტურებთ, რომ ბუღალტერიამ შეასრულა ეს დირექტივა?")) return;
        const key = `accounting_task_complete_${id}`;
        localStorage.setItem(key, 'true');
        setAccountingStatuses(prev => ({ ...prev, [id]: true }));
        window.dispatchEvent(new Event('storage'));
    };

    const renderRecordDetails = () => {
        if (!viewingRecord) return null;
        const totalApp = viewingRecord.data?.reduce((sum:number, i:any) => sum + (i.approved || 0), 0) || 0;
        
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-base md:text-lg">არქივის ჩანაწერი: {viewingRecord.date}</h3>
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded uppercase border border-red-200 whitespace-nowrap">Read-Only View</span>
                        </div>
                        <button onClick={() => setViewingRecord(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-4 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <div className="text-gray-500 text-xs uppercase font-bold mb-1">სრული შემოსავალი</div>
                                <div className="font-mono font-bold text-xl text-black">{formatNumber(viewingRecord.totalRevenue)} ₾</div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <div className="text-gray-500 text-xs uppercase font-bold mb-1">განაწილდა (Approved)</div>
                                <div className="font-mono font-bold text-xl text-blue-600">{formatNumber(totalApp)} ₾</div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <div className="text-gray-500 text-xs uppercase font-bold mb-1">სტატუსი</div>
                                <div className={`font-bold text-lg ${viewingRecord.status === 'SENT' ? 'text-green-600' : 'text-gray-700'}`}>{viewingRecord.status}</div>
                            </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                            <div className="min-w-[600px]">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 font-bold text-gray-600 uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="p-3">ფონდი</th>
                                            <th className="p-3">კატეგორია</th>
                                            <th className="p-3 text-center">განაწილება %</th>
                                            <th className="p-3 text-right">დამტკიცებული (₾)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {viewingRecord.data?.map((item:any) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-bold text-gray-800">{item.name}</td>
                                                <td className="p-3 text-gray-500">{item.category}</td>
                                                <td className="p-3 text-center font-mono text-gray-400">{item.distributionPercentage ? `${item.distributionPercentage.toFixed(2)}%` : '-'}</td>
                                                <td className="p-3 text-right font-mono font-bold text-black bg-yellow-50/30">{formatNumber(item.approved)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-right uppercase text-gray-500">სულ ჯამი:</td>
                                            <td className="p-3 text-right font-mono text-blue-600 text-sm">{formatNumber(totalApp)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            {viewingRecord && renderRecordDetails()}
            
            {isAuthorized && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px', 
                backgroundColor: '#f8fafc', 
                borderRadius: '12px',
                marginBottom: '45px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                borderBottom: '3px solid #3b82f6',
                paddingBottom: '20px'
              }} className="md:flex-row gap-4">
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 700, letterSpacing: '-0.025em' }}>მართვის პანელი (ფინ. დირექტორი)</h3>
                
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                  <button
                    onClick={() => {
                        const snapshotData = integratedFundData.map(f => ({ ...f }));
                        const snapshot = {
                            id: Date.now(),
                            date: new Date().toLocaleDateString('ka-GE'),
                            totalRevenue: currentTotalRevenue, // Use actual calculated revenue
                            status: 'ARCHIVED', 
                            accountingStatus: 'pending', 
                            data: snapshotData
                        };
                        const updatedHistory = [snapshot, ...archiveHistory]; 
                        setArchiveHistory(updatedHistory);
                        localStorage.setItem('mgmt_archive_history', JSON.stringify(updatedHistory));
                        onStartNewWeek();
                        alert("პერიოდი დახურულია და შენახულია არქივში.");
                    }}
                    className="py-3 px-6 rounded-lg bg-white text-slate-700 border border-slate-300 font-bold cursor-pointer w-full md:w-auto hover:bg-gray-50 active:scale-95 transition-all text-sm md:text-base shadow-sm"
                  >
                    დახურვა
                  </button>

                  <button
                    onClick={onDispatchLiveDirective}
                    disabled={isPeriodLocked}
                    className={`py-3 px-6 rounded-lg bg-blue-600 text-white border-none font-bold w-full md:w-auto text-sm md:text-base transition-all ${isPeriodLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-blue-700'}`}
                  >
                    გადაცემა
                  </button>
                </div>
              </div>
            )}

            <div style={{ 
                height: '1px', 
                backgroundColor: '#e2e8f0', 
                margin: '35px 0', 
                width: '100%',
                position: 'relative', 
                display: 'block', 
                clear: 'both' 
            }}>
                <span style={{ 
                    position: 'absolute', 
                    top: '-12px', 
                    left: '0', 
                    backgroundColor: '#fff', 
                    paddingRight: '15px', 
                    fontSize: '13px', 
                    color: '#64748b', 
                    fontWeight: 'bold', 
                    textTransform: 'uppercase' 
                }}>
                    📁 არქივის ჩანაწერები
                </span>
            </div>

            <div className="border border-gray-200 rounded-lg shadow-sm mb-8 overflow-x-auto">
                <div className="min-w-[800px]">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-gray-100 text-gray-600 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3">თარიღი</th>
                                <th className="px-4 py-3 text-right">სრული შემოსავალი</th>
                                <th className="px-4 py-3 text-right">განაწილდა</th>
                                <th className="px-4 py-3 text-center">სტატუსი</th>
                                <th className="px-4 py-3 text-center">ქმედებები</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {archiveHistory.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-400">ისტორია ცარიელია</td></tr>
                            ) : (
                                archiveHistory.map((log: any) => {
                                    const totalApproved = log.data?.reduce((sum: number, item: any) => sum + (item.approved || 0), 0) || 0;
                                    const isAccComplete = accountingStatuses[log.id];
                                    const isSent = log.status === 'SENT';
                                    
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-gray-700">{log.date}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatNumber(log.totalRevenue)} ₾</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-blue-600">{formatNumber(totalApproved)} ₾</td>
                                            <td className="px-4 py-3 text-center">
                                                {isAccComplete ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200">
                                                        <CheckCircle2 size={12}/> შესრულებულია
                                                    </span>
                                                ) : isSent ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                                        <Send size={12}/> გადაცემულია
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200">
                                                        არქივი
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                               <div className="flex items-center justify-center gap-2">
                                                {!isSent && !isAccComplete && (
                                                    <button 
                                                        onClick={() => handleTransferToAccounting(log.id)}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                        title="გადაცემა"
                                                    >
                                                        <ArrowRightLeft size={16} />
                                                    </button>
                                                )}
                                                
                                                {isSent && !isAccComplete && (
                                                    <button 
                                                        onClick={() => handleAccountingComplete(log.id)}
                                                        className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors"
                                                        title="შესრულება"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => setViewingRecord(log)} 
                                                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                                                    title="დათვალიერება"
                                                >
                                                    <Eye size={16}/>
                                                </button>
                                               </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 text-white p-4 rounded-lg"><div className="text-[10px] md:text-xs font-bold uppercase opacity-70">ჯამური შემოსავალი</div><div className="text-xl md:text-2xl font-mono font-bold">{formatNumber(summaryData.totalRevenue)}</div></div>
                    <div className="bg-gray-800 text-white p-4 rounded-lg"><div className="text-[10px] md:text-xs font-bold uppercase opacity-70">ჯამური ხარჯი</div><div className="text-xl md:text-2xl font-mono font-bold">{formatNumber(summaryData.totalExpense)}</div></div>
                    <div className={`p-4 rounded-lg ${summaryData.freeBalance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}><div className="text-[10px] md:text-xs font-bold uppercase">თავისუფალი ნაშთი</div><div className="text-xl md:text-2xl font-mono font-bold">{formatNumber(summaryData.freeBalance)}</div></div>
                    <div className="bg-blue-100 text-blue-800 p-4 rounded-lg"><div className="text-[10px] md:text-xs font-bold uppercase">რეზერვი</div><div className="text-xl md:text-2xl font-mono font-bold">{formatNumber(summaryData.reserveBalance)}</div></div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="ფონდის ან კატეგორიის ძებნა..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none text-sm" />
                </div>

                <div className="border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                    <div className="min-w-[800px]">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                            <thead className="bg-gray-100 text-gray-600 font-bold uppercase"><tr className="border-b-2 border-gray-300"><th className="px-3 py-3">Date / კვირა</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Fund Name</th><th className="px-3 py-3 text-right">Planned (₾)</th><th className="px-3 py-3 text-right">Actual (₾)</th><th className="px-3 py-3 text-right">Variance (₾)</th><th className="px-3 py-3 text-center">Status</th></tr></thead>
                            <tbody>
                                {filteredBreakdown.length === 0 && (<tr><td colSpan={7} className="text-center p-8 text-gray-400">მონაცემები არ მოიძებნა.</td></tr>)}
                                {filteredBreakdown.map(({ session, fundsByCategory }) => (
                                    <React.Fragment key={session.id}>
                                        <tr className="bg-gray-50 border-y-2 border-gray-200"><td colSpan={7} className="px-3 py-2 font-bold text-black">კვირა #{session.weekNumber} ({session.periodStart} - {session.periodEnd})</td></tr>
                                        {Object.entries(fundsByCategory).map(([category, funds]) => (
                                        funds.length > 0 && <React.Fragment key={category}>
                                            {funds.map((fund: any, index) => (
                                                <tr key={fund.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    {index === 0 && <td rowSpan={funds.length} className="px-3 py-2 align-top font-bold text-gray-500 border-r">{session.dateConducted ? new Date(session.dateConducted).toLocaleDateString('ka-GE') : '-'}</td>}
                                                    {index === 0 && <td rowSpan={funds.length} className="px-3 py-2 align-top font-bold border-r">{category}</td>}
                                                    <td className="px-3 py-2">{fund.name}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-gray-700">{formatNumber(fund.planned)}</td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold">{formatNumber(fund.actual)}</td>
                                                    <td className={`px-3 py-2 text-right font-mono font-bold ${fund.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNumber(fund.variance)}</td>
                                                    <td className="px-3 py-2 text-center"><Circle size={12} className={getStatusColor(fund.variance, fund.planned)} fill="currentColor" /></td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ManagementView: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<ManagementTab>('cover');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<any[]>([]);
  const [expenseFunds, setExpenseFunds] = useState<any[]>([]);
  const [realTimeBalances, setRealTimeBalances] = useState<FundBalance[]>([]);
  const [allRequests, setAllRequests] = useState<ExpenseRequest[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [fundRules, setFundRules] = useState<any[]>([]);
  const [budget2026, setBudget2026] = useState<any[]>([]);
  
  const [directiveOverrides, setDirectiveOverrides] = useState<Record<string, number>>({});
  const [hiddenFunds, setHiddenFunds] = useState<Record<string, boolean>>({});
  const [isPeriodLocked, setIsPeriodLocked] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [banks, cats, funds, balances, reqs, sess, budget] = await Promise.all([
        getBankAccounts(),
        getRevenueCategories(),
        getExpenseFunds(),
        getRealTimeFundBalances(),
        getAllRequests(),
        getFinancialCouncilSessions(),
        getAnnualBudget(2026)
    ]);

    setBankAccounts(banks);
    setRevenueCategories(cats);
    setExpenseFunds(funds);
    setRealTimeBalances(balances);
    setAllRequests(reqs);
    setSessions(sess);
    setBudget2026(budget);
    
    const totalRevenue2026 = budget
          .filter((item: any) => item.type === 'revenue')
          .reduce((sum: number, item: any) => sum + (item.plannedAmount || 0), 0);
    const budget2026MapByName = new Map(budget.map((item: any) => [item.name, item]));

    const rules = funds.map((fund: any) => {
        const budgetItem = budget2026MapByName.get(fund.name);
        let percentage = 0;
        if (budgetItem && totalRevenue2026 > 0) {
            percentage = (Math.abs(budgetItem.plannedAmount) / totalRevenue2026) * 100;
        }
        return { id: fund.id, percentage };
    });
    setFundRules(rules);

    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartNewWeek = async () => {
      setDirectiveOverrides({});
      setIsPeriodLocked(false);
      await fetchData();
  };

  const aggregatedRevenue = useMemo(() => {
      const categoryMap = revenueCategories.reduce((acc: any, cat: any) => {
            acc[cat.id] = cat.name;
            return acc;
        }, {} as Record<string, string>);

      return bankAccounts.reduce((acc: any, account: any) => {
            if (account.mappedCategoryId) {
                const categoryName = categoryMap[account.mappedCategoryId];
                if (categoryName) {
                    const bankName = account.bankName && account.bankName.trim() !== '' ? account.bankName : 'დაუზუსტებელი ბანკი';
                    if (!acc[categoryName]) acc[categoryName] = {};
                    if (!acc[categoryName][bankName]) acc[categoryName][bankName] = 0;
                    acc[categoryName][bankName] += account.currentBalance;
                }
            }
            return acc;
        }, {} as AggregatedRevenue);
  }, [bankAccounts, revenueCategories]);

  const integratedFundData: IntegratedFundData[] = useMemo(() => {
      const totalRevenue = bankAccounts
        .filter(b => !!b.mappedCategoryId)
        .reduce((sum, b) => sum + b.currentBalance, 0);

      return expenseFunds.map(fund => {
          const rule = fundRules.find((r: any) => r.id === fund.id) || { percentage: 0 };
          const balance = realTimeBalances.find(b => b.id === fund.id);
          
          const calculated = (totalRevenue * rule.percentage) / 100;
          const approved = directiveOverrides[fund.id] !== undefined ? directiveOverrides[fund.id] : calculated;
          
          return {
              id: fund.id,
              name: fund.name,
              category: fund.category,
              available: totalRevenue, 
              calculated: calculated,
              approved: approved,
              carryOver: 0, 
              expense: balance?.totalSpent || 0,
              returnedUnspent: 0, 
              distributionPercentage: rule.percentage
          };
      });
  }, [expenseFunds, fundRules, realTimeBalances, bankAccounts, directiveOverrides]);

  const revenueSummary = useMemo(() => {
      const totals: any = { projects: 0, service: 0, parts: 0, returned: 0, total: 0 };
      Object.entries(aggregatedRevenue).forEach(([cat, banks]) => {
          const sum = Object.values(banks).reduce((a, b) => a + b, 0);
          if (cat === 'პროექტები') totals.projects += sum;
          else if (cat === 'სერვისი') totals.service += sum;
          else if (cat === 'ნაწილები') totals.parts += sum;
          totals.total += sum;
      });
      return totals;
  }, [aggregatedRevenue]);

  const marginSummary = { projects: 0, service: 0, parts: 0, adjustable: 0 }; 

  const handleUpdateDirective = (id: string, value: number) => {
      if (isPeriodLocked) return;
      setDirectiveOverrides(prev => ({ ...prev, [id]: value }));
  };

  const toggleFundVisibility = (id: string) => setHiddenFunds(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSectionVisibility = (cat: string) => {
      const funds = expenseFunds.filter(f => f.category === cat);
      const allHidden = funds.every(f => hiddenFunds[f.id]);
      const newState = { ...hiddenFunds };
      funds.forEach(f => newState[f.id] = !allHidden);
      setHiddenFunds(newState);
  };

  const handleDispatchLiveDirective = async () => {
    // 1. Create Snapshot Data
    const snapshotData = integratedFundData.map(f => ({
      fundName: f.name,
      category: f.category,
      approvedAmount: f.approved
    }));

    const snapshot: DirectiveSnapshot = {
        id: Date.now().toString(),
        weekNumber: 0, // Should calculate current week properly in real scenario
        periodStart: new Date().toLocaleDateString('ka-GE'),
        periodEnd: new Date().toLocaleDateString('ka-GE'),
        dispatchedByUserId: user.id,
        dispatchedByName: user.name,
        dispatchedAt: new Date().toISOString(),
        directivesData: snapshotData,
        status: 'pending'
    };

    // 2. Save to Storage
    addDirective(snapshot);

    // 3. Dispatch to Mock Service (for visual consistency in other components if needed)
    // We mock the session object required by the legacy mock function
    const mockSession = {
        id: snapshot.id,
        weekNumber: 0,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        dateConducted: snapshot.dispatchedAt,
        totalRevenue: revenueSummary.total,
        totalAmount: 0,
        netBalance: 0,
        status: 'active'
    };
    await dispatchDirectivesToAccounting(user, integratedFundData, mockSession as any);

    // 4. Lock UI
    setIsPeriodLocked(true);
    alert("დირექტივა წარმატებით გადაიგზავნა ბუღალტერიაში.");
  };

  const tabs = [
      { id: 'cover', label: 'თავფურცელი', icon: Briefcase },
      { id: 'revenue', label: 'შემოსავლები', icon: Download },
      { id: 'funds', label: 'ფონდები', icon: RefreshCw },
      { id: 'directives', label: 'დირექტივა', icon: ArrowRightLeft },
      { id: 'full', label: 'სრული სურათი', icon: Eye },
  ];

  return (
      <div className="space-y-6 font-sans">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
              <div className="flex overflow-x-auto scrollbar-hide">
                  {tabs.map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as ManagementTab)}
                          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-black text-black' : 'text-gray-500 hover:text-black'}`}
                      >
                          <tab.icon size={18} />
                          {tab.label}
                      </button>
                  ))}
              </div>
          </div>

          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm min-h-[600px]">
              {activeTab === 'cover' && <CoverPageTab />}
              {activeTab === 'revenue' && <RevenueSummaryTab data={aggregatedRevenue} loading={loading} lastUpdated={lastUpdated} />}
              {activeTab === 'funds' && <FundsTab data={integratedFundData} hiddenFunds={hiddenFunds} />}
              {activeTab === 'directives' && (
                  <DirectivesTab 
                    data={integratedFundData} 
                    revenue={revenueSummary} 
                    margin={marginSummary} 
                    onUpdate={handleUpdateDirective} 
                    user={user}
                    hiddenFunds={hiddenFunds}
                    toggleFundVisibility={toggleFundVisibility}
                    toggleSectionVisibility={toggleSectionVisibility}
                    isLocked={isPeriodLocked}
                  />
              )}
              {activeTab === 'full' && (
                  <FullOverviewTab 
                    allRequests={allRequests} 
                    sessions={sessions} 
                    expenseFunds={expenseFunds} 
                    fundRules={fundRules} 
                    fundBalances={realTimeBalances} 
                    loading={loading} 
                    user={user}
                    integratedFundData={integratedFundData}
                    onStartNewWeek={handleStartNewWeek}
                    isPeriodLocked={isPeriodLocked}
                    onDispatchLiveDirective={handleDispatchLiveDirective}
                    currentTotalRevenue={revenueSummary.total}
                  />
              )}
          </div>
      </div>
  );
};
