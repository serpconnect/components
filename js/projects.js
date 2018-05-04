$(function() {
	var user_data = undefined
	var all_projects = []

	document.getElementById('projects').classList.add('current-view')

	function delete_project(evt) {
		var row = this.parentNode.parentNode // tr > td > btn
		var project = all_projects[parseInt(row.dataset.projectIdx)]
		api.v1.project.delete(project.name).then(reload)
	}

	function edit_project(evt) {
		var row = this.parentNode.parentNode // tr > td > btn
		var project = all_projects[parseInt(row.dataset.projectIdx)]
		window.components.editProjectModal(project).then(reload)
	}

	function create_new_project(evt) {
		window.components.createProjectModal().then(reload)
	}

	function create_project_row(project, is_admin, is_owner) {
		var delete_btn = el('button.btn.tiny', ['delete'])
		delete_btn.addEventListener('click', delete_project, false)

		var edit_btn = el('button.btn.tiny', ['edit'])
		edit_btn.addEventListener('click', edit_project, false)

		all_projects.push(project)

		return el('tr', { 'data-project-idx': all_projects.length - 1 }, [
			el('td', [project.name]),
			el('td', [
				el('a.link', {href:project.link},
					[project.link])
			]),
			el('td', [
				(is_owner || is_admin) ? edit_btn : undefined,
				is_admin ? delete_btn : undefined,
			])

		])
	}

	function load_projects() {
		var is_admin = user_data.trust === 'Admin'

		api.v1.project.all().then(data => {
			var projects = data.projects

			// Filter out projects user has created; we add them separately
			projects = projects.filter(project => {
				for (var i = 0; i < user_data.projects.length; i++)
					if (user_data.projects[i].name === project.name)
						return false
				return true
			})

			var tbody = document.querySelector('#projects-list > tbody')
			for (var i = 0; i < user_data.projects.length; i++) {
				var project = user_data.projects[i]
				tbody.appendChild(create_project_row(project, is_admin, true))
			}

			for (var i = 0; i < projects.length; i++) {
				var project = projects[i]
				tbody.appendChild(create_project_row(project, is_admin, false))
			}
		})
	}

	function reload() {
		var tbody = document.querySelector('#projects-list > tbody')
		while (tbody.firstChild)
			tbody.removeChild(tbody.firstChild)

		all_projects = []
		api.v1.account.projects().done(projects => {
			user_data.projects = projects
		}).fail(xhr => {
			user_data.projects = []
		}).always(() => {
			load_projects()
		})
	}

	api.v1.account.self().catch(xhr => ({
		err: xhr.responseText
	})).then(self => {
		var box = document.getElementById('msg-box')

		var trustLevels = {
			'Admin': 'You have admin privileges and can create & delete projects.',
			'Verified': 'You are a verified user and can create new projects.',
		}

		var trust = trustLevels[self.trust]
		if (self.err)
			trust = self.err

		box.appendChild(el('p', [trust]))

		var is_admin = self.trust === 'Admin'
		var is_verified = self.trust === 'Verified' || is_admin

		if (is_verified) {
			var create_btn = el('button#create.btn', ['create project'])
			create_btn.addEventListener('click', create_new_project, false)
			box.appendChild(create_btn)
		}

		user_data = self
		reload()
	})

})