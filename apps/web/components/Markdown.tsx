import { Fragment, type ReactNode } from "react";

/**
 * A very small Markdown renderer for the covenant terms.
 *
 * It handles headings, paragraphs, lists, rules and bold, and nothing else.
 * It builds React elements rather than HTML strings — the terms are our own
 * file, but a legal document is the last place to introduce a
 * `dangerouslySetInnerHTML`, and a reviewer should be able to see that at a
 * glance.
 *
 * HTML comments are stripped, which is how the `<!-- REVIEW: legal -->` marker
 * stays in the source without reaching a reader.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  // Bold is the only inline mark the terms use.
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) => {
    const key = `${keyPrefix}-${index}`;
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return <strong key={key}>{chunk.slice(2, -2)}</strong>;
    }
    return <Fragment key={key}>{chunk}</Fragment>;
  });
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const body = source.replace(/<!--[\s\S]*?-->/g, "");
  const lines = body.split("\n");

  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(<p key={key}>{inline(paragraph.join(" "), key)}</p>);
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key}>
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  function flush() {
    flushParagraph();
    flushList();
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flush();
      continue;
    }

    if (line.startsWith("### ")) {
      flush();
      blocks.push(<h3 key={`h3-${blocks.length}`}>{inline(line.slice(4), `h3-${blocks.length}`)}</h3>);
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push(<h2 key={`h2-${blocks.length}`}>{inline(line.slice(3), `h2-${blocks.length}`)}</h2>);
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      blocks.push(<h1 key={`h1-${blocks.length}`}>{inline(line.slice(2), `h1-${blocks.length}`)}</h1>);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flush();

  return <div className={`prose-plain text-muted ${className}`}>{blocks}</div>;
}
