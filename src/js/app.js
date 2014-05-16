/*jslint browser: true, devel: true, plusplus: true, white: true, indent: 2 */

(function ($) {
  "use strict";

	// Create a single namespace object for the app.
  var app = {};

  /**
   * Used to determine context in which the content is being displayed,
   * i.e.: 'page' or 'teaser'.
   * It's use should be optional.
   * It probably makes sense for the Editor to default to 'page'.
   * In Drupal this could perhaps be derived from View Mode.
   */
  app.context = 'page';

  /**
   * A Service to keep a record of context objects by keys which are added to the Editor DOM.
   * Shared usaged by jsonToDom and domToJSON.
   * Provides an Object as a service.
   *
   * @returns {Object}
   */
  app.contextRecord = (function () {
	  var
	  	h, // hidden closure object
	  	r; // return object

	  h = {
	  	store: {},
		  key_counter: 0,
		  newKey: function () {
		  	h.key_counter += 1;
			  return 'tg' + h.key_counter;
		  }
	  };

	  r = {
		  attribute_name: 'data-tg-context',
		  add: function (data) {
		  	var key;

		  	key = h.newKey();

		  	h.store[key] = data;
			  return key;
		  },
		  get: function (key) {
			  return h.store[key];
		  }
	  };
	  return r;
  } ());


  /**
   * toString
   *
   * Takes a String, Array or Object argument and returns a JSON string of that argument,
   * where for an Array or Object each item (as long as it's one of these 3 types) will
   * be recursively iterated through.
   *
	 * @params {String | Array | Object}
	 * @returns {String}
	 *
	 * todo: investigate native JSON.stringify etc. - reinventing wheels?
	 * todo: would the array part be faster if it used a .join() ?
	 */
	app.toString = function (item) {
		var toString = function (item) {
			var
				i,
				array_length,
				pair,
				pair_array,
				item_key,
				str = '';

			if (typeof item === 'string') {
				// String

				str = '"' + item + '"';

			} else if (item instanceof Array) {
			  // Array

				str = '[';
				array_length = item.length;
				for (i = 0; i < array_length; i += 1) {
					if (i !== 0) {
						str += ',';
					}
					str += toString(item[i]);
				}
				str += ']';

			} else if (typeof item === 'object') {
				// Object (but not an Array Object)

				pair_array = [];
				for (item_key in item) {
				  if (item.hasOwnProperty(item_key)) {
				  	pair = '"' + item_key + '":' + toString(item[item_key]);
				  	pair_array.push(pair);
				  }
				}
				str = '{';
				str += pair_array.join(',');
				str += '}';
			}

			return str;
		};

		return toString(item);
	};

  /**
   * returns a DOCUMENT_FRAGMENT_NODE of nodes from a javascript object
   *
   * observation: this might be slower than concatenating a string and injecting it into innerHTML
   *
   * @param {Array} json
   * @returns {DOCUMENT_FRAGMENT_NODE} containing nodes
   * dependency injection: app.contextRecord
   */
  app.jsonToDom = (function (contextRecord) {
		return function (json) {
			var
		  	convert,
		  	root_el;

	  	convert = function (json_list, dom) {
		  	var
	        i, j, // loop counters
	        t, // text node
	        n, // node
	        item,
	        attributes,
	        context,
	        context_key,
	        context_style_length,
	        class_str,
	        key;

			  for (i = 0; i < json_list.length; i += 1) {
					item = json_list[i];

					if (item.hasOwnProperty('tag')) {
						n = document.createElement(item.tag);

						if (item.hasOwnProperty('string')) {
							t = document.createTextNode(item.string);
							n.appendChild(t);
						}

						if (item.hasOwnProperty('content')) {
							convert(item.content, n);
						}

						if (item.tag === 'img' && item.hasOwnProperty('src')) {
							n.setAttribute('src', item.src);
							attributes = ['src', 'alt', 'width', 'height'];

							for (j = attributes.length - 1; j >= 0; j -= 1) {
								if (item.hasOwnProperty(attributes[j])) {
									n.setAttribute(attributes[j], item[attributes[j]]);
								}
							}
						}

						if (item.hasOwnProperty('context') && (app.hasOwnProperty('context'))) {
							context_key = app.context;

							// Add classes to node.
						  if (item.context.hasOwnProperty(context_key)) {
								context = item.context[context_key];
						    if (context.hasOwnProperty('style')) {

						    	if (typeof context.style === 'string') {
							    	n.className += ' ' + context.style;
						    	} else {
							    	// Assume context.style is an array.
							    	context_style_length = context.style.length;
										for (j = 0; j < context_style_length; j += 1) {
											n.className += ' ' + context.style[j];
										}
						    	}

						    	// Remove a superfluous prefix space.
						    	if (n.className.substr(0, 1) === ' ') {
							    	class_str = n.className;
							    	n.className = class_str.slice(1);
						    	}
						    }
						  }

							key = contextRecord.add(item.context);
							n.setAttribute(contextRecord.attribute_name, key);
						}

						dom.appendChild(n);
					}
				}
		  };
	    root_el = document.createDocumentFragment();

		  convert(json, root_el);

		  return root_el;


		};
	} (app.contextRecord));

	/**
	 * @param {Node} parent_el
	 * @returns {String}
	 * dependency injection: app.contextRecord
	 */
  app.domToJson = (function (contextRecord) {
		return function (parent_el) {
			// Create an object (domToObj) and convert it into a json string
	  	// or just create the string (and avoid any serialization)?
		  var
		  	json = "",
		  	convert;

		  /**
		   * @params: {Array} node_list
		   */
		  convert = function (node_list) {
			  var
			  	str = '',
			  	i,
			  	node_list_length,
			  	node,
			  	tag_name,
			  	context_token,
			  	string;

			  node_list_length = node_list.length;

			  str += '[';

			  for (i = 0; i < node_list_length; i++) {
				  node = node_list[i];
				  str += (i > 0) ? ',\n{' : '\n{';

		  		if (node.nodeType === 1) {
		  			// ELEMENT_NODE

		  		  tag_name = node.nodeName.toLowerCase();
						str += '\n';
						str += '"tag": "' + tag_name + '"';

						if (node.childNodes && node.childNodes.length > 0) {
							if (node.childNodes.length === 1) {
								// Has a single text node as a child

								if (node.childNodes[0].nodeType === 3) {
									// A single TEXT_NODE

									if (node.childNodes[0].nodeValue !== '') {
										str += ',';
										str += '\n';
										str += '"str": "' + node.childNodes[0].nodeValue + '"';
									}
								} else if (node.childNodes[0].nodeType === 1) {
									// A single ELEMENT_NODE

									str += ',';
									str += '"content":';
									str += convert(node.childNodes);
								}

							} else if (node.childNodes.length > 1) {
								// Has two or more child nodes.

								str += ',';
								str += '"content":';
								str += convert(node.childNodes);
							}
						} else {
							// Else no child nodes, could be an <img /> or a <p> without text.

						}

						context_token = node.getAttribute(contextRecord.attribute_name);
						if (context_token) {
							str += ',';
							str += '"context":';
							str += app.toString(contextRecord.get(context_token));
						}

					} else if (node.nodeType === 3 && node.nodeValue !== '') {
						// TEXT_NODE

						string = node.nodeValue;
						str += '"string": "' + string + '"';
					}

					str += '\n';
					str += '}';
			  }

			  str += '\n';
			  str += ']';
			  return str;
		  };

		  json += '{"content":';
		  json += convert(parent_el.childNodes);
		  json += '}';

		  return json;
		};
	} (app.contextRecord));

  /**
	 * @param {Node} parent_el
	 * @returns {Object}
	 */
  app.domToObj = (function (contextRecord) {
		return function (parent_el) {
		  var
		  	r = {},
		  	convert;

		  /**
		   * @params: {Array} node_list
			 */
			convert = function (node_list) {
		  	var
		  		array,
		  		i,
		  		node_list_length,
		  		node,
		  		obj,
		  		context_token;

		  	array = [];
		  	node_list_length = node_list.length;

			  for (i = 0; i < node_list_length; i++) {
				  node = node_list[i];
				  obj = null;

					switch (node.nodeType) {
					 case 1: // ELEMENT_NODE
					 	obj = {};
					 	obj.tag = node.nodeName.toLowerCase();

					 	if (node.childNodes && node.childNodes.length > 0) {
						 	if (node.childNodes.length === 1) {
						 		if (node.childNodes[0].nodeType === 3) { // TEXT_NODE
						 			if (node.childNodes[0].nodeValue !== '') {
							 			obj.str = node.childNodes[0].nodeValue;
							 		}
						 		} else if (node.childNodes[0].nodeType === 1) { // ELEMENT_NODE
							 		obj.content = convert(node.childNodes);
						 		}
							} else if (node.childNodes.length > 1) {
								obj.content = convert(node.childNodes);
							}
						} else {
							// No Child Nodes
							// Could be an <img /> or a <p> without text.

						}

						context_token = node.getAttribute(contextRecord.attribute_name);
						if (context_token) {
							obj.context = contextRecord.get(context_token);
						}

					  break;

					 case 2: // TEXT_NODE
					 	if (node.nodeValue !== '') {
					 		obj = {};
						 	obj.string = node.nodeValue;

					 	}
					  break;
					}

					if (obj) {
						array.push(obj);
					}
				}

			  return array;
		  };

		  r.content = convert(parent_el.childNodes);

		  return r;
		};
	} (app.contextRecord));

	// Hack together some testing.
  $(function () { // readyState
  	var output;

  	$('.tg-editable').
  		each(function () {
  			$(this).
	  			on( "input", function() {
		  			console.log(this);
	  			});
  		});

		output = $('.output')[0];
		output.contentEditable = "true";

		$('.tg-display-context').text(app.context);

		$.getJSON(
			"stub/stub.json",
			{cache: false},
			function(data) {
			  var
			  	content_list,
			  	inject;

			  content_list = data.content;
			  inject = app.jsonToDom(content_list);

			  // Replace the contents of output with a node (or
			  // node tree) created from the content_list json.
			  output.innerHTML = '';
			  output.appendChild(inject);

				// Print out a json string based on the injected html in
				// order to test a round trip of json to dom to json.
			  document.getElementById('dev').innerHTML = app.domToJson($('.output')[0], app.contextRecord);

			  // And similarly test dom to javascript object:
			  console.log(app.domToObj($('.output')[0]));
			}).
		  fail(function() {
		    console.log( "error" );
		  });

  });


}(jQuery));
