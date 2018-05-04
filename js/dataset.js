function Dataset(blob) {
	blob = blob || { nodes: [], edges: [] }

	this._source = blob
	this._research = blob && blob.nodes.filter(e => e.type.toLowerCase() === 'research')
	this._challenges = blob && blob.nodes.filter(e => e.type.toLowerCase() === 'challenge')
	this._edges = blob && blob.edges
}

Dataset.prototype.edges = function() {
	return this._edges
}

Dataset.prototype.nodes = function() {
	return this._source.nodes
}

Dataset.prototype.filter = function(et) {
	var nodes = this._source.nodes.filter(n => n.type.toLowerCase() === et)
	var ids = nodes.map(n => n.id)
	var edges = this._source.edges.filter(e => ids.indexOf(e.source) !== -1)

	return new Dataset({
		nodes: nodes,
		edges: edges
	})
}

/* Returns the research entries; Actual list -- not a copy */
Dataset.prototype.research = function() {
	return this._research
}

/* Returns the challenge entries; Actual list -- not a copy */
Dataset.prototype.challenges = function() {
	return this._challenges
}

/* Returns all entries; Actual list -- not a copy */
Dataset.prototype.entries = function() {
	return this._source
}

/* cb = fn(dataset) */
Dataset.loadQuery = function(query, cb) {
	throw new Error("NYI")
}
Dataset.loadCollection = function(id, cb) {
	Promise.all([
		window.api.ajax("GET", window.api.host + "/v1/collection/" + id + "/graph"),
		api.v1.collection.taxonomy(id)
	]).then(promise => {
		var dataset = new Dataset(promise[0])
		var taxonomy = promise[1].taxonomy

		cb(dataset, taxonomy)
	})
}
Dataset.loadDefault = function(cb) {
	if (Dataset.default) {
		cb(Dataset.default)
		return
	}

	api.v1.entry.all()
	 .then(function (data) {
	 	Dataset.default = new Dataset(data)
	 	cb(Dataset.default)
	 })
}