$(document).ready(function() {
    $("#project").addClass("current-view");
    var currentTree = undefined
    var querystring = {}
    /* Naive querystring ?a=1&b=c --> {a:1, b:'c'} mapping */
    if (window.location.search) {
        var params = window.location.search.substring(1).split('&')
        for (var i = 0; i < params.length; i++) {
            var split = params[i].indexOf('=')
            var name = params[i].substring(0, split)
            var value = params[i].substring(split + 1)

            querystring[name] = value
        }
    }
    $("#matches").click(evt => {
        Dataset.loadDefault(setUpMap)
    })

    function setUpMap(set) {
        window.components.taxonomyLayoutModal(set,currentTree)
    }
    
	Dataset.loadDefault(data => {
	    if (!querystring.p) return
		api.v1.project.taxonomy(querystring.p).then(serp => {
			var baseTaxonomyData = serp
            var taxonomy = new window.Taxonomy(serp.taxonomy)
            currentTree = taxonomy
			window.project.renderGraph('#taxonomy', data, taxonomy, taxonomy.root,[baseTaxonomyData])
		})
	})

})
