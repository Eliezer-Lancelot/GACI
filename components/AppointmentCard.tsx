import React from 'react';
import { Appointment } from '../types';
import { 
  Calendar, CheckCircle, Clock, AlertTriangle, Archive, Trash2, 
  Edit, ArrowUpCircle, Phone, MapPin, User as UserIcon, AlertCircle, XCircle 
} from 'lucide-react';

interface Props {
  appointment: Appointment;
  onConfirm?: (app: Appointment) => void;
  onEdit?: (app: Appointment) => void;
  onDelete?: (app: Appointment) => void;
  onTogglePriority?: (app: Appointment) => void;
  onArchive?: (app: Appointment) => void;
  onUpdateAttendance?: (app: Appointment, status: any) => void;
  onCancelConfirmation?: (app: Appointment) => void;
  isArchiveView?: boolean;
}

export const AppointmentCard: React.FC<Props> = ({ 
  appointment, onConfirm, onEdit, onDelete, onTogglePriority, onArchive, onUpdateAttendance, onCancelConfirmation, isArchiveView 
}) => {
  
  // Calculate expiry
  const daysSinceCreation = Math.floor((Date.now() - appointment.dataCriacao) / (1000 * 60 * 60 * 24));
  const daysUntilExpiry = 30 - daysSinceCreation;
  const isExpiringSoon = daysSinceCreation >= 25;
  
  // Determine styles
  let borderColor = 'border-gray-600';
  let iconColor = 'text-gray-400';
  let StatusIcon = Clock;

  if (appointment.status === 'Confirmado') {
    borderColor = 'border-green-500';
    iconColor = 'text-green-500';
    StatusIcon = CheckCircle;
  } else if (appointment.status === 'Aguardando') {
    if (isExpiringSoon) {
      borderColor = 'border-red-500';
      iconColor = 'text-red-500';
      StatusIcon = AlertTriangle;
    } else if (appointment.isPrioritario) {
      borderColor = 'border-yellow-500';
      iconColor = 'text-yellow-500';
    }
  }

  // Archive tags
  const getAttendanceTag = () => {
    switch (appointment.statusComparecimento) {
      case 'Realizado': return <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full font-bold">Realizado</span>;
      case 'NaoRealizado': return <span className="bg-orange-900 text-orange-200 text-xs px-2 py-1 rounded-full font-bold">Não Realizado</span>;
      case 'NaoCompareceu': return <span className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded-full font-bold">Não Compareceu</span>;
      default: return <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">Pendente</span>;
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg shadow-sm border-l-4 ${borderColor} p-4 mb-3 transition-all hover:bg-gray-750 hover:shadow-md`}>
      <div className="flex justify-between items-start">
        {/* Main Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon size={20} className={iconColor} />
            <h3 className={`font-bold text-lg ${isExpiringSoon && appointment.status === 'Aguardando' ? 'text-red-400' : 'text-gray-100'}`}>
              {appointment.nomeCompleto}
            </h3>
            
            {/* TAGS LOGIC */}
            {appointment.isPrioritario ? (
              <span className="bg-yellow-500 text-gray-900 text-xs px-2 py-0.5 rounded-full font-bold">
                Prioridade
              </span>
            ) : (
              /* Show "Normal" tag only for Waiting List items that are not priority. 
                 If expiring (<= 5 days left), it becomes RED. Else WHITE. */
              appointment.status === 'Aguardando' && (
                <span className={`${isExpiringSoon ? 'bg-red-600 text-white' : 'bg-white text-gray-900'} text-xs px-2 py-0.5 rounded-full font-bold`}>
                  Normal
                </span>
              )
            )}

            {isArchiveView && getAttendanceTag()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400 mt-2">
            <div className="flex items-center gap-2">
              <Phone size={14} /> 
              <span>{appointment.contatoPrincipal} {appointment.contatoSecundario ? `/ ${appointment.contatoSecundario}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} /> 
              <span>{appointment.endereco} - <strong>{appointment.cidade}</strong></span>
            </div>
          </div>

          {appointment.informacoesAdicionais && (
             <div className="mt-2 text-xs bg-gray-700 p-2 rounded text-gray-300 italic border border-gray-600">
               Obs: {appointment.informacoesAdicionais}
             </div>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Criado em: {new Date(appointment.dataCriacao).toLocaleDateString()}</span>
            {appointment.dataAgendamento && (
               <span className="font-semibold text-green-400">
                 Agendado para: {new Date(appointment.dataAgendamento).toLocaleString()}
               </span>
            )}
            {appointment.status === 'Aguardando' && (
              <span className={`${daysUntilExpiry <= 5 ? 'text-red-400 font-bold' : 'text-orange-400'}`}>
                {daysUntilExpiry > 0 ? `Vence em ${daysUntilExpiry} dias` : 'Vencido na lista'}
              </span>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="flex flex-col gap-2 ml-4">
          {!isArchiveView ? (
            <>
              {appointment.status === 'Aguardando' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onConfirm && onConfirm(appointment); }}
                  className="p-2 bg-green-900/30 text-green-400 rounded-full hover:bg-green-900/50"
                  title="Confirmar Agendamento"
                >
                  <CheckCircle size={18} />
                </button>
              )}

              {appointment.status === 'Confirmado' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onCancelConfirmation && onCancelConfirmation(appointment); }}
                  className="p-2 bg-red-900/30 text-red-400 rounded-full hover:bg-red-900/50"
                  title="Cancelar Agendamento"
                >
                  <XCircle size={18} />
                </button>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); onTogglePriority && onTogglePriority(appointment); }}
                className={`p-2 rounded-full hover:bg-yellow-900/50 ${appointment.isPrioritario ? 'bg-yellow-900/30 text-yellow-500' : 'bg-gray-700/50 text-gray-400'}`}
                title="Alternar Prioridade"
              >
                <ArrowUpCircle size={18} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onEdit && onEdit(appointment); }}
                className="p-2 bg-blue-900/30 text-blue-400 rounded-full hover:bg-blue-900/50"
                title="Editar"
              >
                <Edit size={18} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onArchive && onArchive(appointment); }}
                className="p-2 bg-orange-900/30 text-orange-400 rounded-full hover:bg-orange-900/50"
                title="Arquivar Manualmente"
              >
                <Archive size={18} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onDelete && onDelete(appointment); }}
                className="p-2 bg-red-900/30 text-red-400 rounded-full hover:bg-red-900/50"
                title="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            // Archive Actions
            <div className="flex flex-col gap-1 items-end">
               <div className="flex gap-1 mb-1">
                 <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(appointment); }} className="p-1.5 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 mr-1" title="Adicionar Info / Editar"><Edit size={14} /></button>
                 <button onClick={(e) => { e.stopPropagation(); onUpdateAttendance && onUpdateAttendance(appointment, 'Realizado'); }} className="px-2 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600">Realizado</button>
                 <button onClick={(e) => { e.stopPropagation(); onUpdateAttendance && onUpdateAttendance(appointment, 'NaoRealizado'); }} className="px-2 py-1 text-xs bg-orange-700 text-white rounded hover:bg-orange-600">N. Realiz.</button>
               </div>
               <div className="flex gap-1">
                 <button onClick={(e) => { e.stopPropagation(); onUpdateAttendance && onUpdateAttendance(appointment, 'NaoCompareceu'); }} className="px-2 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600">Faltou</button>
                 <button onClick={(e) => { e.stopPropagation(); onUpdateAttendance && onUpdateAttendance(appointment, 'Adiado'); }} className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Adiar (Voltar)</button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};