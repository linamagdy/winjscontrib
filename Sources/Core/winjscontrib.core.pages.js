var WinJSContrib;
(function (WinJSContrib) {
    var UI;
    (function (UI) {
        var Pages;
        (function (Pages) {
            /**
             * List of mixins to apply to each fragment managed by WinJS Contrib (through navigator or by calling explicitely {@link WinJSContrib.UI.Pages.fragmentMixin}).
             * @field WinJSContrib.UI.Pages.defaultFragmentMixins
             * @type {Array}
             */
            Pages.defaultFragmentMixins = [{
                $: function (selector) {
                    if (!this.element)
                        return;
                    return $(selector, this.element || this._element);
                },
                q: function (selector) {
                    if (!this.element)
                        return;
                    return this.element.querySelector(selector);
                },
                qAll: function (selector) {
                    if (!this.element)
                        return;
                    var res = this.element.querySelectorAll(selector);
                    if (res && !res.forEach) {
                        res = [].slice.call(res);
                    }
                    return res;
                },
                eventTracker: {
                    get: function () {
                        if (!this._eventTracker)
                            this._eventTracker = new WinJSContrib.UI.EventTracker();
                        return this._eventTracker;
                    }
                },
                promises: {
                    get: function () {
                        if (!this._promises)
                            this._promises = [];
                        return this._promises;
                    }
                },
                addPromise: function (prom) {
                    this.promises.push(prom);
                    return prom;
                },
                cancelPromises: function () {
                    var page = this;
                    if (page.promises) {
                        for (var i = 0; i < page.promises.length; i++) {
                            if (page.promises[i]) {
                                page.promises[i].cancel();
                            }
                        }
                    }
                }
            }];
            /**
             * substitute for WinJS.UI.Pages.define that injects custom WinJS Contrib behaviors
             * @function WinJSContrib.UI.Pages.define
             */
            function define(location, members) {
                var ctor = WinJS.UI.Pages.define(location, members);
                WinJSContrib.UI.Pages.fragmentMixin(ctor);
                return ctor;
            }
            Pages.define = define;
            /**
             * Inject WinJSContrib fragment enhancements, such as "$","q", "qAll" functions for scoped selectors, eventTracker and promises properties
             * This enhancement also allows you to add behavior on each WinJS fragment by adding them to {@link WinJSContrib.UI.Pages.defaultFragmentMixins}
             * WinJS Contrib navigator is calling this method before processing the page, so you don't need to explicitely wrap all your pages if you use it
             * @function WinJSContrib.UI.Pages.fragmentMixin
             * @param {function} constructor constructor for the fragment
             * @returns {function} constructor for the fragment
             * @example
             * {@lang javascript}
             * WinJSContrib.UI.Pages.fragmentMixin(WinJS.UI.Pages.define("./demos/home.html", {
             *     ready : function(){
             *         //your page ready stuff
             *     }
             * }));
             */
            function fragmentMixin(constructor) {
                var proto = constructor.prototype;
                if (constructor.winJSContrib)
                    return;
                constructor.winJSContrib = true;
                WinJSContrib.UI.Pages.defaultFragmentMixins.forEach(function (mixin) {
                    WinJS.Class.mix(constructor, mixin);
                });
                if (!proto.__wLoad) {
                    //wrap WinJS page events with custom functions
                    proto.__wLoad = proto.load;
                    proto.load = function (uri) {
                        return WinJS.Promise.as(this.__wLoad.apply(this, arguments)).then(function (arg) {
                            if (!proto.__wInit) {
                                //this register should happen after first page load, otherwise page methods will override framework method
                                register(proto);
                            }
                            return arg;
                        });
                    };
                    var register = function (proto) {
                        proto.__wDispose = proto.dispose;
                        proto.__wInit = proto.init;
                        proto.__wProcessed = proto.processed;
                        proto.__wReady = proto.ready;
                        proto.__wUpdateLayout = proto.updateLayout;
                        proto.init = function (element, options) {
                            element.classList.add('mcn-fragment');
                            element.classList.add('mcn-layout-ctrl');
                            if (element.style.display)
                                this._initialDisplay = element.style.display;
                            element.style.display = 'none';
                            return this.__wInit.apply(this, arguments);
                        };
                        proto.processed = function (element, options) {
                            var page = this;
                            var processedargs = arguments;
                            WinJSContrib.UI.bindMembers(element, page);
                            return WinJS.Promise.as(page.__wProcessed.apply(page, processedargs)).then(function () {
                                element.style.display = page._initialDisplay || '';
                                var r = element.getBoundingClientRect(); //force element layout
                                return broadcast(page, element, 'pageLayout', [element, options], null, page.pageLayout);
                            });
                        };
                        proto.ready = function (element, options) {
                            var page = this;
                            WinJSContrib.UI.bindActions(element, this);
                            return WinJS.Promise.as(page.__wReady.apply(page, arguments)).then(function () {
                                if (page.onafterready)
                                    return page.onafterready(element, options);
                            }).then(function () {
                                return broadcast(page, element, 'pageReady', [element, options]);
                            });
                        };
                        proto.dispose = function () {
                            WinJSContrib.UI.untapAll(this.element);
                            if (this.eventTracker) {
                                this.eventTracker.dispose();
                                this._eventTracker = null;
                            }
                            if (this.promises && this.cancelPromises) {
                                this.cancelPromises();
                                this._promises = [];
                            }
                            if (this.__wDispose)
                                this.__wDispose(this);
                        };
                        proto.updateLayout = function () {
                            var page = this;
                            var updateLayoutArgs = arguments;
                            var p = WinJS.Promise.wrap();
                            if (page.__wUpdateLayout) {
                                p = WinJS.Promise.as(page.__wUpdateLayout.apply(page, updateLayoutArgs));
                            }
                            return p.then(function () {
                                return broadcast(page, page.element, 'updateLayout', updateLayoutArgs);
                            });
                        };
                    };
                }
                return constructor;
            }
            Pages.fragmentMixin = fragmentMixin;
            function broadcast(ctrl, element, eventName, args, before, after) {
                var promises = [];
                if (before)
                    promises.push(WinJS.Promise.as(before.apply(ctrl, args)));
                var query = element.querySelectorAll(".mcn-layout-ctrl");
                if (query && query.length) {
                    var index = 0;
                    var length = query.length;
                    while (index < length) {
                        var childctrl = query[index];
                        if (childctrl) {
                            var event = childctrl.winControl[eventName];
                            if (event) {
                                promises.push(WinJS.Promise.as(event.apply(childctrl.winControl, args)));
                            }
                        }
                        // Skip descendants
                        //index += childctrl.querySelectorAll(".mcn-fragment, .mcn-layout-ctrl").length + 1;
                        index += 1;
                    }
                    if (after)
                        promises.push(WinJS.Promise.as(after.apply(ctrl, args)));
                    return WinJS.Promise.join(promises);
                }
                else {
                    return WinJS.Promise.wrap();
                }
            }
            /**
             * render a html fragment with winjs contrib pipeline and properties, and add WinJS Contrib page events.
             * @function WinJSContrib.UI.Pages.renderFragment
             * @param {HTMLElement} container element that will contain the fragment
             * @param {string} location url for the fragment
             * @param {Object} args arguments to the fragment
             * @param {Object} options rendering options
             */
            function renderFragment(container, location, args, options) {
                var fragmentCompleted;
                var fragmentError;
                options = options || {};
                var element = document.createElement("div");
                element.setAttribute("dir", window.getComputedStyle(element, null).direction);
                element.style.opacity = '0';
                container.appendChild(element);
                var fragmentPromise = new WinJS.Promise(function (c, e) {
                    fragmentCompleted = c;
                    fragmentError = e;
                });
                var parented = options.parented ? WinJS.Promise.as(options.parented) : null;
                var layoutCtrls = [];
                var pageConstructor = WinJS.UI.Pages.get(location);
                WinJSContrib.UI.Pages.fragmentMixin(pageConstructor);
                function preparePageControl(elementCtrl) {
                    if (args && args.injectToPage) {
                        WinJSContrib.Utils.inject(elementCtrl, args.injectToPage);
                    }
                    elementCtrl.navigationState = { location: location, state: args };
                    if (options.oncreate) {
                        options.oncreate(elementCtrl.element, args);
                    }
                    if (options.oninit) {
                        elementCtrl.elementReady.then(function () {
                            options.oninit(elementCtrl.element, args);
                        });
                    }
                    if (options.onrender) {
                        elementCtrl.renderComplete.then(function () {
                            options.onrender(elementCtrl.element, args);
                        });
                    }
                    if (options.onready) {
                        elementCtrl.renderComplete.then(function () {
                            return elementCtrl.readyComplete;
                        }).then(function () {
                            options.onready(elementCtrl.element, args);
                        });
                    }
                    if (elementCtrl.enterPageAnimation || options.enterPage) {
                        if (elementCtrl.enterPageAnimation)
                            elementCtrl._enterAnimation = elementCtrl.enterPageAnimation;
                        else
                            elementCtrl._enterAnimation = options.enterPage;
                        elementCtrl.enterPageAnimation = function () {
                            var page = this;
                            var elts = null;
                            element.style.opacity = '';
                            if (page && page.getAnimationElements) {
                                elts = page.getAnimationElements(false);
                            }
                            else {
                                elts = page.element;
                            }
                            //this.dispatchEvent("pageContentReady", navargs);
                            if (elts)
                                return page._enterAnimation(elts);
                        };
                    }
                    if (options.closeOldPagePromise) {
                        elementCtrl._beforelayoutPromise = options.closeOldPagePromise;
                        elementCtrl.onbeforelayout = function () {
                            return this._beforelayoutPromise;
                        };
                    }
                    if (!elementCtrl.beforeShow)
                        elementCtrl.beforeShow = [];
                    elementCtrl.contentReadyComplete = elementCtrl.renderComplete.then(function () {
                        if (!WinJSContrib.UI.disableAutoResources)
                            return WinJS.Resources.processAll(element);
                    }).then(function (control) {
                        return elementCtrl.elementReady;
                    }).then(function (control) {
                        return parented;
                    }).then(function (control) {
                        if (elementCtrl.beforeShow.length) {
                            return WinJSContrib.Promise.parallel(elementCtrl.beforeShow, function (cb) {
                                return WinJS.Promise.as(cb());
                            });
                        }
                    }).then(function () {
                        if (elementCtrl.enterPageAnimation) {
                            return WinJS.Promise.as(elementCtrl.enterPageAnimation(element, options));
                        }
                        else {
                            elementCtrl.element.style.opacity = '';
                        }
                    }).then(fragmentCompleted, fragmentError);
                }
                setImmediate(function () {
                    var elementCtrl = new pageConstructor(element, args, preparePageControl, parented);
                });
                //elementCtrl.parentedComplete = WinJS.Promise.as(parented);
                return fragmentPromise;
            }
            Pages.renderFragment = renderFragment;
        })(Pages = UI.Pages || (UI.Pages = {}));
    })(UI = WinJSContrib.UI || (WinJSContrib.UI = {}));
})(WinJSContrib || (WinJSContrib = {}));
//# sourceMappingURL=winjscontrib.core.pages.js.map