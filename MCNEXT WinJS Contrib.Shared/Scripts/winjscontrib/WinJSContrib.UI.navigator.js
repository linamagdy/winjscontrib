﻿/// <reference path="WinJSContrib.core.js" />

//you may use this code freely as long as you keep the copyright notice and don't 
// alter the file name and the namespaces
//This code is provided as is and we could not be responsible for what you are making with it
//project is available at http://winjscontrib.codeplex.com



(function () {
    "use strict";

    var appView = null;
    if (window.Windows && window.Windows.UI && window.Windows.UI.ViewManagement && window.Windows.UI.ViewManagement.ApplicationView)
        appView = window.Windows.UI.ViewManagement.ApplicationView;

    var nav = WinJS.Navigation;

    var defaultExitPageAnimation = function (elt) {
        return WinJSContrib.UI.Animation.pageExit(elt)
    }

    var defaultEnterPageAnimation = function (elt) {
        return WinJS.UI.Animation.enterPage(elt);
    }

    WinJS.Namespace.define("WinJSContrib.UI", {
        parentNavigator: function (element) {
            var current = element.parentNode;

            while (current) {
                if (current.mcnNavigator) {
                    return current.winControl;
                }
                current = current.parentNode;
            }
        },

        PageControlNavigator: WinJS.Class.mix(WinJS.Class.define(
            // Define the constructor function for the PageControlNavigator.
            function PageControlNavigator(element, options) {
                var options = options || {};
                this._element = element || document.createElement("div");
                this._element.winControl = this;
                this._element.mcnNavigator = true;
                this._element.classList.add('mcn-navigator');
                this.eventTracker = new WinJSContrib.UI.EventTracker();
                this.delay = options.delay || 0;
                this.animationWaitForPreviousPageClose = options.animationWaitForPreviousPageClose || true;
                this.animations = {};
                this.locks = 0;

                if (options.enterPageAnimation) {
                    this.animations.enterPage = WinJSContrib.Utils.resolveMethod(element, options.enterPageAnimation);
                }
                if (!this.animations.enterPage)
                    this.animations.enterPage = defaultEnterPageAnimation;

                if (options.exitPageAnimation) {
                    this.animations.exitPage = WinJSContrib.Utils.resolveMethod(element, options.exitPageAnimation);
                }
                if (!this.animations.exitPage)
                    this.animations.exitPage = defaultExitPageAnimation;

                this.home = options.home;
                if (appView)
                    this._lastViewstate = appView.value;

                this.global = options.global !== undefined ? options.global : true;
                if (this.global) { //navigation classique 
                    document.body.onkeyup = this._keyupHandler.bind(this);
                    document.body.onkeypress = this._keypressHandler.bind(this);
                    document.body.onmspointerup = this._mspointerupHandler.bind(this);

                    WinJSContrib.UI.Application = WinJSContrib.UI.Application || {};
                    WinJSContrib.UI.Application.navigator = this;

                    this.eventTracker.addEvent(nav, 'beforenavigate', this._beforeNavigate.bind(this));
                    this.eventTracker.addEvent(nav, 'navigated', this._navigated.bind(this));
                }
                else {
                    this.history = { backstack: [] };
                }
                this.eventTracker.addEvent(window, 'resize', this._resized.bind(this));
            }, {
                home: "",
                /// <field domElement="true" />
                _element: null,
                _lastNavigationPromise: WinJS.Promise.as(),
                _lastViewstate: 0,

                // This is the currently loaded Page object.
                pageControl: {
                    get: function () {
                        return this.pageElement ? this.pageElement.winControl : null;
                    }
                },

                // This is the root element of the current page.
                pageElement: {
                    get: function () {
                        return this._pageElement || this._element.lastElementChild;
                    }
                },

                addLock: function () {
                    this.locks++;
                },

                removeLock: function () {
                    this.locks--;
                },

                // Creates a container for a new page to be loaded into.
                _createPageElement: function () {
                    var element = document.createElement("div");
                    element.setAttribute("dir", window.getComputedStyle(this._element, null).direction);
                    //element.style.width = "100%";
                    //element.style.height = "100%";
                    //element.style.position = 'relative';
                    return element;
                },

                // This function disposes the page navigator and its contents.
                dispose: function () {
                    if (this._disposed) {
                        return;
                    }

                    this._disposed = true;
                    if (WinJS.Utilities.disposeSubTree)
                        WinJS.Utilities.disposeSubTree(this._element);

                    this.eventTracker.dispose();
                },

                // Retrieves a list of animation elements for the current page.
                // If the page does not define a list, animate the entire page.
                _getAnimationElements: function (isExit) {
                    if (this.pageControl && this.pageControl.getAnimationElements) {
                        return this.pageControl.getAnimationElements(isExit);
                    }
                    return this.pageElement;
                },

                // Navigates back whenever the backspace key is pressed and
                // not captured by an input field.
                _keypressHandler: function (args) {
                    if (args.key === "Backspace") {
                        nav.back();
                    }
                },

                // Navigates back or forward when alt + left or alt + right
                // key combinations are pressed.
                _keyupHandler: function (args) {
                    if ((args.key === "Left" && args.altKey) || (args.key === "BrowserBack")) {
                        nav.back();
                    } else if ((args.key === "Right" && args.altKey) || (args.key === "BrowserForward")) {
                        nav.forward();
                    }
                },

                // This function responds to clicks to enable navigation using
                // back and forward mouse buttons.
                _mspointerupHandler: function (args) {
                    if (args.button === 3) {
                        nav.back();
                    } else if (args.button === 4) {
                        nav.forward();
                    }
                },

                navigate: function (location, initialState, skipHistory, isback) {
                    var nav = this;
                    if (this.global) {
                        return WinJS.Navigation.navigate(location, initialState);
                    } else {
                        var arg = {
                            skipHistory: skipHistory,
                            detail: {
                                location: location,
                                state: initialState,
                                setPromise: function (promise) {
                                    this.pagePromise = promise;
                                }
                            }
                        };
                        nav._beforeNavigate(arg);
                        arg.detail.pagePromise = arg.detail.pagePromise || WinJS.Promise.wrap();
                        return arg.detail.pagePromise.then(function () {
                            if (isback) {
                                nav.history.backstack.splice(nav.history.backstack.length - 1, 1);
                            }
                            nav._navigated(arg);
                            return arg.detail.pagePromise;
                        });
                    }
                },

                clearHistory: function () {
                    if (this.global) {
                        WinJS.Navigation.history.backStack = [];
                    } else {
                        this.history.backstack = [];
                    }
                },

                clear: function () {
                    this.clearHistory();
                    this._pageElement = null;
                    this._element.innerHTML = '';
                },

                //warning, deprecated...
                open: function (uri, options) {
                    return this.navigate(uri, options);
                },

                pick: function (uri, options) {
                    options = options || {};
                    options.navigateStacked = true;
                    return this.navigate(uri, options);
                },

                canGoBack: {
                    get: function () {
                        if (this.global)
                            return nav.canGoBack;
                        else
                            return this.history.backstack.length > 0;
                    }
                },

                back: function (distance) {
                    var navigator = this;
                    if (navigator.global) {
                        return WinJS.Navigation.back(distance);
                    }
                    else {
                        if (navigator.history.backstack.length) {
                            var pageindex = navigator.history.backstack.length - 1;
                            var previousPage = navigator.history.backstack[pageindex];

                            return navigator.navigate(previousPage.location, previousPage.state, true, true);
                        }
                    }
                },

                _beforeNavigate: function (args) {
                    var navigator = this;
                    var page = this.pageElement;
                    args.detail.state = args.detail.state || {};
                    var openStacked = navigator.stackNavigation == true || args.detail.state.navigateStacked;

                    if (this.locks > 0) {
                        var p = new WinJS.Promise(function (c) { });
                        args.detail.setPromise(p);
                        p.cancel();
                        return;
                    }
                    else if (page && page.winControl && page.winControl.canClose) {
                        var completeCallback = null;
                        var p = new WinJS.Promise(function (c) {
                            completeCallback = c;
                        });
                        setImmediate(function () {
                            WinJS.Promise.wrap(page.winControl.canClose()).then(function (res) {
                                if (!res) {
                                    p.cancel();
                                }
                                else {
                                    navigator.triggerPageExit();
                                    completeCallback();
                                }
                            });
                        });
                        args.detail.setPromise(p);

                        return;
                    }

                    if (openStacked && !args.detail.state.mcnNavigationDetails)
                        return;

                    navigator.triggerPageExit();
                },

                triggerPageExit: function () {
                    var navigator = this;
                    var page = this.pageElement;

                    if (page && page.winControl && !page.winControl.exitPagePromise) {
                        if (page.winControl.exitPageAnimation) {
                            page.winControl.exitPagePromise = WinJS.Promise.as(page.winControl.exitPageAnimation);
                        } else {
                            page.winControl.exitPagePromise = WinJS.Promise.as(navigator.animations.exitPage(navigator._getAnimationElements(true)));
                        }

                        page.winControl.exitPagePromise = page.winControl.exitPagePromise.then(function () {
                            page.style.display = 'none';
                        });

                        if (page.winControl.exitPage) {
                            var exitPageResult = page.winControl.exitPage();
                            if (exitPageResult) {
                                var res = WinJS.Promise.as(exitPageResult);
                                var exitAnim = page.winControl.exitPagePromise;
                                page.winControl.exitPagePromise = res.then(function () {
                                    return exitAnim;
                                })
                            }
                        }

                        var layoutCtrls = page.querySelectorAll('.mcn-layout-ctrl');
                        if (layoutCtrls && layoutCtrls.length) {
                            for (var i = 0 ; i < layoutCtrls.length; i++) {
                                var ctrl = layoutCtrls[i].winControl;
                                if (ctrl.exitPage)
                                    ctrl.exitPage();
                            }
                        }

                        if (WinJSContrib.UI.Application.progress)
                            WinJSContrib.UI.Application.progress.show();
                    }
                },

                closePage: function (pageElementToClose, args) {
                    var navigator = this;
                    args = args || {};
                    var pagecontainer = navigator._element;
                    var oldElement = pageElementToClose || this.pageElement;
                    if (oldElement)
                        $('.tap', oldElement).untap();

                    var oldPageExitPromise = (oldElement && oldElement.winControl && oldElement.winControl.exitPagePromise) ? oldElement.winControl.exitPagePromise : WinJS.Promise.wrap()
                    navigator.dispatchEvent('closingPage', { page: oldElement });

                    if (oldElement && oldElement.winControl) {
                        oldElement.winControl.dispatchEvent('closing', { youpla: 'boom' });

                        if (oldElement.winControl.cancelPromises) {
                            oldElement.winControl.cancelPromises();
                        }
                    }

                    if (!navigator.global && oldElement && oldElement.winControl && oldElement.winControl.navigationState && !args.skipHistory) {
                        navigator.history.backstack.push(oldElement.winControl.navigationState);
                    }

                    navigator._pageElement = null;
                    return oldPageExitPromise.then(function () {
                        return WinJS.Promise.timeout();
                    }).then(function () {
                        if (oldElement) {
                            oldElement.style.opacity = '0';
                            oldElement.style.display = 'none';
                            if (WinJS.Utilities.disposeSubTree)
                                WinJS.Utilities.disposeSubTree(oldElement);

                            if (oldElement.winControl) {
                                oldElement.winControl.stackedOn = null;
                                oldElement.winControl.stackedBy = null;
                                if (oldElement.winControl.eventTracker) {
                                    oldElement.winControl.eventTracker.dispose();
                                }

                                if (oldElement.winControl.unload) {
                                    oldElement.winControl.unload();
                                }
                            }

                            oldElement.innerHTML = '';
                            setImmediate(function () {
                                try {
                                    $(oldElement).remove();
                                }
                                catch (exception) {
                                    console.log('cannot remove page, WTF ????????')
                                }
                            });
                        }
                    });
                },

                // Responds to navigation by adding new pages to the DOM.
                _navigated: function (args) {
                    var navigator = this;
                    args.detail.state = args.detail.state || {};
                    var pagecontainer = navigator._element;
                    var oldPage = this.pageControl;
                    var oldElement = this.pageElement;
                    var openStacked = navigator.stackNavigation == true || (args.detail.state && args.detail.state.navigateStacked);

                    if (this._lastNavigationPromise) {
                        this._lastNavigationPromise.cancel();

                        if (WinJSContrib.UI.Application.progress)
                            WinJSContrib.UI.Application.progress.hide();
                    }

                    if (oldPage && oldPage.stackedOn && args.detail.state.mcnNavigationDetails) {//back en nav stacked
                        var closeOldPagePromise = navigator.closePage(oldElement, args);
                        this._lastNavigationPromise = closeOldPagePromise;
                        args.detail.setPromise(closeOldPagePromise);
                        if (WinJSContrib.UI.Application.progress)
                            WinJSContrib.UI.Application.progress.hide();
                        return;
                    }
                    else if (openStacked) {
                        if (!navigator.global && oldElement && oldElement.winControl && oldElement.winControl.navigationState && !args.skipHistory) {
                            navigator.history.backstack.push(oldElement.winControl.navigationState);
                        }
                        var closeOldPagePromise = WinJS.Promise.wrap();
                    }
                    else {
                        var closeOldPagePromise = navigator.closePage(oldElement, args);
                    }

                    args.detail.state.mcnNavigationDetails = {
                        id: WinJSContrib.Utils.guid(),
                        date: new Date()
                    };

                    var newElement = this._createPageElement();
                    newElement.mcnPage = true;
                    var newElementCtrl = undefined;
                    var parentedComplete;
                    var parented = new WinJS.Promise(function (c) { parentedComplete = c; });
                    newElement.style.opacity = '0';
                    var layoutCtrls = [];


                    if (navigator.animationWaitForPreviousPageClose) {
                        var tempo = closeOldPagePromise.then(function () {
                            return WinJS.Promise.timeout(navigator.delay);
                        });
                    } else {
                        var tempo = WinJS.Promise.timeout(navigator.delay);
                    }

                    navigator.currentPageDetails = args.detail;

                    var openNewPagePromise = WinJS.UI.Pages.render(args.detail.location, newElement, args.detail.state, parented).then(function () {
                        navigator._pageElement = newElement;
                        if (newElement.winControl) {
                            newElementCtrl = newElement.winControl;
                            newElementCtrl.navigator = navigator;
                            newElementCtrl.eventTracker = new WinJSContrib.UI.EventTracker();
                            newElementCtrl.navigationState = args.detail;
                            navigator._buildPage(newElementCtrl);
                            args.detail.page = newElementCtrl;

                            if (args.detail.state && args.detail.state.injectToPage) {
                                navigator._injectInto(newElementCtrl, args.detail.state.injectToPage);
                            }

                            if (openStacked) {
                                newElementCtrl.stackedOn = oldPage;
                                if (oldPage) {
                                    oldPage.stackedBy = newElementCtrl;
                                }
                            }

                            if (newElementCtrl.prepareData) {
                                newElementCtrl.dataPromise = WinJS.Promise.as(newElementCtrl.prepareData(newElement, args.detail.state));
                                newElementCtrl.promises.push(newElementCtrl.dataPromise);
                            }
                        }

                        //délai pour que la transition de sortie se déclenche
                        return WinJS.Promise.timeout(10);
                    }).then(function () {
                        return WinJS.Resources.processAll(newElement);
                    }).then(function () {
                        return newElementCtrl.dataPromise;
                    }).then(function (data) {
                        newElementCtrl.pagedata = data;
                        WinJSContrib.bindMembers(newElementCtrl.element, newElementCtrl);
                        layoutCtrls = navigator._getPageLayoutControls(newElement);
                        return navigator._pagePrepare(newElementCtrl, layoutCtrls, args);
                    }).then(function () {
                        //on raffraichit la liste des controles enfant au cas où le prepare en aurait ajouté
                        layoutCtrls = navigator._getPageLayoutControls(newElement);
                    }).then(function () {
                        pagecontainer.appendChild(newElement);
                        if (args.detail.state && args.detail.state.clearNavigationHistory) {
                            if (navigator.global) {
                                WinJS.Navigation.history.backStack = [];
                            } else {
                                navigator.history.backstack = [];
                            }
                        }
                        navigator._updateBackButton(args);
                        return WinJS.Promise.timeout();
                    }).then(function (control) {
                        layoutCtrls = navigator._getPageLayoutControls(newElement);
                        return navigator._pageLayout(newElementCtrl, layoutCtrls, args);
                    }).then(function () {
                        if (WinJSContrib.UI.Application.progress)
                            WinJSContrib.UI.Application.progress.hide();
                        return navigator._registerPageActions(newElementCtrl);
                    }).then(function () {
                        return tempo;
                    }).then(function () {
                        parentedComplete();
                    }).then(function () {
                        layoutCtrls = navigator._getPageLayoutControls(newElement);
                        return navigator._pageContentReady(newElementCtrl, layoutCtrls, args);
                    }).then(function () {
                        return navigator._pageReady(newElementCtrl, layoutCtrls, args);
                    }).then(function () {
                        navigator._lastNavigationPromise = undefined;
                    });

                    this._lastNavigationPromise = openNewPagePromise;


                    args.detail.setPromise(WinJS.Promise.join([closeOldPagePromise, openNewPagePromise]));
                },

                _buildPage: function (newElementCtrl) {
                    if (!newElementCtrl.eventTracker) {
                        newElementCtrl.eventTracker = new WinJSContrib.UI.EventTracker();
                    }

                    if (!newElementCtrl.promises) {
                        newElementCtrl.promises = [];
                    }

                    if (!newElementCtrl.addPromise) {
                        newElementCtrl.addPromise = function (prom) {
                            this.promises.push(prom);
                        }
                    }

                    if (!newElementCtrl.cancelPromises) {
                        newElementCtrl.cancelPromises = function () {
                            var page = this;
                            if (page.promises) {
                                for (var i = 0; i < page.promises.length; i++) {
                                    if (page.promises[i]) {
                                        page.promises[i].cancel();
                                    }
                                }
                            }
                        };
                    }
                },

                _getPageLayoutControls: function (newElement) {
                    var layoutCtrls = [];
                    var pagelayoutCtrls = newElement.querySelectorAll('.mcn-layout-ctrl');
                    if (pagelayoutCtrls && pagelayoutCtrls.length) {
                        for (var i = 0 ; i < pagelayoutCtrls.length; i++) {
                            var ctrl = pagelayoutCtrls[i].winControl;
                            if (ctrl) {
                                layoutCtrls.push(ctrl);
                            }
                        }
                    }

                    return layoutCtrls;
                },

                _injectInto: function (page, items) {
                    if (items) {
                        for (var k in items) {
                            page[k] = items[k];
                        }
                    }
                },

                _pagePrepare: function (newElementCtrl, layoutCtrls, navargs) {
                    var promises = [];

                    if (layoutCtrls && layoutCtrls.length) {
                        for (var i = 0 ; i < layoutCtrls.length; i++) {
                            var ctrl = layoutCtrls[i];
                            if (ctrl.prepare) {
                                promises.push(WinJS.Promise.as(ctrl.prepare(newElementCtrl.element, navargs.detail.state)));
                            }
                        }
                    }

                    if (newElementCtrl && newElementCtrl.prepare) {
                        promises.push(WinJS.Promise.as(newElementCtrl.prepare(newElementCtrl.element, navargs.detail.state)));
                    }

                    var result = WinJS.Promise.join(promises);
                    newElementCtrl.addPromise(result);

                    return result;
                },

                _pageLayout: function (newElementCtrl, layoutCtrls, navargs) {
                    var result = WinJS.Promise.wrap();
                    var promises = [];

                    if (layoutCtrls && layoutCtrls.length) {
                        for (var i = 0 ; i < layoutCtrls.length; i++) {
                            var ctrl = layoutCtrls[i];
                            if (ctrl.pageLayout) {
                                promises.push(WinJS.Promise.as(ctrl.pageLayout(newElementCtrl.element, navargs.detail.state)));
                            }
                        }
                        result = WinJS.Promise.join(promises);
                    }

                    if (newElementCtrl && newElementCtrl.layoutPage) {
                        var pageLayoutPromise = WinJS.Promise.as(newElementCtrl.layoutPage(newElementCtrl.element, navargs.detail.state));
                        if (!promises.length) {
                            result = pageLayoutPromise;
                        }
                        else {
                            result = result.then(function () {
                                return pageLayoutPromise;
                            });
                        }
                    }
                    newElementCtrl.addPromise(result);

                    return result;
                },

                _pageContentReady: function (newElementCtrl, layoutCtrls, navargs) {
                    if (newElementCtrl && newElementCtrl.contentReady) {
                        newElementCtrl.contentReady(newElementCtrl.element, navargs.detail.state);
                    }

                    if (layoutCtrls && layoutCtrls.length) {
                        for (var i = 0 ; i < layoutCtrls.length; i++) {
                            var ctrl = layoutCtrls[i];
                            if (ctrl.contentReady) {
                                ctrl.contentReady(newElementCtrl.element, navargs.detail.state);
                            }
                        }
                    }

                    if (newElementCtrl.enterPageAnimation) {
                        return WinJS.Promise.as(newElementCtrl.enterPageAnimation());
                    }

                    newElementCtrl.element.style.opacity = '';
                    var elts = this._getAnimationElements();

                    this.dispatchEvent("pageContentReady", navargs.detail);
                    if (elts)
                        return this.animations.enterPage(elts);
                },

                _pageReady: function (newElementCtrl, layoutCtrls, navargs) {
                    if (newElementCtrl && newElementCtrl.pageReady) {
                        newElementCtrl.pageReady(newElementCtrl.element, navargs.detail.state);
                    }

                    if (layoutCtrls && layoutCtrls.length) {
                        for (var i = 0 ; i < layoutCtrls.length; i++) {
                            var ctrl = layoutCtrls[i];
                            if (ctrl.pageReady) {
                                ctrl.pageReady(newElementCtrl.element, navargs.detail.state);
                            }
                        }
                    }
                    this.dispatchEvent("pageReady", navargs.detail);
                    //return WinJS.Promise.timeout(); //setImmediate
                },

                _registerPageActions: function (newElementCtrl) {
                    WinJSContrib.UI.bindActions(newElementCtrl.element, newElementCtrl);
                },

                // Responds to resize events and call the updateLayout function
                // on the currently loaded page.
                _resized: function (args) {
                    if (this.pageControl && this.pageControl.element) {
                        var navigator = this;
                        navigator.pageControl.element.opacity = '0';
                        setImmediate(function () {
                            var vw = appView ? appView.value : null;
                            if (navigator.pageControl.updateLayout) {
                                navigator.pageControl.updateLayout.call(navigator.pageControl, navigator.pageElement, vw, navigator._lastViewstate);
                            }
                            var layoutCtrls = navigator.pageControl.element.querySelectorAll('.mcn-layout-ctrl');
                            if (layoutCtrls && layoutCtrls.length) {
                                for (var i = 0 ; i < layoutCtrls.length; i++) {
                                    var ctrl = layoutCtrls[i].winControl;
                                    if (ctrl.updateLayout)
                                        ctrl.updateLayout(ctrl.element, vw, navigator._lastViewstate);
                                }
                            }
                            WinJS.UI.Animation.fadeIn(navigator.pageControl.element);
                        });
                    }
                    this._lastViewstate = appView ? appView.value : null;
                },

                _handleBack: function () {
                    nav.back();
                },

                // Updates the back button state. Called after navigation has
                // completed.
                _updateBackButton: function (args) {
                    var ctrl = this;
                    var backButton = $(".win-backbutton", this.pageElement);
                    //var backButton = this.pageElement.querySelector("header[role=banner] .win-backbutton");

                    if (backButton && backButton.length > 0) {
                        backButton.click(function (arg) {
                            if (ctrl.global) {
                                nav.back();
                            }
                            else {
                                var navigator = WinJSContrib.UI.parentNavigator(arg.currentTarget);
                                navigator.back();
                            }
                        });
                        var clearNav = false;
                        //console.log('nav:' + JSON.stringify(args.detail.state))
                        //if (args && args.detail && args.detail.state && args.detail.state.clearNavigationHistory)
                        //    clearNav = args.detail.state.clearNavigationHistory;

                        if (ctrl.canGoBack && !clearNav) {
                            backButton.removeAttr("disabled");
                        } else {
                            backButton.attr("disabled", "disabled");
                        }
                    }
                }
            }
        ), WinJS.Utilities.eventMixin)
    });
})();
