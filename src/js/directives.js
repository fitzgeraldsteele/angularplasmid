/*global angular*/
(function () {
    'use strict';

    angular.module("angularplasmid", ["angularplasmid.services"])

        .directive("plasmidapi", ['SVGUtil', function (SVGUtil) {
            return {
                restrict: "AE",
                link : function (scope, elem, attr) {
                    scope[attr.name] = SVGUtil.api;
                }
            };
        }])

        .directive("plasmid", ['SVGUtil', function (SVGUtil) {
            return {
                restrict: 'AE',
                type : 'svg',
                template : '<svg></svg>',
                replace : true,
                transclude: true,
                require: 'plasmid',
                scope: {
                    plasmidheight : '@',
                    plasmidwidth : '@',
                    sequencelength : '@',
                    sequence : '@'
                },
                link : {
                    pre : function (scope, elem, attr, plasmidController) {
                        plasmidController.init(elem);
                    },
                    post : function (scope, elem, attrs, plasmidController, transcludeFn) {

                        // Manually transclude children elements
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        // Watch for changes to plasmid
                        scope.$watchGroup(['plasmidheight', 'plasmidwidth', 'sequencelength', 'sequence'], function () {plasmidController.draw(); });
                    }
                },
                controller : ['$scope', 'SVGUtil', function ($scope, SVGUtil) {
                    var element, plasmid, tracks = [];

                    plasmid = this;
                    
                    plasmid.type = "plasmid";

                    plasmid.init = function (elem) {
                        SVGUtil.api.addPlasmid(plasmid);
                        element = elem;
                        plasmid.id = element.attr("id");
                    };

                    plasmid.draw = function () {
                        var d = plasmid.dimensions;
                        element.attr("height", d.height);
                        element.attr("width", d.width);
                        angular.forEach(tracks, function (t) {
                            t.draw();
                        });
                    };

                    plasmid.addTrack = function (track) {
                        tracks.push(track);
                    };

                    Object.defineProperty(plasmid, "center", {
                        get: function () {
                            var d = plasmid.dimensions;
                            return {
                                x : d.width / 2,
                                y : d.height / 2
                            };
                        }
                    });
                    Object.defineProperty(plasmid, "dimensions", {
                        get: function () {
                            return {
                                height : SVGUtil.util.Numeric($scope.plasmidheight, 300),
                                width : SVGUtil.util.Numeric($scope.plasmidwidth, 300)
                            };
                        }
                    });
                    Object.defineProperty(plasmid, "sequencelength", {
                        get: function () {
                            return (plasmid.sequence ? plasmid.sequence.length : SVGUtil.util.Numeric($scope.sequencelength));
                        }
                    });
                    Object.defineProperty(plasmid, "sequence", {
                        get: function () {
                            return $scope.sequence;
                        }
                    });
                    plasmid.tracks = tracks;
                }]
            };
        }])

         .directive("plasmidtrack", ['SVGUtil', '$compile', function (SVGUtil, $compile) {
            return {
                restrict: 'AE',
                type : 'svg',
                template: '<g><path></path></g>',
                replace : true,
                transclude: true,
                require: ['plasmidtrack', '^plasmid'],
                scope: {
                    radius: '@',
                    width: '@',
                    trackclick: '&'
                },
                link : {
                    pre : function (scope, elem, attr, controllers, transcludeFn) {
                        var trackController = controllers[0], plasmidController = controllers[1], pathElem = angular.element(elem.children()[0]);
                        trackController.init(pathElem, plasmidController);
                    },
                    post : function (scope, elem, attr, controllers, transcludeFn) {

                        // Manually transclude children elements
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        // Apply special style to path to allow for correct display and apply directive's properties (class, style, id, name) to the path instead of the g
                        var g = angular.element(elem), path  = angular.element(elem.children()[0]), trackController = controllers[0];
                        SVGUtil.util.swapProperties(g, path);
                        path.attr("fill-rule", "evenodd");
                        $compile(path)(scope.$parent);

                        //Attach event handlers
                        path.on("click", function (e) {
                            scope.trackclick({
                                $event: e,
                                $track: trackController
                            });
                        });


                        // Watch for changes in the track
                        scope.$watchGroup(['radius', 'width'], function () {trackController.draw(); });
                    }
                },
                    
                controller : ['$scope', function ($scope) {
                    var plasmid, element, plasmidTrack, markers = [], scales = [], labels = [];

                    plasmidTrack = this;
                    
                    plasmidTrack.type = "plasmidtrack";

                    plasmidTrack.init = function (elem, plasmidCtrl) {
                        plasmid = plasmidCtrl;
                        plasmid.addTrack(plasmidTrack);
                        plasmidTrack.plasmid = plasmid;
                        element = elem;
                    };

                    plasmidTrack.draw = function () {
                        var center = plasmidTrack.center,
                            path = SVGUtil.svg.path.donut(center.x, center.y, plasmidTrack.radius, plasmidTrack.width);
                        element.attr("d", path);
                        angular.forEach(markers, function (m) {
                            m.draw();
                        });
                        angular.forEach(scales, function (s) {
                            s.draw();
                        });
                        angular.forEach(labels, function (l) {
                            l.draw();
                        });
                    };

                    plasmidTrack.addMarker = function (marker) {
                        markers.push(marker);
                    };

                    plasmidTrack.addScale = function (scale) {
                        scales.push(scale);
                    };
                    
                    plasmidTrack.addLabel = function (label) {
                        labels.push(label);
                    };

                    plasmidTrack.markergroup = function (groupName) {
                        var items = [];
                        angular.forEach(markers, function (marker) {
                            if (marker.markergroup === groupName) {
                                items.push(marker);
                            }
                        });
                        return items;
                    };

                    plasmidTrack.getPosition = function (pos, positionOption, radiusAdjust) {
                        radiusAdjust = Number(radiusAdjust || 0);
                        pos = Number(pos);

                        var POSITION_OPTION_MID = 0, POSITION_OPTION_INNER = 1, POSITION_OPTION_OUTER = 2,
                            radius, angle, center = plasmidTrack.center,
                            seqLen = plasmid.sequencelength;

                        if (seqLen > 0) {
                            angle = (pos / seqLen) * 360;

                            switch (positionOption) {
                            case POSITION_OPTION_INNER:
                                radius = plasmidTrack.radius + radiusAdjust;
                                break;
                            case POSITION_OPTION_OUTER:
                                radius = plasmidTrack.radius + plasmidTrack.width + radiusAdjust;
                                break;
                            default:
                                radius = plasmidTrack.radius + (plasmidTrack.width / 2) + radiusAdjust;
                                break;
                            }
                            return SVGUtil.util.polarToCartesian(center.x, center.y, radius, angle);
                        }
                    };
                    Object.defineProperty(plasmidTrack, "center", {
                        get: function () {
                            return plasmid.center;
                        }
                    });
                    Object.defineProperty(plasmidTrack, "radius", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.radius, 100);
                        }
                    });
                    Object.defineProperty(plasmidTrack, "width", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.width, 25);
                        }
                    });

                    plasmidTrack.markers = markers;
                    plasmidTrack.scales = scales;
                    plasmidTrack.labels = labels;

                }]
            };
        }])

         .directive("trackscale", ['SVGUtil', '$compile', function (SVGUtil, $compile) {
            return {
                restrict: 'AE',
                type : 'svg',
                template: '<g><path></path><g></g></g>',
                replace : true,
                transclude: true,
                require: ['trackscale', '^plasmidtrack'],
                scope: {
                    interval: "@",
                    vadjust: "@",
                    ticksize: "@",
                    direction: "@",
                    showlabels : "@",
                    labelvadjust : "@",
                    labelclass : "@",
                    labelstyle : "@",
                    scaleclick : "&"
                },
                link : {
                    pre : function (scope, elem, attr, controllers, transcludeFn) {
                        var scaleController = controllers[0], trackController = controllers[1], pathElem = angular.element(elem.children()[0]), groupElem = angular.element(elem.children()[1]);
                        scaleController.init(pathElem, groupElem, trackController);
                    },
                    post : function (scope, elem, attr, controllers, transcludeFn) {

                        var g, path, scaleController;

                        //Manually transclude children elements
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        //Apply directive's properties (class, style, id, name) to the path instead of the g
                        g = angular.element(elem);
                        path  = angular.element(elem.children()[0]);
                        SVGUtil.util.swapProperties(g, path);
                        $compile(path)(scope.$parent);

                        
                        //Attach event handlers
                        path.on("click", function (e) {
                            scope.scaleclick({
                                $event: e,
                                $scale: scaleController
                            });
                        });
                        
                        // Watch for changes to scale
                        scaleController = controllers[0];
                        scope.$watchGroup(['interval', 'vadjust', 'ticksize', 'labelvadjust', 'direction', 'showlabels', 'labelstyle'], function () {scaleController.draw(); });

                    }
                },
                controller : ['$scope', function ($scope) {
                    var track, trackScale, element, groupElement,
                        DEFAULT_LABELVADJUST = 15, DEFAULT_TICKSIZE = 3;

                    trackScale = this;
                    trackScale.type = "trackscale";
                    
                    trackScale.init = function (elem, groupElem, trackCtrl) {
                        track = trackCtrl;
                        track.addScale(trackScale);
                        trackScale.track = track;
                        element = elem;
                        groupElement = groupElem;
                    };

                    trackScale.draw = function () {
                        var center = track.center,
                            path = SVGUtil.svg.path.scale(center.x, center.y, trackScale.radius, trackScale.interval, trackScale.total, trackScale.ticksize);

                        element.attr("d", path);
                        if (trackScale.showlabels) {
                            trackScale.drawLabel();
                        } else {
                            groupElement.empty();
                        }
                    };

                    trackScale.drawLabel = function () {
                        var i, t, labels, center = track.center;

                        function clickHandler(e) {
                            $scope.scaleclick({
                                $event: e,
                                $scale: trackScale
                            });
                        }
                        
                        labels = SVGUtil.svg.element.scalelabels(center.x, center.y, trackScale.labelradius, trackScale.interval, trackScale.total);
                        groupElement.empty();
                        for (i = 0; i <= labels.length - 1; i += 1) {
                            t = angular.element(SVGUtil.svg.createNode('text'));
                            if (trackScale.labelclass) { t.attr('class', trackScale.labelclass); }
                            if (trackScale.labelstyle) { t.attr('style', trackScale.labelstyle); }
                            t.attr("x", labels[i].x);
                            t.attr("y", labels[i].y);
                            t.attr("text-anchor", "middle");
                            t.attr("alignment-baseline", "middle");
                            t.text(labels[i].text);
                            t.on("click", clickHandler);
                            groupElement.append(t);
                        }
                    };
                    Object.defineProperty(trackScale, "radius", {
                        get: function () {
                            return (trackScale.inwardflg ? track.radius : track.radius + track.width) +  ((trackScale.inwardflg ? -1 : 1) * trackScale.vadjust) + (trackScale.inwardflg ? -(trackScale.ticksize) : 0);
                        }
                    });
                    Object.defineProperty(trackScale, "interval", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.interval);
                        }
                    });
                    Object.defineProperty(trackScale, "vadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.vadjust);
                        }
                    });
                    Object.defineProperty(trackScale, "ticksize", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.ticksize, DEFAULT_TICKSIZE);
                        }
                    });
                    Object.defineProperty(trackScale, "inwardflg", {
                        get: function () {
                            return $scope.direction === 'in' ? true : false;
                        }
                    });
                    Object.defineProperty(trackScale, "total", {
                        get: function () {
                            return track.plasmid.sequencelength;
                        }
                    });
                    Object.defineProperty(trackScale, "showlabels", {
                        get: function () {
                            return $scope.showlabels === "1" ? true : false;
                        }
                    });
                    Object.defineProperty(trackScale, "labelvadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.labelvadjust, DEFAULT_LABELVADJUST);
                        }
                    });
                    Object.defineProperty(trackScale, "labelclass", {
                        get: function () {
                            return $scope.labelclass;
                        }
                    });
                    Object.defineProperty(trackScale, "labelstyle", {
                        get: function () {
                            return $scope.labelstyle;
                        }
                    });
                    Object.defineProperty(trackScale, "labelradius", {
                        get: function () {
                            return trackScale.radius + (trackScale.labelvadjust * (trackScale.inwardflg ? -1 : 1));
                        }
                    });
                }]
            };
        }])
    
        .directive("tracklabel", ['SVGUtil', function (SVGUtil) {
            return {
                restrict: 'AE',
                type : 'svg',
                template: '<text></text>',
                replace : true,
                transclude: true,
                require: ['tracklabel', '^plasmidtrack'],
                scope: {
                    text: "@",
                    hadjust : "@",
                    vadjust : "@",
                    labelclick : "&"
                },
                link : {
                    pre : function (scope, elem, attr, controllers, transcludeFn) {
                        var labelController = controllers[0], trackController = controllers[1], textElem = angular.element(elem[0]);
                        labelController.init(textElem, trackController);
                    },
                    post : function (scope, elem, attr, controllers, transcludeFn) {

                        var labelController;

                        //Manually transclude children elements
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        // Set some default properties for the label display
                        elem.attr("text-anchor", "middle");
                        elem.attr("alignment-baseline", "middle");

                        //Attach event handlers
                        elem.on("click", function (e) {
                            scope.labelclick({
                                $event: e,
                                $label: labelController
                            });
                        });

                        // Watch for changes to label
                        labelController = controllers[0];
                        scope.$watchGroup(['text', 'vadjust', 'hadjust'], function () {labelController.draw(); });
                    }
                },
                controller : ['$scope', function ($scope) {
                    var track, trackLabel, element;
                    
                    trackLabel = this;
                    trackLabel.type = "tracklabel";

                    trackLabel.init = function (elem, trackCtrl) {
                        track = trackCtrl;
                        track.addLabel(trackLabel);
                        trackLabel.track = track;
                        element = elem;
                    };

                    trackLabel.draw = function () {
                        var center = track.center, startX, startY;
                        element.attr("x", center.x + trackLabel.hadjust);
                        element.attr("y", center.y + trackLabel.vadjust);
                        element.text(trackLabel.text);
                    };

                    Object.defineProperty(trackLabel, "center", {
                        get: function () {
                            return track.center;
                        }
                    });
                    Object.defineProperty(trackLabel, "text", {
                        get: function () {
                            return $scope.text;
                        }
                    });
                    Object.defineProperty(trackLabel, "hadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.hadjust, 0);
                        }
                    });
                    Object.defineProperty(trackLabel, "vadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.vadjust, 0);
                        }
                    });
                    Object.defineProperty(trackLabel, "dimensions", {
                        get: function () {
                            return element[0].getBBox();
                        }
                    });
                }]
            };
        }])

        .directive("trackmarker", ['SVGUtil', '$compile', function (SVGUtil, $compile) {
            return {
                restrict: 'AE',
                type : 'svg',
                template: '<g><path></path></g>',
                replace : true,
                transclude: true,
                require: ['trackmarker', '^plasmidtrack'],
                scope: {
                    start: "@",
                    end: "@",
                    vadjust: "@",
                    wadjust: "@",
                    markergroup: "@",
                    arrowstartlength : "@",
                    arrowstartwidth : "@",
                    arrowstartangle : "@",
                    arrowendlength : "@",
                    arrowendwidth : "@",
                    arrowendangle : "@",
                    markerclick: "&"
                },
                link : {
                    pre : function (scope, elem, attr, controllers, transcludeFn) {
                        var markerController = controllers[0], trackController = controllers[1], pathElem = angular.element(elem.children()[0]);
                        markerController.init(pathElem, trackController);
                    },
                    post : function (scope, elem, attr, controllers, transcludeFn) {

                        var markerController = controllers[0], g, path;

                        //Manually transclude children elements
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        //Apply directive's properties (class, style, id, name) to the path instead of the g
                        g = angular.element(elem);
                        path  = angular.element(elem.children()[0]);
                        SVGUtil.util.swapProperties(g, path);
                        $compile(path)(scope.$parent);

                        //Attach event handlers
                        path.on("click", function (e) {
                            scope.markerclick({
                                $event: e,
                                $marker: markerController
                            });
                        });

                        // Watch for changes to marker
                        scope.$watchGroup(['start', 'end', 'vadjust', 'wadjust', 'markergroup', 'arrowstartlength', 'arrowstartwidth', 'arrowstartangle', 'arrowendlength', 'arrowendwidth', 'arrowendangle'], function () {markerController.draw(); });

                    }
                },
                controller : ['$scope', function ($scope) {
                    var track, marker, element, markerLabels = [];

                    marker = this;
                    marker.type = "trackmarker";

                    marker.init = function (elem, trackCtrl) {
                        track = trackCtrl;
                        track.addMarker(marker);
                        element = elem;
                        marker.track = track;
                    };

                    marker.draw = function () {
                        element.attr("d", marker.getPath());
                        angular.forEach(markerLabels, function (markerLabel) {
                            markerLabel.draw();
                        });
                    };

                    marker.addMarkerLabel = function (markerLabel) {
                        markerLabels.push(markerLabel);
                    };

                    marker.getPath = function () {
                        var center = track.center, angle = marker.angle, radius = marker.radius;
                        return SVGUtil.svg.path.arc(center.x, center.y, radius.inner, angle.start, angle.end, marker.width, marker.arrowstart, marker.arrowend);
                    };

                    marker.getPosition = function (hAdjust, vAdjust, hAlign, vAlign) {
                        var HALIGN_MIDDLE = "middle", HALIGN_START = "start", HALIGN_END = "end",
                            VALIGN_MIDDLE = "middle", VALIGN_INNER = "inner", VALIGN_OUTER = "outer",
                            center, radius, angle, markerRadius, markerAngle;

                        center = track.center;
                        markerRadius = marker.radius;
                        markerAngle = marker.angle;
                        hAdjust = SVGUtil.util.Numeric(hAdjust);
                        vAdjust = SVGUtil.util.Numeric(vAdjust);

                        if (vAlign !== undefined && hAlign !== undefined) {
                            switch (vAlign) {
                            case VALIGN_INNER:
                                radius =  markerRadius.inner + vAdjust;
                                break;
                            case VALIGN_OUTER:
                                radius =  markerRadius.outer + vAdjust;
                                break;
                            default:
                                radius =  markerRadius.middle + vAdjust;
                                break;
                            }

                            switch (hAlign) {
                            case HALIGN_START:
                                angle = markerAngle.start + hAdjust;
                                break;
                            case HALIGN_END:
                                angle = markerAngle.end + hAdjust;
                                break;
                            default:
                                angle = markerAngle.middle + hAdjust;
                                break;
                            }

                            return SVGUtil.util.polarToCartesian(center.x, center.y, radius, angle);
                        } else {

                            radius = {
                                outer : markerRadius.outer + vAdjust,
                                inner : markerRadius.inner + vAdjust,
                                middle : markerRadius.middle + vAdjust
                            };

                            angle = {
                                begin : markerAngle.start + hAdjust,
                                end : markerAngle.end + hAdjust,
                                middle : markerAngle.middle + hAdjust
                            };


                            return {
                                outer : {
                                    begin: SVGUtil.util.polarToCartesian(center.x, center.y, radius.outer, angle.begin),
                                    middle: SVGUtil.util.polarToCartesian(center.x, center.y, radius.outer, angle.middle),
                                    end: SVGUtil.util.polarToCartesian(center.x, center.y, radius.outer, angle.end)
                                },
                                middle : {
                                    begin: SVGUtil.util.polarToCartesian(center.x, center.y, radius.middle, angle.begin),
                                    middle: SVGUtil.util.polarToCartesian(center.x, center.y, radius.middle, angle.middle),
                                    end: SVGUtil.util.polarToCartesian(center.x, center.y, radius.middle, angle.end)
                                },
                                inner : {
                                    begin: SVGUtil.util.polarToCartesian(center.x, center.y, radius.inner, angle.begin),
                                    middle: SVGUtil.util.polarToCartesian(center.x, center.y, radius.inner, angle.middle),
                                    end: SVGUtil.util.polarToCartesian(center.x, center.y, radius.inner, angle.end)
                                }
                            };
                        }

                    };
                    marker.fireClick = function (event) {
                        $scope.markerclick({
                            $event: event.$event,
                            $marker: event.$marker
                        });
                    };
                    Object.defineProperty(marker, "center", {
                        get: function () {
                            return track.center;
                        }
                    });
                    Object.defineProperty(marker, "radius", {
                        get: function () {
                            return {
                                inner : track.radius + marker.vadjust,
                                outer : track.radius + marker.vadjust + marker.width,
                                middle : track.radius + marker.vadjust + marker.width / 2
                            };
                        }
                    });
                    Object.defineProperty(marker, "angle", {
                        get: function () {
                            var startAngle, endAngle, midAngle, end;

                            startAngle = (marker.start / track.plasmid.sequencelength) * 360;

                            end = $scope.end || $scope.start;
                            endAngle = (SVGUtil.util.Numeric(end) / track.plasmid.sequencelength) * 360;
                            endAngle += (endAngle < startAngle) ? 360 : 0;

                            midAngle = startAngle + ((endAngle - startAngle) / 2);

                            return {
                                start : startAngle,
                                middle : midAngle,
                                end : endAngle
                            };
                        }
                    });
                    Object.defineProperty(marker, "vadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.vadjust);
                        }
                    });
                    Object.defineProperty(marker, "wadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.wadjust);
                        }
                    });
                    Object.defineProperty(marker, "width", {
                        get: function () {
                            return track.width + marker.wadjust;
                        }
                    });
                    Object.defineProperty(marker, "start", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.start);
                        }
                    });
                    Object.defineProperty(marker, "end", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.end);
                        }
                    });
                    Object.defineProperty(marker, "arrowstart", {
                        get: function () {
                            return {
                                width : SVGUtil.util.Numeric($scope.arrowstartwidth),
                                length : SVGUtil.util.Numeric($scope.arrowstartlength),
                                angle : SVGUtil.util.Numeric($scope.arrowstartangle)
                            };
                        }
                    });
                    Object.defineProperty(marker, "arrowend", {
                        get: function () {
                            return {
                                width : SVGUtil.util.Numeric($scope.arrowendwidth),
                                length : SVGUtil.util.Numeric($scope.arrowendlength),
                                angle : SVGUtil.util.Numeric($scope.arrowendangle)
                            };
                        }
                    });
                    Object.defineProperty(marker, "markergroup", {
                        get: function () {
                            return $scope.markergroup;
                        }
                    });
                    Object.defineProperty(marker, "sequence", {
                        get: function () {
                            var plasmidSeq = marker.track.plasmid.sequence,
                                markerSeq = '';
                            
                            if (marker.start > marker.end) {
                                return plasmidSeq.substring(marker.start - 1, plasmidSeq.length - 1) + plasmidSeq.substring(0, marker.end - 1);
                            } else {
                                return plasmidSeq.substring(marker.start - 1, marker.end - 1);
                            }
                        }
                    });

                    marker.labels = markerLabels;

                }]
            };
        }])

        .directive("markerlabel", ['SVGUtil', '$compile', function (SVGUtil, $compile) {

            return {
                restrict: 'AE',
                type : 'svg',
                transclude: true,
                template: '<g><path></path><path id="" style="fill:none;stroke:none"></path><text>{{textnormal}}<textpath xlink:href="#">{{textpath}}</textpath></text></g>',
                require: ['markerlabel', '^trackmarker'],
                replace : true,
                scope: {
                    text : "@",
                    valign : "@",
                    vadjust : "@",
                    halign : "@",
                    hadjust : "@",
                    type : "@",
                    showline : "@",
                    linestyle : "@",
                    lineclass : "@",
                    linevadjust : "@",
                    labelclick : "&"
                },
                link: {
                    pre : function (scope, elem, attr, controllers, transcludeFn) {
                        var markerlabelController = controllers[0],
                            trackMarkerController = controllers[1],
                            groupElem = angular.element(elem[0]),
                            lineElem = angular.element(elem.children()[0]),
                            pathElem = angular.element(elem.children()[1]),
                            textElem = angular.element(elem.children()[2]);

                        markerlabelController.init(textElem, groupElem, pathElem, lineElem, trackMarkerController);
                    },
                    post : function (scope, elem, attr, controllers, transcludeFn) {
                        transcludeFn(scope.$parent, function (content) {
                            elem.append(content);
                        });

                        var markerlabelController = controllers[0],
                            trackMarkerController = controllers[1],
                            g = angular.element(elem),
                            text = angular.element(elem.children()[2]);

                        //Apply directive's properties (class, style, id, name) to the text
                        text.attr("text-anchor", "middle");
                        text.attr("alignment-baseline", "middle");
                        SVGUtil.util.swapProperties(g, text);
                        $compile(text)(scope.$parent);
                        
                        //Attach event handlers
                        if (attr.labelclick) {
                            text.on("click", function (e) {
                                scope.labelclick({
                                    $event: e,
                                    $label: markerlabelController
                                });
                            });
                        // or bubble up events to the marker
                        } else {
                            text.on("click", function (e) {
                                trackMarkerController.fireClick({
                                    $event: e,
                                    $marker: trackMarkerController
                                });
                            });
                        }
                        
                        // Watch for changes to label
                        scope.$watchGroup(['text', 'type', 'valign', 'vadjust', 'halign', 'hadjust', 'showline', 'linevadjust', 'linestyle'], function () {markerlabelController.draw(); });

                    }
                },
                controller : ['$scope', function ($scope) {
                    var marker, markerLabel, textElement, pathElement, lineElement, groupElement;

                    markerLabel = this;
                    markerLabel.type = "markerlabel";

                    markerLabel.init = function (textElem, groupElem, pathElem, lineElem, markerCtrl) {
                        var id = 'TPATH' + (Math.random() + 1).toString(36).substring(3, 7),
                            textPathElem = angular.element(textElem.children()[0]);

                        marker = markerCtrl;
                        marker.addMarkerLabel(markerLabel);
                        markerLabel.marker = marker;
                        textElement = textElem;
                        pathElement = pathElem;
                        lineElement = lineElem;
                        groupElement = groupElem;
                        
                        pathElement.attr("id", id);
                        textPathElem.attr("xlink:href", '#' + id);

                    };

                    markerLabel.draw = function () {
                        var VALIGN_MIDDLE = "middle", VALIGN_INNER = "inner", VALIGN_OUTER = "outer",
                            HALIGN_MIDDLE = "middle", HALIGN_START = "start", HALIGN_END = "end",
                            fontSize = 0, fontAdjust = 0,
                            textPathElem, pos, markerAngle, src, dst, dstPos, dstV;

                        if (markerLabel.type === 'path') {
                            $scope.textnormal = null;
                            $scope.textpath = markerLabel.text;
                            textElement.removeAttr("x");
                            textElement.removeAttr("y");
                            textPathElem = angular.element(textElement.children()[0]);
                            fontSize = window.getComputedStyle(textElement[0]).fontSize.replace("px", "");
                            fontAdjust = (markerLabel.valign === VALIGN_OUTER) ? 0 : (markerLabel.valign === VALIGN_INNER) ? Number(fontSize || 0) : Number(fontSize || 0) / 2;
                            pathElement.attr("d", markerLabel.getPath(markerLabel.hadjust, markerLabel.vadjust - fontAdjust, markerLabel.halign, markerLabel.valign));

                            switch (markerLabel.halign) {
                            case HALIGN_START:
                                textElement.attr("text-anchor", "start");
                                textPathElem[0].setAttribute("startOffset", "0%"); //jQuery can't handle case sensitive names so can't use textPathElem.attr
                                break;
                            case HALIGN_END:
                                textElement.attr("text-anchor", "end");
                                textPathElem[0].setAttribute("startOffset", "100%");//jQuery can't handle case sensitive names so can't use textPathElem.attr
                                break;
                            default:
                                textElement.attr("text-anchor", "middle");
                                textPathElem[0].setAttribute("startOffset", "50%");//jQuery can't handle case sensitive names so can't use textPathElem.attr
                                break;
                            }
                        } else {
                            $scope.textnormal = markerLabel.text;
                            $scope.textpath = null;
                            pos = marker.getPosition(markerLabel.hadjust, markerLabel.vadjust, markerLabel.halign, markerLabel.valign);
                            textElement.attr("x", pos.x);
                            textElement.attr("y", pos.y);
                        }

                        if (markerLabel.showlineflg) {

                            src = marker.getPosition(markerLabel.hadjust, markerLabel.vadjust + markerLabel.linevadjust, markerLabel.halign, markerLabel.valign);

                            dstPos = marker.getPosition();
                            dstV = markerLabel.valign === VALIGN_INNER ? dstPos.inner : markerLabel.valign === VALIGN_MIDDLE ? dstPos.middle : dstPos.outer;
                            dst = markerLabel.halign === HALIGN_START ? dstV.begin : markerLabel.halign === HALIGN_END ? dstV.end : dstV.middle;

                            lineElement.attr("d", ["M", src.x, src.y, "L", dst.x, dst.y].join(" "));
                            if (!markerLabel.linestyle && !markerLabel.lineclass) { lineElement.attr("style", "stroke:#000"); }
                            if (markerLabel.linestyle) { lineElement.attr("style", markerLabel.linestyle); }
                            if (markerLabel.lineclass) { lineElement.attr("class", markerLabel.lineclass); }
                        } else {
                            lineElement.removeAttr("d");
                        }
                    };

                    markerLabel.getPath = function (hAdjust, vAdjust, hAlign, vAlign) {
                        var VALIGN_MIDDLE = "middle", VALIGN_INNER = "inner", VALIGN_OUTER = "outer",
                            HALIGN_MIDDLE = "middle", HALIGN_START = "start", HALIGN_END = "end",
                            center = marker.center,
                            radius, markerRadius, markerAngle, startAngle, endAngle;

                        markerRadius = marker.radius;
                        switch (vAlign) {
                        case VALIGN_INNER:
                            radius = markerRadius.inner;
                            break;
                        case VALIGN_OUTER:
                            radius = markerRadius.outer;
                            break;
                        default:
                            radius = markerRadius.middle;
                            break;
                        }

                        markerAngle = marker.angle;
                        switch (hAlign) {
                        case HALIGN_START:
                            startAngle = markerAngle.start;
                            endAngle = markerAngle.start + 359.99;
                            break;
                        case HALIGN_END:
                            startAngle = markerAngle.end + 1;
                            endAngle = markerAngle.end;
                            break;
                        default:
                            startAngle = markerAngle.middle + 180.05;
                            endAngle = markerAngle.middle + 179.95;
                            break;
                        }

                        return SVGUtil.svg.path.arc(center.x, center.y, radius + Number(vAdjust || 0), startAngle + Number(hAdjust || 0), endAngle + Number(hAdjust || 0), 1);
                    };
                    Object.defineProperty(markerLabel, "showlineflg", {
                        get: function () {
                            return ($scope.showline === "1" ? true : false);
                        }
                    });
                    Object.defineProperty(markerLabel, "halign", {
                        get: function () {
                            return $scope.halign || "middle";
                        }
                    });
                    Object.defineProperty(markerLabel, "valign", {
                        get: function () {
                            return $scope.valign || "middle";
                        }
                    });
                    Object.defineProperty(markerLabel, "hadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.hadjust);
                        }
                    });
                    Object.defineProperty(markerLabel, "vadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.vadjust);
                        }
                    });
                    Object.defineProperty(markerLabel, "type", {
                        get: function () {
                            return $scope.type;
                        }
                    });
                    Object.defineProperty(markerLabel, "linevadjust", {
                        get: function () {
                            return SVGUtil.util.Numeric($scope.linevadjust);
                        }
                    });
                    Object.defineProperty(markerLabel, "linestyle", {
                        get: function () {
                            return $scope.linestyle;
                        }
                    });
                    Object.defineProperty(markerLabel, "lineclass", {
                        get: function () {
                            return $scope.lineclass;
                        }
                    });
                    Object.defineProperty(markerLabel, "text", {
                        get: function () {
                            return $scope.text;
                        }
                    });
                }]
            };
        }]);

}());

