
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
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

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/PageTransition.svelte generated by Svelte v3.7.0 */

    // (67:0) {#if visibleFirst}
    function create_if_block_1(ctx) {
    	var div, div_intro, div_outro, current, dispose;

    	var switch_value = ctx.first;

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			div = element("div");
    			if (switch_instance) switch_instance.$$.fragment.c();
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true }, false);
    			var div_nodes = children(div);

    			if (switch_instance) switch_instance.$$.fragment.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(div, "id", "first");
    			attr(div, "class", "svelte-4g7ylb");

    			dispose = [
    				listen(div, "introstart", ctx.startTransition),
    				listen(div, "outrostart", ctx.startTransition),
    				listen(div, "introend", ctx.endTransition),
    				listen(div, "outroend", ctx.endTransition)
    			];
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, div, null);
    			}

    			current = true;
    		},

    		p(changed, ctx) {
    			if (switch_value !== (switch_value = ctx.first)) {
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
    		},

    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, ctx.flyIn);
    				div_intro.start();
    			});

    			current = true;
    		},

    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, ctx.flyOut);

    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			if (switch_instance) destroy_component(switch_instance);

    			if (detaching) {
    				if (div_outro) div_outro.end();
    			}

    			run_all(dispose);
    		}
    	};
    }

    // (77:0) {#if !visibleFirst}
    function create_if_block(ctx) {
    	var div, div_intro, div_outro, current, dispose;

    	var switch_value = ctx.second;

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			div = element("div");
    			if (switch_instance) switch_instance.$$.fragment.c();
    			this.h();
    		},

    		l(nodes) {
    			div = claim_element(nodes, "DIV", { id: true, class: true }, false);
    			var div_nodes = children(div);

    			if (switch_instance) switch_instance.$$.fragment.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},

    		h() {
    			attr(div, "id", "second");
    			attr(div, "class", "svelte-4g7ylb");

    			dispose = [
    				listen(div, "introstart", ctx.startTransition),
    				listen(div, "outrostart", ctx.startTransition),
    				listen(div, "introend", ctx.endTransition),
    				listen(div, "outroend", ctx.endTransition)
    			];
    		},

    		m(target, anchor) {
    			insert(target, div, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, div, null);
    			}

    			current = true;
    		},

    		p(changed, ctx) {
    			if (switch_value !== (switch_value = ctx.second)) {
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
    		},

    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, ctx.flyIn);
    				div_intro.start();
    			});

    			current = true;
    		},

    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (div_intro) div_intro.invalidate();

    			div_outro = create_out_transition(div, fly, ctx.flyOut);

    			current = false;
    		},

    		d(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			if (switch_instance) destroy_component(switch_instance);

    			if (detaching) {
    				if (div_outro) div_outro.end();
    			}

    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	var t0, t1, current;

    	var if_block0 = (ctx.visibleFirst) && create_if_block_1(ctx);

    	var if_block1 = (!ctx.visibleFirst) && create_if_block(ctx);

    	var navigator = new Navigator({});

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			navigator.$$.fragment.c();
    		},

    		l(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t0 = claim_text(nodes, "\n\n");
    			if (if_block1) if_block1.l(nodes);
    			t1 = claim_text(nodes, "\n\n");
    			navigator.$$.fragment.l(nodes);
    		},

    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, t1, anchor);
    			mount_component(navigator, target, anchor);
    			current = true;
    		},

    		p(changed, ctx) {
    			if (ctx.visibleFirst) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();
    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});
    				check_outros();
    			}

    			if (!ctx.visibleFirst) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    					transition_in(if_block1, 1);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				group_outros();
    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});
    				check_outros();
    			}
    		},

    		i(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);

    			transition_in(navigator.$$.fragment, local);

    			current = true;
    		},

    		o(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(navigator.$$.fragment, local);
    			current = false;
    		},

    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			if (if_block1) if_block1.d(detaching);

    			if (detaching) {
    				detach(t1);
    			}

    			destroy_component(navigator, detaching);
    		}
    	};
    }

    const duration = 1000;

    function instance$1($$self, $$props, $$invalidate) {
    	
      
      let visibleFirst = true;
      let first;
      let second;
      
      onRender(render);

      function render (page, transition = 'fadein') {
        $$invalidate('runningTransitions', runningTransitions = 0);
        updateTransition(transition);
        if (visibleFirst) {
          $$invalidate('second', second = page);
        } else {
          $$invalidate('first', first = page);
        }
        $$invalidate('visibleFirst', visibleFirst = !visibleFirst);
      }

      function updateTransition (transition) {
        if (transition === 'fadein') {
          $$invalidate('flyIn', flyIn = { x: 0, duration });
          $$invalidate('flyOut', flyOut = { x: 0, duration });
        } else if (transition === 'left') {
          $$invalidate('flyIn', flyIn = { x: -1000, duration });
          $$invalidate('flyOut', flyOut = { x: 1000, duration });
        } else if (transition === 'right') {
          $$invalidate('flyIn', flyIn = { x: 1000, duration });
          $$invalidate('flyOut', flyOut = { x: -1000, duration });
        } else if (transition === 'up') {
          $$invalidate('flyIn', flyIn = { y: -1000, duration });
          $$invalidate('flyOut', flyOut = { y: 1000, duration });
        } else if (transition === 'down') {
          $$invalidate('flyIn', flyIn = { y: 1000, duration });
          $$invalidate('flyOut', flyOut = { y: -1000, duration });
        } else if (transition === 'none') {
          $$invalidate('flyIn', flyIn = { y: 0, duration: 0 });
          $$invalidate('flyOut', flyOut = { y: 0, duration: 0 });
        }
      }
      
      let runningTransitions = 0;
      
      function startTransition () {
        $$invalidate('runningTransitions', runningTransitions += 1);
      }
      
      function endTransition () {
        $$invalidate('runningTransitions', runningTransitions -= 1);
      }
      
      let flyIn = { x: 0, duration };
      let flyOut = { x: 1000, duration };

    	$$self.$$.update = ($$dirty = { runningTransitions: 1 }) => {
    		if ($$dirty.runningTransitions) { {
            if (document.body) {
              document.body.style.overflow = runningTransitions > 0 ? 'hidden' : '';
            }
          } }
    	};

    	return {
    		visibleFirst,
    		first,
    		second,
    		startTransition,
    		endTransition,
    		flyIn,
    		flyOut
    	};
    }

    class PageTransition extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$5, safe_not_equal, []);
    	}
    }

    function render$1 () {
      /*eslint-disable*/
      new PageTransition ( {
        target: document.body
      });
      /* eslint-enable */
      const reg = /^.*\/presentation\/(.*)\/(.*)\//;
      const matches = document.URL.match(reg);

      navigateTo(matches[1], matches[2], 'fadein');
    }
    render$1();

}());
