import * as React from "react"
import { cn } from "../../lib/utils"

const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { onCheckedChange?: (checked: boolean) => void }
>(({ className, onCheckedChange, checked, ...props }, ref) => (
  <label className={cn("relative inline-flex items-center cursor-pointer", className)}>
    <input
      type="checkbox"
      ref={ref}
      className="sr-only peer"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
    <div className={cn(
      "w-11 h-6 bg-secondary rounded-full",
      "peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-focus:ring-offset-background",
      "peer-checked:after:translate-x-full peer-checked:after:border-white",
      "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
      "peer-checked:bg-primary",
      "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
    )}></div>
  </label>
));
Switch.displayName = "Switch"

export { Switch }