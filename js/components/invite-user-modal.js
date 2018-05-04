(function (G) {
	//! requires: Awesomplete

	function filter(text, input) {
		return Awesomplete.FILTER_CONTAINS(text, input.match(/[^,]*$/)[0]);
	}
	function update(text) {
		var before = this.input.value.match(/^.+,\s*|/)[0];
		this.input.value = before + text;
	}

	function updateError(modal, error) {
		var existing = modal.querySelectorAll('.modal-complain')
		while (existing.length)
			modal.removeChild(existing.pop())

		var buttons = modal.querySelectorAll('button')
		var lastBtn = buttons[buttons.length - 1]

		var complaint = el('div.modal-complaint', [error])
		lastBtn.parentNode.insertBefore(complaint, lastBtn.nextSibling)
	}

	G.inviteUserModal = function (collectionId, friends) {
		var search = el('input.modal-input-box', {
			type: "text",
			placeholder: "user@email.tld"
		})

		var inviteBtn = el('button#confirm.btn', ['invite'])

		var modal = el('div#modal.modal.appear', [
			el('div', [
				window.modals.closeButton(),
				el("div.modal-header-title", [
					`Invite to #${collectionId}`
				]),
				el("div.modal-divider"),
				search,
				el("div#bottom-divider.modal-divider"),
				inviteBtn, window.modals.cancelButton()
			])
		])

		new Awesomplete(search, {
			list: friends,
			filter: filter,
			replace: update
      	})

		return new Promise(function (F, R) {
			document.body.appendChild(modal)

			inviteBtn.addEventListener('click', evt => {
				var email = search.value
				window.modals.toggleButtonState()
				api.v1.collection.invite(email, collectionId)
					.done(ok => {
						document.body.removeChild(modal)
						F(email)
					}).fail(xhr => {
						window.modals.toggleButtonState()
						updateError(modal, xhr.responseText)
					})
			}, false)

		})
	}

})(window.components || (window.components = {}));

