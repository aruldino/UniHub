import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[20px] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#E0F7FC] text-[#0B8BA8]",
        secondary: "border-transparent bg-[#DBEAFE] text-[#1E40AF]",
        destructive: "border-transparent bg-[#FEE2E2] text-[#991B1B]",
        outline: "border-[#E2F4F8] text-[#374151]",
        success: "border-transparent bg-[#D1FAE5] text-[#065F46]",
        warning: "border-transparent bg-[#FEF3C7] text-[#92400E]",
        info: "border-transparent bg-[#DBEAFE] text-[#1E40AF]",
        roleAdmin: "border-transparent bg-[#E0F7FC] text-[#0B8BA8]",
        roleLecturer: "border-transparent bg-[#DBEAFE] text-[#1E40AF]",
        roleStudent: "border-transparent bg-[#D1FAE5] text-[#065F46]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
