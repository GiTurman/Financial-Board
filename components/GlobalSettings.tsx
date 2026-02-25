

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { getCurrencyRates, updateCurrencyRates, getInflationRate, updateInflationRate } from '../services/mockService';
import { Language } from '../types';

export const GlobalSettings: React.FC<{ language: Language }> = ({ language }) => {
  const [rates, setRates] = useState({ USD: 0, EUR: 0 });
  const [inflation, setInflation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      const [currentRates, currentInflation] = await Promise.all([
        getCurrencyRates(),
        getInflationRate()
      ]);
      setRates(currentRates);
      setInflation(currentInflation);
      setLoading(false);
    };
    fetchRates();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      updateCurrencyRates(rates),
      updateInflationRate(inflation)
    ]);
    setSaving(false);
    alert('Indicators updated!');
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="font-bold text-lg text-black mb-4">Financial Indicators</h3>
      {loading ? <div>Loading rates...</div> : (
        <>
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 items-center">
                    <label className="font-bold text-sm">GEL / USD</label>
                    <input
                        type="number"
                        step="0.01"
                        value={rates.USD}
                        onChange={(e) => setRates(prev => ({ ...prev, USD: parseFloat(e.target.value) || 0 }))}
                        className="col-span-2 w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
                    />
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                    <label className="font-bold text-sm">GEL / EUR</label>
                    <input
                        type="number"
                        step="0.01"
                        value={rates.EUR}
                        onChange={(e) => setRates(prev => ({ ...prev, EUR: parseFloat(e.target.value) || 0 }))}
                        className="col-span-2 w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
                    />
                </div>
                <div className="grid grid-cols-3 gap-4 items-center">
                    <label className="font-bold text-sm">ინფლაციის მაჩვენებელი (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={inflation}
                        onChange={(e) => setInflation(parseFloat(e.target.value) || 0)}
                        className="col-span-2 w-full px-3 py-2 border border-gray-300 rounded focus:border-black focus:ring-1 focus:ring-black outline-none"
                    />
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Save Indicators
                </button>
            </div>
        </>
      )}
    </div>
  );
};
