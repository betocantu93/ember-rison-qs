import Controller from "@ember/controller";
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ApplicationController extends Controller {
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
	changeQuery() {
		this.set('partialState', { prop: 1, other: { complex: 'stuff'}});
	}
}

