import React, { useEffect, useMemo, useState } from 'react';

const monthOptions = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
];

export default function FXArbitrageCalculator() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activePage, setActivePage] = useState('dashboard');
  const [profileOpen, setProfileOpen] = useState(false);

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('luxury_fx_user');
    return saved ? JSON.parse(saved) : {
      name: '사용자',
      email: '',
      businessType: '개인사업자',
      plan: 'FREE'
    };
  });

  const [workspace, setWorkspace] = useState(() => {
    const saved = localStorage.getItem('luxury_fx_workspace');
    return saved ? JSON.parse(saved) : { id: 'personal', name: 'Personal Workspace' };
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentRate, setCurrentRate] = useState(9.5);

  const getRowsKey = (u, ws) => {
    if (ws?.id && ws.id !== 'personal') return `luxury_fx_rows_ws_${ws.id}`;
    if (u?.email) return `luxury_fx_rows_user_${u.email}`;
    return 'luxury_fx_rows_guest';
  };

  const [rows, setRows] = useState(() => {
    const key = getRowsKey(user, workspace);
    const saved = localStorage.getItem(key);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  useEffect(() => {
    const key = getRowsKey(user, workspace);
    localStorage.setItem(key, JSON.stringify(rows));
  }, [rows, user?.email, workspace?.id]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLatestRate = async () => {
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=KRW');
      const data = await res.json();
      const rate = Number(data.rates.KRW.toFixed(2));
      setCurrentRate(rate);
    } catch (e) {
      console.error('Rate fetch failed', e);
    }
  };

  useEffect(() => {
    fetchLatestRate();
    const interval = setInterval(fetchLatestRate, 3600000);
    return () => clearInterval(interval);
  }, []);

  const currentMonth = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonth;
  const currentTimeString = currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const currentDateString = currentTime.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const filteredRows = rows.filter(row => row.month === selectedMonth);

  const productSuggestions = useMemo(() => {
    return Array.from(new Set(rows.map(row => row.product.trim()).filter(p => p.length > 0)));
  }, [rows]);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: ['product', 'buyCurrency', 'sellCurrency', 'shippingCurrency', 'month', 'date', 'address'].includes(field) ? value : Number(value) } : row));
  };

  const addRow = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const seq = rows.length + 1;
    setRows(prev => [
      ...prev,
      {
        id: Date.now(),
        date: dateStr,
        seq: seq,
        product: '',
        buyPrice: 0,
        buyCurrency: 'KRW',
        sellPrice: 0,
        sellCurrency: 'KRW',
        exchangeRate: currentRate,
        shipping: 0,
        shippingCurrency: 'KRW',
        fee: 0,
        tax: 0,
        address: '',
        month: selectedMonth,
        trackingStep: 0,
        trackingCode: `YF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      }
    ]);
  };

  const removeRow = (id) => setRows(prev => prev.filter(row => row.id !== id));
  const formatNumber = (num) => isFinite(num) ? new Intl.NumberFormat('ko-KR').format(Math.round(num)) : '0';

  const calculateRow = (row) => {
    const buyPriceKRW = row.buyCurrency === 'JPY' ? row.buyPrice * row.exchangeRate : row.buyPrice;
    const sellPriceKRW = row.sellCurrency === 'JPY' ? row.sellPrice * row.exchangeRate : row.sellPrice;
    const shippingKRW = row.shippingCurrency === 'JPY' ? row.shipping * row.exchangeRate : row.shipping;
    const afterFee = sellPriceKRW * (1 - row.fee / 100);
    const taxAmount = afterFee * (row.tax / 100);
    const finalAsset = afterFee - shippingKRW - taxAmount;
    const profit = finalAsset - buyPriceKRW;
    const profitRate = buyPriceKRW > 0 ? ((profit / buyPriceKRW) * 100).toFixed(1) : '0.0';
    return { buyPriceKRW, sellPriceKRW, finalAsset, profit, profitRate, taxAmount };
  };

  const totalProfit = filteredRows.reduce((acc, row) => acc + calculateRow(row).profit, 0);
  const totalSales = filteredRows.reduce((acc, row) => acc + calculateRow(row).sellPriceKRW, 0);
  const profitableCount = filteredRows.filter(row => calculateRow(row).profit > 0).length;
  const averageProfitRate = filteredRows.length > 0 ? (filteredRows.reduce((acc, row) => acc + Number(calculateRow(row).profitRate), 0) / filteredRows.length).toFixed(1) : '0.0';

  const trackingSteps = ['구매대기', '구매완료', '배송준비', '배송시작', '공항도착', '현지배송준비', '현지배송시작', '현지공항도착', '최종배송중', '배송완료'];

  const params = new URLSearchParams(window.location.search);
  const trackingId = params.get('tracking');
  if (trackingId) return <CustomerTrackingView rows={rows} />;

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f5f7] text-zinc-900">
      <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-purple-300/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-blue-300/20 blur-3xl" />

      <header className="sticky top-0 z-50 border-b border-white/30 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.5em] text-zinc-400">FX Arbitrage System</p>
            <h1 className="text-3xl font-black tracking-tight">YenFlow</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end rounded-2xl border border-white/40 bg-white/60 px-5 py-3 backdrop-blur-xl shadow-sm">
              <p className="mb-1 text-xs uppercase tracking-[0.3em] text-zinc-400">Live Time</p>
              <p className="text-2xl font-black tracking-tight">{currentTimeString}</p>
              <p className="mt-1 text-sm text-zinc-500">{currentDateString}</p>
            </div>
            <nav className="flex gap-2">
              {['dashboard', 'sheet', 'workspace', 'tax', 'settings'].map(page => (
                <button key={page} onClick={() => setActivePage(page)} className={`rounded-2xl px-5 py-3 font-semibold transition-all ${activePage === page ? 'bg-zinc-900 text-white shadow-2xl' : 'border border-zinc-200 bg-white/80 text-zinc-700 hover:bg-zinc-100'}`}>
                  {page === 'dashboard' ? '대시보드' : page === 'sheet' ? '분석시트' : page === 'workspace' ? '팀원' : page === 'tax' ? '세금' : '설정'}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-10 p-6 md:p-10">
        <div className="mx-auto max-w-[1800px]">
          {activePage === 'dashboard' && (
            <div className="animate-in fade-in duration-700">
              <div className="mb-10 grid grid-cols-1 items-center gap-8 xl:grid-cols-2">
                <div>
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-4 py-2 shadow-sm">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <span className="text-sm text-zinc-600">실시간 글로벌 차익 분석 솔루션</span>
                  </div>
                  <h2 className="mb-6 text-6xl font-black leading-[1.05] tracking-tight">성공적인 트레이딩의<br />새로운 기준</h2>
                  <p className="mb-8 max-w-[700px] text-xl leading-relaxed text-zinc-500">환율 변동 데이터를 기반으로 순이익과 세금을 자동 계산하고 팀원과 협업하세요.</p>
                  <div className="flex gap-4">
                    <button onClick={() => setActivePage('sheet')} className="rounded-3xl bg-zinc-900 px-8 py-5 text-lg font-bold text-white shadow-xl hover:scale-[1.02] transition-all">거래 분석 시작</button>
                    <div className="rounded-3xl border border-zinc-200 bg-white/80 px-6 py-5 shadow-sm">
                      <p className="mb-1 text-xs text-zinc-400 font-bold uppercase">Real-time Rate</p>
                      <p className="text-2xl font-black">1엔 = {currentRate.toFixed(2)}원</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <LuxuryCard title="월 수익" value={`${formatNumber(totalProfit)}원`} />
                  <LuxuryCard title="총 매출" value={`${formatNumber(totalSales)}원`} />
                  <LuxuryCard title="수익 거래" value={`${profitableCount}건`} />
                  <div className="col-span-2 rounded-3xl bg-zinc-900 p-8 text-white">
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <p className="text-sm text-zinc-400 mb-2">평균 수익률</p>
                        <h3 className="text-5xl font-black">{averageProfitRate}%</h3>
                      </div>
                      <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-3xl">📈</div>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(Number(averageProfitRate) * 2, 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'sheet' && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black mb-2">분석 시트</h1>
                  <p className="text-zinc-500">실시간 환율 데이터를 반영한 정밀 분석</p>
                </div>
                <div className="flex gap-4">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm outline-none">
                    {monthOptions.map(m => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}
                  </select>
                  <button onClick={addRow} className="rounded-2xl bg-zinc-900 text-white px-6 py-3 font-bold shadow-lg hover:scale-[1.02] transition-all">+ 거래 추가</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[32px] border border-zinc-200 bg-white/80 shadow-2xl backdrop-blur-xl">
                <table className="w-full min-w-[2000px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-sm text-zinc-400 font-bold uppercase tracking-widest bg-zinc-50/50">
                      <th className="px-6 py-5 text-left w-[120px]">날짜</th>
                      <th className="px-6 py-5 text-left">상품명</th>
                      <th className="px-6 py-5 text-left">구매가</th>
                      <th className="px-6 py-5 text-left">판매가</th>
                      <th className="px-6 py-5 text-left">환율</th>
                      <th className="px-6 py-5 text-left">배송비</th>
                      <th className="px-6 py-5 text-left">수수료</th>
                      <th className="px-6 py-5 text-left">순이익</th>
                      <th className="px-6 py-5 text-left">수익률</th>
                      <th className="px-6 py-5 text-left">배송주소</th>
                      <th className="px-6 py-5 text-left">배송추적</th>
                      <th className="px-6 py-5 text-left">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => {
                      const res = calculateRow(row);
                      return (
                        <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-all">
                          <td className="px-6 py-5"><input type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} className="bg-transparent outline-none font-bold" /></td>
                          <td className="px-6 py-5"><input type="text" value={row.product} onChange={e => updateRow(row.id, 'product', e.target.value)} placeholder="상품명" className="w-[180px] bg-transparent outline-none font-bold placeholder:text-zinc-300" /></td>
                          <td className="px-6 py-5"><CurrencyInput value={row.buyPrice} currency={row.buyCurrency} onValueChange={v => updateRow(row.id, 'buyPrice', v)} onCurrencyChange={c => updateRow(row.id, 'buyCurrency', c)} /></td>
                          <td className="px-6 py-5"><CurrencyInput value={row.sellPrice} currency={row.sellCurrency} onValueChange={v => updateRow(row.id, 'sellPrice', v)} onCurrencyChange={c => updateRow(row.id, 'sellCurrency', c)} /></td>
                          <td className="px-6 py-5"><div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-xl font-bold text-sm w-fit">{row.exchangeRate} <span className="text-zinc-400">원/엔</span></div></td>
                          <td className="px-6 py-5"><CurrencyInput value={row.shipping} currency={row.shippingCurrency} onValueChange={v => updateRow(row.id, 'shipping', v)} onCurrencyChange={c => updateRow(row.id, 'shippingCurrency', c)} /></td>
                          <td className="px-6 py-5"><div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 rounded-xl font-bold text-sm w-fit"><input type="number" value={row.fee} onChange={e => updateRow(row.id, 'fee', e.target.value)} className="w-8 bg-transparent outline-none" />%</div></td>
                          <td className="px-6 py-5"><div className={`text-xl font-black ${res.profit >= 0 ? 'text-zinc-900' : 'text-red-500'}`}>{res.profit >= 0 ? '+' : ''}{formatNumber(res.profit)}원</div></td>
                          <td className="px-6 py-5"><div className="text-lg font-bold">{res.profit >= 0 ? '+' : ''}{res.profitRate}%</div></td>
                          <td className="px-6 py-5"><input type="text" value={row.address} onChange={e => updateRow(row.id, 'address', e.target.value)} placeholder="배송지 입력" className="w-[200px] border border-zinc-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-zinc-300" /></td>
                          <td className="px-6 py-5"><TrackingTimeline steps={trackingSteps} currentStep={row.trackingStep} trackingCode={row.trackingCode} onStepChange={s => updateRow(row.id, 'trackingStep', s)} /></td>
                          <td className="px-6 py-5"><button onClick={() => removeRow(row.id)} className="text-zinc-300 hover:text-red-500 transition-all">삭제</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'workspace' && <WorkspaceView user={user} />}
          {activePage === 'tax' && <TaxView formatNumber={formatNumber} profit={totalProfit} />}
          {activePage === 'settings' && <SettingsView user={user} setUser={setUser} />}
        </div>
      </main>
    </div>
  );
}

function CurrencyInput({ value, currency, onValueChange, onCurrencyChange }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-2xl px-4 py-2 shadow-sm w-fit">
      <input type="number" value={value} onChange={e => onValueChange(Number(e.target.value))} className="w-24 outline-none font-black text-lg" />
      <select value={currency} onChange={e => onCurrencyChange(e.target.value)} className="bg-transparent font-bold text-zinc-400 outline-none">
        <option value="KRW">원</option>
        <option value="JPY">엔</option>
      </select>
    </div>
  );
}

function LuxuryCard({ title, value }) {
  return (
    <div className="rounded-3xl border border-white/50 bg-white/70 p-6 backdrop-blur-xl shadow-sm">
      <p className="text-xs font-bold text-zinc-400 uppercase mb-2">{title}</p>
      <h3 className="text-3xl font-black">{value}</h3>
    </div>
  );
}

function TrackingTimeline({ steps, currentStep, trackingCode, onStepChange }) {
  const trackingUrl = `${window.location.origin}${window.location.pathname}?tracking=${trackingCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingUrl)}`;

  return (
    <div className="min-w-[450px] p-5 bg-zinc-50 rounded-[32px] border border-zinc-100 flex gap-4">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-black text-zinc-400 uppercase">Track: {trackingCode}</p>
          <button onClick={() => { navigator.clipboard.writeText(trackingUrl); alert('복사되었습니다!'); }} className="text-[10px] font-bold bg-zinc-900 text-white px-3 py-1 rounded-full">링크 복사</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {steps.map((s, i) => (
            <button key={i} onClick={() => onStepChange(i)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${i === currentStep ? 'bg-zinc-900 text-white' : i < currentStep ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-zinc-300'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className="w-20 h-20 bg-white rounded-2xl border border-zinc-100 flex items-center justify-center p-2 shadow-inner">
        <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
      </div>
    </div>
  );
}

function WorkspaceView({ user }) {
  return (
    <div className="animate-in fade-in py-10">
      <h1 className="text-5xl font-black mb-8 tracking-tight">팀 워크스페이스</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 bg-zinc-900 rounded-[32px] mb-6 flex items-center justify-center text-4xl text-white font-black">{user.name.charAt(0)}</div>
          <h3 className="text-2xl font-black mb-1">{user.name}</h3>
          <p className="text-zinc-400 font-bold mb-6">OWNER</p>
          <div className="w-full space-y-2">
            <button className="w-full py-3 bg-zinc-50 rounded-2xl font-bold text-zinc-600">활동 내역</button>
            <button className="w-full py-3 bg-zinc-50 rounded-2xl font-bold text-zinc-600">권한 설정</button>
          </div>
        </div>
        <button className="h-[300px] border-2 border-dashed border-zinc-200 rounded-[40px] flex flex-col items-center justify-center gap-4 text-zinc-400 hover:bg-white hover:border-zinc-400 transition-all">
          <span className="text-4xl">+</span>
          <span className="font-bold text-lg">팀원 초대하기</span>
        </button>
      </div>
    </div>
  );
}

function TaxView({ formatNumber, profit }) {
  const tax = profit > 0 ? profit * 0.1 : 0;
  return (
    <div className="animate-in slide-in-from-right-8 duration-700 py-10 max-w-[1000px]">
      <h1 className="text-5xl font-black mb-4">세금 분석 센터</h1>
      <p className="text-xl text-zinc-500 mb-12">현재 누적 수익을 기준으로 예상 세액을 산출합니다.</p>
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-zinc-900 text-white p-10 rounded-[48px] shadow-2xl">
          <p className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-widest">Expected Tax</p>
          <h2 className="text-6xl font-black mb-4">{formatNumber(tax)}원</h2>
          <p className="text-zinc-400">차익 거래 순수익 기준 약 10%의 부가세/관세를 가정한 예상 수치입니다.</p>
        </div>
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
            <p className="text-sm font-bold text-zinc-400 mb-2">총 거래 수익</p>
            <p className="text-3xl font-black">{formatNumber(profit)}원</p>
          </div>
          <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm">
            <p className="text-sm font-bold text-zinc-400 mb-2">실수령 예상액</p>
            <p className="text-3xl font-black text-emerald-500">{formatNumber(profit - tax)}원</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ user, setUser }) {
  return (
    <div className="py-10 max-w-[800px]">
      <h1 className="text-5xl font-black mb-12">설정</h1>
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 flex justify-between items-center">
          <div><p className="text-sm font-bold text-zinc-400 mb-1">이름</p><p className="text-xl font-black">{user.name}</p></div>
          <button className="text-zinc-400 font-bold">수정</button>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-zinc-100 flex justify-between items-center">
          <div><p className="text-sm font-bold text-zinc-400 mb-1">사업자 유형</p><p className="text-xl font-black">{user.businessType}</p></div>
          <button className="text-zinc-400 font-bold">수정</button>
        </div>
        <div className="bg-zinc-900 p-8 rounded-[40px] text-white flex justify-between items-center shadow-xl">
          <div><p className="text-sm font-bold text-zinc-500 mb-1 uppercase">Plan Status</p><p className="text-3xl font-black">{user.plan}</p></div>
          <button className="bg-white text-zinc-900 px-6 py-3 rounded-2xl font-black hover:scale-105 transition-all">업그레이드</button>
        </div>
      </div>
    </div>
  );
}

function CustomerTrackingView({ rows }) {
  const params = new URLSearchParams(window.location.search);
  const trackingId = params.get('tracking');
  const row = rows.find(r => r.trackingCode === trackingId);

  if (!row) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 font-black text-4xl">INFO NOT FOUND</div>;

  const steps = ['구매대기', '구매완료', '배송준비', '배송시작', '공항도착', '현지배송준비', '현지배송시작', '현지공항도착', '최종배송중', '배송완료'];
  const currentStep = row.trackingStep || 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const getStatusIcon = (step) => {
    if (step === 0) return '👛';
    if (step === 4 || step === 7) return '✈️';
    if (step === 8) return '🏃';
    if (step === 9) return '📦';
    return '🚚';
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="border-b border-zinc-100 py-8 px-6 text-center">
        <h1 className="text-3xl font-black tracking-tighter">YenFlow Tracking</h1>
      </div>
      <div className="max-w-[500px] mx-auto px-6 pt-16">
        <div className="text-center mb-16">
          <div className="w-40 h-40 bg-zinc-50 rounded-[48px] flex items-center justify-center text-8xl mx-auto mb-10 shadow-inner animate-bounce-slow">
            {getStatusIcon(currentStep)}
          </div>
          <p className="text-emerald-500 font-black text-sm tracking-[0.4em] mb-4 uppercase">Live Delivery Update</p>
          <h2 className="text-5xl font-black text-zinc-900 mb-4">{steps[currentStep]}</h2>
          <p className="text-zinc-300 font-mono text-lg">{row.trackingCode}</p>
        </div>

        <div className="bg-zinc-50 rounded-[48px] p-10 mb-10 border border-zinc-100 shadow-sm">
          <div className="space-y-10">
            <div>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Item</p>
              <p className="text-2xl font-black text-zinc-900">{row.product || '상품명 정보 없음'}</p>
            </div>
            <div>
              <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Destination</p>
              <p className="text-xl font-bold text-zinc-700 leading-relaxed">{row.address || '주소지 정보가 등록되지 않았습니다.'}</p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <div className="flex justify-between mb-4 px-4">
            <span className="text-xs font-black text-zinc-300">SHIPPING START</span>
            <span className="text-xs font-black text-zinc-900">ARRIVED</span>
          </div>
          <div className="h-4 bg-zinc-100 rounded-full overflow-hidden p-1">
            <div className="h-full bg-zinc-900 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="space-y-8">
          <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4">Timeline</h3>
          {steps.slice(0, currentStep + 1).reverse().map((step, idx) => (
            <div key={idx} className="flex items-center gap-6 animate-in slide-in-from-left-4 duration-500">
              <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-200'}`}></div>
              <p className={`font-black ${idx === 0 ? 'text-zinc-900 text-xl' : 'text-zinc-300 text-sm'}`}>{step}</p>
              {idx === 0 && <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase">Latest</span>}
            </div>
          ))}
        </div>

        <div className="mt-32 text-center">
          <p className="text-zinc-300 text-xs font-medium">© 2026 YenFlow Arbitrage Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
