import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[10px] border-[1.5px] border-[#E2F4F8] bg-[#F8FFFE] px-4 py-2.5 text-sm text-[#1B2B4B] ring-offset-background",
          "placeholder:text-[#6B7280] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:border-[#0EA5C8] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0EA5C8]/12",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
