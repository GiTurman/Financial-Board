
import React, { useState, useEffect, useMemo } from 'react';
import { Currency, InvoiceItem, Invoice, InvoiceStatus } from '../types';
import { Plus, Trash2, Send, FileText, Calculator, Archive, Clock, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import { createInvoice, getProformaInvoicesForUser } from '../services/mockService'; 

export const ProformaInvoiceForm: React.FC<{ user: any }> = ({ user }) => { 
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<Currency>(Currency.GEL);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: `item_${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }
  ]);
  
  // NEW FIELDS
  const [clientId, setClientId] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('2-3 სამუშაო დღე');
  const [paymentTerms, setPaymentTerms] = useState('100% - ავანსის სახით');
  
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const [validUntil, setValidUntil] = useState(nextWeek.toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  
  // ARCHIVE STATE
  const [archive, setArchive] = useState<Invoice[]>([]);
  
  const fetchArchive = async () => {
    const data = await getProformaInvoicesForUser(user.id);
    setArchive(data);
  };

  useEffect(() => {
    fetchArchive();
  }, [user.id]);

  const handleAddItem = () => {
    setItems(prev => [
      ...prev, 
      { id: `item_${Date.now()}_${Math.random()}`, description: '', quantity: 1, unitPrice: 0 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || items.some(i => !i.description.trim())) {
      alert('გთხოვთ დაამატოთ მინიმუმ ერთი შევსებული პროდუქტი.');
      return;
    }
    
    setLoading(true);
    
    try {
      await createInvoice({
        creatorId: user.id,
        creatorName: user.name,
        clientName,
        clientId,
        clientAddress,
        date,
        deliveryTime,
        paymentTerms,
        validUntil,
        currency,
        items,
        totalAmount: grandTotal
      });

      alert('პროფორმა ინვოისი წარმატებით გაიგზავნა ბუღალტერთან გადასამოწმებლად.');
      
      // Refresh Archive
      await fetchArchive();
      
      // Reset Form
      setClientName('');
      setClientId('');
      setClientAddress('');
      setItems([{ id: `item_${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }]);
    } catch (error) {
      console.error(error);
      alert('შეცდომა ინვოისის გაგზავნისას.');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusBadge = (status: InvoiceStatus) => {
    if (status === InvoiceStatus.PENDING_ACCOUNTANT) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded border border-yellow-200"><Clock size={12}/> გაგზავნილია</span>;
    }
    if (status === InvoiceStatus.GENERATED) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded border border-blue-200"><CheckCircle2 size={12}/> დაგენერირებული</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase rounded border border-green-200"><CheckCircle2 size={12}/> დასრულებული</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 font-sans animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* FORM SECTION */}
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-black pb-4 mb-6">
          <div className="w-12 h-12 bg-black text-white flex items-center justify-center rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter uppercase text-black">პროფორმა ინვოისი</h2>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">ახალი დოკუმენტის შექმნა</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          
          {/* Main Details Section */}
          <div className="p-6 md:p-8 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">დამკვეთი (სახელი/შპს)</label>
              <input 
                type="text" 
                required
                placeholder="შპს / ფიზიკური პირი"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">თარიღი</label>
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ვალუტა</label>
              <div className="flex rounded border border-gray-300 overflow-hidden bg-white">
                {Object.values(Currency).map((curr, idx) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`
                      flex-1 px-3 py-2 text-sm font-bold transition-colors
                      ${currency === curr 
                        ? 'bg-black text-white' 
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                      }
                      ${idx !== 0 ? 'border-l border-gray-300' : ''}
                    `}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Details Section */}
          <div className="p-6 md:p-8 bg-white border-b border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">დამკვეთის ს/კ (ID)</label>
              <input 
                type="text" 
                value={clientId} 
                onChange={(e) => setClientId(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black font-medium text-sm" 
                placeholder="404404774"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">დამკვეთის მისამართი</label>
              <input 
                type="text" 
                value={clientAddress} 
                onChange={(e) => setClientAddress(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black font-medium text-sm" 
                placeholder="საქართველო, ქ.თბილისი..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">მიწოდების ვადა</label>
              <input 
                type="text" 
                value={deliveryTime} 
                onChange={(e) => setDeliveryTime(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black font-medium text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">გადახდის პირობები</label>
              <input 
                type="text" 
                value={paymentTerms} 
                onChange={(e) => setPaymentTerms(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black font-medium text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ძალაშია (თარიღი)</label>
              <input 
                type="date" 
                value={validUntil} 
                onChange={(e) => setValidUntil(e.target.value)} 
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-black font-medium text-sm" 
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <Calculator size={18} className="text-gray-500" />
              <h3 className="font-bold text-lg uppercase text-black">პროდუქცია / სერვისი</h3>
            </div>

            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
              <div className="col-span-5">დასახელება</div>
              <div className="col-span-2 text-center">რაოდენობა</div>
              <div className="col-span-2 text-right">ერთ. ფასი (სავარაუდო)</div>
              <div className="col-span-2 text-right">ჯამი</div>
              <div className="col-span-1 text-center"></div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const itemTotal = item.quantity * item.unitPrice;
                return (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-4 md:p-2 border md:border-transparent border-gray-200 rounded md:rounded-none shadow-sm md:shadow-none hover:bg-gray-50 transition-colors">
                    
                    {/* Description */}
                    <div className="md:col-span-5">
                      <label className="md:hidden block text-xs font-bold text-gray-500 mb-1">დასახელება</label>
                      <input 
                        type="text" 
                        required
                        placeholder="პროდუქტის/სერვისის აღწერა"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black text-sm"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-2">
                      <label className="md:hidden block text-xs font-bold text-gray-500 mb-1">რაოდენობა</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        step="any"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black md:text-center text-sm font-mono"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="md:col-span-2">
                      <label className="md:hidden block text-xs font-bold text-gray-500 mb-1">ერთ. ფასი (სავარაუდო)</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        step="0.01"
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black text-right text-sm font-mono"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Total */}
                    <div className="md:col-span-2 text-right">
                      <label className="md:hidden block text-xs font-bold text-gray-500 mb-1">ჯამი</label>
                      <div className="font-bold font-mono text-black">
                        {formatNumber(itemTotal)} <span className="text-[10px] text-gray-500">{currency}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="md:col-span-1 text-center mt-2 md:mt-0">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length === 1}
                        className="w-full md:w-auto p-2 text-red-500 hover:bg-red-50 rounded flex justify-center disabled:opacity-30 transition-colors"
                        title="წაშლა"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4">
              <button 
                type="button" 
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-black text-sm font-bold rounded hover:bg-gray-200 transition-colors border border-gray-300"
              >
                <Plus size={16} /> რიგის დამატება
              </button>
            </div>

            {/* Grand Total */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col items-end">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">სულ ჯამი</div>
              <div className="text-3xl font-black font-mono text-black bg-yellow-50 px-6 py-3 rounded-lg border border-yellow-200">
                {formatNumber(grandTotal)} <span className="text-lg text-gray-600">{currency}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button 
              type="submit" 
              disabled={loading}
              className={`
                flex items-center gap-2 px-8 py-3 rounded font-bold text-white shadow-md transition-all uppercase tracking-wider text-sm
                ${loading ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'}
              `}
            >
              <Send size={18} />
              {loading ? 'მუშავდება...' : 'გაგზავნა (ბუღალტერთან)'}
            </button>
          </div>

        </form>
      </div>
      
      {/* ARCHIVE SECTION */}
      <div>
        <div className="flex items-center gap-3 border-b-2 border-gray-200 pb-4 mb-6">
          <div className="p-2 bg-gray-100 text-gray-500 rounded">
            <Archive size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase text-black">გაგზავნილი პროფორმების ისტორია</h2>
          </div>
        </div>
        
        {archive.length === 0 ? (
           <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-gray-500">
             ისტორია ცარიელია
           </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs">
                   <tr>
                     <th className="px-6 py-3">პროფორმა / ინვოისი #</th>
                     <th className="px-6 py-3">თარიღი</th>
                     <th className="px-6 py-3">კლიენტი</th>
                     <th className="px-6 py-3 text-right">მოსალოდნელი ჯამი</th>
                     <th className="px-6 py-3 text-center">სტატუსი</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {archive.map(inv => (
                     <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4 font-mono font-bold text-blue-900">{inv.invoiceNumber}</td>
                       <td className="px-6 py-4 text-gray-500">{inv.date}</td>
                       <td className="px-6 py-4 font-bold text-black">{inv.clientName}</td>
                       <td className="px-6 py-4 text-right font-mono text-black">
                         {formatNumber(inv.totalAmount)} <span className="text-gray-500 text-xs">{inv.currency}</span>
                       </td>
                       <td className="px-6 py-4 text-center">
                         {getStatusBadge(inv.status)}
                       </td>
                     </tr>
                   ))}
                 </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
