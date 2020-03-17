import { module, test } from "qunit";
import { visit } from "@ember/test-helpers";
import { setupApplicationTest } from "ember-qunit";

module("Acceptance | rison qs", function(hooks) {
  setupApplicationTest(hooks);

  test("deserialize deep equal object", async function(assert) {
    assert.expect(1);
    await visit(
      `/one?qs=(query:(eureka:'one+big+word',hola:!f,pet:dog,question:'are+you+okay?',arr:!(10,5,4,'hello+how+are+you')))`
    );

    //We assume the Route had implemented the rison-qs mixin and that the controller
    //have the queryParam: ['query']
    let ApplicationController = this.owner.lookup("controller:application");

    let expected = {
      eureka: "one big word",
      hola: false,
      pet: "dog",
      question: "are you okay?",
      arr: [10, 5, 4, "hello how are you"]
    };
    assert.deepEqual(ApplicationController.query, expected, "they are equal");
  });

  test("it constructs <LinkTo /> urls correctly", async function(assert) {
    assert.expect(1);
    let ApplicationController = this.owner.lookup("controller:application");

    ApplicationController.set("query", {
      query: {
        some: {
          really: [
            "super",
            {
              complex: {
                object: "right?"
              }
            }
          ]
        }
      }
    });

    await visit(`/`);

    assert.dom("a").hasAttribute("href", "/one?qs=(query:(some:(really:!(super,(complex:(object:right%3F))))))");
  });
});
