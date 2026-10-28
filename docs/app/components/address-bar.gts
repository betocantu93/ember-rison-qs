import Component from '@glimmer/component';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';

import type RouterService from '@ember/routing/router-service';

interface Signature {
  Args: {
    /** The same state, to compare with JSON in a URL */
    state: unknown;
  };
}

interface Token {
  text: string;
  punct: boolean;
}

// rison's own characters, set apart from the values
const RISON_PUNCTUATION = /([(),:!'])/;

const tokensOf = (text: string): Token[] =>
  text
    .split(RISON_PUNCTUATION)
    .filter(Boolean)
    .map((part) => ({ text: part, punct: RISON_PUNCTUATION.test(part) }));

// The address, as the browser's own bar shows it, and as it is sent
export default class AddressBar extends Component<Signature> {
  @service declare router: RouterService;

  @tracked raw = false;
  @tracked copied = false;

  get url() {
    return this.router.currentURL ?? '/';
  }

  get shown() {
    if (this.raw) {
      return this.url;
    }

    try {
      return decodeURIComponent(this.url);
    } catch {
      return this.url;
    }
  }

  get pathTokens() {
    const at = this.shown.indexOf('?');

    return at === -1 ? this.shown : this.shown.slice(0, at);
  }

  get queryTokens() {
    const at = this.shown.indexOf('?');

    return at === -1 ? [] : tokensOf(this.shown.slice(at));
  }

  get origin() {
    return typeof window === 'undefined' ? '' : window.location.host;
  }

  get risonLength() {
    const at = this.url.indexOf('?');

    return at === -1 ? 0 : this.url.length - at;
  }

  get jsonLength() {
    return `?state=${encodeURIComponent(JSON.stringify(this.args.state))}`
      .length;
  }

  @action toggleRaw() {
    this.raw = !this.raw;
  }

  @action async copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.copied = true;
      setTimeout(() => (this.copied = false), 1600);
    } catch {
      // the address is right there to select
    }
  }

  <template>
    <div class="address" data-test-address>
      <div class="address-bar">
        <span class="address-host">{{this.origin}}</span><span
          class="address-path"
        >{{this.pathTokens}}</span><span
          class="address-query"
          data-test-address-query
        >{{#each this.queryTokens as |token|}}<span
              class={{if token.punct "rison-punct"}}
            >{{token.text}}</span>{{/each}}</span>
      </div>
      <div class="address-tools">
        <label class="switch">
          <input
            type="checkbox"
            id="address-raw"
            checked={{this.raw}}
            {{on "change" this.toggleRaw}}
          />
          As sent (percent-encoded)
        </label>
        <span class="address-count" data-test-address-count>
          {{this.risonLength}}
          characters · as JSON in a URL:
          {{this.jsonLength}}
        </span>
        <button type="button" class="button" {{on "click" this.copy}}>
          {{if this.copied "Copied" "Copy link"}}
        </button>
      </div>
    </div>
  </template>
}
