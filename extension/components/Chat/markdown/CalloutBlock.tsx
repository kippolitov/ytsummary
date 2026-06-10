import type { ReactNode } from "react";
import React from "react";

interface CalloutBlockProps {
  children?: ReactNode;
}

const CALLOUT_LABELS = new Set([
  "Key Insight",
  "Important",
  "Tip",
  "Warning",
  "Note",
  "Example",
]);

const LABEL_STYLES: Record<string, string> = {
  "Key Insight": "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30",
  "Important":   "border-orange-400 bg-orange-50 dark:border-orange-600 dark:bg-orange-950/30",
  "Tip":         "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-950/30",
  "Warning":     "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-950/30",
  "Note":        "border-gray-400 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/30",
  "Example":     "border-purple-400 bg-purple-50 dark:border-purple-600 dark:bg-purple-950/30",
};

function extractCalloutLabel(children: ReactNode): string | null {
  const childArray = React.Children.toArray(children);
  const firstChild = childArray[0];
  if (!firstChild || !React.isValidElement(firstChild)) return null;

  // The first child should be a <p> element from react-markdown
  const pChildren = React.Children.toArray(
    (firstChild as React.ReactElement<{ children?: ReactNode }>).props.children
  );

  const firstPChild = pChildren[0];
  if (!firstPChild || !React.isValidElement(firstPChild)) return null;

  // Check if it's a <strong> element
  const strongEl = firstPChild as React.ReactElement<{ children?: ReactNode }>;
  if (strongEl.type !== "strong") return null;

  const labelText = React.Children.toArray(strongEl.props.children)
    .map((c) => (typeof c === "string" ? c : ""))
    .join("");

  return CALLOUT_LABELS.has(labelText) ? labelText : null;
}

export function CalloutBlock({ children }: CalloutBlockProps) {
  const label = extractCalloutLabel(children);

  if (!label) {
    return <blockquote>{children}</blockquote>;
  }

  const colorClasses = LABEL_STYLES[label] ?? LABEL_STYLES["Note"]!;

  return (
    <div
      data-callout={label}
      role="note"
      aria-label={`${label} callout`}
      className={`my-3 rounded-r-md border-l-4 px-3 py-2 text-sm ${colorClasses}`}
    >
      {children}
    </div>
  );
}
