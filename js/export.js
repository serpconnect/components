(function (){
  "use strict";

  window.export = {
    toFile:exportCollectionToFile
  }

  var cID;
  var cName;
  var modal;

  function CSVDelimiter(){
    return document.getElementById("selectDelimiterCSV").value;
  }

  function leafDelimiter(){
    return document.getElementById("selectDelimiterLeaf").value;
  }

  function filenameInput(){
    return document.getElementById("exportFilename").value;
  }

  var delimiters = [
      {value: ',' , display: 'Comma (,)'},
      {value: ';' , display: 'Semi-Colon (;)'},
      {value: ':' , display: 'Colon (:)'},
      {value: '|' , display: 'Pipe (|)'},
      {value: '^' , display: 'Caret (^)'},
      {value: '~' , display: 'Tilde (~)'},
      {value: '\t' , display: 'Tab'},
      {value: ' ' , display: 'Space'}
  ];

  function exportCollectionToFile(collID, colName){
    cID = collID;
    cName = colName;
    createExportModal();

    // Comma should probably not be the default delimiter
    // since a lot of the entries contain commas.
    document.getElementById("selectDelimiterCSV").selectedIndex = 1;
    document.getElementById("selectDelimiterLeaf").selectedIndex = 3;

    document.getElementById("selectDelimiterCSV").addEventListener('change', (evt) => {
      checkDelimitersValidAndComplain();
    }, false);

    document.getElementById("selectDelimiterLeaf").addEventListener('change', (evt) => {
      checkDelimitersValidAndComplain();
    }, false);

    document.getElementById("exportCloseBtn").addEventListener('click', destroy, false);
    document.getElementById("exportCancelBtn").addEventListener('click', destroy, false);
    document.getElementById("exportBtn").addEventListener('click', (evt) => {
      if(isInfoCorrect()){
        getTaxonomyAndExport();
      }
    }, false);

  }

  function destroy(evt) {
    document.body.removeChild(modal);
  }

  function getTaxonomyAndExport(){
    api.v1.collection.graph(cID).done(graph => {
      if(graph.nodes.length===0){
        complain(document.getElementById("exportBtn").parentNode,
                 "The collection has no entries to export");
        return
      }

      var taxonomy = getTaxonomy(graph);

      api.v1.collection.entries(cID).done(entries => {
        var numberOfEntries = entries.length;
        var generalInformation = [];
        var rows = [];
        var firstRow = setHeaders(entries, generalInformation, taxonomy);
        rows.push(firstRow);

        function toCSV(entry) {
            return api.v1.entry.taxonomy(entry.id).then(entryTaxonomy => {
                return calculateCSVRow(entry, entryTaxonomy, taxonomy)
            })
        }
        var entryRows = entries.map(entry => {
            return toCSV(entry).then(csvRow => rows.push(csvRow));
        })

        Promise.all(entryRows).then(() => {
            var csvContent = rows.join('');
            exportToCSV(csvContent);
            destroy();
        })

      })
    })
  }

  function getTaxonomy(graph) {
    var taxonomy = new Set();
    graph.edges.forEach(edge => {
      taxonomy.add(edge.type);
    });
    return Array.from(taxonomy);
  }

  function setHeaders(entries, generalInformation, taxonomy) {
    var keys = Object.keys(entries[0]);
    generalInformation.push(...keys);
    return keys.concat(...taxonomy).join(CSVDelimiter()) + "\n";
  }

  function calculateCSVRow(entry, entryTaxonomy, taxonomy){
    var csvRow = Object.keys(entry).map(k => entry[k])
      .map(value => String(value))
      .join(CSVDelimiter());

    csvRow += CSVDelimiter();

    csvRow += taxonomy
      .map(key => entryTaxonomy[key])
      .map(val => val ? val.join(leafDelimiter()) : "")
      .join(CSVDelimiter());

    csvRow += "\n";

    return csvRow;
  }

  function exportToCSV(csvContent) {
    var filename = `${filenameInput()}.csv`;
    var blob = new Blob([csvContent], { type: 'application/csv' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        var link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
          // Browsers that support HTML5 download attribute
          var url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else { // Safari 9.x and earlier
          var data = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(csvContent);
          var tab = window.open(data, "_blank");
          if(tab){
            tab.focus();
          } else {
            window.open(data, "_self");
          }
        }
    }
  }

  function createExportModal(){
    modal =
    el('div.modal#modal', [
        el('div', [
            el('div.close-btn#exportCloseBtn', ['']),
            el("h2", [`Export collection ${cName} (#${cID})` ]),
            el("div#exportFilenameWrapper", [
                el("input.modal-input-box#exportFilename", {type:"text", placeholder:"Filename"}),
                el("label", [" .csv"])
            ]),

            el("div.modal-divider"),
            delimiterDiv("CSV", "Select CSV delimiter "),
            el("div.modal-spacing"),
            delimiterDiv("Leaf", "Select taxonomy leaf delimiter "),
            el("div.modal-divider"),

            el("div", [
                el('button#exportBtn.btn', ["Export"]),
                el('button#exportCancelBtn.btn', ["Cancel"]),
            ]),
            el("p", ["Using Safari 9.x or earlier? The content will open in a new tab or \
            this page, depending on your browser preferences. Press \"cmd\" + \"s\", choose \
            a filename (include .csv), change Format to \"Page Source\" and click Save."])
        ])
    ]);
    setTimeout(() => modal.classList.add("appear"), 100);
    document.body.appendChild(modal);
  }

  function delimiterDiv(name, text){
    return  el("div", {id: "delimiter" + name}, [
                el("div.export-div-delimiter." + name, [
                    el("label", [text]),
                    el("select.export-select-delimiter", {id: "selectDelimiter" + name}, [
                        delimiters.map(delimiter =>
                        el('option', { value: delimiter.value }, [ delimiter.display ])),
                    ])
                ])
            ])
  }

  function isInfoCorrect(){
    clearComplaintsExport();
    var filenameValid = checkFileNameValidAndComplain();
    var delimitersValid = checkDelimitersValidAndComplain();
    if(filenameValid && delimitersValid){
      return true;
    }
    complain(document.getElementById("exportBtn").parentNode, "Incorrect input");
    return false;
  }

  function checkFileNameValidAndComplain(){
    if(filenameInput()){
      return true;
    }
    complain(document.getElementById("exportFilenameWrapper"), "Please supply information");
    return false;
  }

  function checkDelimitersValidAndComplain(){
    if(CSVDelimiter() !== leafDelimiter()) {
      clearComplaintsDelimiters();
      return true;
    }
    complainDelimiters(document.getElementById("delimiterCSV"), "The delimiters have to be different");
    return false;
  }

  function complainDelimiters(node, text){
    node.appendChild(
        el("div.complaint.export.delimiters", {text:text})
    );
  }

  function clearComplaintsDelimiters(){
    $(".complaint.export.delimiters").remove();
  }

  function complain(node, text){
    node.appendChild(
        el("div.complaint.export", {text:text})
    );
  }

  function clearComplaintsExport(){
    $(".complaint.export").remove();
  }

})();
