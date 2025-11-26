export type UserRole = 'admin' | 'funcionario';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string; // In a real app, this would be hashed
}

export type AppointmentStatus = 'Aguardando' | 'Confirmado' | 'Arquivado';
export type AttendanceStatus = 'Realizado' | 'NaoRealizado' | 'NaoCompareceu' | 'Adiado' | null;

export interface Appointment {
  id: string;
  nomeCompleto: string;
  contatoPrincipal: string;
  contatoSecundario?: string;
  endereco: string;
  cidade: string; // Added to handle "Outras Cidades" logic
  informacoesAdicionais?: string;
  dataCriacao: number; // Timestamp
  isPrioritario: boolean;
  status: AppointmentStatus;
  dataAgendamento?: number | null; // Timestamp
  statusComparecimento?: AttendanceStatus;
}

export interface NewAppointmentDTO {
  nomeCompleto: string;
  contatoPrincipal: string;
  contatoSecundario?: string;
  endereco: string;
  cidade: string;
  informacoesAdicionais?: string;
  isPrioritario: boolean;
}
