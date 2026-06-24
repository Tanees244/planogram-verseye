"use client";

import React from "react";

interface SpinnerProps {
    className?: string;
}

/**
 * Small inline loading spinner. Uses `border-current` so it inherits the
 * surrounding text color (works on dark buttons, light buttons, etc.).
 */
export function Spinner({ className = "" }: SpinnerProps) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={`inline-block h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
        />
    );
}

export default Spinner;
