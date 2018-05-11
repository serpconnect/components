$(document).ready(function() {
    $("#overview").addClass("current-view");
    var cID = window.location.hash.substring(1)
    
    $("#taxonomy-label").text('Taxonomy for Collection ' )

    window.api.v1.account.collections()
		.then(collections => {
      		return collections.filter(collection => {
        		return collection.id === Number(cID)
      		}).pop()
    }).then(collection => {
		if (!collection) throw new Error("You are not a member of this collection")
		setupName(collection)
		return api.v1.collection.isOwner(collection.id)
    }).fail(reason => {
		console.log(reason)
	})
	function setupName(collection) {
		$('#name').text(collection.name)
		$('#id').text(collection.id)
		$("#taxonomy_label").text('Taxonomy for collection: ' + collection.name )
	}


    Dataset.loadDefault(data => {
		var baseSerp
		if (!cID) return
		api.v1.taxonomy().then(serp => {
			baseSerp = serp
		})
		api.v1.collection.taxonomy(cID).then(serpExt => {
			var taxonomy = new window.Taxonomy(baseSerp.taxonomy)
 			taxonomy.extend(serpExt.taxonomy)
			window.overview.renderGraph('#taxonomy', data, taxonomy)
		})
	})
})