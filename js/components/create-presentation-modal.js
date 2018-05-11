(function (G) {

	function updateError(modal, error) {
		var existing = modal.querySelectorAll('.modal-complain')
		while (existing.length)
			modal.removeChild(existing.pop())

		var buttons = modal.querySelectorAll('button')
		var lastBtn = buttons[buttons.length - 1]

		var complaint = el('div.modal-complaint', [error])
		lastBtn.parentNode.insertBefore(complaint, lastBtn.nextSibling)
	}

	G.createPresentationModal = function (CID,colName) {
		var create = el('button#confirm.btn', ['create'])
		var copyBtn = el('button#copy.btn', ['copy link'])
		var collectionDesc = el('textarea.submit-input-box', {
			placeholder: 'detailed description/ introduction for collection'
		})
		var url = window.location.origin + "/presentation#" + CID

		var shareableLink = el('input#link.submit-input-box', {
			value: url,
			readonly:true
		}) 
		console.log(shareableLink)
		var modal = el('div#modalConf.modal', [
			el('div', [
				window.modals.closeButton(),
				el("h1.text-title", ['Create presentation for Collection: ' + colName]),
				el('div.modal-divider'),
				el('div.modal-container',[
					el("h3.modal-header-title", ['Update description of presentation']),
					el('div', [collectionDesc])
				]),
				el('div.modal-container',[
					el("h3.modal-header-title",['shareable link']),
					el("div.proj-ui-btn-wrapper", [
						shareableLink,
						copyBtn
					]),
				]),
				el("div#bottom-divider.modal-divider"),
				el("div.proj-ui-btn-wrapper", [
					create,
					window.modals.cancelButton()
				])
			])
		])

		copyBtn.addEventListener('click', evt => {
			shareableLink.select()
			document.execCommand("Copy");
			setTimeout(function(){ window.getSelection().removeAllRanges() }, 200);
		})
		return new Promise(function (F, R) {
			create.addEventListener('click', evt => {
				window.open(url)
				document.body.removeChild(modal)
				/*if (!collectionDesc.value) {
					updateError(modal, "Must provide a description")
					return
				}

				window.modals.toggleButtonState()
				api.v1.collection.presentationDesc(collectionDesc.value)
                	.done(data => {
                		document.body.removeChild(modal)
                		F({
	                		id: data.id,
                		})
                	})
	                .fail(xhr => {
	                	window.modals.toggleButtonState()
						updateError(modal, xhr.responseText)
					})
				*/
			})

			document.body.appendChild(modal)
			window.modals.appear(modal)
		})
	}
})(window.components || (window.components = {}));