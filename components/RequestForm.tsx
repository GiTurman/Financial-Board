
import React, { useState, useEffect } from 'react';
import { 
  Currency, 
  Priority, 
  User,
  UserRole
} from '../types';
import { 
  CheckCircle2, 
  DollarSign, 
  TrendingUp,
  Search,
  FileSpreadsheet,
  Tag,
  AlertCircle,
  Clock
} from 'lucide-react';
import { submitRequest } from '../services/mockService';
import { formatNumber } from '../utils/formatters';

interface RequestFormProps {
  user: User;
  onSuccess: () => void;
}

const calculateDeadlineInfo = () => {
    const now = new Date();
    const deadline = new Date(now);
    const day = now.getDay(); // 0=Sun, 4=Thu
    
    const daysUntilThursday = (4 - day + 7) % 7;
    deadline.setDate(now.getDate() + daysUntilThursday);
    deadline.setHours(16, 0, 0, 0);

    if (now > deadline) {
        deadline.setDate(deadline.getDate() + 7);
    }
    
    const timeLeft = deadline.getTime() - now.getTime();
    const deadlinePassed = now.getDay() === 4 && now.getHours() >= 16;

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return {
      timeLeft: `${days}დ ${hours.toString().padStart(2, '0')}სთ ${minutes.toString().padStart(2, '0')}წთ ${seconds.toString().padStart(2, '0')}წმ`,
      deadlinePassed: now > deadline, // More accurate check
    };
};


export const RequestForm: React.FC<RequestFormProps> = ({ user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [deadlineInfo, setDeadlineInfo] = useState(calculateDeadlineInfo());
  const isExempt = [UserRole.FIN_DIRECTOR, UserRole.CEO, UserRole.FOUNDER].includes(user.role);

  useEffect(() => {
    const timer = setInterval(() => {
        setDeadlineInfo(calculateDeadlineInfo());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    itemName: '',
    quantity: 1,
    currency: Currency.GEL,
    unitPrice: 0,
    description: '',
    revenuePotential: '',
    priority: Priority.MEDIUM,
    alternativesChecked: false,
    selectedOptionReason: '',
  });

  const totalAmount = formData.quantity * formData.unitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.alternativesChecked) {
      alert("გთხოვთ დაადასტუროთ ბაზრის მოკვლევა.");
      return;
    }
    setLoading(true);
    try {
      await submitRequest({
        ...formData,
        totalAmount,
      }, user);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('შეცდომა მოთხოვნის გაგზავნისას');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <div className="flex flex-col gap-1 mb-8 border-b border-black pb-4">
        <h1 className="text-3xl font-extrabold text-black tracking-tight uppercase">Expense Request Form</h1>
        <p className="text-gray-500 font-bold">ხარჯვის მოთხოვნის განაცხადი</p>
      </div>

      {!isExempt && (
        <div className="p-4 bg-gray-900 text-white rounded-lg flex items-center justify-center gap-4 text-center">
            <Clock size={20} />
            <div className="text-sm font-bold uppercase tracking-wider">
                ფინანსური კვირის დასრულებამდე დარჩა:
                <span className="font-mono text-lg ml-2">{deadlineInfo.timeLeft}</span>
            </div>
        </div>
      )}

       {!isExempt && deadlineInfo.deadlinePassed && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm font-bold">ფინანსური კვირა დასრულდა. თქვენი მოთხოვნა განხილული იქნება მომდევნო კვირის საბჭოზე.</p>
        </div>
      )}


      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
        {/* Header Section: Basic Info */}
        <div className="bg-gray-50 p-6 md:p-8 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">თარიღი</label>
            <input 
              type="date" 
              required
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">დეპარტამენტი</label>
            <input 
              type="text" 
              disabled 
              value={user.department}
              className="w-full px-3 py-2 bg-gray-200 border border-transparent rounded text-gray-600 font-bold cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">მომთხოვნი</label>
            <input 
              type="text" 
              disabled 
              value={user.name}
              className="w-full px-3 py-2 bg-gray-200 border border-transparent rounded text-gray-600 font-bold cursor-not-allowed"
            />
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-10">
          
          {/* Section 1: Financials */}
          <section>
            <div className="flex items-center gap-2 mb-6 text-black border-b-2 border-gray-100 pb-2">
              <div className="p-1.5 bg-black text-white rounded"><DollarSign size={18} /></div>
              <h3 className="font-bold text-lg uppercase">ფინანსური დეტალები</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                 <label className="block text-sm font-bold text-black mb-2">კატეგორია</label>
                 <select 
                   required
                   className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                   value={formData.category}
                   onChange={(e) => handleChange('category', e.target.value)}
                 >
                   <option value="">აირჩიეთ კატეგორია</option>
                   <option value="equipment">ტექნიკური აღჭურვილობა</option>
                   <option value="software">ლიცენზიები / Software</option>
                   <option value="marketing">მარკეტინგი</option>
                   <option value="travel">მივლინება</option>
                   <option value="office">საოფისე ხარჯი</option>
                   <option value="other">სხვა</option>
                 </select>
              </div>

              <div className="lg:col-span-8">
                <label className="block text-sm font-bold text-black mb-2">ხარჯის დასახელება</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    required
                    placeholder="პროდუქტის ან მომსახურების დასახელება"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    value={formData.itemName}
                    onChange={(e) => handleChange('itemName', e.target.value)}
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-bold text-black mb-2">რაოდენობა</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value))}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-bold text-black mb-2">ერთ. ფასი</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  value={formData.unitPrice || ''}
                  onChange={(e) => handleChange('unitPrice', parseFloat(e.target.value))}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-bold text-black mb-2">ვალუტა</label>
                <div className="flex rounded border border-gray-300 overflow-hidden">
                  {Object.values(Currency).map((curr, idx) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => handleChange('currency', curr)}
                      className={`
                        flex-1 px-2 py-2 text-xs font-bold transition-colors
                        ${formData.currency === curr 
                          ? 'bg-black text-white' 
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                        }
                        ${idx !== 0 ? 'border-l border-gray-300' : ''}
                      `}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-sm font-bold text-black mb-2">სულ ჯამი</label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded text-black font-extrabold flex justify-between items-center">
                  <span>{formatNumber(totalAmount)}</span>
                  <span className="text-gray-500 text-xs">{formData.currency}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Justification (DTSQ) */}
          <section>
            <div className="flex items-center gap-2 mb-6 text-black border-b-2 border-gray-100 pb-2">
              <div className="p-1.5 bg-black text-white rounded"><FileSpreadsheet size={18} /></div>
              <h3 className="font-bold text-lg uppercase">დასაბუთება (დსწ)</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  დასაბუთება (DTSQ) / აღწერა და მიზნობრიობა
                  <span className="text-red-600 ml-1">*</span>
                </label>
                <textarea 
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="ახსენით რატომ არის ეს ხარჯი საჭირო..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-black" />
                    <label className="block text-sm font-bold text-black">შემოსავლის ზრდის პოტენციალი</label>
                  </div>
                  <textarea 
                    rows={3}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    placeholder="მოსალოდნელი ფინანსური შედეგი..."
                    value={formData.revenuePotential}
                    onChange={(e) => handleChange('revenuePotential', e.target.value)}
                  />
                </div>

                <div>
                   <label className="block text-sm font-bold text-black mb-2">პრიორიტეტულობა</label>
                   <div className="flex flex-col gap-2 mt-2">
                     {[
                        { value: Priority.LOW, label: 'დაბალი', color: 'text-blue-600' },
                        { value: Priority.MEDIUM, label: 'საშუალო', color: 'text-yellow-600' },
                        { value: Priority.HIGH, label: 'მაღალი', color: 'text-red-600' },
                        { value: Priority.CRITICAL, label: 'კრიტიკული', color: 'text-purple-600' },
                     ].map(({ value, label, color }) => (
                       <label key={value} className={`
                          flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-all
                          ${formData.priority === value 
                             ? 'border-black bg-gray-50 ring-1 ring-black' 
                             : 'border-gray-200 hover:border-gray-300'}
                       `}>
                         <input 
                           type="radio" 
                           name="priority"
                           className="text-black focus:ring-black"
                           checked={formData.priority === value}
                           onChange={() => handleChange('priority', value)}
                         />
                         <span className={`text-sm font-bold uppercase ${color}`}>
                           {label}
                         </span>
                       </label>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Market Research */}
          <section>
            <div className="flex items-center gap-2 mb-6 text-black border-b-2 border-gray-100 pb-2">
              <div className="p-1.5 bg-black text-white rounded"><Search size={18} /></div>
              <h3 className="font-bold text-lg uppercase">ბაზრის მოკვლევა</h3>
            </div>
            
            <div className="bg-white border border-gray-200 rounded p-6 space-y-6">
              <div className="flex items-start gap-3 bg-gray-50 p-4 rounded border border-gray-100">
                <input 
                  type="checkbox" 
                  id="alternatives"
                  required
                  className="mt-1 w-5 h-5 text-black rounded border-gray-300 focus:ring-black"
                  checked={formData.alternativesChecked}
                  onChange={(e) => handleChange('alternativesChecked', e.target.checked)}
                />
                <label htmlFor="alternatives" className="text-sm text-black font-medium leading-relaxed">
                  ვადასტურებ, რომ მოვიძიე მინიმუმ 3 ალტერნატივა და შევარჩიე საუკეთესო ვარიანტი.
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-black mb-2">შერჩევის მიზეზი</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="მაგ: საუკეთესო ფასი/ხარისხი, სწრაფი მოწოდება..."
                  value={formData.selectedOptionReason}
                  onChange={(e) => handleChange('selectedOptionReason', e.target.value)}
                />
              </div>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col-reverse md:flex-row justify-end gap-3">
          <button 
            type="button" 
            onClick={() => window.history.back()}
            className="px-6 py-3 rounded border border-gray-300 text-black font-bold hover:bg-gray-100 transition-colors uppercase text-sm"
          >
            გაუქმება
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className={`
              flex items-center justify-center gap-2 px-8 py-3 rounded font-bold text-white shadow-lg transition-all uppercase text-sm
              ${loading ? 'bg-gray-400 cursor-wait' : 'bg-black hover:bg-gray-800 hover:scale-[1.02]'}
            `}
          >
            {loading ? (
              <span>იგზავნება...</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>გაგზავნა</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};