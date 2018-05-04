(function (scope) {
	/* Convert the dataset into a tree structure and compute sizes so that the
	 * graph partitions end up equally large. Do this by propagating the current
	 * size and divide it up amongst the children, recursively.
	 */
	function treeify(root, len) {
		return {
			name: 'root',
			size: 1.0,
			usage: len,
			children: recurseTree(root, 1.0)
		}
	}
	function recurseTree(parentNode, parentSize) {
		var children = []

		var size = parentSize / parentNode.tree.length
		for (var i = 0; i < parentNode.tree.length; i++) {
			var node = parentNode.tree[i]

			var entry = {
				name: node.id().toLowerCase(),
				full: node.name(),
				size: size,
				usage: node.usage
			}

			var subtree = recurseTree(node, size)
			if (subtree)
				entry.children = subtree

			children.push(entry)
		}

		return children
	}
	scope.treeify = treeify
})((window.util = window.util || {}))