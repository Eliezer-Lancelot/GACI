import { Appointment, User, NewAppointmentDTO, AppointmentStatus, AttendanceStatus } from '../types';

// Keys
const USERS_KEY = 'gaci_users_v3';
const APPOINTMENTS_KEY = 'gaci_appointments_v2'; // Bumped version for city compatibility
const CURRENT_USER_KEY = 'gaci_current_user';
const CONFIG_KEY = 'gaci_config';

// Interfaces
export interface AppConfig {
  slotsPerDay: number;
}

// Seed Data
const seedUsers: User[] = [
  { id: '1542018', name: 'Eliézer', email: 'eliezer@gaci.com', role: 'admin', password: 'IBr140321' },
  { id: '1243210', name: 'Marcelo', email: 'marcelo@gaci.com', role: 'admin', password: 'IBr140321' },
];

const seedAppointments: Appointment[] = [
  {
    id: '101',
    nomeCompleto: 'João Silva',
    contatoPrincipal: '99999-1111',
    endereco: 'Rua das Flores, 123',
    cidade: 'Buritis',
    dataCriacao: Date.now() - 26 * 24 * 60 * 60 * 1000, // 26 days ago (Alert)
    isPrioritario: false,
    status: 'Aguardando',
  },
  {
    id: '102',
    nomeCompleto: 'Maria Souza',
    contatoPrincipal: '99999-2222',
    endereco: 'Av Central, 500',
    cidade: 'Buritis',
    dataCriacao: Date.now() - 2 * 24 * 60 * 60 * 1000,
    isPrioritario: true,
    status: 'Aguardando',
  },
  {
    id: '103',
    nomeCompleto: 'Carlos Pereira',
    contatoPrincipal: '99999-3333',
    endereco: 'Sítio Boa Vista',
    cidade: 'Arinos',
    dataCriacao: Date.now() - 5 * 24 * 60 * 60 * 1000,
    isPrioritario: false,
    status: 'Aguardando',
  }
];

const defaultConfig: AppConfig = {
  slotsPerDay: 20 // Default capacity
};

// Helpers
const getStorage = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultVal;
  }
};

const setStorage = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

export const StorageService = {
  // --- Init ---
  init: () => {
    if (!localStorage.getItem(USERS_KEY)) {
      setStorage(USERS_KEY, seedUsers);
    }
    if (!localStorage.getItem(APPOINTMENTS_KEY)) {
      setStorage(APPOINTMENTS_KEY, seedAppointments);
    }
    if (!localStorage.getItem(CONFIG_KEY)) {
      setStorage(CONFIG_KEY, defaultConfig);
    }
  },

  // --- Config ---
  getConfig: (): AppConfig => getStorage(CONFIG_KEY, defaultConfig),
  
  saveConfig: (config: AppConfig) => setStorage(CONFIG_KEY, config),

  // --- Auth & Users ---
  getUsers: (): User[] => getStorage(USERS_KEY, []),
  
  saveUser: (user: User) => {
    const users = getStorage<User[]>(USERS_KEY, []);
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user; // Update existing
    } else {
      users.push(user); // Create new
    }
    setStorage(USERS_KEY, users);
  },

  deleteUser: (id: string) => {
    const users = getStorage<User[]>(USERS_KEY, []);
    setStorage(USERS_KEY, users.filter(u => u.id !== id));
  },

  login: (loginInput: string, password: string): User | null => {
    const users = getStorage<User[]>(USERS_KEY, []);
    const user = users.find(u => (u.email === loginInput || u.id === loginInput) && u.password === password);
    if (user) {
      setStorage(CURRENT_USER_KEY, user);
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => getStorage(CURRENT_USER_KEY, null),

  // --- Appointments ---
  getAppointments: (): Appointment[] => getStorage(APPOINTMENTS_KEY, []),

  createAppointment: (dto: NewAppointmentDTO): Appointment => {
    const apps = getStorage<Appointment[]>(APPOINTMENTS_KEY, []);
    const newApp: Appointment = {
      id: Date.now().toString(),
      ...dto,
      dataCriacao: Date.now(),
      status: 'Aguardando',
      statusComparecimento: null,
      dataAgendamento: null,
    };
    apps.push(newApp);
    setStorage(APPOINTMENTS_KEY, apps);
    return newApp;
  },

  updateAppointment: (updated: Appointment) => {
    const apps = getStorage<Appointment[]>(APPOINTMENTS_KEY, []);
    const index = apps.findIndex(a => a.id === updated.id);
    if (index !== -1) {
      apps[index] = updated;
      setStorage(APPOINTMENTS_KEY, apps);
    }
  },

  deleteAppointment: (id: string) => {
    const apps = getStorage<Appointment[]>(APPOINTMENTS_KEY, []);
    setStorage(APPOINTMENTS_KEY, apps.filter(a => a.id !== id));
  },

  // Daily Check (Simulated Cloud Function)
  checkArchiving: () => {
    const apps = getStorage<Appointment[]>(APPOINTMENTS_KEY, []);
    let changed = false;
    const now = Date.now();

    const newApps = apps.map(app => {
      // Archive if confirmed and date has passed (simple check: if agendamento was yesterday or before)
      if (app.status === 'Confirmado' && app.dataAgendamento) {
        const appDate = new Date(app.dataAgendamento);
        const today = new Date();
        // Reset hours to compare dates only
        appDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        if (appDate < today) {
          changed = true;
          return { ...app, status: 'Arquivado' as AppointmentStatus };
        }
      }
      return app;
    });

    if (changed) {
      setStorage(APPOINTMENTS_KEY, newApps);
    }
  },

  // Get appointments for a specific date string (YYYY-MM-DD)
  getAppointmentsForDate: (dateString: string): Appointment[] => {
    const apps = getStorage<Appointment[]>(APPOINTMENTS_KEY, []);
    return apps.filter(a => {
      if (a.status !== 'Confirmado' || !a.dataAgendamento) return false;
      const d = new Date(a.dataAgendamento);
      // Format YYYY-MM-DD
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const aDate = `${year}-${month}-${day}`;
      return aDate === dateString;
    });
  }
};