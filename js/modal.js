$(document).ready(function() {
	function toggleButtonState() {
        var btns = document.querySelectorAll('.btn')
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('submit-disabled')
            if (btns[i].getAttribute('disabled'))
                btns[i].removeAttribute('disabled')
            else
                btns[i].setAttribute('disabled', true)
        }
    }

	var modals = window.modals = {}
	var modalAnimation = 121

	modals.toggleButtonState = toggleButtonState
	//slides modal onto screen
	modals.appear = function(element){
		setTimeout(function(){
 				  element.classList.add('appear');
 	      }, modalAnimation)
	}

	function insertAfter(referenceNode,newNode){
		referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
	} //inserts a Node after a Node

	function shrinkFacets(current, parent){
		var p_style = parent.style
		var c_style = current.style
		c_style.marginLeft= p_style.marginLeft + "5%"
		c_style.marginRight= p_style.marginRight+ "5%"
		c_style.width = p_style.width - "5%"
	} //Creates a subfacet (a la search page) so
	// that the subfacets shrunk versions of their parents

	function appendChildren (par,list){
			for(var i=0;i<list.length;i++){
				par.appendChild(list[i])
			}
		}
	//appends a list of children to a node

    function findModal(node) {
        if (node.classList.contains('modal') ||
            node.classList.contains('confirm'))
            return node
        else if (node.classList.contains('dyn-modal'))
        	return node
        else
            return findModal(node.parentNode)
    }

    function removeModal(evt) {
        // Close button is located in: div > div > closeBtn
        // but we cannot be sure of this, so loop upwards
        // until we find parent that is a modal.

        var modal = findModal(this.parentNode)
        document.body.removeChild(modal)
    }

    modals.closeButton = closeButton
    function closeButton() {
        var btn = el('div.close-btn', [''])
        btn.addEventListener('click', removeModal, false)
        return btn
    }

    modals.cancelButton = cancelButton
    function cancelButton() {
        var btn = el('button.btn', ['cancel'])
        btn.addEventListener('click', removeModal, false)
        return btn
    }

	modals.exportModal = function(selectedEntries, collections) {
       	var options = []
       	var index = Object.keys(collections)
       	var editBtn = el('div.edit-btn', ['use existing'])
       	var createBtn = el('div.edit-btn', ['create new'])
       	var input = el("input#exportInput.large-input", {
			placeholder: 'new collection name',
			type: 'text',
			name: 'input'
		})

       	var select = el("select#exportSelect", [
			index.map(idx => el("option", {
				value: collections[idx].id,
				name: collections[idx].name,
				text: collections[idx].name
			}))
		])

		var modal = el('div#modal.modal', [
			el('div', [
				el('div.modal-entry-type', ['export entries (' + selectedEntries.length + ')']),
				closeButton(),
				el('div.modal-header-title', ['select collection']),
				el("div.modal-divider"),
				input,
				createBtn,
				el("div.modal-divider"),
				select, editBtn
			])
		])

		function submitToCollection(cID) {
            var url = window.api.v1.collection.url(cID)
            selectedEntries.forEach(eID => {
				window.api.ajax("POST", url, { entryId: eID })
            })
            document.body.removeChild(modal)
        }

		createBtn.addEventListener('click', (evt) => {
		  	window.user.createCollection($('#exportInput').val())
               .done(cID => {
                submitToCollection(cID.id)
            })
	    })

		editBtn.addEventListener('click', (evt) => {
		    submitToCollection($('#exportSelect').val())
	    })

        document.body.appendChild(modal)
		modals.appear(modal)
	}

	/* Inspect facets modal */
	modals.infoModal = function(facet, unique) {
		var facets = unique.map(uniq => el("li.modal-li", [uniq]))

		var modal = el('div#modal.modal', [
			el('div', [
				el('div.modal-entry-type', ['inspecting entities']),
				closeButton(),
				el('div.modal-header-title', [facet]),
				el("div.modal-divider"),
				el('ul.modal-ul'),
				facets,
				el('ul.modal-ul')
			])
		])

        document.body.appendChild(modal)
        modals.appear(modal)
	 }

	 modals.addTextBox = function(method) {
	 	var inputboxes =
			[el('input#inputBox0.modal-input-box', {
					name: "input0",
					type: "text",
					placeholder: "short identifier for subfacet.."
			}),
			el('input#inputBox1.modal-input-box', {
				name: "input1",
				type: "text",
				placeholder: "full title for subfacet.."
			})]

		var confirmBtn = el('button#confirm.btn', ['confirm'])

		var modal = el('div#modal.modal.textBox.appear', [
			el('div#centerTextBox', [
				closeButton(),
				el("div.modal-header-title", ["add subfacet to "] ),
				el("div#bottom-divider.modal-small-divider"),
				inputboxes,
				el("div#bottom-divider.modal-small-divider"),
				confirmBtn, cancelButton()
			])
		])

		confirmBtn.addEventListener('click', (evt)=> {
			var args = inputboxes.map(input => input.value)
            method.apply(modal, args)
		})

		document.body.appendChild(modal)
	}
	
	/**
	 * Create a modal that displays contents of an entry & an edit button.
	 *
	 * @param {object} entry 	straight from the API
	 * @param {object} taxonomy also straight from the API
	 * @param {object} options 	configure some stuff
	 *
	 * options.button = [buttonEl, ..., buttonEl]
	 *     - button elements are added after the edit button
	 * */
	modals.entryModal = function(CID, entry, taxonomy, options) {
        var classification = new Promise((resolve, reject) => {
            api.v1.entry.collection(entry.id).then(coll => {
                return Promise.all([
                    api.v1.taxonomy(),
                    api.v1.collection.taxonomy(coll.id)
                ]).then(data => {
                    var serp = new Taxonomy(data[0].taxonomy)
                    var extension = data[1].taxonomy

                    serp.extend(extension)
                    resolve(serp.classify(taxonomy))
                })
            })
        })
        .then(root => root.shake())
        .then(root => {
            function explore(node, depth) {
                if (node.isEntityLeaf())
                    return el("div.entity", [node.name()])

                var children = node.map((n, i) => explore(n, depth + 1))
                if (depth > 2)
                    return children

                return el("div.sublevel.level-" + depth, [
                    node.name(),
                    children
                ])
            }

            return el("div.root", [
                root && root.map((n, i) => explore(n, 0))
                || "Entry is not classified"
            ])
        })
        .then(html => {
            var editBtn = el('button#editBtn.edit-btn', ['edit'])
            var extraButtons = (options && options.button) || []
            var modal = el('div#modal.modal', [
                el('div',[
                    el('div.modal-entry-type', [entry.type]),
                    closeButton(),
                    el('div.modal-header-title', [`entry #${entry.id}`]),
                    el("div.modal-divider"),
                    html,
                    el("div.modal-divider"),
                    entry.type === "challenge" ? [
                        el('div.modal-header-title', ['Description']),
                        el('div.modal-sub-item', [entry.description]),
                        el("div.modal-divider")
                    ] : [
                        el('div.modal-header-title', ['References']),
                        el('div.modal-sub-item', [entry.reference]),
                        el('div.modal-header-title', ['DOI']),
                        el('div.modal-sub-item', [entry.doi]),
                        el("div.modal-divider")
                    ],
                    editBtn,
                    extraButtons
                ])
            ])

            editBtn.addEventListener("click", function(evt) {
                window.location = `/submit.html?e=${entry.id}`;
            });

            document.body.appendChild(modal)
            modals.appear(modal)
        })
    }


	/* Creates a modal with fuzzy search */
	modals.fuzzyModal = function(obj,method) {
		var message = [el("div.modal-sub-item", [obj.message])]
		var list = obj.list

		 itemsFuzzy = new Fuse(list, {
			threshold: 0.4
		 })

		 var inputboxes = obj.input.map((conf, i) => {
			return el(`input#input${i}.modal-input-box`, {
				name: conf[0],
				type: conf[1],
				placeholder: conf[2]
			})
		 })

		 //creates optional button
		 var button1 = el('button.btn', [obj.btnText])

		 // Creates the fuzzy item divs
		var div = el('div.items-container');
		var emailMappings = {};
		var i = 0;
		list.forEach(item => {
			var innerDiv = document.createElement('div');
			innerDiv.className = 'item';
			innerDiv.innerHTML = item;
			emailMappings[i] = innerDiv;
			div.appendChild(emailMappings[i]);
			i++;
		})

		var modal = el('div#modal.modal', [
			el('div', [
				closeButton(),
				el("div.modal-header-title", [obj.desc]),
				//name of modal
				el("div.modal-divider"),
				message,
				inputboxes,
				el("div#search-divider.modal-divider"),
				div,
				el("div#bottom-divider.modal-divider"),
				button1, cancelButton()
			])
		 ])

		button1.addEventListener('click', (evt) => {
			//maybe apply toggleButtonState() ??
			var args = inputboxes.map(input => input.value)
			method.apply({modal}, args)
		})

		document.body.appendChild(modal)
		// Focus on first input element
		if (obj.input.length > 0) {
				inputboxes[0].focus()
		}
		modals.appear(modal)

		$("#input0").on("input", function(evt) {
			var searchString = $(this).val();
			if (searchString) {
				$(".item").hide();
				var results = itemsFuzzy.search(searchString);
				if (results.length) {
					for (var i = 0; i < results.length; ++i) {
						var matchingEmail = results[i];
						$(emailMappings[matchingEmail]).show();
					}
				}
			} else {
				$(".item").show();
			}
		});
	}

    /**
     * Create configurable modal.
     *
     * obj = {
     *     desc   : 'description',
     *     message: 'message',
     *     input  : [inputConf, ..., inputConf],
     *     btnText: 'ok button text'
     * }
     *
     * inputConf = [input-name, input-type, input-placeholder]
     *
     * Method is called when ok button is clicked. It is called
     * with modal as context and input values are arguments.
     *
     **/

    modals.optionsModal = function(obj, onConfirm, onCancel) {
        var message = [el("div.modal-sub-item", [obj.message])]

        var inputboxes = (obj.input || []).map((conf, i) => {
            return el(`input#input${i}.modal-input-box`, {
                name: conf[0],
                type: conf[1],
                placeholder: conf[2]
            })
        })

        //creates optional button
        var button1 = el('button.btn', [obj.btnText])
		var cancelBtn = cancelButton()

        var modal = el('div#modal.modal', [
            el('div', [
                closeButton(),
                el("div.modal-header-title", [obj.desc]),
                //name of modal

                el("div.modal-divider"),
                message,
                inputboxes,

                el("div#bottom-divider.modal-divider"),
                button1, cancelBtn
            ])
        ])

        button1.addEventListener('click', (evt) => {
            //maybe apply toggleButtonState() ??
            var args = inputboxes.map(input => input.value)
            onConfirm.apply(modal, args)
        })

		cancelBtn.addEventListener('click', (evt) => {
			if (onCancel)
				onCancel.apply(modal)
		})

        document.body.appendChild(modal)
		modals.appear(modal)

        // Focus on first input element
        if (obj.input && obj.input.length) {
            inputboxes[0].focus()
        }

        return modal
    }


	modals.confirmDeleteOwnerPopUp = function (obj, method) {
		var list = obj.list || [];

		var confirmBtn = el('button#confirm.btn', ['confirm'])
		var modal = el('div#modal.modal.appear', [
			el('div', [
				closeButton(),
				el("div.modal-header-title", [obj.desc]),
				el("div.modal-divider"),
				el("div", [obj.message]),
				el('p.modal-sub-item', [
					list.map(item => el('div', ['· ' + item]))
				]),
				el("div", [obj.bottomMessage]),
				el("div#bottom-divider.modal-divider"),
				confirmBtn, cancelButton()
			])
		])

		confirmBtn.addEventListener('click', (evt) => {
			method.apply({ modal })
		})

		document.body.appendChild(modal)
	}

	/* Create simple modal */
	modals.confirmPopUp = function(desc, method) {
		
		var confirmBtn = el('button#confirm.btn', ['confirm'])
		var modal = el('div#modal.modal.appear', [
			el('div', [
				closeButton(),
				el("div.modal-header-title", [desc]),
				el("div#bottom-divider.modal-divider"),
				confirmBtn, cancelButton()
			])
		])
        modal.classList.add('confirm')

    	confirmBtn.addEventListener('click', (evt) => {
			method.apply({ modal })
			modal.remove()
		})

		modals.appear(modal)
		document.body.appendChild(modal)
	}

	/* Create simple modal with unique id */
	modals.confirmKickPopUp = function(desc, method) {
		var confirmBtn = el('button#confirm.btn', ['confirm'])
		var modal = el('div#modalConf.modal.confirm', [
			el('div', [
				closeButton(),
				el("div.modal-header-title", [desc]),
				//name of modal
				el("div#bottom-divider.modal-divider"),
				confirmBtn, cancelButton()
			])
		])

		confirmBtn.addEventListener('click', (evt) => {
			method.apply({modal})

		})

		modals.appear(modal)
		document.body.appendChild(modal)
	}

	modals.clearAll = function() {
		var modal = document.querySelector('.modal')
		while (modal){
			modal.parentNode.removeChild(modal)
			modal = document.querySelector('.modal');
		}

		var confirm = document.querySelector('.confirm')
		if (confirm)
			confirm.parentNode.removeChild(confirm)
	}

	modals.clearTop = function(){
		var modal = document.querySelector('.modal')
		if (modal)
			modal.parentNode.removeChild(modal)
	}

	modals.clearConfirm = function(){
		var confirmModal = document.querySelector('#modalConf')
		if (confirmModal)
			confirmModal.parentNode.removeChild(confirmModal)
	}



	 //adds entries to a modal and returns the id of the entry that got clicked
	 modals.listModal = function(obj, method) {
		var message = [el("div.modal-sub-item", [obj.message])]
		// The X in the top-right corner

		var entries = obj.input.map(entry => {
			var elEntry = el('div.modal-option-li', {
				'data-entry-id': entry.id
			}, [entry.description || entry.reference || entry.DOI])

			elEntry.addEventListener('click', (evt) => {
				var args = [entry.id];
				document.body.removeChild(modal)
				method.apply({modal}, args)
			});

			return elEntry;
		});

		//cancel button is a standard feature
		var modal = el('div#modal.modal', [
			el('div', [
				closeButton(),
				el("div.modal-header-title", [obj.desc]),
				//name of modal

				el("div.modal-divider"),
				message,
				entries,

				el("div#bottom-divider.modal-divider"),
				cancelButton()
			])
		])

		document.body.appendChild(modal)
		modals.appear(modal)
	}
})

window.addEventListener('load', () => {

	function escapeModal(evt){
		if (evt.keyCode !== 27)
			return
		
		/* Notice modal must be clicked to disappear */
		var noticeModal = document.querySelector('.modal.notice')
		if (!noticeModal)
			window.modals.clearAll()
	}

	function clickOffModal(evt){
		var remove = evt.target.classList.contains('modal') ||
					 evt.target.classList.contains('confirm') ||
					 evt.target.classList.contains('dyn-modal')

		/* Notice modal must be clicked to disappear */
		var isNoticeModal = evt.target.classList.contains('modal') &&
							evt.target.classList.contains('notice')
		
		if (isNoticeModal)
			return

		if (remove)
			document.body.removeChild(evt.target)
	}

	// Remove active modals when pressing ESC
	document.body.addEventListener('keydown', escapeModal, false )
	//Remove active modals when clicking outside modal
	document.body.addEventListener('click', clickOffModal, false )
	
}, false)
