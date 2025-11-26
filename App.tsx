import React, { useState, useEffect, useMemo } from 'react';
import { StorageService, AppConfig } from './services/storageService';
import { User, Appointment, NewAppointmentDTO, AttendanceStatus } from './types';
import { AppointmentCard } from './components/AppointmentCard';
import { 
  Users, LogOut, Search, Plus, List, Map, Archive, X, Menu, Settings, Eye, EyeOff, Save, Edit,
  FileText, FileSpreadsheet, File
} from 'lucide-react';

// Declare jsPDF globally
declare global {
  interface Window {
    jspdf: any;
  }
}

// --- Sub-components ---

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X size={24} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// --- Time Slot Generators ---
const generateTimeSlots = () => {
  const slots: string[] = [];
  // Morning: 08:10 -> 11:10 (20 min intervals)
  let start = new Date(); start.setHours(8, 10, 0, 0);
  let end = new Date(); end.setHours(11, 10, 0, 0);
  while (start <= end) {
    slots.push(start.toTimeString().substring(0, 5));
    start.setMinutes(start.getMinutes() + 20);
  }
  
  // Afternoon: 14:10 -> 17:10
  start = new Date(); start.setHours(14, 10, 0, 0);
  end = new Date(); end.setHours(17, 10, 0, 0);
  while (start <= end) {
    slots.push(start.toTimeString().substring(0, 5));
    start.setMinutes(start.getMinutes() + 20);
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// --- Main App ---

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState('confirmados'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig>({ slotsPerDay: 20 });

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Appointment | null>(null);
  
  // Confirmation Modal State
  const [confirmingItem, setConfirmingItem] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [slotsCount, setSlotsCount] = useState(0);

  // Login State
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Admin State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [newUserForm, setNewUserForm] = useState<Partial<User>>({ role: 'funcionario' });

  // Audit State
  const [auditFields, setAuditFields] = useState({
    nome: true,
    endereco: true,
    contato: true,
    data: true,
    info: true
  });
  const [auditFilter, setAuditFilter] = useState({
    status: 'todos', // todos, confirmados, espera, arquivados
    period: 'all', // all, custom
    startDate: '',
    endDate: ''
  });

  // Load Data
  useEffect(() => {
    StorageService.init();
    StorageService.checkArchiving(); 
    
    const user = StorageService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      refreshData();
    }
  }, []);

  const refreshData = () => {
    setAppointments([...StorageService.getAppointments()]);
    setUsersList([...StorageService.getUsers()]);
    setAppConfig(StorageService.getConfig());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = StorageService.login(loginId, loginPass);
    if (user) {
      setCurrentUser(user);
      refreshData();
      setLoginError('');
    } else {
      setLoginError('Credenciais inválidas.');
    }
  };

  const handleLogout = () => {
    StorageService.logout();
    setCurrentUser(null);
    setLoginId('');
    setLoginPass('');
    setActiveTab('confirmados');
  };

  // --- Date/Time Logic for Confirmation ---

  useEffect(() => {
    if (selectedDate && isConfirmOpen) {
      const appsOnDate = StorageService.getAppointmentsForDate(selectedDate);
      
      // Calculate occupied time strings (HH:MM)
      const times = appsOnDate.map(a => {
        if (!a.dataAgendamento) return '';
        const d = new Date(a.dataAgendamento);
        return d.toTimeString().substring(0, 5);
      });

      setOccupiedSlots(times);
      setSlotsCount(appsOnDate.length);
    } else {
      setOccupiedSlots([]);
      setSlotsCount(0);
    }
  }, [selectedDate, isConfirmOpen, appointments]);

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingItem || !selectedDate || !selectedTime) {
      alert("Selecione data e horário.");
      return;
    }

    const dateObj = new Date(`${selectedDate}T${selectedTime}`);
    
    // Config Check
    if (slotsCount >= appConfig.slotsPerDay) {
       alert('Limite de vagas para este dia atingido.');
       return;
    }

    StorageService.updateAppointment({
      ...confirmingItem,
      status: 'Confirmado',
      dataAgendamento: dateObj.getTime()
    });
    
    setIsConfirmOpen(false);
    setConfirmingItem(null);
    setSelectedDate('');
    setSelectedTime('');
    refreshData();
  };

  const handleCancelConfirmation = (app: Appointment) => {
    if (confirm(`Deseja cancelar o agendamento de ${app.nomeCompleto} e retorná-lo para a fila de espera?`)) {
      const updatedApp = {
        ...app,
        status: 'Aguardando' as const,
        dataAgendamento: null
      };
      StorageService.updateAppointment(updatedApp);
      refreshData();
    }
  };

  // --- Export / Audit Logic ---

  const generateExportData = () => {
    let data = appointments;

    // Filter by Status
    if (auditFilter.status !== 'todos') {
       if (auditFilter.status === 'espera') {
         data = data.filter(a => a.status === 'Aguardando');
       } else if (auditFilter.status === 'confirmados') {
         data = data.filter(a => a.status === 'Confirmado');
       } else if (auditFilter.status === 'arquivados') {
         data = data.filter(a => a.status === 'Arquivado');
       }
    }

    // Filter by Date (Using dataCriacao as baseline, or dataAgendamento if available? Defaulting to creation for audit trail)
    if (auditFilter.period === 'custom' && auditFilter.startDate && auditFilter.endDate) {
      const start = new Date(auditFilter.startDate).setHours(0,0,0,0);
      const end = new Date(auditFilter.endDate).setHours(23,59,59,999);
      
      data = data.filter(a => {
        // Use Scheduled date if confirmed/archived and exists, otherwise Creation date
        const targetDate = (a.dataAgendamento) ? a.dataAgendamento : a.dataCriacao;
        return targetDate >= start && targetDate <= end;
      });
    }

    return data;
  };

  const handleExport = (format: 'pdf' | 'excel' | 'txt' | 'word' | 'docx') => {
    const data = generateExportData();
    if (data.length === 0) {
      alert('Nenhum dado encontrado para os filtros selecionados.');
      return;
    }

    const headers = [];
    if (auditFields.nome) headers.push('Nome Completo');
    if (auditFields.endereco) headers.push('Endereço');
    if (auditFields.contato) headers.push('Contato');
    if (auditFields.data) headers.push('Data Agendamento');
    if (auditFields.info) headers.push('Info Adicional');

    const rows = data.map(item => {
      const row = [];
      if (auditFields.nome) row.push(item.nomeCompleto);
      if (auditFields.endereco) row.push(`${item.endereco} - ${item.cidade}`);
      if (auditFields.contato) row.push(`${item.contatoPrincipal} ${item.contatoSecundario ? '/ '+item.contatoSecundario : ''}`);
      if (auditFields.data) {
        row.push(item.dataAgendamento 
          ? new Date(item.dataAgendamento).toLocaleString() 
          : 'Aguardando / N/A');
      }
      if (auditFields.info) row.push(item.informacoesAdicionais || '-');
      return row;
    });

    const fileName = `GACI_Auditoria_${new Date().toISOString().split('T')[0]}`;

    if (format === 'pdf') {
       if (!window.jspdf) {
         alert('Erro ao carregar biblioteca PDF.');
         return;
       }
       const { jsPDF } = window.jspdf;
       const doc = new jsPDF();
       doc.text(`Relatório de Auditoria - GACI`, 14, 15);
       doc.setFontSize(10);
       doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);
       doc.text(`Registros: ${rows.length}`, 14, 27);
       
       (doc as any).autoTable({
         head: [headers],
         body: rows,
         startY: 32,
         theme: 'grid',
         styles: { fontSize: 8 },
       });
       doc.save(`${fileName}.pdf`);
    } else if (format === 'excel') {
       // CSV Approach for Excel
       const csvContent = [
         headers.join(','), 
         ...rows.map(r => r.map(c => `"${c}"`).join(','))
       ].join('\n');
       
       const blob = new Blob(["\ufeff"+csvContent], { type: 'text/csv;charset=utf-8;' });
       const link = document.createElement("a");
       link.href = URL.createObjectURL(blob);
       link.download = `${fileName}.csv`;
       link.click();
    } else if (format === 'txt') {
       const txtContent = rows.map(r => r.join(' | ')).join('\n');
       const blob = new Blob([`RELATÓRIO GACI\n----------------\nHEAD: ${headers.join(' | ')}\n\n${txtContent}`], { type: 'text/plain' });
       const link = document.createElement("a");
       link.href = URL.createObjectURL(blob);
       link.download = `${fileName}.txt`;
       link.click();
    } else if (format === 'word' || format === 'docx') {
       // HTML to Word
       const tableHtml = `
         <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
         <head><meta charset='utf-8'><title>Export HTML To Doc</title></head>
         <body>
           <h2>Relatório de Auditoria - GACI</h2>
           <table border="1" style="border-collapse: collapse; width: 100%;">
             <thead>
               <tr style="background-color: #f2f2f2;">
                 ${headers.map(h => `<th style="padding: 8px;">${h}</th>`).join('')}
               </tr>
             </thead>
             <tbody>
               ${rows.map(row => `<tr>${row.map(cell => `<td style="padding: 8px;">${cell}</td>`).join('')}</tr>`).join('')}
             </tbody>
           </table>
         </body>
         </html>
       `;
       const blob = new Blob([tableHtml], { type: 'application/vnd.ms-word' });
       const link = document.createElement("a");
       link.href = URL.createObjectURL(blob);
       link.download = `${fileName}.doc`;
       link.click();
    }
  };

  // --- CRUD Actions ---

  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const dto: NewAppointmentDTO = {
      nomeCompleto: formData.get('nome') as string,
      contatoPrincipal: formData.get('contato1') as string,
      contatoSecundario: formData.get('contato2') as string,
      endereco: formData.get('endereco') as string,
      cidade: (formData.get('cidade') as string) || 'Buritis',
      informacoesAdicionais: formData.get('info') as string,
      isPrioritario: formData.get('prioridade') === 'on'
    };

    if (editingItem) {
      // Preserve ID and creation date
      const updated = { ...editingItem, ...dto };
      StorageService.updateAppointment(updated);
    } else {
      StorageService.createAppointment(dto);
    }
    setIsFormOpen(false);
    setEditingItem(null);
    refreshData();
  };

  const updateAttendance = (app: Appointment, status: AttendanceStatus) => {
    if (status === 'Adiado') {
      StorageService.updateAppointment({
        ...app,
        status: 'Aguardando',
        dataAgendamento: null,
        statusComparecimento: null
      });
    } else {
      StorageService.updateAppointment({
        ...app,
        statusComparecimento: status
      });
    }
    refreshData();
  };

  const togglePriority = (app: Appointment) => {
    StorageService.updateAppointment({ ...app, isPrioritario: !app.isPrioritario });
    refreshData();
  };

  const deleteApp = (app: Appointment) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      StorageService.deleteAppointment(app.id);
      refreshData();
    }
  };

  const archiveApp = (app: Appointment) => {
    if (confirm('Arquivar este agendamento?')) {
      StorageService.updateAppointment({ ...app, status: 'Arquivado' });
      refreshData();
    }
  };

  // --- Admin User Management ---
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // If ID exists in form state, we are editing, otherwise creating
    const userId = newUserForm.id || formData.get('id_input') as string || Date.now().toString();

    const user: User = {
      id: userId,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as any
    };
    StorageService.saveUser(user);
    setNewUserForm({ role: 'funcionario' }); // Reset
    refreshData();
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveConfig(appConfig);
    alert('Configurações salvas!');
  };

  const prepareEditUser = (user: User) => {
    setNewUserForm({ ...user });
  };

  // --- Filters & Sorting ---

  const getFilteredAppointments = () => {
    const list = appointments;

    if (activeTab === 'pesquisa') {
      const lower = searchTerm.toLowerCase();
      return list.filter(a => 
        a.nomeCompleto.toLowerCase().includes(lower) || 
        a.endereco.toLowerCase().includes(lower) ||
        a.contatoPrincipal.includes(lower)
      );
    }

    if (activeTab === 'arquivados') {
      return list.filter(a => a.status === 'Arquivado');
    }

    if (activeTab === 'outras') {
      return list.filter(a => a.status !== 'Arquivado' && a.cidade !== 'Buritis' && a.cidade !== 'Local');
    }

    if (activeTab === 'espera') {
      // 'Local' is legacy for 'Buritis', so we check both
      const pending = list.filter(a => a.status === 'Aguardando' && (a.cidade === 'Buritis' || a.cidade === 'Local'));
      return pending.sort((a, b) => {
        if (a.isPrioritario === b.isPrioritario) {
          return a.dataCriacao - b.dataCriacao;
        }
        return a.isPrioritario ? -1 : 1;
      });
    }

    if (activeTab === 'confirmados') {
       const confirmed = list.filter(a => a.status === 'Confirmado');
       return confirmed.sort((a, b) => (a.dataAgendamento || 0) - (b.dataAgendamento || 0));
    }

    return [];
  };

  const groupedOtherCities = useMemo(() => {
    if (activeTab !== 'outras') return {};
    const filtered = getFilteredAppointments();
    return filtered.reduce((groups: any, item) => {
      const city = item.cidade;
      if (!groups[city]) groups[city] = [];
      groups[city].push(item);
      return groups;
    }, {});
  }, [appointments, activeTab, searchTerm]);

  // --- Views ---

  if (!currentUser) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#ffffff] relative overflow-hidden">
        
        {/* LOGIN BOX CLEAN - NO LOGOS */}
        <div className="flex items-center justify-center w-full px-4 relative z-10">
            
            <div className="bg-[#000000] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800 relative z-50">
              
              <div className="text-center mb-8">
                <h1 className="text-6xl font-bold text-white mb-2">GACI</h1>
                <p className="text-gray-400">Gestão de Agendamentos de Carteiras de Identidade Nacional</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Email ou ID</label>
                  <input 
                    type="text" 
                    className="mt-1 block w-full rounded border-gray-500 bg-gray-50 border p-2 focus:border-blue-500 focus:ring-blue-500 text-black" 
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-300">Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="mt-1 block w-full rounded border-gray-500 bg-gray-50 border p-2 pr-10 focus:border-blue-500 focus:ring-blue-500 text-black" 
                      value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer pt-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <button type="submit" className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
                  Entrar
                </button>
              </form>
            </div>
        </div>

        {/* SUPPORTERS BOX - LOGIN SCREEN - FIXED BOTTOM LEFT */}
        <div className="fixed bottom-4 left-4 z-50">
           <div className="bg-gray-900 rounded p-4 text-center border border-gray-800 shadow-lg">
              <h4 className="text-gray-400 text-xs font-bold uppercase mb-2 border-b border-gray-700 pb-1">Apoiadores</h4>
              <p className="text-sm font-semibold text-gray-300">Câmara Municipal de Buritis - MG</p>
              <p className="text-sm font-semibold text-gray-300 mt-1">Prefeitura de Buritis - MG</p>
           </div>
        </div>
        
        <div className="absolute bottom-4 text-center text-black font-bold text-sm w-full pointer-events-none">
           Sistema idealizado por Marcelo M. e Programado por Eliézer R.
        </div>
      </div>
    );
  }

  // --- Authenticated Layout ---

  return (
    <div className="min-h-screen bg-[#181818] flex flex-col md:flex-row text-gray-100">
      {/* Sidebar - FIXED COLOR to #000000 */}
      <div className={`fixed inset-y-0 left-0 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 w-64 bg-[#000000] text-white flex flex-col shadow-lg`}>
        <div className="p-6 font-bold text-5xl tracking-wider flex justify-between items-center text-center justify-center">
           GACI
           <button className="md:hidden" onClick={() => setIsMenuOpen(false)}><X /></button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {/* Colors changed specifically for Confirmados (Green) and Espera (Red) */}
          <button onClick={() => setActiveTab('confirmados')} className={`flex items-center w-full px-4 py-3 rounded transition ${activeTab === 'confirmados' ? 'bg-green-700 shadow-lg' : 'hover:bg-green-800 bg-green-900/40'}`}>
            <List className="mr-3" size={20} /> Confirmados
          </button>
          <button onClick={() => setActiveTab('espera')} className={`flex items-center w-full px-4 py-3 rounded transition ${activeTab === 'espera' ? 'bg-red-700 shadow-lg' : 'hover:bg-red-800 bg-red-900/40'}`}>
            <Users className="mr-3" size={20} /> Lista de Espera
          </button>
          <button onClick={() => setActiveTab('outras')} className={`flex items-center w-full px-4 py-3 rounded transition ${activeTab === 'outras' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
            <Map className="mr-3" size={20} /> Outras Cidades
          </button>
          <button onClick={() => setActiveTab('pesquisa')} className={`flex items-center w-full px-4 py-3 rounded transition ${activeTab === 'pesquisa' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
            <Search className="mr-3" size={20} /> Pesquisa
          </button>
          <button onClick={() => setActiveTab('arquivados')} className={`flex items-center w-full px-4 py-3 rounded transition ${activeTab === 'arquivados' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}>
            <Archive className="mr-3" size={20} /> Arquivados
          </button>
          
          {currentUser.role === 'admin' && (
             <button onClick={() => setActiveTab('admin')} className={`flex items-center w-full px-4 py-3 rounded mt-8 transition ${activeTab === 'admin' ? 'bg-red-700' : 'bg-red-600 hover:bg-red-500'}`}>
               <Settings className="mr-3" size={20} /> Administração
             </button>
          )}
        </nav>

        {/* Supporters Box */}
        <div className="px-4 pb-2 mt-auto">
          <div className="bg-gray-900 rounded p-3 text-center border border-gray-800">
             <h4 className="text-gray-400 text-xs font-bold uppercase mb-2 border-b border-gray-700 pb-1">Apoiadores</h4>
             <p className="text-sm font-semibold text-gray-300">Câmara Municipal de Buritis - MG</p>
             <p className="text-sm font-semibold text-gray-300 mt-1">Prefeitura de Buritis - MG</p>
          </div>
        </div>

        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <p className="text-sm font-semibold">{currentUser.name}</p>
          <p className="text-xs text-blue-200 capitalize">
            {currentUser.role === 'admin' ? 'Administrador' : 'Funcionário'}
          </p>
          <button onClick={handleLogout} className="mt-2 flex items-center text-sm text-red-300 hover:text-white">
            <LogOut className="mr-2" size={16} /> Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile - FIXED COLOR to #000000 */}
        <div className="md:hidden bg-[#000000] text-white p-4 flex justify-between items-center shadow">
           <span className="font-bold">GACI</span>
           <button onClick={() => setIsMenuOpen(true)}><Menu /></button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-100 capitalize">
                {activeTab === 'outras' ? 'Agendamentos Outras Cidades' : 
                activeTab === 'admin' ? 'Gerenciamento' :
                activeTab === 'espera' ? 'Lista de Espera' :
                `Lista: ${activeTab}`}
              </h1>
              {activeTab !== 'admin' && activeTab !== 'arquivados' && (
                <button 
                  onClick={() => { setEditingItem(null); setIsFormOpen(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transform hover:scale-105 transition"
                >
                  <Plus className="mr-2" size={20} /> Novo Agendamento
                </button>
              )}
            </div>

            {/* Views Logic */}
            {activeTab === 'admin' && currentUser.role === 'admin' ? (
              <div className="space-y-6">
                {/* System Config */}
                <div className="bg-gray-800 rounded shadow p-6 text-gray-100 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center"><Settings className="mr-2" /> Configuração do Sistema</h3>
                  <form onSubmit={handleSaveConfig} className="flex items-end gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Vagas por Dia</label>
                      <input 
                        type="number" 
                        value={appConfig.slotsPerDay} 
                        onChange={e => setAppConfig({...appConfig, slotsPerDay: parseInt(e.target.value)})}
                        className="bg-gray-900 border border-gray-600 p-2 rounded text-white w-32"
                      />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center">
                      <Save className="mr-2" size={16} /> Salvar Config
                    </button>
                  </form>
                </div>

                {/* AUDIT / EXPORT SECTION */}
                <div className="bg-gray-800 rounded shadow p-6 text-gray-100 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center"><FileText className="mr-2" /> Auditoria e Exportação de Dados</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Fields */}
                    <div>
                      <h4 className="font-semibold text-gray-400 mb-2 border-b border-gray-600 pb-1">1. Dados para Exportar</h4>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={auditFields.nome} onChange={() => setAuditFields({...auditFields, nome: !auditFields.nome})} className="form-checkbox text-blue-600" />
                          <span>Nome Completo</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={auditFields.endereco} onChange={() => setAuditFields({...auditFields, endereco: !auditFields.endereco})} className="form-checkbox text-blue-600" />
                          <span>Endereço</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={auditFields.contato} onChange={() => setAuditFields({...auditFields, contato: !auditFields.contato})} className="form-checkbox text-blue-600" />
                          <span>Contato</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={auditFields.data} onChange={() => setAuditFields({...auditFields, data: !auditFields.data})} className="form-checkbox text-blue-600" />
                          <span>Data de Agendamento</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={auditFields.info} onChange={() => setAuditFields({...auditFields, info: !auditFields.info})} className="form-checkbox text-blue-600" />
                          <span>Informações Adicionais</span>
                        </label>
                      </div>
                    </div>

                    {/* Filters */}
                    <div>
                      <h4 className="font-semibold text-gray-400 mb-2 border-b border-gray-600 pb-1">2. Filtros e Período</h4>
                      
                      <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Status do Agendamento</label>
                        <select 
                          value={auditFilter.status} 
                          onChange={e => setAuditFilter({...auditFilter, status: e.target.value})}
                          className="bg-gray-900 border border-gray-600 p-2 rounded text-white w-full"
                        >
                          <option value="todos">Todos</option>
                          <option value="confirmados">Agendados (Confirmados)</option>
                          <option value="espera">Em Espera</option>
                          <option value="arquivados">Arquivados</option>
                        </select>
                      </div>

                      <div className="mb-2">
                        <label className="block text-sm text-gray-400 mb-1">Período de Tempo</label>
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="period" 
                              checked={auditFilter.period === 'all'} 
                              onChange={() => setAuditFilter({...auditFilter, period: 'all'})}
                              className="mr-2"
                            />
                            Todo o período
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name="period" 
                              checked={auditFilter.period === 'custom'} 
                              onChange={() => setAuditFilter({...auditFilter, period: 'custom'})}
                              className="mr-2"
                            />
                            Selecionar período
                          </label>
                        </div>
                      </div>

                      {auditFilter.period === 'custom' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input 
                            type="date" 
                            className="bg-gray-900 border border-gray-600 p-2 rounded text-white"
                            value={auditFilter.startDate}
                            onChange={e => setAuditFilter({...auditFilter, startDate: e.target.value})}
                          />
                          <input 
                            type="date" 
                            className="bg-gray-900 border border-gray-600 p-2 rounded text-white"
                            value={auditFilter.endDate}
                            onChange={e => setAuditFilter({...auditFilter, endDate: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Actions */}
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <h4 className="font-semibold text-gray-400 mb-4">3. Gerar Arquivo</h4>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => handleExport('pdf')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center font-bold">
                        <FileText size={18} className="mr-2" /> PDF
                      </button>
                      <button onClick={() => handleExport('docx')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center font-bold">
                        <File size={18} className="mr-2" /> DOCX
                      </button>
                      <button onClick={() => handleExport('word')} className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 rounded flex items-center font-bold">
                        <File size={18} className="mr-2" /> WORD
                      </button>
                      <button onClick={() => handleExport('txt')} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center font-bold">
                        <FileText size={18} className="mr-2" /> TXT
                      </button>
                      <button onClick={() => handleExport('excel')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center font-bold">
                        <FileSpreadsheet size={18} className="mr-2" /> EXCEL
                      </button>
                    </div>
                  </div>
                </div>

                {/* User Management */}
                <div className="bg-gray-800 rounded shadow p-6 text-gray-100 border border-gray-700">
                  <h3 className="text-lg font-bold mb-4">Gerenciar Usuários</h3>
                  <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 bg-gray-700 p-4 rounded border border-gray-600">
                    <input name="id_input" value={newUserForm.id || ''} placeholder="ID (Novo ou Existente)" onChange={e => setNewUserForm({...newUserForm, id: e.target.value})} className="bg-gray-800 border border-gray-600 p-2 rounded text-white" required />
                    <input name="name" value={newUserForm.name || ''} placeholder="Nome" onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} className="bg-gray-800 border border-gray-600 p-2 rounded text-white" required />
                    <input name="email" value={newUserForm.email || ''} placeholder="Email" onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} className="bg-gray-800 border border-gray-600 p-2 rounded text-white" required />
                    <input name="password" value={newUserForm.password || ''} type="text" placeholder="Senha" onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} className="bg-gray-800 border border-gray-600 p-2 rounded text-white" required />
                    <select name="role" value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value as any})} className="bg-gray-800 border border-gray-600 p-2 rounded text-white">
                      <option value="funcionario">Funcionário</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded col-span-1 md:col-span-5 flex justify-center items-center font-bold">
                      <Save className="mr-2" size={16} /> Salvar / Atualizar Usuário
                    </button>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Função</th>
                          <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {usersList.map(u => (
                          <tr key={u.id} className="hover:bg-gray-750">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-300">{u.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{u.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{u.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-red-900 text-red-200' : 'bg-gray-700'}`}>
                                {u.role === 'admin' ? 'Administrador' : 'Funcionário'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                              <button onClick={() => prepareEditUser(u)} className="text-blue-400 hover:text-blue-300 flex items-center text-sm">
                                <Edit size={14} className="mr-1" /> Editar
                              </button>
                              <button onClick={() => { if(confirm('Excluir usuário?')) { StorageService.deleteUser(u.id); refreshData(); } }} className="text-red-400 hover:text-red-300 ml-2 text-sm">
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'pesquisa' ? (
              <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Pesquisar por nome, telefone ou endereço..." 
                    className="w-full p-4 text-lg bg-gray-800 border-2 border-gray-700 text-white rounded-lg focus:border-blue-500 focus:outline-none placeholder-gray-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <div>
                    {getFilteredAppointments().map(app => (
                      <AppointmentCard 
                        key={app.id} 
                        appointment={app} 
                        onConfirm={() => { 
                          setConfirmingItem(app); 
                          setSelectedDate(''); setSelectedTime(''); 
                          setIsConfirmOpen(true); 
                          }}
                        onEdit={() => { setEditingItem(app); setIsFormOpen(true); }}
                        onDelete={deleteApp}
                        onTogglePriority={togglePriority}
                        onArchive={archiveApp}
                        onCancelConfirmation={handleCancelConfirmation}
                      />
                    ))}
                    {searchTerm && getFilteredAppointments().length === 0 && (
                      <p className="text-gray-500 text-center mt-10">Nenhum resultado encontrado.</p>
                    )}
                  </div>
              </div>
            ) : activeTab === 'outras' ? (
              <div className="space-y-6">
                {Object.keys(groupedOtherCities).length === 0 && <p className="text-gray-500">Nenhum agendamento para outras cidades.</p>}
                {Object.keys(groupedOtherCities).map(city => (
                  <div key={city} className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
                    <div className="bg-blue-900 px-4 py-2 font-bold text-white border-b border-blue-800">{city}</div>
                    <div className="p-4">
                      {groupedOtherCities[city].map((app: Appointment) => (
                        <AppointmentCard 
                          key={app.id} 
                          appointment={app} 
                          onConfirm={() => { 
                            setConfirmingItem(app); 
                            setSelectedDate(''); setSelectedTime('');
                            setIsConfirmOpen(true); 
                            }}
                          onEdit={() => { setEditingItem(app); setIsFormOpen(true); }}
                          onDelete={deleteApp}
                          onTogglePriority={togglePriority}
                          onArchive={archiveApp}
                          onCancelConfirmation={handleCancelConfirmation}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Default Lists (Confirmados, Espera, Arquivados)
              <div className="space-y-2">
                {getFilteredAppointments().map(app => (
                  <AppointmentCard 
                    key={app.id} 
                    appointment={app} 
                    isArchiveView={activeTab === 'arquivados'}
                    onConfirm={() => { 
                      setConfirmingItem(app); 
                      setSelectedDate(''); setSelectedTime('');
                      setIsConfirmOpen(true); 
                    }}
                    onEdit={() => { setEditingItem(app); setIsFormOpen(true); }}
                    onDelete={deleteApp}
                    onTogglePriority={togglePriority}
                    onArchive={archiveApp}
                    onUpdateAttendance={updateAttendance}
                    onCancelConfirmation={handleCancelConfirmation}
                  />
                ))}
                {getFilteredAppointments().length === 0 && (
                  <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-lg border border-dashed border-gray-700">
                    <p>A lista está vazia.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <footer className="mt-8 pt-4 border-t border-gray-800 text-center text-gray-600 text-sm pb-4">
             Sistema idealizado por Marcelo M. e Programado por Eliézer R.
          </footer>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Create/Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingItem ? 'Editar Agendamento' : 'Novo Agendamento'}>
        <form onSubmit={handleSaveAppointment} className="space-y-4 text-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
            <input name="nome" defaultValue={editingItem?.nomeCompleto} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-300">Contato 1</label>
                <input name="contato1" defaultValue={editingItem?.contatoPrincipal} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm" required />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-300">Contato 2 (Opcional)</label>
                <input name="contato2" defaultValue={editingItem?.contatoSecundario} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm" />
             </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2">
               <label className="block text-sm font-medium text-gray-300">Endereço</label>
               <input name="endereco" defaultValue={editingItem?.endereco} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm" required />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-300">Cidade</label>
               <select name="cidade" defaultValue={editingItem?.cidade || 'Buritis'} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm">
                 <option value="Buritis">Buritis (Local)</option>
                 <option value="Arinos">Arinos</option>
                 <option value="Outra">Outras</option>
               </select>
             </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Informações Adicionais</label>
            <textarea name="info" defaultValue={editingItem?.informacoesAdicionais} className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-2 shadow-sm" rows={3}></textarea>
          </div>
          <div className="flex items-center">
            <input type="checkbox" name="prioridade" id="prioridade" defaultChecked={editingItem?.isPrioritario} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700" />
            <label htmlFor="prioridade" className="ml-2 block text-sm text-gray-300">Marcar como Prioridade</label>
          </div>
          <div className="pt-4 flex justify-end">
             <button type="button" onClick={() => setIsFormOpen(false)} className="mr-3 px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 hover:bg-gray-700">Cancelar</button>
             <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Salvar</button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Confirmar Agendamento">
        <form onSubmit={handleConfirmSubmit} className="space-y-4 text-gray-100">
          <p className="text-sm text-gray-300">
             Agendando para: <strong>{confirmingItem?.nomeCompleto}</strong>
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Selecione a Data</label>
            {/* WRAPPED IN CLICK HANDLER TO ENSURE PICKER OPENS */}
            <input 
              type="date" 
              value={selectedDate}
              onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
              onChange={e => {
                setSelectedDate(e.target.value);
                setSelectedTime('');
              }}
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white border p-4 cursor-pointer text-lg" 
              required 
            />
          </div>

          {selectedDate && (
            <div>
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-medium text-gray-300">Horários Disponíveis</label>
                 <span className={`text-xs font-bold ${slotsCount >= appConfig.slotsPerDay ? 'text-red-400' : 'text-green-400'}`}>
                   Vagas: {Math.max(0, appConfig.slotsPerDay - slotsCount)} Restantes
                 </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
                {TIME_SLOTS.map(time => {
                  const isOccupied = occupiedSlots.includes(time);
                  const isSelected = selectedTime === time;
                  
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={isOccupied || (slotsCount >= appConfig.slotsPerDay && !isOccupied)}
                      onClick={() => setSelectedTime(time)}
                      className={`
                        text-sm py-2 px-1 rounded border
                        ${isOccupied 
                          ? 'bg-red-900 border-red-700 text-red-200 cursor-not-allowed opacity-60' 
                          : isSelected
                            ? 'bg-green-600 border-green-500 text-white font-bold ring-2 ring-green-400'
                            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                        }
                      `}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Vermelho = Ocupado | Branco = Livre | Verde = Selecionado
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end">
             <button type="button" onClick={() => setIsConfirmOpen(false)} className="mr-3 px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 hover:bg-gray-700">Cancelar</button>
             <button 
               type="submit" 
               disabled={!selectedDate || !selectedTime}
               className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                 ${(!selectedDate || !selectedTime) ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
             >
               Confirmar
             </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}