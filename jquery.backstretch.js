/*
 * Backstretch
 * http://srobbin.com/jquery-plugins/backstretch/
 *
 * Copyright (c) 2013 Scott Robbin
 * Licensed under the MIT license.
 *
 * Added caption support by
 * Sebastian Sulinski
 * ssdtutorials.com
 *
 */

;
(function ($, window, undefined) {
    'use strict';

    /* PLUGIN DEFINITION
     * ========================= */

    $.fn.backstretch = function (images, options) {
        // We need at least one image or method name
        if (images === undefined || images.length === 0) {
            $.error("No images were supplied for Backstretch");
        }

        /*
         * Scroll the page one pixel to get the right window height on iOS
         * Pretty harmless for everyone else
         */
        if ($(window).scrollTop() === 0) {
            window.scrollTo(0, 0);
        }

        return this.each(function () {
            var $this = $(this)
                , obj = $this.data('backstretch');

            // Do we already have an instance attached to this element?
            if (obj) {

                // Is this a method they're trying to execute?
                if (typeof images == 'string' && typeof obj[images] == 'function') {
                    // Call the method
                    obj[images](options);

                    // No need to do anything further
                    return;
                }

                // Merge the old options with the new
                options = $.extend(obj.options, options);

                // Remove the old instance
                obj.destroy(true);
            }

            obj = new Backstretch(this, images, options);
            $this.data('backstretch', obj);
        });
    };

    // If no element is supplied, we'll attach to body
    $.backstretch = function (images, options) {
        // Return the instance
        return $('body')
            .backstretch(images, options)
            .data('backstretch');
    };

    // Custom selector
    $.expr[':'].backstretch = function (elem) {
        return $(elem).data('backstretch') !== undefined;
    };

    /* DEFAULTS
     * ========================= */

    $.fn.backstretch.defaults = {
        centeredX: true   // Should we center the image on the X axis?
        , centeredY: true   // Should we center the image on the Y axis?
        , duration: 5000    // Amount of time in between slides (if slideshow)
        , fade: 0           // Speed of fade transition between slides
        , captionAppendTo: 'body'
        , dataCaption: 'bootstrap-image'
        , dataCaptionIndexSeparator: '_'
        , captionHideClass: 'hide'
    };

    /* STYLES
     *
     * Baked-in styles that we'll apply to our elements.
     * In an effort to keep the plugin simple, these are not exposed as options.
     * That said, anyone can override these in their own stylesheet.
     * ========================= */
    var styles = {
        wrap: {
            left: 0, top: 0, overflow: 'hidden', margin: 0, padding: 0, height: '100%', width: '100%', zIndex: -999999
        }, img: {
            position: 'absolute', display: 'none', margin: 0, padding: 0, border: 'none', width: 'auto', height: 'auto', maxHeight: 'none', maxWidth: 'none', zIndex: -999999
        }
    };

    /* CLASS DEFINITION
     * ========================= */
    var Backstretch = function (container, images, options) {
        this.options = $.extend({}, $.fn.backstretch.defaults, options || {});

        /* In its simplest form, we allow Backstretch to be called on an image path.
         * e.g. $.backstretch('/path/to/image.jpg')
         * So, we need to turn this back into an array.
         */

        var self = this;

        self.images = $.isArray(images) ? images : [images];

        // Preload images
        $.each(self.images, function (key, value) {

            if (!self.imagesContainCaption()) {
                console.log();

                $('<img />')[0].src = this;

            } else {

                $('<img />')[0].src = value.src;

                self.appendCaption(
                    key,
                    value.src,
                    value.caption
                );

            }

        });

        // Convenience reference to know if the container is body.
        self.isBody = container === document.body;

        /* We're keeping track of a few different elements
         *
         * Container: the element that Backstretch was called on.
         * Wrap: a DIV that we place the image into, so we can hide the overflow.
         * Root: Convenience reference to help calculate the correct height.
         */
        self.$container = $(container);
        self.$root = self.isBody ? supportsFixedPosition ? $(window) : $(document) : self.$container;

        // Don't create a new wrap if one already exists (from a previous instance of Backstretch)
        var $existing = self.$container.children(".backstretch").first();
        self.$wrap = $existing.length ? $existing : $('<div class="backstretch"></div>').css(styles.wrap).appendTo(self.$container);

        // Non-body elements need some style adjustments
        if (!self.isBody) {
            // If the container is statically positioned, we need to make it relative,
            // and if no zIndex is defined, we should set it to zero.
            var position = self.$container.css('position')
                , zIndex = self.$container.css('zIndex');

            self.$container.css({
                position: position === 'static' ? 'relative' : position, zIndex: zIndex === 'auto' ? 0 : zIndex, background: 'none'
            });

            // Needs a higher z-index
            self.$wrap.css({zIndex: -999998});
        }

        // Fixed or absolute positioning?
        self.$wrap.css({
            position: self.isBody && supportsFixedPosition ? 'fixed' : 'absolute'
        });

        // Set the first image
        self.index = 0;
        self.show(self.index);

        // Listen for resize
        $(window).on('resize.backstretch', $.proxy(self.resize, self))
            .on('orientationchange.backstretch', $.proxy(function () {
                // Need to do this in order to get the right window height
                if (self.isBody && window.pageYOffset === 0) {
                    window.scrollTo(0, 1);
                    self.resize();
                }
            }, self));
    };

    /* PUBLIC METHODS
     * ========================= */
    Backstretch.prototype = {
        imagesContainCaption: function () {

            return (typeof this.images[0] === 'object');

        },
        appendCaption: function (index, src, content) {

            var caption = '<div style="display: none;" data-';
            caption += this.options.dataCaption;
            caption += '="';
            caption += src + this.options.dataCaptionIndexSeparator + index;
            caption += '">';
            caption += content;
            caption += '</div>';

            $(this.options.captionAppendTo).append(caption);

        },
        resize: function () {
            try {
                var bgCSS = {left: 0, top: 0}
                    , rootWidth = this.isBody ? this.$root.width() : this.$root.innerWidth()
                    , bgWidth = rootWidth
                    , rootHeight = this.isBody ? ( window.innerHeight ? window.innerHeight : this.$root.height() ) : this.$root.innerHeight()
                    , bgHeight = bgWidth / this.$img.data('ratio')
                    , bgOffset;

                // Make adjustments based on image ratio
                if (bgHeight >= rootHeight) {
                    bgOffset = (bgHeight - rootHeight) / 2;
                    if (this.options.centeredY) {
                        bgCSS.top = '-' + bgOffset + 'px';
                    }
                } else {
                    bgHeight = rootHeight;
                    bgWidth = bgHeight * this.$img.data('ratio');
                    bgOffset = (bgWidth - rootWidth) / 2;
                    if (this.options.centeredX) {
                        bgCSS.left = '-' + bgOffset + 'px';
                    }
                }

                this.$wrap.css({width: rootWidth, height: rootHeight})
                    .find('img:not(.deleteable)').css({width: bgWidth, height: bgHeight}).css(bgCSS);
            } catch (err) {
                // IE7 seems to trigger resize before the image is loaded.
                // This try/catch block is a hack to let it fail gracefully.
            }

            return this;
        }, updateCaption: function (existingIndex, newIndex) {

            var self = this,
                existingSrc = self.images[existingIndex].src
                    + self.options.dataCaptionIndexSeparator
                    + existingIndex,
                newSrc = self.images[newIndex].src
                    + self.options.dataCaptionIndexSeparator
                    + newIndex;

            $('[data-' + self.options.dataCaption + '="' + existingSrc + '"]')
                .fadeOut(200, function() {

                    $(this).addClass(self.options.captionHideClass);

                    $('[data-' + self.options.dataCaption + '="' + newSrc + '"]')
                        .fadeIn(200)
                        .removeClass(self.options.captionHideClass);

                });

        }
        // Show the slide at a certain position
        , show: function (newIndex) {

            // Validate index
            if (Math.abs(newIndex) > this.images.length - 1) {
                return;
            }

            // Vars
            var self = this
                , currentIndex = this.index
                , oldImage = self.$wrap.find('img').addClass('deleteable')
                , evtOptions = { relatedTarget: self.$container[0] };

            // Trigger the "before" event
            self.$container.trigger($.Event('backstretch.before', evtOptions), [self, newIndex]);

            // Set the new index
            self.index = newIndex;

            // Pause the slideshow
            clearInterval(self.interval);

            if (self.imagesContainCaption()) {

                self.updateCaption(
                    currentIndex,
                    self.index
                );

            }

            // New image
            self.$img = $('<img />')
                .css(styles.img)
                .bind('load', function (e) {
                    var imgWidth = this.width || $(e.target).width()
                        , imgHeight = this.height || $(e.target).height();

                    // Save the ratio
                    $(this).data('ratio', imgWidth / imgHeight);

                    // Show the image, then delete the old one
                    // "speed" option has been deprecated, but we want backwards compatibilty
                    $(this).fadeIn(self.options.speed || self.options.fade, function () {
                        oldImage.remove();

                        // Resume the slideshow
                        if (!self.paused) {
                            self.cycle();
                        }

                        // Trigger the "after" and "show" events
                        // "show" is being deprecated
                        $(['after', 'show']).each(function () {
                            self.$container.trigger($.Event('backstretch.' + this, evtOptions), [self, newIndex]);
                        });
                    });

                    // Resize
                    self.resize();
                })
                .appendTo(self.$wrap);

            // Hack for IE img onload event
            if (!self.imagesContainCaption()) {
                self.$img.attr('src', self.images[newIndex]);
            } else {
                self.$img.attr('src', self.images[newIndex].src);
            }
            return self;
        }, next: function () {
            // Next slide
            return this.show(this.index < this.images.length - 1 ? this.index + 1 : 0);
        }, prev: function () {
            // Previous slide
            return this.show(this.index === 0 ? this.images.length - 1 : this.index - 1);
        }, pause: function () {
            // Pause the slideshow
            this.paused = true;
            return this;
        }, resume: function () {
            // Resume the slideshow
            this.paused = false;
            this.next();
            return this;
        }, cycle: function () {
            // Start/resume the slideshow
            if (this.images.length > 1) {
                // Clear the interval, just in case
                clearInterval(this.interval);

                this.interval = setInterval($.proxy(function () {
                    // Check for paused slideshow
                    if (!this.paused) {
                        this.next();
                    }
                }, this), this.options.duration);
            }
            return this;
        }, destroy: function (preserveBackground) {
            // Stop the resize events
            $(window).off('resize.backstretch orientationchange.backstretch');

            // Clear the interval
            clearInterval(this.interval);

            // Remove Backstretch
            if (!preserveBackground) {
                this.$wrap.remove();
            }
            this.$container.removeData('backstretch');
        }
    };

    /* SUPPORTS FIXED POSITION?
     *
     * Based on code from jQuery Mobile 1.1.0
     * http://jquerymobile.com/
     *
     * In a nutshell, we need to figure out if fixed positioning is supported.
     * Unfortunately, this is very difficult to do on iOS, and usually involves
     * injecting content, scrolling the page, etc.. It's ugly.
     * jQuery Mobile uses this workaround. It's not ideal, but works.
     *
     * Modified to detect IE6
     * ========================= */

    var supportsFixedPosition = (function () {
        var ua = navigator.userAgent
            , platform = navigator.platform
        // Rendering engine is Webkit, and capture major version
            , wkmatch = ua.match(/AppleWebKit\/([0-9]+)/)
            , wkversion = !!wkmatch && wkmatch[ 1 ]
            , ffmatch = ua.match(/Fennec\/([0-9]+)/)
            , ffversion = !!ffmatch && ffmatch[ 1 ]
            , operammobilematch = ua.match(/Opera Mobi\/([0-9]+)/)
            , omversion = !!operammobilematch && operammobilematch[ 1 ]
            , iematch = ua.match(/MSIE ([0-9]+)/)
            , ieversion = !!iematch && iematch[ 1 ];

        return !(
            // iOS 4.3 and older : Platform is iPhone/Pad/Touch and Webkit version is less than 534 (ios5)
            ((platform.indexOf("iPhone") > -1 || platform.indexOf("iPad") > -1 || platform.indexOf("iPod") > -1 ) && wkversion && wkversion < 534) ||

                // Opera Mini
                (window.operamini && ({}).toString.call(window.operamini) === "[object OperaMini]") ||
                (operammobilematch && omversion < 7458) ||

                //Android lte 2.1: Platform is Android and Webkit version is less than 533 (Android 2.2)
                (ua.indexOf("Android") > -1 && wkversion && wkversion < 533) ||

                // Firefox Mobile before 6.0 -
                (ffversion && ffversion < 6) ||

                // WebOS less than 3
                ("palmGetResource" in window && wkversion && wkversion < 534) ||

                // MeeGo
                (ua.indexOf("MeeGo") > -1 && ua.indexOf("NokiaBrowser/8.5.0") > -1) ||

                // IE6
                (ieversion && ieversion <= 6)
            );
    }());

}(jQuery, window));