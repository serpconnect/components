$(function() {
	function $$(id) {
		return document.querySelector(id)
	}
	//hides dataset selector but still needed as page has dependencies on it.
	$$('#dataset').style.display='none'

	/* RIP */
	function showHelpModal() {
		var modal = el('div#modal.modal.appear', [
			el('div.helpbox', [
				el('p', [
					'The visualisation shows ',
					el('span.chl', ['challenges']),
					' (left) and ',
					el('span.res', ['research']),
					' (right) as nodes with their classifications',
					' according to the taxonomy (center) as edges.'
				]),
				el('p', ['Interact with the visualisation by clicking on nodes:']),
				el('ul', [
					el('li', [el('span.chl', ['challenge']), ' - show matching ', el('span.res', ['research'])]),
					el('li', [el('span.res', ['research']), ' - show matching ', el('span.chl', ['challenge'])]),
					el('li', ['taxonomy - filter ', el('span.chl', ['challenge']), ' and ', el('span.res', ['research'])]),
					el('li', ['taxonomy - double click: show sub facets']),
					el('li', ['taxonomy - right click: hide this level'])
				]),
				el('p', [
					'Only one ', el('span.chl', ['challenge']),
					' or ', el('span.res', ['research']),
					' node can be active at a given time.'
				]),
				el('p', ['Click on nodes to remove the selection.']),
				el('p', [
					'In the matches list, the color indicates entry type: ',
					el('span.chl', ['challenge']), ' or ',
					el('span.res', ['research']),
				]),
				el('p', [
					'When filtering by ',
					el('span.chl', ['challenge']), ' or ',
					el('span.res', ['research']),
					' there are three cases of matching:',
				]),
				el('ul', [
					el('li', ['Effect', el('i', [' and ']), 'Scope -- complete match, node retains color']),
					el('li', ['Effect', el('i', [' or ']), 'Scope -- ',
						el('span.inc', ['incomplete']),
						' match, node changes color'
					]),
					el('li', ['No match -- node is hidden'])
				]),
				el('p', ['Click', el('button', ['Reset']), 'to remove all filters.']),
				el('p', ['Login to explore your own collections.'])
			])
		])

		document.body.appendChild(modal)
	}

	function stopMenu(evt) {
		evt.preventDefault()
		return false
	}

	var instance = undefined,
		ctrl = undefined,
		list = undefined,
		serpTaxonomy = undefined,
		serpExtension = undefined,
		currentDataset = undefined,
		currentTaxonomy = new Taxonomy([]),
		currentExtension = undefined

	function explore(taxonomy, extended, dataset, into, options) {
		var graph = window.graph(taxonomy, extended, dataset, window.explore_conf)
		if (instance) {
			list.changeDataset(dataset)
			instance.graph.clear()
			instance.graph.read(graph)

			var reapplyFilter = options && options.reapplyFilters
			ctrl.reset(!reapplyFilter)
			ctrl.useTaxonomy(serpExtension || serpTaxonomy)

			if (reapplyFilter)
				ctrl.reapply()

			instance.refresh()
		} else {
			instance = new sigma({
				renderer: {
					container: into,
					type: 'canvas'
				},
				graph: graph,
				settings: {
					// edge color = facet color
					edgeColor: 'target',
					// disable double-click-to-zoom
					doubleClickEnabled: false,
					labelThreshold: 4,
					zoomingRatio: 1.2
				}
			})

			ctrl = new window.controls(instance)
			ctrl.useTaxonomy(serpTaxonomy)
			ctrl.bind('collapse', collapseTaxnonomyFacet)
			ctrl.bind('expand', expandTaxnonomyFacet)
			ctrl.bind('select', updateEntryPosition)
			ctrl.bind('deselect', updateEntryPosition)
			list = new window.listing($$('#listing'), instance, dataset)
			list.registerEvents(ctrl)

			document.getElementById('reset')
				.addEventListener('click', resetTaxonomy, false)

			into.querySelector('.sigma-mouse').addEventListener('contextmenu', stopMenu, false)
			into.querySelector('.sigma-scene').addEventListener('contextmenu', stopMenu, false)
			into.addEventListener('contextmenu', stopMenu, false)
		}
	}

	function updateEntryPosition() {
		var challenges = []
		var research = []
		var nodes = instance.graph.nodes()

		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i]
			if (node.hidden) continue
			if (node.category === CATEGORY_RESEARCH)
				research.push(node)
			else if (node.category === CATEGORY_CHALLENGE)
				challenges.push(node)
		}

		var conf = window.explore_conf
		var current = 0
		var max = Math.max(1, research.length - 1)
		for (var i = 0; i < research.length; i++) {
			var node = research[i]
			node.x = conf.x("research", 0)
			node.y = conf.y("", current / max)
			current += 1
		}

		current = 0
		max = Math.max(1, challenges.length-1)
		for (var i = 0; i < challenges.length; i++) {
			var node = challenges[i]
			node.x = conf.x("challenge", 0)
			node.y = conf.y("", current / max)
			current += 1
		}

		instance.refresh()
	}

	function resetTaxonomy(evt) {
		var hasCollection = window.location.hash.length > 0
		if (hasCollection) {
			var collectionId = window.location.hash.substring(1)
			$$('#dataset').value = collectionId
			Dataset.loadCollection(collectionId, exploreSet)
		} else
			Dataset.loadDefault(exploreSet)

		explore(serpTaxonomy,
				serpExtension,
				currentDataset,
				$$('#graph'), {
					reapplyFilters: false
				})
	}

	function collapseTaxnonomyFacet(facet) {
		var base = currentTaxonomy
		var extended = (currentExtension || serpTaxonomy).tree()

		/* Everything in the currentTaxonomy is shown as facets, so
		we can move this facet to the extended set directly. */
		var parent = base.root.dfs(base.root.dfs(facet).parentId())
		var parentOfParent = base.root.dfs(parent.parentId())

		/* should never happen(tm) */
		if (!parentOfParent) {
			return
		}

		var exists = extended.dfs(parent.id())
		if (exists) {
			var extParent = extended.dfs(parent.id())
			for (var i = 0; i < parent.tree.length; i++) {
				var child = parent.tree[i]
				if (!extParent.dfs(child.id()))
					extParent.addChild(child)
			}
		}
		parent.tree = []

		currentExtension = new Taxonomy()
		currentExtension.tree(extended)

		refreshGraph()
	}

	function expandTaxnonomyFacet(facet) {
		var base = currentTaxonomy
		var extended = (currentExtension || serpTaxonomy).tree()

		var node = base.root.dfs(facet)

		/* should never happen(tm) */
		if (!node) {
			return
		}

		var nodex = extended.dfs(facet)
		if (nodex) {
			for (var i = 0; i < nodex.tree.length; i++) {
				var child = nodex.tree[i]
				if (!node.dfs(child.id())) {
					var copy = new FacetNode(child.id(), child.name(), [])
					node.addChild(copy)
				}
			}
		}

		currentExtension = new Taxonomy()
		currentExtension.tree(extended)

		refreshGraph()
	}

	function exploreSet(set, taxonomy) {
		var extended = undefined
		currentDataset = set
		serpExtension = currentExtension = undefined
		if (taxonomy) {
			extended = new Taxonomy([])
			extended.tree(serpTaxonomy.tree())
			extended.extend(taxonomy)
			serpExtension = currentExtension = extended
		}
		currentTaxonomy.tree(serpTaxonomy.tree())
		// Only remove facets if there are nodes in the dataset; it looks weird
		// if graph is totally empty...
		window.explore_conf.pruneUnused = set.nodes().length !== 0
		explore(serpTaxonomy, extended, set, $$('#graph'))
	}

	function refreshGraph() {
		explore(currentTaxonomy,
				currentExtension,
				currentDataset,
				$$('#graph'), {
					reapplyFilters: true
				})
	}

	$$('#explore').classList.add('current-view')
	$$('#help').addEventListener('click', showHelpModal, false)

	var hasCollection = window.location.hash.length > 0
	var collectionId = hasCollection ? window.location.hash.substring(1) : ""
	var found = false

	api.v1.taxonomy()
		.then(data => new Taxonomy(data.taxonomy))
		.then(taxonomy => serpTaxonomy = taxonomy)
		.then(() => api.v1.account.collections())
		.done(collz => {
			var selector = $$('#dataset')

			collz.forEach(coll => {
				var opt = document.createElement('option')
				opt.setAttribute('value', coll.id)
				opt.text = coll.name
				selector.appendChild(opt)
				if (coll.id === Number(collectionId))
					found = true
			})

		})
		.always(xhr => {
			if (!found && hasCollection) {
				var opt = document.createElement('option')
				opt.setAttribute('value', collectionId)
				opt.text = "#" + collectionId
				$$('#dataset').appendChild(opt)
			}

			if (hasCollection) {
				$$('#dataset').value = collectionId
				Dataset.loadCollection(collectionId, exploreSet)
			} else
				Dataset.loadDefault(exploreSet)
		})

	$$('#dataset').addEventListener('change', function (evt) {
		if (this.value === "main") {
            window.location.hash = ""
			Dataset.loadDefault(exploreSet)
        } else {
            window.location.hash = '#' + this.value
			Dataset.loadCollection(this.value, exploreSet)
        }
	})

})