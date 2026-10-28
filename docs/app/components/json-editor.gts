import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { registerDestructor } from '@ember/destroyable';
import Modifier from 'ember-modifier';
import type { ArgsFor } from 'ember-modifier';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import type Owner from '@ember/owner';

interface Signature {
  Args: {
    /** The state, as JSON */
    value: string;
    onApply: (value: object) => void;
    onReset: () => void;
  };
}

// colors from the page's own tokens, so the editor follows light and dark
const theme = EditorView.theme({
  '&': {
    color: 'var(--fg)',
    backgroundColor: 'var(--code-bg)',
    fontSize: '13px',
    borderRadius: '8px',
  },
  '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: 'var(--accent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--muted)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--wash)' },
  '&.cm-focused': { outline: '2px solid var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--selection) !important',
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--syntax-key)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syntax-literal)' },
  { tag: tags.punctuation, color: 'var(--muted)' },
]);

interface EditorSignature {
  Args: {
    Positional: [value: string];
    Named: { onChange: (doc: string) => void; onSubmit: () => void };
  };
}

// CodeMirror on the element, kept in step with the value unless being edited
class CodeMirror extends Modifier<EditorSignature> {
  view?: EditorView;

  constructor(owner: Owner, args: ArgsFor<EditorSignature>) {
    super(owner, args);
    registerDestructor(this, () => this.view?.destroy());
  }

  modify(
    element: HTMLElement,
    [value]: [string],
    { onChange, onSubmit }: EditorSignature['Args']['Named'],
  ) {
    if (!this.view) {
      this.view = new EditorView({
        doc: value,
        parent: element,
        extensions: [
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onSubmit();

                return true;
              },
            },
          ]),
          basicSetup,
          json(),
          theme,
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'The state, as JSON' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
        ],
      });

      return;
    }

    const doc = this.view.state.doc.toString();

    if (doc !== value && !this.view.hasFocus) {
      this.view.dispatch({
        changes: { from: 0, to: doc.length, insert: value },
      });
    }
  }
}

// The state as JSON: edit it, apply it, and the address follows
export default class JsonEditor extends Component<Signature> {
  @tracked draft: string | null = null;

  get text() {
    return this.draft ?? this.args.value;
  }

  get isEdited() {
    return this.text !== this.args.value;
  }

  get cannotApply() {
    return !this.isEdited || Boolean(this.error);
  }

  get error() {
    try {
      const parsed: unknown = JSON.parse(this.text);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? ''
        : 'The state is an object: { "page": 2, ... }';
    } catch (error) {
      return (error as Error).message;
    }
  }

  @action change(doc: string) {
    this.draft = doc;
  }

  @action apply() {
    if (!this.error) {
      this.args.onApply(JSON.parse(this.text) as object);
      this.draft = null;
    }
  }

  @action revert() {
    this.draft = null;
  }

  <template>
    <div class="editor">
      <div
        class="editor-code"
        {{CodeMirror
          this.text
          onChange=this.change
          onSubmit=this.apply
        }}
      ></div>
      <div class="editor-tools">
        <button
          type="button"
          class="button button-primary"
          disabled={{this.cannotApply}}
          {{on "click" this.apply}}
          data-test-apply
        >Apply to the address</button>
        {{#if this.isEdited}}
          <button
            type="button"
            class="button"
            {{on "click" this.revert}}
          >Revert</button>
        {{/if}}
        <button
          type="button"
          class="button button-quiet"
          {{on "click" @onReset}}
        >Back to the defaults</button>
        <span class="editor-hint">⌘/Ctrl + Enter applies</span>
      </div>
      {{#if this.isEdited}}
        {{#if this.error}}
          <p class="editor-error" role="alert">{{this.error}}</p>
        {{/if}}
      {{/if}}
    </div>
  </template>
}
