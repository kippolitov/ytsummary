import type { ReactNode } from "react";

interface CodeBlockProps {
  className?: string;
  children?: ReactNode;
}

export function CodeBlock({ className, children }: CodeBlockProps) {
  return (
    <pre aria-label="Code block" className={className}>
      <code className={className}>{children}</code>
    </pre>
  );
}
