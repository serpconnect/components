$(document).ready(function() {
    $("#home").addClass("current-view");

    Dataset.loadDefault(data => {
		api.v1.taxonomy().then(serp => {
			var taxonomy = new window.Taxonomy(serp.taxonomy)
			window.overview.renderGraph('#taxonomy', data, taxonomy)
		})
	})
})

