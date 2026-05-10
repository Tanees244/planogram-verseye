import * as React from "react";
import { cn } from "../utils";
import { Label } from "./label";
import { Input } from "./input";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  errors?: string[];
  required?: boolean;
  hint?: string;
}

/**
 * Reusable form field component with built-in error display
 * Automatically highlights fields with errors and displays validation messages
 */
export const FormFieldInput = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, icon, errors = [], required, hint, className, id, ...props }, ref) => {
    const hasError = errors.length > 0;
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-2.5">
        {label && (
          <Label 
            htmlFor={fieldId} 
            className="text-sm font-semibold flex items-center gap-2 text-foreground"
          >
            {icon && <span className="text-primary">{icon}</span>}
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
        )}
        
        <Input
          id={fieldId}
          ref={ref}
          className={cn(
            "h-12 bg-background border-2 transition-all",
            hasError 
              ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/20" 
              : "focus:border-primary focus:ring-2 focus:ring-primary/20",
            className
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${fieldId}-error` : undefined}
          {...props}
        />
        
        {/* Error Messages */}
        {hasError && (
          <div 
            id={`${fieldId}-error`} 
            className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200" 
            role="alert"
          >
            {errors.map((error, index) => (
              <div 
                key={index} 
                className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md border border-red-200 dark:border-red-800"
              >
                <svg 
                  className="w-4 h-4 mt-0.5 flex-shrink-0" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="flex-1">{error}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Optional Hint */}
        {!hasError && hint && (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

FormFieldInput.displayName = "FormFieldInput";

