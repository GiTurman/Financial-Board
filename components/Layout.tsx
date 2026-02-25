
import React, { ReactNode, useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  LogOut, 
  FileText,
  Users,
  UserPlus, // Imported for Customers module
  Globe,
  Gavel, // Icon for Approvals
  Calculator, // Icon for Accounting
  Archive, // Icon for Global Archive
  PieChart, // For Budgeting
  TrendingUp, // For Budgeting
  History, // For Budgeting
  Share2, // PROMPT 4.1-012
  Briefcase, // PROMPT 5.1-002
  CircleDollarSign, // PROMPT 6.1-006
  PanelLeftClose, // PROMPT 6.3-012
  PanelLeftOpen, // PROMPT 6.3-012
  Info, // PROMPT 6.3-015
  FolderKanban, // PROMPT 6.7-001
  Server, // PROMPT 6.7-001
  Package, // PROMPT 6.7-001
  BarChart2,
  ChevronDown,
  ChevronRight,
  Scale, // PROMPT 7.3 - 008
  FileCheck, // For generated invoices
} from 'lucide-react';
import { User, UserRole, Language } from '../types';
import { getCurrencyRates, getInflationRate } from '../services/mockService'; // PROMPT 6.2-009 & 6.3-015

interface LayoutProps {
  children: ReactNode;
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isSidebarExpanded: boolean;
}

const translations = {
  dashboard: { EN: 'Dashboard', GE: 'მთავარი' },
  request: { EN: 'New Request', GE: 'ახალი მოთხოვნა' },
  users: { EN: 'User Management', GE: 'მომხმარებლები' },
  settings: { EN: 'Settings', GE: 'პარამეტრები' },
  logout: { EN: 'Logout', GE: 'გასვლა' },
  approvals: { EN: 'Board Approvals', GE: 'ფინანსური საბჭო' },
  'council-share': { EN: 'Financial Board (Share)', GE: 'ფინანსური საბჭო (გაზიარება)' },
  management: { EN: 'Management', GE: 'მენეჯეტი' },
  accounting: { EN: 'Chief Accountant', GE: 'მთავარი ბუღალტერი' },
  'sub-accounting': { EN: 'Accountant', GE: 'ბუღალტერი' },
  inventory: { EN: 'Parts', GE: 'ნაწილები' }, 
  'inventory-proforma': { EN: 'Proforma Invoices', GE: 'პროფორმა ინვოისები' }, 
  'inventory-generated': { EN: 'Generated Invoices', GE: 'გენერირებული ინვოისები' }, 
  customers: { EN: 'Customers', GE: 'კლიენტები' }, // Added Customers translation
  archive: { EN: 'Global Archive', GE: 'არქივი' },
  'cash-inflow': { EN: 'Cash Inflow', GE: 'შემოსავლები' }, // PROMPT 6.1-006
  'revenue-projects': { EN: 'Projects', GE: 'პროექტები' }, // PROMPT 6.7-001
  'revenue-service': { EN: 'Service', GE: 'სერვისი' }, // PROMPT 6.7-001
  'revenue-parts': { EN: 'Parts', GE: 'ნაწილები' }, // PROMPT 6.7-001
};

const ROLE_LABELS: Record<UserRole, { EN: string, GE: string }> = {
  [UserRole.FOUNDER]: { EN: 'Founder', GE: 'დამფუძნებელი' },
  [UserRole.FIN_DIRECTOR]: { EN: 'Financial Director', GE: 'ფინანსური დირექტორი' },
  [UserRole.CEO]: { EN: 'CEO', GE: 'აღმასრულებელი დირექტორი' },
  [UserRole.COMMERCIAL_DIRECTOR]: { EN: 'Commercial Director', GE: 'კომერციული დირექტორი' },
  [UserRole.BIZ_DEV]: { EN: 'Business Dev', GE: 'ბიზნესის განვითარება' },
  [UserRole.TECH_DIRECTOR]: { EN: 'Tech Director', GE: 'ტექნიკური დირექტორი' },
  [UserRole.ADMIN]: { EN: 'Admin Manager', GE: 'ადმინისტრაციული მენეჯერი' },
  [UserRole.MANAGER]: { EN: 'Manager', GE: 'მენეჯერი' },
  [UserRole.EMPLOYEE]: { EN: 'Employee', GE: 'დასაქმებული' },
  [UserRole.ACCOUNTANT]: { EN: 'Chief Accountant', GE: 'მთავარი ბუღალტერი' },
  [UserRole.SUB_ACCOUNTANT]: { EN: 'Accountant', GE: 'ბუღალტერი' },
  [UserRole.PARTS_MANAGER]: { EN: 'Parts Manager', GE: 'ნაწილების მენეჯერი' },
};

const NavItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  mobile = false,
  isExpanded
}: { 
  icon: any; 
  label: string; 
  active: boolean; 
  onClick: () => void;
  mobile?: boolean;
  isExpanded: boolean;
}) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-3 px-4 py-2 transition-all duration-200 
      ${mobile 
        ? 'flex-col justify-center text-xs gap-1 py-2 border-t-2' 
        : `w-full text-left border-l-2 ${!isExpanded ? 'justify-center' : ''}`
      }
      ${active 
        ? mobile ? 'border-black' : 'border-black text-black font-bold bg-gray-50' 
        : `border-transparent text-gray-500 hover:text-black hover:bg-gray-50 ${mobile ? '' : ''}`
      }
    `}
    title={!isExpanded ? label : ''}
  >
    <Icon size={mobile ? 20 : 18} strokeWidth={active ? 2.5 : 2} />
    {isExpanded && !mobile && <span>{label}</span>}
    {mobile && <span>{label}</span>}
  </button>
);

// PROMPT 6.2-009 & 6.3-015: Currency & Inflation Widget
const CurrencyWidget = () => {
  const [rates, setRates] = useState({ USD: 0, EUR: 0 });
  const [inflation, setInflation] = useState(0);

  useEffect(() => {
    const fetchIndicators = async () => {
      setRates(await getCurrencyRates());
      setInflation(await getInflationRate());
    };
    fetchIndicators();
    const interval = setInterval(fetchIndicators, 30000); // Re-fetch every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
      <span>GEL/USD: <span className="text-black">{rates.USD.toFixed(2)}</span></span>
      <div className="w-px h-4 bg-gray-200" />
      <span>GEL/EUR: <span className="text-black">{rates.EUR.toFixed(2)}</span></span>
      <div className="w-px h-4 bg-gray-200" />
      <div className="flex items-center gap-1.5" title="ბოლო 12 თვის სამომხმარებლო ფასების ინდექსი (CPI)">
        <span>ინფლაცია: <span className="text-black">{inflation.toFixed(1)}%</span></span>
        <Info size={14} className="cursor-help" />
      </div>
    </div>
  );
};


export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  activeTab, 
  setActiveTab, 
  onLogout,
  language,
  setLanguage,
  isSidebarExpanded
}) => {
  const isAdmin = user.role === UserRole.FOUNDER || user.role === UserRole.FIN_DIRECTOR;
  const isTopLevel = user.role === UserRole.FOUNDER || user.role === UserRole.FIN_DIRECTOR || user.role === UserRole.CEO;
  const isManagerLevel = [UserRole.COMMERCIAL_DIRECTOR, UserRole.TECH_DIRECTOR, UserRole.ADMIN, UserRole.MANAGER, UserRole.PARTS_MANAGER].includes(user.role);
  const isAccountant = user.role === UserRole.ACCOUNTANT;
  const isSubAccountant = user.role === UserRole.SUB_ACCOUNTANT;
  const canViewGlobalArchive = user.role === UserRole.FOUNDER || user.role === UserRole.FIN_DIRECTOR;
  
  const canViewInventory = [
    UserRole.FOUNDER,
    UserRole.FIN_DIRECTOR,
    UserRole.CEO,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.ACCOUNTANT,
    UserRole.SUB_ACCOUNTANT,
    UserRole.PARTS_MANAGER
  ].includes(user.role);

  // PROMPT 6.8-003: Refined role-based access for Revenue Analysis
  const isCommercialDirector = user.role === UserRole.COMMERCIAL_DIRECTOR;
  const isTechDirector = user.role === UserRole.TECH_DIRECTOR;

  const canViewProjects = isTopLevel || isCommercialDirector;
  const canViewServiceAndParts = isTopLevel || isTechDirector;
  const canViewRevenueAnalysis = canViewProjects || canViewServiceAndParts;

  const [isRevenueAnalysisOpen, setIsRevenueAnalysisOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  
  const isRevenueAnalysisActive = ['revenue-projects', 'revenue-service', 'revenue-parts'].includes(activeTab);
  const isBudgetActive = ['prev-year-budget', 'curr-year-budget', 'budget-analysis'].includes(activeTab);
  const isInventoryActive = ['inventory-proforma', 'inventory-generated'].includes(activeTab);

  useEffect(() => {
    if (isRevenueAnalysisActive) {
        setIsRevenueAnalysisOpen(true);
    }
    if (isBudgetActive) {
        setIsBudgetOpen(true);
    }
    if (isInventoryActive) {
        setIsInventoryOpen(true);
    }
  }, [activeTab]);

  const toggleLanguage = () => {
    setLanguage(language === 'EN' ? 'GE' : 'EN');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row text-black font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 z-20 overflow-y-auto w-64">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-black font-extrabold text-xl tracking-tight">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white flex-shrink-0">
              <FileText size={20} />
            </div>
            {isSidebarExpanded && <span className="truncate">FinBoard</span>}
          </div>
          {isSidebarExpanded && <p className="text-xs text-gray-400 mt-2 uppercase tracking-wider font-semibold truncate">
            {ROLE_LABELS[user.role][language]}
          </p>}
        </div>

        <nav className="flex-1 py-4 space-y-0.5">
          <NavItem 
            icon={LayoutDashboard} 
            label={translations.dashboard[language]} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            isExpanded={isSidebarExpanded} 
          />
          
          {/* Top Level Approval Tab */}
          {isTopLevel && (
            <>
              <NavItem 
                icon={Gavel} 
                label={translations.approvals[language]} 
                active={activeTab === 'approvals'} 
                onClick={() => setActiveTab('approvals')}
                isExpanded={isSidebarExpanded} 
              />
              {/* PROMPT 5.1-002: New Management Sidebar Item */}
              <NavItem
                icon={Briefcase}
                label={translations.management[language]}
                active={activeTab === 'management'}
                onClick={() => setActiveTab('management')}
                isExpanded={isSidebarExpanded}
              />
            </>
          )}

          {/* PROMPT 6.1-007: Share tab for managers */}
          {(isTopLevel || isManagerLevel) && (
             <NavItem
               icon={Share2}
               label={translations['council-share'][language]}
               active={activeTab === 'council-share'}
               onClick={() => setActiveTab('council-share')}
               isExpanded={isSidebarExpanded}
             />
          )}

          {/* ANALYTICS SECTION */}
          {(isTopLevel || isManagerLevel) && (
            <div className="pt-2">
              {isSidebarExpanded && <div className="px-6 py-1.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                ანალიტიკა
              </div>}

              {/* BUDGETING SUB-SECTION */}
              {isTopLevel && (
                <div className="space-y-0.5">
                  <button
                    onClick={() => setIsBudgetOpen(!isBudgetOpen)}
                    className={`flex items-center justify-between gap-3 px-4 py-2 w-full text-left border-l-2 transition-all duration-200 ${
                      isBudgetActive
                        ? 'border-black text-black font-bold bg-gray-50'
                        : 'border-transparent text-gray-500 hover:text-black hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                        <PieChart size={18} strokeWidth={isBudgetActive ? 2.5 : 2} />
                        {isSidebarExpanded && <span>Budget (ბიუჯეტი)</span>}
                    </div>
                    {isSidebarExpanded && (isBudgetOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                  </button>

                  {isBudgetOpen && (
                    <div className="pl-5 pt-1 space-y-0.5 animate-in fade-in duration-300">
                      <NavItem 
                        icon={History} 
                        label="Budget 2025 (ბიუჯეტი 2025)" 
                        active={activeTab === 'prev-year-budget'} 
                        onClick={() => setActiveTab('prev-year-budget')}
                        isExpanded={isSidebarExpanded} 
                      />
                      <NavItem 
                        icon={TrendingUp} 
                        label="Budget 2026 (ბიუჯეტი 2026)" 
                        active={activeTab === 'curr-year-budget'} 
                        onClick={() => setActiveTab('curr-year-budget')}
                        isExpanded={isSidebarExpanded} 
                      />
                      <NavItem 
                        icon={Scale} 
                        label="ბიუჯეტის ანალიზი"
                        active={activeTab === 'budget-analysis'} 
                        onClick={() => setActiveTab('budget-analysis')}
                        isExpanded={isSidebarExpanded} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CASH INFLOW */}
              <NavItem 
                icon={CircleDollarSign} 
                label={translations['cash-inflow'][language]}
                active={activeTab === 'cash-inflow'} 
                onClick={() => setActiveTab('cash-inflow')}
                isExpanded={isSidebarExpanded} 
              />
            </div>
          )}


          {/* PROMPT 6.7-005 & 6.8-003: Collapsible & Role-Restricted Revenue Analysis Section */}
          {canViewRevenueAnalysis && (
            <div className="pt-2">
              <button
                onClick={() => setIsRevenueAnalysisOpen(!isRevenueAnalysisOpen)}
                className={`flex items-center justify-between gap-3 px-4 py-2 w-full text-left border-l-2 transition-all duration-200 ${
                  isRevenueAnalysisActive
                    ? 'border-black text-black font-bold bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-black hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                    <BarChart2 size={18} strokeWidth={isRevenueAnalysisActive ? 2.5 : 2} />
                    {isSidebarExpanded && <span>შემოსავლების ანალიზი</span>}
                </div>
                {isSidebarExpanded && (isRevenueAnalysisOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
              </button>

              {isRevenueAnalysisOpen && (
                <div className="pl-5 pt-1 space-y-0.5 animate-in fade-in duration-300">
                  {canViewProjects && (
                    <NavItem 
                      icon={FolderKanban} 
                      label={translations['revenue-projects'][language]} 
                      active={activeTab === 'revenue-projects'} 
                      onClick={() => setActiveTab('revenue-projects')}
                      isExpanded={isSidebarExpanded} 
                    />
                  )}
                  {canViewServiceAndParts && (
                    <>
                      <NavItem 
                        icon={Server} 
                        label={translations['revenue-service'][language]}
                        active={activeTab === 'revenue-service'} 
                        onClick={() => setActiveTab('revenue-service')}
                        isExpanded={isSidebarExpanded} 
                      />
                      <NavItem 
                        icon={Package} 
                        label={translations['revenue-parts'][language]}
                        active={activeTab === 'revenue-parts'} 
                        onClick={() => setActiveTab('revenue-parts')}
                        isExpanded={isSidebarExpanded} 
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Accountant Tabs */}
          {isAccountant && (
            <>
              <NavItem 
                icon={Calculator} 
                label={translations.accounting[language]} 
                active={activeTab === 'accounting'} 
                onClick={() => setActiveTab('accounting')}
                isExpanded={isSidebarExpanded} 
              />
              <NavItem 
                icon={FileText} 
                label="მენეჯეტი (დირექტივები)" 
                active={activeTab === 'accounting-directives'} 
                onClick={() => setActiveTab('accounting-directives')}
                isExpanded={isSidebarExpanded} 
              />
            </>
          )}

          {/* Sub-Accountant Tab */}
          {isSubAccountant && (
             <NavItem
                icon={Calculator}
                label={translations['sub-accounting'][language]}
                active={activeTab === 'sub-accounting'}
                onClick={() => setActiveTab('sub-accounting')}
                isExpanded={isSidebarExpanded}
             />
          )}

          {/* Parts / Inventory Tab */}
          {canViewInventory && (
            <div className="pt-2">
              <button
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                className={`flex items-center justify-between gap-3 px-4 py-2 w-full text-left border-l-2 transition-all duration-200 ${
                  isInventoryActive
                    ? 'border-black text-black font-bold bg-gray-50'
                    : 'border-transparent text-gray-500 hover:text-black hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                    <Package size={18} strokeWidth={isInventoryActive ? 2.5 : 2} />
                    {isSidebarExpanded && <span>{translations.inventory[language]}</span>}
                </div>
                {isSidebarExpanded && (isInventoryOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
              </button>

              {isInventoryOpen && (
                <div className="pl-5 pt-1 space-y-0.5 animate-in fade-in duration-300">
                  <NavItem
                    icon={FileText}
                    label={translations['inventory-proforma'][language]}
                    active={activeTab === 'inventory-proforma'}
                    onClick={() => setActiveTab('inventory-proforma')}
                    isExpanded={isSidebarExpanded}
                  />
                  <NavItem
                    icon={FileCheck}
                    label={translations['inventory-generated'][language]}
                    active={activeTab === 'inventory-generated'}
                    onClick={() => setActiveTab('inventory-generated')}
                    isExpanded={isSidebarExpanded}
                  />
                </div>
              )}
            </div>
          )}

          {/* Customers Tab */}
          {(isTopLevel || isManagerLevel) && (
             <NavItem
                icon={UserPlus}
                label={translations['customers'][language]}
                active={activeTab === 'customers'}
                onClick={() => setActiveTab('customers')}
                isExpanded={isSidebarExpanded}
             />
          )}

          {/* Global Archive Tab */}
          {canViewGlobalArchive && (
             <NavItem 
               icon={Archive} 
               label={translations.archive[language]} 
               active={activeTab === 'global-archive'} 
               onClick={() => setActiveTab('global-archive')}
               isExpanded={isSidebarExpanded} 
             />
          )}

          <div className="my-2 border-t border-gray-100" />

          <NavItem 
            icon={PlusCircle} 
            label={translations.request[language]} 
            active={activeTab === 'request'} 
            onClick={() => setActiveTab('request')}
            isExpanded={isSidebarExpanded} 
          />
          
          {isAdmin && (
            <NavItem 
              icon={Users} 
              label={translations.users[language]} 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
              isExpanded={isSidebarExpanded} 
            />
          )}
          <NavItem 
            icon={Settings} 
            label={translations.settings[language]} 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            isExpanded={isSidebarExpanded} 
          />
        </nav>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2 mt-auto">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 w-full text-xs font-bold border border-gray-200 rounded hover:bg-gray-50 transition-colors justify-center"
          >
            <Globe size={14} />
            {isSidebarExpanded && (language === 'EN' ? 'ქართული' : 'English')}
          </button>

          <div className={`flex items-center gap-3 px-4 ${!isSidebarExpanded && 'justify-center'}`}>
            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-black font-bold border border-gray-200 flex-shrink-0">
              {user.name[0]}
            </div>
            {isSidebarExpanded && <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.department}</p>
            </div>}
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wider w-full transition-colors justify-center"
          >
            <LogOut size={14} />
            {isSidebarExpanded && translations.logout[language]}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg text-black">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white">
              <FileText size={18} />
            </div>
            <span>FinBoard</span>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={toggleLanguage} className="text-sm font-bold px-2 py-1 bg-gray-100 rounded">
               {language}
             </button>
             <button onClick={onLogout} className="text-gray-500">
               <LogOut size={20} />
             </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex justify-end items-center px-8 py-4 border-b border-gray-100 flex-shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <CurrencyWidget />
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white pb-20 md:pb-0">
          <div className="p-4 md:p-12 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-1 z-20 pb-safe">
        <NavItem 
          icon={LayoutDashboard} 
          label={translations.dashboard[language]} 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          mobile
          isExpanded={true}
        />
        {isTopLevel && (
           <NavItem 
             icon={Gavel} 
             label={language === 'GE' ? "საბჭო" : "Board"} 
             active={activeTab === 'approvals'} 
             onClick={() => setActiveTab('approvals')} 
             mobile
             isExpanded={true}
           />
        )}
        {isAccountant && (
           <NavItem 
             icon={Calculator} 
             label={language === 'GE' ? "მთავარი ბუღალტერი" : "Accounts"}
             active={activeTab === 'accounting'} 
             onClick={() => setActiveTab('accounting')} 
             mobile
             isExpanded={true}
           />
        )}
        {isSubAccountant && (
           <NavItem 
             icon={Calculator} 
             label={language === 'GE' ? "ბუღალტერი" : "Sub-Acc"}
             active={activeTab === 'sub-accounting'} 
             onClick={() => setActiveTab('sub-accounting')} 
             mobile
             isExpanded={true}
           />
        )}
        
        <NavItem 
          icon={PlusCircle} 
          label={language === 'GE' ? "მოთხოვნა" : "Request"}
          active={activeTab === 'request'} 
          onClick={() => setActiveTab('request')} 
          mobile
          isExpanded={true}
        />
        <NavItem 
          icon={Settings} 
          label={language === 'GE' ? "პარამეტრები" : "Settings"}
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          mobile
          isExpanded={true}
        />
      </nav>
    </div>
  );
};
