import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/SharedComponents';
import { api } from '../utils/api';
import { 
  TrendingUp, 
  Wallet, 
  Layers, 
  Settings, 
  ArrowUpRight,
  PieChart,
  DollarSign,
  Activity
} from 'lucide-react';
import { Shareholder, FinancialRecord } from '../types';

interface ShareholderDashboardProps {
  lang: 'en' | 'ha';
  dictionary: any;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export const ShareholderDashboard: React.FC<ShareholderDashboardProps> = ({ 
  lang, 
  dictionary,
  activeTab, 
  setActiveTab 
}) => {
  const [shareholder, setShareholder] = useState<Shareholder | null>(null);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const me = await api.getSelfShareholderData();
      setShareholder(me);
      const fin = await api.getFinance();
      setFinancials(fin || []);
    } catch (err) {
      console.error("Failed to fetch shareholder data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !shareholder) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-brand-navy text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="h-24 w-24" />
          </div>
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {lang === 'en' ? "Total Investment" : "Jarin da aka Saka"}
            </p>
            <h3 className="text-3xl font-black mt-1 text-brand-gold">
              ₦{shareholder?.investment_amount?.toLocaleString() || '0'}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <ArrowUpRight className="h-3 w-3" />
              <span>+12.5% {lang === 'en' ? "growth" : "girma"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'en' ? "Current Dividend" : "Ribar da aka samu"}
                </p>
                <h3 className="text-xl font-black mt-1 text-slate-900">
                  ₦{((shareholder?.investment_amount || 0) * 0.05).toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <PieChart className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'en' ? "Ownership Stake" : "Kason Hannun Jari"}
                </p>
                <h3 className="text-xl font-black mt-1 text-slate-900">
                  {shareholder?.equity_percentage || '0'}%
                </h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Recent Distributions" : "Raba Ribar Kwanan Nan"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {financials.filter(f => f.type === 'revenue').slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{f.description}</p>
                    <p className="text-[10px] text-slate-500">{new Date(f.date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+₦{(f.amount * (shareholder?.equity_percentage || 0) / 100).toLocaleString()}</span>
                </div>
              ))}
              {financials.length === 0 && (
                <p className="text-center py-6 text-sm text-slate-400 italic">
                  {lang === 'en' ? "No distributions recorded yet." : "Ba a raba riba ba tukunna."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-gold" />
              {lang === 'en' ? "Operations Status" : "Yanayin Aiki"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-900 rounded-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-400 uppercase tracking-tighter font-bold">{lang === 'en' ? "Active Cycle" : "Tsarin Aiki"}</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>{lang === 'en' ? "Progress to Goal" : "Tafiya zuwa Burinmu"}</span>
                  <span className="text-brand-gold font-bold">75%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-gold w-3/4 rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 bg-bg-base min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            {lang === 'en' ? "Investor Command" : "Bangaren Masu Hannun Jari"}
          </h1>
          <p className="text-sm text-slate-500">
            {lang === 'en' ? "Managing assets for shareholder:" : "Kula da jarin:"} <span className="font-bold text-slate-900">{shareholder?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <DollarSign className="h-4 w-4" />
            {lang === 'en' ? "Withdraw Dividends" : "Cire Riba"}
          </Button>
        </div>
      </div>

      <Tabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={[
          { id: 'overview', label: lang === 'en' ? "Overview" : "Bayanai", icon: <Layers className="h-4 w-4" /> },
          { id: 'ledger', label: lang === 'en' ? "Ledger" : "Bilan", icon: <Wallet className="h-4 w-4" /> },
          { id: 'cycles', label: lang === 'en' ? "Business Cycles" : "Tsarin Aiki", icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'settings', label: lang === 'en' ? "Settings" : "Kula da Akun", icon: <Settings className="h-4 w-4" /> },
        ]}
      />

      <div className="mt-2">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab !== 'overview' && (
          <div className="p-20 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
            <Activity className="h-12 w-12 text-brand-gold mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
              {lang === 'en' ? "Secure Module Restricted" : "Wannan Bangaren Yana Gyara"}
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              We are currently optimizing the <strong>{activeTab}</strong> module for high-frequency financial auditing. Please check back shortly for updated telemetry.
            </p>
            <Button 
              onClick={() => setActiveTab('overview')}
              className="mt-6 bg-brand-gold text-slate-950 hover:bg-yellow-500 font-bold"
            >
              {lang === 'en' ? "Return to Overview" : "Koma Babban Shafin"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
