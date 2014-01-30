var ldss = angular.module('ldss', ['ngRoute', 'treeControl']);

ldss.run(function ($rootScope, $http) {
    $rootScope.user = null;
    $http.jsonp("https://data.fm/user.js?callback=JSON_CALLBACK")
        .success(function (data) {
            $rootScope.user = data;
        });
});

ldss.config([
    '$routeProvider',
    function ($routeProvider) {
        $routeProvider.when('/open/:uri*', {
            templateUrl: 'templates/sheet.html',
            controller: 'Sheet'
        }).when('/open', {
            templateUrl: 'templates/open.html',
            controller: 'Open'
        }).otherwise({
            redirectTo: function () {
                return "/open/" + (localStorage.uri || "untitled");
            }
        });
    }
]);

ldss.controller('Sheet', function ($rootScope, $scope, $parse, $routeParams, $window, $location) {
    $scope.new = function () {
        $location.url('/open/untitled');
    };
    $scope.open = function () {
        $location.url('/open');
    };
    $scope.uri = localStorage.uri = $routeParams.uri;
    $window.document.title = "Spreadsheet | " + $scope.uri;

    var i;
    $scope.cols = [];
    for (i = 65; i <= 90 - 13; i++) {
        $scope.cols.push(String.fromCharCode(i));
    }
    $scope.rows = [];
    for (i = 1; i <= 24; i++) {
        $scope.rows.push(i);
    }

    $scope.cells = {};
    $scope.cellerr = {};
    var process = function (expr) {
        if (!expr || !expr.replace) {
            return expr;
        }
        var v = expr.replace(/[A-Z]\d+/g, function (ref) {
            return '_ref("' + ref + '")';
        });
        return v;
    };
    $scope.compute = function (c, r) {
        try {
            $scope.cellerr[c + r] = false;
            return $parse(process($scope.cells[c + r]))($scope);
        } catch (e) {
            $scope.cellerr[c + r] = true;
            return $scope.cells[c + r];
        }
    };
    $scope._ref = function (k) {
        return $parse(process($scope.cells[k]))($scope);
    };
    $scope.addCol = function ($event) {
        $scope.cols.push(String.fromCharCode($scope.cols[$scope.cols.length - 1].charCodeAt(0) + 1));
    };
    $scope.delCol = function ($event) {
        $scope.cols.pop();
    };
    $scope.addRow = function ($event) {
        $scope.rows.push($scope.rows[$scope.rows.length - 1] + 1);
    };
    $scope.delRow = function ($event) {
        $scope.rows.pop();
    };

    $scope._sel = {};
    $scope._focus = {};
    $scope.focus = function (c, r) {
        if (!arguments.length) return;
        $scope._focus.c = c;
        $scope._focus.r = r;
        $scope._sel = {};
    };
    $scope.inputKey = function (c, r, e) {
        $scope._sel.c = c;
        $scope._sel.r = r;
        if (e.keyCode === 13) {
            e.target.blur();
            $scope._focus = {};
        }
    };
    $scope.class = function (c, r, elt) {
        v = "";
        if (c == $scope._focus.c && r == $scope._focus.r) {
            v = "focused";
        } else if (c == $scope._sel.c && r == $scope._sel.r) {
            v = "selected";
        }
        if ($scope.cellerr[c + r]) v += " cellerr";
        return v;
    };
    angular.element($window).on('keydown', function (e) {
        $scope.$apply(function () {
            if (!$scope._focus.c) {
                if (e.keyCode == 37) {
                    $scope._sel.c = String.fromCharCode($scope._sel.c.charCodeAt(0) - 1);
                } else if (e.keyCode == 38) {
                    $scope._sel.r -= 1;
                } else if (e.keyCode == 39) {
                    $scope._sel.c = String.fromCharCode($scope._sel.c.charCodeAt(0) + 1);
                } else if (e.keyCode == 40) {
                    $scope._sel.r += 1;
                }
                if (e.keyCode == 13 && $scope._sel.c) {
                    setTimeout(function () {
                        $('#cell_' + $scope._sel.c + $scope._sel.r).focus();
                    }, 1);
                } else {
                    c = String.fromCharCode(e.keyCode).toUpperCase();
                    if (c == 'O') {
                        $scope.open();
                    }
                }
            }
        });
    });
});

ldss.controller('Open', function ($scope, $http, $location) {
    $scope.cancel = function () {
        $location.url('/');
    };
    $scope.uri = 'https://docs.data.fm/';
    $scope.changeURI = function (uri) {
        if (uri) {
            $scope.uri = uri;
        }
        $scope.treeBrowse();
    };
    $scope.open = function () {
        $location.url('/open/' + $scope.uri);
    };
    $scope.canOpen = function () {
        var m = $scope.uri.match(/[^\/]$/);
        return $scope.uri.split("/").length > 3 && m && m.length;
    };
    $scope.treeOptions = {
        //nodeChildren: "members",
        dirSelectable: false,
        injectClasses: {
            ul: "a1",
            li: "a2",
            iExpanded: "a3",
            iCollapsed: "a4",
            iLeaf: "a5",
            label: "a6"
        }
    };
    $scope.treeData = [];
    $scope.treeBrowse = function () {
        if ($scope.canOpen()) return;
        fetcher = $http.get($scope.uri);
        fetcher.success(function (data, status, headers, config) {
            if ($scope.uri.split("/").length < 4) return;
            var treeData = [];
            members = data[$scope.uri]['http://www.w3.org/2000/01/rdf-schema#member'] || [];
            if ($scope.uri.split("/").length > 4)
                treeData.push({
                    "uri": $scope.uri.replace(/(.*\/)[^\/]+\/$/, "$1"),
                    "label": "../",
                    "class": "tree-folder"
                });
            for (var i = 0; i < members.length; i++) {
                var uri = members[i].value,
                    label = uri.replace(/.*\/([^\/]+)\/?$/, "$1");
                var elt = {
                    "uri": uri,
                    "label": label,
                    "class": "tree-file",
                    "mdate": new Date(1000 * data[uri]['http://www.w3.org/ns/posix/stat#mtime'][0].value)
                };
                if (data[elt.uri]['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'][0].value == 'http://www.w3.org/ns/posix/stat#Directory') {
                    elt.class = "tree-folder";
                }
                treeData.push(elt);
            }
            $scope.treeData = treeData;
        });
    };
    $scope.treeSelect = function (node) {
        $scope.changeURI(node.uri);
    };
    $scope.treeBrowse();
});