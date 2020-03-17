ember-rison-qs
==============================================================================

Replace router query param serialize and deserialize mechanics to use [rison-node](https://www.npmjs.com/package/rison-node),

- Url compactness
- Friendly Urls
- Complex state saved in the url without common ember.js deserialize, serialize issues.

This idea comes from watching kibana dashboards query params, they actually use this exact method.
It solves the ugly query strings and huge strings, some servers doesn't even support 2k+ characters.


Compatibility
------------------------------------------------------------------------------

* Ember.js v3.12 or above
* Ember CLI v2.13 or above
* Node.js v10 or above


Installation
------------------------------------------------------------------------------

```
ember install ember-rison-qs
```


Usage
------------------------------------------------------------------------------


```ts
import RisonQsMixin from 'ember-rison-qs';

export default class ApplicationRoute extends Route.extend(RisonQsMixin) {}

```
*Note:* you should only be including the mixin once, in application route.

And that's it, you can expect two thigs:

Your query params will be deserialized as expected to the corresponding queryParams in your controller and
it also works with `ember-parachute`.


Also, `<LinkTo>` urls will be correctly generated.


```ts
//some-component.js
export default class SomeComponent extends GlimmerComponent {
	query = {
		eureka: 'one big word',
		hola: false,
		pet: 'dog',
		question: 'are you okay',
		arr: [10, 5, 4, 'hello how are you']
		otherObject: {
			weCanStartOverHere: ['hello']
		}
	}
}
```
```hbs
<LinkTo @route="some route" @query={{this.query}}>
  Some Hard query params
</LinkTo>
```
And expect the url like this `one?qs=(query:(eureka:'one+big+word',hola:!f,pet:dog,question:'are+you+okay?',arr:!(10,5,4,'hello+how+are+you'),otherObject:(weCanStartOverHere:!(hello))))`




License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
