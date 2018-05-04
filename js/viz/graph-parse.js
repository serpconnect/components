(function(scope) {

	function unique_edges() {
		var edges = {}
		return function(edge) {
			if (!edge) return false
			var id = `${edge.source}--${edge.type}--${edge.target}`
			if (edges[id])
				return false
			edges[id] = true
			return true
		}
	}

	/* Connect an entry node with a facet node */
	function process_edge(edge) {
		return {
			id: `${edge.source}--${edge.type}--${edge.target}`,
			source: edge.source + "",
			target: edge.type,
			type: 'curve'
		}
	}

	function rewrite(taxonomy, extended) {
		return function(edge) {
			var node = taxonomy.root.dfs(edge.type)

			if (node)
				return edge

			if (!extended)
				return undefined

			function dfs(parent, node, search) {
				if (node.id().toLowerCase() === search.toLowerCase())
					return parent

				for (var i = 0; i < node.tree.length; i++) {
					var found = dfs(node, node.tree[i], search)
					if (found)
						return found
				}

				return undefined
			}

			var facet = edge.type
			var fails = 100
			do {
				var parent = undefined
				for (var i = 0; i < extended.root.tree.length; i++) {
					var found = dfs(extended.root, extended.root.tree[i], facet)
					if (found) {
						parent = found
						break;
					}
				}

				if (!parent)
					return undefined

				/* TODO: Notify user about failure */
				if (fails-- < 0) {
					console.error('Failed to rewrite edge', edge.type, 'from extended taxonomy', extended)
					return undefined
				}

				facet = parent.id()
			} while (!taxonomy.root.dfs(facet))

			return {
				source: edge.source,
				target: edge.target,
				type: facet
			}
		}
	}

	/* construct a node
	 *	node: the graph node
	 *	current: current index, out of max
	 *	max: maximum index
	 *	links: number of edges
	 *	conf: explore_conf that provides d3-scales
	 */
	function process_entry(node, current, max, links, conf) {
		return {
			id: String(node.id),
			revid: (node.type === "challenge" ? 'c' : 'r') + current,
			label: String(node.id),
			x: conf.x(node.type, current / Math.max(max - 1, 1)),
			y: conf.y(node.type, current / Math.max(max - 1, 1)),
			size: 4,
			color: conf.color(node.type),
			category: node.type === "challenge" ?
				CATEGORY_CHALLENGE : CATEGORY_RESEARCH
		}
	}

	function compute_weight(node, facets) {
		var facet = facets[node.short.toLowerCase()]
		if (!facet) { return 0 }
		if (facet.weight) return facet.weight

		var sum = 0
		for (var i = 0; i < node.tree.length; i++) {
			sum += compute_weight(node.tree[i], facets)
		}

		sum = Math.max(sum, 1)
		for (var i = 0; i < node.tree.length; i++) {
			var child = facets[node.tree[i].short.toLowerCase()]
			if (!child) continue
			child.weight = child.weight / sum
		}

		facet.weight = sum
		return sum
	}
	function compute_segment_size(node, facets, segment, depth) {
		var facet = facets[node.short.toLowerCase()]
		if (!facet) return
		var zoomFactor = depth > 0 ? 1 - Math.pow(0.2, depth) : 1
		facet.segmentSize = facet.weight * segment * zoomFactor
		for (var i = 0; i < node.tree.length; i++) {
			compute_segment_size(node.tree[i], facets, facet.segmentSize, depth+1)
		}
	}
	function compute_offset(node, facets, offset) {
		var facet = facets[node.short.toLowerCase()]
		if (!facet) return
		facet.offset = offset

		offset = offset
		for (var i = 0; i < node.tree.length; i++) {
			var child = facets[node.tree[i].short.toLowerCase()]
			if (!child) continue
			var size = child.segmentSize //child.weight * facet.segmentSize
			compute_offset(node.tree[i], facets, offset)
			offset += size
		}
	}

	function graph(taxonomy, extendedTaxonomy, data, conf) {
		var rewrittenEdges = data.edges()
			.map(rewrite(taxonomy, extendedTaxonomy))
			.filter(e => e)
		var edges = rewrittenEdges
			.filter(unique_edges())
			.map(e => process_edge(e))
			.filter(e => e && e.target && e.source && e.type)
			.filter(e => {
				var node = taxonomy.root.dfs(e.target)
				return node && node.isTreeLeaf()
			})

		var rc = 0, cc = 0,
			maxr = data.research().length,
			maxc = data.challenges().length

		var nodes = data.nodes().map((node) => {
			var c = node.type === "challenge" ? (cc++) : (rc++)
			var m = node.type === "challenge" ? (maxc) : (maxr)
			var links = edges.filter((edge) => {
				return edge.source == node.id || edge.target === node.id
			})
			return process_entry(node, c, m, links.length, conf)
		})

		var colors = window.util.colorScheme(extendedTaxonomy || taxonomy)
		var usage = window.util.computeUsage(rewrittenEdges, extendedTaxonomy || taxonomy)

		var add_facet_node = function(name, id, y) {
			nodes.push({
				id: id.toUpperCase(),
				x: 0.5,
				y: y,
				size: 8,
				label: name,
				color: colors(id)((usage[id]+0.0) / data.nodes().length),
				category: 0,
				//children: (extendedTaxonomy.root.dfs(name).tree.length > 0
			})
		}

		var facets = {
			root: {
				segmentSize: 0,
				offset: 0
			}
		}

		taxonomy.tree().map(function initWeight(node, i) {
			facets[node.id().toLowerCase()] = {
				segmentSize: 0,
				offset: 0
			}
			node.map(initWeight)
		})

		if (conf.pruneUnused) {
			taxonomy.root.map(function remove_unused(node, i) {
				if (!usage[node.id().toLowerCase()] && node.isTreeLeaf())
					delete facets[node.id().toLowerCase()]
				node.map(remove_unused)
			})
		}

		compute_weight(taxonomy.root, facets)
		/* tighten the segment sizes so that facets appear clustered */
		facets.root.weight = 1
		compute_segment_size(taxonomy.root, facets, 1.3, 0)
		compute_offset(taxonomy.root, facets, 0)

		taxonomy.tree().mapP(function add(parent, node, i) {
			if (!node.isTreeLeaf())
				return node.mapP(add)

			var facet = facets[node.id().toLowerCase()]
			if (facet)
				add_facet_node(node.name(),
					node.id().toLowerCase(),
					facet.offset + facet.segmentSize * 0.5)
		})
		console.log(taxonomy, facets)

		return {
			nodes: nodes,
			edges: edges
		}
	}

	scope.graph = graph
})(window);
