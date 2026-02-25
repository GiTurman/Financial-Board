
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { RequestForm } from './components/RequestForm';
import { Dashboard } from './components/Dashboard';
import { UserManagement } from './components/UserManagement';
import { LandingPage } from './components/LandingPage';
import { FinancialCouncil } from './components/FinancialCouncil'; // New Import
import { AccountingDashboard, AccountantDirectivesView } from './components/AccountingDashboard';
import { GlobalArchive } from './components/GlobalArchive';
import { TestCenter } from './components/TestCenter'; // New Import
import { Budgeting } from './components/Budgeting'; // PROMPT 414
import { BudgetAnalysis } from './components/BudgetAnalysis'; // PROMPT 7.3-008
import { CashInflowView } from './components/CashInflowView'; // PROMPT 6.1-006
import { GlobalSettings } from './components/GlobalSettings'; // PROMPT 6.2-009
import { RevenueAnalysis } from './components/RevenueAnalysis'; // PROMPT 6.7-001
import { ManagementView } from './components/ManagementView'; // PROMPT 7.1-002
import { ProformaInvoiceForm } from './components/ProformaInvoiceForm'; 
import { GeneratedInvoicesView, AccountantInvoicesView } from './components/InventoryInvoices'; // UPDATED IMPORT
// PROMPT 6.1-008: CashInflowEntryView is removed as its logic is merged into CashInflowView
import { 
  USERS, 
  generateTestRequests, 
  createAutomatedTestFlowRequest, 
  generateAccountingReadyRequests,
  clearActiveBoardData // PROMPT 422
} from './services/mockService';
import { User, UserRole, Language } from './types';
import { Database, CheckCircle, Loader2, Download, Lock } from 'lucide-react';

const AccessDenied: React.FC = () => (
    <div className="p-12 text-center text-red-500 border-2 border-dashed border-red-200 rounded-lg bg-red-50">
        <Lock size={32} className="mx-auto text-red-600 mb-4" />
        <h3 className="text-xl font-bold text-red-800">წვდომა შეზღუდულია</h3>
        <p className="mt-2 text-sm text-red-700">
            თქვენ არ გაქვთ ამ მოდულის ნახვის უფლება.
        </p>
    </div>
);

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [language, setLanguage] = useState<Language>('GE');
  
  // Dev Tools State
  const [isGenerating, setIsGenerating] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);
  
  // Test Flow State
  const [testFlowState, setTestFlowState] = useState<{
      active: boolean;
      step: number;
      message: string;
  }>({ active: false, step: 0, message: '' });

  // PROMPT 6.7-004: Sidebar is now permanently expanded as per strict constraints.
  const isSidebarExpanded = true;

  // PROMPT 422: FORCE CLEAR DATA FOR STEPS 4-11 ON LOAD
  useEffect(() => {
    clearActiveBoardData();
  }, []);

  const handleLogin = (role: UserRole) => {
    // Find a mock user with this role
    const user = Object.values(USERS).find(u => u.role === role);
    if (user) {
      setCurrentUser(user);
      setActiveTab('dashboard');
    } else {
      // Fallback if no user exists for that role in mocks (shouldn't happen with updated mocks)
      alert('No mock user found for this role.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleGenerateData = async () => {
    setIsGenerating(true);
    setGenSuccess(false);
    await generateTestRequests();
    setIsGenerating(false);
    setGenSuccess(true);
    // Auto-hide success message
    setTimeout(() => setGenSuccess(false), 3000);
  };

  const handleGenerateAccountingData = async () => {
    setIsGenerating(true);
    setGenSuccess(false);
    await generateAccountingReadyRequests();
    setIsGenerating(false);
    setGenSuccess(true);
    setTimeout(() => setGenSuccess(false), 3000);
  };

  const handleRunTestFlow = async () => {
      setTestFlowState({ active: true, step: 1, message: 'Step 1: Employee Submitting Request...' });
      
      // Step 1: Create Request
      await createAutomatedTestFlowRequest();
      
      // Step 2: Login as Employee (Using u_comm_emp_1 which is guaranteed to exist)
      const emp = USERS['u_comm_emp_1'];
      if (!emp) {
        alert("Error: Test user u_comm_emp_1 not found.");
        setTestFlowState({ active: false, step: 0, message: '' });
        return;
      }
      setCurrentUser(emp);
      setActiveTab('dashboard');
      setTestFlowState({ active: true, step: 1, message: 'Logged in as Employee: Request Submitted' });

      // Wait 3 seconds
      await new Promise(r => setTimeout(r, 3000));

      // Step 3: Login as Director (CEO)
      setTestFlowState({ active: true, step: 2, message: 'Step 2: Switching to Director (CEO)...' });
      await new Promise(r => setTimeout(r, 1000));
      const ceo = USERS['u_ceo'];
      setCurrentUser(ceo);
      setActiveTab('approvals');
      setTestFlowState({ active: true, step: 2, message: 'Logged in as CEO: Reviewing Request' });

      // Wait 4 seconds
      await new Promise(r => setTimeout(r, 4000));

      // Step 4: Login as Fin Director
      setTestFlowState({ active: true, step: 3, message: 'Step 3: Switching to Financial Director...' });
      await new Promise(r => setTimeout(r, 1000));
      const fin = USERS['u_fin'];
      setCurrentUser(fin);
      setActiveTab('approvals');
      setTestFlowState({ active: true, step: 3, message: 'Logged in as Fin. Director: Final Check' });

      // Wait 3 seconds then clear overlay
      await new Promise(r => setTimeout(r, 3000));
      setTestFlowState({ active: false, step: 0, message: '' });
  };

  // If not logged in, show Landing Page
  if (!currentUser) {
    return (
      <LandingPage 
        onSelectRole={handleLogin} 
        language={language} 
        setLanguage={setLanguage} 
        onRunTestFlow={handleRunTestFlow}
      />
    );
  }

  const isAdmin = currentUser.role === UserRole.FOUNDER || currentUser.role === UserRole.FIN_DIRECTOR;
  const isTopLevel = currentUser.role === UserRole.FOUNDER || currentUser.role === UserRole.FIN_DIRECTOR || currentUser.role === UserRole.CEO;
  const isManagerLevel = [UserRole.COMMERCIAL_DIRECTOR, UserRole.TECH_DIRECTOR, UserRole.ADMIN, UserRole.MANAGER, UserRole.PARTS_MANAGER].includes(currentUser.role);
  const isAccountant = currentUser.role === UserRole.ACCOUNTANT;
  const isSubAccountant = currentUser.role === UserRole.SUB_ACCOUNTANT;
  const canViewGlobalArchive = currentUser.role === UserRole.FOUNDER || currentUser.role === UserRole.FIN_DIRECTOR;
  
  const canViewInventory = [
    UserRole.FOUNDER,
    UserRole.FIN_DIRECTOR,
    UserRole.CEO,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.ACCOUNTANT,
    UserRole.SUB_ACCOUNTANT,
    UserRole.PARTS_MANAGER
  ].includes(currentUser.role);

  // PROMPT 6.8-003: Refined role-based access for Revenue Analysis
  const isCommercialDirector = currentUser.role === UserRole.COMMERCIAL_DIRECTOR;
  const isTechDirector = currentUser.role === UserRole.TECH_DIRECTOR;
  const canViewProjects = isTopLevel || isCommercialDirector;
  const canViewServiceAndParts = isTopLevel || isTechDirector;

  return (
    <>
      <Layout 
        user={currentUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        language={language}
        setLanguage={setLanguage}
        isSidebarExpanded={isSidebarExpanded}
      >
        {activeTab === 'dashboard' && (
          <Dashboard user={currentUser} />
        )}
        
        {/* UPDATED: Route 'approvals' to the new Financial Council Engine */}
        {activeTab === 'approvals' && isTopLevel && (
          <FinancialCouncil user={currentUser} />
        )}
        
        {/* PROMPT 6.1-008: Revert 'council-share' to a placeholder */}
        {activeTab === 'council-share' && (isTopLevel || isManagerLevel) && (
          <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-xl font-bold text-black">გაზიარების მოდული</h3>
            <p className="mt-2 text-sm">ეს სექცია განკუთვნილია შიდა ინფორმაციის გასაზიარებლად.</p>
          </div>
        )}

        {/* PROMPT 7.1-002: Implement ManagementView for 'management' tab */}
        {activeTab === 'management' && (
          // FIX: Pass the 'user' prop to the ManagementView component as it is required.
          isTopLevel ? <ManagementView user={currentUser} /> : <AccessDenied />
        )}

        {/* BUDGETING ROUTES (PROMPT 414) */}
        {activeTab === 'prev-year-budget' && (
          isTopLevel ? <Budgeting user={currentUser} year={2025} /> : <AccessDenied />
        )}
        {activeTab === 'curr-year-budget' && (
          isTopLevel ? <Budgeting user={currentUser} year={2026} /> : <AccessDenied />
        )}
        {activeTab === 'budget-analysis' && (
          isTopLevel ? <BudgetAnalysis user={currentUser} /> : <AccessDenied />
        )}

        {/* PROMPT 6.1-008: Corrected Cash Inflow Route */}
        {activeTab === 'cash-inflow' && (isTopLevel || isManagerLevel) && (
          <CashInflowView user={currentUser} />
        )}

        {/* PROMPT 6.7-001 & 6.8-003: Isolated and Role-Restricted Revenue Analysis Modules */}
        {activeTab === 'revenue-projects' && (
          canViewProjects ? <RevenueAnalysis category="პროექტები" /> : <AccessDenied />
        )}
        {activeTab === 'revenue-service' && (
          canViewServiceAndParts ? <RevenueAnalysis category="სერვისი" /> : <AccessDenied />
        )}
        {activeTab === 'revenue-parts' && (
          canViewServiceAndParts ? <RevenueAnalysis category="ნაწილები" /> : <AccessDenied />
        )}

        {activeTab === 'accounting' && isAccountant && (
          <AccountingDashboard user={currentUser} />
        )}
        {activeTab === 'accounting-directives' && isAccountant && (
          <AccountantDirectivesView user={currentUser} />
        )}

        {/* FIX: Render AccountantInvoicesView for the Sub-Accountant role */}
        {activeTab === 'sub-accounting' && isSubAccountant && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AccountantInvoicesView user={currentUser} />
          </div>
        )}

        {activeTab === 'inventory-proforma' && (
          canViewInventory ? <ProformaInvoiceForm user={currentUser} /> : <AccessDenied />
        )}

        {activeTab === 'inventory-generated' && (
          canViewInventory ? <GeneratedInvoicesView user={currentUser} /> : <AccessDenied />
        )}

        {activeTab === 'customers' && (isTopLevel || isManagerLevel) && (
          <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 mt-10">
            <h3 className="text-xl font-bold text-black">მომხმარებლები (კლიენტები)</h3>
            <p className="mt-2 text-sm">მოდული დამუშავების პროცესშია. ლოგიკა დაემატება მოგვიანებით.</p>
          </div>
        )}
        
        {activeTab === 'global-archive' && canViewGlobalArchive && (
          <GlobalArchive user={currentUser} />
        )}

        {activeTab === 'request' && (
          <RequestForm 
            user={currentUser} 
            onSuccess={() => setActiveTab('dashboard')} 
          />
        )}
        
        {activeTab === 'users' && isAdmin && (
          <UserManagement currentUser={currentUser} language={language} />
        )}
        
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center p-8 border-b border-gray-100">
              <h2 className="text-2xl font-bold mb-2 text-black">{language === 'EN' ? 'Settings' : 'პარამეტრები'}</h2>
              <div className="mt-4 p-4 bg-gray-50 text-gray-800 rounded border border-gray-200 inline-block text-sm font-medium">
                {language === 'EN' ? 'Current Role:' : 'მიმდინარე როლი:'} <strong>{currentUser.role}</strong>
              </div>
            </div>
            
            {isAdmin && <GlobalSettings language={language} />}

            {/* Test Center Component - Full Cycle Environment Test */}
            <TestCenter />

            {/* Legacy Data Gen Tools */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <Database className="text-gray-400" size={20} />
                <div>
                  <h3 className="font-bold text-lg text-black">Quick Data Generators</h3>
                  <p className="text-xs text-gray-400">Manual Population</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleGenerateData}
                  disabled={isGenerating}
                  className={`
                    w-full py-3 rounded font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-3 border
                    ${isGenerating 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-black border-black hover:bg-black hover:text-white'}
                  `}
                >
                  {isGenerating ? 'Generating...' : 'Generate New Requests'}
                </button>

                <button 
                  onClick={handleGenerateAccountingData}
                  disabled={isGenerating}
                  className={`
                    w-full py-3 rounded font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-3 border
                    ${isGenerating 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-black border-black hover:bg-black hover:text-white'}
                  `}
                >
                  {isGenerating ? 'Generating...' : 'Generate Accounting Data'}
                </button>
              </div>

              {genSuccess && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle size={16} />
                    Data generated successfully.
                  </div>
              )}
            </div>
          </div>
        )}
      </Layout>
      
      {/* Test Flow Overlay */}
      {testFlowState.active && (
         <div className="fixed bottom-4 right-4 z-50 bg-black text-white p-4 rounded-lg shadow-2xl border border-gray-700 flex items-center gap-4 animate-in slide-in-from-bottom-5">
             <Loader2 className="animate-spin text-yellow-400" size={24} />
             <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Test Automation Running</div>
                <div className="font-bold text-sm">{testFlowState.message}</div>
             </div>
         </div>
      )}
    </>
  );
}

export default App;
