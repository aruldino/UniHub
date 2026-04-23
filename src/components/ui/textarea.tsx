import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border-[1.5px] border-[#E2F4F8] bg-[#F8FFFE] px-4 py-2.5 text-sm text-[#1B2B4B] ring-offset-background placeholder:text-[#6B7280] focus-visible:border-[#0EA5C8] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0EA5C8]/12 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
