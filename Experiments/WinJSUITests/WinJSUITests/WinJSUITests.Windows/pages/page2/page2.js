﻿// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    WinJS.UI.Pages.define("/pages/page2/page2.html", {
        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        processed: function (element, options) {
            WinJS.Binding.processAll(element, options);
        },

        unload: function () {
            // TODO: Respond to navigations away from this page.
        },

        updateLayout: function (element) {
            /// <param name="element" domElement="true" />

            // TODO: Respond to changes in layout.
        }
    });
})();
