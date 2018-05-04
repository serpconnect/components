
var taxFunc = window.taxFunc = {}

function clear_target() {
    while (TARGET.lastChild)
        TARGET.removeChild(TARGET.lastChild)
}

taxFunc.byNbrOfChildren = function(a, b) {
    return a.children.length - b.children.length
}

/* Generate a classification setup a la submit page */
function classification_remove_row(evt) {
    var sample = this.parentNode
    sample.parentNode.removeChild(sample)
}
function classification_append_row(evt) {
   if (!this.parentNode.children.input.value.length>0){
        alert("Input box is Empty")
   }
   else{
        newLeaf = this.parentNode.children.input.value
        this.parentNode.parentNode.appendChild(
                el("div.leaf", [
                        el("div.header", [
                            el("label", [newLeaf]),
                            taxFunc.generate_button()
                        ])
                    ])
            )
        var sample = this.parentNode
        sample.parentNode.removeChild(sample)
    }
}

/* when user clicks the [+] of a facet */
function classification_add_row(evt) {
    var remove = el("div.remove", ["✖"])
    var confirm = el("div.remove", ['\u2714'])
    input = el("input#input")
    remove.addEventListener('click', classification_remove_row) 
    confirm.addEventListener('click', classification_append_row) 
    evt.parentNode.appendChild(el('div.entity-sample', [
        input,
        remove,
         el("div.divider"),
        confirm
    ]))
}
/* when user changes the checkbox value of a facet */
 taxFunc.classification_button_click = function(evt) {
    var header = this.parentNode
            classification_add_row(header)
}
    taxFunc.generate_button = function() {
    var button = el("div.add-facet", [])
    button.addEventListener('click', taxFunc.classification_button_click, false)
    return button
}

function generate_submit_classification(col) {
    clear_target()
    x = isDynamic(col) //returns -1 if false
    if(x!=-1){
        backend_repr = generate_Taxonomy(dynamic_Taxonomies[x])
        var taxonomy = new Taxonomy(backend_repr)
    }
    else{
        var taxonomy = new Taxonomy([])
    }

    /**
     * div.classification
     *     div.node
     *         span "Effect"
     *         div.leaf
     *             div.header
     *                 label "Solve new problem"
     *                 input "[x]"
     *             div.additional-data "click to add description +"
     *             div.entity-sample
     *                 input
     *                 div.remove "x"
     */
    var cxx = el('div.classification#classification', taxonomy.tree().map(
        function build(node, i) {
            if (node.isTreeLeaf()) {
                return el("div.leaf", [
                    el("div.header", [
                        el("label", [node.name()]),
                        generate_checkbox()
                    ])
                ])
            } else {
                return el("div.node", [
                    el("span", [node.name()]),
                    node.map(build).sort(byNbrOfChildren)
                ])
            }
        }).sort(byNbrOfChildren)
    )

    var divider = el("div.center", [
        el("div.classification-divider", [""]),
        el("div.divider-title", ["Customise Classification"]),
        el("div.classification-divider", [""])
    ])
    var saveBtn = el('button.btn', ['save'])
    saveBtn.addEventListener('click', save_taxonomy, false)
    TARGET.appendChild(el("div", [divider, cxx]))
    TARGET.appendChild(saveBtn)

}

function generate_Taxonomy(tax){
    var mapping = tax['mapping']
    list = flattendList(mapping)
    return list
}

function flattendList(mapping){
    var flattendList = []
    var ShortHandMap ={}
    mapping.forEach(function(current){
        short = current["child"]
        long = current["child"]
        parent = current["parent"]
        x = new taxFunc.Node(short,long,parent)
        flattendList.push(x)
    })
    var roots = ["effect","scope","context", "intervention"]
    roots.forEach(function(current){
        short = current
        long = current
        parent = "roots"
        x = new taxFunc.Node(short,long,parent)
        flattendList.push(x)
    })

    return flattendList
}

taxFunc.Node =function(id,name,parent) {
            this.id = id
            this.name = name
            this.parent = parent
    }

taxFunc.save_taxonomy = function(col){
        // var dynamic_Taxonomies
        dynamic_classification = []
        $("div[class=node]").each(function() {
            findLeaves(this)
        });

        function findLeaves(current){
            if(isLeaf(current)){
               $(current).children( ".leaf" ).each(function() {
                    var parent = current.children[0].textContent
                    var child = $(this).children(".header")[0].children[0].textContent
                    var leaf = new Node(parent, child)
                    dynamic_classification.push(leaf);
                    findLeaves(this)
               })
            }

            else{
                return
            }
        }

        function Node(parent, child) {
            this.child = child
            this.parent = parent
        }

        function Collection(col, mapping) {
            this.id = col
            this.mapping = mapping
        }

        function isLeaf(leaf) {
           return $(leaf).children( ".leaf" ).length!=0
        }
        var collection = new Collection(col, dynamic_classification)
        // dynamic_Taxonomies.push(collection)

        console.log( generate_Taxonomy(collection) )

}