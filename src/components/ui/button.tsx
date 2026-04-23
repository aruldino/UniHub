import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-3xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#0EA5C8] text-white shadow-uni-btn hover:bg-[#0B8BA8] hover:shadow-uni-btn-hover",
        destructive:
          "bg-[#FEF2F2] text-[#EF4444] border border-[#FCA5A5] hover:bg-[#FEE2E2]",
        outline: "border-[1.5px] border-[#0EA5C8] bg-transparent text-[#0EA5C8] hover:bg-[#E0F7FC]/80",
        secondary:
          "bg-[#E0F7FC] text-[#0EA5C8] border border-[#0EA5C8]/25 shadow-sm hover:bg-[#d4f0f7]",
        ghost: "rounded-xl text-[#374151] hover:bg-[#F0FAFA] hover:text-[#0B8BA8]",
        link: "text-[#0EA5C8] underline-offset-4 hover:underline rounded-none shadow-none active:scale-100",
      },
      size: {
        default: "h-10 px-6 py-2.5",
        sm: "h-9 rounded-2xl px-4 text-xs",
        lg: "h-12 rounded-3xl px-8 text-base",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
