﻿//you may use this code freely as long as you keep the copyright notice and don't 
// alter the file name and the namespaces
//This code is provided as is and we could not be responsible for what you are making with it
//project is available at http://winjscontrib.codeplex.com



(function () {

    WinJS.Namespace.define("WinJSContrib.UI", {
        parentChildView: function (element) {
            var current = element.parentNode;

            while (current) {
                if (current.mcnChildnav) {
                    return current.winControl;
                }
                current = current.parentNode;
            }
        },

        ChildViewFlyout : WinJS.Class.mix(WinJS.Class.define(
        /** 
         * 
         * @class WinJSContrib.UI.ChildViewFlyout 
         * @property {HTMLElement} pageControl
         * @classdesc This control wrap a navigator into a flyout that appears typically as a side panel. 
         * It's intended to provide a secondary navigation mecanism or to enable scenarios like master detail, or content selection
         * @param {HTMLElement} element DOM element containing the control
         * @param {Object} options
         */
           function (element, options) {
               element.winControl = this;
               options = options || {};
               this.element = element || document.createElement("div");
               this.$element = $(element);
               this.element.mcnChildnav = true;
               this.$element.addClass("childNavigator");
               this._createContent();
               this.isOpened = false;
               this.hardwareBackBtnPressedBinded = this.hardwareBackBtnPressed.bind(this);
               this.cancelNavigationBinded = this.cancelNavigation.bind(this);
           },
           /**
            * @lends WinJSContrib.UI.ChildViewFlyout.prototype 
            */
           {
               _createContent: function () {
                   var that = this;
                   
                   this.overlay = document.createElement("div");
                   this.overlay.className = "childNavigator-overlay";
                   this.$overlay = $(this.overlay);
                   this.$overlay.removeClass('visible');
                   this.element.appendChild(this.overlay);
                   this.$overlay.click(function () {
                       that.hide();
                   });

                   this.contentPlaceholder = document.createElement("div");
                   this.contentPlaceholder.className = "childNavigator-contentPlaceholder";
                   var navigatorElt = document.createElement('DIV');
                   this.contentPlaceholder.appendChild(navigatorElt);
                   this.navigator = new WinJSContrib.UI.PageControlNavigator(navigatorElt, { global: false });
                   this.navigator.hide = function (arg) {
                       return that.hide(arg);
                   }
                   this.$contentPlaceholder = $(this.contentPlaceholder);
                   
                   this.element.appendChild(this.contentPlaceholder);
               },

               /**
                * navigate to target uri
                * @param {string} uri target page uri
                * @param {Object} options options for target page
                * @param {boolean} skipHistory indicate if navigation should skip being added to history
                * @returns {WinJS.Promise}
                */
               navigate: function (uri, options, skipHistory) {
                   var that = this;
                   return that.navigator.navigate(uri, options);
               },

               pageControl: {
                   get: function () {
                       return this.container && this.container.winControl;
                   }
               },

               /**
                * clear all child view pages
                */
               clear: function () {
                   var that = this;
                   return new WinJS.Promise(function (complete, error) {
                       WinJS.Promise.wrap(that.closePage()).done(function () {
                           that.navigator.clear();
                           that.navigator._element.innerText = '';
                           that.location = undefined;
                           complete();
                       });
                   });
               },

               /**
                * close current page
                */
               closePage: function (arg, pageElement) {
                   var that = this;
                   if (!that.canClose()) {
                       return WinJS.Promise.wrapError();
                   }

                   if (that.navigator._element.children.length == 1) {
                       that.hide(arg);
                   }

                   that.navigator.triggerPageExit();
                   return that.navigator.closePage(pageElement).then(function () {
                       if (WinJSContrib.UI.Application.progress)
                           WinJSContrib.UI.Application.progress.hide();
                   });
               },

               /**
                * navigate back
                */
               back: function (distance) {
                   var that = this;
                   return that.navigator.back(distance);
               },

               /**
                * indicate if control can navigate back
                */
               canGoBack: function () {
                   return that.navigator.canGoBack;
               },

               _childContentKeyUp: function (args) {
                   if (args.key === "Esc") {
                       this.hide();
                   }
               },

               hardwareBackBtnPressed: function (arg) {
                   var ctrl = this;
                   var idx = WinJSContrib.UI.FlyoutPage.openPages.indexOf(ctrl);
                   if (idx == WinJSContrib.UI.FlyoutPage.openPages.length - 1) {
                       ctrl.hide();
                       arg.handled = true;
                       if (arg.preventDefault)
                           arg.preventDefault();
                   }
               },

               cancelNavigation: function (args) {
                   //this.eventTracker.addEvent(nav, 'beforenavigate', this._beforeNavigate.bind(this));
                   var p = new WinJS.Promise(function (c) { });
                   args.detail.setPromise(p);
                   setImmediate(function () {
                       p.cancel();
                   });
               },

               show: function (skipshowcontainer) {
                   var that = this;                   

                   if (!that.isOpened) {
                       document.body.addEventListener('keyup', that.childContentKeyUp);
                       that.isOpened = true;

                       $(that.element).addClass("visible");
                       that.$overlay.addClass("visible");
                       if (!skipshowcontainer)
                           that.$contentPlaceholder.addClass("visible");

                       WinJS.Navigation.addEventListener('beforenavigate', this.cancelNavigationBinded);
                       if (window.Windows && window.Windows.Phone)
                           Windows.Phone.UI.Input.HardwareButtons.addEventListener("backpressed", this.hardwareBackBtnPressedBinded);
                       else
                           document.addEventListener("backbutton", this.hardwareBackBtnPressedBinded, true);

                       if (WinJSContrib.UI.Application && WinJSContrib.UI.Application.navigator)
                           WinJSContrib.UI.Application.navigator.addLock();
                   }
               },

               pick: function (uri, options, skipHistory) {
                   var ctrl = this;
                   options = options || {};

                   return new WinJS.Promise(function (complete, error) {
                       var completed = false;
                       var page = null;

                       var manageClose = function (arg) {
                           if (page)
                               page.removeEventListener("closing", manageClose);
                           ctrl.removeEventListener("beforehide", manageClose);
                           if (!completed) {
                               completed = true;
                               complete({ completed: false, data: null });
                           }
                       };

                       options.navigateStacked = true;
                       options.injectToPage = {
                           close: function (arg) {
                               completed = true;

                               if (page)
                                   page.removeEventListener("closing", manageClose);
                               ctrl.removeEventListener("beforehide", manageClose);
                               ctrl.closePage(arg, this.element).then(function () {
                                   complete({ completed: true, data: arg });
                               });
                           },
                           cancel: function () {
                               manageClose();
                               ctrl.closePage();
                           }
                       };

                       ctrl.open(uri, options, skipHistory).then(function (arg) {
                           page = ctrl.navigator.pageControl;
                           page.addEventListener("closing", manageClose);
                           ctrl.addEventListener("beforehide", manageClose, false);
                       });
                   });

               },

               /**
                * display child view and navigate to target uri
                * @param {string} uri target page uri
                * @param {Object} options options for target page
                * @param {boolean} skipHistory indicate if navigation should skip being added to history
                * @returns {WinJS.Promise}
                */
               open: function (uri, options, skipHistory) {
                   var that = this;
                   $(that.element).addClass("visible");
                   that.dispatchEvent('beforeshow');
                   that.$overlay.addClass("visible");
                   that.$contentPlaceholder.addClass("visible");

                   return new WinJS.Promise(function (complete, error) {
                       //setImmediate(function () {
                       if (!that.isOpened) {
                           that.show(true);
                       }

                       setImmediate(function () {
                           that.navigate(uri, options, skipHistory).done(function (e) {
                               that.dispatchEvent('aftershow');
                               complete(e);
                           }, error);
                       });
                       //});
                   });
               },

               canClose: function () {
                   var that = this;
                   if (this.navigator.pageControl && this.navigator.pageControl.canClose) {
                       if (!this.navigator.pageControl.canClose()) {
                           return false;
                       }
                   }

                   return true;
               },

               /**
                * close all content and hide child view
                */
               hide: function (arg) {
                   var that = this;
                   if (that.isOpened) {

                       if (!that.canClose()) {
                           return false;
                       }

                       document.body.removeEventListener('keyup', that.childContentKeyUp);
                       that.isOpened = false;
                       that.dispatchEvent('beforehide', arg);

                       if (WinJSContrib.UI.Application && WinJSContrib.UI.Application.navigator)
                           WinJSContrib.UI.Application.navigator.removeLock();

                       WinJS.Navigation.removeEventListener('beforenavigate', this.cancelNavigationBinded);
                       if (window.Windows && window.Windows.Phone)
                           Windows.Phone.UI.Input.HardwareButtons.removeEventListener("backpressed", this.hardwareBackBtnPressedBinded);
                       else
                           document.removeEventListener("backbutton", this.hardwareBackBtnPressedBinded);

                       if (that.$overlay.hasClass("visible")) {
                           that.$contentPlaceholder.afterTransition(function () {
                               that.clear();
                               $(that.element).removeClass('visible');
                               that.dispatchEvent('afterhide', arg);
                           });

                           that.$overlay.removeClass("visible");
                           that.$contentPlaceholder.removeClass("visible");
                       }
                   }
                   return true;
               }
           }),
           WinJS.Utilities.eventMixin,
           WinJS.Utilities.createEventProperties("beforeshow", "beforehide", "aftershow", "afterhide"))

    });
})();