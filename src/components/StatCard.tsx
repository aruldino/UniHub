import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

const StatCard = ({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) => {
  return (
    <div className={cn('uni-stat-card uni-card-interactive animate-fade-up', className)}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[13px] font-medium text-[#6B7280]">{title}</p>
            <p className="text-[30px] font-bold leading-tight tracking-tight text-[#1B2B4B] font-heading">
              {value}
            </p>
            {trend && (
              <p
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  trendUp ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'
                }`}
              >
                {trend}
              </p>
            )}
          </div>
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#E0F7FC]">
            <Icon className="h-5 w-5 text-[#0EA5C8]" strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
