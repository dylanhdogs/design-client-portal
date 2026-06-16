import { ChecklistItem } from '../types';

interface PhaseCompletionCircleProps {
  items?: ChecklistItem[];
  size?: 'sm' | 'md';
  label?: string;
}

export default function PhaseCompletionCircle({ items = [], size = 'md', label = 'Complete' }: PhaseCompletionCircleProps) {
  const total = items.length;
  const completed = items.filter((item) => item.isCompleted || item.verificationStatus === 'APPROVED').length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const radius = size === 'sm' ? 16 : 22;
  const stroke = size === 'sm' ? 4 : 5;
  const dimension = size === 'sm' ? 44 : 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2" title={`${completed} of ${total} checklist items approved`}>
      <div className="relative shrink-0" style={{ width: dimension, height: dimension }}>
        <svg className="-rotate-90" width={dimension} height={dimension} viewBox={`0 0 ${dimension} ${dimension}`}>
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-200"
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={percentage === 100 ? 'text-green-500 transition-all' : 'text-blue-500 transition-all'}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} font-bold text-gray-700`}>
            {percentage}%
          </span>
        </div>
      </div>
      <div className="hidden sm:block leading-tight">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-500">{completed}/{total} approved</p>
      </div>
    </div>
  );
}
