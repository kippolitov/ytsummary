import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { CodeBlock } from "./CodeBlock";
import { CalloutBlock } from "./CalloutBlock";

export const remarkPlugins = [remarkGfm];

export const rehypePlugins = [rehypeHighlight];

export const markdownComponents: Components = {
  code: CodeBlock as Components["code"],
  blockquote: CalloutBlock as Components["blockquote"],
  a: ({ href, children, ...rest }) => (
    // eslint-disable-next-line react/jsx-no-target-blank
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
};
