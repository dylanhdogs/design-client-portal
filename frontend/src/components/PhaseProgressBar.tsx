import { CheckCircle, Clock, Circle } from 'lucide-react';

interface PhaseProgressBarProps {
  currentPhase: number;
  phases: {
    name: string;
    displayName: string;
    order: number;
    status: string;
  }[];
  onPhaseClick?: (order: number) => void;
  interactive?: boolean;
}

export default function PhaseProgressBar({ currentPhase, phases, onPhaseClick, interactive = false }: PhaseProgressBarProps) {
  const getPhaseIcon = (_order: number, status: string) => {
    if (status === 'COMPLETED') {
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    } else if (status === 'IN_PROGRESS') {
      return <Clock className="h-6 w-6 text-blue-500" />;
    } else {
      return <Circle className="h-6 w-6 text-gray-300" />;
    }
  };

  const getPhaseColor = (_order: number, status: string) => {
    if (status === 'COMPLETED') return 'bg-green-50 border-green-300 text-green-800';
    if (status === 'IN_PROGRESS') return 'bg-blue-50 border-blue-300 text-blue-800';
    return 'bg-gray-50 border-gray-200 text-gray-500';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-3 left-0 right-0 h-1 bg-gray-200 -z-10"></div>
        <div
          className="absolute top-3 left-0 h-1 bg-green-500 -z-10 transition-all"
          style={{ width: `${Math.min(((currentPhase - 1) / (phases.length - 1)) * 100, 100)}%` }}
        ></div>

        {phases.map((phase) => (
          <div
            key={phase.order}
            className={`flex flex-col items-center gap-2 ${interactive ? 'cursor-pointer' : ''}`}
            onClick={() => interactive && onPhaseClick?.(phase.order)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${getPhaseColor(phase.order, phase.status)}`}>
              {getPhaseIcon(phase.order, phase.status)}
            </div>
            <span className="text-xs font-medium text-center max-w-[80px] leading-tight">
              {phase.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
