import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [myGroups, setMyGroups] = useState([]); 
  const [currentGroup, setCurrentGroup] = useState(null);
  const [expenses, setExpenses] = useState([]); 
  const [balances, setBalances] = useState(null);
  const [debts, setDebts] = useState({ transactions: [], pending: [] });
  const [groupMembers, setGroupMembers] = useState([]);

  const [activeTab, setActiveTab] = useState('main');
  const [stats, setStats] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [dateStats, setDateStats] = useState([]);

  const [editId, setEditId] = useState(null);
  const [amount, setAmount] = useState(''); 
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Другое');

  const [splitMode, setSplitMode] = useState('equal');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [exactAmounts, setExactAmounts] = useState({});

  const [email, setEmail] = useState(''); 
  const [pass, setPass] = useState(''); 
  const [regName, setRegName] = useState(''); 
  const [phone, setPhone] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(''); 
  const [newGroupTitle, setNewGroupTitle] = useState('');

  const [qrData, setQrData] = useState(null);

  const COLORS = ['#3182ce', '#38a169', '#dd6b20', '#e53e3e', '#805ad5', '#319795'];
  const CATEGORIES = ["🍟 Еда", "🚗 Транспорт", "🏠 Жилье", "🎉 Досуг", "🛒 Покупки", "Другое"];
  
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const fetchMyGroups = async () => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/my-groups/${user.id}`);
    const data = await res.json(); if (data.status === 'success') setMyGroups(data.data);
  };

  const fetchGroupData = async () => {
    if (!currentGroup) return;
    try {
        const resExp = await fetch(`${API_URL}/api/expenses/list/${currentGroup.id}`);
        const dExp = await resExp.json(); if (dExp.status === 'success') setExpenses(dExp.data);

        const resBal = await fetch(`${API_URL}/api/balance/${currentGroup.id}`);
        const dBal = await resBal.json(); if (dBal.status === 'success') setBalances(dBal);

        const resMem = await fetch(`${API_URL}/api/groups/${currentGroup.id}/members`);
        const dMem = await resMem.json(); if (dMem.status === 'success') setGroupMembers(dMem.data);

        const resDebts = await fetch(`${API_URL}/api/debts/${currentGroup.id}`);
        const dDebts = await resDebts.json(); if (dDebts.status === 'success') setDebts({ transactions: dDebts.transactions, pending: dDebts.pending });

        const resStats = await fetch(`${API_URL}/api/stats/${currentGroup.id}`);
        setStats(await resStats.json());

        const resUserStats = await fetch(`${API_URL}/api/stats/users/${currentGroup.id}`);
        setUserStats(await resUserStats.json());

        const resDateStats = await fetch(`${API_URL}/api/stats/dates/${currentGroup.id}`);
        setDateStats(await resDateStats.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchMyGroups(); }, [user]);
  useEffect(() => { fetchGroupData(); }, [currentGroup]);

  const handleDeleteGroup = async (groupId, title) => {
    if (window.confirm(`Вы уверены, что хотите НАВСЕГДА удалить группу "${title}"?`)) {
      const res = await fetch(`${API_URL}/api/groups/delete/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Группа удалена");
        setCurrentGroup(null);
        fetchMyGroups();
      }
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (window.confirm(`Вы уверены, что хотите исключить ${memberName} из группы?`)) {
      const res = await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) fetchGroupData();
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    let payloadParticipants = [];

    if (splitMode === 'equal') {
      if (selectedMembers.length === 0) return alert("Выберите участников!");
      const share = parseFloat(amount) / selectedMembers.length;
      payloadParticipants = selectedMembers.map(id => ({ user_id: id, amount: share }));
    } else {
      const parts = Object.keys(exactAmounts).map(id => ({ user_id: parseInt(id), amount: parseFloat(exactAmounts[id] || 0) })).filter(p => p.amount > 0);
      const totalExact = parts.reduce((acc, curr) => acc + curr.amount, 0);
      if (parts.length === 0) return alert("Укажите суммы для участников!");
      if (Math.abs(totalExact - parseFloat(amount)) > 0.01) return alert(`Сумма долей (${totalExact}₽) не сходится с общей суммой (${amount}₽)!`);
      payloadParticipants = parts;
    }

    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API_URL}/api/expenses/update/${editId}` : `${API_URL}/api/expenses/add`;

    const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: currentGroup.id, paid_by: user.id, amount: parseFloat(amount), description: desc, category: category, participants: payloadParticipants })
    });

    if (res.ok) {
      setEditId(null); setAmount(''); setDesc(''); setCategory('Другое');
      setSplitMode('equal'); setExactAmounts({}); fetchGroupData();
    }
  };

  const deleteExpense = async (id) => {
    if (window.confirm("Удалить этот расход навсегда?")) {
        const res = await fetch(`${API_URL}/api/expenses/delete/${id}`, { method: 'DELETE' });
        if (res.ok) fetchGroupData();
    }
  };

  const startEdit = (item) => {
    setEditId(item.id); setDesc(item.description); setAmount(item.amount); setCategory(item.category || 'Другое');
    setSplitMode('exact');
    const amts = {};
    item.participants.forEach(p => { amts[p.user_id] = p.amount });
    setExactAmounts(amts);
    setActiveTab('main');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendSettlement = async (to_user, settle_amount) => {
    await fetch(`${API_URL}/api/settlements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: currentGroup.id, from_user: user.id, to_user: parseInt(to_user), amount: parseFloat(settle_amount) })
    });
    fetchGroupData();
  };

  const acceptSettlement = async (id) => {
    await fetch(`${API_URL}/api/settlements/${id}/accept`, { method: 'POST' });
    fetchGroupData();
  };

  if (!user) return (
    <div className="app-container" style={{maxWidth: '450px', marginTop: '100px'}}>
      <h1 style={{justifyContent: 'center', marginBottom: '24px'}}>💰 Bill Splitter</h1>
      <div className="card" style={{border: 'none', padding: 0}}>
        <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#4a5568'}}>{isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}</h3>
        <form onSubmit={async (e) => {
          e.preventDefault(); const endpoint = isRegister ? 'register' : 'login';
          const res = await fetch(`${API_URL}/api/${endpoint}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(isRegister ? {username: regName, email, password: pass, phone: phone} : {email, password: pass})
          });
          const data = await res.json();
          if (data.status === 'success') {
            const u = { id: data.user_id, name: data.username, email: data.email }; setUser(u); localStorage.setItem('user', JSON.stringify(u));
          } else alert(data.message);
        }}>
          {isRegister && <input type="text" placeholder="Ваше имя" onChange={e=>setRegName(e.target.value)} required />}
          {isRegister && <input type="tel" placeholder="Номер телефона (для СБП)" onChange={e=>setPhone(e.target.value)} required />}
          <input type="email" placeholder="Электронная почта" onChange={e=>setEmail(e.target.value)} required />
          <input type="password" placeholder="Пароль" onChange={e=>setPass(e.target.value)} required />
          <button type="submit" style={{marginTop: '15px'}}>{isRegister ? 'Зарегистрироваться' : 'Войти в систему'}</button>
        </form>
        <p onClick={()=>setIsRegister(!isRegister)} style={{cursor:'pointer', color:'#3182ce', marginTop:20, textAlign: 'center', fontSize: '14px', fontWeight: '500'}}>
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Еще нет аккаунта? Зарегистрироваться'}
        </p>
      </div>
    </div>
  );

  if (!currentGroup) return (
    <div className="app-container" style={{maxWidth: '800px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '30px'}}>
        <h1 style={{margin: 0}}>📋 Мои группы</h1>
        <button onClick={()=>{setUser(null); localStorage.removeItem('user'); window.location.reload();}} className="btn-secondary" style={{width:'auto', padding: '10px 20px'}}>Выйти</button>
      </div>

      <div className="card" style={{marginBottom: '32px', background: '#f8fafc'}}>
        <h3 style={{fontSize: '16px', marginBottom: '12px'}}>Создать новое финансовое пространство</h3>
        <form onSubmit={async (e)=>{e.preventDefault(); await fetch(`${API_URL}/api/groups`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:newGroupTitle, creator_id:user.id})}); setNewGroupTitle(''); fetchMyGroups()}} style={{display:'flex', gap:12}}>
          <input type="text" placeholder="Название группы (например: Поездка на Алтай)" value={newGroupTitle} onChange={e=>setNewGroupTitle(e.target.value)} required style={{margin: 0}} />
          <button type="submit" style={{width:'auto', whiteSpace: 'nowrap', padding: '0 30px'}}>+ Создать</button>
        </form>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:20}}>
        {myGroups.map(g => (
          <div key={g.id} className="card" style={{position: 'relative', border:'1px solid #e2e8f0', padding: '30px 20px', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
            <div onClick={()=>setCurrentGroup(g)} style={{cursor:'pointer', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
              <span style={{fontSize: '32px'}}>📁</span>
              <h3 style={{margin: 0, fontSize: '18px', color: '#2d3748'}}>{g.title}</h3>
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id, g.title); }}
              style={{position: 'absolute', top: '12px', right: '12px', cursor: 'pointer', opacity: 0.4, fontSize: '14px', padding: '4px'}}
              title="Удалить группу"
            >
              ❌
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-container" style={{position: 'relative'}}>
      {qrData && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(26, 32, 44, 0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000, backdropFilter: 'blur(4px)'}}>
          <div className="card" style={{textAlign:'center', width: '340px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'}}>
            <h3 style={{margin: '0 0 8px 0'}}>Перевод для {qrData.to_name}</h3>
            <p style={{fontSize: '18px', margin: '0 0 20px 0'}}>К оплате: <b style={{color: '#38a169'}}>{qrData.amount}₽</b></p>
            {qrData.to_phone ? (
              <div style={{marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                <p style={{margin: '0 0 12px 0', fontSize: '15px', color: '#4a5568'}}>
                  Номер привязан к СБП: <br/><b style={{color: '#1a202c', fontSize: '16px'}}>{qrData.to_phone}</b>
                </p>
                <button onClick={() => { navigator.clipboard.writeText(qrData.to_phone); alert('Номер телефона скопирован!'); }} style={{padding: '10px', fontSize: '14px'}}>📋 Скопировать номер</button>
              </div>
            ) : (
              <p style={{fontSize: '13px', color: '#e53e3e', marginBottom: '20px', fontWeight: '500'}}>Пользователь не указал номер телефона.</p>
            )}
            <div style={{background:'#fff', padding:16, borderRadius:16, display:'inline-block', border: '1px solid #e2e8f0', marginBottom: '12px'}}>
              <QRCodeSVG value={`ST00012|Name=${qrData.to_name}|PersonalAcc=40817810000000000000|BankName=ПАО СБЕРБАНК|BIC=044525225|CorrespAcc=30101810400000000225|Sum=${Math.round(qrData.amount * 100)}|PayeeINN=7707083893|Purpose=Возврат долга`} size={180} />
            </div>
            <p style={{fontSize:'12px', color:'#718096', margin: '0 0 20px 0', lineHeigh: '1.4'}}>ГОСТ Р 56042-2014<br/>Отсканируйте в приложении любого банка</p>
            <button onClick={()=>setQrData(null)} className="btn-secondary">Закрыть окно</button>
          </div>
        </div>
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:30, borderBottom: '1px solid #edf2f7', paddingBottom: '20px', gap: '20px', flexWrap: 'wrap'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <button onClick={()=>{setCurrentGroup(null); setEditId(null); setActiveTab('main')}} className="btn-secondary" style={{width:'auto', padding: '8px 16px'}}>⬅ К группам</button>
          <h2 style={{margin: 0, fontSize: '22px'}}>📁 {currentGroup.title}</h2>
        </div>
        <div style={{display:'flex', alignItems: 'center', gap:16}}>
          <div className="tab-container">
            <button onClick={() => setActiveTab('main')} className={`tab-button ${activeTab === 'main' ? 'active' : ''}`}>🧾 Расчеты</button>
            <button onClick={() => setActiveTab('analytics')} className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}>📊 Аналитика</button>
          </div>
          <button onClick={()=>{setUser(null); localStorage.removeItem('user'); window.location.reload();}} className="btn-secondary" style={{width:'auto', padding: '10px 16px'}}>Выйти</button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px'}}>
            <div className="card" style={{margin: 0}}>
              <h3 style={{fontSize: '16px', marginBottom: '20px', color: '#4a5568'}}>🍕 Траты по категориям</h3>
              <div style={{height: 300}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={4} dataKey="value">
                      {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} ₽`} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{margin: 0}}>
              <h3 style={{fontSize: '16px', marginBottom: '20px', color: '#4a5568'}}>💳 Общие расходы участников</h3>
              <div style={{height: 300}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#718096" fontSize={12} />
                    <YAxis stroke="#718096" fontSize={12} />
                    <Tooltip formatter={(value) => `${value} ₽`} />
                    <Bar dataKey="amount" fill="#3182ce" radius={[6, 6, 0, 0]} name="Оплачено" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{margin: 0}}>
            <h3 style={{fontSize: '16px', marginBottom: '20px', color: '#4a5568'}}>📈 Динамика расходов по дням</h3>
            <div style={{height: 300}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dateStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#718096" fontSize={12} />
                  <YAxis stroke="#718096" fontSize={12} />
                  <Tooltip formatter={(value) => `${value} ₽`} />
                  <Line type="monotone" dataKey="amount" stroke="#38a169" name="Сумма" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="main-grid">
          <div className="left">
            <div className="card" style={{borderColor: editId ? '#dd6b20' : '#e2e8f0', background: editId ? '#fffaf0' : '#fff'}}>
              <h3 style={{fontSize: '18px', marginBottom: '16px'}}>{editId ? '✏️ Редактирование чека' : '➕ Добавить новый чек'}</h3>
              <form onSubmit={handleSubmitExpense}>
                <input type="text" placeholder="Название покупки" value={desc} onChange={e=>setDesc(e.target.value)} required />
                <div style={{display:'flex', gap:12}}>
                  <input type="number" placeholder="Сумма (₽)" value={amount} onChange={e=>setAmount(e.target.value)} required />
                  <select value={category} onChange={e=>setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{display:'flex', gap:8, margin: '8px 0 14px 0', background: '#edf2f7', padding: '4px', borderRadius: '10px'}}>
                  <button type="button" onClick={()=>setSplitMode('equal')} style={{padding:'8px', fontSize: '13px', background: splitMode==='equal'?'#fff':'transparent', color: splitMode==='equal'?'#3182ce':'#4a5568', boxShadow: splitMode==='equal'?'0 2px 4px rgba(0,0,0,0.05)':'none'}}>Разделить поровну</button>
                  <button type="button" onClick={()=>setSplitMode('exact')} style={{padding:'8px', fontSize: '13px', background: splitMode==='exact'?'#fff':'transparent', color: splitMode==='exact'?'#3182ce':'#4a5568', boxShadow: splitMode==='exact'?'0 2px 4px rgba(0,0,0,0.05)':'none'}}>Указать доли</button>
                </div>
                <div className="members-list-scroll">
                  <span style={{fontSize:'13px', color: '#718096', fontWeight: '500', display: 'block', marginBottom: '8px'}}>Выберите плательщиков / должников:</span>
                  {splitMode === 'equal' ? (
                    groupMembers.map(m => {
                      const isSelected = selectedMembers.includes(m.id);
                      return (
                        <label key={m.id} className={`custom-checkbox-label ${isSelected ? 'selected' : ''}`}>
                          <input type="checkbox" className="custom-checkbox-input" checked={isSelected} onChange={()=>setSelectedMembers(p => p.includes(m.id) ? p.filter(x=>x!==m.id) : [...p, m.id])} />
                          <div className="custom-checkbox-box"></div>
                          <span style={{fontSize: 14, color: isSelected ? '#2b6cb0' : '#4a5568', fontWeight: isSelected ? '600' : '400'}}>{m.name} {m.id === user.id && <small style={{color: '#a0aec0', fontWeight: 'normal'}}>(вы)</small>}</span>
                        </label>
                      )
                    })
                  ) : (
                    groupMembers.map(m => (
                      <div key={m.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '4px 0'}}>
                        <span style={{fontSize:14, color: '#2d3748'}}>{m.name}</span>
                        <input type="number" placeholder="0 ₽" value={exactAmounts[m.id] || ''} onChange={e=>setExactAmounts({...exactAmounts, [m.id]: e.target.value})} style={{width: 90, padding: '8px', margin: 0}} />
                      </div>
                    ))
                  )}
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px'}}>
                  <button type="submit" style={{background: editId ? '#dd6b20' : '#3182ce'}}>{editId ? 'Сохранить изменения' : 'Внести расход'}</button>
                  {editId && <button type="button" onClick={()=>{setEditId(null); setAmount(''); setDesc(''); setCategory('Другое'); setSplitMode('equal'); setExactAmounts({})}} className="btn-secondary">Отмена</button>}
                </div>
              </form>
            </div>
            <h3>📜 История операций</h3>
            <div className="card" style={{maxHeight: '400px', overflowY: 'auto', padding: '12px 20px'}}>
              {expenses.length === 0 ? <p style={{color: '#a0aec0', textAlign: 'center', margin: '20px 0'}}>В этой группе еще нет расходов</p> : null}
              {expenses.map(item => (
                <div key={item.id} className="expense-item">
                  <div><span style={{fontWeight: '600', fontSize: '15px'}}>{item.category.split(' ')[0]} {item.description}</span><br/><small style={{color: '#718096'}}>Оплатил: <b>{item.paid_by}</b></small></div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}><b style={{fontSize: '16px', color: '#1a202c'}}>{item.amount} ₽</b><div style={{display: 'flex', gap: '8px'}}><span onClick={()=>startEdit(item)} style={{cursor:'pointer', fontSize: '16px', padding: '4px'}}>✏️</span><span onClick={()=>deleteExpense(item.id)} style={{cursor:'pointer', fontSize: '16px', padding: '4px'}}>🗑️</span></div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="right">
            <h3>📊 Положение участников</h3>
            {balances && <div className="card">
              <div className="summary-header">Общие траты группы: {balances.total_spent} ₽</div>
              {balances.data.map(u => {
                const isPositive = u.balance >= 0;
                return (
                  <div key={u.name} className={`balance-row ${isPositive ? 'positive-border' : 'negative-border'}`}>
                    <span style={{fontWeight: '500'}}>{u.name}</span>
                    <span className={isPositive ? 'positive' : 'negative'}>{isPositive ? `+${u.balance}` : u.balance} ₽</span>
                  </div>
                );
              })}
            </div>}
            <h3>💸 Оптимальные переводы</h3>
            <div className="card">
              {debts.transactions.length === 0 && debts.pending.length === 0 ? (<p style={{color:'#38a169', fontWeight:'600', textAlign: 'center', margin: '10px 0'}}>🎉 Все взаиморасчеты закрыты!</p>) : null}
              {debts.pending.map(p => (
                <div key={p.id} className="balance-row" style={{background: '#fffaf0', borderLeft: '4px solid #dd6b20', padding: '12px 16px'}}>
                  <div style={{fontSize: '14px'}}><strong>{p.from_name}</strong> отправил <strong>{p.to_name}</strong><br/><b style={{color: '#dd6b20'}}>{p.amount} ₽</b></div>
                  <div>{user.id === p.to_id ? (<button onClick={() => acceptSettlement(p.id)} style={{background: '#38a169', padding: '6px 12px', fontSize: '13px', width: 'auto'}}>✅ Подтвердить</button>) : (<span style={{color: '#dd6b20', fontSize: '13px', fontWeight: '500'}}>⏳ Проверка...</span>)}</div>
                </div>
              ))}
              {debts.transactions.map((t, idx) => {
                const hasPending = debts.pending.some(p => p.from_id === t.from_id && p.to_id === t.to_id)
                if (hasPending) return null;
                return (
                  <div key={idx} className="balance-row" style={{background: '#f8fafc', padding: '14px 16px'}}>
                    <div style={{fontSize: '14px'}}><strong>{t.from_name}</strong> ➡️ <strong>{t.to_name}</strong><br/><small style={{color: '#718096'}}>Сумма долга: <b>{t.amount} ₽</b></small></div>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}><button onClick={()=>setQrData(t)} style={{padding: '8px', background:'#805ad5', width:'36px', height: '36px', margin:0, fontSize: '16px'}}>📱</button>{user.id === t.from_id && (<form onSubmit={(e) => { e.preventDefault(); sendSettlement(t.to_id, e.target.amount.value); }} style={{display:'flex', gap:6, margin:0}}><input type="number" name="amount" defaultValue={t.amount} max={t.amount} step="0.01" required style={{width: '70px', padding: '8px', margin:0, height: '36px', borderRadius: '8px'}}/><button type="submit" style={{padding: '0 12px', margin:0, background:'#3182ce', height: '36px', fontSize: '13px', width: 'auto'}}>Отдать</button></form>)}</div>
                  </div>
                )
              })}
            </div>
            <h3>👥 Участники группы</h3>
            <div className="card" style={{padding: '20px'}}>
              <div style={{marginBottom: '16px', maxHeight: '180px', overflowY: 'auto'}} className="members-list-scroll">
                {groupMembers.map(m => (
                  <div key={m.id} className="member-row">
                    <span style={{fontSize: '15px', color: '#2d3748', fontWeight: m.id === user.id ? '600' : '400'}}>{m.name} {m.id === user.id ? <span style={{color: '#718096', fontWeight: 'normal'}}>(Вы)</span> : ''}</span>
                    {m.id !== user.id && (<span onClick={() => handleRemoveMember(m.id, m.name)} style={{cursor: 'pointer', fontSize: '14px', color: '#e53e3e', padding: '4px'}} title="Исключить участника">❌</span>)}
                  </div>
                ))}
              </div>
              <div style={{borderTop: '1px solid #e2e8f0', paddingTop: '16px'}}>
                <form onSubmit={async (e)=>{e.preventDefault(); await fetch(`${API_URL}/api/groups/add_member`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({group_id:currentGroup.id, email:inviteEmail})}); setInviteEmail(''); fetchGroupData()}} style={{display:'flex', gap:8}}>
                  <input type="email" placeholder="Email для приглашения" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} required style={{margin: 0}} />
                  <button type="submit" style={{width:'auto', padding: '0 20px', whiteSpace: 'nowrap'}}>Добавить</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
