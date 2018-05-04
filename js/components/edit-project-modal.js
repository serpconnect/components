(function (G) {

	function updateError(modal, error) {
		var existing = modal.querySelectorAll('.modal-complaint')
		for (var i = 0; i < existing.length; i++)
			existing[i].parentNode.removeChild(existing[i])

		var buttons = modal.querySelectorAll('button')
		var lastBtn = buttons[buttons.length - 1]

		var complaint = el('div.modal-complaint', [error])
		lastBtn.parentNode.insertBefore(complaint, lastBtn.nextSibling)
	}

	G.editProjectModal = function (project) {
		var update = el('button#confirm.btn', ['update'])
		var projectName = el('input.modal-input-box', {
			value: project.name
		})

		var edit_taxonomy_btn = el('button.btn', ['edit taxonomy'])

		var projectLink = el('input.modal-input-box', {
			value: project.link
		})

		var modal = el('div#modalConf.modal.confirm', [
			el('div', [
				window.modals.closeButton(),
				el("div.modal-header-title", ['Edit project']),
				el('div.modal-divider'),
				el('div', [
					el('label.w-3em', ['name']),
					projectName
				]),
				el('div', [
					el('label.w-3em', ['link']),
					projectLink,
				]),
				el('div.modal-divider'),
				edit_taxonomy_btn,
				el("div#bottom-divider.modal-divider"),
				update,
				window.modals.cancelButton()
			])
		])
		return new Promise(function (F, R) {
			edit_taxonomy_btn.addEventListener('click', evt => {
				window.location = "/project.html?p=" + project.name
			})

			update.addEventListener('click', evt => {
				var updatedNameOrLink = {}
				updateNameOrLink = false

				if (projectName.value !== project.name) {
					updatedNameOrLink.name = projectName.value
				}

				if (projectLink.value !== project.link) {
					updatedNameOrLink.link = projectLink.value
				}

				var updateNameOrLink = Object.keys(updatedNameOrLink).length > 0
				if (!updateNameOrLink) {
					updateError(modal, "Nothing to update")
					return
				}

				window.modals.toggleButtonState()
				api.v1.project.update(project.name, updatedNameOrLink)
					.done(() => {
						document.body.removeChild(modal)
						F()
					}).fail(xhr => {
						updateError(modal, xhr.responseText)
					}).always(window.modals.toggleButtonState())
			})

			document.body.appendChild(modal)
			window.modals.appear(modal)
		})
	}

})(window.components || (window.components = {}));