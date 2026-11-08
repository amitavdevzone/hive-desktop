import { Editor, defaultValueCtx, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/kit/prose/view/style/prosemirror.css";

/** Type Markdown, see it rendered in place. `initial` is read once; remount per note. */
function Inner({ initial, onChange }: { initial: string; onChange: (md: string) => void }) {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initial);
        ctx.get(listenerCtx).markdownUpdated((_, md) => onChange(md));
      })
      .use(commonmark)
      .use(history)
      .use(listener),
  );
  return <Milkdown />;
}

export function MarkdownEditor(props: { initial: string; onChange: (md: string) => void }) {
  return (
    <MilkdownProvider>
      <Inner {...props} />
    </MilkdownProvider>
  );
}
