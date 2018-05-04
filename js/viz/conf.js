(function(scope) {
	scope.CATEGORY_FACET = 0
	scope.CATEGORY_RESEARCH = 1
	scope.CATEGORY_CHALLENGE = 2
})(window);

/* visualisation conf: window.explore_conf */
(function (scope) {

	var conf = {}

	/* x axis */
	var baseX = d3.scale.ordinal()
		.domain(["challenge", "research"])
		.range([0.05, 0.90])

	/* y axi */
	var baseY = d3.scale.linear()
		.range([0, 1])

	conf.x = (c, p) => baseX(c)
	conf.y = (c, p) => baseY(p)

	/* node color: either yellowish or gray */
	conf.color = d3.scale.ordinal()
		.domain(["challenge", "research"])
		.range(["#BAF", "#FAB"])

	conf.pruneUnused = false

	/* export */
	scope.explore_conf = conf

})(window); // safety
