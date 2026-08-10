import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorView, placeholder } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import { languageExtension } from '../diff/languages.js';
import { buildDiffOverride } from '../diff/diffEngine.js';
import { makeSizeTheme, diffHighlighting } from '../diff/cmTheme.js';

function buildMergeConfig(options, collapseUnchanged) {
  return {
    gutter: true,
    highlightChanges: true,
    collapseUnchanged: collapseUnchanged ? { margin: 3, minSize: 4 } : undefined,
    diffConfig: { scanLimit: 500, override: buildDiffOverride(options) || undefined },
  };
}

// The one component in the app that talks to raw @codemirror/state/view
// instead of going through <CodeMirror> (@uiw/react-codemirror only wraps a
// single EditorView — @codemirror/merge's MergeView is its own imperative
// class managing two). Both panes are directly editable: pasting into
// either *is* how leftText/rightText get set, mirrored back to the tab via
// onLeftChange/onRightChange. leftText/rightText are otherwise "controlled"
// the way a plain <input> is — an effect below pushes external changes
// (switching tabs, Swap, Clear) into the live doc, comparing against the
// doc's current text first so it doesn't fight the user's own typing.
export const DiffSideBySideView = forwardRef(function DiffSideBySideView({
  leftText, rightText, onLeftChange, onRightChange,
  language, options, wrap = false, fontSize = 12.5, collapseUnchanged = true,
  onChunksChange,
}, ref) {
  const containerRef = useRef(null);
  const mergeViewRef = useRef(null);
  const compartmentsRef = useRef({ a: null, b: null });
  const callbacksRef = useRef({});
  callbacksRef.current = { onLeftChange, onRightChange, onChunksChange };
  // Read by the rebuild effect below without being one of its deps — a
  // rebuild should start from whatever's on screen *right now*, not force
  // every keystroke to re-run it.
  const textRef = useRef({ leftText, rightText });
  textRef.current = { leftText, rightText };

  useImperativeHandle(ref, () => ({
    goToNext: () => { const mv = mergeViewRef.current; if (mv) goToNextChunk(mv.b); },
    goToPrevious: () => { const mv = mergeViewRef.current; if (mv) goToPreviousChunk(mv.b); },
  }), []);

  // Mount, *and* full rebuild whenever an ignore-option changes. That
  // second case looks wasteful at first, but it's necessary: reading
  // @codemirror/merge's own source, `MergeView.reconfigure({diffConfig})`
  // only stores the new config for *future* incremental updates
  // (`Chunk.updateA`/`updateB`) — it never re-runs `Chunk.build` against the
  // chunks already on screen. So a plain reconfigure would silently leave
  // the previous, differently-normalized diff visible until the next edit.
  // language/wrap/fontSize/collapseUnchanged don't have this problem — those
  // go through real compartment reconfigures below without losing anything.
  useEffect(() => {
    const compA = new Compartment();
    const compB = new Compartment();
    compartmentsRef.current = { a: compA, b: compB };

    const sideExtensions = (side, comp) => [
      basicSetup,
      placeholder(side === 'a' ? 'Paste the original text here…' : 'Paste the modified text here…'),
      comp.of([languageExtension(language), wrap ? EditorView.lineWrapping : [], makeSizeTheme(fontSize)]),
      diffHighlighting,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const text = update.state.doc.toString();
        if (side === 'a') callbacksRef.current.onLeftChange?.(text);
        else callbacksRef.current.onRightChange?.(text);
        callbacksRef.current.onChunksChange?.(mergeViewRef.current?.chunks ?? []);
      }),
    ];

    const mv = new MergeView({
      a: { doc: textRef.current.leftText, extensions: sideExtensions('a', compA) },
      b: { doc: textRef.current.rightText, extensions: sideExtensions('b', compB) },
      parent: containerRef.current,
      ...buildMergeConfig(options, collapseUnchanged),
    });
    mergeViewRef.current = mv;
    callbacksRef.current.onChunksChange?.(mv.chunks);

    return () => {
      mv.destroy();
      mergeViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.ignoreWhitespace, options.ignoreCase, options.ignoreBlankLines, options.ignoreLineEndings]);

  useEffect(() => {
    const mv = mergeViewRef.current;
    if (mv && mv.a.state.doc.toString() !== leftText) {
      mv.a.dispatch({ changes: { from: 0, to: mv.a.state.doc.length, insert: leftText } });
    }
  }, [leftText]);

  useEffect(() => {
    const mv = mergeViewRef.current;
    if (mv && mv.b.state.doc.toString() !== rightText) {
      mv.b.dispatch({ changes: { from: 0, to: mv.b.state.doc.length, insert: rightText } });
    }
  }, [rightText]);

  useEffect(() => {
    const mv = mergeViewRef.current;
    const { a: compA, b: compB } = compartmentsRef.current;
    if (!mv || !compA || !compB) return;
    const ext = [languageExtension(language), wrap ? EditorView.lineWrapping : [], makeSizeTheme(fontSize)];
    mv.a.dispatch({ effects: compA.reconfigure(ext) });
    mv.b.dispatch({ effects: compB.reconfigure(ext) });
  }, [language, wrap, fontSize]);

  // Unlike diffConfig, collapseUnchanged has its own dedicated compartment
  // inside the library (confirmed in its source) — a plain reconfigure with
  // just this one field is enough, no rebuild needed.
  useEffect(() => {
    const mv = mergeViewRef.current;
    if (!mv) return;
    mv.reconfigure({ collapseUnchanged: collapseUnchanged ? { margin: 3, minSize: 4 } : undefined });
  }, [collapseUnchanged]);

  return <div className="diff-side-by-side" ref={containerRef} />;
});
