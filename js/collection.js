$(function () {
	var isOwner;
	var toProfilePage = () => window.location = "/profile.html"

	// Only allow user to inspect specific collection
	if (window.location.hash.length === 0)
		toProfilePage()

	// http://serpconnect.cs.lth.se/collection.html#33 => 33
	var cID = window.location.hash.substring(1)

	function updateLink(el) {
		el.setAttribute('href', `${el.getAttribute('href')}#${cID}`)
	}

	['general', 'users','taxonomy-tab', 'entries'].forEach(id => updateLink(document.getElementById(id)))

	window.api.v1.account.collections()
		.then(collections => {
      		return collections.filter(collection => {
        		return collection.id === Number(cID)
      		}).pop()
    }).then(collection => {
		if (!collection) throw new Error("You are not a member of this collection")
		setupName(collection)
		$('#taxonomy-extension').text('extend taxonomy for collection: ' + collection.name)
		return api.v1.collection.isOwner(collection.id)
    }).then(owner =>{
		isOwner=owner;
		$('#owner').text(owner ? " (owner)" : "")
		$('#leave').text(owner ? "delete collection" : "leave collection")
    }).fail(reason => {
		window.alert(reason)
	})

	window.api.v1.collection.stats(cID)
		.done(setupStats)
		.fail(toProfilePage)

	function setupName(collection) {
		$('#name').text(collection.name)
		$('#id').text(collection.id)
		$('#taxonomyID').text('The ' + collection.name + ' Taxonomy')
	}

	function getCollectionName(){
		return $('#name').innerText
	}

	/* X member(s), Y entr(y|ies) */
    function formatStats(members, entries) {
        var mems = members === 1 ? "member" : "members"
        var entr = entries === 1 ? "entry" : "entries"

        return `${members} ${mems}, ${entries} ${entr}`
    }

	function setupStats(stats) {
		$('.collection-stats').text(formatStats(stats.members, stats.entries))
	}

    // Create leave collection modal
	document.getElementById('leave').addEventListener('click', (evt) => {
		window.components.leaveCollectionModal(cID, isOwner)
			.then(toProfilePage)
  }, false)

	document.getElementById('export').addEventListener('click', (evt) => {
		var cName = document.getElementById("name").innerText;
		window.export.toFile(cID, cName);
	}, false)

	document.getElementById('presentation').addEventListener('click', (evt) => {
        window.components.createPresentationModal(cID,document.getElementById("name").innerText)
        //window.location = window.location.origin + "/presentation.html#" + cID
    })

	$("#profile").addClass("current-view");
	 
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
