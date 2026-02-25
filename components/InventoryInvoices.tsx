
import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus, InvoiceItem, User } from '../types';
import { getInvoicesForAccountant, getGeneratedInvoices, updateInvoice, updateInvoiceStatus } from '../services/mockService';
import { formatNumber } from '../utils/formatters';
import { CheckCircle2, ChevronDown, ChevronRight, Edit2, FileCheck, Send, Download, Save, Clock, Printer, X, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';

// -------------------------------------------------------------
// PRINT TEMPLATE (Matches provided OCR/Image Layout)
// -------------------------------------------------------------
const InvoicePrintTemplate = ({ invoice }: { invoice: Invoice }) => {
  // Ensure we have at least 6 rows for visual layout matching the template
  const rows = [...invoice.items];
  while (rows.length < 6) {
    rows.push({ id: `empty_${rows.length}`, description: '', quantity: 0, unitPrice: 0 });
  }

  const formattedDate = new Date(invoice.date).toLocaleDateString('ka-GE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const formattedValidUntil = invoice.validUntil ? new Date(invoice.validUntil).toLocaleDateString('ka-GE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '';

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white p-8 font-sans text-black" id="invoice-print-content">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="text-[40px] font-black tracking-tighter text-[#1A365D] leading-none">ELTEG</div>
        <div className="text-right">
          <h2 className="text-lg font-bold mb-4">ინვოისი</h2>
          <table className="text-xs float-right">
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-gray-700">თარიღი</td>
                <td className="py-1 font-medium">{formattedDate}</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 text-gray-700">ინვოისის #</td>
                <td className="py-1 font-medium">{invoice.invoiceNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-6 text-xs">
        <table className="w-full max-w-md">
          <tbody>
            <tr>
              <td className="py-1 w-40 font-bold">სახელი</td>
              <td className="py-1">{invoice.clientName}</td>
            </tr>
            <tr>
              <td className="py-1 font-bold">მისამართი</td>
              <td className="py-1">{invoice.clientAddress || '-'}</td>
            </tr>
            <tr>
              <td className="py-1 font-bold whitespace-nowrap">საიდენტიფიკაციო ნომერი</td>
              <td className="py-1">{invoice.clientId || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black mb-0 text-xs">
        <thead>
          <tr>
            <th className="border border-black p-2 w-10 text-center font-normal">#</th>
            <th className="border border-black p-2 font-normal text-center">შინაარსი</th>
            <th className="border border-black p-2 w-28 text-center font-normal">რაოდენობა<br/><span className="text-[9px]">(ცალი,მეტრი)</span></th>
            <th className="border border-black p-2 w-32 text-center font-normal">ერთეულის ფასი</th>
            <th className="border border-black p-2 w-32 text-center font-normal">ჯამი</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => (
            <tr key={item.id} className="h-8">
              <td className="border border-black p-2 text-center">{idx + 1}</td>
              <td className="border border-black p-2 text-center">{item.description}</td>
              <td className="border border-black p-2 text-center">{item.quantity > 0 ? item.quantity : ''}</td>
              <td className="border border-black p-2 text-right">{item.unitPrice > 0 ? `${formatNumber(item.unitPrice)} ₾` : (item.quantity === 0 ? '- ₾' : '0.00 ₾')}</td>
              <td className="border border-black p-2 text-right">{item.quantity > 0 && item.unitPrice > 0 ? `${formatNumber(item.quantity * item.unitPrice)} ₾` : '- ₾'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="border border-black p-2 text-center font-bold">*</td>
            <td colSpan={3} className="border border-black p-2 font-bold">ჯამური ღირებულება</td>
            <td className="border border-black p-2 text-right font-bold">{formatNumber(invoice.totalAmount)} ₾</td>
          </tr>
          <tr>
            <td colSpan={5} className="border border-black p-2 text-center font-bold">ფასში შედის დამატებითი ღირებულების გადასახადი</td>
          </tr>
        </tfoot>
      </table>

      {/* Bank Info */}
      <table className="w-full border-collapse border-x border-b border-black text-[11px]">
        <tbody>
          <tr>
            <td className="border border-black p-1 w-4 text-center font-bold">*</td>
            <td className="border border-black p-1 w-1/2">მიმღები: შპს "ტექინჟინერინგ ჯგუფი"</td>
            <td className="border border-black p-1 w-1/2">ბანკი: ს.ს "თიბისი ბანკი"</td>
          </tr>
          <tr>
            <td className="border border-black p-1 w-4 text-center font-bold">*</td>
            <td className="border border-black p-1">მისამართი: თბილისი, ქ. წამებულის #41</td>
            <td className="border border-black p-1">ბანკის კოდი: TBCBGE22</td>
          </tr>
          <tr>
            <td className="border border-black p-1 w-4 text-center font-bold">*</td>
            <td className="border border-black p-1">საიდენტიფიკაციო ნომერი: 204540620</td>
            <td className="border border-black p-1">ა/ა: GE55TB0713936080100002 / GEL</td>
          </tr>
          <tr>
            <td className="border-b border-r border-black p-1 w-4 text-center"></td>
            <td className="border-b border-black p-1"></td>
            <td className="border border-black p-1">ბანკი: ს.ს "საქართველოს ბანკი"</td>
          </tr>
          <tr>
            <td className="border-b border-r border-black p-1 w-4 text-center"></td>
            <td className="border-b border-black p-1"></td>
            <td className="border border-black p-1">ა/ა GE39BG0000000235218900 GEL</td>
          </tr>
        </tbody>
      </table>

      {/* Conditions */}
      <table className="w-full border-collapse border-x border-b border-black text-[11px]">
        <tbody>
          <tr>
            <td className="border border-black p-2 w-4 text-center font-medium">a</td>
            <td className="border border-black p-2 w-1/2">მიწოდების ვადა:<span className="ml-4">{invoice.deliveryTime || '-'}</span></td>
            <td className="border border-black p-2 text-center align-top relative" rowSpan={3}>
              <div className="mb-2">ხელმოწერა</div>
              <div className="h-16"></div> {/* Space for signature/stamp */}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 w-4 text-center font-medium">b</td>
            <td className="border border-black p-2">გადახდის პირობები:<span className="ml-4">{invoice.paymentTerms || '-'}</span></td>
          </tr>
          <tr>
            <td className="border border-black p-2 w-4 text-center font-medium">c</td>
            <td className="border border-black p-2">შეთავაზება ძალაშია:<span className="ml-4">{formattedValidUntil ? `${formattedValidUntil} -მდე` : '-'}</span></td>
          </tr>
        </tbody>
      </table>

      {/* Footer Note */}
      <div className="border border-black border-t-0 p-2 text-[11px] font-bold">
        შენიშვნა: თანხის ჩარიცხვა უნდა მოხდეს ეროვნულ ვალუტაში, გადახდის დღეს არსებული ს.ე.ბ. კურსის შესაბამისად
      </div>
    </div>
  );
};


// -------------------------------------------------------------
// ACCOUNTANT VIEW
// -------------------------------------------------------------
export const AccountantInvoicesView: React.FC<{ user: User }> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // State for inline editing items
  const [editingItems, setEditingItems] = useState<InvoiceItem[]>([]);

  const fetchInvoices = async () => {
    setLoading(true);
    const data = await getInvoicesForAccountant();
    setInvoices(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleExpand = (invoice: Invoice) => {
    if (expandedId === invoice.id) {
      setExpandedId(null);
    } else {
      setExpandedId(invoice.id);
      // Create a deep copy of items for editing
      setEditingItems(JSON.parse(JSON.stringify(invoice.items)));
    }
  };

  const handleItemPriceChange = (index: number, newPrice: number) => {
    const updated = [...editingItems];
    updated[index].unitPrice = newPrice;
    setEditingItems(updated);
  };

  const handleGenerate = async (invoice: Invoice) => {
    // Recalculate total
    const newTotal = editingItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    
    if (!window.confirm('ნამდვილად გსურთ ინვოისის გენერირება და ნაწილების მენეჯერისთვის დაბრუნება?')) return;

    try {
      await updateInvoice(invoice.id, {
        items: editingItems,
        totalAmount: newTotal,
        status: InvoiceStatus.GENERATED
      });
      setExpandedId(null);
      fetchInvoices();
      alert('ინვოისი წარმატებით დაგენერირდა.');
    } catch (e) {
      console.error(e);
      alert('შეცდომა ინვოისის გენერირებისას.');
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">იტვირთება მონაცემები...</div>;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center gap-3 border-b-2 border-black pb-4">
        <div className="w-12 h-12 bg-black text-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
          <FileCheck size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tighter uppercase text-black">ინვოისების გადამოწმება</h2>
          <p className="text-sm font-bold text-gray-500">ნაწილების განყოფილებიდან შემოსული პროფორმები</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
           <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
           <h3 className="font-bold text-lg text-black">გადამოწმების რიგი ცარიელია</h3>
           <p className="text-sm text-gray-500">ამჟამად არცერთი პროფორმა ინვოისი არ ელოდება თქვენს დადასტურებას.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map(invoice => {
            const isExpanded = expandedId === invoice.id;
            const currentTotal = isExpanded 
                ? editingItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
                : invoice.totalAmount;

            return (
              <div key={invoice.id} className={`border rounded-lg overflow-hidden shadow-sm transition-all ${isExpanded ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-300 bg-white'}`}>
                {/* Header Row */}
                <div 
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => handleExpand(invoice)}
                >
                   <div className="flex items-center gap-4">
                     {isExpanded ? <ChevronDown size={20} className="text-blue-600"/> : <ChevronRight size={20} className="text-gray-400"/>}
                     <div>
                       <div className="flex items-center gap-2">
                         <div className="font-bold text-black text-lg">{invoice.clientName}</div>
                         <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                           პროფორმა #: {invoice.invoiceNumber}
                         </span>
                       </div>
                       <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                         <span>თარიღი: {invoice.date}</span>
                         <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                         <span>ავტორი: {invoice.creatorName}</span>
                       </div>
                     </div>
                   </div>
                   <div className="text-right flex items-center gap-4">
                     <div>
                       <div className="font-mono font-extrabold text-xl text-black">
                         {formatNumber(currentTotal)} <span className="text-sm text-gray-500">{invoice.currency}</span>
                       </div>
                     </div>
                     <button 
                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors ${isExpanded ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
                       onClick={(e) => { e.stopPropagation(); handleExpand(invoice); }}
                     >
                       <Edit size={14} />
                       {isExpanded ? 'რედაქტირება...' : 'რედაქტირება'}
                     </button>
                   </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 border-t border-gray-200 space-y-6 bg-white">
                    <h4 className="font-bold text-sm uppercase text-blue-800 mb-2 flex items-center gap-2">
                       <Edit size={16} /> პროდუქციის ჩამონათვალი და ფასების დადგენა
                    </h4>
                    <div className="overflow-x-auto border border-blue-200 rounded">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-blue-50 text-blue-900 font-bold uppercase text-xs">
                          <tr>
                            <th className="px-4 py-3">დასახელება</th>
                            <th className="px-4 py-3 text-center w-24">რაოდენობა</th>
                            <th className="px-4 py-3 text-right w-48">ერთ. ფასი (შეიყვანეთ)</th>
                            <th className="px-4 py-3 text-right w-32">ჯამი</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                          {editingItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-blue-50/30">
                              <td className="px-4 py-3 font-medium text-black">{item.description}</td>
                              <td className="px-4 py-3 text-center font-mono">{item.quantity}</td>
                              <td className="px-4 py-3 text-right">
                                <input 
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice || ''}
                                  onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                                  className="w-full text-right p-2 border-2 border-blue-300 rounded focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-mono font-bold bg-yellow-50 text-blue-900"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-black">
                                {formatNumber(item.quantity * item.unitPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-800 text-white font-bold">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right uppercase text-xs text-gray-300">დასადასტურებელი ჯამი:</td>
                            <td className="px-4 py-3 text-right font-mono text-lg">{formatNumber(currentTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button 
                        onClick={() => setExpandedId(null)}
                        className="px-6 py-2 border border-gray-300 text-black font-bold uppercase text-xs rounded hover:bg-gray-100 transition-colors"
                      >
                        გაუქმება
                      </button>
                      <button 
                        onClick={() => handleGenerate(invoice)}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold uppercase text-xs rounded hover:bg-green-700 transition-all shadow-sm"
                      >
                        <CheckCircle2 size={16} /> საბოლოო გენერირება
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


// -------------------------------------------------------------
// PARTS MANAGER VIEW (Generated Invoices)
// -------------------------------------------------------------
export const GeneratedInvoicesView: React.FC<{ user: User }> = ({ user }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for Print Preview Modal
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    const data = await getGeneratedInvoices();
    setInvoices(data.filter(inv => inv.creatorId === user.id || user.role === 'FIN_DIRECTOR' || user.role === 'FOUNDER'));
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [user.id]);

  const handleShowPrintModal = (invoice: Invoice) => {
    setPrintInvoice(invoice);
  };

  const handleSendToClient = (invoiceId: string) => {
    alert('ინვოისი გაიგზავნა კლიენტთან (სიმულაცია).');
  };

  const handleConfirmReceipt = async (invoiceId: string) => {
    if(!window.confirm("ადასტურებთ, რომ კლიენტმა ჩაიბარა/დაადასტურა?")) return;
    try {
      await updateInvoiceStatus(invoiceId, InvoiceStatus.COMPLETED);
      fetchInvoices();
    } catch(e) {
      alert("სტატუსის განახლება ვერ მოხერხდა.");
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">იტვირთება მონაცემები...</div>;

  return (
    <>
      {/* Dynamic CSS to handle printing specifically for this module */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Print Preview Modal */}
      {printInvoice && (
        <div className="fixed inset-0 bg-gray-900/80 z-50 flex flex-col no-print">
          <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck size={24} className="text-gray-500" />
              <h3 className="font-bold text-lg">ინვოისის ბეჭდვა / Save as PDF</h3>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setPrintInvoice(null)}
                className="px-4 py-2 border border-gray-300 rounded font-bold hover:bg-gray-100 flex items-center gap-2"
              >
                <X size={16} /> გაუქმება
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
              >
                <Printer size={18} /> ბეჭდვა
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-8 flex justify-center pb-20">
            <div className="shadow-2xl">
              <InvoicePrintTemplate invoice={printInvoice} />
            </div>
          </div>
        </div>
      )}

      {/* Actual Printable Area (Hidden normally, shown during print) */}
      {printInvoice && (
        <div className="hidden print:block absolute inset-0 bg-white z-[100]">
          <InvoicePrintTemplate invoice={printInvoice} />
        </div>
      )}

      {/* Main View */}
      <div className="space-y-6 font-sans animate-in fade-in slide-in-from-bottom-4 duration-500 no-print">
        <div className="flex items-center gap-3 border-b-2 border-black pb-4">
          <div className="w-12 h-12 bg-black text-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            <FileCheck size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tighter uppercase text-black">გენერირებული ინვოისები</h2>
            <p className="text-sm font-bold text-gray-500">ბუღალტერიის მიერ დადგენილი ფასებით</p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
             <Clock size={32} className="mx-auto text-gray-400 mb-2" />
             <h3 className="font-bold text-lg text-black">ინვოისები არ მოიძებნა</h3>
             <p className="text-sm text-gray-500">არცერთი გენერირებული ან დასრულებული ინვოისი არ იძებნება.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {invoices.map(invoice => (
              <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-300 transition-colors">
                {/* Status Ribbon */}
                <div className={`h-1.5 w-full ${invoice.status === InvoiceStatus.COMPLETED ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg text-black leading-tight">{invoice.clientName}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-1">ინვოისი N: {invoice.invoiceNumber}</p>
                      <p className="text-xs text-gray-500 font-medium">თარიღი: {invoice.date}</p>
                    </div>
                    {invoice.status === InvoiceStatus.COMPLETED ? (
                       <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1 border border-green-200">
                         <CheckCircle2 size={12}/> დასრულებული
                       </span>
                    ) : (
                       <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200">
                         მზადაა
                       </span>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-100">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-gray-500 font-bold uppercase text-[10px]">პროდუქცია</span>
                      <span className="font-mono text-gray-700">{invoice.items.length} პოზიცია</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-500 font-bold uppercase text-xs">სრული ღირებულება</span>
                      <span className="font-mono font-black text-xl text-black">
                        {formatNumber(invoice.totalAmount)} <span className="text-sm text-gray-500">{invoice.currency}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="bg-gray-50 p-3 border-t border-gray-200 grid grid-cols-2 gap-2">
                   <button 
                     onClick={() => handleShowPrintModal(invoice)}
                     className="col-span-2 flex items-center justify-center gap-2 py-2 bg-white border border-gray-300 text-black text-xs font-bold uppercase rounded hover:bg-gray-100 transition-colors"
                   >
                     <Printer size={14} /> ინვოისის ნახვა / ბეჭდვა
                   </button>
                   
                   {invoice.status === InvoiceStatus.GENERATED && (
                     <button 
                       onClick={() => handleSendToClient(invoice.id)}
                       className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded hover:bg-blue-700 transition-colors"
                     >
                       <Send size={14} /> გაგზავნა
                     </button>
                   )}

                   {invoice.status === InvoiceStatus.GENERATED && (
                     <button 
                       onClick={() => handleConfirmReceipt(invoice.id)}
                       className="flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-xs font-bold uppercase rounded hover:bg-green-700 transition-colors shadow-sm"
                     >
                       <CheckCircle2 size={14} /> დადასტურება
                     </button>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
