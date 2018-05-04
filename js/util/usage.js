(function (scope) {
	/* Returns a flattened SERP object where each key points to its usage */
	function computeUsage(dataset, taxonomy) {
		var facets = {}
		var unique_facets = {}
		var edges = dataset.edges ? dataset.edges() : dataset

		/* Accumulate edges for each facet, but only count edges/facet once per
		 * node, i.e count multiple context edges for the same node as 1 edge.
		 */
		edges.forEach(edge => {
			var type = edge.type.toLowerCase()
			var node = edge.source

			if (!unique_facets[type])
				unique_facets[type] = []

			if (unique_facets[type].indexOf(node) !== -1)
				return

			unique_facets[type].push(node)

			if (!facets[type])
				facets[type] = 1
			else
				facets[type] += 1
		})


		taxonomy.tree().map(function calc(node) {
			var id = node.id().toLowerCase()

			if (node.tree.length === 0 || facets[id] > 0) {
				if (!facets[id]) facets[id] = 0
				return facets[id] || 0
			}

			var sum = 0
			for (var i = 0; i < node.tree.length; i++) {
				sum += calc(node.tree[i])
			}
			facets[id] = sum
			return sum
		})

		return facets
	}
	scope.computeUsage = computeUsage
})((window.util = window.util || {}))