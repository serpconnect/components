$(document).ready(function() {
	var x = document.getElementById('presentation-description')
	var cID = window.location.hash.substring(1)
	document.getElementById('logo-link').href = "/presentation#" + cID
	document.getElementById('overview').href = "/presentation#" + cID
	document.getElementById('search').href = "/presentation/search.html#" + cID
	document.getElementById('explore').href = "/presentation/explore.html#" + cID

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
	}

})
