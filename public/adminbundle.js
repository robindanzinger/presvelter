(function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function subscribe(store, callback) {
        const unsub = store.subscribe(callback);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function claim_element(nodes, name, attributes, svg) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeName === name) {
                for (let j = 0; j < node.attributes.length; j += 1) {
                    const attribute = node.attributes[j];
                    if (!attributes[attribute.name])
                        node.removeAttribute(attribute.name);
                }
                return nodes.splice(i, 1)[0]; // TODO strip unwanted attributes
            }
        }
        return svg ? svg_element(name) : element(name);
    }
    function claim_text(nodes, data) {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeType === 3) {
                node.data = data;
                return nodes.splice(i, 1)[0];
            }
        }
        return text(data);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value) {
        node.style.setProperty(key, value);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    /* src/pages/PageA.svelte generated by Svelte v3.7.0 */

    function create_fragment(ctx) {
    	var div, h1, t;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			t = text("Page A");
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			h1 = claim_element(div_nodes, "H1", { align: true }, false);
    			var h1_nodes = children(h1);

    			t = claim_text(h1_nodes, "Page A");
    			h1_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(h1, "align", "center");
    			attr(div, "class", "svelte-yvj12y");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(h1, t);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class PageA extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, []);
    	}
    }

    /* src/pages/PageB.svelte generated by Svelte v3.7.0 */

    function create_fragment$1(ctx) {
    	var div, h1, t;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			t = text("Page B");
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			h1 = claim_element(div_nodes, "H1", { align: true }, false);
    			var h1_nodes = children(h1);

    			t = claim_text(h1_nodes, "Page B");
    			h1_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(h1, "align", "center");
    			attr(div, "class", "svelte-13lusf0");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(h1, t);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class PageB extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/pages/PageC.svelte generated by Svelte v3.7.0 */

    function create_fragment$2(ctx) {
    	var div, h1, t;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			t = text("Page C");
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			h1 = claim_element(div_nodes, "H1", { align: true }, false);
    			var h1_nodes = children(h1);

    			t = claim_text(h1_nodes, "Page C");
    			h1_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(h1, "align", "center");
    			attr(div, "class", "svelte-4fa4m1");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(h1, t);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class PageC extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    	}
    }

    /* src/Error.svelte generated by Svelte v3.7.0 */

    function create_fragment$3(ctx) {
    	var div, h1, t;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			t = text("Error");
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			h1 = claim_element(div_nodes, "H1", { align: true }, false);
    			var h1_nodes = children(h1);

    			t = claim_text(h1_nodes, "Error");
    			h1_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(h1, "align", "center");
    			attr(div, "class", "svelte-h5ph1u");
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(h1, t);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    class Error extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, []);
    	}
    }

    const pagemap = [['page_a', 'page_b'], ['page_b', 'page_c', 'page_a'], ['page_c', 'page_a', 'page_c']];
    const pages = {
      page_a: PageA,
      page_b: PageB,
      page_c: PageC,
      error: Error
    };

    const currentSlide = writable({
      topicIndex: 0, slideIndex: 0 });

    function setCurrentSlide (topicIndex, slideIndex) {
      currentSlide.set({ topicIndex, slideIndex });
    }

    function getNumberOfTopics () {
      return pagemap.length
    }

    function getNumberOfSlides (topicIndex) {
      return pagemap[topicIndex] !== undefined ? pagemap[topicIndex].length : -1
    }

    function getPage (topicIndex, slideIndex) {
      return pages[getPageName(topicIndex, slideIndex)] || Error
    }

    function getPageName (topicIndex, slideIndex) {
      return pagemap[topicIndex] && pagemap[topicIndex][slideIndex] ? pagemap[topicIndex][slideIndex] : 'error'
    }

    function getPageMap () {
      return pagemap
    }

    const socket = new WebSocket('ws://localhost:3003/', 'presentation');

    const syncMode = writable(true);

    let sync;

    const unsubscribe = syncMode.subscribe(value => {
      sync = value;
    });

    socket.onmessage = msg => {
      const data = JSON.parse(msg.data);
      if (data.type === 'update') {
        navigateTo(data.topic, data.slide, data.transition, true);
      }
    };

    let connectionEstablished = false;
    socket.onopen = () => {
      connectionEstablished = true;
    };

    function informWebSocketAboutChangedSlide (topic, slide, transition) {
      if (connectionEstablished && sync) { socket.send(JSON.stringify({ type: 'update', topic, slide, transition })); }
    }

    let render;

    function onRender (func) {
      if (render != null) {
        throw new Error('Renderer already set. Should not be set twice')
      }
      render = func;
    }

    function navigateTo (topicIndex, slideIndex, transition, notInform) {
      render(getPage(topicIndex, slideIndex), transition);
      setCurrentSlide(topicIndex, slideIndex);
      window.history.pushState({ topicIndex, slideIndex, transition }, '', `../../${topicIndex}/${slideIndex}/`);
      if (!notInform) {
        informWebSocketAboutChangedSlide(topicIndex, slideIndex, transition);
      }
    }

    window.onpopstate = (s) => {
      const topicIndex = s.state.topicIndex;
      const slideIndex = s.state.slideIndex;
      render(getPage(topicIndex, slideIndex), 'fadein');
      setCurrentSlide(topicIndex, slideIndex);
    };

    /* src/Navigator.svelte generated by Svelte v3.7.0 */

    function create_fragment$4(ctx) {
    	var div, button0, t0, t1, button1, t2, t3, button2, t4, t5, button3, t6, dispose;

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text("<");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("∧");
    			t3 = space();
    			button2 = element("button");
    			t4 = text(">");
    			t5 = space();
    			button3 = element("button");
    			t6 = text("∨");
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			button0 = claim_element(div_nodes, "BUTTON", { disabled: true, id: true }, false);
    			var button0_nodes = children(button0);

    			t0 = claim_text(button0_nodes, "<");
    			button0_nodes.forEach(detach);
    			t1 = claim_text(div_nodes, "\n");

    			button1 = claim_element(div_nodes, "BUTTON", { disabled: true, id: true }, false);
    			var button1_nodes = children(button1);

    			t2 = claim_text(button1_nodes, "∧");
    			button1_nodes.forEach(detach);
    			t3 = claim_text(div_nodes, "\n");

    			button2 = claim_element(div_nodes, "BUTTON", { disabled: true, id: true }, false);
    			var button2_nodes = children(button2);

    			t4 = claim_text(button2_nodes, ">");
    			button2_nodes.forEach(detach);
    			t5 = claim_text(div_nodes, "\n");

    			button3 = claim_element(div_nodes, "BUTTON", { disabled: true, id: true }, false);
    			var button3_nodes = children(button3);

    			t6 = claim_text(button3_nodes, "∨");
    			button3_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			button0.disabled = ctx.leftdisabled;
    			attr(button0, "id", "left");
    			button1.disabled = ctx.updisabled;
    			attr(button1, "id", "up");
    			button2.disabled = ctx.rightdisabled;
    			attr(button2, "id", "right");
    			button3.disabled = ctx.downdisabled;
    			attr(button3, "id", "down");
    			attr(div, "class", "svelte-bjiaz0");

    			dispose = [
    				listen(window, "keydown", handleKeyDown),
    				listen(window, "keyup", ctx.handleKeyUp),
    				listen(button0, "click", ctx.left),
    				listen(button1, "click", ctx.up),
    				listen(button2, "click", ctx.right),
    				listen(button3, "click", ctx.down)
    			];
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(button1, t2);
    			append(div, t3);
    			append(div, button2);
    			append(button2, t4);
    			append(div, t5);
    			append(div, button3);
    			append(button3, t6);
    		},

    		p(changed, ctx) {
    			if (changed.leftdisabled) {
    				button0.disabled = ctx.leftdisabled;
    			}

    			if (changed.updisabled) {
    				button1.disabled = ctx.updisabled;
    			}

    			if (changed.rightdisabled) {
    				button2.disabled = ctx.rightdisabled;
    			}

    			if (changed.downdisabled) {
    				button3.disabled = ctx.downdisabled;
    			}
    		},

    		i: noop,
    		o: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function handleKeyDown (e) {
    }

    function instance($$self, $$props, $$invalidate) {
    	

    let leftdisabled = false;
    let rightdisabled = false;
    let updisabled = false;
    let downdisabled = false;

    let currentTopicIndex = 0;
    let currentSlideIndex = 0;

    currentSlide.subscribe(slide => {
      $$invalidate('currentTopicIndex', currentTopicIndex = slide.topicIndex);
      $$invalidate('currentSlideIndex', currentSlideIndex = slide.slideIndex);
    });

    function handleKeyUp (e) {
      const key = e.key.toLowerCase();
      switch (key) {
        case 'arrowleft':
        case 'h':
          left();
          break
        case 'arrowdown':
        case 'j':
          down();
          break
        case 'arrowup':
        case 'k':
          up();
          break
        case 'arrowright':
        case 'l':
          right();
          break
      }
    }

    function left () {
      if (currentSlideIndex > 0) {
        currentSlideIndex--; $$invalidate('currentSlideIndex', currentSlideIndex);
        updateView('left');
      }
    }

    function right () {
      if (currentSlideIndex < getNumberOfSlides(currentTopicIndex) - 1) {
        currentSlideIndex++; $$invalidate('currentSlideIndex', currentSlideIndex);
        updateView('right');
      }
    }

    function up () {
      if (currentTopicIndex > 0) {
        currentTopicIndex--; $$invalidate('currentTopicIndex', currentTopicIndex);
        $$invalidate('currentSlideIndex', currentSlideIndex = 0);
        updateView('up');
      }
    }

    function down () {
      if (currentTopicIndex < getNumberOfTopics() - 1) {
        currentTopicIndex++; $$invalidate('currentTopicIndex', currentTopicIndex);
        $$invalidate('currentSlideIndex', currentSlideIndex = 0);
        updateView('down');
      }
    }

    function updateView (transition) {
      navigateTo(currentTopicIndex, currentSlideIndex, transition);
    }

    	$$self.$$.update = ($$dirty = { currentSlideIndex: 1, currentTopicIndex: 1 }) => {
    		if ($$dirty.currentSlideIndex || $$dirty.currentTopicIndex) { {
          $$invalidate('leftdisabled', leftdisabled = (currentSlideIndex < 1));
          $$invalidate('rightdisabled', rightdisabled = (currentSlideIndex >= getNumberOfSlides(currentTopicIndex) - 1));
          $$invalidate('updisabled', updisabled = (currentTopicIndex < 1));
          $$invalidate('downdisabled', downdisabled = (currentTopicIndex >= getNumberOfTopics() - 1));
        } }
    	};

    	return {
    		leftdisabled,
    		rightdisabled,
    		updisabled,
    		downdisabled,
    		handleKeyUp,
    		left,
    		right,
    		up,
    		down
    	};
    }

    class Navigator extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment$4, safe_not_equal, []);
    	}
    }

    /* src/Administration.svelte generated by Svelte v3.7.0 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.slide = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.slides = list[i];
    	return child_ctx;
    }

    // (54:3) {#each slides as slide}
    function create_each_block_1(ctx) {
    	var li, t0_value = ctx.slide, t0, t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},

    		l(nodes) {
    			li = claim_element(nodes, "LI", { style: true }, false);
    			var li_nodes = children(li);

    			t0 = claim_text(li_nodes, t0_value);
    			t1 = claim_text(li_nodes, " ");
    			li_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			set_style(li, "display", "inline");
    		},

    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},

    		p: noop,

    		d(detaching) {
    			if (detaching) {
    				detach(li);
    			}
    		}
    	};
    }

    // (51:2) {#each topics as slides}
    function create_each_block(ctx) {
    	var li, ul, t;

    	var each_value_1 = ctx.slides;

    	var each_blocks = [];

    	for (var i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			li = element("li");
    			ul = element("ul");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    		},

    		l(nodes) {
    			li = claim_element(nodes, "LI", {}, false);
    			var li_nodes = children(li);

    			ul = claim_element(li_nodes, "UL", {}, false);
    			var ul_nodes = children(ul);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach);
    			t = claim_text(li_nodes, "\n   ");
    			li_nodes.forEach(detach);
    		},

    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, ul);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(li, t);
    		},

    		p(changed, ctx) {
    			if (changed.topics) {
    				each_value_1 = ctx.slides;

    				for (var i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value_1.length;
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(li);
    			}

    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (69:0) {#if showTimer}
    function create_if_block(ctx) {
    	var button0, t0, t1, button1, t2, t3, button2, t4, t5, div, h2, t6, t7, dispose;

    	return {
    		c() {
    			button0 = element("button");
    			t0 = text("start");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("stop");
    			t3 = space();
    			button2 = element("button");
    			t4 = text("reset");
    			t5 = space();
    			div = element("div");
    			h2 = element("h2");
    			t6 = text(ctx.elapsedTime);
    			t7 = text(" Sekunden");
    			this.h();
    		},

    		l(nodes) {
    			button0 = claim_element(nodes, "BUTTON", {}, false);
    			var button0_nodes = children(button0);

    			t0 = claim_text(button0_nodes, "start");
    			button0_nodes.forEach(detach);
    			t1 = claim_text(nodes, "\n");

    			button1 = claim_element(nodes, "BUTTON", {}, false);
    			var button1_nodes = children(button1);

    			t2 = claim_text(button1_nodes, "stop");
    			button1_nodes.forEach(detach);
    			t3 = claim_text(nodes, "\n");

    			button2 = claim_element(nodes, "BUTTON", {}, false);
    			var button2_nodes = children(button2);

    			t4 = claim_text(button2_nodes, "reset");
    			button2_nodes.forEach(detach);
    			t5 = claim_text(nodes, "\n\n");

    			div = claim_element(nodes, "DIV", { id: true, class: true }, false);
    			var div_nodes = children(div);

    			h2 = claim_element(div_nodes, "H2", { class: true }, false);
    			var h2_nodes = children(h2);

    			t6 = claim_text(h2_nodes, ctx.elapsedTime);
    			t7 = claim_text(h2_nodes, " Sekunden");
    			h2_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(h2, "class", "svelte-75db0v");
    			attr(div, "id", "elapsed");
    			attr(div, "class", "svelte-75db0v");

    			dispose = [
    				listen(button0, "click", ctx.handleStart),
    				listen(button1, "click", ctx.handleStop),
    				listen(button2, "click", ctx.resetTimer)
    			];
    		},

    		m(target, anchor) {
    			insert(target, button0, anchor);
    			append(button0, t0);
    			insert(target, t1, anchor);
    			insert(target, button1, anchor);
    			append(button1, t2);
    			insert(target, t3, anchor);
    			insert(target, button2, anchor);
    			append(button2, t4);
    			insert(target, t5, anchor);
    			insert(target, div, anchor);
    			append(div, h2);
    			append(h2, t6);
    			append(h2, t7);
    		},

    		p(changed, ctx) {
    			if (changed.elapsedTime) {
    				set_data(t6, ctx.elapsedTime);
    			}
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(button0);
    				detach(t1);
    				detach(button1);
    				detach(t3);
    				detach(button2);
    				detach(t5);
    				detach(div);
    			}

    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	var ul, t0, input0, t1, input1, t2, div, t3, t4, current, dispose;

    	var each_value = ctx.topics;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	var switch_value = ctx.slide;

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	var if_block = (ctx.showTimer) && create_if_block(ctx);

    	var navigator = new Navigator({});

    	return {
    		c() {
    			ul = element("ul");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			input0 = element("input");
    			t1 = text("sync\n");
    			input1 = element("input");
    			t2 = text("Show Timer\n\n\n");
    			div = element("div");
    			if (switch_instance) switch_instance.$$.fragment.c();
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			navigator.$$.fragment.c();
    			this.h();
    		},

    		l(nodes) {
    			ul = claim_element(nodes, "UL", {}, false);
    			var ul_nodes = children(ul);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach);
    			t0 = claim_text(nodes, "\n");

    			input0 = claim_element(nodes, "INPUT", { type: true, class: true }, false);
    			var input0_nodes = children(input0);

    			input0_nodes.forEach(detach);
    			t1 = claim_text(nodes, "sync\n");

    			input1 = claim_element(nodes, "INPUT", { type: true, class: true }, false);
    			var input1_nodes = children(input1);

    			input1_nodes.forEach(detach);
    			t2 = claim_text(nodes, "Show Timer\n\n\n");

    			div = claim_element(nodes, "DIV", { class: true }, false);
    			var div_nodes = children(div);

    			if (switch_instance) switch_instance.$$.fragment.l(div_nodes);
    			div_nodes.forEach(detach);
    			t3 = claim_text(nodes, "\n\n");
    			if (if_block) if_block.l(nodes);
    			t4 = claim_text(nodes, "\n\n");
    			navigator.$$.fragment.l(nodes);
    			this.h();
    		},

    		h() {
    			attr(input0, "type", "checkbox");
    			attr(input0, "class", "svelte-75db0v");
    			attr(input1, "type", "checkbox");
    			attr(input1, "class", "svelte-75db0v");
    			attr(div, "class", "preview svelte-75db0v");

    			dispose = [
    				listen(input0, "change", ctx.input0_change_handler),
    				listen(input1, "change", ctx.input1_change_handler)
    			];
    		},

    		m(target, anchor) {
    			insert(target, ul, anchor);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			insert(target, t0, anchor);
    			insert(target, input0, anchor);

    			input0.checked = ctx.$syncMode;

    			insert(target, t1, anchor);
    			insert(target, input1, anchor);

    			input1.checked = ctx.showTimer;

    			insert(target, t2, anchor);
    			insert(target, div, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, div, null);
    			}

    			insert(target, t3, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t4, anchor);
    			mount_component(navigator, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			if (changed.topics) {
    				each_value = ctx.topics;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (changed.$syncMode) input0.checked = ctx.$syncMode;
    			if (changed.showTimer) input1.checked = ctx.showTimer;

    			if (switch_value !== (switch_value = ctx.slide)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;
    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});
    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());

    					switch_instance.$$.fragment.c();
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div, null);
    				} else {
    					switch_instance = null;
    				}
    			}

    			if (ctx.showTimer) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(t4.parentNode, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			transition_in(navigator.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			transition_out(navigator.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(ul);
    			}

    			destroy_each(each_blocks, detaching);

    			if (detaching) {
    				detach(t0);
    				detach(input0);
    				detach(t1);
    				detach(input1);
    				detach(t2);
    				detach(div);
    			}

    			if (switch_instance) destroy_component(switch_instance);

    			if (detaching) {
    				detach(t3);
    			}

    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(t4);
    			}

    			destroy_component(navigator, detaching);

    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $syncMode;

    	component_subscribe($$self, syncMode, $$value => { $syncMode = $$value; $$invalidate('$syncMode', $syncMode); });

    	

      let slide;

      let showTimer = false;
      let startDate = new Date();
      let actualDate = new Date();

      let interval;
      let timerRunning;

      onRender((page, transition) => {
       resetTimer();
       $$invalidate('slide', slide = page);
      });

      function handleStop() {
        if (timerRunning) {
          clearInterval(interval);
          $$invalidate('timerRunning', timerRunning = false);
        }
      }

      function handleStart() {
        if (!timerRunning) {
          resetTimer();
          interval = setInterval(() => {
            $$invalidate('actualDate', actualDate = new Date());
            }, 1000);
          $$invalidate('timerRunning', timerRunning = true);
        }
      }

      function resetTimer() {
        $$invalidate('actualDate', actualDate = new Date());
        $$invalidate('startDate', startDate = new Date());
      }

      const topics = getPageMap();

    	function input0_change_handler() {
    		syncMode.set(this.checked);
    	}

    	function input1_change_handler() {
    		showTimer = this.checked;
    		$$invalidate('showTimer', showTimer);
    	}

    	let elapsedTime;

    	$$self.$$.update = ($$dirty = { actualDate: 1, startDate: 1, timerRunning: 1 }) => {
    		if ($$dirty.actualDate || $$dirty.startDate) { $$invalidate('elapsedTime', elapsedTime = Math.round((actualDate - startDate) / 1000)); }
    		if ($$dirty.timerRunning) ;
    	};

    	return {
    		slide,
    		showTimer,
    		handleStop,
    		handleStart,
    		resetTimer,
    		topics,
    		elapsedTime,
    		$syncMode,
    		input0_change_handler,
    		input1_change_handler
    	};
    }

    class Administration extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$5, safe_not_equal, []);
    	}
    }

    function render$1 () {
      /*eslint-disable*/
      new Administration ( {
        target: document.body
      });
      /* eslint-enable */
      navigateTo(0, 0, 'fadein');
    }
    render$1();

}());
