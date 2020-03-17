ember-rison-qs
==============================================================================

Replace router query param serialize and deserialize mechanics to use [rison-node](https://www.npmjs.com/package/rison-node),

- Url compactness
- Friendly Urls
- Complex state saved in the url without common ember.js deserialize, serialize issues.

This idea comes from watching kibana dashboards query params, they actually use this exact method.
It solves the ugly query strings and huge strings, some servers doesn't even support 2k+ characters, so this might help too if your server knows how to deserialize them.


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
//some-controller.js
export default class SomeControllerController extends Controller {
	queryParams = ['oneQueryParam'];

	@tracked oneQueryParam = 3;

	@tracked partialState = {
		amazing: ['super', 'cool']
	}

	@tracked num = this.oneQueryParam?.some?.hard?.num || 0;

	get someHardState() {
		return {
			some: {
				hard: {
					state: ['super', {
						hard: true,
						state: ['inside', true, 'of this']
					}],
					...this.partialState,
					num: this.num
				}
			}
		}
	}

	@action
	incrementor() {
		this.num++;
	}

	@action
	augmentQuery() {
		this.set('partialState', { prop: 1, other: { complex: 'stuff'}});
	}
}
```

```hbs
<LinkTo @route="some-route" @query={{hash oneQueryParam=this.someHardState}}>
  Some Hard query params
</LinkTo>

<button {{on "click" this.augmentQuery}}>
  Augment!
</button>
```

And expect the url like this `some-route/?qs=(oneQueryParam:(some:(hard:(num:37,other:(complex:stuff),prop:1,state:!(super,(hard:!t,state:!(inside,!t,%27of+this%27)))))))`




License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
