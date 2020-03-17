import Mixin from '@ember/object/mixin';
import rison from 'rison-node';
import { isEmpty, isPresent } from '@ember/utils';
import { assign } from '@ember/polyfills';

function encodeUriQuery(val, pctEncodeSpaces) {
  return encodeURIComponent(val)
    .replace(/%40/g, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%27/g, '90')
    .replace(/%20/g, pctEncodeSpaces ? '%20' : '+');
}
export default Mixin.create({
  init() {
    this._super(...arguments);
    this._router._routerMicrolib.recognizer.generateQueryString = function(
      params
    ) {
      if (isEmpty(params) || Object.keys(params).length === 0) {
        return '';
      }

      // Loop through the params to check if they were already
      // encoded in the previous `_serializeQueryParam` method
      let newParams = {};
      for (let key in params) {
        let param = params[key];

        if (isPresent(param)) {
          newParams[key] = params[key];
        }
      }
      
      if (Object.keys(newParams).length > 0) {
        return `?qs=${encodeUriQuery(rison.encode(newParams))}`;
      } else {
        return ``;
      }
    };

    this._router._routerMicrolib.recognizer.parseQueryString = function(
      params
    ) {
      if (typeof params === 'string') {
        params = params
          .replace(/^qs=/i, '')
          .replace(/%20/g, ' ')
          .replace(/\+/g, ' ');
      }
      return rison.decode(window.decodeURI(params));
    };

    // This method can be run multiple times for each param.
    // We need to check for booleans and possibly integers in the future (any non-string type)
    // since to check if a query param changed ember compares the internal deserialized value
    // to the serialized value (what?)
    this._router._serializeQueryParam = function(value /*type */) {
      return value;
    };

    this._router._deserializeQueryParam = function(value /*, defaultType*/) {
      if (value === null || value === undefined) {
        return value;
      }
      if (typeof value === 'string') {
        if (value.charAt(0) === '!' || value.charAt(0) === '(') {
          return rison.decode(value);
        }
      }

      return value;
    };
  },

  // Side effects, side effects everywhere
  deserialize(_params /*, transition*/) {
    // When using rison all the query params are encoded after the `?`
    // so it resolves to something like `{ [risonQS]: true }`
    // Check for the rison key and if so, normalize it to a POJO
    let qp = _params.queryParams;
    let parsedQP;

    if (qp) {
      parsedQP = {};

      for (let key in qp) {
        let qs = qp[key];

        if (typeof qs === 'string') {
          if (qs.charAt(0) === '!' || qs.charAt(0) === '(') {
            parsedQP = {
              ...parsedQP,
              ...rison.decode(qs)
            };

            delete qp[key];
          }
        } else {
          parsedQP[key] = qp[key];
        }
      }

      assign(_params.queryParams, parsedQP);
    }
  }
});
